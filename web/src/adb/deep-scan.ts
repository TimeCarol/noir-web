/**
 * 职责: 对高风险应用按需执行 DEX 字符串级 DeepScan
 * 导出: DeepScanProgress, deepScanApps
 * 依赖: adb/shell / apk/dex / core/models
 * 约束: 只读设备 APK, 不执行代码, 只提取固定字符串信号
 * 作者: timecarol
 * 日期: 2026-11-16 10:35
 * 版本: v1.0
 */
// oxlint-disable no-await-in-loop -- 设备端 APK 扫描必须顺序执行
import type { AppEntry } from '../core/models';
import { DEX_SIGNAL_TERMS, signalsFromTokens } from '../apk/dex';
import { quote } from '../apk/remote-zip';
import { isShellInterruption, type Shell } from './shell';

/** DeepScanProgress 是逐应用进度 */
export interface DeepScanProgress {
  done: number;
  total: number;
  packageName: string;
}

/** DeepScanOptions 控制进度和取消 */
export interface DeepScanOptions {
  onProgress?: (progress: DeepScanProgress) => void;
  signal?: AbortSignal;
}

/** deepScanApps 只读扫描指定应用的全部 APK
 * @param shell 设备 shell
 * @param apps 目标应用, 通常按风险分降序取前 N 个
 * @returns 包名到 signal key 的映射, 空数组表示已扫描但没有信号
 */
export async function deepScanApps(shell: Shell, apps: readonly AppEntry[], options: DeepScanOptions = {}): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  const signalGrep = DEX_SIGNAL_TERMS.map(term => `-e ${quote(term)}`).join(' ');
  for (let index = 0; index < apps.length; index++) {
    options.signal?.throwIfAborted();
    const app = apps[index];
    try {
      const paths = await readApkPaths(shell, app);
      if (paths.length === 0) {
        result.set(app.pkg, []);
      } else {
        const command = `for apk in ${paths.map(quote).join(' ')}; do unzip -p "$apk" 'classes*.dex' 2>/dev/null | strings | grep -oF ${signalGrep} | sort -u | head -128; done`;
        const output = await shell.text(command);
        result.set(app.pkg, signalsFromTokens(output.split(/\s+/).filter(Boolean)));
      }
    } catch (error) {
      if (isShellInterruption(error)) throw error;
      result.set(app.pkg, []);
    }
    options.onProgress?.({ done: index + 1, total: apps.length, packageName: app.pkg });
  }
  return result;
}

/** readApkPaths 读取包的 base 和 split APK 路径 */
async function readApkPaths(shell: Shell, app: AppEntry): Promise<string[]> {
  const output = await shell.text(`pm path ${quote(app.pkg)}`);
  const paths = output
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('package:'))
    .map(line => line.slice('package:'.length).trim())
    .filter(Boolean);
  return paths.length > 0 ? paths : app.apkPaths;
}