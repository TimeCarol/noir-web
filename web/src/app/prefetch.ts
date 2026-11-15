/**
 * 职责: 在空闲时预取非首屏路由, 改善弱网导航和离线可用性
 * 导出: prefetchRoutes
 * 依赖: 浏览器空闲调度 / Network Information
 * 约束: 生产环境且非省流或 2G 网络才预取
 * 作者: timecarol
 * 日期: 2026-11-15 23:10
 * 版本: v1.0
 */
interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

type IdleScheduler = {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
};

/** loadLazyRoutes 预取非首屏页面 chunk */
function loadLazyRoutes() {
  void import('../features/apps/AppsPage');
  void import('../features/roadmap/RoadmapPage');
}


/** prefetchRoutes 在页面空闲时加载应用列表和路线图 chunk */
export function prefetchRoutes(): void {
  if (!import.meta.env.PROD) return;
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (connection?.saveData || connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') return;
  const idle = (window as unknown as IdleScheduler).requestIdleCallback;
  if (idle) {
    idle(loadLazyRoutes, { timeout: 4000 });
  } else {
    window.setTimeout(loadLazyRoutes, 1500);
  }
}