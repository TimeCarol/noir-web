/**
 * 职责: 验证设备属性到 DeviceInfo 的字段映射和构建号回退
 * 导出: 测试用例
 * 依赖: Vitest
 * 约束: 使用合成 getprop 输出, 不连接真实设备
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.0
 */
import { describe, expect, it, vi } from 'vitest';
import type { Adb } from '@yume-chan/adb';
import { readDeviceInfo } from './device';

/** fakeAdb 按属性名返回固定 getprop 输出 */
function fakeAdb(values: Record<string, string>): Adb {
  return {
    subprocess: {
      noneProtocol: {
        spawnWaitText: vi.fn(async (command: string[]) => values[command[1]] ?? ''),
      },
    },
  } as unknown as Adb;
}

describe('readDeviceInfo', () => {
  it('映射型号, 版本, 构建, 指纹和 ABI', async () => {
    const adb = fakeAdb({
      'ro.product.manufacturer': 'Xiaomi',
      'ro.product.model': 'MI 6',
      'ro.build.version.release': '14',
      'ro.build.version.sdk': '34',
      'ro.build.display.id': 'UKQ1.240624.001 release-keys',
      'ro.build.id': 'UKQ1.240624.001',
      'ro.build.fingerprint': 'Xiaomi/sagit/sagit:14/UKQ1.240624.001:user/release-keys',
      'ro.product.cpu.abi': 'arm64-v8a',
    });
    await expect(readDeviceInfo(adb)).resolves.toEqual({
      manufacturer: 'Xiaomi',
      model: 'MI 6',
      androidVersion: '14',
      sdk: '34',
      build: 'UKQ1.240624.001 release-keys',
      fingerprint: 'Xiaomi/sagit/sagit:14/UKQ1.240624.001:user/release-keys',
      abi: 'arm64-v8a',
    });
  });

  it('display id 为空时回退到 build id', async () => {
    const adb = fakeAdb({ 'ro.build.id': 'BUILD-1' });
    await expect(readDeviceInfo(adb)).resolves.toMatchObject({ build: 'BUILD-1' });
  });
});