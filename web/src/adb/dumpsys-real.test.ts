/**
 * 职责: 用真实设备裁剪样本验证 dumpsys 共享 UID 和权限解析
 * 导出: 测试用例
 * 依赖: Vitest / Xiaomi MI 6 的真实 dumpsys 输出样本
 * 约束: 样本只保留系统包和权限行, 不含序列号、账号或端点
 * 作者: timecarol
 * 日期: 2026-11-16 00:45
 * 版本: v1.0
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isSystemMeta, parseDumpsys } from './dumpsys';

const dump = readFileSync('src/adb/fixtures/mi6-dumpsys.txt', 'utf8');
const parsed = parseDumpsys(dump);

describe('parseDumpsys real MI 6 sample', () => {
  it('保留真实包块和共享 UID 权限', () => {
    expect(parsed.size).toBe(4);
    const security = parsed.get('com.miui.securitycenter')!;
    expect(security.appId).toBe('1000');
    expect(security.sharedUser).toBe('android.uid.system');
    expect(isSystemMeta(security)).toBe(true);
    expect([...security.permissions]).toEqual(expect.arrayContaining([
      'INTERNET',
      'PACKAGE_USAGE_STATS',
      'QUERY_ALL_PACKAGES',
      'READ_SMS',
      'ACCESS_FINE_LOCATION',
    ]));
  });

  it('不把共享 UID 权限泄露给普通应用', () => {
    const chrome = parsed.get('com.android.chrome')!;
    expect(chrome.appId).toBe('10264');
    expect(chrome.sharedUser).toBeNull();
    expect(chrome.installer).toBe('com.android.vending');
    expect(chrome.permissions.has('INTERNET')).toBe(true);
    expect(chrome.permissions.has('QUERY_ALL_PACKAGES')).toBe(true);
    expect(chrome.permissions.has('FOREGROUND_SERVICE_MEDIA_PROJECTION')).toBe(true);
    expect(chrome.permissions.has('READ_SMS')).toBe(false);
    expect(chrome.permissions.has('ACCESS_FINE_LOCATION')).toBe(false);
  });

  it('区分共享 UID 中 SYSTEM 标记的包', () => {
    const cleanmaster = parsed.get('com.miui.cleanmaster')!;
    expect(cleanmaster.appId).toBe('1000');
    expect(cleanmaster.sharedUser).toBe('android.uid.system');
    expect(isSystemMeta(cleanmaster)).toBe(false);
    expect(cleanmaster.permissions.has('READ_SMS')).toBe(true);

    const downloads = parsed.get('com.android.providers.downloads')!;
    expect(downloads.appId).toBe('10083');
    expect(downloads.sharedUser).toBe('android.media');
    expect(downloads.permissions.has('MANAGE_EXTERNAL_STORAGE')).toBe(true);
    expect(downloads.permissions.has('READ_MEDIA_IMAGES')).toBe(true);
  });
});
