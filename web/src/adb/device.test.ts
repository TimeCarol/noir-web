/**
 * 职责: 验证设备属性到 DeviceInfo 的字段映射和构建号回退
 * 导出: 测试用例
 * 依赖: Vitest
 * 约束: 使用合成 getprop/settings/wifi 输出, 不连接真实设备
 * 作者: timecarol
 * 日期: 2026-11-16 01:45
 * 版本: v1.1
 */
import { describe, expect, it, vi } from 'vitest';
import type { Adb } from '@yume-chan/adb';
import { readDeviceInfo } from './device';

/** fakeAdb 按 getprop 汇总或完整命令返回固定输出 */
function fakeAdb(values: Record<string, string>): Adb {
  return {
    subprocess: {
      noneProtocol: {
        spawnWaitText: vi.fn(async (command: string[]) => {
          if (command.length === 1 && command[0] === 'getprop') {
            return Object.entries(values)
              .filter(([key]) => !key.includes(' '))
              .map(([key, value]) => `[${key}]: [${value}]`)
              .join('\n');
          }
          if (command[0] === 'getprop') return values[command[1]] ?? '';
          return values[command.join(' ')] ?? '';
        }),
      },
    },
  } as unknown as Adb;
}

describe('readDeviceInfo', () => {
  it('映射设备标识, 网络信息和系统属性', async () => {
    const adb = fakeAdb({
      'ro.product.manufacturer': 'Xiaomi',
      'ro.product.model': 'MI 6',
      'ro.product.device': 'sagit',
      'ro.product.board': 'msm8998',
      'ro.board.platform': 'msm8998',
      'ro.product.brand': 'Xiaomi',
      'ro.serialno': '86bd17ab',
      'ro.boot.serialno': '86bd17ab',
      'ro.build.version.release': '14',
      'ro.build.version.sdk': '34',
      'ro.build.display.id': 'UKQ1.240624.001 release-keys',
      'ro.build.id': 'UKQ1.240624.001',
      'ro.build.fingerprint': 'Xiaomi/sagit/sagit:14/UKQ1.240624.001:user/release-keys',
      'ro.product.cpu.abi': 'arm64-v8a',
      'gsm.network.type': 'LTE,Unknown',
      'gsm.sim.operator.alpha': 'CHINA MOBILE',
      'gsm.operator.alpha': 'CHINA MOBILE',
      'settings get global device_name': 'MI 6',
      'settings get secure android_id': '36e8b7c5bad7b66',
      'settings get secure advertising_id': 'null',
      'settings get secure bluetooth_address': '4C:49:E3:D1:3D:92',
      'settings get global adb_enabled': '1',
      'settings get global mobile_data': '0',
      'cmd wifi status': 'Wifi is enabled\nWifi is connected to "TEST-WIFI"',
      'ip addr show wlan0': '26: wlan0: <UP>\n    link/ether 8e:95:83:7b:de:9d brd ff:ff:ff:ff:ff:ff',
      'cat /sys/class/net/wlan0/address': '',
    });
    await expect(readDeviceInfo(adb)).resolves.toEqual({
      manufacturer: 'Xiaomi',
      model: 'MI 6',
      androidVersion: '14',
      sdk: '34',
      build: 'UKQ1.240624.001 release-keys',
      fingerprint: 'Xiaomi/sagit/sagit:14/UKQ1.240624.001:user/release-keys',
      abi: 'arm64-v8a',
      deviceName: 'MI 6',
      device: 'sagit',
      board: 'msm8998',
      platform: 'msm8998',
      brand: 'Xiaomi',
      googleAdId: '',
      androidId: '36e8b7c5bad7b66',
      serialNumber: '86bd17ab',
      signalType: 'LTE',
      carrier: 'CHINA MOBILE',
      networkType: 'WLAN',
      wifiMac: '8e:95:83:7b:de:9d',
      bluetoothMac: '4C:49:E3:D1:3D:92',
      usbDebugging: true,
    });
  });

  it('display id 为空时回退到 build id', async () => {
    const adb = fakeAdb({ 'ro.build.id': 'BUILD-1' });
    await expect(readDeviceInfo(adb)).resolves.toMatchObject({ build: 'BUILD-1' });
  });
});