/**
 * 职责: 读取并解析已安装应用的包名和基础 APK 路径
 * 导出: parsePackageList, listPackages
 * 依赖: pm list packages -f
 * 约束: 只读取基础 APK, split APK 在 M1 通过 pm path 补充
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.2
 */
import type { Adb } from '@yume-chan/adb';
import type { PackageEntry } from './types';

/** parsePackageList 解析 pm list packages -f 的输出
 * @param output 原始 stdout, 每行格式为 package:/path/base.apk=com.example
 * @returns 按包名排序且去重的包列表
 */
export function parsePackageList(output: string): PackageEntry[] {
  const packages = new Map<string, string>();
  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('package:')) continue;
    const body = line.slice('package:'.length);
    const separator = body.lastIndexOf('=');
    if (separator <= 0) continue;
    const apkPath = body.slice(0, separator).trim();
    const packageName = body.slice(separator + 1).trim();
    if (apkPath && packageName) packages.set(packageName, apkPath);
  }
  return [...packages.entries()]
    .map(([packageName, apkPath]) => ({ packageName, apkPath }))
    .sort((left, right) => left.packageName.localeCompare(right.packageName));
}

/** listPackages 通过 ADB shell 读取设备上的基础 APK 清单
 * @param adb 已认证的 ADB 客户端
 * @returns 按包名排序的包列表
 */
export async function listPackages(adb: Adb): Promise<PackageEntry[]> {
  const output = await adb.subprocess.noneProtocol.spawnWaitText(['pm', 'list', 'packages', '-f']);
  return parsePackageList(output);
}