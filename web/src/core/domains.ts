/**
 * 职责: 将上报域名分为可拦截, 待复核和不可拦截三档
 * 导出: classifyDomain, exportDomains, isIgnored, isTestHost
 * 依赖: core/models / core/exposure
 * 约束: 标签边界匹配, 不使用简单子串误伤 status/static
 * 作者: timecarol
 * 日期: 2026-11-15 23:35
 * 版本: v1.1
 */
import type { AppEntry, DomainClass, DomainExport } from './models';
import { hostOf, isHostname } from './exposure';
import { isUpload } from './rules';

const IGNORED_HOSTS = new Set([
  'schemas.android.com',
  'www.w3.org',
  'w3.org',
  'xmlpull.org',
  'jakarta.apache.org',
  'apache.org',
  'ns.adobe.com',
  'xml.apache.org',
  'java.sun.com',
  'www.bea.com',
  'github.com',
  'githubusercontent.com',
  'codeberg.org',
  'schemas.microsoft.com',
  'developer.android.com',
  'issuetracker.google.com',
  'youtrack.jetbrains.com',
  'localhost',
]);

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV6 = /^[0-9a-fA-F:]+$/;

const FUNCTIONAL_LABELS = new Set([
  'push', 'xmpush', 'mipush', 'fcm', 'gcm', 'mtalk', 'firebase', 'jpush', 'getui',
  'account', 'accounts', 'login', 'passport', 'oauth', 'sso', 'signin',
  'update', 'updater', 'ota', 'download', 'dl',
  'pay', 'mipay', 'alipay', 'unionpay', 'wallet',
  'play', 'vending', 'market', 'appstore',
  'cloud', 'micloud', 'icloud', 'backup', 'sync',
  'connect',
]);

const FUNCTIONAL_EXTRA_LABELS = new Set(['googleapis', 'gstatic', 'oppomobile', 'heytapmobi']);
const BLOCK_EXACT = new Set(['log', 'logs', 'ads', 'ad', 'mon', 'px', 'ut', 'mam', 'up4']);
const BLOCK_SUBSTRINGS = [
  'applog', 'errlog', 'errnewlog', 'rtlog', 'rtapplog', 'uplog', 'apmlog', 'aegis-log',
  'monitor', 'beacon', 'track', 'collect', 'crash', 'metrics',
  'telemetry', 'umeng', 'appsflyer', 'adjust', 'oceanengine', 'zijieapi', 'qplus',
  'snssdk', 'cnzz', 'growingio', 'sensorsdata', 'mixpanel', 'amplitude', 'pangle',
  'sigmob', 'adashx', 'pingma', 'talkingdata', 'bugtrace', 'huatuo', 'apmplus',
  'coverage', 'zxid', 'oaid', 'wkanx', 'videoreport',
];
const BLOCK_CONTAINS = ['report', 'analytics'];
const TEST_LABELS = new Set(['test', 'testing', 'staging', 'stg', 'dev', 'daily', 'preview', 'sandbox']);

/** classifyDomain 对单个主机做三档分类 */
export function classifyDomain(host: string): DomainClass {
  const labels = host.toLowerCase().split('.');
  if (labels.some(label => TEST_LABELS.has(label))) return 'REVIEW';
  if (labels.some(label => BLOCK_EXACT.has(label))) return 'TRACKER';
  if (labels.some(label => BLOCK_SUBSTRINGS.some(token => label.startsWith(token)) || BLOCK_CONTAINS.some(token => label.includes(token)))) return 'TRACKER';
  if (labels.some(label => label === 'stat' || label === 'stats' || label.startsWith('statistic'))) return 'TRACKER';
  if (labels.some(label => FUNCTIONAL_LABELS.has(label) || FUNCTIONAL_EXTRA_LABELS.has(label))) return 'FUNCTIONAL';
  return 'REVIEW';
}

/** isTestHost 判断测试, 预发或沙箱域名 */
export function isTestHost(host: string): boolean {
  return host.toLowerCase().split('.').some(label => TEST_LABELS.has(label));
}

/** isIgnored 判断不是真实网络端点的域名和 IP */
export function isIgnored(host: string): boolean {
  const lower = host.toLowerCase();
  if (IGNORED_HOSTS.has(lower)) return true;
  if (IPV4.test(lower)) return true;
  if (lower.includes(':') && IPV6.test(lower)) return true;
  if (!isHostname(lower)) return true;
  return false;
}

/** exportDomains 汇总三档域名清单 */
export function exportDomains(apps: readonly AppEntry[]): DomainExport {
  const trackers = new Set<string>();
  const review = new Set<string>();
  const functional = new Set<string>();
  for (const app of apps) {
    for (const url of app.endpoints.filter(isUpload)) {
      const host = hostOf(url);
      if (!host || isIgnored(host) || isTestHost(host)) continue;
      const klass = classifyDomain(host);
      if (klass === 'TRACKER') trackers.add(host);
      else if (klass === 'FUNCTIONAL') functional.add(host);
      else review.add(host);
    }
  }
  return {
    trackers: [...trackers].sort(),
    review: [...review].sort(),
    functional: [...functional].sort(),
  };
}