/**
 * 职责: 验证没有 WebUSB 时不会弹出设备选择器
 * 导出: 测试用例
 * 依赖: Vitest / jsdom
 * 约束: 不伪造 USB 设备, 只验证浏览器能力边界
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.0
 */
import { describe, expect, it } from 'vitest';
import { requestAdbDevice, WebUsbUnsupportedError } from './connect';

describe('requestAdbDevice', () => {
  it('没有 navigator.usb 时拒绝连接', async () => {
    await expect(requestAdbDevice()).rejects.toBeInstanceOf(WebUsbUnsupportedError);
  });
});