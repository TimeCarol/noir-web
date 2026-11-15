/**
 * 职责: 在 OPFS 中生成和读取 ADB RSA 私钥
 * 导出: AdbOpfsCredentialStore
 * 依赖: WebCrypto / OPFS / @yume-chan/adb
 * 约束: 私钥不进入 localStorage, IndexedDB, 日志或网络
 * 作者: timecarol
 * 日期: 2026-11-16 01:20
 * 版本: v1.0
 */
import type { AdbCredentialStore, AdbPrivateKey } from '@yume-chan/adb';
import { readBytes, writeBytes } from './opfs';

const KEY_PATH = ['adb', 'key.pk8'] as const;

/** AdbOpfsCredentialStore 使用 OPFS 保存 PKCS#8 格式的 ADB 私钥 */
export class AdbOpfsCredentialStore implements AdbCredentialStore {
  constructor(private readonly appName = 'NOIR Web') {}

  /** generateKey 生成 2048 位 RSA 私钥并写入 OPFS */
  async generateKey(): Promise<AdbPrivateKey> {
    const { privateKey } = await crypto.subtle.generateKey({
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: 'SHA-1',
    }, true, ['sign', 'verify']);
    const buffer = new Uint8Array(await crypto.subtle.exportKey('pkcs8', privateKey));
    if (!await writeBytes([...KEY_PATH], buffer)) {
      throw new Error('OPFS 不可用, 无法保存 ADB 私钥');
    }
    return { buffer, name: this.label() };
  }

  /** iterateKeys 读取已保存的 ADB 私钥 */
  async *iterateKeys(): AsyncGenerator<AdbPrivateKey, void, void> {
    const buffer = await readBytes([...KEY_PATH]);
    if (buffer) yield { buffer, name: this.label() };
  }

  /** label 生成手机授权页可读的 key 名称 */
  private label(): string {
    return `${this.appName}@${globalThis.location?.hostname || 'localhost'}`;
  }
}
