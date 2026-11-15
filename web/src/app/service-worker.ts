/**
 * 职责: 注册离线优先的 service worker
 * 导出: registerServiceWorker
 * 依赖: Service Worker API
 * 约束: 只在生产构建注册, 开发环境避免缓存干扰
 * 作者: timecarol
 * 日期: 2026-11-15 23:10
 * 版本: v1.0
 */
/** registerServiceWorker 在页面加载后注册根作用域缓存 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  }, { once: true });
}