/**
 * 职责: 建立 WebUSB 到 ADB daemon 的认证连接
 * 导出: hasWebUsb, isSecureContext, requestAdbDevice, authenticateAdbDevice, WebUsbUnsupportedError, InsecureContextError
 * 依赖: Tango / WebCrypto / IndexedDB
 * 约束: requestDevice 必须由用户手势触发, ADB key 只保存在浏览器 IndexedDB
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.4
 */
import { Adb, AdbDaemonTransport } from '@yume-chan/adb';
import type { AdbDaemonWebUsbDevice } from '@yume-chan/adb-daemon-webusb';
import { AdbDaemonWebUsbDeviceManager } from '@yume-chan/adb-daemon-webusb';
import AdbWebCredentialStore from '@yume-chan/adb-credential-web';
import { removeFile } from '../storage/opfs';
import type { ConnectedDevice } from './types';

/** WebUsbUnsupportedError 表示当前浏览器没有 navigator.usb, 不是设备故障 */
export class WebUsbUnsupportedError extends Error {
  constructor() {
    super('当前浏览器不支持 WebUSB');
    this.name = 'WebUsbUnsupportedError';
  }
}

/** InsecureContextError 表示页面不是安全上下文, WebUSB 和 WebCrypto 都不可用 */
export class InsecureContextError extends Error {
  constructor() {
    super('WebUSB 需要 HTTPS 或 localhost');
    this.name = 'InsecureContextError';
  }
}

/** hasWebUsb 检查浏览器是否暴露 WebUSB, 不触发设备选择 */
export function hasWebUsb(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.usb);
}

/** isSecureContext 检查当前页面是否允许 WebUSB, jsdom 未定义时按可用处理 */
export function isSecureContext(): boolean {
  return typeof window === 'undefined' || window.isSecureContext !== false;
}

/** requestAdbDevice 弹出浏览器设备选择器, 用户取消时返回 undefined
 * @returns 用户授权的 ADB USB 设备
 * @throws WebUsbUnsupportedError 或 InsecureContextError
 */
export async function requestAdbDevice(): Promise<AdbDaemonWebUsbDevice | undefined> {
  if (!isSecureContext()) throw new InsecureContextError();
  if (!hasWebUsb()) throw new WebUsbUnsupportedError();
  const manager = AdbDaemonWebUsbDeviceManager.BROWSER;
  if (!manager) throw new WebUsbUnsupportedError();
  return manager.requestDevice();
}

/** authenticateAdbDevice 完成 CNXN 和 RSA 认证, 首次连接会在手机上弹出授权
 * @param device 已由用户选择的 WebUSB 设备
 * @returns 可执行 shell 的 ADB 客户端
 * @throws DeviceBusyError 当其他程序占用 ADB 接口
 */
export async function authenticateAdbDevice(device: AdbDaemonWebUsbDevice): Promise<ConnectedDevice> {
  const connection = await device.connect();
  try {
    await cleanupLegacyOpfsKey();
    const credentialStore = new AdbWebCredentialStore('NOIR Web');
    const transport = await AdbDaemonTransport.authenticate({
      serial: device.serial || 'android',
      connection,
      credentialStore,
      // 手机长时间不响应授权弹窗时让 transport 报错, 避免页面永久停在等待状态
      readTimeLimit: 120_000,
    });
    return {
      adb: new Adb(transport),
      serial: device.serial || 'android',
      name: device.name || device.serial || 'Android 设备',
    };
  } catch (error) {
    // 认证失败时释放已 claim 的 USB 接口, 否则重新连接会一直报 DeviceBusyError
    await device.raw.close().catch(() => undefined);
    throw error;
  }
}

let legacyOpfsKeyChecked = false;

/** cleanupLegacyOpfsKey 删除旧版误存到 OPFS 的 ADB 私钥 */
async function cleanupLegacyOpfsKey(): Promise<void> {
  if (legacyOpfsKeyChecked) return;
  legacyOpfsKeyChecked = true;
  await removeFile(['adb', 'key.pk8']).catch(() => false);
}
