/**
 * 职责: 为构建产物生成 service worker 和预缓存清单
 * 导出: dist/sw.js, dist/sw-manifest.json
 * 依赖: Node.js crypto / fs
 * 约束: 只读取 dist/assets, 构建 ID 随资源名和大小变化
 * 作者: timecarol
 * 日期: 2026-11-15 23:10
 * 版本: v1.0
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const assets = [];

/** walk 收集所有静态资源 URL 和大小 */
async function walk(directory, prefix) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const url = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      await walk(path, url);
      continue;
    }
    const info = await stat(path);
    assets.push({ url, size: info.size });
  }
}

await walk(join(dist, 'assets'), '/assets');
assets.sort((left, right) => left.url.localeCompare(right.url));

const buildId = createHash('sha256')
  .update(JSON.stringify(assets))
  .digest('hex')
  .slice(0, 12);
const manifest = { buildId, assets: assets.map(asset => asset.url) };
const template = await readFile(new URL('../sw-template.js', import.meta.url), 'utf8');
await writeFile(join(dist, 'sw-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(join(dist, 'sw.js'), template.replaceAll('__BUILD_ID__', buildId));
console.log(`service worker: ${buildId}, ${manifest.assets.length} assets`);