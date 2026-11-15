/**
 * 职责: 将未知异常转换为可展示的短文本
 * 导出: errorText
 * 依赖: 无
 * 约束: 不包含请求头, 设备凭据或完整对象
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.0
 */
/** errorText 读取 Error.message, 其他值回退到固定文案 */
export function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return '操作未完成';
}