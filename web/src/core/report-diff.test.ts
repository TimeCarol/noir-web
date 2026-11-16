/**
 * 职责: 验证报告解析和逐应用差异
 * 导出: 测试用例
 * 依赖: Vitest
 * 约束: 使用合成 report.json, 不访问设备或网络
 * 作者: timecarol
 * 日期: 2026-11-16 08:45
 * 版本: v1.0
 */
import { describe, expect, it } from 'vitest';
import { diffReports, parseReport, ReportParseError } from './report-diff';

function report(apps: unknown[]): string {
  return JSON.stringify({
    environment: { generatedAt: '2026-11-16T00:00:00.000Z' },
    device: { serial: 'SERIAL-1', model: 'Pixel Test' },
    apps,
  });
}

const base = parseReport(report([
  { package: 'com.example.alpha', score: 5, categoryKey: 'TELEMETRY', vendor: 'Example', permissions: ['READ_SMS'], endpoints: ['https://a.example.com/report'] },
  { package: 'com.example.beta', score: 3, categoryKey: 'TOOL', vendor: null, permissions: [], endpoints: [] },
]));
const target = parseReport(report([
  { package: 'com.example.alpha', score: 7, categoryKey: 'TELEMETRY', vendor: 'Example', permissions: ['READ_SMS', 'CAMERA'], endpoints: ['https://a.example.com/report', 'https://b.example.com/track'] },
  { package: 'com.example.gamma', score: 2, categoryKey: 'TOOL', vendor: null, permissions: [], endpoints: [] },
]));

describe('report diff', () => {
  it('识别新增, 移除, 变化和未变应用', () => {
    const diff = diffReports(base, target);
    expect(diff.summary).toEqual({ added: 1, removed: 1, changed: 1, same: 0 });
    const alpha = diff.rows.find(row => row.pkg === 'com.example.alpha')!;
    expect(alpha.status).toBe('changed');
    expect(alpha.scoreDelta).toBe(2);
    expect(alpha.permissionsAdded).toEqual(['CAMERA']);
    expect(alpha.endpointsAdded).toEqual(['https://b.example.com/track']);
    expect(diff.rows.find(row => row.pkg === 'com.example.beta')?.status).toBe('removed');
    expect(diff.rows.find(row => row.pkg === 'com.example.gamma')?.status).toBe('added');
  });

  it('拒绝不是报告格式的 JSON', () => {
    expect(() => parseReport('{')).toThrow(ReportParseError);
    expect(() => parseReport('{"apps": "nope"}')).toThrow(ReportParseError);
  });
});
