/**
 * 职责: 解析 NOIR 兼容报告并比较两次扫描的差异
 * 导出: ReportDocument, ReportApp, ReportDiff, AppDiff, DiffStatus, ReportParseError, parseReport, diffReports
 * 依赖: 无
 * 约束: 只比较报告中的稳定字段, 不执行网络或设备操作
 * 作者: timecarol
 * 日期: 2026-11-16 08:30
 * 版本: v1.0
 */

/** DiffStatus 表示包在两次报告之间的变化类型 */
export type DiffStatus = 'added' | 'removed' | 'changed' | 'same';

/** ReportApp 是导入报告中的应用记录 */
export interface ReportApp {
  pkg: string;
  score: number;
  categoryKey: string;
  vendor: string | null;
  permissions: string[];
  endpoints: string[];
  dataTypeKeys: string[];
  trackers: string[];
}

/** ReportDocument 是可比较的报告摘要 */
export interface ReportDocument {
  model: string;
  serial: string;
  generatedAt: string;
  apps: ReportApp[];
}

/** AppDiff 是一行应用差异 */
export interface AppDiff {
  pkg: string;
  status: DiffStatus;
  base?: ReportApp;
  target?: ReportApp;
  scoreDelta: number;
  permissionsAdded: string[];
  permissionsRemoved: string[];
  endpointsAdded: string[];
  endpointsRemoved: string[];
}

/** ReportDiff 是完整对比结果 */
export interface ReportDiff {
  base: ReportDocument;
  target: ReportDocument;
  rows: AppDiff[];
  summary: Record<DiffStatus, number>;
}

/** ReportParseError 表示输入不是可比较的 NOIR 报告 */
export class ReportParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportParseError';
  }
}

/** parseReport 解析 report.json 并校验最小字段
 * @param text JSON 文本
 * @returns 归一化后的报告摘要
 * @throws ReportParseError
 */
export function parseReport(text: string): ReportDocument {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ReportParseError('报告不是合法 JSON');
  }
  if (!isRecord(payload) || !Array.isArray(payload.apps)) {
    throw new ReportParseError('报告缺少 apps 数组');
  }
  const device = isRecord(payload.device) ? payload.device : {};
  const environment = isRecord(payload.environment) ? payload.environment : {};
  const apps = payload.apps
    .filter(isRecord)
    .map(app => ({
      pkg: stringValue(app.package),
      score: numberValue(app.score),
      categoryKey: stringValue(app.categoryKey),
      vendor: nullableString(app.vendor),
      permissions: stringArray(app.permissions),
      endpoints: stringArray(app.endpoints),
      dataTypeKeys: stringArray(app.dataTypeKeys),
      trackers: stringArray(app.trackers),
    }))
    .filter(app => app.pkg.length > 0);
  return {
    model: stringValue(device.model) || '未知设备',
    serial: stringValue(device.serial),
    generatedAt: stringValue(environment.generatedAt),
    apps,
  };
}

/** diffReports 比较两份报告
 * @param base 基准报告
 * @param target 对比报告
 * @returns 每个包的差异和汇总计数
 */
export function diffReports(base: ReportDocument, target: ReportDocument): ReportDiff {
  const baseByPkg = new Map(base.apps.map(app => [app.pkg, app]));
  const targetByPkg = new Map(target.apps.map(app => [app.pkg, app]));
  const packages = [...new Set([...baseByPkg.keys(), ...targetByPkg.keys()])].sort();
  const rows = packages.map(pkg => diffApp(pkg, baseByPkg.get(pkg), targetByPkg.get(pkg)));
  const summary: Record<DiffStatus, number> = { added: 0, removed: 0, changed: 0, same: 0 };
  for (const row of rows) summary[row.status]++;
  rows.sort((left, right) => statusRank(left.status) - statusRank(right.status)
    || Math.abs(right.scoreDelta) - Math.abs(left.scoreDelta)
    || left.pkg.localeCompare(right.pkg));
  return { base, target, rows, summary };
}

/** diffApp 比较单个包 */
function diffApp(pkg: string, base: ReportApp | undefined, target: ReportApp | undefined): AppDiff {
  if (!base) {
    return { pkg, status: 'added', target, scoreDelta: target?.score ?? 0, permissionsAdded: target?.permissions ?? [], permissionsRemoved: [], endpointsAdded: target?.endpoints ?? [], endpointsRemoved: [] };
  }
  if (!target) {
    return { pkg, status: 'removed', base, scoreDelta: -(base.score), permissionsAdded: [], permissionsRemoved: base.permissions, endpointsAdded: [], endpointsRemoved: base.endpoints };
  }
  const permissionsAdded = difference(target.permissions, base.permissions);
  const permissionsRemoved = difference(base.permissions, target.permissions);
  const endpointsAdded = difference(target.endpoints, base.endpoints);
  const endpointsRemoved = difference(base.endpoints, target.endpoints);
  const changed = base.score !== target.score
    || base.categoryKey !== target.categoryKey
    || base.vendor !== target.vendor
    || permissionsAdded.length > 0
    || permissionsRemoved.length > 0
    || endpointsAdded.length > 0
    || endpointsRemoved.length > 0;
  return {
    pkg,
    status: changed ? 'changed' : 'same',
    base,
    target,
    scoreDelta: target.score - base.score,
    permissionsAdded,
    permissionsRemoved,
    endpointsAdded,
    endpointsRemoved,
  };
}

/** difference 返回在 left 中但不在 right 中的排序值 */
function difference(left: readonly string[], right: readonly string[]): string[] {
  const set = new Set(right);
  return [...new Set(left.filter(value => !set.has(value)))].sort();
}

/** statusRank 将差异分类映射为表格排序权重 */
function statusRank(status: DiffStatus): number {
  return status === 'changed' ? 0 : status === 'added' ? 1 : status === 'removed' ? 2 : 3;
}

/** isRecord 判断 JSON 对象 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** stringValue 读取字符串字段 */
function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** nullableString 读取可空字符串字段 */
function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

/** numberValue 读取数字字段 */
function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** stringArray 读取字符串数组 */
function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}