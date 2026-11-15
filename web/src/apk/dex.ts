/**
 * 职责: 从 DEX 字节中提取 HTTP(S) 端点字符串
 * 导出: URL_LIMIT, urlsFromDex
 * 依赖: 无
 * 约束: 只扫描可打印 ASCII 串, 保留 NOIR 的 URL 字符集和单次上限
 * 作者: timecarol
 * 日期: 2026-11-15 23:50
 * 版本: v1.0
 */

/** URL_LIMIT 是每个应用保留的端点数上限, 避免异常 DEX 撑爆报告 */
export const URL_LIMIT = 1000;

const URL_PATTERN = /https?:\/\/[A-Za-z0-9._~:/?#@!&()*+,;=%-]{4,300}/;

/** urlsFromDex 扫描一个或多个 DEX 字节, 按出现顺序去重
 * @param chunks 每个 DEX 文件的原始字节
 * @param limit 保留的端点上限
 * @returns 去重后的 URL 列表
 */
export function urlsFromDex(chunks: readonly Uint8Array[], limit = URL_LIMIT): string[] {
  const found = new Set<string>();
  for (const bytes of chunks) {
    if (found.size >= limit) break;
    scanChunk(bytes, found, limit);
  }
  return [...found];
}

/** scanChunk 从 h 字节开始收集连续可打印串, 交给 URL 正则过滤 */
function scanChunk(bytes: Uint8Array, found: Set<string>, limit: number): void {
  let index = 0;
  while (index < bytes.length - 8 && found.size < limit) {
    if (bytes[index] !== 0x68) {
      index++;
      continue;
    }
    let end = index;
    while (end < bytes.length && end - index < 320) {
      const value = bytes[end];
      if (value <= 32 || value >= 127) break;
      end++;
    }
    if (end - index > 8) {
      const text = new TextDecoder('ascii').decode(bytes.subarray(index, end));
      if (text.startsWith('http://') || text.startsWith('https://')) {
        const match = URL_PATTERN.exec(text);
        if (match) found.add(match[0]);
      }
    }
    index = end > index ? end : index + 1;
  }
}