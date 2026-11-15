/**
 * 职责: 为路由懒加载增加一次短暂重试
 * 导出: lazyWithRetry
 * 依赖: React lazy
 * 约束: 只重试一次, 仍失败时交给 RouteBoundary
 * 作者: timecarol
 * 日期: 2026-11-15 23:10
 * 版本: v1.0
 */
import { lazy, type ComponentType } from 'react';

/** lazyWithRetry 在网络短暂抖动时重新请求同一 chunk */
export function lazyWithRetry(loader: () => Promise<{ default: ComponentType }>) {
  return lazy(async () => {
    try {
      return await loader();
    } catch {
      await new Promise(resolve => window.setTimeout(resolve, 600));
      return loader();
    }
  });
}