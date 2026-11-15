/**
 * 职责: 在 OPFS 中按设备保存设备信息, 包清单和最近一次扫描结果
 * 导出: StoredRecord, saveDeviceInfo, loadDeviceInfo, savePackages, loadPackages, saveScan, loadScan
 * 依赖: storage/opfs / core/models / adb/types
 * 约束: 文件按设备序列号隔离, 写入失败不改变当前扫描结果
 * 作者: timecarol
 * 日期: 2026-11-16 01:10
 * 版本: v1.0
 */
import type { DeviceInfo, PackageEntry } from '../adb/types';
import type { ScanResult } from '../core/models';
import { readJson, serialSegment, writeJson } from './opfs';

/** StoredRecord 是带版本和保存时间的 OPFS JSON 记录 */
export interface StoredRecord<T> {
  version: 1;
  savedAt: string;
  data: T;
}

/** devicePath 构造设备目录和文件名 */
function devicePath(serial: string, file: string): string[] {
  return ['devices', serialSegment(serial), file];
}

/** wrap 生成可迁移的存储记录 */
function wrap<T>(data: T): StoredRecord<T> {
  return { version: 1, savedAt: new Date().toISOString(), data };
}

/** saveDeviceInfo 保存设备属性快照 */
export async function saveDeviceInfo(serial: string, info: DeviceInfo): Promise<boolean> {
  return writeJson(devicePath(serial, 'device.json'), wrap(info));
}

/** loadDeviceInfo 读取设备属性快照 */
export async function loadDeviceInfo(serial: string): Promise<DeviceInfo | null> {
  const record = await readJson<StoredRecord<DeviceInfo>>(devicePath(serial, 'device.json'));
  return record?.version === 1 ? record.data : null;
}

/** savePackages 保存基础包清单 */
export async function savePackages(serial: string, packages: readonly PackageEntry[]): Promise<boolean> {
  return writeJson(devicePath(serial, 'packages.json'), wrap(packages));
}

/** loadPackages 读取基础包清单 */
export async function loadPackages(serial: string): Promise<PackageEntry[] | null> {
  const record = await readJson<StoredRecord<PackageEntry[]>>(devicePath(serial, 'packages.json'));
  return record?.version === 1 ? record.data : null;
}

/** saveScan 保存完整扫描结果 */
export async function saveScan(serial: string, result: ScanResult): Promise<boolean> {
  return writeJson(devicePath(serial, 'scan.json'), wrap(result));
}

/** loadScan 读取最近一次扫描结果 */
export async function loadScan(serial: string): Promise<ScanResult | null> {
  const record = await readJson<StoredRecord<ScanResult>>(devicePath(serial, 'scan.json'));
  return record?.version === 1 ? record.data : null;
}
