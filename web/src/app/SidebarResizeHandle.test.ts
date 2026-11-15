/**
 * 职责: 验证侧栏宽度的默认值和合法范围
 * 导出: 测试用例
 * 依赖: Vitest / jsdom localStorage
 * 约束: 只测试偏好读取, 不模拟真实拖拽
 * 作者: timecarol
 * 日期: 2026-11-15 22:45
 * 版本: v1.0
 */
import { describe, expect, it } from 'vitest';
import { readSidebarWidth } from './SidebarResizeHandle';

describe('readSidebarWidth', () => {
  it('没有保存值时使用默认宽度', () => {
    expect(readSidebarWidth()).toBe(256);
  });

  it('只接受 200 至 400 的整数宽度', () => {
    localStorage.setItem('noir-sidebar-width', '320');
    expect(readSidebarWidth()).toBe(320);
    localStorage.setItem('noir-sidebar-width', '199');
    expect(readSidebarWidth()).toBe(256);
    localStorage.setItem('noir-sidebar-width', '401');
    expect(readSidebarWidth()).toBe(256);
  });
});