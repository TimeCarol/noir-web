/**
 * 职责: 启动 React 和只读查询缓存
 * 导出: React root
 * 依赖: React DOM / TanStack Query
 * 约束: 查询缓存只在当前页面生命周期内有效, 不持久化设备数据
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.1
 */
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './app/App';
import { registerServiceWorker } from './app/service-worker';
import './style.css';

const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
    },
    mutations: { retry: false },
  },
});

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    <App />
  </QueryClientProvider>,
);

registerServiceWorker();