/**
 * 职责: 验证连接异常到用户指引的稳定映射
 * 导出: 测试用例
 * 依赖: Vitest / Tango DeviceBusyError
 * 约束: 不依赖真实 USB 或浏览器权限弹窗
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.0
 */
import { describe, expect, it } from 'vitest';
import { AdbDaemonWebUsbDevice } from '@yume-chan/adb-daemon-webusb';
import { InsecureContextError, WebUsbUnsupportedError } from './connect';
import { describeConnectionError } from './errors';

describe('describeConnectionError', () => {
  it('把占用 ADB 接口映射为 kill-server 指引', () => {
    const failure = describeConnectionError(new AdbDaemonWebUsbDevice.DeviceBusyError());
    expect(failure.kind).toBe('busy');
    expect(failure.command).toBe('adb kill-server');
    expect(failure.steps.join(' ')).toContain('scrcpy');
  });

  it('把浏览器取消选择映射为未选择设备', () => {
    expect(describeConnectionError(new DOMException('', 'NotFoundError')).kind).toBe('cancelled');
  });

  it('区分浏览器不支持和非安全上下文', () => {
    expect(describeConnectionError(new WebUsbUnsupportedError()).kind).toBe('unsupported');
    expect(describeConnectionError(new InsecureContextError()).kind).toBe('insecure');
  });

  it('识别常见的底层错误文本', () => {
    expect(describeConnectionError(new Error('Unable to claim interface')).kind).toBe('busy');
    expect(describeConnectionError(new Error('device offline')).kind).toBe('disconnected');
    expect(describeConnectionError(new Error('authentication failed')).kind).toBe('auth');
    expect(describeConnectionError(new Error('unknown failure')).kind).toBe('unknown');
    expect(describeConnectionError(new Error('OPFS 不可用')).kind).toBe('storage');
  });
});