/**
 * 职责: 编排 dumpsys, 候选筛选, APK 端点分析和评分报告
 * 导出: ScanError, ScanProgress, ScanOptions, ScanInput, scanPackages
 * 依赖: adb/dumpsys / adb/device-scan / core/*
 * 约束: 候选必须同时具备 INTERNET 和至少一个已授予敏感权限
 * 作者: timecarol
 * 日期: 2026-11-15 23:50
 * 版本: v1.1
 */
import type { DeviceInfo, PackageEntry } from '../adb/types';
import type { Shell } from '../adb/shell';
import { DumpsysParser, isDebuggableMeta, isSystemMeta, type PkgMeta } from '../adb/dumpsys';
import { scanDeviceUrls } from '../adb/device-scan';
import { advise } from './advisor';
import { classifyCategory, classifyVendor } from './classifier';
import { dataTypes, leaks } from './exposure';
import type { AppEntry, ReportMeta, ScanResult } from './models';
import { score, sensitivePermissions } from './rules';

/** ScanError 表示扫描前置条件失败, 错误信息可直接展示给用户 */
export class ScanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScanError';
  }
}

/** ScanProgress 是阶段和逐包进度 */
export interface ScanProgress {
  phase: 'dumpsys' | 'filter' | 'scan' | 'report' | 'done';
  done: number;
  total: number;
  packageName?: string;
}

/** ScanOptions 控制报告过滤, 进度和取消 */
export interface ScanOptions {
  minScore?: number;
  limit?: number;
  only?: RegExp;
  onProgress?: (progress: ScanProgress) => void;
  signal?: AbortSignal;
}

/** ScanInput 是已连接设备和已读取的包清单 */
export interface ScanInput {
  shell: Shell;
  serial: string;
  model: string;
  product: string;
  info: DeviceInfo;
  packages: readonly PackageEntry[];
  host?: string;
  user?: string;
  tool?: string;
}

const DEFAULT_LIMIT = 500;

/** scanPackages 执行一次完整审计
 * @param input 设备 shell, 属性和包清单
 * @param options 过滤, 进度和取消
 * @returns NOIR 兼容的扫描结果
 */
export async function scanPackages(input: ScanInput, options: ScanOptions = {}): Promise<ScanResult> {
  const startedAt = Date.now();
  const minScore = options.minScore ?? 0;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const progress = (phase: ScanProgress['phase'], done = 0, total = 0, packageName?: string) => {
    options.onProgress?.({ phase, done, total, packageName });
  };

  progress('dumpsys');
  const parser = new DumpsysParser();
  try {
    await input.shell.stream('dumpsys package', line => parser.push(line), options.signal);
  } catch (error) {
    throw new ScanError(`读取 dumpsys package 失败: ${error instanceof Error ? error.message : String(error)}`);
  }
  const meta = parser.finish();
  if (meta.size === 0 && input.packages.length > 0) {
    throw new ScanError('dumpsys package 输出无法解析, 设备系统可能修改了格式');
  }

  progress('filter');
  const available = new Map(input.packages.map(item => [item.packageName, item]));
  const candidates: Array<[string, PkgMeta, PackageEntry]> = [];
  for (const [pkg, facts] of meta) {
    const entry = available.get(pkg);
    if (!entry) continue;
    if (options.only && !options.only.test(pkg)) continue;
    const sensitive = sensitivePermissions([...facts.permissions]);
    if (facts.permissions.has('INTERNET') && sensitive.length > 0) {
      candidates.push([pkg, facts, entry]);
    }
  }

  const targets = candidates.map(([, , entry]) => entry);
  progress('scan', 0, targets.length);
  const scan = await scanDeviceUrls(input.shell, targets, {
    signal: options.signal,
    onProgress: (done, total, packageName) => progress('scan', done, total, packageName),
  });

  progress('report', targets.length, targets.length);
  const apps: AppEntry[] = candidates.map(([pkg, facts, entry]) => {
    const permissions = sensitivePermissions([...facts.permissions]);
    const endpoints = scan.urls.get(pkg) ?? [];
    const isSystem = isSystemMeta(facts);
    const debuggable = isDebuggableMeta(facts);
    const app: AppEntry = {
      pkg,
      uid: facts.appId,
      isSystem,
      debuggable,
      installer: facts.installer,
      permissions,
      endpoints,
      score: score(permissions, endpoints, isSystem, debuggable),
      category: classifyCategory(pkg, endpoints, permissions, isSystem),
      vendor: classifyVendor(pkg, endpoints),
      sharedUid: facts.sharedUser,
      dataTypes: dataTypes(permissions),
      leaks: {},
      manifest: scan.manifests.get(pkg) ?? null,
      apkPaths: [entry.apkPath],
    };
    app.leaks = leaks(app);
    return app;
  })
    .filter(app => app.score >= minScore)
    .sort((left, right) => right.score - left.score || left.pkg.localeCompare(right.pkg))
    .slice(0, limit);

  const finishedAt = Date.now();
  const reportMeta: ReportMeta = {
    tool: input.tool ?? 'NOIR Web 0.1.0',
    host: input.host ?? (typeof navigator === 'undefined' ? 'browser' : navigator.userAgent),
    android: input.info.androidVersion,
    sdk: input.info.sdk,
    build: input.info.build,
    fingerprint: input.info.fingerprint,
    user: input.user ?? '0',
    generatedAt: new Date(finishedAt).toISOString(),
    minScore,
    limit,
  };

  const result: ScanResult = {
    serial: input.serial,
    model: input.model || input.product || input.serial,
    product: input.product,
    android: input.info.androidVersion,
    meta: reportMeta,
    apps,
    recommendations: advise(apps),
    packageCount: input.packages.length,
    failed: [...scan.failed].sort(),
    startedAt,
    finishedAt,
  };
  progress('done', apps.length, apps.length);
  return result;
}