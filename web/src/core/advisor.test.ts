/**
 * 职责: 验证 Advisor 的动作边界和排序
 * 导出: 测试用例
 * 依赖: Vitest
 * 约束: 用户应用不会被建议卸载, 核心系统包不产生复核项
 * 作者: timecarol
 * 日期: 2026-11-15 23:55
 * 版本: v1.0
 */
import { describe, expect, it } from 'vitest';
import type { AppEntry, Category } from './models';
import { advise } from './advisor';

/** entry 构造最小应用, 只覆盖 Advisor 读取的字段 */
function entry(pkg: string, category: Category, options: Partial<AppEntry> = {}): AppEntry {
  return {
    pkg,
    uid: '10000',
    isSystem: false,
    debuggable: false,
    installer: null,
    permissions: [],
    endpoints: [],
    score: 0,
    category,
    vendor: null,
    sharedUid: null,
    dataTypes: [],
    leaks: {},
    manifest: null,
    apkPaths: [],
    ...options,
  };
}

describe('advise', () => {
  it('遥测系统应用可以撤销使用统计授权', () => {
    const result = advise([
      entry('com.example.telemetry', 'TELEMETRY', {
        isSystem: true,
        permissions: ['PACKAGE_USAGE_STATS'],
      }),
    ]);
    expect(result).toContainEqual(expect.objectContaining({
      pkg: 'com.example.telemetry',
      action: 'APPOP_USAGE_STATS',
      risk: 'MED',
      autoSafe: true,
    }));
  });

  it('核心系统包不产生遥测复核项', () => {
    const result = advise([entry('com.android.systemui', 'TELEMETRY', { isSystem: true })]);
    expect(result).toEqual([]);
  });

  it('多个上报端点的广告应用建议 DNS 拦截且不建议卸载', () => {
    const result = advise([
      entry('com.example.ads', 'ADS', {
        endpoints: ['https://a.example.com/report', 'https://b.example.net/track'],
      }),
    ]);
    expect(result.map(item => item.action)).toEqual(['REVIEW', 'BLOCK_DNS']);
    expect(result.some(item => item.action === 'UNINSTALL_USER')).toBe(false);
    expect(result.every(item => item.autoSafe === false)).toBe(true);
  });

  it('按 HIGH, MED, LOW 排序并去重', () => {
    const result = advise([
      entry('com.example.ads', 'ADS', {
        isSystem: true,
        endpoints: ['https://a.example.com/report', 'https://b.example.net/track'],
      }),
      entry('com.example.user', 'TELEMETRY'),
    ]);
    expect(result.map(item => item.risk)).toEqual(['HIGH', 'MED', 'LOW']);
    expect(new Set(result.map(item => `${item.pkg}|${item.action}`)).size).toBe(result.length);
  });
});