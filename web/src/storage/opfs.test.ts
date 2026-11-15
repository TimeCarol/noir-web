/**
 * 职责: 验证 OPFS JSON/二进制读写和设备存储路径
 * 导出: 测试用例
 * 依赖: Vitest / 内存目录实现
 * 约束: 不访问真实浏览器存储, 使用最小 FileSystemHandle 替身
 * 作者: timecarol
 * 日期: 2026-11-16 01:20
 * 版本: v1.0
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { DeviceInfo, PackageEntry } from '../adb/types';
import type { ScanResult } from '../core/models';
import { loadDeviceInfo, loadPackages, loadScan, saveDeviceInfo, savePackages, saveScan } from './device-store';
import { readBytes, readJson, removeFile, serialSegment, writeBytes, writeJson } from './opfs';

/** MemFile 是带文本和二进制视图的内存文件 */
class MemFile {
  kind = 'file' as const;
  data = new Uint8Array();
  constructor(public name: string) {}

  async getFile(): Promise<File> {
    return {
      text: async () => new TextDecoder().decode(this.data),
      arrayBuffer: async () => this.data.slice().buffer,
    } as unknown as File;
  }

  async createWritable(): Promise<FileSystemWritableFileStream> {
    const chunks: Uint8Array[] = [];
    return {
      write: async (value: string | BufferSource) => {
        if (typeof value === 'string') chunks.push(new TextEncoder().encode(value));
        else if (value instanceof Uint8Array) chunks.push(value);
        else chunks.push(new Uint8Array(value as ArrayBuffer));
      },
      close: async () => {
        const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        this.data = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          this.data.set(chunk, offset);
          offset += chunk.length;
        }
      },
      abort: async () => undefined,
    } as unknown as FileSystemWritableFileStream;
  }
}

/** MemDirectory 是最小 FileSystemDirectoryHandle 替身 */
class MemDirectory {
  kind = 'directory' as const;
  directories = new Map<string, MemDirectory>();
  files = new Map<string, MemFile>();
  constructor(public name: string) {}

  async getDirectoryHandle(name: string, options: { create?: boolean } = {}): Promise<FileSystemDirectoryHandle> {
    const existing = this.directories.get(name);
    if (existing) return existing as unknown as FileSystemDirectoryHandle;
    if (!options.create) throw new DOMException('not found', 'NotFoundError');
    const created = new MemDirectory(name);
    this.directories.set(name, created);
    return created as unknown as FileSystemDirectoryHandle;
  }

  async getFileHandle(name: string, options: { create?: boolean } = {}): Promise<FileSystemFileHandle> {
    const existing = this.files.get(name);
    if (existing) return existing as unknown as FileSystemFileHandle;
    if (!options.create) throw new DOMException('not found', 'NotFoundError');
    const created = new MemFile(name);
    this.files.set(name, created);
    return created as unknown as FileSystemFileHandle;
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.files.delete(name) && !this.directories.delete(name)) throw new DOMException('not found', 'NotFoundError');
  }

  async *keys(): AsyncGenerator<string> {
    yield* this.files.keys();
    yield* this.directories.keys();
  }
}

const root = new MemDirectory('root');

beforeEach(() => {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: { getDirectory: async () => root },
  });
});

const info: DeviceInfo = {
  manufacturer: 'Xiaomi',
  model: 'MI 6',
  androidVersion: '14',
  sdk: '34',
  build: 'UKQ1',
  fingerprint: 'redacted',
  abi: 'arm64-v8a',
};
const packages: PackageEntry[] = [{ packageName: 'com.example.audit', apkPath: '/data/app/base.apk' }];
const scan: ScanResult = {
  serial: 'SERIAL:1',
  model: 'MI 6',
  product: 'sagit',
  android: '14',
  meta: {
    tool: 'test', host: 'vitest', android: '14', sdk: '34', build: 'UKQ1',
    fingerprint: 'redacted', user: '0', generatedAt: '2026-11-16T00:00:00.000Z', minScore: 0, limit: 500,
  },
  apps: [],
  recommendations: [],
  packageCount: 1,
  failed: [],
  startedAt: 1,
  finishedAt: 2,
};

describe('opfs', () => {
  it('写入和读取 JSON 与二进制', async () => {
    expect(await writeJson(['test', 'value.json'], { ok: true })).toBe(true);
    await expect(readJson(['test', 'value.json'])).resolves.toEqual({ ok: true });
    expect(await writeBytes(['test', 'value.bin'], new Uint8Array([1, 2, 3]))).toBe(true);
    await expect(readBytes(['test', 'value.bin'])).resolves.toEqual(new Uint8Array([1, 2, 3]));
  });

  it('删除旧文件后读取返回空值', async () => {
    await writeJson(['legacy', 'key.json'], { old: true });
    expect(await removeFile(['legacy', 'key.json'])).toBe(true);
    await expect(readJson(['legacy', 'key.json'])).resolves.toBeNull();
  });

  it('设备序列号被编码为单一路径段', () => {
    expect(serialSegment('SERIAL:1')).toBe('SERIAL%3A1');
    expect(serialSegment('  ')).toBe('unknown');
  });

  it('按设备保存和恢复设备信息, 包清单和扫描结果', async () => {
    expect(await saveDeviceInfo(scan.serial, info)).toBe(true);
    expect(await savePackages(scan.serial, packages)).toBe(true);
    expect(await saveScan(scan.serial, scan)).toBe(true);
    await expect(loadDeviceInfo(scan.serial)).resolves.toEqual(info);
    await expect(loadPackages(scan.serial)).resolves.toEqual(packages);
    await expect(loadScan(scan.serial)).resolves.toEqual(scan);
  });

  it('OPFS 不可用时返回空值而不是抛错', async () => {
    Object.defineProperty(navigator, 'storage', { configurable: true, value: undefined });
    await expect(readJson(['missing'])).resolves.toBeNull();
    expect(await writeJson(['missing'], {})).toBe(false);
  });
});
