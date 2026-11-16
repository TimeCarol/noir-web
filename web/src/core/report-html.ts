/**
 * 职责: 生成自包含的离线 HTML 审计报告
 * 导出: reportHtml
 * 依赖: core/models / core/domains / core/exposure / core/trackers
 * 约束: 不加载远端资源, 不执行脚本, 所有文本写入前转义
 * 作者: timecarol
 * 日期: 2026-11-16 08:20
 * 版本: v1.0
 */
import {
  ACTION_LABELS,
  CATEGORY_LABELS,
  DATA_TYPE_LABELS,
  type AppEntry,
  type DataType,
  type ScanResult,
} from './models';
import { exportDomains } from './domains';
import { isCommand, isUpload } from './rules';
import { trackersFromEndpoints } from './trackers';

/** reportHtml 生成可离线打开的单文件 HTML
 * @param result 完整扫描结果
 * @returns 内联样式和数据的 HTML 文本
 */
export function reportHtml(result: ScanResult): string {
  const domains = exportDomains(result.apps);
  const endpointCount = result.apps.reduce((sum, app) => sum + app.endpoints.length, 0);
  const high = result.recommendations.filter(item => item.risk === 'HIGH').length;
  const appRows = result.apps.map(app => {
    const upload = app.endpoints.filter(isUpload).length;
    const command = app.endpoints.filter(isCommand).length;
    return `<tr>
      <td class="num">${app.score}</td>
      <td><code>${escapeHtml(app.pkg)}</code></td>
      <td>${escapeHtml(CATEGORY_LABELS[app.category])}</td>
      <td>${escapeHtml(app.vendor ?? '—')}</td>
      <td>${app.isSystem ? '系统' : '用户'}</td>
      <td class="num">${app.permissions.length}</td>
      <td class="num">${upload}</td>
      <td class="num">${command}</td>
    </tr>`;
  }).join('');
  const recommendationRows = result.recommendations.map(item => `<tr>
      <td><span class="risk risk-${item.risk.toLowerCase()}">${escapeHtml(item.risk)}</span></td>
      <td>${escapeHtml(ACTION_LABELS[item.action])}</td>
      <td><code>${escapeHtml(item.pkg)}</code></td>
      <td>${escapeHtml(item.reason)}</td>
      <td>${item.autoSafe ? '可自动' : '需确认'}</td>
    </tr>`).join('');
  const details = result.apps.map(app => appDetail(app)).join('');
  const shared = sharedUids(result.apps);

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NOIR report — ${escapeHtml(result.model)}</title>
<style>
:root{color-scheme:dark;--bg:#0b0b0e;--panel:#141419;--fg:#e7e7ea;--dim:#94949e;--line:#292933;--accent:#8b7cff;--red:#f87171;--amber:#fbbf24;--green:#34d399;--blue:#22d3ee}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
main{max-width:1180px;margin:0 auto;padding:40px 22px 72px}h1{font-size:26px;letter-spacing:-.03em;margin:0 0 6px}h2{font-size:16px;margin:32px 0 12px;color:var(--fg)}p{color:var(--dim)}a{color:var(--accent)}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px 24px;color:var(--dim);font-size:12px;margin:18px 0 28px}.meta b{color:var(--fg);font-weight:500}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.stat{padding:16px 18px;background:var(--panel);border:1px solid var(--line);border-radius:8px}.stat span{display:block;color:var(--dim);font-size:12px}.stat strong{display:block;font-size:26px;font-weight:500;letter-spacing:-.03em;margin-top:4px}
.table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:8px}table{width:100%;border-collapse:collapse;min-width:720px}th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{font-size:12px;color:var(--dim);font-weight:500;white-space:nowrap}tr:last-child td{border-bottom:0}.num{text-align:right;font-variant-numeric:tabular-nums}code{color:var(--blue);font:inherit}
.risk{display:inline-block;padding:1px 7px;border:1px solid currentColor;border-radius:4px;font-size:11px}.risk-high{color:var(--red)}.risk-med{color:var(--amber)}.risk-low{color:var(--blue)}
.tags{display:flex;flex-wrap:wrap;gap:5px}.tag{padding:1px 7px;border:1px solid var(--line);border-radius:4px;color:var(--dim);font-size:11px}
details{margin:8px 0;background:var(--panel);border:1px solid var(--line);border-radius:8px}summary{padding:12px 14px;cursor:pointer}summary b{color:var(--blue);font-weight:500}.detail{padding:0 14px 14px;border-top:1px solid var(--line);color:var(--dim)}.detail ul{margin:8px 0 0;padding-left:18px}.detail li{margin:4px 0;overflow-wrap:anywhere}
.domain{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}.domain h3{font-size:13px;margin:0 0 8px;color:var(--dim)}.muted{color:var(--dim)}
@media(max-width:620px){main{padding:24px 14px 48px}h1{font-size:22px}th,td{padding:8px 9px}}
</style>
</head>
<body><main>
<h1>NOIR report</h1>
<p>${escapeHtml(result.meta.tool)} · ${escapeHtml(result.meta.generatedAt)}</p>
<div class="meta">
<div>设备 <b>${escapeHtml(result.model)}</b></div>
<div>序列号 <b>${escapeHtml(result.serial)}</b></div>
<div>Android <b>${escapeHtml(result.meta.android)} (SDK ${escapeHtml(result.meta.sdk)})</b></div>
<div>构建 <b>${escapeHtml(result.meta.build)}</b></div>
<div>指纹 <b>${escapeHtml(result.meta.fingerprint)}</b></div>
<div>过滤 <b>min=${result.meta.minScore} · limit=${result.meta.limit}</b></div>
</div>
<div class="stats">
<div class="stat"><span>扫描包数</span><strong>${result.packageCount}</strong></div>
<div class="stat"><span>命中应用</span><strong>${result.apps.length}</strong></div>
<div class="stat"><span>端点</span><strong>${endpointCount}</strong></div>
<div class="stat"><span>建议</span><strong>${result.recommendations.length}</strong></div>
<div class="stat"><span>HIGH</span><strong>${high}</strong></div>
</div>
<h2>应用</h2>
<div class="table-wrap"><table><thead><tr><th>分数</th><th>包名</th><th>类别</th><th>厂商</th><th>来源</th><th>权限</th><th>上报</th><th>命令</th></tr></thead><tbody>${appRows || '<tr><td colspan="8" class="muted">无命中应用</td></tr>'}</tbody></table></div>
<h2>处置建议</h2>
<div class="table-wrap"><table><thead><tr><th>风险</th><th>动作</th><th>包名</th><th>原因</th><th>执行</th></tr></thead><tbody>${recommendationRows || '<tr><td colspan="5" class="muted">无建议</td></tr>'}</tbody></table></div>
<h2>域名</h2>
<div class="domain">
<section><h3>可拦截 ${domains.trackers.length}</h3><div class="tags">${tags(domains.trackers)}</div></section>
<section><h3>待复核 ${domains.review.length}</h3><div class="tags">${tags(domains.review)}</div></section>
<section><h3>功能域名 ${domains.functional.length}</h3><div class="tags">${tags(domains.functional)}</div></section>
</div>
${shared.length > 0 ? `<h2>共享 UID</h2>${shared.map(([uid, apps]) => `<p><b>${escapeHtml(uid)}</b> — ${apps.length} 个包: ${apps.map(app => `<code>${escapeHtml(app.pkg)}</code>`).join(', ')}</p>`).join('')}` : ''}
<h2>应用详情</h2>
${details || '<p class="muted">无命中应用</p>'}
</main></body></html>
`;
}

/** appDetail 生成一个应用的可折叠证据块 */
function appDetail(app: AppEntry): string {
  const leaks = (Object.entries(app.leaks) as Array<[DataType, string[]]>)
    .map(([type, hosts]) => `${DATA_TYPE_LABELS[type]} → ${hosts.join(', ')}`)
    .join('<br>');
  const manifest = app.manifest;
  const exported = manifest?.components.filter(component => component.exported && component.enabled && component.permission === null) ?? [];
  const permissions = app.permissions.length > 0 ? `<p>权限: ${app.permissions.map(escapeHtml).join(', ')}</p>` : '';
  const endpoints = app.endpoints.length > 0
    ? `<ul>${app.endpoints.slice(0, 50).map(url => `<li><code>${escapeHtml(url)}</code></li>`).join('')}${app.endpoints.length > 50 ? `<li>另有 ${app.endpoints.length - 50} 个</li>` : ''}</ul>`
    : '';
  const deepSignals = app.deepSignals?.length
    ? `<p>DEX 信号: ${app.deepSignals.map(signal => escapeHtml(signal)).join(', ')} (risk ${app.deepRisk ?? 0})</p>`
    : '';
  const manifestText = manifest
    ? `<p>Manifest: targetSdk=${escapeHtml(manifest.targetSdk ?? '—')} · cleartext=${boolText(manifest.cleartext)} · backup=${boolText(manifest.allowBackup)} · exported-without-permission=${exported.length}</p>`
    : '';
  const trackers = trackersFromEndpoints(app.endpoints);
  return `<details><summary><b>${app.score}</b> · <code>${escapeHtml(app.pkg)}</code> · ${escapeHtml(CATEGORY_LABELS[app.category])}</summary><div class="detail">
    <p>UID ${escapeHtml(app.uid)} · ${app.isSystem ? '系统' : '用户'} · 安装来源 ${escapeHtml(app.installer ?? '—')} · 共享 UID ${escapeHtml(app.sharedUid ?? '—')}</p>
    ${leaks ? `<p>泄露路径: ${leaks}</p>` : ''}
    ${trackers.length > 0 ? `<p>SDK: ${trackers.map(escapeHtml).join(', ')}</p>` : ''}
    ${permissions}${deepSignals}${manifestText}${endpoints}
  </div></details>`;
}

/** tags 渲染域名标签 */
function tags(values: readonly string[]): string {
  return values.length > 0 ? values.map(value => `<span class="tag">${escapeHtml(value)}</span>`).join('') : '<span class="muted">无</span>';
}

/** sharedUids 返回至少两个包的共享 UID 分组 */
function sharedUids(apps: readonly AppEntry[]): Array<[string, AppEntry[]]> {
  const groups = new Map<string, AppEntry[]>();
  for (const app of apps) {
    if (!app.sharedUid) continue;
    const group = groups.get(app.sharedUid) ?? [];
    group.push(app);
    groups.set(app.sharedUid, group);
  }
  return [...groups].filter(([, group]) => group.length > 1).sort((left, right) => right[1].length - left[1].length);
}

/** boolText 将 Manifest 三态布尔转为文本 */
function boolText(value: boolean | null): string {
  return value === null ? 'unknown' : value ? 'true' : 'false';
}

/** escapeHtml 转义文本节点和属性值 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}