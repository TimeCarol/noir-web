/**
 * 职责: 定义 ADB 连接、设备快照和包列表的数据边界
 * 导出: ConnectedDevice, DeviceInfo, PackageEntry
 * 依赖: @yume-chan/adb 类型
 * 约束: ConnectedDevice 持有 ADB transport, 只由 AdbProvider 释放
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.0
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
}

/** PackageEntry 是一个已安装包的包名和基础 APK 路径, 不包含 split APK */
export interface PackageEntry {
  packageName: string;
  apkPath: string;
}