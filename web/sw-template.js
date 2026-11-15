/**
 * 职责: 离线优先的静态资源 service worker 模板
 * 导出: dist/sw.js, 由 generate-sw-manifest.mjs 注入构建 ID
 * 依赖: Cache Storage / Fetch API
 * 约束: 只缓存同源 GET, 导航网络优先并回退缓存, 资源缓存优先
 * 作者: timecarol
 * 日期: 2026-11-15 23:10
 * 版本: v1.0
 */
const BUILD_ID = '__BUILD_ID__';
const CACHE_NAME = `noir-${BUILD_ID}`;
const SHELL = ['/', '/index.html', '/robots.txt', '/llms.txt'];

/** install 缓存应用外壳和构建清单中的静态资源 */
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    let assets = [];
    try {
      const response = await fetch('/sw-manifest.json', { cache: 'no-store' });
      assets = (await response.json()).assets || [];
    } catch {
      // 清单不可用时仍保留 index 外壳
    }
    await Promise.allSettled([...SHELL, ...assets].map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});

/** activate 清理旧版本缓存并立即接管页面 */
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('noir-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

/** fetchWithTimeout 为导航请求设置弱网等待上限 */
async function fetchWithTimeout(request, milliseconds) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** networkFirst 优先读取新页面, 弱网或断网时回退缓存 index */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetchWithTimeout(request, 2500);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await cache.put('/index.html', response.clone());
    return response;
  } catch {
    return (await cache.match('/index.html')) || Response.error();
  }
}

/** cacheFirst 对带 hash 的静态资源优先使用缓存 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js' || url.pathname === '/sw-manifest.json') return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname === '/robots.txt' || url.pathname === '/llms.txt') {
    event.respondWith(cacheFirst(request));
  }
});