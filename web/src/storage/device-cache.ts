/**
 * 职责: 读取设备快照并同步写入 OPFS, 供页面查询直接复用
 * 导出: readAndStoreDeviceInfo, readAndStorePackages
 * 依赖: adb/device / adb/packages / storage/device-store
 * 约束: OPFS 写入失败不影响本次设备读取
 * 作者: timecarol
 * 日期: 2026-11-16 01:10
 * 版本: v1.0
 */
import type { Adb } from '@yume-chan/adb';
import { readDeviceInfo } from '../adb/device';
import { listPackages } from '../adb/packages';
import type { DeviceInfo, PackageEntry } from '../adb/types';
import { saveDeviceInfo, savePackages } from './device-store';

/** readAndStoreDeviceInfo 读取设备属性并写入 OPFS */
export async function readAndStoreDeviceInfo(adb: Adb, serial: string): Promise<DeviceInfo> {
  const info = await readDeviceInfo(adb);
  await saveDeviceInfo(serial, info).catch(() => false);
  return info;
}

/** readAndStorePackages 读取包列表并写入 OPFS */
export async function readAndStorePackages(adb: Adb, serial: string): Promise<PackageEntry[]> {
  const packages = await listPackages(adb);
  await savePackages(serial, packages).catch(() => false);
  return packages;
}
