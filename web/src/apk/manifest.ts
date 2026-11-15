/**
 * 职责: 从 AXML 节点提取 Manifest 层面的组件, 备份, 明文流量和调试事实
 * 导出: ComponentFact, ManifestFacts, analyzeManifest
 * 依赖: apk/axml
 * 约束: exported 缺省时按是否存在 intent-filter 推导, 与 Android 平台一致
 * 作者: timecarol
 * 日期: 2026-11-15 23:50
 * 版本: v1.0
 */
import { parseAxml, type AxmlNode } from './axml';

/** ComponentFact 描述一个可被其他应用调用的组件 */
export interface ComponentFact {
  kind: string;
  name: string;
  exported: boolean;
  permission: string | null;
  authorities: string | null;
  enabled: boolean;
}

/** ManifestFacts 是 dumpsys 不提供的 Manifest 事实 */
export interface ManifestFacts {
  components: ComponentFact[];
  allowBackup: boolean | null;
  cleartext: boolean | null;
  debuggable: boolean | null;
  targetSdk: string | null;
  networkSecurityConfig: boolean;
}

const COMPONENT_KINDS = new Set(['activity', 'activity-alias', 'service', 'receiver', 'provider']);

/** analyzeManifest 解析 AndroidManifest.xml 原始字节
 * @param bytes 未压缩的 AXML
 * @returns Manifest 事实, 无法解析时返回 null
 */
export function analyzeManifest(bytes: Uint8Array): ManifestFacts | null {
  const nodes = parseAxml(bytes);
  if (nodes.length === 0) return null;

  const application = nodes.find(node => node.depth === 1 && node.name === 'application');
  const sdk = nodes.find(node => node.name === 'uses-sdk');
  const appPermission = nonEmpty(application?.attrs.get('permission'));
  const targetSdk = sdk?.attrs.get('targetSdkVersion') ?? null;
  const targetSdkNumber = targetSdk === null ? null : Number.parseInt(targetSdk, 10);

  const components: ComponentFact[] = [];
  nodes.forEach((node, index) => {
    if (node.depth !== 2 || !COMPONENT_KINDS.has(node.name)) return;
    const hasIntentFilter = hasDescendant(nodes, index, node.depth, 'intent-filter');
    const exportedValue = node.attrs.get('exported');
    const exported = exportedValue === 'true' ? true : exportedValue === 'false' ? false : hasIntentFilter;
    const directPermission = ['permission', 'readPermission', 'writePermission']
      .map(key => nonEmpty(node.attrs.get(key)))
      .find((value): value is string => value !== null) ?? null;
    components.push({
      kind: node.name,
      name: node.attrs.get('name') ?? '',
      exported,
      permission: directPermission ?? appPermission,
      authorities: nonEmpty(node.attrs.get('authorities')),
      enabled: node.attrs.get('enabled') !== 'false',
    });
  });

  return {
    components,
    allowBackup: application ? parseBool(application.attrs.get('allowBackup')) ?? true : null,
    cleartext: parseBool(application?.attrs.get('usesCleartextTraffic') ?? null)
      ?? (targetSdkNumber !== null && !Number.isNaN(targetSdkNumber) ? targetSdkNumber < 28 : null),
    debuggable: parseBool(application?.attrs.get('debuggable') ?? null),
    targetSdk,
    networkSecurityConfig: Boolean(nonEmpty(application?.attrs.get('networkSecurityConfig'))),
  };
}

/** hasDescendant 检查节点之后是否出现指定名称的后代 */
function hasDescendant(nodes: readonly AxmlNode[], index: number, depth: number, name: string): boolean {
  for (let cursor = index + 1; cursor < nodes.length && nodes[cursor].depth > depth; cursor++) {
    if (nodes[cursor].name === name) return true;
  }
  return false;
}

/** parseBool 只接受 Manifest 明确写出的 true 或 false */
function parseBool(value: string | null | undefined): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

/** nonEmpty 把空字符串和缺失值统一为 null */
function nonEmpty(value: string | null | undefined): string | null {
  return value && value.trim() ? value : null;
}