/**
 * 职责: 验证扫描编排的候选筛选, 权限收敛和报告字段
 * 导出: 测试用例
 * 依赖: Vitest / 合成 Shell
 * 约束: 不连接真实 ADB, 不读取真实 APK
 * 作者: timecarol
 * 日期: 2026-11-15 23:55
 * 版本: v1.0
 */
import { describe, expect, it, vi } from 'vitest';
import type { Shell } from '../adb/shell';
import type { DeviceInfo, PackageEntry } from '../adb/types';
import { scanPackages } from './scan';
import { reportCsv, reportJson, reportMarkdown } from './report';

const packages: PackageEntry[] = [
  { packageName: 'com.example.alpha', apkPath: '/data/app/alpha/base.apk' },
  { packageName: 'com.example.beta', apkPath: '/data/app/beta/base.apk' },
  { packageName: 'com.example.gamma', apkPath: '/data/app/gamma/base.apk' },
];

const info: DeviceInfo = {
  manufacturer: 'Example',
  model: 'Pixel Test',
  androidVersion: '14',
  sdk: '34',
  build: 'TEST.1',
  fingerprint: 'example/test/fingerprint',
  abi: 'arm64-v8a',
};

const dumpsys = [
  '  Package [com.example.alpha] (a):',
  '    appId=10200',
  '    flags=[ HAS_CODE ]',
  '    installerPackageName=com.android.vending',
  '    android.permission.INTERNET: granted=true',
  '    android.permission.READ_SMS: granted=true',
  '    android.permission.RECORD_AUDIO: granted=false',
  '  Package [com.example.beta] (b):',
  '    appId=10201',
  '    flags=[ SYSTEM ]',
  '    android.permission.INTERNET: granted=true',
  '  Package [com.example.gamma] (c):',
  '    appId=10202',
  '    flags=[ HAS_CODE ]',
  '    android.permission.READ_SMS: granted=true',
].join('\n');

/** fakeShell 只实现扫描用到的 text 和 stream */
function fakeShell(onStream?: (command: string) => void, dump = dumpsys): Shell {
  return {
    async exec(): Promise<Uint8Array> {
      throw new Error('unused');
    },
    async text(command: string): Promise<string> {
      if (command.startsWith('which ')) return '/system/bin/unzip\n/system/bin/strings\n/system/bin/base64\n';
      if (command.startsWith('stat -c')) return '';
      throw new Error(`unexpected command: ${command}`);
    },
    async stream(command: string, onLine: (line: string) => void): Promise<void> {
      if (command === 'dumpsys package') {
        for (const line of dump.split('\n')) onLine(line);
        return;
      }
      onStream?.(command);
      onLine('R com.example.alpha|https://collect.example.com/report https://ads.example.net/track');
      onLine('P com.example.alpha');
    },
  };
}

describe('scanPackages', () => {
  it('只保留 INTERNET 加敏感权限的包并收敛权限', async () => {
    const seen = vi.fn();
    const result = await scanPackages({
      shell: fakeShell(seen),
      serial: 'SERIAL-1',
      model: 'Pixel Test',
      product: 'test',
      info,
      packages,
      host: 'vitest',
      tool: 'NOIR Web test',
    }, { onProgress: () => undefined });

    expect(seen).toHaveBeenCalledOnce();
    expect(seen.mock.calls[0][0]).toContain("p='com.example.alpha'");
    expect(result.packageCount).toBe(3);
    expect(result.apps).toHaveLength(1);
    expect(result.failed).toEqual([]);
    expect(result.meta.tool).toBe('NOIR Web test');

    const app = result.apps[0];
    expect(app.pkg).toBe('com.example.alpha');
    expect(app.permissions).toEqual(['READ_SMS']);
    expect(app.endpoints).toEqual([
      'https://collect.example.com/report',
      'https://ads.example.net/track',
    ]);
    expect(app.score).toBe(4);
    expect(app.dataTypes).toEqual(['SMS']);
    expect(app.leaks.SMS).toEqual(['ads.example.net', 'collect.example.com']);
    expect(app.installer).toBe('com.android.vending');
  });

  it('导出 JSON, Markdown 和 CSV 时保持关键字段', async () => {
    const result = await scanPackages({
      shell: fakeShell(),
      serial: 'SERIAL-1',
      model: 'Pixel Test',
      product: 'test',
      info,
      packages,
      host: 'vitest',
    });

    const json = JSON.parse(reportJson(result));
    expect(json.device).toEqual({ serial: 'SERIAL-1', model: 'Pixel Test' });
    expect(json.apps[0].package).toBe('com.example.alpha');
    expect(json.apps[0].categoryKey).toBeTruthy();
    expect(json.apps[0].leaksByType.SMS).toEqual(['ads.example.net', 'collect.example.com']);
    expect(json.apps[0].leaks['短信']).toEqual(['ads.example.net', 'collect.example.com']);
    expect(json.environment.tool).toBe('NOIR Web 0.1.0');

    const markdown = reportMarkdown(result);
    expect(markdown).toContain('# NOIR report');
    expect(markdown).toContain('com.example.alpha');

    const csv = reportCsv(result);
    expect(csv.split('\r\n')[0]).toContain('device_model');
    expect(csv).toContain('com.example.alpha');
  });

  it('解析 dumpsys 失败时给出可展示错误', async () => {
    const shell = fakeShell(undefined, 'garbage');
    await expect(scanPackages({
      shell,
      serial: 'SERIAL-1',
      model: 'Pixel Test',
      product: 'test',
      info,
      packages,
    })).rejects.toThrow('dumpsys package 输出无法解析');
  });
});