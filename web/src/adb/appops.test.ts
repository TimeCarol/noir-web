/**
 * 职责: 验证 appops 输出解析和命令结果判断
 * 导出: 测试用例
 * 依赖: Vitest
 * 约束: 使用合成 shell, 不修改真实设备
 * 作者: timecarol
 * 日期: 2026-11-16 09:50
 * 版本: v1.0
 */
import { describe, expect, it, vi } from 'vitest';
import type { Shell } from './shell';
import { parseAppOpMode, readAppOpMode, setAppOpMode } from './appops';

function shell(output: string): Shell {
  return {
    async exec() { return new Uint8Array(); },
    async text() { return output; },
    async stream() { throw new Error('unused'); },
  };
}

describe('appops', () => {
  it('解析显式模式和默认模式', () => {
    expect(parseAppOpMode('GET_USAGE_STATS: ignore', 'GET_USAGE_STATS')).toBe('ignore');
    expect(parseAppOpMode('No operations.\nDefault mode: allow', 'PROJECT_MEDIA')).toBe('allow');
    expect(parseAppOpMode('garbage', 'PROJECT_MEDIA')).toBe('unknown');
  });

  it('读取当前模式', async () => {
    const text = vi.fn(async () => 'GET_USAGE_STATS: default');
    const shellValue = { ...shell(''), text } as Shell;
    await expect(readAppOpMode(shellValue, 'com.example', 'GET_USAGE_STATS', '0')).resolves.toBe('default');
    expect(text).toHaveBeenCalledWith('cmd appops get --user 0 com.example GET_USAGE_STATS');
  });

  it('识别 appops 写入失败', async () => {
    const ok = await setAppOpMode(shell(''), 'com.example', 'GET_USAGE_STATS', 'ignore', '0');
    expect(ok.ok).toBe(true);
    const failed = await setAppOpMode(shell('java.lang.SecurityException: denied'), 'com.example', 'GET_USAGE_STATS', 'ignore', '0');
    expect(failed.ok).toBe(false);
  });
});
