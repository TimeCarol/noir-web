/**
 * 职责: 在页头显示当前设备连接状态
 * 导出: DeviceStatus
 * 依赖: AdbProvider
 * 约束: 只显示状态, 不触发连接或断开
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.0
 */
import { useAdb } from '../app/adb-context';

/** DeviceStatus 将认证阶段压缩成一行可读状态 */
export function DeviceStatus() {
  const { device, phase } = useAdb();
  const label = phase === 'requesting'
    ? '选择设备中'
    : phase === 'authorizing'
      ? '等待手机授权'
      : device
        ? device.name || device.serial
        : '未连接';
  return (
    <span className={`device-status${device ? ' device-status-online' : ''}`} role="status" aria-live="polite">
      <span className="device-status-dot" aria-hidden="true" />
      <span className="device-status-label">{label}</span>
    </span>
  );
}