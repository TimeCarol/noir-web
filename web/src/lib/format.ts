/**
 * 职责: 统一设备名称和空值的展示文本
 * 导出: deviceLabel, valueOrDash
 * 依赖: 无
 * 约束: 不把读取失败伪装成零值或默认型号
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.0
 */
/** deviceLabel 生成设备展示名, 型号为空时回退到序列号 */
export function deviceLabel(name: string, serial: string): string {
  return name.trim() || serial.trim() || 'Android 设备';
}

/** valueOrDash 保留未知状态, 不把空属性写成 0 或默认值 */
export function valueOrDash(value: string | null | undefined): string {
  return value && value.trim() ? value : '—';
}