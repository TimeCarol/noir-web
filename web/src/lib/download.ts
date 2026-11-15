/**
 * 职责: 在浏览器中触发下载文本文件
 * 导出: downloadText
 * 依赖: Blob / URL / DOM
 * 约束: 下载后立即释放对象 URL, 不在页面保留临时节点
 * 作者: timecarol
 * 日期: 2026-11-15 23:55
 * 版本: v1.0
 */

/** downloadText 以指定 MIME 类型下载 UTF-8 文本
 * @param content 文件内容
 * @param filename 下载文件名
 * @param mime MIME 类型
 */
export function downloadText(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}