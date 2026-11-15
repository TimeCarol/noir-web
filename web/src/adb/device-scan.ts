/**
 * 职责: 在设备端批量提取 APK 端点与 Manifest, 并提供无 unzip 时的远程 ZIP 回退
 * 导出: DeviceToolAvailability, ScanUrlsResult, scanDeviceUrls, scanRemoteUrls, readPackagePaths
 * 依赖: adb/shell / apk/dex / apk/manifest / apk/remote-zip
 * 约束: 快路径只传输 URL 和 base64 Manifest, 不传输 APK 主体
 * 作者: timecarol
 * 日期: 2026-11-15 23:50
 * 版本: v1.0
 */
// oxlint-disable no-await-in-loop -- ADB 命令和流式读取必须顺序执行
import type { PackageEntry } from './types';
import type { Shell } from './shell';
import { quote, listZipEntries, readZipEntry } from '../apk/remote-zip';
import { analyzeManifest, type ManifestFacts } from '../apk/manifest';
import { urlsFromDex, URL_LIMIT } from '../apk/dex';

/** DeviceToolAvailability 记录设备端快路径所需工具 */
export interface DeviceToolAvailability {
  unzip: boolean;
  strings: boolean;
  base64: boolean;
  fast: boolean;
}

/** ScanUrlsResult 汇总端点, Manifest 和失败包 */
export interface ScanUrlsResult {
  urls: Map<string, string[]>;
  manifests: Map<string, ManifestFacts>;
  failed: Set<string>;
}

/** ScanCallbacks 是逐包进度和取消信号 */
export interface ScanCallbacks {
  onProgress?: (done: number, total: number, packageName: string) => void;
  signal?: AbortSignal;
}

const BATCH_SIZE = 40;
const URL_CHARS = 'https?://[A-Za-z0-9._~:/?#@!&()*+,;=%-]+';

/** readPackagePaths 读取一个包的全部 APK 路径, 包含 split
 * @param shell 设备 shell
 * @param packageName 包名
 * @param fallback 基础 APK 路径
 * @returns 去重后的 APK 路径
 */
export async function readPackagePaths(shell: Shell, packageName: string, fallback: string): Promise<string[]> {
  try {
    const output = await shell.text(`pm path ${quote(packageName)}`);
    const paths = output
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('package:'))
      .map(line => line.slice('package:'.length).trim())
      .filter(Boolean);
    return paths.length > 0 ? [...new Set(paths)] : [fallback];
  } catch {
    return [fallback];
  }
}

/** detectDeviceTools 检查设备上的 unzip, strings 和 base64 */
export async function detectDeviceTools(shell: Shell): Promise<DeviceToolAvailability> {
  try {
    const output = await shell.text('which unzip strings base64 2>/dev/null');
    const lines = output.split('\n').map(line => line.trim()).filter(Boolean);
    const unzip = lines.some(line => line.endsWith('/unzip'));
    const strings = lines.some(line => line.endsWith('/strings'));
    const base64 = lines.some(line => line.endsWith('/base64'));
    return { unzip, strings, base64, fast: unzip && strings };
  } catch {
    return { unzip: false, strings: false, base64: false, fast: false };
  }
}

/** scanDeviceUrls 在设备端逐包执行 unzip, strings 和 base64
 * @param shell 设备 shell
 * @param targets 候选包和基础 APK 路径
 * @param callbacks 进度和取消
 * @returns 端点, Manifest 和失败包
 */
export async function scanDeviceUrls(
  shell: Shell,
  targets: readonly PackageEntry[],
  callbacks: ScanCallbacks = {},
): Promise<ScanUrlsResult> {
  const urls = new Map<string, string[]>();
  const manifests = new Map<string, ManifestFacts>();
  const failed = new Set<string>();
  if (targets.length === 0) return { urls, manifests, failed };

  const tools = await detectDeviceTools(shell);
  if (!tools.fast) {
    return scanRemoteUrls(shell, targets, callbacks);
  }

  let done = 0;
  for (let start = 0; start < targets.length; start += BATCH_SIZE) {
    callbacks.signal?.throwIfAborted();
    const batch = targets.slice(start, start + BATCH_SIZE);
    const seen = new Set<string>();
    const scripts = batch.map(target => packageScript(target, tools.base64));
    const command = scripts.join('\n');

    await shell.stream(command, line => {
      if (line.startsWith('M ')) {
        const body = line.slice(2);
        const separator = body.indexOf('|');
        if (separator <= 0) return;
        const pkg = body.slice(0, separator);
        const encoded = body.slice(separator + 1);
        const facts = decodeManifest(encoded);
        if (facts) manifests.set(pkg, facts);
        return;
      }
      if (line.startsWith('R ')) {
        const body = line.slice(2);
        const separator = body.indexOf('|');
        const pkg = separator < 0 ? body : body.slice(0, separator);
        const found = separator < 0 ? '' : body.slice(separator + 1);
        if (!pkg) return;
        seen.add(pkg);
        urls.set(pkg, found.split(/\s+/).filter(Boolean).slice(0, URL_LIMIT));
        return;
      }
      if (line.startsWith('F ')) {
        const pkg = line.slice(2).trim();
        if (pkg) {
          seen.add(pkg);
          failed.add(pkg);
        }
        return;
      }
      if (line.startsWith('P ')) {
        const pkg = line.slice(2).trim();
        if (pkg) {
          if (!seen.has(pkg) && !failed.has(pkg)) urls.set(pkg, []);
          done++;
          callbacks.onProgress?.(done, targets.length, pkg);
        }
        return;
      }
    }, callbacks.signal);

    for (const target of batch) {
      if (!seen.has(target.packageName) && !failed.has(target.packageName)) {
        failed.add(target.packageName);
      }
    }
  }

  return { urls, manifests, failed };
}

/** packageScript 生成单个包在设备端执行的 shell 片段 */
function packageScript(target: PackageEntry, base64: boolean): string {
  const pkg = target.packageName;
  const fallback = target.apkPath;
  const manifestPart = base64
    ? `if [ "$first" = 1 ]; then m=$(unzip -p "$apk" AndroidManifest.xml 2>/dev/null | base64 | tr -d '\\n'); if [ -n "$m" ]; then echo "M ${pkg}|$m"; first=0; fi; fi;`
    : '';
  return `p='${pkg}'; a=$(pm path "$p" 2>/dev/null | sed 's/^package://'); [ -z "$a" ] && a='${fallback}'; f=''; b=0; first=1; for apk in $a; do if ! unzip -l "$apk" >/dev/null 2>&1; then b=1; continue; fi; ${manifestPart} d=$(unzip -l "$apk" 2>/dev/null | sed -n 's/.* \\(classes[0-9]*\\.dex\\)[[:space:]]*$/\\1/p'); [ -z "$d" ] && d=classes.dex; u=$(unzip -p "$apk" $d 2>/dev/null | strings | grep -oE '${URL_CHARS}' | sort -u | head -${URL_LIMIT} | tr '\\n' ' '); [ -n "$u" ] && f="$f $u"; done; if [ "$b" = 1 ] && [ -z "$f" ]; then echo "F ${pkg}"; else echo "R ${pkg}|$f"; fi; echo "P ${pkg}"`;
}

/** decodeManifest 解码 base64 Manifest 并解析事实 */
function decodeManifest(encoded: string): ManifestFacts | null {
  try {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return analyzeManifest(bytes);
  } catch {
    return null;
  }
}

/** scanRemoteUrls 用 tail 和 head 读取 ZIP 中央目录, 不依赖设备 unzip
 * @param shell 设备 shell
 * @param targets 候选包和基础路径
 * @param callbacks 进度和取消
 * @returns 端点, Manifest 和失败包
 */
export async function scanRemoteUrls(
  shell: Shell,
  targets: readonly PackageEntry[],
  callbacks: ScanCallbacks = {},
): Promise<ScanUrlsResult> {
  const urls = new Map<string, string[]>();
  const manifests = new Map<string, ManifestFacts>();
  const failed = new Set<string>();

  for (let index = 0; index < targets.length; index++) {
    callbacks.signal?.throwIfAborted();
    const target = targets[index];
    const paths = await readPackagePaths(shell, target.packageName, target.apkPath);
    const found = new Set<string>();
    let complete = true;

    for (const path of paths) {
      try {
        const entries = await listZipEntries(shell, path);
        if (entries.length === 0) {
          complete = false;
          continue;
        }
        const manifestEntry = entries.find(entry => entry.name === 'AndroidManifest.xml');
        if (manifestEntry && !manifests.has(target.packageName)) {
          const bytes = await readZipEntry(shell, path, manifestEntry);
          if (bytes) {
            const facts = analyzeManifest(bytes);
            if (facts) manifests.set(target.packageName, facts);
          }
        }
        const dexEntries = entries
          .filter(entry => /^classes\d*\.dex$/.test(entry.name))
          .sort((left, right) => left.name.localeCompare(right.name));
        for (const entry of dexEntries) {
          const bytes = await readZipEntry(shell, path, entry);
          if (!bytes) {
            complete = false;
            continue;
          }
          for (const url of urlsFromDex([bytes], URL_LIMIT)) found.add(url);
        }
      } catch {
        complete = false;
      }
    }

    if (complete) urls.set(target.packageName, [...found]);
    else failed.add(target.packageName);
    callbacks.onProgress?.(index + 1, targets.length, target.packageName);
  }

  return { urls, manifests, failed };
}