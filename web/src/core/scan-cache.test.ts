/**
 * 职责: 验证 APK 事实缓存命中时跳过设备端扫描
 * 导出: 测试用例
 * 依赖: Vitest / 合成 shell / OPFS mock
 * 约束: 不使用真实设备或浏览器存储
 * 作者: timecarol
 * 日期: 2026-11-16 09:15
 * 版本: v1.0
 */
import { describe, expect, it, vi } from 'vitest';
import type { Shell } from '../adb/shell';
import type { DeviceInfo, PackageEntry } from '../adb/types';

const cache = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
}));
vi.mock('../storage/app-facts', () => ({
  loadAppFacts: cache.load,
  saveAppFacts: cache.save,
}));

import { scanPackages } from './scan';

const packages: PackageEntry[] = [{ packageName: 'com.example.alpha', apkPath: '/data/app/base.apk' }];
const info: DeviceInfo = {
  manufacturer: 'Example', model: 'Test', androidVersion: '14', sdk: '34',
  build: 'BUILD', fingerprint: 'fingerprint', abi: 'arm64-v8a',
};
const dump = [
  'Package [com.example.alpha] (a):',
  '  appId=10200',
  '  flags=[ HAS_CODE ]',
  '  android.permission.INTERNET: granted=true',
  '  android.permission.READ_SMS: granted=true',
].join('\n');

describe('scanPackages app facts cache', () => {
  it('命中缓存时不调用设备端 APK 扫描', async () => {
    cache.load.mockResolvedValue(new Map([['com.example.alpha', {
      packageName: 'com.example.alpha', apkPath: '/data/app/base.apk', size: 123, mtime: 456,
      urls: ['https://cached.example.com/report'], manifest: null, savedAt: '2026-11-16T00:00:00.000Z',
    }]]));
    cache.save.mockResolvedValue(true);
    const stream = vi.fn(async (command: string, onLine: (line: string) => void) => {
      if (command !== 'dumpsys package') throw new Error('APK scan should not run');
      for (const line of dump.split('\n')) onLine(line);
    });
    const shell: Shell = {
      async exec() { return new Uint8Array(); },
      async text(command: string) {
        if (command.startsWith('stat -c')) return '123 456\n';
        if (command.startsWith('which ')) return '/system/bin/unzip\n/system/bin/strings\n';
        throw new Error(`unexpected command: ${command}`);
      },
      stream,
    };

    const result = await scanPackages({ shell, serial: 'SERIAL-1', model: 'Test', product: 'test', info, packages });
    expect(result.apps).toHaveLength(1);
    expect(result.apps[0].endpoints).toEqual(['https://cached.example.com/report']);
    expect(stream).toHaveBeenCalledOnce();
    expect(cache.save).toHaveBeenCalledWith('SERIAL-1', [expect.objectContaining({ packageName: 'com.example.alpha', size: 123, mtime: 456 })]);
  });
});
