/**
 * 职责: 验证 DEX URL 提取的上限, 去重和截断规则
 * 导出: 测试用例
 * 依赖: Vitest
 * 约束: 使用合成 ASCII 字节, 不读取真实 APK
 * 作者: timecarol
 * 日期: 2026-11-15 23:55
 * 版本: v1.0
 */
import { describe, expect, it } from 'vitest';
import { urlsFromDex } from './dex';

describe('urlsFromDex', () => {
  it('提取完整 URL 并去重', () => {
    const text = [
      'https://collect.example.com/report?device=1',
      'https://collect.example.com/report?device=1',
      'http://ads.example.net/track',
      'not-a-url',
      'https://api.example.org/v1/ping',
    ].join('\u0000');
    const urls = urlsFromDex([new TextEncoder().encode(text)]);
    expect(urls).toEqual([
      'https://collect.example.com/report?device=1',
      'http://ads.example.net/track',
      'https://api.example.org/v1/ping',
    ]);
  });

  it('遵守单次端点上限', () => {
    const text = Array.from({ length: 10 }, (_, index) => `https://host${index}.example.com/report`).join('\u0000');
    const urls = urlsFromDex([new TextEncoder().encode(text)], 3);
    expect(urls).toHaveLength(3);
  });

  it('没有 URL 时返回空列表', () => {
    expect(urlsFromDex([new TextEncoder().encode('plain dex strings')])).toEqual([]);
  });
});