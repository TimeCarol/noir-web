/**
 * 职责: 为扫描器提供统一的 ADB shell 文本, 字节和流式执行接口
 * 导出: Shell, adbShell
 * 依赖: @yume-chan/adb
 * 约束: 命令由调用方完整拼接, 路径参数必须经过 quote
 * 作者: timecarol
 * 日期: 2026-11-15 23:50
 * 版本: v1.0
 */
// oxlint-disable no-await-in-loop -- ADB 命令和流式读取必须顺序执行
import type { Adb } from '@yume-chan/adb';

/** Shell 抽象出扫描器需要的三种 shell 调用, 测试可注入合成输出 */
export interface Shell {
  /** exec 返回合并后的 stdout 和 stderr 原始字节 */
  exec(command: string): Promise<Uint8Array>;
  /** text 返回合并后的 stdout 和 stderr 文本 */
  text(command: string): Promise<string>;
  /** stream 按行推送输出, 用于设备端逐包扫描进度 */
  stream(command: string, onLine: (line: string) => void, signal?: AbortSignal): Promise<void>;
}

/** adbShell 将 Tango ADB 客户端包装为扫描器接口
 * @param adb 已认证的 ADB 客户端
 * @returns 可执行文本, 字节和流式命令的适配器
 */
export function adbShell(adb: Adb): Shell {
  return {
    async exec(command: string): Promise<Uint8Array> {
      return adb.subprocess.noneProtocol.spawnWait(command);
    },
    async text(command: string): Promise<string> {
      return adb.subprocess.noneProtocol.spawnWaitText(command);
    },
    async stream(command: string, onLine: (line: string) => void, signal?: AbortSignal): Promise<void> {
      const process = await adb.subprocess.noneProtocol.spawn(command, signal);
      const reader = process.output.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          let newline = pending.indexOf('\n');
          while (newline >= 0) {
            const line = pending.slice(0, newline).replace(/\r$/, '');
            pending = pending.slice(newline + 1);
            if (line) onLine(line);
            newline = pending.indexOf('\n');
          }
        }
        pending += decoder.decode();
        if (pending.trim()) onLine(pending.replace(/\r$/, ''));
      } finally {
        reader.releaseLock();
      }
      await process.exited.catch(() => undefined);
    },
  };
}