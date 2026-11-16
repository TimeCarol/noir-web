/**
 * 职责: 从建议中生成可预览和执行的 appops 动作
 * 导出: AppOpAction, appOpActions, appOpCommand, appOpLabel
 * 依赖: core/models / adb/appops
 * 约束: 只生成 appops 动作, 不自动执行
 * 作者: timecarol
 * 日期: 2026-11-16 09:40
 * 版本: v1.0
 */
import type { AppOp, AppOpMode } from '../adb/appops';
import type { Recommendation } from './models';

/** AppOpAction 是一个可处置的 appops 动作 */
export interface AppOpAction {
  pkg: string;
  op: AppOp;
  action: 'APPOP_USAGE_STATS' | 'APPOP_PROJECT_MEDIA';
  risk: Recommendation['risk'];
  reason: string;
  autoSafe: boolean;
}

const ACTIONS: Partial<Record<Recommendation['action'], { op: AppOp; action: AppOpAction['action'] }>> = {
  APPOP_USAGE_STATS: { op: 'GET_USAGE_STATS', action: 'APPOP_USAGE_STATS' },
  APPOP_PROJECT_MEDIA: { op: 'PROJECT_MEDIA', action: 'APPOP_PROJECT_MEDIA' },
};

/** appOpActions 提取并去重 appops 建议 */
export function appOpActions(recommendations: readonly Recommendation[]): AppOpAction[] {
  const seen = new Set<string>();
  const actions: AppOpAction[] = [];
  for (const item of recommendations) {
    const mapping = ACTIONS[item.action];
    if (!mapping) continue;
    const key = `${item.pkg}|${mapping.op}`;
    if (seen.has(key)) continue;
    seen.add(key);
    actions.push({ pkg: item.pkg, op: mapping.op, action: mapping.action, risk: item.risk, reason: item.reason, autoSafe: item.autoSafe });
  }
  return actions.sort((left, right) => riskRank(left.risk) - riskRank(right.risk) || left.pkg.localeCompare(right.pkg));
}

/** appOpCommand 生成 adb shell appops 命令 */
export function appOpCommand(serial: string, user: string, pkg: string, op: AppOp, mode: AppOpMode): string {
  return `adb -s ${serial} shell cmd appops set --user ${user || '0'} ${pkg} ${op} ${mode}`;
}

/** appOpLabel 返回 app op 的展示名称 */
export function appOpLabel(op: AppOp): string {
  return op === 'GET_USAGE_STATS' ? '使用统计' : '常驻录屏';
}

/** riskRank 将风险映射为排序权重 */
function riskRank(risk: Recommendation['risk']): number {
  return risk === 'HIGH' ? 0 : risk === 'MED' ? 1 : 2;
}