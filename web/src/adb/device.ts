/**
 * 职责: 通过 ADB shell 读取稳定的设备属性快照
 * 导出: readDeviceInfo
 * 依赖: getprop
 * 约束: 单个属性读取失败返回空串, 由界面显示未知, 不中断整个连接
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.0
 */
import type { Adb } from '@yume-chan/adb';
import type { DeviceInfo } from './types';

/** readDeviceInfo 并行读取型号, Android 版本, SDK, 构建和 ABI
 * @param adb 已完成认证的 ADB 客户端
 * @returns 只读设备属性, 缺失字段为空字符串
 */
export async function readDeviceInfo(adb: Adb): Promise<DeviceInfo> {
  const [manufacturer, model, androidVersion, sdk, displayId, buildId, fingerprint, abi] = await Promise.all([
    readProp(adb, 'ro.product.manufacturer'),
    readProp(adb, 'ro.product.model'),
    readProp(adb, 'ro.build.version.release'),
    readProp(adb, 'ro.build.version.sdk'),
    readProp(adb, 'ro.build.display.id'),
    readProp(adb, 'ro.build.id'),
    readProp(adb, 'ro.build.fingerprint'),
    readProp(adb, 'ro.product.cpu.abi'),
  ]);
  return {
    manufacturer,
    model,
    androidVersion,
    sdk,
    build: displayId || buildId,
    fingerprint,
    abi,
  };
}

/** readProp 读取单个 Android 系统属性, 失败时返回空串
 * @param adb 已认证的 ADB 客户端
 * @param key 系统属性名, 例如 ro.product.model
 * @returns 去掉首尾空白的属性值
 */
async function readProp(adb: Adb, key: string): Promise<string> {
  try {
    const output = await adb.subprocess.noneProtocol.spawnWaitText(['getprop', key]);
    return output.trim();
  } catch {
    return '';
  }
}