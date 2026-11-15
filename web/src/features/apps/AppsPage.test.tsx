/**
 * 职责: 验证应用列表的已连接, 空设备和搜索状态
 * 导出: 测试用例
 * 依赖: Testing Library / TanStack Query / MemoryRouter
 * 约束: 使用合成包列表, 不调用真实 ADB
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.1
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ConnectedDevice, PackageEntry } from '../../adb/types';

const adbState = vi.hoisted(() => ({ useAdb: vi.fn() }));
vi.mock('../../app/adb-context', () => ({ useAdb: adbState.useAdb }));

import AppsPage from './AppsPage';

const device: ConnectedDevice = { adb: {} as ConnectedDevice['adb'], serial: 'SERIAL-1', name: 'Pixel 8' };
const packages: PackageEntry[] = [
  { packageName: 'com.android.chrome', apkPath: '/data/app/chrome/base.apk' },
  { packageName: 'com.example.alpha', apkPath: '/data/app/alpha/base.apk' },
];

/** renderPage 预置查询缓存, 避免测试触发真实设备命令 */
function renderPage(data: PackageEntry[] = packages, connected: ConnectedDevice | null = device) {
  adbState.useAdb.mockReturnValue({
    device: connected,
    phase: connected ? 'ready' : 'idle',
    failure: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    clearFailure: vi.fn(),
  });
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  if (connected) client.setQueryData(['packages', connected.serial], data);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/apps']}>
        <AppsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AppsPage', () => {
  it('未连接时引导用户去连接设备', () => {
    renderPage([], null);
    expect(screen.getByText('未连接设备')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '连接设备' })).toBeInTheDocument();
  });

  it('已连接时显示包名和基础 APK 路径', async () => {
    renderPage();
    expect(await screen.findByText('com.android.chrome')).toBeInTheDocument();
    expect(screen.getByText('/data/app/alpha/base.apk')).toBeInTheDocument();
  });

  it('搜索同时匹配包名和路径', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('com.android.chrome');
    await user.type(screen.getByRole('textbox', { name: '搜索包名或 APK 路径' }), 'alpha');
    expect(screen.getByText('com.example.alpha')).toBeInTheDocument();
    expect(screen.queryByText('com.android.chrome')).not.toBeInTheDocument();
  });
});