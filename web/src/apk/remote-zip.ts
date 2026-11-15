/**
 * 职责: 通过 ADB shell 读取设备上 ZIP 的中央目录和指定条目
 * 导出: RemoteZipEntry, listZipEntries, readZipEntry
 * 依赖: ADB shell / DecompressionStream
 * 约束: 只使用 tail 和 head 读取必要区间, 不把整个 APK 拉回浏览器
 * 作者: timecarol
 * 日期: 2026-11-15 23:50
 * 版本: v1.1
 */
// oxlint-disable no-await-in-loop -- 解压流必须按块顺序读取
import type { Shell } from '../adb/shell';

/** RemoteZipEntry 是 ZIP 中央目录中的一条记录 */
export interface RemoteZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
}

const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const TAIL_BYTES = 65_536;
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;

/** listZipEntries 读取 ZIP 中央目录
 * @param shell 设备 shell 适配器
 * @param path 设备上的 APK 路径
 * @returns 中央目录条目
 */
export async function listZipEntries(shell: Shell, path: string): Promise<RemoteZipEntry[]> {
  const size = await fileSize(shell, path);
  if (size < 22) return [];
  const tailLength = Math.min(size, TAIL_BYTES);
  const tail = await readRange(shell, path, size - tailLength, tailLength);
  const eocd = findEocd(tail);
  if (!eocd) return [];

  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (centralSize <= 0 || centralOffset + centralSize > size) return [];

  const directory = centralOffset >= size - tail.length
    ? tail.subarray(centralOffset - (size - tail.length), centralOffset - (size - tail.length) + centralSize)
    : await readRange(shell, path, centralOffset, centralSize);
  return parseCentralDirectory(directory);
}

/** readZipEntry 读取并解压一个 ZIP 条目
 * @param shell 设备 shell 适配器
 * @param path 设备上的 APK 路径
 * @param entry 中央目录条目
 * @returns 解压后的字节, 条目无效或压缩方法不支持时返回 null
 */
export async function readZipEntry(shell: Shell, path: string, entry: RemoteZipEntry): Promise<Uint8Array | null> {
  if (entry.uncompressedSize > MAX_ENTRY_BYTES || entry.compressedSize > MAX_ENTRY_BYTES) return null;
  const header = await readRange(shell, path, entry.localOffset, 30);
  if (header.length < 30) return null;
  const headerView = new DataView(header.buffer, header.byteOffset, header.byteLength);
  if (headerView.getUint32(0, true) !== LOCAL_SIGNATURE) return null;
  const nameLength = headerView.getUint16(26, true);
  const extraLength = headerView.getUint16(28, true);
  const dataOffset = entry.localOffset + 30 + nameLength + extraLength;
  const compressed = await readRange(shell, path, dataOffset, entry.compressedSize);
  if (compressed.length !== entry.compressedSize) return null;
  if (entry.method === 0) return compressed;
  if (entry.method !== 8) return null;
  return inflateRaw(compressed);
}

/** inflateRaw 使用浏览器原生 DecompressionStream 解压 raw deflate
 * @param bytes ZIP 条目的压缩数据
 * @returns 解压后的字节, 当前浏览器不支持时返回 null
 */
async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    const stream = new DecompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    const input = new Uint8Array(bytes.length);
    input.set(bytes);
    await writer.write(input);
    await writer.close();
    const reader = stream.readable.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      length += value.length;
    }
    const output = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }
    return output;
  } catch {
    return null;
  }
}

/** findEocd 从尾部向前寻找 End Of Central Directory 记录 */
function findEocd(tail: Uint8Array): number | null {
  for (let offset = tail.length - 22; offset >= 0 && offset >= tail.length - 22 - 65_535; offset--) {
    if (tail[offset] === 0x50 && tail[offset + 1] === 0x4b && tail[offset + 2] === 0x05 && tail[offset + 3] === 0x06) {
      return offset;
    }
  }
  return null;
}

/** parseCentralDirectory 解析连续存放的中央目录记录 */
function parseCentralDirectory(bytes: Uint8Array): RemoteZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries: RemoteZipEntry[] = [];
  let offset = 0;
  while (offset + 46 <= bytes.length && view.getUint32(offset, true) === CENTRAL_SIGNATURE) {
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    if (offset + 46 + nameLength + extraLength + commentLength > bytes.length) break;
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    entries.push({ name, method, compressedSize, uncompressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** fileSize 读取设备文件大小 */
async function fileSize(shell: Shell, path: string): Promise<number> {
  const output = await shell.text(`wc -c < ${quote(path)}`);
  const value = Number.parseInt(output.trim(), 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** readRange 使用 tail 和 head 读取设备文件的一个字节区间 */
async function readRange(shell: Shell, path: string, offset: number, length: number): Promise<Uint8Array> {
  if (length <= 0 || offset < 0) return new Uint8Array();
  const output = await shell.exec(`tail -c +${offset + 1} ${quote(path)} | head -c ${length}`);
  return output;
}

/** quote 对设备路径做单引号安全转义 */
export function quote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}