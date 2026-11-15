/**
 * 职责: 把 WebUSB, ADB 认证和浏览器异常转换为可执行的用户指引
 * 导出: ConnectionFailure, ConnectionErrorKind, describeConnectionError, describeDisconnectedFailure
 * 依赖: Tango DeviceBusyError / DOMException
 * 约束: 只生成展示文案, 不重试, 不隐藏原始错误
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.3
 */
import { AdbDaemonWebUsbDevice } from '@yume-chan/adb-daemon-webusb';
import { InsecureContextError, WebUsbUnsupportedError } from './connect';

/** ConnectionErrorKind 是连接失败的可执行分类, 与底层异常类型解耦 */
export type ConnectionErrorKind =
  | 'unsupported'
  | 'insecure'
  | 'busy'
  | 'cancelled'
  | 'permission'
  | 'no-device'
  | 'auth'
  | 'disconnected'
  | 'unknown';

/** ConnectionFailure 是错误页需要的标题, 说明, 操作步骤和可选命令 */
export interface ConnectionFailure {
  kind: ConnectionErrorKind;
  title: string;
  description: string;
  steps: string[];
  command?: string;
}

/** describeConnectionError 将任意连接异常映射为稳定的用户指引
 * @param error 连接或认证过程中抛出的异常
 * @returns 可直接渲染的失败说明
 */
export function describeConnectionError(error: unknown): ConnectionFailure {
  if (error instanceof WebUsbUnsupportedError) return unsupportedFailure();
  if (error instanceof InsecureContextError) return insecureFailure();
  if (isBusyError(error)) return busyFailure();
  if (isCancelledError(error)) return cancelledFailure();
  if (isPermissionError(error)) return permissionFailure();
  if (isAuthError(error)) return authFailure();
  if (isDisconnectedError(error)) return disconnectedFailure();
  if (isNoDeviceError(error)) return noDeviceFailure();
  return {
    kind: 'unknown',
    title: '连接没有完成',
    description: errorMessage(error),
    steps: ['重新插拔数据线', '关闭可能占用 USB 的设备管理程序', '打开浏览器控制台查看完整错误'],
  };
}

/** describeDisconnectedFailure 返回设备掉线时使用的固定提示 */
export function describeDisconnectedFailure(): ConnectionFailure {
  return disconnectedFailure();
}

function unsupportedFailure(): ConnectionFailure {
  return {
    kind: 'unsupported',
    title: '当前浏览器不支持 WebUSB',
    description: 'NOIR Web 需要 Chromium 内核桌面浏览器, 手机浏览器不能审计同一台手机',
    steps: ['改用 Chrome, Edge 或 Opera 桌面版', 'Firefox 和 Safari 没有 WebUSB', '使用支持数据传输的 USB 线连接手机'],
  };
}

function insecureFailure(): ConnectionFailure {
  return {
    kind: 'insecure',
    title: '当前页面不是安全上下文',
    description: 'WebUSB 只在 HTTPS 或 localhost 下可用',
    steps: ['通过 HTTPS 打开页面', '本地开发使用 http://localhost', '不要用 file:// 直接打开构建产物'],
  };
}

function busyFailure(): ConnectionFailure {
  return {
    kind: 'busy',
    title: 'ADB 接口被其他程序占用',
    description: '同一时间只能有一个程序访问手机的 ADB 接口',
    steps: ['关闭 Android Studio, scrcpy 或其他 WebADB 标签页', '在终端执行 adb kill-server', '重新插拔数据线后再选择设备'],
    command: 'adb kill-server',
  };
}

function cancelledFailure(): ConnectionFailure {
  return {
    kind: 'cancelled',
    title: '没有选择设备',
    description: '浏览器的设备选择器已关闭, 没有授权任何 USB 设备',
    steps: ['确认使用数据线而不是充电线', '在开发者选项里启用 USB 调试', '重新点击选择设备并在手机上允许授权'],
  };
}

function permissionFailure(): ConnectionFailure {
  return {
    kind: 'permission',
    title: '浏览器无法打开 USB 设备',
    description: '系统或浏览器拒绝了 USB 访问, 也可能是驱动没有绑定到 ADB 接口',
    steps: ['确认页面使用 HTTPS', '重新插拔设备并在系统弹窗中允许访问', 'Windows 检查 ADB 接口是否绑定 WinUSB', 'Linux 检查 udev 规则和当前用户权限'],
  };
}

function noDeviceFailure(): ConnectionFailure {
  return {
    kind: 'no-device',
    title: '没有检测到 Android 设备',
    description: '浏览器没有找到可用的 ADB 接口',
    steps: ['更换支持数据传输的 USB 线', '在开发者选项里启用 USB 调试', '下拉通知栏, 把 USB 用途改为传输文件', '重新插拔后再选择设备'],
  };
}

function authFailure(): ConnectionFailure {
  return {
    kind: 'auth',
    title: '手机没有完成 ADB 授权',
    description: '首次连接需要在手机上确认这台电脑的调试密钥',
    steps: ['解锁手机并查看 USB 调试授权弹窗', '勾选一律允许这台电脑后点击允许', '如果弹窗没有出现, 撤销 USB 调试授权后重新插拔'],
  };
}

function disconnectedFailure(): ConnectionFailure {
  return {
    kind: 'disconnected',
    title: '设备已断开',
    description: 'ADB transport 已关闭, 当前扫描结果不能继续读取',
    steps: ['检查数据线是否松动', '重新连接设备并完成授权', '扫描过程中保持页面在前台'],
  };
}

function isBusyError(error: unknown): boolean {
  if (error instanceof AdbDaemonWebUsbDevice.DeviceBusyError) return true;
  const message = errorMessage(error).toLowerCase();
  return message.includes('already in used') || message.includes('unable to claim interface') || message.includes('device busy');
}

function isCancelledError(error: unknown): boolean {
  if (error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'AbortError')) return true;
  const message = errorMessage(error).toLowerCase();
  return message.includes('no device selected') || message.includes('user cancelled') || message.includes('cancelled');
}

function isPermissionError(error: unknown): boolean {
  if (error instanceof DOMException && (error.name === 'SecurityError' || error.name === 'NotAllowedError')) return true;
  const message = errorMessage(error).toLowerCase();
  return message.includes('permission') || message.includes('access denied') || message.includes('not allowed');
}

function isAuthError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return message.includes('auth')
    || message.includes('unauthorized')
    || message.includes('public key')
    || message.includes('timed out')
    || message.includes('timeout');
}

function isDisconnectedError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return message.includes('disconnected') || message.includes('device offline') || message.includes('socket closed');
}

function isNoDeviceError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return message.includes('no device') || message.includes('not found') || message.includes('no adb interface');
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return '未知错误';
}