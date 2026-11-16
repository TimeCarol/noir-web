/**
 * 职责: 从 DEX 字节中提取 HTTP(S) 端点和静态风险信号
 * 导出: URL_LIMIT, DexScanResult, DEEP_SIGNALS, DEX_SIGNAL_GREP, scanDex, urlsFromDex, signalsFromTokens
 * 依赖: 无
 * 约束: 只扫描可打印 ASCII 串, 信号是字符串证据而不是源码级结论
 * 作者: timecarol
 * 日期: 2026-11-16 10:10
 * 版本: v1.1
 */

/** URL_LIMIT 是每个应用保留的端点数上限, 避免异常 DEX 撑爆报告 */
export const URL_LIMIT = 1000;

/** DexScanResult 是一个或多个 DEX 的扫描结果 */
export interface DexScanResult {
  urls: string[];
  signals: string[];
}

/** DeepSignal 是 DEX 字符串级风险信号定义 */
export interface DeepSignal {
  key: string;
  label: string;
  weight: number;
  patterns: string[];
}

/** DEEP_SIGNALS 与 NOIR 的源码级信号保持同名, 但只匹配 DEX 字符串 */
export const DEEP_SIGNALS: readonly DeepSignal[] = [
  { key: 'exec', label: '命令执行', weight: 4, patterns: ['getRuntime', 'ProcessBuilder'] },
  { key: 'dynamic-load', label: '动态加载', weight: 3, patterns: ['DexClassLoader', 'PathClassLoader', 'loadLibrary'] },
  { key: 'disable-app', label: '禁用应用', weight: 5, patterns: ['setApplicationEnabledSetting'] },
  { key: 'a11y-hijack', label: '无障碍劫持', weight: 5, patterns: ['enabled_accessibility_services'] },
  { key: 'screen-capture', label: '屏幕捕获', weight: 4, patterns: ['MediaProjection', 'createScreenCaptureIntent'] },
  { key: 'reflection', label: '反射', weight: 1, patterns: ['Class.forName', 'getDeclaredMethod'] },
  { key: 'crypto', label: '加密', weight: 1, patterns: ['Cipher', 'MessageDigest'] },
  { key: 'network', label: '网络', weight: 1, patterns: ['HttpURLConnection', 'OkHttpClient', 'openConnection'] },
  { key: 'set-prop', label: '修改系统设置', weight: 5, patterns: ['SystemProperties', 'Settings.Global', 'Settings.Secure'] },
  { key: 'sms', label: '短信', weight: 4, patterns: ['SmsManager', 'sendTextMessage', 'content://sms'] },
  { key: 'device-id', label: '设备标识', weight: 3, patterns: ['getDeviceId', 'getImei', 'getSubscriberId', 'getAndroidId', 'getSerial'] },
  { key: 'webview-bridge', label: 'WebView 桥', weight: 3, patterns: ['addJavascriptInterface'] },
  { key: 'accessibility', label: '无障碍服务', weight: 4, patterns: ['AccessibilityService'] },
  { key: 'notification-listener', label: '通知监听', weight: 3, patterns: ['NotificationListenerService'] },
  { key: 'device-admin', label: '设备管理', weight: 4, patterns: ['DeviceAdminReceiver'] },
] as const;

/** DEX_SIGNAL_GREP 是设备端 grep -E 使用的合并模式 */
export const DEX_SIGNAL_GREP = DEEP_SIGNALS.flatMap(signal => signal.patterns).join('|');

const URL_PATTERN = /https?:\/\/[A-Za-z0-9._~:/?#@!&()*+,;=%-]{4,300}/;
const PRINTABLE_START = 32;
const PRINTABLE_END = 127;
const MIN_STRING = 4;

/** signalsFromTokens 将 grep 命中的信号字符串映射为稳定的 signal key */
export function signalsFromTokens(tokens: readonly string[]): string[] {
  const found = new Set(tokens);
  const signals: string[] = [];
  for (const signal of DEEP_SIGNALS) {
    if (signal.patterns.some(pattern => found.has(pattern))) signals.push(signal.key);
  }
  return signals;
}

/** scanDex 扫描一个或多个 DEX 字节, 按出现顺序去重
 * @param chunks 每个 DEX 文件的原始字节
 * @param limit 保留的端点上限
 * @returns 端点和信号 key
 */
export function scanDex(chunks: readonly Uint8Array[], limit = URL_LIMIT): DexScanResult {
  const urls = new Set<string>();
  const signals = new Set<string>();
  for (const bytes of chunks) {
    if (urls.size >= limit) break;
    scanChunk(bytes, urls, signals, limit);
  }
  return { urls: [...urls], signals: [...signals] };
}

/** urlsFromDex 保留旧的端点提取接口 */
export function urlsFromDex(chunks: readonly Uint8Array[], limit = URL_LIMIT): string[] {
  return scanDex(chunks, limit).urls;
}

/** scanChunk 扫描可打印 ASCII 串并匹配 URL 和信号 */
function scanChunk(bytes: Uint8Array, urls: Set<string>, signals: Set<string>, limit: number): void {
  let index = 0;
  while (index < bytes.length && urls.size < limit) {
    if (bytes[index] < PRINTABLE_START || bytes[index] >= PRINTABLE_END) {
      index++;
      continue;
    }
    let end = index;
    while (end < bytes.length && end - index < 320) {
      const value = bytes[end];
      if (value < PRINTABLE_START || value >= PRINTABLE_END) break;
      end++;
    }
    if (end - index >= MIN_STRING) {
      const text = new TextDecoder('ascii').decode(bytes.subarray(index, end));
      if (text.startsWith('http://') || text.startsWith('https://')) {
        const match = URL_PATTERN.exec(text);
        if (match) urls.add(match[0]);
      }
      for (const signal of DEEP_SIGNALS) {
        if (signal.patterns.some(pattern => text.includes(pattern))) signals.add(signal.key);
      }
    }
    index = end > index ? end : index + 1;
  }
}