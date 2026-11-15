/**
 * 职责: 定义 NOIR Web 的静态构建、开发服务器和组件测试
 * 导出: Vite 配置
 * 依赖: Vite / Vitest / React
 * 约束: 生产产物输出到 web/dist, JS 和 CSS 必须压缩, 不发布 source map
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.2
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { componentDeadline, slowComponentTests } from './src/test/deadlines.ts';

export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    target: 'chrome100',
    modulePreload: { polyfill: false },
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'oxc',
    cssMinify: 'lightningcss',
    sourcemap: false,
  },
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    clearMocks: true,
    testTimeout: componentDeadline(5000),
    hookTimeout: componentDeadline(10000),
    maxWorkers: slowComponentTests ? 1 : undefined,
  },
});