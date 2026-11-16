/**
 * 职责: 在 OPFS 中记录 appops 动作的原始模式, 供回滚使用
 * 导出: ActionRecord, actionKey, loadActionLog, saveActionLog
 * 依赖: storage/opfs / adb/appops
 * 约束: 只保存修改记录, 不保存设备上的当前状态快照
 * 作者: timecarol
 * 日期: 2026-11-16 09:40
 * 版本: v1.0
 */
import type { AppOp, AppOpMode } from '../adb/appops';
import { readJson, serialSegment, writeJson } from './opfs';

/** ActionRecord 记录一次 appops 修改前的模式 */
export interface ActionRecord {
  pkg: string;
  op: AppOp;
  before: AppOpMode;
  appliedAt: string;
}

interface StoredActions {
  version: 1;
  savedAt: string;
  records: ActionRecord[];
}

/** actionKey 生成动作去重键 */
export function actionKey(pkg: string, op: AppOp): string {
  return `${pkg}|${op}`;
}

/** actionsPath 返回设备动作日志路径 */
function actionsPath(serial: string): string[] {
  return ['devices', serialSegment(serial), 'actions.json'];
}

/** loadActionLog 读取设备动作日志 */
export async function loadActionLog(serial: string): Promise<Map<string, ActionRecord>> {
  const stored = await readJson<StoredActions>(actionsPath(serial));
  if (!stored || stored.version !== 1 || !Array.isArray(stored.records)) return new Map();
  const records = new Map<string, ActionRecord>();
  for (const record of stored.records) {
    if (record?.pkg && record.op && record.before) records.set(actionKey(record.pkg, record.op), record);
  }
  return records;
}

/** saveActionLog 保存设备动作日志 */
export async function saveActionLog(serial: string, records: readonly ActionRecord[]): Promise<boolean> {
  return writeJson(actionsPath(serial), {
    version: 1,
    savedAt: new Date().toISOString(),
    records: [...records],
  } satisfies StoredActions);
}