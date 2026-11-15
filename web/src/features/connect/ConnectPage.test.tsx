/**
 * 职责: 验证连接页的兼容性提示, 失败指引和设备摘要
 * 导出: 测试用例
 * 依赖: Testing Library / TanStack Query / MemoryRouter
 * 约束: 使用合成设备和失败对象, 不触发真实 WebUSB
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.4
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ConnectedDevice, DeviceInfo } from '../../adb/types';
import type { ConnectionFailure } from '../../adb/errors';

const adbState = vi.hoisted(() => ({ useAdb: vi.fn() }));
vi.mock('../../app/adb-context', () => ({ useAdb: adbState.useAdb }));

import ConnectPage from './ConnectPage';

const device: ConnectedDevice = { adb: {} as ConnectedDevice['adb'], serial: 'SERIAL-1', name: 'Pixel 8' };
const info: DeviceInfo = {
  manufacturer: 'Google',
  model: 'Pixel 8',
  androidVersion: '14',
  sdk: '34',
  build: 'AP1A.240505.004',
  fingerprint: 'google/shiba/shiba:14/AP1A.240505.004/1234567:user/release-keys',
  abi: 'arm64-v8a',
  deviceName: 'My Pixel',
  device: 'shiba',
  board: 'shiba',
  platform: 'tensor',
  brand: 'google',
  googleAdId: '',
  androidId: 'android-id-1',
  serialNumber: 'SERIAL-1',
  signalType: 'LTE',
  carrier: 'TEST CARRIER',
  networkType: 'WLAN',
  wifiMac: '8e:95:83:7b:de:9d',
  bluetoothMac: '4C:49:E3:D1:3D:92',
  usbDebugging: true,
  buildTime: 'Thu Mar 13 13:54:20 UTC 2025',
  deviceVersion: 'OS2.0.2.0.ULJCNXM',
  securityPatch: '2025-03-01',
  baseband: 'AT20-0718',
  language: 'zh-CN',
  timezone: 'Asia/Shanghai',
  rooted: false,
  uptime: '1 天 2 小时 3 分',
  partitionLayout: 'A/B',
  seamlessUpdates: true,
  dynamicPartitions: true,
  treble: true,
  javaRuntime: 'ART 14',
  javaVm: 'ART',
  javaHeap: '512 MB',
  kernelArch: 'aarch64',
  kernelVersion: '5.10.1',
  openGlEs: '3.2',
  selinux: 'Enforcing',
  openssl: 'OpenSSL 3.0.0',
};

/** renderPage 预置查询缓存并注入连接状态 */
function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

function renderPage(options: { connected?: boolean; failure?: ConnectionFailure | null; connectResult?: boolean } = {}) {
  const connected = options.connected ?? false;
  adbState.useAdb.mockReturnValue({
    device: connected ? device : null,
    phase: options.failure ? 'error' : connected ? 'ready' : 'idle',
    failure: options.failure ?? null,
    connect: vi.fn().mockResolvedValue(options.connectResult ?? false),
    disconnect: vi.fn(),
    clearFailure: vi.fn(),
  });
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  if (connected) {
    client.setQueryData(['device-info', device.serial], info);
    client.setQueryData(['packages', device.serial], [
      { packageName: 'com.android.chrome', apkPath: '/data/app/chrome/base.apk' },
      { packageName: 'com.example.alpha', apkPath: '/data/app/alpha/base.apk' },
    ]);
  }
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/connect']}>
        <ConnectPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ConnectPage', () => {
  it('不支持 WebUSB 时显示浏览器要求并禁用连接', () => {
    renderPage();
    expect(screen.getByText('当前浏览器不支持 WebUSB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /选择设备/ })).toBeDisabled();
    expect(screen.queryByRole('heading', { name: '设备' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '系统' })).not.toBeInTheDocument();
  });

  it('已连接时显示设备字段并隐藏空值', () => {
    renderPage({ connected: true });
    expect(screen.getByText('设备名称')).toBeInTheDocument();
    expect(screen.getByText('My Pixel')).toBeInTheDocument();
    expect(screen.getByText('硬件序列号')).toBeInTheDocument();
    expect(screen.getByText('SERIAL-1')).toBeInTheDocument();
    expect(screen.getByText('设备信号类型')).toBeInTheDocument();
    expect(screen.getByText('LTE')).toBeInTheDocument();
    expect(screen.getByText('USB调试')).toBeInTheDocument();
    expect(screen.getByText('已开启')).toBeInTheDocument();
    expect(screen.getByText(info.fingerprint)).toBeInTheDocument();
    expect(screen.queryByText('谷歌广告ID')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '系统' })).toBeInTheDocument();
    expect(screen.getByText('安全补丁级别')).toBeInTheDocument();
    expect(screen.getByText('Project Treble')).toBeInTheDocument();
    expect(screen.getByText('未 Root')).toBeInTheDocument();
    expect(screen.getByText('OpenSSL 3.0.0')).toBeInTheDocument();
  });

  it('连接成功后停留在连接页', async () => {
    Object.defineProperty(navigator, 'usb', { configurable: true, value: {} });
    try {
      const user = userEvent.setup();
      renderPage({ connectResult: true });
      await user.click(screen.getByRole('button', { name: /选择设备/ }));
      expect(screen.getByTestId('location')).toHaveTextContent('/connect');
    } finally {
      Object.defineProperty(navigator, 'usb', { configurable: true, value: undefined });
    }
  });

  it('连接失败时显示可执行步骤和命令', () => {
    renderPage({
      failure: {
        kind: 'busy',
        title: 'ADB 接口被其他程序占用',
        description: '同一时间只能有一个程序访问手机的 ADB 接口',
        steps: ['关闭 Android Studio, scrcpy 或其他 WebADB 标签页'],
        command: 'adb kill-server',
      },
    });
    expect(screen.getByText('ADB 接口被其他程序占用')).toBeInTheDocument();
    expect(screen.getAllByText('adb kill-server').length).toBeGreaterThan(0);
  });
});