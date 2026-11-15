/**
 * 职责: 验证路线图用紧凑里程碑表达阶段
 * 导出: 测试用例
 * 依赖: Testing Library
 * 约束: 使用合成文案断言, 不依赖网络
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.1
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import RoadmapPage from './RoadmapPage';

describe('RoadmapPage', () => {
  it('按顺序展示 M0 到 M3', () => {
    render(<RoadmapPage />);
    expect(screen.getByText('M0 连接')).toBeInTheDocument();
    expect(screen.getByText('M1 数据')).toBeInTheDocument();
    expect(screen.getByText('M3 处置')).toBeInTheDocument();
  });
});