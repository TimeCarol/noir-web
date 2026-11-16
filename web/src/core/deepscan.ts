/**
 * 职责: 计算 DEX 字符串信号的风险分和展示标签
 * 导出: deepRisk, deepSignalLabel
 * 依赖: apk/dex
 * 约束: 信号是静态字符串证据, 不声称等价于 jadx 源码扫描
 * 作者: timecarol
 * 日期: 2026-11-16 10:20
 * 版本: v1.0
 */
import { DEEP_SIGNALS } from '../apk/dex';

/** deepRisk 按信号权重累计并限制在 40 */
export function deepRisk(signals: readonly string[]): number {
  const keys = new Set(signals);
  let risk = 0;
  for (const signal of DEEP_SIGNALS) {
    if (keys.has(signal.key)) risk += signal.weight;
  }
  return Math.min(40, risk);
}

/** deepSignalLabel 返回信号的展示名称 */
export function deepSignalLabel(key: string): string {
  return DEEP_SIGNALS.find(signal => signal.key === key)?.label ?? key;
}
