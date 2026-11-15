/**
 * 职责: 定义审计结果, 分类, 数据类型和建议的稳定数据边界
 * 导出: AppEntry, Recommendation, ScanResult, ReportMeta, labels
 * 依赖: apk/manifest 类型
 * 约束: 字段名与 NOIR report.json 对齐, 不在 UI 层重命名
 * 作者: timecarol
 * 日期: 2026-11-15 23:35
 * 版本: v1.0
 */
import type { ManifestFacts } from '../apk/manifest';

/** Category 是 NOIR 分类键, 标签用于中文报告 */
export type Category =
  | 'TELEMETRY'
  | 'ADS'
  | 'SECURITY'
  | 'AI_VOICE'
  | 'LOCATION'
  | 'PUSH'
  | 'APP_STORE'
  | 'INPUT_METHOD'
  | 'PAYMENT'
  | 'FINANCE'
  | 'SHOPPING'
  | 'MEDIA'
  | 'SOCIAL'
  | 'GAME'
  | 'TOOL'
  | 'CARRIER'
  | 'SYSTEM'
  | 'OTHER';

export const CATEGORY_LABELS: Record<Category, string> = {
  TELEMETRY: '遥测/统计',
  ADS: '广告',
  SECURITY: '安全/杀毒',
  AI_VOICE: 'AI/语音',
  LOCATION: '定位/地图',
  PUSH: '推送',
  APP_STORE: '应用商店',
  INPUT_METHOD: '输入法',
  PAYMENT: '支付',
  FINANCE: '金融',
  SHOPPING: '购物',
  MEDIA: '影音',
  SOCIAL: '社交',
  GAME: '游戏',
  TOOL: '工具',
  CARRIER: '运营商',
  SYSTEM: '系统',
  OTHER: '其他',
};

/** DataType 是权限能暴露的用户数据类别 */
export type DataType =
  | 'LOCATION'
  | 'CONTACTS'
  | 'SMS'
  | 'CALLS'
  | 'MIC'
  | 'CAMERA'
  | 'SCREEN'
  | 'APPS'
  | 'IDENTITY'
  | 'FILES'
  | 'CALENDAR'
  | 'ACCOUNTS';

export const DATA_TYPE_LABELS: Record<DataType, string> = {
  LOCATION: '位置',
  CONTACTS: '通讯录',
  SMS: '短信',
  CALLS: '通话记录',
  MIC: '麦克风',
  CAMERA: '相机',
  SCREEN: '屏幕',
  APPS: '应用列表',
  IDENTITY: '设备标识',
  FILES: '文件/相册',
  CALENDAR: '日历',
  ACCOUNTS: '账号',
};

/** DomainClass 是 DNS 清单的三档分类 */
export type DomainClass = 'TRACKER' | 'REVIEW' | 'FUNCTIONAL';

/** ActionType 是建议动作键 */
export type ActionType =
  | 'APPOP_PROJECT_MEDIA'
  | 'APPOP_USAGE_STATS'
  | 'UNINSTALL_USER'
  | 'REVIEW'
  | 'BLOCK_DNS';

export const ACTION_LABELS: Record<ActionType, string> = {
  APPOP_PROJECT_MEDIA: '撤销常驻录屏授权',
  APPOP_USAGE_STATS: '禁止读取使用统计',
  UNINSTALL_USER: '对当前用户卸载',
  REVIEW: '人工复核',
  BLOCK_DNS: 'DNS 拦截',
};

/** AppFacts 是扫描阶段收集的原始事实, 评分规则变化时可重算 */
export interface AppFacts {
  packageName: string;
  uid: string;
  isSystem: boolean;
  debuggable: boolean;
  installer: string | null;
  permissions: string[];
  endpoints: string[];
  sharedUid: string | null;
  apkPaths: string[];
  manifest: ManifestFacts | null;
  failed: boolean;
}

/** AppEntry 是报告中的一行, 字段与 NOIR 兼容 */
export interface AppEntry {
  pkg: string;
  uid: string;
  isSystem: boolean;
  debuggable: boolean;
  installer: string | null;
  permissions: string[];
  endpoints: string[];
  score: number;
  category: Category;
  vendor: string | null;
  sharedUid: string | null;
  dataTypes: DataType[];
  leaks: Partial<Record<DataType, string[]>>;
  manifest: ManifestFacts | null;
  apkPaths: string[];
}

/** Recommendation 是 Advisor 输出的一条可执行或人工动作 */
export interface Recommendation {
  pkg: string;
  action: ActionType;
  risk: 'HIGH' | 'MED' | 'LOW';
  reason: string;
  autoSafe: boolean;
}

/** ReportMeta 记录可复现扫描所需的环境字段 */
export interface ReportMeta {
  tool: string;
  host: string;
  android: string;
  sdk: string;
  build: string;
  fingerprint: string;
  user: string;
  generatedAt: string;
  minScore: number;
  limit: number;
}

/** ScanResult 是 UI 和报告生成共用的扫描结果 */
export interface ScanResult {
  serial: string;
  model: string;
  product: string;
  android: string;
  meta: ReportMeta;
  apps: AppEntry[];
  recommendations: Recommendation[];
  packageCount: number;
  failed: string[];
  startedAt: number;
  finishedAt: number;
}

/** DomainExport 是三档域名清单 */
export interface DomainExport {
  trackers: string[];
  review: string[];
  functional: string[];
}