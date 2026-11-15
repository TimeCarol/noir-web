/**
 * 职责: 验证物理 USB 断开事件会清理连接状态和设备卡片
 * 导出: 测试用例
 * 依赖: Testing Library / TanStack Query / 合成 WebUSB
 * 约束: 不打开真实 USB 设备, 只派发 disconnect 事件
 * 作者: timecarol
 * 日期: 2026-11-16 07:55
 * 版本: v1.0
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Adb } from '@yume-chan/adb';
import type { ConnectedDevice } from '../adb/types';
import { AdbProvider, useAdb } from './adb-context';

const connectState = vi.hoisted(() => ({
  requestAdbDevice: vi.fn(),
  authenticateAdbDevice: vi.fn(),
}));
vi.mock('../adb/connect', () => ({
  requestAdbDevice: connectState.requestAdbDevice,
  authenticateAdbDevice: connectState.authenticateAdbDevice,
}));

/** Probe 暴露连接状态和 connect 操作 */
function Probe() {
  const { device, failure, connect } = useAdb();
  return (
    <>
      <span data-testid="status">{device ? 'connected' : 'disconnected'}</span>
      <span data-testid="failure">{failure?.kind ?? ''}</span>
      <button onClick={() => void connect()}>connect</button>
    </>
  );
}

let usb: EventTarget;

beforeEach(() => {
  usb = new EventTarget();
  Object.defineProperty(navigator, 'usb', { configurable: true, value: usb });
  connectState.requestAdbDevice.mockResolvedValue({});
  connectState.authenticateAdbDevice.mockResolvedValue({
    adb: { disconnected: new Promise(() => undefined), close: vi.fn(async () => undefined) } as unknown as Adb,
    serial: 'SERIAL-1',
    name: 'Pixel Test',
    usbDevice: { serialNumber: 'SERIAL-1' } as USBDevice,
  } satisfies ConnectedDevice);
});

afterEach(() => {
  Object.defineProperty(navigator, 'usb', { configurable: true, value: undefined });
});

describe('AdbProvider USB disconnect', () => {
  it('拔掉 USB 后清除设备和失败状态', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AdbProvider><Probe /></AdbProvider>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'connect' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('connected'));

    await new Promise(resolve => window.setTimeout(resolve, 0));
    const device = { serialNumber: 'SERIAL-1' } as USBDevice;
    const event = new Event('disconnect') as Event & { device: USBDevice };
    Object.defineProperty(event, 'device', { value: device });
    usb.dispatchEvent(event);

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('disconnected'));
    expect(screen.getByTestId('failure')).toHaveTextContent('disconnected');
  });
});
