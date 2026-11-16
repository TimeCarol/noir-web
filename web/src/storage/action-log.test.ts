/**
 * 职责: 验证 appops 回滚日志的读写和去重键
 * 导出: 测试用例
 * 依赖: Vitest / OPFS mock
 * 约束: 不访问真实浏览器存储
 * 作者: timecarol
 * 日期: 2026-11-16 09:55
 * 版本: v1.0
 */
import { describe, expect, it, vi } from 'vitest';

const opfs = vi.hoisted(() => ({
  readJson: vi.fn(),
  writeJson: vi.fn(),
  serialSegment: vi.fn((value: string) => value),
}));
vi.mock('./opfs', () => ({
  readJson: opfs.readJson,
  writeJson: opfs.writeJson,
  serialSegment: opfs.serialSegment,
}));

import { actionKey, loadActionLog, saveActionLog } from './action-log';

describe('action log', () => {
  it('读取动作记录并生成稳定键', async () => {
    opfs.readJson.mockResolvedValue({
      version: 1,
      savedAt: '2026-11-16T00:00:00.000Z',
      records: [{ pkg: 'com.example', op: 'GET_USAGE_STATS', before: 'allow', appliedAt: 'x' }],
    });
    const log = await loadActionLog('SERIAL-1');
    expect(actionKey('com.example', 'GET_USAGE_STATS')).toBe('com.example|GET_USAGE_STATS');
    expect(log.get('com.example|GET_USAGE_STATS')?.before).toBe('allow');
  });

  it('写入版本化动作日志', async () => {
    opfs.writeJson.mockResolvedValue(true);
    const ok = await saveActionLog('SERIAL-1', [{ pkg: 'com.example', op: 'GET_USAGE_STATS', before: 'default', appliedAt: '2026-11-16T00:00:00.000Z' }]);
    expect(ok).toBe(true);
    expect(opfs.writeJson).toHaveBeenCalledWith(
      ['devices', 'SERIAL-1', 'actions.json'],
      expect.objectContaining({ version: 1, records: [expect.objectContaining({ pkg: 'com.example' })] }),
    );
  });
});
