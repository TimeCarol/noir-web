/**
 * 职责: 验证设备端快路径的脚本标记, 输出解析和 Manifest 解码
 * 导出: 测试用例
 * 依赖: Vitest
 * 约束: 用合成 shell 输出, 不连接真实设备
 * 作者: timecarol
 * 日期: 2026-11-16 00:20
 * 版本: v1.0
 */
import { describe, expect, it } from 'vitest';
import type { Shell } from './shell';
import { scanDeviceUrls } from './device-scan';

describe('scanDeviceUrls', () => {
  it('解析设备端 M/R/P 标记并保留包名', async () => {
    let command = '';
    const shell: Shell = {
      async exec(): Promise<Uint8Array> {
        throw new Error('unused');
      },
      async text(input: string): Promise<string> {
        if (input.startsWith('which ')) return '/system/bin/unzip\n/system/bin/strings\n/system/bin/base64\n';
        throw new Error(`unexpected text: ${input}`);
      },
      async stream(input: string, onLine: (line: string) => void): Promise<void> {
        command = input;
        onLine('R com.example.alpha|https://collect.example.com/report');
        onLine('P com.example.alpha');
      },
    };

    const result = await scanDeviceUrls(shell, [
      { packageName: 'com.example.alpha', apkPath: '/data/app/alpha/base.apk' },
    ]);
    expect(command).toContain('echo "P com.example.alpha"');
    expect(command).toContain('echo "R com.example.alpha|$f"');
    expect(result.urls.get('com.example.alpha')).toEqual(['https://collect.example.com/report']);
    expect(result.failed).toEqual(new Set());
  });

  it('没有 R 标记的包不会被误报为成功', async () => {
    const shell: Shell = {
      async exec(): Promise<Uint8Array> {
        throw new Error('unused');
      },
      async text(): Promise<string> {
        return '/system/bin/unzip\n/system/bin/strings\n';
      },
      async stream(): Promise<void> {
        throw new Error('device shell failed');
      },
    };
    await expect(scanDeviceUrls(shell, [
      { packageName: 'com.example.beta', apkPath: '/data/app/beta/base.apk' },
    ])).rejects.toThrow('device shell failed');
  });
});