/**
 * 职责: 验证 USB 断开和 shell 超时不会让扫描无限等待
 * 导出: 测试用例
 * 依赖: Vitest / 合成 ADB transport
 * 约束: 不打开真实 USB, 用可控的 disconnect promise 模拟掉线
 * 作者: timecarol
 * 日期: 2026-11-16 00:50
 * 版本: v1.0
 */
import { describe, expect, it, vi } from 'vitest';
import type { Adb } from '@yume-chan/adb';
import { adbShell, DeviceDisconnectedError, isShellInterruption, ShellTimeoutError } from './shell';

/** pendingProcess 返回永远不产生输出和退出信号的 ADB 进程 */
function pendingProcess() {
  return {
    stdin: {},
    output: {
      getReader: () => ({
        read: () => new Promise(() => undefined),
        cancel: () => Promise.resolve(),
        releaseLock: () => undefined,
      }),
    },
    exited: new Promise(() => undefined),
    kill: vi.fn(),
  };
}

/** fakeAdb 返回可控断线和 spawn 的 ADB 客户端 */
function fakeAdb(): { adb: Adb; disconnect: () => void; spawn: ReturnType<typeof vi.fn> } {
  let disconnect!: () => void;
  const disconnected = new Promise<void>(resolve => {
    disconnect = resolve;
  });
  const spawn = vi.fn(async () => pendingProcess());
  const adb = {
    disconnected,
    subprocess: { noneProtocol: { spawn } },
  } as unknown as Adb;
  return { adb, disconnect, spawn };
}

describe('adbShell', () => {
  it('exec 在 USB 断开时立即失败', async () => {
    const { adb, disconnect } = fakeAdb();
    const shell = adbShell(adb);
    const pending = shell.exec('dumpsys package');
    disconnect();
    await expect(pending).rejects.toBeInstanceOf(DeviceDisconnectedError);
    await expect(pending).rejects.toSatisfy(isShellInterruption);
  });

  it('stream 在 USB 断开时立即失败并释放读取器', async () => {
    const { adb, disconnect } = fakeAdb();
    const shell = adbShell(adb);
    const pending = shell.stream('dumpsys package', () => undefined);
    disconnect();
    await expect(pending).rejects.toBeInstanceOf(DeviceDisconnectedError);
  });

  it('命令无响应时按总超时失败', async () => {
    const { adb } = fakeAdb();
    const shell = adbShell(adb, { commandTimeoutMs: 5, streamIdleTimeoutMs: 5 });
    await expect(shell.exec('dumpsys package')).rejects.toBeInstanceOf(ShellTimeoutError);
  });

  it('流式命令没有新输出时按空闲超时失败', async () => {
    const { adb } = fakeAdb();
    const shell = adbShell(adb, { streamIdleTimeoutMs: 5 });
    await expect(shell.stream('dumpsys package', () => undefined)).rejects.toBeInstanceOf(ShellTimeoutError);
  });

  it('调用方取消时保留 AbortError, 不误报为 USB 断开', async () => {
    const { adb } = fakeAdb();
    const shell = adbShell(adb);
    const controller = new AbortController();
    const pending = shell.stream('dumpsys package', () => undefined, controller.signal);
    controller.abort(new DOMException('用户取消', 'AbortError'));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError', message: '用户取消' });
    await expect(pending).rejects.not.toBeInstanceOf(DeviceDisconnectedError);
  });
});
