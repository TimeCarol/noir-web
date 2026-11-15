/**
 * 职责: 验证远程 ZIP 中央目录和条目读取
 * 导出: 测试用例
 * 依赖: Vitest / fflate
 * 约束: 用内存 ZIP 和区间 shell 模拟设备, 不发真实命令
 * 作者: timecarol
 * 日期: 2026-11-15 23:55
 * 版本: v1.0
 */
import { describe, expect, it } from 'vitest';
import { DecompressionStream as NodeDecompressionStream } from 'node:stream/web';
import { zipSync } from 'fflate';
import type { Shell } from '../adb/shell';
import { listZipEntries, readZipEntry } from './remote-zip';

const manifest = new Uint8Array([0x03, 0x00, 0x08, 0x00, 0x01, 0x02, 0x03, 0x04]);
const dex = new TextEncoder().encode('https://collect.example.com/report');
if (!globalThis.DecompressionStream) {
  globalThis.DecompressionStream = NodeDecompressionStream as unknown as typeof DecompressionStream;
}

const archive = zipSync({
  'AndroidManifest.xml': manifest,
  'classes.dex': dex,
  'classes2.dex': new TextEncoder().encode('https://ads.example.net/track'),
});

/** fakeShell 解析 wc 和 tail|head 命令, 返回 ZIP 的对应区间 */
function fakeShell(bytes: Uint8Array): Shell {
  return {
    async exec(command: string): Promise<Uint8Array> {
      const match = /^tail -c \+(\d+) '(.+)' \| head -c (\d+)$/.exec(command);
      if (!match) throw new Error(`unexpected command: ${command}`);
      const offset = Number(match[1]) - 1;
      const length = Number(match[3]);
      return bytes.slice(offset, offset + length);
    },
    async text(command: string): Promise<string> {
      if (command.startsWith('wc -c <')) return String(bytes.length);
      throw new Error(`unexpected command: ${command}`);
    },
    async stream(): Promise<void> {
      throw new Error('unused');
    },
  };
}

describe('remote zip', () => {
  it('解析中央目录并读取压缩条目', async () => {
    const shell = fakeShell(archive);
    const entries = await listZipEntries(shell, '/data/app/base.apk');
    expect(entries.map(entry => entry.name)).toEqual(['AndroidManifest.xml', 'classes.dex', 'classes2.dex']);

    const entry = entries.find(item => item.name === 'AndroidManifest.xml')!;
    const loaded = await readZipEntry(shell, '/data/app/base.apk', entry);
    expect(loaded).toEqual(manifest);

    const dexEntry = entries.find(item => item.name === 'classes.dex')!;
    const loadedDex = await readZipEntry(shell, '/data/app/base.apk', dexEntry);
    expect(new TextDecoder().decode(loadedDex!)).toBe('https://collect.example.com/report');
  });

  it('拒绝没有本地文件头的偏移', async () => {
    const shell = fakeShell(archive);
    const entry = { name: 'classes.dex', method: 8, compressedSize: 10, uncompressedSize: 10, localOffset: 1 };
    await expect(readZipEntry(shell, '/data/app/base.apk', entry)).resolves.toBeNull();
  });
});