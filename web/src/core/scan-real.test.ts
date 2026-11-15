/**
 * 职责: 用真实 MI 6 dumpsys 样本验证候选筛选和 USB 中断处理
 * 导出: 测试用例
 * 依赖: Vitest / 真实设备裁剪样本
 * 约束: 端点使用合成值, 不包含真实设备端点或序列号
 * 作者: timecarol
 * 日期: 2026-11-16 00:55
 * 版本: v1.0
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DeviceDisconnectedError, type Shell } from '../adb/shell';
import type { DeviceInfo, PackageEntry } from '../adb/types';
import { scanPackages } from './scan';
import type { ScanProgress } from './scan';

const dump = readFileSync('src/adb/fixtures/mi6-dumpsys.txt', 'utf8');
const packages: PackageEntry[] = [
  { packageName: 'com.miui.securitycenter', apkPath: '/product/priv-app/MIUISecurityCenter/MIUISecurityCenter.apk' },
  { packageName: 'com.android.chrome', apkPath: '/data/app/~~chrome==/com.android.chrome==/base.apk' },
  { packageName: 'com.miui.cleanmaster', apkPath: '/data/app/MIUICleanMaster/base.apk' },
  { packageName: 'com.android.providers.downloads', apkPath: '/system/priv-app/DownloadProvider/DownloadProvider.apk' },
];
const info: DeviceInfo = {
  manufacturer: 'Xiaomi',
  model: 'MI 6',
  androidVersion: '14',
  sdk: '34',
  build: 'UKQ1.240624.001',
  fingerprint: 'Xiaomi/sagit/sagit:14/UKQ1.240624.001:user/release-keys',
  abi: 'arm64-v8a',
};

/** shellWith 模拟设备端工具检查和逐包结果 */
function shellWith(lines: string[], failAfterFirst = false): Shell {
  return {
    async exec(): Promise<Uint8Array> {
      throw new Error('unused');
    },
    async text(command: string): Promise<string> {
      if (command.startsWith('which ')) return '/system/bin/unzip\n/system/bin/strings\n/system/bin/base64\n';
      throw new Error(`unexpected command: ${command}`);
    },
    async stream(command: string, onLine: (line: string) => void): Promise<void> {
      if (command === 'dumpsys package') {
        for (const line of lines) onLine(line);
        return;
      }
      onLine('R com.miui.securitycenter|https://collect.example.com/report');
      onLine('P com.miui.securitycenter');
      if (failAfterFirst) throw new DeviceDisconnectedError();
      for (const pkg of ['com.android.chrome', 'com.miui.cleanmaster', 'com.android.providers.downloads']) {
        onLine(`R ${pkg}|https://collect.example.com/report`);
        onLine(`P ${pkg}`);
      }
    },
  };
}

describe('scanPackages with real dumpsys sample', () => {
  it('从真实共享 UID 数据筛出候选并保留证据', async () => {
    const result = await scanPackages({
      shell: shellWith(dump.split('\n')),
      serial: 'REDACTED',
      model: 'MI 6',
      product: 'sagit',
      info,
      packages,
      host: 'vitest',
    });
    expect(result.packageCount).toBe(4);
    expect(result.apps.map(app => app.pkg).sort()).toEqual(packages.map(item => item.packageName).sort());

    const security = result.apps.find(app => app.pkg === 'com.miui.securitycenter')!;
    expect(security.isSystem).toBe(true);
    expect(security.sharedUid).toBe('android.uid.system');
    expect(security.permissions).toEqual(expect.arrayContaining(['READ_SMS', 'ACCESS_FINE_LOCATION', 'QUERY_ALL_PACKAGES']));

    const chrome = result.apps.find(app => app.pkg === 'com.android.chrome')!;
    expect(chrome.isSystem).toBe(false);
    expect(chrome.installer).toBe('com.android.vending');
    expect(chrome.permissions).not.toContain('READ_SMS');
  });

  it('读取 dumpsys 时断开不会被包装成普通解析错误', async () => {
    const shell = shellWith(dump.split('\n'));
    shell.stream = async () => { throw new DeviceDisconnectedError(); };
    await expect(scanPackages({
      shell,
      serial: 'REDACTED',
      model: 'MI 6',
      product: 'sagit',
      info,
      packages,
      host: 'vitest',
    })).rejects.toBeInstanceOf(DeviceDisconnectedError);
  });

  it('USB 在扫描中断开时停止并保留最后进度', async () => {
    const progress: ScanProgress[] = [];
    await expect(scanPackages({
      shell: shellWith(dump.split('\n'), true),
      serial: 'REDACTED',
      model: 'MI 6',
      product: 'sagit',
      info,
      packages,
      host: 'vitest',
    }, {
      onProgress: value => progress.push(value),
    })).rejects.toBeInstanceOf(DeviceDisconnectedError);

    const last = progress.at(-1)!;
    expect(last.phase).toBe('scan');
    expect(last.done).toBe(1);
    expect(last.total).toBe(4);
  });
});
