/**
 * 职责: 按设备缓存每个 APK 的端点, Manifest 和文件时间戳
 * 导出: AppFactsRecord, loadAppFacts, saveAppFacts
 * 依赖: storage/opfs / apk/manifest
 * 约束: 缓存键包含 APK 路径, 大小和 mtime, 任一不匹配就重新扫描
 * 作者: timecarol
 * 日期: 2026-11-16 09:00
 * 版本: v1.0
 */
import type { ManifestFacts } from '../apk/manifest';
import { readJson, serialSegment, writeJson } from './opfs';

/** AppFactsRecord 是一个 APK 的缓存事实 */
export interface AppFactsRecord {
  packageName: string;
  apkPath: string;
  size: number;
  mtime: number;
  urls: string[];
  signals?: string[];
  manifest: ManifestFacts | null;
  savedAt: string;
}

/** StoredAppFacts 是 app-facts.json 的版本化结构 */
interface StoredAppFacts {
  version: 1;
  savedAt: string;
  records: AppFactsRecord[];
}

/** factsPath 返回设备缓存文件路径 */
function factsPath(serial: string): string[] {
  return ['devices', serialSegment(serial), 'app-facts.json'];
}

/** loadAppFacts 读取设备缓存
 * @param serial 设备序列号
 * @returns 包名到缓存事实的映射, 不可用时为空
 */
export async function loadAppFacts(serial: string): Promise<Map<string, AppFactsRecord>> {
  const stored = await readJson<StoredAppFacts>(factsPath(serial));
  if (!stored || stored.version !== 1 || !Array.isArray(stored.records)) return new Map();
  const records = new Map<string, AppFactsRecord>();
  for (const record of stored.records) {
    if (record?.packageName && record.apkPath && Number.isFinite(record.size) && Number.isFinite(record.mtime)) {
      records.set(record.packageName, record);
    }
  }
  return records;
}

/** saveAppFacts 保存设备缓存
 * @param serial 设备序列号
 * @param records 当前候选包的缓存事实
 */
export async function saveAppFacts(serial: string, records: readonly AppFactsRecord[]): Promise<boolean> {
  return writeJson(factsPath(serial), {
    version: 1,
    savedAt: new Date().toISOString(),
    records: [...records],
  } satisfies StoredAppFacts);
}