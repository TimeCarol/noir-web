/**
 * 职责: 验证离线状态图标和恢复在线后的清除
 * 导出: 测试用例
 * 依赖: Vitest / Testing Library
 * 约束: 使用合成 online/offline 事件, 不访问网络
 * 作者: timecarol
 * 日期: 2026-11-15 23:10
 * 版本: v1.0
 */
import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { NetworkStatus } from './NetworkStatus';

/** setOnline 覆盖 jsdom 的 navigator.onLine */
function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
}

describe('NetworkStatus', () => {
  it('离线时显示图标, 恢复在线后清除', () => {
    setOnline(false);
    render(<NetworkStatus />);
    expect(screen.getByRole('status', { name: '离线' })).toBeInTheDocument();
    setOnline(true);
    act(() => window.dispatchEvent(new Event('online')));
    expect(screen.queryByRole('status', { name: '离线' })).not.toBeInTheDocument();
  });
});