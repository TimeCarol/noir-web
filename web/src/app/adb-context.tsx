/* @refresh reset */
/**
 * 职责: 保存当前标签页的 ADB 连接, 认证阶段和连接失败
 * 导出: AdbProvider, useAdb, ConnectionPhase
 * 依赖: React context / TanStack Query / Tango
 * 约束: ADB transport 只由本 Provider 释放, 断开时清理设备查询缓存
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.3
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authenticateAdbDevice, requestAdbDevice } from '../adb/connect';
import { describeConnectionError, describeDisconnectedFailure, type ConnectionFailure } from '../adb/errors';
import type { ConnectedDevice } from '../adb/types';

/** ConnectionPhase 描述连接流程中的可见阶段, error 表示 failure 已填充 */
export type ConnectionPhase = 'idle' | 'requesting' | 'authorizing' | 'ready' | 'error';

/** AdbValue 是页面共享的连接状态和操作 */
interface AdbValue {
  device: ConnectedDevice | null;
  phase: ConnectionPhase;
  failure: ConnectionFailure | null;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  clearFailure: () => void;
}

const AdbContext = createContext<AdbValue | null>(null);

/** AdbProvider 管理一次 WebUSB 连接的生命周期
 * @param children 需要读取连接状态的页面
 */
export function AdbProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [device, setDevice] = useState<ConnectedDevice | null>(null);
  const [phase, setPhase] = useState<ConnectionPhase>('idle');
  const [failure, setFailure] = useState<ConnectionFailure | null>(null);
  const manualDisconnect = useRef(false);
  const connecting = useRef(false);

  const disconnect = useCallback(() => {
    manualDisconnect.current = true;
    setDevice(null);
    setPhase('idle');
    setFailure(null);
    queryClient.removeQueries({ queryKey: ['packages'] });
    queryClient.removeQueries({ queryKey: ['device-info'] });
  }, [queryClient]);

  const clearFailure = useCallback(() => {
    setFailure(null);
    setPhase('idle');
  }, []);

  const connect = useCallback(async (): Promise<boolean> => {
    if (device) return true;
    if (connecting.current) return false;
    connecting.current = true;
    manualDisconnect.current = false;
    setFailure(null);
    setPhase('requesting');
    try {
      const usbDevice = await requestAdbDevice();
      if (!usbDevice) {
        setPhase('idle');
        return false;
      }
      setPhase('authorizing');
      const connected = await authenticateAdbDevice(usbDevice);
      queryClient.removeQueries({ queryKey: ['packages'] });
      queryClient.removeQueries({ queryKey: ['device-info'] });
      setDevice(connected);
      setPhase('ready');
      return true;
    } catch (error) {
      setFailure(describeConnectionError(error));
      setPhase('error');
      return false;
    } finally {
      connecting.current = false;
    }
  }, [device, queryClient]);

  useEffect(() => {
    if (!device) return;
    let active = true;
    void device.adb.disconnected.then(() => {
      if (!active || manualDisconnect.current) return;
      setDevice(null);
      setPhase('idle');
      setFailure(describeDisconnectedFailure());
      queryClient.removeQueries({ queryKey: ['packages'] });
      queryClient.removeQueries({ queryKey: ['device-info'] });
    });
    return () => {
      active = false;
    };
  }, [device, queryClient]);

  useEffect(() => {
    if (!device) return;
    const usb = typeof navigator === 'undefined' ? undefined : navigator.usb;
    if (!usb) return;
    const handleDisconnect = (event: Event) => {
      const target = (event as Event & { device?: USBDevice }).device;
      if (!target) return;
      const sameDevice = device.usbDevice
        ? target === device.usbDevice || (Boolean(device.serial) && target.serialNumber === device.serial)
        : Boolean(device.serial) && target.serialNumber === device.serial;
      if (!sameDevice) return;
      manualDisconnect.current = true;
      setDevice(null);
      setPhase('idle');
      setFailure(describeDisconnectedFailure());
      queryClient.removeQueries({ queryKey: ['packages'] });
      queryClient.removeQueries({ queryKey: ['device-info'] });
    };
    usb.addEventListener('disconnect', handleDisconnect as EventListener);
    return () => usb.removeEventListener('disconnect', handleDisconnect as EventListener);
  }, [device, queryClient]);

  useEffect(() => {
    const current = device;
    if (!current) return;
    return () => {
      void current.adb.close().catch(() => undefined);
    };
  }, [device]);

  const value = useMemo<AdbValue>(
    () => ({ device, phase, failure, connect, disconnect, clearFailure }),
    [device, phase, failure, connect, disconnect, clearFailure],
  );
  return <AdbContext value={value}>{children}</AdbContext>;
}

/** useAdb 获取顶层 ADB 连接状态, 缺失 Provider 属于编程错误 */
export function useAdb(): AdbValue {
  const context = useContext(AdbContext);
  if (!context) throw new Error('缺少 AdbProvider');
  return context;
}