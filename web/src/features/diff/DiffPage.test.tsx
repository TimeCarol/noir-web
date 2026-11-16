/**
 * 职责: 验证报告文件导入和差异表格
 * 导出: 测试用例
 * 依赖: Testing Library / userEvent
 * 约束: 使用内存文件, 不访问设备或网络
 * 作者: timecarol
 * 日期: 2026-11-16 08:45
 * 版本: v1.0
 */
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DiffPage from './DiffPage';

const base = JSON.stringify({
  environment: { generatedAt: '2026-11-16T00:00:00.000Z' },
  device: { serial: 'SERIAL-1', model: 'Pixel Test' },
  apps: [{ package: 'com.example.alpha', score: 5, categoryKey: 'TELEMETRY', permissions: ['READ_SMS'], endpoints: [] }],
});
const target = JSON.stringify({
  environment: { generatedAt: '2026-11-16T00:00:00.000Z' },
  device: { serial: 'SERIAL-1', model: 'Pixel Test' },
  apps: [
    { package: 'com.example.alpha', score: 7, categoryKey: 'TELEMETRY', permissions: ['READ_SMS', 'CAMERA'], endpoints: [] },
    { package: 'com.example.beta', score: 2, categoryKey: 'TOOL', permissions: [], endpoints: [] },
  ],
});

describe('DiffPage', () => {
  it('导入两份报告后展示差异', async () => {
    const user = userEvent.setup();
    render(<DiffPage />);
    await user.upload(screen.getByLabelText('选择基准报告'), new File([base], 'base.json', { type: 'application/json' }));
    await user.upload(screen.getByLabelText('选择对比报告'), new File([target], 'target.json', { type: 'application/json' }));
    await waitFor(() => expect(screen.getByText('com.example.alpha')).toBeInTheDocument());
    expect(screen.getByText('com.example.beta')).toBeInTheDocument();
    expect(screen.getAllByText('变化').length).toBeGreaterThan(0);
    expect(screen.getAllByText('新增').length).toBeGreaterThan(0);
  });
});
