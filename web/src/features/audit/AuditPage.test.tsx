/**
 * 职责: 验证审计页的未连接状态, 扫描触发和结果展示
 * 导出: 测试用例
 * 依赖: Testing Library / TanStack Query / 合成扫描结果
 * 约束: 不调用真实 ADB, 不触发真实下载
 * 作者: timecarol
 * 日期: 2026-11-16 00:05
 * 版本: v1.0
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ConnectedDevice, DeviceInfo, PackageEntry } from '../../adb/types';
import type { ScanResult } from '../../core/models';
import { DeviceDisconnectedError } from '../../adb/shell';

const adbState = vi.hoisted(() => ({ useAdb: vi.fn(), disconnect: vi.fn() }));
const scanState = vi.hoisted(() => ({ scanPackages: vi.fn() }));
const storeState = vi.hoisted(() => ({ loadScan: vi.fn(), saveScan: vi.fn() }));
vi.mock('../../app/adb-context', () => ({ useAdb: adbState.useAdb }));
vi.mock('../../core/scan', () => ({ scanPackages: scanState.scanPackages }));
vi.mock('../../storage/device-store', () => ({ loadScan: storeState.loadScan, saveScan: storeState.saveScan }));

import AuditPage from './AuditPage';

const device: ConnectedDevice = { adb: {} as ConnectedDevice['adb'], serial: 'SERIAL-1', name: 'Pixel 8' };
const info: DeviceInfo = {
  manufacturer: 'Google',
  model: 'Pixel 8',
  androidVersion: '14',
  sdk: '34',
  build: 'AP1A',
  fingerprint: 'google/pixel/fingerprint',
  abi: 'arm64-v8a',
};
const packages: PackageEntry[] = [
  { packageName: 'com.example.alpha', apkPath: '/data/app/alpha/base.apk' },
  { packageName: 'com.example.beta', apkPath: '/data/app/beta/base.apk' },
];
const result: ScanResult = {
  serial: 'SERIAL-1',
  model: 'Pixel 8',
  product: 'Google',
  android: '14',
  meta: {
    tool: 'NOIR Web test',
    host: 'vitest',
    android: '14',
    sdk: '34',
    build: 'AP1A',
    fingerprint: 'google/pixel/fingerprint',
    user: '0',
    generatedAt: '2026-11-16T00:00:00.000Z',
    minScore: 0,
    limit: 500,
  },
  apps: [{
    pkg: 'com.example.alpha',
    uid: '10200',
    isSystem: false,
    debuggable: false,
    installer: 'com.android.vending',
    permissions: ['READ_SMS'],
    endpoints: ['https://collect.example.com/report'],
    score: 4,
    category: 'TELEMETRY',
    vendor: 'Example',
    sharedUid: null,
    dataTypes: ['SMS'],
    leaks: { SMS: ['collect.example.com'] },
    manifest: null,
    apkPaths: ['/data/app/alpha/base.apk'],
  }],
  recommendations: [{ pkg: 'com.example.alpha', action: 'BLOCK_DNS', risk: 'LOW', reason: '多个上报端点', autoSafe: false }],
  packageCount: 2,
  failed: [],
  startedAt: 1,
  finishedAt: 2,
};

/** renderPage 预置设备信息和包查询缓存 */
function renderPage(connected: ConnectedDevice | null = device) {
  adbState.useAdb.mockReturnValue({
    device: connected,
    phase: connected ? 'ready' : 'idle',
    failure: null,
    connect: vi.fn(),
    disconnect: adbState.disconnect,
    clearFailure: vi.fn(),
  });
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  if (connected) {
    client.setQueryData(['device-info', connected.serial], info);
    client.setQueryData(['packages', connected.serial], packages);
  }
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/audit']}>
        <AuditPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AuditPage', () => {
  beforeEach(() => {
    adbState.disconnect.mockReset();
    storeState.loadScan.mockReset();
    storeState.loadScan.mockResolvedValue(null);
    storeState.saveScan.mockReset();
    storeState.saveScan.mockResolvedValue(true);
  });

  it('未连接时引导用户去连接设备', () => {
    renderPage(null);
    expect(screen.getByText('未连接设备')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '连接设备' })).toBeInTheDocument();
  });

  it('扫描中 USB 断开时停止并引导重新连接', async () => {
    scanState.scanPackages.mockRejectedValue(new DeviceDisconnectedError());
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /开始扫描/ }));
    expect(await screen.findByText('USB 连接已中断')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重新连接' })).toBeInTheDocument();
    expect(adbState.disconnect).toHaveBeenCalled();
  });

  it('连接后恢复 OPFS 中的最近扫描', async () => {
    storeState.loadScan.mockResolvedValue(result);
    renderPage();
    expect(await screen.findByText('本地')).toBeInTheDocument();
    expect(screen.getAllByText('com.example.alpha').length).toBeGreaterThan(0);
  });

  it('点击开始扫描后展示摘要, 应用和建议', async () => {
    scanState.scanPackages.mockImplementation(async (_input, options: { onProgress?: (value: unknown) => void }) => {
      options.onProgress?.({ phase: 'done', done: 1, total: 1 });
      return result;
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /开始扫描/ }));
    await waitFor(() => expect(screen.getAllByText('com.example.alpha').length).toBeGreaterThan(0));
    expect(screen.getByText('扫描包数')).toBeInTheDocument();
    expect(screen.getByText('命中应用')).toBeInTheDocument();
    expect(screen.getByText('多个上报端点')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /JSON/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /HTML/ })).toBeInTheDocument();
    expect(scanState.scanPackages).toHaveBeenCalledWith(
      expect.objectContaining({ serial: 'SERIAL-1', packages }),
      expect.objectContaining({ minScore: 0, limit: 500 }),
    );
  });
});