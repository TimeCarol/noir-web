/**
 * 职责: 通过 ADB shell 读取稳定的设备属性和网络标识快照
 * 导出: readDeviceInfo
 * 依赖: getprop / settings / cmd wifi / ip
 * 约束: 单项读取失败返回空串或 undefined, 不中断整个连接
 * 作者: timecarol
 * 日期: 2026-11-16 01:45
 * 版本: v1.1
 */
import type { Adb } from '@yume-chan/adb';
import type { DeviceInfo } from './types';

/** readDeviceInfo 并行读取系统属性, secure settings 和网络状态
 * @param adb 已完成认证的 ADB 客户端
 * @returns 只读设备属性, 缺失字段为空字符串或 undefined
 */
export async function readDeviceInfo(adb: Adb): Promise<DeviceInfo> {
  const [properties, deviceName, androidId, advertisingId, bluetoothMac, adbEnabled, mobileData, wifiStatus, networkAddresses] = await Promise.all([
    readProperties(adb),
    readSetting(adb, 'global', 'device_name'),
    readSetting(adb, 'secure', 'android_id'),
    readSetting(adb, 'secure', 'advertising_id'),
    readSetting(adb, 'secure', 'bluetooth_address'),
    readSetting(adb, 'global', 'adb_enabled'),
    readSetting(adb, 'global', 'mobile_data'),
    readShell(adb, ['cmd', 'wifi', 'status']),
    readShell(adb, ['ip', 'addr', 'show', 'wlan0']),
  ]);
  const prop = (key: string) => clean(properties.get(key));

  return {
    manufacturer: prop('ro.product.manufacturer'),
    model: prop('ro.product.model'),
    androidVersion: prop('ro.build.version.release'),
    sdk: prop('ro.build.version.sdk'),
    build: prop('ro.build.display.id') || prop('ro.build.id'),
    fingerprint: prop('ro.build.fingerprint'),
    abi: prop('ro.product.cpu.abi'),
    deviceName: clean(deviceName) || prop('ro.product.marketname'),
    device: prop('ro.product.device'),
    board: prop('ro.product.board'),
    platform: prop('ro.board.platform') || prop('ro.product.board'),
    brand: prop('ro.product.brand'),
    googleAdId: clean(advertisingId),
    androidId: clean(androidId),
    serialNumber: prop('ro.serialno') || prop('ro.boot.serialno'),
    signalType: uniqueParts(prop('gsm.network.type'), ['unknown']),
    carrier: uniqueParts(`${prop('gsm.sim.operator.alpha')},${prop('gsm.operator.alpha')}`, ['unknown']),
    networkType: networkTypes(wifiStatus, mobileData),
    wifiMac: wifiMac(networkAddresses),
    bluetoothMac: clean(bluetoothMac),
    usbDebugging: adbEnabled === '1' ? true : adbEnabled === '0' ? false : undefined,
  };
}

/** readProperties 一次读取全部系统属性并解析 getprop 的方括号格式 */
async function readProperties(adb: Adb): Promise<Map<string, string>> {
  try {
    const output = await adb.subprocess.noneProtocol.spawnWaitText(['getprop']);
    const properties = new Map<string, string>();
    for (const line of output.split('\n')) {
      const match = /^\[([^\]]+)]: \[(.*)]\s*$/.exec(line);
      if (match) properties.set(match[1], match[2].trim());
    }
    return properties;
  } catch {
    return new Map();
  }
}

/** readSetting 读取一个 settings 键, null 统一为空串 */
async function readSetting(adb: Adb, namespace: string, key: string): Promise<string> {
  return clean(await readShell(adb, ['settings', 'get', namespace, key]));
}

/** readShell 执行只读 shell 命令, 失败时返回空串 */
async function readShell(adb: Adb, command: string[]): Promise<string> {
  try {
    return await adb.subprocess.noneProtocol.spawnWaitText(command);
  } catch {
    return '';
  }
}

/** clean 去掉首尾空白并把 settings 的 null 当作不存在 */
function clean(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  return trimmed.toLowerCase() === 'null' ? '' : trimmed;
}

/** uniqueParts 拆分逗号分隔的多 SIM 值, 去重并过滤 unknown */
function uniqueParts(value: string, ignored: readonly string[] = []): string {
  const ignoredSet = new Set(ignored.map(item => item.toLowerCase()));
  return [...new Set(value
    .split(',')
    .map(part => part.trim())
    .filter(part => part && !ignoredSet.has(part.toLowerCase())))].join(', ');
}

/** networkTypes 根据 Wi-Fi 连接状态和移动数据开关生成网络类型 */
function networkTypes(wifiStatus: string, mobileData: string): string {
  const types: string[] = [];
  if (/Wifi is connected|WifiInfo: SSID/i.test(wifiStatus)) types.push('WLAN');
  if (clean(mobileData) === '1') types.push('移动网络');
  return types.join(', ');
}

/** wifiMac 从 ip addr 输出读取 wlan0 的 link/ether 地址 */
function wifiMac(output: string): string {
  return /link\/ether\s+([0-9a-f]{2}(?::[0-9a-f]{2}){5})/i.exec(output)?.[1] ?? '';
}
