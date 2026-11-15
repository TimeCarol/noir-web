/**
 * 职责: 检查 Ant Design 6 已废弃属性没有重新出现在页面代码里
 * 导出: 退出码
 * 依赖: Node.js fs
 * 约束: 只扫描 web/src 的 TSX 标签, 不解析注释里的示例
 * 作者: timecarol
 * 日期: 2026-11-15 23:20
 * 版本: v1.0
 */
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../web/src/', import.meta.url));
const checks = [
  { pattern: /<Alert[^>]*\bmessage\s*=/, message: 'Alert 使用 title, 不使用 message' },
  { pattern: /<Alert[^>]*\bonClose\s*=/, message: 'Alert 使用 closable, 不使用 onClose' },
  { pattern: /<Steps[^>]*\bdescription\s*=/, message: 'Steps items 使用 content, 不使用 description' },
  { pattern: /<Button[^>]*\biconPosition\s*=/, message: 'Button 使用 iconPlacement, 不使用 iconPosition' },
  { pattern: /<Card[^>]*\bbordered\s*=/, message: 'Card 使用 variant, 不使用 bordered' },
  { pattern: /<Input[^>]*\bbordered\s*=/, message: 'Input 使用 variant, 不使用 bordered' },
];
const failures = [];

/** walk 扫描所有 TSX 源文件 */
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (extname(entry.name) !== '.tsx') continue;
    const source = await readFile(path, 'utf8');
    for (const check of checks) {
      if (check.pattern.test(source)) failures.push(`${path}: ${check.message}`);
    }
  }
}

await walk(root);
if (failures.length > 0) {
  console.error('Ant Design 用法检查失败:');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log('Ant Design usage check passed');