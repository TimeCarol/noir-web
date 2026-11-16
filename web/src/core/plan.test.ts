/**
 * 职责: 验证计划文本中的 appops 命令和回滚命令
 * 导出: 测试用例
 * 依赖: Vitest
 * 约束: 只生成文本, 不执行命令
 * 作者: timecarol
 * 日期: 2026-11-16 09:25
 * 版本: v1.0
 */
import { describe, expect, it } from 'vitest';
import type { ScanResult } from './models';
import { reportPlan } from './plan';

const result: ScanResult = {
  serial: 'SERIAL-1',
  model: 'Pixel Test',
  product: 'test',
  android: '14',
  meta: {
    tool: 'test', host: 'vitest', android: '14', sdk: '34', build: 'BUILD',
    fingerprint: 'fingerprint', user: '0', generatedAt: '2026-11-16T00:00:00.000Z', minScore: 0, limit: 500,
  },
  apps: [],
  recommendations: [
    { pkg: 'com.example.alpha', action: 'APPOP_USAGE_STATS', risk: 'MED', reason: 'usage', autoSafe: true },
    { pkg: 'com.example.beta', action: 'BLOCK_DNS', risk: 'LOW', reason: 'dns', autoSafe: false },
  ],
  packageCount: 0,
  failed: [],
  startedAt: 1,
  finishedAt: 2,
};

describe('reportPlan', () => {
  it('生成 appops 命令和回滚命令', () => {
    const plan = reportPlan(result);
    expect(plan).toContain('cmd appops set --user 0 com.example.alpha GET_USAGE_STATS ignore');
    expect(plan).toContain('# rollback: adb -s SERIAL-1 shell cmd appops set --user 0 com.example.alpha GET_USAGE_STATS default');
    expect(plan).toContain('# DNS 拦截: com.example.beta');
    expect(plan).toContain('# review every command before running it');
  });
});
