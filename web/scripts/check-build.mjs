/**
 * 职责: 校验生产构建没有 sourcemap, 已生成预压缩文件并在体积预算内
 * 导出: 退出码和体积统计
 * 依赖: Node.js fs
 * 约束: 只读取 web/dist, 预算按 gzip 后的 JS/CSS/HTML 总和计算
 * 作者: timecarol
 * 日期: 2026-11-15 23:10
 * 版本: v1.1
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const budget = 425 * 1024;
const entries = [];

/** walk 收集构建产物文件和大小 */
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    entries.push({ path, name: entry.name, size: (await stat(path)).size });
  }
}

await walk(root);
const maps = entries.filter(entry => extname(entry.name) === '.map');
if (maps.length > 0) {
  console.error(`build-check: 发现 sourcemap ${maps.length} 个`);
  process.exit(1);
}

const precompressed = entries.filter(entry => entry.name.endsWith('.gz') || entry.name.endsWith('.br'));
if (precompressed.length === 0) {
  console.error('build-check: 没有预压缩文件');
  process.exit(1);
}

const assets = entries.filter(entry => ['.js', '.css', '.html'].includes(extname(entry.name)));
const totalGzip = assets.reduce((sum, entry) => {
  const gzip = entries.find(candidate => candidate.path === `${entry.path}.gz`);
  return sum + (gzip?.size ?? entry.size);
}, 0);
if (totalGzip > budget) {
  console.error(`build-check: gzip 体积 ${Math.round(totalGzip / 1024)} KiB 超过 ${Math.round(budget / 1024)} KiB`);
  process.exit(1);
}

const manifest = JSON.parse(await readFile(join(root, 'sw-manifest.json'), 'utf8'));
if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
  console.error('build-check: service worker 清单为空');
  process.exit(1);
}
console.log(`build-check: ${assets.length} assets, gzip ${Math.round(totalGzip / 1024)} KiB, precompressed ${precompressed.length}, sw ${manifest.assets.length}`);