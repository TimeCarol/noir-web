/**
 * 职责: 把权限和 URL 字符串转换为可解释的风险信号
 * 导出: Rules
 * 依赖: 无
 * 约束: 规则与 NOIR Rules.kt 保持一致, 评分可追溯
 * 作者: timecarol
 * 日期: 2026-11-15 23:35
 * 版本: v1.0
 */
export const SENSITIVE_PERMISSIONS = [
  'ACCESS_FINE_LOCATION',
  'ACCESS_COARSE_LOCATION',
  'ACCESS_BACKGROUND_LOCATION',
  'READ_CONTACTS',
  'READ_SMS',
  'RECEIVE_SMS',
  'READ_CALL_LOG',
  'READ_PHONE_STATE',
  'READ_PHONE_NUMBERS',
  'READ_PRIVILEGED_PHONE_STATE',
  'RECORD_AUDIO',
  'CAMERA',
  'BODY_SENSORS',
  'PACKAGE_USAGE_STATS',
  'QUERY_ALL_PACKAGES',
  'GET_ACCOUNTS',
  'READ_CALENDAR',
  'MANAGE_EXTERNAL_STORAGE',
  'READ_EXTERNAL_STORAGE',
  'READ_MEDIA_IMAGES',
  'READ_MEDIA_VIDEO',
  'READ_MEDIA_AUDIO',
  'SYSTEM_ALERT_WINDOW',
  'REQUEST_INSTALL_PACKAGES',
  'FOREGROUND_SERVICE_MEDIA_PROJECTION',
  'CAPTURE_AUDIO_OUTPUT',
  'CAPTURE_VOICE_COMMUNICATION_OUTPUT',
  'WRITE_SECURE_SETTINGS',
] as const;

const UPLOAD = /\/(report|reports|upload|uploads|collect|collection|track|tracking|tracker|stat|stats|statistic|statistics|beacon|log|logs|logging|analytics|metrics|crash|crashes)([/?]|$)/i;
const COMMAND = /\/(command|commands|cmd|dispatch|execute|script)([/?]|$)/i;

/** pathOf 只保留路径, 查询参数经常包含无关 URL */
function pathOf(url: string): string {
  return url.split('?')[0].split('#')[0];
}

/** isUpload 判断 URL 路径是否像上报端点 */
export function isUpload(url: string): boolean {
  return UPLOAD.test(pathOf(url));
}

/** isCommand 判断 URL 路径是否像命令通道 */
export function isCommand(url: string): boolean {
  return COMMAND.test(pathOf(url));
}

/** sensitivePermissions 过滤出 NOIR 关注且已授予的敏感权限 */
export function sensitivePermissions(permissions: readonly string[]): string[] {
  const set = new Set<string>(SENSITIVE_PERMISSIONS);
  return permissions.filter(permission => set.has(permission));
}

/** score 计算 NOIR 兼容风险分 */
export function score(permissions: readonly string[], endpoints: readonly string[], isSystem: boolean, debuggable: boolean): number {
  let value = permissions.length;
  if (permissions.includes('QUERY_ALL_PACKAGES')) value += 2;
  if (permissions.includes('READ_PRIVILEGED_PHONE_STATE')) value += 3;
  if (permissions.includes('FOREGROUND_SERVICE_MEDIA_PROJECTION')) value += 4;
  if (isSystem) value += 2;
  if (debuggable) value += 2;
  if (endpoints.some(isCommand)) value += 2;
  if (endpoints.some(isUpload)) value += 3;
  return value;
}