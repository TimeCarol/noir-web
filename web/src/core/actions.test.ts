/**
 * 职责: 验证 appops 动作生成和命令格式
 * 导出: 测试用例
 * 依赖: Vitest
 * 约束: 只测试纯函数, 不执行命令
 * 作者: timecarol
 * 日期: 2026-11-16 09:50
 * 版本: v1.0
 */
import { describe, expect, it } from 'vitest';
import type { Recommendation } from './models';
import { appOpActions, appOpCommand } from './actions';

describe('appOpActions', () => {
  it('提取 appops 建议并去重', () => {
    const recommendations: Recommendation[] = [
      { pkg: 'com.example.beta', action: 'APPOP_USAGE_STATS', risk: 'MED', reason: 'usage', autoSafe: true },
      { pkg: 'com.example.alpha', action: 'APPOP_USAGE_STATS', risk: 'MED', reason: 'usage', autoSafe: true },
      { pkg: 'com.example.alpha', action: 'APPOP_USAGE_STATS', risk: 'MED', reason: 'usage', autoSafe: true },
      { pkg: 'com.example.beta', action: 'BLOCK_DNS', risk: 'LOW', reason: 'dns', autoSafe: false },
    ];
    const actions = appOpActions(recommendations);
    expect(actions).toHaveLength(2);
    expect(actions.map(action => action.pkg)).toEqual(['com.example.alpha', 'com.example.beta']);
    expect(appOpCommand('SERIAL', '0', 'com.example.alpha', 'GET_USAGE_STATS', 'ignore')).toBe('adb -s SERIAL shell cmd appops set --user 0 com.example.alpha GET_USAGE_STATS ignore');
  });
});
