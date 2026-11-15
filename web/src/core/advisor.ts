/**
 * 职责: 将扫描结果转换为少量有序, 可执行的处置建议
 * 导出: advise
 * 依赖: core/models / core/exposure
 * 约束: 不因遥测密度建议卸载用户应用, 不把录屏能力等同于常驻授权
 * 作者: timecarol
 * 日期: 2026-11-15 23:50
 * 版本: v1.0
 */
import type { AppEntry, Recommendation } from './models';
import { uploadHosts } from './exposure';

const CORE = new Set([
  'com.miui.securitycenter',
  'com.miui.guardprovider',
  'com.xiaomi.xmsf',
  'com.xiaomi.digitalkey',
  'com.android.systemui',
  'com.miui.home',
  'com.android.settings',
  'com.android.phone',
  'com.android.mms',
  'com.android.incallui',
]);

/** advise 按风险从高到低生成建议, 同一包同一动作只保留一条
 * @param apps 已评分应用
 * @returns 排序后的建议列表
 */
export function advise(apps: readonly AppEntry[]): Recommendation[] {
  const output: Recommendation[] = [];

  for (const app of apps) {
    if (app.pkg === 'android') continue;

    if (app.permissions.includes('PACKAGE_USAGE_STATS') && app.category === 'TELEMETRY' && app.isSystem) {
      output.push({
        pkg: app.pkg,
        action: 'APPOP_USAGE_STATS',
        risk: 'MED',
        reason: '遥测类系统应用可读取应用使用统计',
        autoSafe: true,
      });
    }

    if ((app.category === 'TELEMETRY' || app.category === 'ADS') && !CORE.has(app.pkg)) {
      output.push({
        pkg: app.pkg,
        action: 'REVIEW',
        risk: app.isSystem ? 'HIGH' : 'MED',
        reason: app.isSystem
          ? '遥测/广告类系统组件, 无法卸载, 建议 DNS 层拦截'
          : '遥测/广告密度高, 评估后决定是否保留',
        autoSafe: false,
      });
    }

    if ((app.category === 'TELEMETRY' || app.category === 'LOCATION' || app.category === 'ADS') && uploadHosts(app).length >= 2) {
      output.push({
        pkg: app.pkg,
        action: 'BLOCK_DNS',
        risk: 'LOW',
        reason: '存在多个上报端点, 可在 DNS 层拦截',
        autoSafe: false,
      });
    }
  }

  const seen = new Set<string>();
  return output
    .filter(item => {
      const key = `${item.pkg}|${item.action}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => riskRank(left.risk) - riskRank(right.risk) || actionRank(left.action) - actionRank(right.action));
}

/** riskRank 将风险标签映射为稳定排序权重 */
function riskRank(risk: Recommendation['risk']): number {
  return risk === 'HIGH' ? 0 : risk === 'MED' ? 1 : 2;
}

/** actionRank 保持与 NOIR ActionType 枚举一致的顺序 */
function actionRank(action: Recommendation['action']): number {
  return ['APPOP_PROJECT_MEDIA', 'APPOP_USAGE_STATS', 'UNINSTALL_USER', 'REVIEW', 'BLOCK_DNS'].indexOf(action);
}