/**
 * 职责: 验证 AXML 解析和 Manifest 事实提取
 * 导出: 测试用例
 * 依赖: Vitest / 测试内生成的合成 AXML
 * 约束: 不提交真实设备 Manifest, fixture 由本文件按 AXML 格式生成
 * 作者: timecarol
 * 日期: 2026-11-16 00:25
 * 版本: v1.1
 */
import { describe, expect, it } from 'vitest';
import { parseAxml } from './axml';
import { analyzeManifest } from './manifest';

interface Attr {
  name: string;
  type: 'string' | 'int' | 'bool';
  value: string | number | boolean;
}

/** buildAxml 生成包含 manifest, application, uses-sdk 和组件的合成 AXML */
function buildAxml(): Uint8Array {
  const strings = [
    'manifest', 'package', 'com.example.audit',
    'uses-sdk', 'targetSdkVersion',
    'application', 'allowBackup', 'usesCleartextTraffic', 'debuggable', 'networkSecurityConfig',
    'activity', 'name', '.MainActivity', 'exported',
    'intent-filter', 'action', 'android.intent.action.MAIN',
    'service', '.SyncService', 'permission', 'com.example.permission.SYNC',
    'provider', '.Provider', 'authorities', 'com.example.audit.provider', 'enabled',
    'https://example.com/network_security_config',
  ];
  const index = new Map(strings.map((value, position) => [value, position]));
  const chunks: Uint8Array[] = [header(0x0003, 8, 8), stringPool(strings)];
  const start = (name: string, attrs: Attr[] = []) => chunks.push(startElement(index, name, attrs));
  const end = (name: string) => chunks.push(endElement(index, name));

  start('manifest', [{ name: 'package', type: 'string', value: 'com.example.audit' }]);
  start('uses-sdk', [{ name: 'targetSdkVersion', type: 'int', value: 34 }]);
  end('uses-sdk');
  start('application', [
    { name: 'allowBackup', type: 'bool', value: true },
    { name: 'usesCleartextTraffic', type: 'bool', value: false },
    { name: 'debuggable', type: 'bool', value: false },
    { name: 'networkSecurityConfig', type: 'string', value: 'https://example.com/network_security_config' },
  ]);
  start('activity', [{ name: 'name', type: 'string', value: '.MainActivity' }, { name: 'exported', type: 'bool', value: true }]);
  start('intent-filter');
  start('action', [{ name: 'name', type: 'string', value: 'android.intent.action.MAIN' }]);
  end('action');
  end('intent-filter');
  end('activity');
  start('service', [
    { name: 'name', type: 'string', value: '.SyncService' },
    { name: 'exported', type: 'bool', value: true },
    { name: 'permission', type: 'string', value: 'com.example.permission.SYNC' },
  ]);
  end('service');
  start('provider', [
    { name: 'name', type: 'string', value: '.Provider' },
    { name: 'exported', type: 'bool', value: true },
    { name: 'authorities', type: 'string', value: 'com.example.audit.provider' },
    { name: 'enabled', type: 'bool', value: false },
  ]);
  end('provider');
  end('application');
  end('manifest');

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  new DataView(output.buffer).setUint32(4, total, true);
  return output;
}

/** header 生成通用 chunk 头 */
function header(type: number, headerSize: number, size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, type, true);
  view.setUint16(2, headerSize, true);
  view.setUint32(4, size, true);
  return bytes;
}

/** stringPool 生成 UTF-8 字符串池 */
function stringPool(strings: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const data: number[] = [];
  const offsets: number[] = [];
  for (const value of strings) {
    offsets.push(data.length);
    const bytes = encoder.encode(value);
    data.push(value.length, bytes.length, ...bytes);
  }
  while (data.length % 4 !== 0) data.push(0);
  const startOffset = 28 + strings.length * 4;
  const size = startOffset + data.length;
  const bytes = header(0x0001, 28, size);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, strings.length, true);
  view.setUint32(16, 0x100, true);
  view.setUint32(20, startOffset, true);
  offsets.forEach((offset, position) => view.setUint32(28 + position * 4, offset, true));
  bytes.set(data, startOffset);
  return bytes;
}

/** startElement 生成带属性的开始标签 chunk */
function startElement(index: Map<string, number>, name: string, attrs: Attr[]): Uint8Array {
  const size = 36 + attrs.length * 20;
  const bytes = header(0x0102, 16, size);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 0xffffffff, true);
  view.setUint32(20, index.get(name)!, true);
  view.setUint16(24, 20, true);
  view.setUint16(26, 20, true);
  view.setUint16(28, attrs.length, true);
  attrs.forEach((attr, position) => {
    const offset = 36 + position * 20;
    view.setUint32(offset, 0xffffffff, true);
    view.setUint32(offset + 4, index.get(attr.name)!, true);
    view.setUint16(offset + 12, 8, true);
    view.setUint16(offset + 14, 0, true);
    if (attr.type === 'string') {
      const value = index.get(String(attr.value))!;
      view.setUint32(offset + 8, value, true);
      bytes[offset + 15] = 0x03;
      view.setUint32(offset + 16, value, true);
    } else if (attr.type === 'bool') {
      view.setUint32(offset + 8, 0xffffffff, true);
      bytes[offset + 15] = 0x12;
      view.setUint32(offset + 16, attr.value ? 1 : 0, true);
    } else {
      view.setUint32(offset + 8, 0xffffffff, true);
      bytes[offset + 15] = 0x10;
      view.setUint32(offset + 16, Number(attr.value), true);
    }
  });
  return bytes;
}

/** endElement 生成结束标签 chunk */
function endElement(index: Map<string, number>, name: string): Uint8Array {
  const bytes = header(0x0103, 16, 24);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 0xffffffff, true);
  view.setUint32(20, index.get(name)!, true);
  return bytes;
}

const manifest = buildAxml();

describe('parseAxml', () => {
  it('读取根元素, application 和组件层级', () => {
    const nodes = parseAxml(manifest);
    expect(nodes.length).toBeGreaterThan(5);
    expect(nodes[0]).toMatchObject({ name: 'manifest', depth: 0 });
    expect(nodes.some(node => node.name === 'application' && node.depth === 1)).toBe(true);
    expect(nodes.some(node => node.name === 'uses-sdk')).toBe(true);
    expect(nodes.some(node => node.name === 'activity' && node.depth === 2)).toBe(true);
  });

  it('断开的输入不会抛出异常', () => {
    expect(parseAxml(new Uint8Array([0x03, 0x00, 0x08, 0x00]))).toEqual([]);
    expect(parseAxml(manifest.subarray(0, 40))).toEqual([]);
  });
});

describe('analyzeManifest', () => {
  it('提取目标 SDK, 组件和 exported 状态', () => {
    const facts = analyzeManifest(manifest);
    expect(facts).not.toBeNull();
    expect(facts!.targetSdk).toBe('34');
    expect(facts!.components.map(component => component.kind)).toEqual(['activity', 'service', 'provider']);
    expect(facts!.allowBackup).toBe(true);
    expect(facts!.cleartext).toBe(false);
    expect(facts!.debuggable).toBe(false);
    expect(facts!.networkSecurityConfig).toBe(true);
    const exported = facts!.components.filter(component => component.exported && component.enabled && component.permission === null);
    expect(exported.map(component => component.kind)).toEqual(['activity']);
    expect(facts!.components.find(component => component.kind === 'service')?.permission).toBe('com.example.permission.SYNC');
  });
});
