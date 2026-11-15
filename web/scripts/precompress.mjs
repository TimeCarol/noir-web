/**
 * 职责: 为静态产物生成 gzip 和 brotli 预压缩文件
 * 导出: 退出码和压缩统计
 * 依赖: Node.js zlib
 * 约束: 只处理 web/dist, 不修改源文件, 小文件不压缩
 * 作者: timecarol
 * 日期: 2026-11-15 23:10
 * 版本: v1.0
 */
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const compressible = new Set(['.html', '.js', '.css', '.svg', '.json', '.txt', '.wasm']);
let originalBytes = 0;
let compressedBytes = 0;
let files = 0;

/** walk 递归处理构建产物, 跳过已经压缩的文件 */
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (!compressible.has(extname(entry.name))) continue;
    const source = await readFile(path);
    if (source.length < 1024) continue;
    const gzip = gzipSync(source, { level: 9 });
    const brotli = brotliCompressSync(source, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 11,
        [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
      },
    });
    await writeFile(`${path}.gz`, gzip);
    await writeFile(`${path}.br`, brotli);
    originalBytes += source.length;
    compressedBytes += Math.min(gzip.length, brotli.length);
    files += 1;
  }
}

await walk(root);
const ratio = originalBytes === 0 ? 0 : Math.round((compressedBytes / originalBytes) * 100);
console.log(`precompress: ${files} files, ${Math.round(originalBytes / 1024)} KiB -> ${Math.round(compressedBytes / 1024)} KiB (${ratio}%)`);