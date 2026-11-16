/**
 * 职责: 将扫描结果导出为 NOIR 兼容的 JSON, Markdown 和 CSV
 * 导出: reportJson, reportMarkdown, reportCsv, downloadName
 * 依赖: core/models / core/exposure / core/domains / core/trackers
 * 约束: JSON 字段与 NOIR report.json 对齐, 额外字段只追加不重命名
 * 作者: timecarol
 * 日期: 2026-11-15 23:50
 * 版本: v1.0
 */
import {
  ACTION_LABELS,
  CATEGORY_LABELS,
  DATA_TYPE_LABELS,
  type AppEntry,
  type DataType,
  type DomainExport,
  type Recommendation,
  type ScanResult,
} from './models';
import { exportDomains } from './domains';
import { uploadHosts } from './exposure';
import { isCommand, isUpload } from './rules';
import { trackersFromEndpoints } from './trackers';

/** reportJson 生成与 NOIR report.json 兼容的 JSON
 * @param result 完整扫描结果
 * @returns 两空格缩进的 JSON 文本
 */
export function reportJson(result: ScanResult): string {
  const domains = exportDomains(result.apps);
  const payload = {
    environment: {
      tool: result.meta.tool,
      host: result.meta.host,
      android: result.meta.android,
      sdk: result.meta.sdk,
      build: result.meta.build,
      fingerprint: result.meta.fingerprint,
      user: result.meta.user,
      generatedAt: result.meta.generatedAt,
      minScore: result.meta.minScore,
      limit: result.meta.limit,
    },
    device: { serial: result.serial, model: result.model },
    apps: result.apps.map(app => appJson(app)),
    recommendations: result.recommendations.map(item => ({
      package: item.pkg,
      action: ACTION_LABELS[item.action],
      actionKey: item.action,
      risk: item.risk,
      reason: item.reason,
      autoSafe: item.autoSafe,
    })),
    domains: {
      trackers: domains.trackers,
      review: domains.review,
      functional: domains.functional,
    },
    scan: {
      packageCount: result.packageCount,
      flagged: result.apps.length,
      failed: result.failed,
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
    },
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

/** appJson 生成单个应用的兼容字段 */
function appJson(app: AppEntry) {
  const upload = app.endpoints.filter(isUpload);
  const command = app.endpoints.filter(isCommand);
  return {
    package: app.pkg,
    uid: app.uid,
    system: app.isSystem,
    debuggable: app.debuggable,
    installer: app.installer,
    category: CATEGORY_LABELS[app.category],
    categoryKey: app.category,
    vendor: app.vendor,
    sharedUid: app.sharedUid,
    dataTypes: app.dataTypes.map(type => DATA_TYPE_LABELS[type]),
    dataTypeKeys: app.dataTypes,
    leaks: leaksJson(app),
    leaksByType: app.leaks,
    score: app.score,
    permissions: app.permissions,
    endpoints: app.endpoints,
    uploadEndpoints: upload,
    commandEndpoints: command,
    trackers: trackersFromEndpoints(app.endpoints),
    deepSignals: app.deepSignals ?? [],
    deepRisk: app.deepRisk ?? 0,
    apkPaths: app.apkPaths,
    manifest: app.manifest,
  };
}

/** leaksJson 生成 NOIR 兼容的本地化数据类别到主机列表映射 */
function leaksJson(app: AppEntry): Record<string, string[]> {
  const output: Record<string, string[]> = {};
  for (const [key, hosts] of Object.entries(app.leaks) as Array<[DataType, string[]]>) {
    output[DATA_TYPE_LABELS[key]] = hosts;
  }
  return output;
}

/** reportMarkdown 生成可读的 Markdown 报告 */
export function reportMarkdown(result: ScanResult): string {
  const lines: string[] = [];
  lines.push('# NOIR report', '');
  lines.push(`- tool: ${result.meta.tool}`);
  lines.push(`- host: ${result.meta.host}`);
  lines.push(`- device: \`${result.model}\` (\`${result.serial}\`)`);
  lines.push(`- android: ${result.meta.android} (SDK ${result.meta.sdk})`);
  lines.push(`- build: ${result.meta.build}`);
  lines.push(`- fingerprint: ${result.meta.fingerprint}`);
  lines.push(`- user: ${result.meta.user}`);
  lines.push(`- generated: ${result.meta.generatedAt}`);
  lines.push(`- filters: min=${result.meta.minScore} limit=${result.meta.limit}`);
  lines.push(`- packages: ${result.packageCount}`);
  lines.push(`- apps flagged: ${result.apps.length}`);
  lines.push(`- recommendations: ${result.recommendations.length}`, '');

  lines.push('## Overview', '');
  lines.push('| score | package | category | vendor | system | perms | upload | cmd |');
  lines.push('|---:|---|---|---|:---:|---:|---:|---:|');
  for (const app of result.apps) {
    lines.push(`| ${app.score} | \`${app.pkg}\` | ${md(CATEGORY_LABELS[app.category])} | ${md(app.vendor ?? '—')} | ${app.isSystem ? 'yes' : 'no'} | ${app.permissions.length} | ${app.endpoints.filter(isUpload).length} | ${app.endpoints.filter(isCommand).length} |`);
  }

  if (result.recommendations.length > 0) {
    lines.push('', '## Recommended actions', '');
    lines.push('| risk | action | package | why |');
    lines.push('|:---:|---|---|---|');
    for (const item of result.recommendations) {
      lines.push(`| ${item.risk} | ${md(ACTION_LABELS[item.action])} | \`${item.pkg}\` | ${md(item.reason)} |`);
    }
  }

  const shared = sharedUidGroups(result.apps);
  if (shared.length > 0) {
    lines.push('', '## Shared UIDs', '');
    lines.push('Packages below share one Linux uid, so they effectively hold the union of their permissions.', '');
    for (const [uid, apps] of shared) {
      lines.push(`- **${uid}** — ${apps.length} packages: ${apps.map(app => `\`${app.pkg}\``).join(', ')}`);
    }
  }

  lines.push('', '## Details');
  for (const app of result.apps) {
    lines.push('', `### ${app.pkg} (${app.score})`, '');
    lines.push(`- uid: ${app.uid} · system: ${app.isSystem} · debuggable: ${app.debuggable} · installer: ${app.installer ?? 'unknown'}`);
    lines.push(`- category: ${CATEGORY_LABELS[app.category]} · vendor: ${app.vendor ?? 'unknown'} · shared uid: ${app.sharedUid ?? '—'}`);
    lines.push(`- apk: ${app.apkPaths.map(path => `\`${path}\``).join(', ') || '—'}`);
    if (app.dataTypes.length > 0) lines.push(`- data: ${app.dataTypes.map(type => DATA_TYPE_LABELS[type]).join(', ')}`);
    if (app.deepSignals?.length) lines.push(`- dex signals: ${app.deepSignals.join(', ')} (risk ${app.deepRisk ?? 0})`);
    if (app.manifest) {
      const facts = app.manifest;
      const exported = facts.components.filter(component => component.exported && component.enabled && component.permission === null);
      lines.push(`- manifest: targetSdk=${facts.targetSdk ?? '—'} · cleartext=${boolText(facts.cleartext)} · backup=${boolText(facts.allowBackup)} · debuggable=${boolText(facts.debuggable)} · exported-without-permission=${exported.length}`);
    }
    for (const [type, hosts] of Object.entries(app.leaks) as Array<[DataType, string[]]>) {
      lines.push(`- leak path: ${DATA_TYPE_LABELS[type]} → ${hosts.join(', ')}`);
    }
    if (app.permissions.length > 0) lines.push(`- permissions: ${app.permissions.join(', ')}`);
    if (app.endpoints.length > 0) {
      lines.push('- endpoints:');
      for (const endpoint of app.endpoints.slice(0, 25)) lines.push(`  - \`${endpoint}\``);
    }
  }
  return `${lines.join('\n')}\n`;
}

/** reportCsv 生成一行一个应用, CRLF 结尾的表格 */
export function reportCsv(result: ScanResult): string {
  const header = [
    'device_model', 'device_serial', 'android', 'sdk', 'generated_at',
    'package', 'uid', 'system', 'debuggable', 'score',
    'category', 'category_key', 'vendor', 'installer', 'shared_uid',
    'data_types', 'data_type_keys', 'permissions',
    'upload_hosts', 'command_hosts', 'endpoints', 'trackers', 'deep_signals', 'deep_risk', 'exported_without_permission',
  ];
  const rows = [header.map(csvField).join(',')];
  for (const app of result.apps) {
    const exported = app.manifest?.components.filter(component => component.exported && component.enabled && component.permission === null).length ?? 0;
    rows.push([
      result.model, result.serial, result.meta.android, result.meta.sdk, result.meta.generatedAt,
      app.pkg, app.uid, String(app.isSystem), String(app.debuggable), String(app.score),
      CATEGORY_LABELS[app.category], app.category, app.vendor ?? '', app.installer ?? '', app.sharedUid ?? '',
      app.dataTypes.map(type => DATA_TYPE_LABELS[type]).join('; '),
      app.dataTypes.join('; '),
      app.permissions.join('; '),
      uploadHosts(app).join('; '),
      app.endpoints.filter(isCommand).join('; '),
      app.endpoints.join('; '),
      trackersFromEndpoints(app.endpoints).join('; '),
      (app.deepSignals ?? []).join('; '),
      String(app.deepRisk ?? 0),
      String(exported),
    ].map(csvField).join(','));
  }
  return `${rows.join('\r\n')}\r\n`;
}

/** downloadName 生成带设备和时间的稳定文件名 */
export function downloadName(result: ScanResult, extension: 'json' | 'md' | 'csv' | 'html' | 'txt'): string {
  const stamp = new Date(result.finishedAt).toISOString().replace(/[:.]/g, '-');
  const model = result.model.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'android';
  return `noir-${model}-${stamp}.${extension}`;
}

/** domainExport 返回报告中的三档域名清单 */
export function domainExport(result: ScanResult): DomainExport {
  return exportDomains(result.apps);
}

/** sharedUidGroups 汇总共享 UID, 只返回至少两个包的分组 */
function sharedUidGroups(apps: readonly AppEntry[]): Array<[string, AppEntry[]]> {
  const groups = new Map<string, AppEntry[]>();
  for (const app of apps) {
    if (!app.sharedUid) continue;
    const group = groups.get(app.sharedUid) ?? [];
    group.push(app);
    groups.set(app.sharedUid, group);
  }
  return [...groups].filter(([, group]) => group.length > 1).sort((left, right) => right[1].length - left[1].length);
}

/** boolText 把三态布尔转为报告文本 */
function boolText(value: boolean | null): string {
  return value === null ? 'unknown' : value ? 'true' : 'false';
}

/** md 转义表格单元格里的竖线和换行 */
function md(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/** csvField 按 RFC 4180 转义逗号, 引号和换行 */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** recommendationsByRisk 统计建议数量, 供 UI 摘要使用 */
export function recommendationsByRisk(recommendations: readonly Recommendation[]): Record<Recommendation['risk'], number> {
  const counts = { HIGH: 0, MED: 0, LOW: 0 };
  for (const item of recommendations) counts[item.risk]++;
  return counts;
}