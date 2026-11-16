/**
 * 职责: 读取和设置 Android appops 模式
 * 导出: AppOp, AppOpMode, parseAppOpMode, readAppOpMode, setAppOpMode
 * 依赖: ADB shell
 * 约束: setAppOpMode 只在用户确认后调用, 返回原始输出供错误展示
 * 作者: timecarol
 * 日期: 2026-11-16 09:40
 * 版本: v1.0
 */
import type { Shell } from './shell';

/** AppOp 是本项目允许修改的 app op */
export type AppOp = 'GET_USAGE_STATS' | 'PROJECT_MEDIA';

/** AppOpMode 是 appops 的稳定模式 */
export type AppOpMode = 'default' | 'allow' | 'ignore' | 'deny' | 'unknown';

/** parseAppOpMode 解析 cmd appops get 的输出
 * @param output 原始输出
 * @param op 目标 op
 * @returns 归一化模式
 */
export function parseAppOpMode(output: string, op: AppOp): AppOpMode {
  const explicit = new RegExp(`${op}:\\s*([a-z]+)`, 'i').exec(output);
  const fallback = /Default mode:\s*([a-z]+)/i.exec(output);
  const mode = (explicit?.[1] ?? fallback?.[1] ?? '').toLowerCase();
  return mode === 'default' || mode === 'allow' || mode === 'ignore' || mode === 'deny' ? mode : 'unknown';
}

/** readAppOpMode 读取应用当前 app op 模式 */
export async function readAppOpMode(shell: Shell, pkg: string, op: AppOp, user: string): Promise<AppOpMode> {
  const output = await shell.text(`cmd appops get --user ${user} ${pkg} ${op}`);
  return parseAppOpMode(output, op);
}

/** setAppOpMode 修改应用 app op 模式
 * @returns 设备输出和成功标记; shell 错误文本会保留
 */
export async function setAppOpMode(shell: Shell, pkg: string, op: AppOp, mode: AppOpMode, user: string): Promise<{ ok: boolean; output: string }> {
  const output = await shell.text(`cmd appops set --user ${user} ${pkg} ${op} ${mode}`);
  return {
    ok: !/SecurityException|Exception|not allowed|unknown option|error/i.test(output),
    output: output.trim(),
  };
}