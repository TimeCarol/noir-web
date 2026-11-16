/**
 * 职责: 为扫描器提供统一的 ADB shell 文本, 字节和流式执行接口, 并处理 USB 中断和超时
 * 导出: Shell, ShellOptions, DeviceDisconnectedError, ShellTimeoutError, isShellInterruption, adbShell
 * 依赖: @yume-chan/adb
 * 约束: 命令由调用方完整拼接, 路径参数必须经过 quote; 中断必须终止底层 socket
 * 作者: timecarol
 * 日期: 2026-11-16 00:40
 * 版本: v1.2
 */
// oxlint-disable no-await-in-loop -- shell 输出必须顺序读取
import type { Adb } from '@yume-chan/adb';
import type { ReadableStreamDefaultReader } from '@yume-chan/stream-extra';

/** DeviceDisconnectedError 表示 USB 连接在命令完成前断开 */
export class DeviceDisconnectedError extends Error {
  constructor(cause?: unknown) {
    super('USB 连接已中断, 请重新连接设备后重试', cause === undefined ? undefined : { cause });
    this.name = 'DeviceDisconnectedError';
  }
}

/** ShellTimeoutError 表示设备在超时时间内没有任何响应 */
export class ShellTimeoutError extends Error {
  constructor(message = '设备响应超时, 请检查 USB 连接后重试') {
    super(message);
    this.name = 'ShellTimeoutError';
  }
}

/** ShellOptions 控制单条命令的总超时和流式命令的空闲超时 */
export interface ShellOptions {
  commandTimeoutMs?: number;
  streamIdleTimeoutMs?: number;
}

/** Shell 抽象出扫描器需要的三种 shell 调用, 测试可注入合成输出 */
export interface Shell {
  /** exec 返回合并后的 stdout 和 stderr 原始字节 */
  exec(command: string): Promise<Uint8Array>;
  /** text 返回合并后的 stdout 和 stderr 文本 */
  text(command: string): Promise<string>;
  /** stream 按行推送输出, 用于设备端逐包扫描进度 */
  stream(command: string, onLine: (line: string) => void, signal?: AbortSignal): Promise<void>;
}

/** isShellInterruption 判断错误是否由 USB 断开或设备超时导致 */
export function isShellInterruption(error: unknown): boolean {
  return error instanceof DeviceDisconnectedError
    || error instanceof ShellTimeoutError
    || (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError' && error.message.includes('USB'));
}

/** adbShell 将 Tango ADB 客户端包装为扫描器接口
 * @param adb 已认证的 ADB 客户端
 * @param options 超时配置, 测试可缩短
 * @returns 可执行文本, 字节和流式命令的适配器
 */
export function adbShell(adb: Adb, options: ShellOptions = {}): Shell {
  const commandTimeoutMs = options.commandTimeoutMs ?? 60_000;
  const streamIdleTimeoutMs = options.streamIdleTimeoutMs ?? 180_000;

  /** disconnectRace 返回一个在 USB 断开时拒绝的 promise */
  function disconnectRace(): Promise<never> {
    return adb.disconnected.then(
      () => { throw new DeviceDisconnectedError(); },
      cause => { throw new DeviceDisconnectedError(cause); },
    );
  }

  /** collect 执行一条命令并收集全部输出 */
  async function collect(command: string, signal?: AbortSignal): Promise<Uint8Array> {
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(signal?.reason ?? new DOMException('已取消', 'AbortError'));
    if (signal?.aborted) abortFromCaller();
    else signal?.addEventListener('abort', abortFromCaller, { once: true });
    const timer = window.setTimeout(() => controller.abort(new ShellTimeoutError()), commandTimeoutMs);
    const racing = [disconnectRace(), abortRace(controller.signal)];
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    try {
      const process = await raceTransport(() => adb.subprocess.noneProtocol.spawn(command, controller.signal), controller, racing);
      const outputReader = process.output.getReader();
      reader = outputReader;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await raceTransport(() => outputReader.read(), controller, racing);
        if (done) break;
        chunks.push(value);
      }
      await raceTransport(() => process.exited, controller, racing);
      return concat(chunks);
    } catch (error) {
      const reason = controller.signal.aborted ? controller.signal.reason : error;
      controller.abort(reason);
      throw reason;
    } finally {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', abortFromCaller);
      await closeReader(reader);
    }
  }

  return {
    async exec(command: string): Promise<Uint8Array> {
      return collect(command);
    },
    async text(command: string): Promise<string> {
      return new TextDecoder().decode(await collect(command));
    },
    async stream(command: string, onLine: (line: string) => void, signal?: AbortSignal): Promise<void> {
      const controller = new AbortController();
      const abortFromCaller = () => controller.abort(signal?.reason ?? new DOMException('已取消', 'AbortError'));
      if (signal?.aborted) abortFromCaller();
      else signal?.addEventListener('abort', abortFromCaller, { once: true });
      let timer = window.setTimeout(() => controller.abort(new ShellTimeoutError()), streamIdleTimeoutMs);
      const resetTimer = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => controller.abort(new ShellTimeoutError()), streamIdleTimeoutMs);
      };
      const racing = [disconnectRace(), abortRace(controller.signal)];
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      try {
        const process = await raceTransport(() => adb.subprocess.noneProtocol.spawn(command, controller.signal), controller, racing);
        const outputReader = process.output.getReader();
        reader = outputReader;
        const decoder = new TextDecoder();
        let pending = '';
        while (true) {
          const { done, value } = await raceTransport(() => outputReader.read(), controller, racing);
          if (done) break;
          resetTimer();
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
        await raceTransport(() => process.exited, controller, racing);
      } catch (error) {
        const reason = controller.signal.aborted ? controller.signal.reason : error;
        controller.abort(reason);
        throw reason;
      } finally {
        window.clearTimeout(timer);
        signal?.removeEventListener('abort', abortFromCaller);
        await closeReader(reader);
      }
    },
  };
}

/** raceTransport 将底层传输异常归一化为可展示的 USB 中断错误 */
async function raceTransport<T>(operation: () => Promise<T>, controller: AbortController, racing: readonly Promise<never>[]): Promise<T> {
  try {
    return await Promise.race([operation(), ...racing]);
  } catch (error) {
    if (error instanceof DeviceDisconnectedError || error instanceof ShellTimeoutError) throw error;
    if (controller.signal.aborted) throw controller.signal.reason;
    throw new DeviceDisconnectedError(error);
  }
}

/** closeReader 取消挂起的读取并释放锁, 不覆盖原始中断错误 */
async function closeReader(reader: ReadableStreamDefaultReader<Uint8Array> | null): Promise<void> {
  if (!reader) return;
  try {
    await reader.cancel();
  } catch {
    // socket 已经由 abort 关闭
  }
  try {
    reader.releaseLock();
  } catch {
    // 读取器可能已经被底层关闭
  }
}

/** abortRace 返回一个在调用方取消或内部超时时拒绝的 promise */
function abortRace(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

/** concat 合并多个输出块 */
function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}