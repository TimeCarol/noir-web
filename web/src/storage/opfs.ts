/**
 * 职责: 统一封装 Origin Private File System 的读写, 目录和文件枚举
 * 导出: opfsAvailable, serialSegment, readJson, writeJson, readBytes, writeBytes, removeFile
 * 依赖: File System Access API
 * 约束: OPFS 不可用时返回空结果或 false, 不阻断设备扫描
 * 作者: timecarol
 * 日期: 2026-11-16 01:10
 * 版本: v1.1
 */
// oxlint-disable no-await-in-loop -- 目录必须逐级解析
const ROOT = 'noir';
let persistenceRequested = false;

/** opfsAvailable 判断当前安全上下文是否支持 OPFS */
export function opfsAvailable(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.storage?.getDirectory);
}

/** serialSegment 将设备序列号转换为安全的单路径段 */
export function serialSegment(serial: string): string {
  return encodeURIComponent(serial.trim() || 'unknown');
}

/** rootDirectory 获取 noir 根目录
 * @param create 是否创建缺失目录
 * @returns 根目录, OPFS 不可用时返回 null
 */
async function rootDirectory(create: boolean): Promise<FileSystemDirectoryHandle | null> {
  if (!opfsAvailable()) return null;
  try {
    if (create && !persistenceRequested && navigator.storage.persist) {
      persistenceRequested = true;
      await navigator.storage.persist().catch(() => false);
    }
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(ROOT, { create });
  } catch {
    return null;
  }
}

/** directoryFor 逐级解析目录, 最后一段不创建文件 */
async function directoryFor(segments: readonly string[], create: boolean): Promise<FileSystemDirectoryHandle | null> {
  let directory = await rootDirectory(create);
  if (!directory) return null;
  for (const segment of segments) {
    try {
      directory = await directory.getDirectoryHandle(segment, { create });
    } catch {
      return null;
    }
  }
  return directory;
}

/** readJson 读取 JSON 文件
 * @param segments 从 noir 根目录开始的目录和文件名
 * @returns 解析后的值, 不存在或不可读时返回 null
 */
export async function readJson<T>(segments: readonly string[]): Promise<T | null> {
  if (segments.length === 0) return null;
  const directory = await directoryFor(segments.slice(0, -1), false);
  if (!directory) return null;
  try {
    const handle = await directory.getFileHandle(segments[segments.length - 1]);
    const text = await (await handle.getFile()).text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** writeJson 写入 JSON 文件
 * @param segments 从 noir 根目录开始的目录和文件名
 * @param value 可序列化的值
 * @returns 写入成功返回 true
 */
export async function writeJson(segments: readonly string[], value: unknown): Promise<boolean> {
  if (segments.length === 0) return false;
  const directory = await directoryFor(segments.slice(0, -1), true);
  if (!directory) return false;
  let writable: FileSystemWritableFileStream | null = null;
  try {
    const handle = await directory.getFileHandle(segments[segments.length - 1], { create: true });
    writable = await handle.createWritable();
    await writable.write(JSON.stringify(value));
    await writable.close();
    return true;
  } catch {
    await writable?.abort().catch(() => undefined);
    return false;
  }
}

/** readBytes 读取二进制文件
 * @param segments 从 noir 根目录开始的目录和文件名
 * @returns 文件内容, 不存在或不可读时返回 null
 */
export async function readBytes(segments: readonly string[]): Promise<Uint8Array | null> {
  if (segments.length === 0) return null;
  const directory = await directoryFor(segments.slice(0, -1), false);
  if (!directory) return null;
  try {
    const handle = await directory.getFileHandle(segments[segments.length - 1]);
    return new Uint8Array(await (await handle.getFile()).arrayBuffer());
  } catch {
    return null;
  }
}

/** writeBytes 写入二进制文件
 * @param segments 从 noir 根目录开始的目录和文件名
 * @param value 文件内容
 * @returns 写入成功返回 true
 */
export async function writeBytes(segments: readonly string[], value: Uint8Array): Promise<boolean> {
  if (segments.length === 0) return false;
  const directory = await directoryFor(segments.slice(0, -1), true);
  if (!directory) return false;
  let writable: FileSystemWritableFileStream | null = null;
  try {
    const handle = await directory.getFileHandle(segments[segments.length - 1], { create: true });
    writable = await handle.createWritable();
    const buffer = new Uint8Array(value.length);
    buffer.set(value);
    await writable.write(buffer);
    await writable.close();
    return true;
  } catch {
    await writable?.abort().catch(() => undefined);
    return false;
  }
}

/** removeFile 删除文件, 不存在时返回 false
 * @param segments 从 noir 根目录开始的目录和文件名
 * @returns 删除成功返回 true
 */
export async function removeFile(segments: readonly string[]): Promise<boolean> {
  if (segments.length === 0) return false;
  const directory = await directoryFor(segments.slice(0, -1), false);
  if (!directory) return false;
  try {
    await directory.removeEntry(segments[segments.length - 1]);
    return true;
  } catch {
    return false;
  }
}
