/**
 * 职责: 安装组件测试的 DOM 能力并清理浏览器状态
 * 导出: 测试钩子
 * 依赖: Testing Library / jsdom
 * 约束: 每个用例清理本地存储和挂载节点, 不伪造真实 USB 设备
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.0
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { componentDeadline } from './test/deadlines';

configure({ asyncUtilTimeout: componentDeadline(1000) });

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
});

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: () => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }),
});

Object.defineProperty(navigator, 'usb', {
  configurable: true,
  value: undefined,
});

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};