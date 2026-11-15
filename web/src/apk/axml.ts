/**
 * 职责: 解析 Android 二进制 XML (AXML) 的元素, 属性和层级
 * 导出: AxmlNode, parseAxml
 * 依赖: 无
 * 约束: 只实现 Manifest 审计需要的节点和属性, 遇到损坏块时返回已解析部分
 * 作者: timecarol
 * 日期: 2026-11-15 23:50
 * 版本: v1.0
 */

/** AxmlNode 是一个已解析的 XML 元素, depth 从根元素 0 开始 */
export interface AxmlNode {
  name: string;
  attrs: Map<string, string | null>;
  depth: number;
}

const CHUNK_STRING_POOL = 0x0001;
const CHUNK_START_ELEMENT = 0x0102;
const CHUNK_END_ELEMENT = 0x0103;
const TYPE_STRING = 0x03;
const TYPE_INT_DEC = 0x10;
const TYPE_INT_HEX = 0x11;
const TYPE_INT_BOOLEAN = 0x12;

/** parseAxml 顺序读取 AXML 块, 忽略资源映射等与 Manifest 事实无关的块
 * @param bytes APK 中的 AndroidManifest.xml 原始字节
 * @returns 按文档顺序排列的元素列表
 */
export function parseAxml(bytes: Uint8Array): AxmlNode[] {
  if (bytes.length < 8) return [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let strings: string[] = [];
  const nodes: AxmlNode[] = [];
  let depth = 0;
  let offset = 8;

  while (offset + 8 <= bytes.length) {
    const type = u16(view, offset);
    const headerSize = u16(view, offset + 2);
    const size = u32(view, offset + 4);
    if (size < 8 || offset + size > bytes.length) break;

    if (type === CHUNK_STRING_POOL) {
      strings = readStringPool(view, bytes, offset);
    } else if (type === CHUNK_START_ELEMENT) {
      const node = readStartElement(view, bytes, offset, headerSize, strings, depth);
      if (node) nodes.push(node);
      depth++;
    } else if (type === CHUNK_END_ELEMENT && depth > 0) {
      depth--;
    }

    offset += size;
  }

  return nodes;
}

/** readStartElement 读取元素名, 属性名和类型化属性值 */
function readStartElement(
  view: DataView,
  bytes: Uint8Array,
  offset: number,
  headerSize: number,
  strings: readonly string[],
  depth: number,
): AxmlNode | null {
  if (offset + 36 > bytes.length) return null;
  const nameIndex = u32(view, offset + 20);
  const attrStart = u16(view, offset + 24);
  const attrSize = u16(view, offset + 26);
  const attrCount = u16(view, offset + 28);
  if (attrSize < 20) return null;

  const attrs = new Map<string, string | null>();
  let attr = offset + headerSize + attrStart;
  for (let index = 0; index < attrCount; index++) {
    if (attr + 20 > bytes.length) break;
    const attrName = u32(view, attr + 4);
    const rawValue = u32(view, attr + 8);
    const dataType = bytes[attr + 15];
    const data = u32(view, attr + 16);
    const key = strings[attrName] ?? '';
    if (key) {
      attrs.set(key, attributeValue(dataType, data, rawValue, strings));
    }
    attr += attrSize;
  }

  return { name: strings[nameIndex] ?? '', attrs, depth };
}

/** attributeValue 将 AXML 数据类型映射为字符串, 与 NOIR 的解析结果保持一致 */
function attributeValue(dataType: number, data: number, rawValue: number, strings: readonly string[]): string | null {
  if (dataType === TYPE_STRING) return strings[data] ?? null;
  if (dataType === TYPE_INT_BOOLEAN) return data !== 0 ? 'true' : 'false';
  if (dataType === TYPE_INT_DEC || dataType === TYPE_INT_HEX) return String(data >>> 0);
  return rawValue < strings.length ? strings[rawValue] : null;
}

/** readStringPool 读取 UTF-8 或 UTF-16 字符串池, 容错空池和越界索引 */
function readStringPool(view: DataView, bytes: Uint8Array, offset: number): string[] {
  if (offset + 28 > bytes.length) return [];
  const count = u32(view, offset + 8);
  const flags = u32(view, offset + 16);
  const stringsRelative = u32(view, offset + 20);
  const stringsStart = offset + stringsRelative;
  const utf8 = (flags & 0x100) !== 0;
  if (count <= 0 || count > 1_000_000) return [];
  if (stringsStart < offset || stringsStart > bytes.length) return [];
  if (offset + 28 + count * 4 > bytes.length) return [];

  const result: string[] = [];
  for (let index = 0; index < count; index++) {
    const relative = u32(view, offset + 28 + index * 4);
    const entry = stringsStart + relative;
    if (entry < 0 || entry >= bytes.length) {
      result.push('');
      continue;
    }
    result.push(utf8 ? readUtf8(bytes, entry) : readUtf16(view, bytes, entry));
  }
  return result;
}

/** readUtf8 读取带可变长度前缀的 UTF-8 字符串 */
function readUtf8(bytes: Uint8Array, start: number): string {
  let position = start;
  if (position + 2 > bytes.length) return '';
  let skip = bytes[position++];
  if (skip & 0x80) {
    if (position >= bytes.length) return '';
    skip = ((skip & 0x7f) << 8) | bytes[position++];
  }
  void skip;
  let length = bytes[position++];
  if (length & 0x80) {
    if (position >= bytes.length) return '';
    length = ((length & 0x7f) << 8) | bytes[position++];
  }
  if (length < 0 || position + length > bytes.length) return '';
  return new TextDecoder().decode(bytes.subarray(position, position + length));
}

/** readUtf16 读取带可变长度前缀的 UTF-16LE 字符串 */
function readUtf16(view: DataView, bytes: Uint8Array, start: number): string {
  let position = start;
  if (position + 2 > bytes.length) return '';
  let length = u16(view, position);
  position += 2;
  if (length & 0x8000) {
    if (position + 2 > bytes.length) return '';
    length = ((length & 0x7fff) << 16) | u16(view, position);
    position += 2;
  }
  const byteLength = length * 2;
  if (byteLength < 0 || position + byteLength > bytes.length) return '';
  return new TextDecoder('utf-16le').decode(bytes.subarray(position, position + byteLength));
}

/** u16 读取小端 16 位无符号整数, 越界返回 0 */
function u16(view: DataView, offset: number): number {
  return offset >= 0 && offset + 2 <= view.byteLength ? view.getUint16(offset, true) : 0;
}

/** u32 读取小端 32 位无符号整数, 越界返回 0 */
function u32(view: DataView, offset: number): number {
  return offset >= 0 && offset + 4 <= view.byteLength ? view.getUint32(offset, true) : 0;
}