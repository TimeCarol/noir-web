/**
 * 职责: 验证按需 DeepScan 的路径发现和信号映射
 * 导出: 测试用例
 * 依赖: Vitest
 * 约束: 使用合成 shell, 不读取真实 APK
 * 作者: timecarol
 * 日期: 2026-11-16 10:40
 * 版本: v1.0
 */
import { describe, expect, it, vi } from 'vitest';
import type { AppEntry } from '../core/models';
import type { Shell } from './shell';
import { deepScanApps } from './deep-scan';

const app: AppEntry = {
  pkg: 'com.example.alpha', uid: '1', isSystem: false, debuggable: false, installer: null,
  permissions: [], endpoints: [], score: 5, category: 'OTHER', vendor: null, sharedUid: null,
  dataTypes: [], leaks: {}, manifest: null, apkPaths: ['/data/app/base.apk'],
};

describe('deepScanApps', () => {
  it('读取 split 路径并提取信号', async () => {
    const text = vi.fn(async (command: string) => {
      if (command.startsWith('pm path')) return 'package:/data/app/base.apk\npackage:/data/app/split.apk\n';
      if (command.includes('grep -oF')) return 'DexClassLoader\ngetDeviceId\n';
      return '';
    });
    const shell = { exec: async () => new Uint8Array(), text, stream: async () => undefined } as Shell;
    const result = await deepScanApps(shell, [app]);
    expect(result.get('com.example.alpha')).toEqual(expect.arrayContaining(['dynamic-load', 'device-id']));
    expect(text.mock.calls[1][0]).toContain("'/data/app/base.apk'");
    expect(text.mock.calls[1][0]).toContain("'/data/app/split.apk'");
  });
});
