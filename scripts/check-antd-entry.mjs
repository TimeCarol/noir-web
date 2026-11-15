/**
 * 职责: 检查前端只从允许的 Ant Design 入口导入
 * 导出: 退出码
 * 依赖: Node.js fs / path / url
 * 约束: 只检查静态 module specifier, 不分析注释或字符串
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.1
 */
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../web/src/', import.meta.url));
const sourceExtensions = new Set(['.ts', '.tsx']);
const importPatterns = [/from\s+['"]([^'"]+)['"]/g, /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g];
const failures = [];

/** collect 递归收集需要检查的 TypeScript 源文件 */
function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      collect(path);
    } else if (sourceExtensions.has(extname(entry.name))) {
      inspect(path);
    }
  }
}

/** inspect 读取单个文件中的静态导入并记录禁用入口 */
function inspect(path) {
  const source = readFileSync(path, 'utf8');
  for (const pattern of importPatterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (isForbidden(specifier)) failures.push(`${path}: ${specifier}`);
    }
  }
}

/** isForbidden 判断说明符是否绕过允许的 Ant Design 入口 */
function isForbidden(specifier) {
  if (specifier === 'antd') return false;
  if (specifier.startsWith('antd/locale/')) return false;
  if (specifier === '@ant-design/icons' || specifier.startsWith('@ant-design/icons/')) return false;
  return specifier.startsWith('antd/es/')
    || specifier.startsWith('antd/lib/')
    || specifier.startsWith('@ant-design/pro-');
}

collect(root);
if (failures.length > 0) {
  console.error('发现禁用的 Ant Design 导入:');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log('Ant Design import check passed');