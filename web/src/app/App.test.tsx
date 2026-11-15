/**
 * 职责: 验证应用壳的默认路由, 导航和不支持浏览器提示
 * 导出: 测试用例
 * 依赖: Testing Library / TanStack Query
 * 约束: 不触发真实 WebUSB, 也不加载外部资源
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.3
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

describe('App', () => {
  it('默认进入连接页并显示导航', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('heading', { name: '连接设备' })).toBeInTheDocument();
    expect(await screen.findByText('当前浏览器不支持 WebUSB')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '应用列表' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /隐私审计/ }).length).toBeGreaterThan(0);
    expect(document.documentElement.style.getPropertyValue('--brand-icon')).toContain('data:image/svg+xml');
  });
});