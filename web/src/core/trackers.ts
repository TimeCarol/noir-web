/**
 * 职责: 从端点域名识别常见统计, 推送和归因 SDK
 * 导出: trackersFromEndpoints
 * 依赖: core/exposure
 * 约束: 只做域名和标签级匹配, 不从 URL 查询参数推断 SDK
 * 作者: timecarol
 * 日期: 2026-11-15 23:50
 * 版本: v1.0
 */
import { hostOf } from './exposure';

const DOMAINS: Array<[token: string, name: string]> = [
  ['umeng.com', 'Umeng'],
  ['appsflyer.com', 'AppsFlyer'],
  ['adjust.com', 'Adjust'],
  ['facebook.com', 'Meta'],
  ['facebook.net', 'Meta'],
  ['firebase', 'Firebase'],
  ['crashlytics', 'Firebase'],
  ['bytedance', 'ByteDance'],
  ['zijieapi', 'ByteDance'],
  ['pangle', 'ByteDance'],
  ['qq.com', 'Tencent'],
  ['tencent', 'Tencent'],
  ['amap.com', 'Alibaba'],
  ['aliyun', 'Alibaba'],
  ['alibaba', 'Alibaba'],
  ['baidu.com', 'Baidu'],
  ['sogou.com', 'Sogou'],
  ['iflytek', 'iFlytek'],
  ['voicecloud', 'iFlytek'],
  ['sentry.io', 'Sentry'],
  ['mixpanel', 'Mixpanel'],
  ['amplitude.com', 'Amplitude'],
  ['onesignal.com', 'OneSignal'],
  ['bugly.qq.com', 'Bugly'],
  ['growingio.com', 'GrowingIO'],
  ['sensorsdata', 'Sensors'],
  ['getui', 'Getui'],
  ['jpush', 'JPush'],
  ['xmpush', 'MiPush'],
  ['umengcloud', 'Umeng'],
];

/** trackersFromEndpoints 返回端点中命中的 SDK 名称, 按字母序去重
 * @param urls 应用端点
 * @returns 命中的 SDK 名称
 */
export function trackersFromEndpoints(urls: readonly string[]): string[] {
  const hosts = urls.map(hostOf).filter((host): host is string => host !== null);
  const names = new Set<string>();
  for (const [token, name] of DOMAINS) {
    const hit = hosts.some(host => host === token
      || host.endsWith(`.${token}`)
      || host.split('.').some(label => label === token || label.startsWith(`${token}-`) || label.startsWith(`${token}.`)));
    if (hit) names.add(name);
  }
  return [...names].sort();
}