/**
 * 职责: 验证 APK 事实缓存的读写和键隔离
 * 导出: 测试用例
 * 依赖: Vitest / OPFS mock
 * 约束: 不访问真实浏览器存储
 * 作者: timecarol
 * 日期: 2026-11-16 09:10
 * 版本: v1.0
 */
import { describe, expect, it, vi } from 'vitest';

const opfs = vi.hoisted(() => ({
  readJson: vi.fn(),
  writeJson: vi.fn(),
  serialSegment: vi.fn((value: string) => value),
}));
vi.mock('./opfs', () => ({
  readJson: opfs.readJson,
  writeJson: opfs.writeJson,
  serialSegment: opfs.serialSegment,
}));

import { loadAppFacts, saveAppFacts } from './app-facts';

describe('app facts cache', () => {
  it('读取设备缓存时跳过无效记录', async () => {
    opfs.readJson.mockResolvedValue({
      version: 1,
      savedAt: '2026-11-16T00:00:00.000Z',
      records: [
        { packageName: 'com.example.alpha', apkPath: '/data/app/base.apk', size: 1, mtime: 2, urls: [], manifest: null, savedAt: 'x' },
        { packageName: '', apkPath: '/bad', size: 0, mtime: 0, urls: [], manifest: null, savedAt: 'x' },
      ],
    });
    const facts = await loadAppFacts('SERIAL-1');
    expect(facts.size).toBe(1);
    expect(facts.get('com.example.alpha')?.apkPath).toBe('/data/app/base.apk');
  });

  it('写入带版本号的缓存文件', async () => {
    opfs.writeJson.mockResolvedValue(true);
    const ok = await saveAppFacts('SERIAL-1', [{
      packageName: 'com.example.alpha', apkPath: '/data/app/base.apk', size: 1, mtime: 2,
      urls: ['https://example.com/report'], manifest: null, savedAt: '2026-11-16T00:00:00.000Z',
    }]);
    expect(ok).toBe(true);
    expect(opfs.writeJson).toHaveBeenCalledWith(
      ['devices', 'SERIAL-1', 'app-facts.json'],
      expect.objectContaining({ version: 1, records: [expect.objectContaining({ packageName: 'com.example.alpha' })] }),
    );
  });
});
