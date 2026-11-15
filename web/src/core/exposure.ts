/**
 * 职责: 将权限映射为用户数据类别, 并与上报域名关联
 * 导出: hostOf, dataTypes, uploadHosts, leaks
 * 依赖: core/models / core/rules
 * 约束: 只有存在上报端点时才产生 leak 关联
 * 作者: timecarol
 * 日期: 2026-11-15 23:35
 * 版本: v1.1
 */
import type { AppEntry, AppFacts, DataType } from './models';

const MAP: Record<string, DataType[]> = {
  ACCESS_FINE_LOCATION: ['LOCATION'],
  ACCESS_COARSE_LOCATION: ['LOCATION'],
  ACCESS_BACKGROUND_LOCATION: ['LOCATION'],
  READ_CONTACTS: ['CONTACTS'],
  READ_SMS: ['SMS'],
  RECEIVE_SMS: ['SMS'],
  READ_CALL_LOG: ['CALLS'],
  READ_PHONE_STATE: ['IDENTITY'],
  READ_PHONE_NUMBERS: ['IDENTITY'],
  READ_PRIVILEGED_PHONE_STATE: ['IDENTITY'],
  RECORD_AUDIO: ['MIC'],
  CAPTURE_AUDIO_OUTPUT: ['MIC'],
  CAPTURE_VOICE_COMMUNICATION_OUTPUT: ['MIC'],
  CAMERA: ['CAMERA'],
  FOREGROUND_SERVICE_MEDIA_PROJECTION: ['SCREEN'],
  QUERY_ALL_PACKAGES: ['APPS'],
  PACKAGE_USAGE_STATS: ['APPS'],
  MANAGE_EXTERNAL_STORAGE: ['FILES'],
  READ_MEDIA_IMAGES: ['FILES'],
  READ_MEDIA_VIDEO: ['FILES'],
  READ_MEDIA_AUDIO: ['FILES'],
  READ_EXTERNAL_STORAGE: ['FILES'],
  READ_CALENDAR: ['CALENDAR'],
  GET_ACCOUNTS: ['ACCOUNTS'],
};

const ORDER: DataType[] = ['LOCATION', 'CONTACTS', 'SMS', 'CALLS', 'MIC', 'CAMERA', 'SCREEN', 'APPS', 'IDENTITY', 'FILES', 'CALENDAR', 'ACCOUNTS'];
const VALID_HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** dataTypes 将权限转换为有序数据类别 */
export function dataTypes(permissions: readonly string[]): DataType[] {
  const set = new Set<DataType>();
  for (const permission of permissions) {
    for (const type of MAP[permission] ?? []) set.add(type);
  }
  return ORDER.filter(type => set.has(type));
}

/** hostOf 从 URL 提取小写主机, 与 NOIR 的字符串边界保持一致
 * @param url 原始端点
 * @returns 带点号的主机或 null
 */
export function hostOf(url: string): string | null {
  const authority = url.split('://').slice(1).join('://').split('/')[0].split('?')[0].split('#')[0].split('@').pop() ?? '';
  if (!authority) return null;
  const host = (authority.startsWith('[') ? authority.split(']')[0].replace('[', '') : authority.split(':')[0]).toLowerCase();
  return host.includes('.') && host ? host : null;
}

/** isHostname 判断字符串是否是可用于 DNS 查询的主机名 */
export function isHostname(host: string): boolean {
  return VALID_HOST.test(host.toLowerCase());
}

/** uploadHosts 返回应用所有上报端点的去重主机 */
export function uploadHosts(app: AppEntry | AppFacts): string[] {
  const uploads = app.endpoints.filter(url => /\/(report|reports|upload|uploads|collect|collection|track|tracking|tracker|stat|stats|statistic|statistics|beacon|log|logs|logging|analytics|metrics|crash|crashes)([/?]|$)/i.test(url.split('?')[0].split('#')[0]));
  return [...new Set(uploads.map(hostOf).filter((host): host is string => host !== null && isHostname(host)))].sort();
}

/** leaks 返回数据类别与可能接收它的上报主机的对应关系 */
export function leaks(app: AppEntry | AppFacts): Partial<Record<DataType, string[]>> {
  const hosts = uploadHosts(app);
  if (hosts.length === 0) return {};
  const result: Partial<Record<DataType, string[]>> = {};
  for (const type of dataTypes(app.permissions)) result[type] = hosts;
  return result;
}