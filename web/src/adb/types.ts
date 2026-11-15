/**
 * 职责: 定义 ADB 连接、设备快照和包列表的数据边界
 * 导出: ConnectedDevice, DeviceInfo, PackageEntry
 * 依赖: @yume-chan/adb 类型
 * 约束: ConnectedDevice 持有 ADB transport, 只由 AdbProvider 释放
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.1
 */
import type { Adb } from '@yume-chan/adb';

/** ConnectedDevice 表示一次已认证的 ADB 连接, adb 关闭后不可复用 */
export interface ConnectedDevice {
  /** adb 是 Tango 的高层客户端, 负责 shell 和后续 sync 操作 */
  adb: Adb;
  /** serial 来自 USB 设备描述, 用于查询缓存和界面标识 */
  serial: string;
  /** name 是设备产品名或型号, 可能为空 */
  name: string;
}

/** DeviceInfo 是只读设备快照, 空字符串表示属性读取失败或设备未提供 */
export interface DeviceInfo {
  manufacturer: string;
  model: string;
  androidVersion: string;
  sdk: string;
  build: string;
  fingerprint: string;
  abi: string;
  /** deviceName 是用户可读的设备名称, 来自 global device_name */
  deviceName?: string;
  /** device 是产品设备代号, 例如 sagit */
  device?: string;
  /** board 是主板代号 */
  board?: string;
  /** platform 是平台或 SoC 代号 */
  platform?: string;
  /** brand 是产品品牌 */
  brand?: string;
  /** googleAdId 是设备上的 Google 广告 ID, 不存在时为空 */
  googleAdId?: string;
  /** androidId 是 Android secure settings 中的设备 ID */
  androidId?: string;
  /** serialNumber 是硬件序列号, 可能与 USB 序列号不同 */
  serialNumber?: string;
  /** signalType 是当前蜂窝信号类型, 例如 LTE 或 NR */
  signalType?: string;
  /** carrier 是 SIM 或网络运营商名称 */
  carrier?: string;
  /** networkType 是当前网络类型, 例如 WLAN 或 移动网络 */
  networkType?: string;
  /** wifiMac 是 wlan0 当前 MAC 地址 */
  wifiMac?: string;
  /** bluetoothMac 是系统保存的蓝牙 MAC 地址 */
  bluetoothMac?: string;
  /** usbDebugging 表示 adb_enabled 是否为 1, null 表示读取不到 */
  usbDebugging?: boolean | null;
}

/** PackageEntry 是一个已安装包的包名和基础 APK 路径, 不包含 split APK */
export interface PackageEntry {
  packageName: string;
  apkPath: string;
}