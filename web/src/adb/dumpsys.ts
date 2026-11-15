/**
 * 职责: 流式解析 dumpsys package 的包元数据, 权限和共享 UID 段
 * 导出: PkgMeta, DumpsysParser, isSystemMeta, isDebuggableMeta, parseDumpsys
 * 依赖: 无
 * 约束: 合并重复包块, 共享 UID 权限只并入声明该 sharedUser 的包
 * 作者: timecarol
 * 日期: 2026-11-16 00:15
 * 版本: v1.2
 */

/** PkgMeta 是单个包的 dumpsys 事实, 权限名不带 android.permission. 前缀 */
export interface PkgMeta {
  flags: string;
  appId: string;
  installer: string | null;
  permissions: Set<string>;
  sharedUser: string | null;
}

/** isSystemMeta 判断包是否位于 system 分区 */
export function isSystemMeta(meta: PkgMeta): boolean {
  return meta.flags.includes('SYSTEM');
}

/** isDebuggableMeta 判断包是否声明 android:debuggable */
export function isDebuggableMeta(meta: PkgMeta): boolean {
  return meta.flags.includes('DEBUGGABLE');
}

const PKG = /^\s*Package\s*\[([^\]]+)]/;
const SHARED_USER = /^sharedUser=SharedUserSetting\{[^\s]+ ([^/]+)\//;
const SHARED = /^\s*SharedUser\s*\[([^\]]+)]/;
const PKG_SETTING = /^PackageSetting\{[^\s]+ ([^/]+)\//;
const GRANTED = /^android\.permission\.([A-Z0-9_]+): granted=true(?:[,;].*)?$/;

interface MutableMeta {
  flags: string;
  appId: string;
  installer: string | null;
  permissions: Set<string>;
  sharedUser: string | null;
}

/** DumpsysParser 逐行累积包和共享 UID 段, 不保留完整 dumpsys 文本 */
export class DumpsysParser {
  private readonly packages = new Map<string, MutableMeta>();
  private readonly sharedPackages = new Map<string, string[]>();
  private readonly sharedPermissions = new Map<string, Set<string>>();
  private readonly sharedAppIds = new Map<string, string>();
  private current: MutableMeta | null = null;
  private currentShared: string | null = null;

  /** push 接收一行原始 dumpsys 输出 */
  push(rawLine: string): void {
    const line = rawLine.replace(/\r$/, '');
    const pkgMatch = PKG.exec(line);
    if (pkgMatch) {
      this.current = this.packages.get(pkgMatch[1]) ?? createMeta();
      this.packages.set(pkgMatch[1], this.current);
      this.currentShared = null;
      return;
    }

    const sharedMatch = SHARED.exec(line);
    if (sharedMatch) {
      this.currentShared = sharedMatch[1];
      this.current = null;
      if (!this.sharedPackages.has(this.currentShared)) this.sharedPackages.set(this.currentShared, []);
      if (!this.sharedPermissions.has(this.currentShared)) this.sharedPermissions.set(this.currentShared, new Set());
      return;
    }

    if (line && !/^\s/.test(line) && line.trimEnd().endsWith(':')) {
      if (this.currentShared !== null && /^Packages:?$/.test(line.trim())) return;
      this.current = null;
      this.currentShared = null;
      return;
    }

    const trimmed = line.trim();
    if (!trimmed) return;

    if (this.currentShared !== null) {
      if (trimmed.startsWith('appId=')) {
        this.sharedAppIds.set(this.currentShared, trimmed.slice('appId='.length));
      } else {
        const pkgSetting = PKG_SETTING.exec(trimmed);
        if (pkgSetting) this.sharedPackages.get(this.currentShared)!.push(pkgSetting[1]);
        const granted = GRANTED.exec(trimmed);
        if (granted) this.sharedPermissions.get(this.currentShared)!.add(granted[1]);
      }
      return;
    }

    const meta = this.current;
    if (!meta) return;
    if ((trimmed.startsWith('appId=') || trimmed.startsWith('userId=')) && !meta.appId) {
      meta.appId = trimmed.slice(trimmed.indexOf('=') + 1);
    } else if (trimmed.startsWith('flags=[') && !meta.flags) {
      meta.flags = trimmed;
    } else if (trimmed.startsWith('installerPackageName=') && meta.installer === null) {
      const value = trimmed.slice('installerPackageName='.length);
      meta.installer = value === 'null' ? null : value;
    } else if (trimmed.startsWith('sharedUser=') && meta.sharedUser === null) {
      meta.sharedUser = SHARED_USER.exec(trimmed)?.[1] ?? null;
    } else {
      const granted = GRANTED.exec(trimmed);
      if (granted) meta.permissions.add(granted[1]);
    }
  }

  /** finish 合并共享 UID 段并返回不可变包映射 */
  finish(): Map<string, PkgMeta> {
    for (const [shared, owned] of this.sharedPackages) {
      const permissions = this.sharedPermissions.get(shared) ?? new Set<string>();
      const appId = this.sharedAppIds.get(shared);
      for (const pkg of owned) {
        const meta = this.packages.get(pkg) ?? createMeta();
        this.packages.set(pkg, meta);
        for (const permission of permissions) meta.permissions.add(permission);
        if (!meta.appId && appId) meta.appId = appId;
        if (!meta.flags && appId === '1000') meta.flags = 'SYSTEM';
        if (meta.sharedUser === null) meta.sharedUser = shared;
      }
    }

    return new Map([...this.packages].map(([pkg, meta]) => [pkg, {
      flags: meta.flags,
      appId: meta.appId,
      installer: meta.installer,
      permissions: meta.permissions,
      sharedUser: meta.sharedUser,
    }]));
  }
}

/** parseDumpsys 解析完整文本, 主要供测试和离线分析使用
 * @param text 设备 stdout
 * @returns 包名到元数据的映射
 */
export function parseDumpsys(text: string): Map<string, PkgMeta> {
  const parser = new DumpsysParser();
  for (const line of text.split('\n')) parser.push(line);
  return parser.finish();
}

/** createMeta 创建空的可变包记录 */
function createMeta(): MutableMeta {
  return { flags: '', appId: '', installer: null, permissions: new Set(), sharedUser: null };
}