/**
 * 职责: 将内置 NOIR 标记按当前 Radix 主题着色
 * 导出: createBrandIcon
 * 依赖: SVG 原稿 / Radix palette
 * 约束: 只处理内置资源, favicon 与页面标记共用同一 URL
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.0
 */
import { whiteA } from '@radix-ui/colors';
import artwork from '../assets/noir.svg?raw';
import { palette } from './theme';

/** createBrandIcon 返回适配当前主题的 SVG 数据 URL
 * @param dark 当前解析后的深色主题
 * @returns 可同时用于 favicon 和页面标记的内置 SVG
 */
export function createBrandIcon(dark: boolean): string {
  const { iris, cyan, amber } = palette(dark);
  const colors = `--icon-start:${dark ? iris.iris8 : iris.iris9};--icon-end:${dark ? cyan.cyan8 : cyan.cyan9};--icon-glow:${amber.amber9};--icon-ink:${dark ? iris.iris12 : whiteA.whiteA12}`;
  return `data:image/svg+xml,${encodeURIComponent(artwork.replace('<svg ', `<svg style="${colors}" `))}`;
}