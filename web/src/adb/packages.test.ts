/**
 * 职责: 验证 pm list packages 输出解析和真实命令边界
 * 导出: 测试用例
 * 依赖: Vitest
 * 约束: 使用合成输出, 不连接真实设备
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.0
 */
import { describe, expect, it, vi } from 'vitest';
import type { Adb } from '@yume-chan/adb';
import { listPackages, parsePackageList } from './packages';

describe('parsePackageList', () => {
  it('解析包名和路径并按包名排序', () => {
    const output = [
      'package:/data/app/~~a/base.apk=com.example.zeta',
      'package:/data/app/~~b/base.apk=com.example.alpha',
      '',
    ].join('\n');
    expect(parsePackageList(output)).toEqual([
      { packageName: 'com.example.alpha', apkPath: '/data/app/~~b/base.apk' },
      { packageName: 'com.example.zeta', apkPath: '/data/app/~~a/base.apk' },
    ]);
  });

  it('去重重复包并使用最后一个等号切分包名', () => {
    const output = [
      'package:/data/app/~~a/base.apk=com.example.alpha',
      'package:/data/app/~~b/base.apk=com.example.alpha',
      'package:/data/app/~~c/base==suffix.apk=com.example.beta',
      'not a package line',
      'package:=broken',
    ].join('\r\n');
    expect(parsePackageList(output)).toEqual([
      { packageName: 'com.example.alpha', apkPath: '/data/app/~~b/base.apk' },
      { packageName: 'com.example.beta', apkPath: '/data/app/~~c/base==suffix.apk' },
    ]);
  });
});

describe('listPackages', () => {
  it('通过 pm list packages -f 读取并解析设备输出', async () => {
    const spawnWaitText = vi.fn(async () => 'package:/data/app/base.apk=com.example.alpha\n');
    const adb = { subprocess: { noneProtocol: { spawnWaitText } } } as unknown as Adb;
    await expect(listPackages(adb)).resolves.toEqual([
      { packageName: 'com.example.alpha', apkPath: '/data/app/base.apk' },
    ]);
    expect(spawnWaitText).toHaveBeenCalledWith(['pm', 'list', 'packages', '-f']);
  });
});