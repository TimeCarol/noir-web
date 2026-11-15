/**
 * 职责: 验证 dumpsys package 解析的重复块, 共享 UID 和授权状态
 * 导出: 测试用例
 * 依赖: Vitest
 * 约束: 使用合成 dumpsys 文本, 不连接真实设备
 * 作者: timecarol
 * 日期: 2026-11-15 23:55
 * 版本: v1.0
 */
import { describe, expect, it } from 'vitest';
import { isDebuggableMeta, isSystemMeta, parseDumpsys } from './dumpsys';

function dump(...lines: string[]): string {
  return lines.join('\n');
}

describe('parseDumpsys', () => {
  it('合并重复的包块', () => {
    const parsed = parseDumpsys(dump(
      '  Package [com.example.app] (aaa):',
      '    appId=10200',
      '    flags=[ HAS_CODE ]',
      '    installerPackageName=null',
      '  Package [com.example.app] (bbb):',
      '    versionName=1.2.3',
      '    android.permission.INTERNET: granted=true',
    ));
    const meta = parsed.get('com.example.app')!;
    expect(meta.permissions.has('INTERNET')).toBe(true);
    expect(meta.appId).toBe('10200');
    expect(isSystemMeta(meta)).toBe(false);
  });

  it('只把共享 UID 权限并入声明 sharedUser 的包', () => {
    const parsed = parseDumpsys(dump(
      '  Package [com.miui.securitycenter] (abc):',
      '    appId=1000',
      '    sharedUser=SharedUserSetting{def android.uid.system/1000}',
      '    flags=[ SYSTEM HAS_CODE ]',
      '  Package [com.example.userapp] (123):',
      '    appId=10500',
      '    flags=[ HAS_CODE ]',
      '',
      'Shared users:',
      '  SharedUser [android.uid.system] (def):',
      '    appId=1000',
      '    Packages',
      '      PackageSetting{abc com.miui.securitycenter/1000}',
      '    install permissions:',
      '      android.permission.INTERNET: granted=true',
      '      android.permission.QUERY_ALL_PACKAGES: granted=true',
      '      android.permission.READ_SMS: granted=true',
    ));
    const security = parsed.get('com.miui.securitycenter')!;
    expect(security.permissions.has('INTERNET')).toBe(true);
    expect(security.permissions.has('QUERY_ALL_PACKAGES')).toBe(true);
    expect(isSystemMeta(security)).toBe(true);
    expect(security.sharedUser).toBe('android.uid.system');

    const user = parsed.get('com.example.userapp')!;
    expect(user.permissions.has('INTERNET')).toBe(false);
    expect(isSystemMeta(user)).toBe(false);
  });

  it('兼容 userId 并保留带 flags 后缀的运行时权限', () => {
    const parsed = parseDumpsys(dump(
      'Package [com.example] (a):',
      '  userId=10200',
      '  flags=[ DEBUGGABLE ]',
      '  android.permission.INTERNET: granted=true',
      '  android.permission.ACCESS_FINE_LOCATION: granted=true, flags=[ USER_SENSITIVE_WHEN_GRANTED]',
      '  android.permission.CAMERA: granted=true; flags=[ USER_SET]',
      '  android.permission.RECORD_AUDIO: granted=false, flags=[ USER_SET]',
    ));
    const meta = parsed.get('com.example')!;
    expect(meta.appId).toBe('10200');
    expect(isDebuggableMeta(meta)).toBe(true);
    expect(meta.permissions.has('ACCESS_FINE_LOCATION')).toBe(true);
    expect(meta.permissions.has('CAMERA')).toBe(true);
    expect(meta.permissions.has('RECORD_AUDIO')).toBe(false);
  });

  it('仅由共享段创建的包在 appId 1000 时标记为系统应用', () => {
    const parsed = parseDumpsys(dump(
      'Shared users:',
      '  SharedUser [android.uid.system] (def):',
      '    appId=1000',
      '    Packages',
      '      PackageSetting{abc com.only.in.shared/1000}',
      '    install permissions:',
      '      android.permission.INTERNET: granted=true',
    ));
    const meta = parsed.get('com.only.in.shared')!;
    expect(meta.appId).toBe('1000');
    expect(meta.sharedUser).toBe('android.uid.system');
    expect(meta.permissions.has('INTERNET')).toBe(true);
    expect(isSystemMeta(meta)).toBe(true);
  });
});