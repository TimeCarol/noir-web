/**
 * 职责: 将处置建议转换为可人工执行的命令和回滚命令
 * 导出: reportPlan
 * 依赖: core/models
 * 约束: 只生成命令文本, 不连接设备, 不自动执行
 * 作者: timecarol
 * 日期: 2026-11-16 09:20
 * 版本: v1.0
 */
import { ACTION_LABELS, type Recommendation, type ScanResult } from './models';

/** reportPlan 生成 plan.txt 内容
 * @param result 扫描结果
 * @returns 带命令, 回滚和人工复核项的文本
 */
export function reportPlan(result: ScanResult): string {
  const lines = [
    '# NOIR Web plan',
    `# device: ${result.model} (${result.serial})`,
    `# user: ${result.meta.user}`,
    `# generated: ${result.meta.generatedAt}`,
    '# review every command before running it',
    '',
  ];
  for (const item of result.recommendations) {
    const plan = commandFor(result, item);
    if (plan) {
      lines.push(plan.command, `# rollback: ${plan.rollback}`, '');
    } else {
      lines.push(`# ${ACTION_LABELS[item.action]}: ${item.pkg} — ${item.reason}`, '');
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

/** commandFor 返回可执行命令和对应回滚, 人工动作为 null */
function commandFor(result: ScanResult, item: Recommendation): { command: string; rollback: string } | null {
  const shell = `adb -s ${result.serial} shell`;
  const user = result.meta.user || '0';
  if (item.action === 'APPOP_USAGE_STATS') {
    return {
      command: `${shell} cmd appops set --user ${user} ${item.pkg} GET_USAGE_STATS ignore`,
      rollback: `${shell} cmd appops set --user ${user} ${item.pkg} GET_USAGE_STATS default`,
    };
  }
  if (item.action === 'APPOP_PROJECT_MEDIA') {
    return {
      command: `${shell} cmd appops set --user ${user} ${item.pkg} PROJECT_MEDIA ignore`,
      rollback: `${shell} cmd appops set --user ${user} ${item.pkg} PROJECT_MEDIA default`,
    };
  }
  if (item.action === 'UNINSTALL_USER') {
    return {
      command: `${shell} pm uninstall --user ${user} ${item.pkg}`,
      rollback: `${shell} pm install-existing --user ${user} ${item.pkg}`,
    };
  }
  return null;
}