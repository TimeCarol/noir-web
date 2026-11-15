/**
 * 职责: 验证 ADB 私钥通过 OPFS 读写而不是 IndexedDB
 * 导出: 测试用例
 * 依赖: Vitest / Node WebCrypto / OPFS mock
 * 约束: 不写入真实浏览器存储, 不连接设备
 * 作者: timecarol
 * 日期: 2026-11-16 01:30
 * 版本: v1.0
 */
import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const opfs = vi.hoisted(() => ({
  readBytes: vi.fn(),
  writeBytes: vi.fn(),
}));
vi.mock('./opfs', () => ({
  readBytes: opfs.readBytes,
  writeBytes: opfs.writeBytes,
}));

import { AdbOpfsCredentialStore } from './adb-credentials';

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  opfs.readBytes.mockReset();
  opfs.writeBytes.mockReset();
  opfs.writeBytes.mockResolvedValue(true);
});

describe('AdbOpfsCredentialStore', () => {
  it('读取 OPFS 中已有的 PKCS#8 私钥', async () => {
    opfs.readBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const keys = [];
    for await (const key of new AdbOpfsCredentialStore().iterateKeys()) keys.push(key);
    expect(keys).toEqual([{ buffer: new Uint8Array([1, 2, 3]), name: expect.stringContaining('NOIR Web@') }]);
  });

  it('生成 RSA 私钥并写入 OPFS', async () => {
    const key = await new AdbOpfsCredentialStore().generateKey();
    expect(key.buffer.length).toBeGreaterThan(1000);
    expect(key.name).toContain('NOIR Web@');
    expect(opfs.writeBytes).toHaveBeenCalledWith(['adb', 'key.pk8'], expect.any(Uint8Array));
  });

  it('OPFS 写入失败时拒绝生成不可持久化的 key', async () => {
    opfs.writeBytes.mockResolvedValue(false);
    await expect(new AdbOpfsCredentialStore().generateKey()).rejects.toThrow('OPFS');
  });
});
