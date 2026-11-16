/**
 * 职责: 验证自包含 HTML 报告的转义, 摘要和证据
 * 导出: 测试用例
 * 依赖: Vitest
 * 约束: 使用合成扫描结果, 不访问网络或真实设备
 * 作者: timecarol
 * 日期: 2026-11-16 08:25
 * 版本: v1.0
 */
import { describe, expect, it } from 'vitest';
import type { AppEntry, ScanResult } from './models';
import { reportHtml } from './report-html';

const app: AppEntry = {
  pkg: 'com.example.alpha',
  uid: '10200',
  isSystem: false,
  debuggable: false,
  installer: 'com.android.vending',
  permissions: ['READ_SMS'],
  endpoints: ['https://collect.example.com/report'],
  score: 5,
  category: 'TELEMETRY',
  vendor: '<script>alert(1)</script>',
  sharedUid: null,
  dataTypes: ['SMS'],
  leaks: { SMS: ['collect.example.com'] },
  manifest: null,
  apkPaths: ['/data/app/base.apk'],
};
const result: ScanResult = {
  serial: 'SERIAL-1',
  model: 'Pixel Test',
  product: 'test',
  android: '14',
  meta: {
    tool: 'NOIR Web test', host: 'vitest', android: '14', sdk: '34', build: 'BUILD-1',
    fingerprint: 'fingerprint', user: '0', generatedAt: '2026-11-16T00:00:00.000Z', minScore: 0, limit: 500,
  },
  apps: [app],
  recommendations: [{ pkg: app.pkg, action: 'BLOCK_DNS', risk: 'LOW', reason: '多个上报端点', autoSafe: false }],
  packageCount: 1,
  failed: [],
  startedAt: 1,
  finishedAt: 2,
};

describe('reportHtml', () => {
  it('生成离线 HTML 并转义脚本内容', () => {
    const html = reportHtml(result);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Pixel Test');
    expect(html).toContain('com.example.alpha');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('https://collect.example.com/report');
    expect(html).toContain('可拦截');
  });
});
