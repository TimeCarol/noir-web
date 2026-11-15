/**
 * 职责: 用真实 Chrome 检查多尺寸视口下的布局、导航和触控尺寸
 * 导出: 退出码和 test-results/viewports.json
 * 依赖: playwright-core / 本地 Chrome / web/dist
 * 约束: 只读取静态构建, 不连接设备, 不访问外部网络
 * 作者: timecarol
 * 日期: 2026-11-15 23:00
 * 版本: v1.0
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const viewports = [
  { label: 'ultrawide 5120', width: 5120, height: 1440, touch: false },
  { label: 'ultrawide 3440', width: 3440, height: 1440, touch: false },
  { label: '4K', width: 3840, height: 2160, touch: false },
  { label: '2K', width: 2560, height: 1440, touch: false },
  { label: '1080p', width: 1920, height: 1080, touch: false },
  { label: '720p', width: 1280, height: 720, touch: false },
  { label: 'laptop 1366', width: 1366, height: 768, touch: false },
  { label: 'laptop 1440x900', width: 1440, height: 900, touch: false },
  { label: 'macbook 1512x982', width: 1512, height: 982, touch: false },
  { label: 'laptop 1680x1050', width: 1680, height: 1050, touch: false },
  { label: 'laptop 1920x1200', width: 1920, height: 1200, touch: false },
  { label: 'laptop 2560x1600', width: 2560, height: 1600, touch: false },
  { label: 'tablet 768x1024', width: 768, height: 1024, touch: true },
  { label: 'tablet 1024x768', width: 1024, height: 768, touch: true },
  { label: 'ipad air 820x1180', width: 820, height: 1180, touch: true },
  { label: 'ipad air 1180x820', width: 1180, height: 820, touch: true },
  { label: 'ipad pro 834x1194', width: 834, height: 1194, touch: true },
  { label: 'ipad pro 1194x834', width: 1194, height: 834, touch: true },
  { label: 'android tablet 800x1280', width: 800, height: 1280, touch: true },
  { label: 'android tablet 1280x800', width: 1280, height: 800, touch: true },
  { label: 'phone 280x653', width: 280, height: 653, touch: true },
  { label: 'iphone se 320x568', width: 320, height: 568, touch: true },
  { label: 'android 360x640', width: 360, height: 640, touch: true },
  { label: 'android 360x800', width: 360, height: 800, touch: true },
  { label: 'iphone 375x667', width: 375, height: 667, touch: true },
  { label: 'iphone 390x844', width: 390, height: 844, touch: true },
  { label: 'pixel 393x852', width: 393, height: 852, touch: true },
  { label: 'pixel 412x915', width: 412, height: 915, touch: true },
  { label: 'iphone max 430x932', width: 430, height: 932, touch: true },
  { label: 'fold cover 344x882', width: 344, height: 882, touch: true },
  { label: 'fold inner 673x841', width: 673, height: 841, touch: true },
  { label: 'fold inner 720x1024', width: 720, height: 1024, touch: true },
  { label: 'pixel fold 840x1024', width: 840, height: 1024, touch: true },
  { label: 'tri-fold 1008x1200', width: 1008, height: 1200, touch: true },
  { label: 'tri-fold 1116x1200', width: 1116, height: 1200, touch: true },
  { label: 'duo 540x720', width: 540, height: 720, touch: true },
  { label: 'duo open 1116x720', width: 1116, height: 720, touch: true },
  { label: 'flip cover 344x748', width: 344, height: 748, touch: true },
  { label: 'flip open 412x1008', width: 412, height: 1008, touch: true },
];

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.json', 'application/json; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.wasm', 'application/wasm'],
]);

/** findChrome 返回可执行的系统 Chrome, 找不到时由调用方按跳过处理 */
function findChrome() {
  const candidates = process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    : process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        ]
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return process.env.CHROME_PATH || candidates.find(existsSync);
}

/** startStaticServer 提供 web/dist 和 SPA 回退, 不引入额外服务器进程 */
async function startStaticServer() {
  const root = fileURLToPath(new URL('../dist/', import.meta.url));
  const server = createServer(async (request, response) => {
    const urlPath = decodeURIComponent((request.url || '/').split('?')[0]).replace(/^\/+/, '');
    let requested = normalize(join(root, urlPath || 'index.html'));
    let file = requested.startsWith(root) ? await readFile(requested).catch(() => null) : null;
    if (!file) {
      requested = join(root, 'index.html');
      file = await readFile(requested);
    }
    const type = mimeTypes.get(extname(requested)) || 'application/octet-stream';
    const headers = { 'Content-Type': type, Vary: 'Accept-Encoding' };
    if ((request.headers['accept-encoding'] || '').includes('gzip')) {
      const gzip = await readFile(`${requested}.gz`).catch(() => null);
      if (gzip) {
        file = gzip;
        headers['Content-Encoding'] = 'gzip';
      }
    }
    response.writeHead(200, headers);
    response.end(file);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, port: server.address().port };
}

/** readMetrics 收集布局断言需要的矩形和样式 */
async function readMetrics(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        right: box.right,
        bottom: box.bottom,
        display: style.display,
        overflowY: style.overflowY,
      };
    };
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      header: rect('.workspace-header'),
      h1: rect('h1'),
      main: rect('.app-content'),
      sidebar: rect('.sidebar'),
      mobileNav: rect('.mobile-navigation'),
      card: rect('.ant-card'),
      summary: rect('.device-summary'),
      button: rect('.connect-panel .ant-btn'),
      handle: rect('.sidebar-resize-handle'),
      mobileLinks: [...document.querySelectorAll('.mobile-navigation a')].map(element => {
        const box = element.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }),
      bodyText: document.body.innerText,
    };
  });
}

/**
 * testOffline 验证 service worker 缓存后的离线加载和恢复在线
 * @param browser Playwright 浏览器
 * @param port 本地静态服务端口
 */
async function testOffline(browser, port) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  try {
    await page.goto(`http://127.0.0.1:${port}/#/connect`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /选择设备/ }).waitFor({ state: 'visible', timeout: 15000 });
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
      }
    });
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.getByRole('button', { name: /选择设备/ }).waitFor({ state: 'visible', timeout: 15000 });
    assert.ok((await page.evaluate(() => document.body.innerText)).includes('设备'), 'offline: 缓存外壳没有渲染');
    await context.setOffline(false);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.getByRole('button', { name: /选择设备/ }).waitFor({ state: 'visible', timeout: 15000 });
    return 'passed';
  } finally {
    await context.setOffline(false).catch(() => undefined);
    await context.close();
  }
}

/**
 * testWeakNetwork 在约 180 KiB/s, 250ms 延迟下加载首屏
 * @param browser Playwright 浏览器
 * @param port 本地静态服务端口
 */
async function testWeakNetwork(browser, port) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  try {
    const client = await context.newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 250,
      downloadThroughput: 180 * 1024,
      uploadThroughput: 60 * 1024,
      connectionType: 'cellular3g',
    });
    const started = Date.now();
    await page.goto(`http://127.0.0.1:${port}/#/connect`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.getByRole('button', { name: /选择设备/ }).waitFor({ state: 'visible', timeout: 25000 });
    assert.ok((await page.evaluate(() => document.body.innerText)).includes('设备'), 'weak-network: 首屏没有渲染');
    return Date.now() - started;
  } finally {
    await context.close();
  }
}

/** validate 对单个视口执行宽度, 高度, 导航和触控尺寸断言 */
function validate(item, metrics) {
  const { width, height, touch } = item;
  const visible = Boolean(metrics.button && metrics.button.width > 0);
  assert.ok(metrics.scrollWidth <= metrics.innerWidth + 1, `${item.label}: document 横向溢出`);
  assert.ok(metrics.bodyScrollWidth <= metrics.innerWidth + 1, `${item.label}: body 横向溢出`);
  assert.ok(metrics.main, `${item.label}: 缺少主内容`);
  assert.ok(metrics.card, `${item.label}: 缺少设备卡片`);
  assert.ok(metrics.header, `${item.label}: 缺少页头`);
  assert.ok(metrics.main.right <= metrics.innerWidth + 1, `${item.label}: 主内容超出右边界`);
  assert.ok(metrics.card.right <= metrics.innerWidth + 1, `${item.label}: 卡片超出右边界`);
  assert.ok(metrics.header.right <= metrics.innerWidth + 1, `${item.label}: 页头超出右边界`);
  assert.ok(metrics.scrollHeight >= metrics.innerHeight, `${item.label}: 页面高度没有铺满视口`);
  assert.ok(metrics.header.bottom <= metrics.main.y + 1, `${item.label}: 页头与主内容重叠`);
  assert.ok(metrics.h1.y >= metrics.header.y - 1, `${item.label}: 标题超出页头`);
  assert.ok(metrics.h1.bottom <= metrics.header.bottom + 1, `${item.label}: 标题超出页头`);
  assert.ok(visible, `${item.label}: 主操作不可见`);
  assert.ok(metrics.button.right <= metrics.innerWidth + 1, `${item.label}: 主操作超出右边界`);
  assert.ok(metrics.button.height >= (touch ? 44 : 36) - 0.5, `${item.label}: 主操作高度不足`);

  if (width > 960) {
    assert.notEqual(metrics.sidebar?.display, 'none', `${item.label}: 桌面侧栏被隐藏`);
    assert.equal(metrics.mobileNav?.display, 'none', `${item.label}: 桌面出现移动导航`);
    assert.ok(metrics.handle && metrics.handle.display !== 'none', `${item.label}: 缺少侧栏拖拽条`);
    assert.ok(metrics.sidebar.width >= 200 && metrics.sidebar.width <= 400, `${item.label}: 侧栏宽度越界`);
    assert.ok(metrics.main.x >= metrics.sidebar.width - 1, `${item.label}: 主内容没有避开侧栏`);
  } else {
    assert.equal(metrics.sidebar?.display, 'none', `${item.label}: 移动布局仍显示侧栏`);
    assert.notEqual(metrics.mobileNav?.display, 'none', `${item.label}: 缺少移动导航`);
    assert.ok(metrics.mobileLinks.length === 4, `${item.label}: 移动导航数量不是 4`);
    assert.ok(metrics.mobileLinks.every(link => link.height >= 44 - 0.5), `${item.label}: 移动导航触控高度不足`);
    assert.ok(metrics.main.x <= 1, `${item.label}: 移动内容没有贴齐左侧`);
  }

  const expectedContent = width >= 3200 ? 2600 : width >= 2560 ? 2200 : width >= 1920 ? 1600 : width >= 1280 ? 900 : width > 960 ? width - 356 : width - 40;
  assert.ok(metrics.main.width >= expectedContent, `${item.label}: 内容宽度没有随视口展开`);
  assert.ok(!metrics.bodyText.includes('数据只在本机处理'), `${item.label}: 仍显示隐私说明文案`);
  assert.ok(!metrics.bodyText.includes('连接检查清单'), `${item.label}: 仍显示静态检查清单`);
  assert.ok(!metrics.bodyText.includes('连接设备后显示型号'), `${item.label}: 仍显示空态说明文案`);
}

const chrome = findChrome();
if (!chrome) {
  console.error('viewport-check skipped: 未找到 Chrome, 设置 CHROME_PATH 后重试');
  process.exit(2);
}

const { server, port } = await startStaticServer();
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const results = [];
let failure;

try {
  for (const item of viewports) {
    const context = await browser.newContext({
      viewport: { width: item.width, height: item.height },
      deviceScaleFactor: 1,
      hasTouch: item.touch,
      isMobile: item.touch,
    });
    const page = await context.newPage();
    try {
      await page.goto(`http://127.0.0.1:${port}/#/connect`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /选择设备/ }).waitFor({ state: 'visible', timeout: 10000 });
      const metrics = await readMetrics(page);
      validate(item, metrics);
      results.push({
        ...item,
        status: 'passed',
        sidebar: metrics.sidebar?.display === 'none' ? 'hidden' : `${Math.round(metrics.sidebar.width)}px`,
        contentWidth: Math.round(metrics.main.width),
        headerHeight: Math.round(metrics.header.height),
      });
      console.log(`ok ${item.label} ${item.width}x${item.height} sidebar=${metrics.sidebar?.display === 'none' ? 'hidden' : 'visible'} content=${Math.round(metrics.main.width)} header=${Math.round(metrics.header.height)}`);
    } catch (error) {
      failure = error;
      results.push({ ...item, status: 'failed', error: error instanceof Error ? error.message : String(error) });
      console.error(`FAIL ${item.label}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await context.close();
    }
    if (failure) break;
  }
  if (!failure) {
    try {
      results.push({ label: 'offline reload', width: 390, height: 844, status: await testOffline(browser, port) });
      console.log('ok offline reload 390x844 service-worker');
      const elapsed = await testWeakNetwork(browser, port);
      results.push({ label: 'weak 3G', width: 390, height: 844, status: 'passed', elapsed });
      console.log(`ok weak 3G 390x844 ${elapsed}ms`);
    } catch (error) {
      failure = error;
      results.push({ label: 'network scenarios', status: 'failed', error: error instanceof Error ? error.message : String(error) });
      console.error(`FAIL network scenarios: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

await mkdir(fileURLToPath(new URL('../test-results/', import.meta.url)), { recursive: true });
await writeFile(fileURLToPath(new URL('../test-results/viewports.json', import.meta.url)), JSON.stringify(results, null, 2));
if (failure) process.exit(1);
console.log(`viewport-check passed: ${viewports.length} 个尺寸, offline + weak 3G`);