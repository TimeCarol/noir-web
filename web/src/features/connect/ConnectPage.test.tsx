/**
 * 职责: 验证连接页的兼容性提示, 失败指引和设备摘要
 * 导出: 测试用例
 * 依赖: Testing Library / TanStack Query / MemoryRouter
 * 约束: 使用合成设备和失败对象, 不触发真实 WebUSB
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.1
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
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
};

/** renderPage 预置查询缓存并注入连接状态 */
function renderPage(options: { connected?: boolean; failure?: ConnectionFailure | null } = {}) {
  const connected = options.connected ?? false;
  adbState.useAdb.mockReturnValue({
    device: connected ? device : null,
    phase: options.failure ? 'error' : connected ? 'ready' : 'idle',
    failure: options.failure ?? null,
    connect: vi.fn(),
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
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ConnectPage', () => {
  it('不支持 WebUSB 时显示浏览器要求并禁用连接', () => {
    renderPage();
    expect(screen.getByText('当前浏览器不支持 WebUSB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /选择设备/ })).toBeDisabled();
  });

  it('已连接时显示设备属性和应用数量', () => {
    renderPage({ connected: true });
    expect(screen.getByText('SERIAL-1')).toBeInTheDocument();
    expect(screen.getByText('14 (SDK 34)')).toBeInTheDocument();
    expect(screen.getByText('2 个')).toBeInTheDocument();
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