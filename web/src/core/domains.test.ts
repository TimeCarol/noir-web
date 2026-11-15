/**
 * 职责: 验证域名三档分类, 测试域过滤和上报端点收敛
 * 导出: 测试用例
 * 依赖: Vitest
 * 约束: 使用 NOIR 的分类边界, 不联网
 * 作者: timecarol
 * 日期: 2026-11-16 00:15
 * 版本: v1.0
 */
import { describe, expect, it } from 'vitest';
import type { AppEntry } from './models';
import { classifyDomain, exportDomains, isIgnored } from './domains';

/** app 构造只包含域名导出需要的字段 */
function app(endpoints: string[]): AppEntry {
  return {
    pkg: 'com.example',
    uid: '1',
    isSystem: false,
    debuggable: false,
    installer: null,
    permissions: ['INTERNET'],
    endpoints,
    score: 0,
    category: 'OTHER',
    vendor: null,
    sharedUid: null,
    dataTypes: [],
    leaks: {},
    manifest: null,
    apkPaths: [],
  };
}

describe('classifyDomain', () => {
  it('区分统计, 功能和待复核域名', () => {
    expect(classifyDomain('applog.snssdk.com')).toBe('TRACKER');
    expect(classifyDomain('tracking.miui.com')).toBe('TRACKER');
    expect(classifyDomain('rttgpsreport.map.qq.com')).toBe('TRACKER');
    expect(classifyDomain('stat.api.tpns.tencent.com')).toBe('TRACKER');
    expect(classifyDomain('api.push.oppomobile.com')).toBe('FUNCTIONAL');
    expect(classifyDomain('android.googleapis.com')).toBe('FUNCTIONAL');
    expect(classifyDomain('api.bilibili.com')).toBe('REVIEW');
    expect(classifyDomain('staging-notify.sec.miui.com')).toBe('REVIEW');
  });

  it('不把 status 和 static 误判为统计', () => {
    expect(classifyDomain('status.example.com')).toBe('REVIEW');
    expect(classifyDomain('static.example.com')).toBe('REVIEW');
    expect(classifyDomain('biometrics.example.com')).toBe('REVIEW');
  });

  it('忽略基础设施域名, IP 和占位符', () => {
    expect(isIgnored('schemas.android.com')).toBe(true);
    expect(isIgnored('www.w3.org')).toBe(true);
    expect(isIgnored('127.0.0.1')).toBe(true);
    expect(isIgnored('log.')).toBe(true);
    expect(isIgnored('%sapp-measurement.com')).toBe(true);
    expect(isIgnored('api.bilibili.com')).toBe(false);
  });
});

describe('exportDomains', () => {
  it('只导出上报端点并丢弃测试主机', () => {
    const domains = exportDomains([app([
      'https://applog.snssdk.com/upload',
      'https://api.push.oppomobile.com/upload',
      'https://api.bilibili.com/upload',
      'https://log.testing.amap.com/upload',
      'https://api.bilibili.com/config',
      'http://127.0.0.1:8080/report',
    ])]);
    expect(domains.trackers).toEqual(['applog.snssdk.com']);
    expect(domains.review).toEqual(['api.bilibili.com']);
    expect(domains.functional).toEqual(['api.push.oppomobile.com']);
  });
});