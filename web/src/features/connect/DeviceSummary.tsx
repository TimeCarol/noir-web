/**
 * 职责: 展示已连接设备的型号, 系统版本和应用数量
 * 导出: DeviceSummary
 * 依赖: Ant Design Descriptions / Typography
 * 约束: 读取中的字段显示占位, 不伪造型号或版本
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.3
 */
import { Descriptions, Tag, Typography } from 'antd';
import type { DescriptionsProps } from 'antd';
import type { DeviceInfo } from '../../adb/types';
import { deviceLabel, valueOrDash } from '../../lib/format';

/** DeviceSummaryProps 是设备摘要所需的只读数据 */
interface DeviceSummaryProps {
  deviceName: string;
  serial: string;
  info?: DeviceInfo;
  packageCount?: number;
  loading: boolean;
}

/** DeviceSummary 将连接结果组织成可扫描的字段列表 */
export function DeviceSummary({ deviceName, serial, info, packageCount, loading }: DeviceSummaryProps) {
  if (!serial) {
    return (
      <section className="device-summary device-summary-empty" aria-label="设备信息">
        <h2 className="device-summary-title">设备信息</h2>
        <div className="device-placeholder" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => <span key={index} className="device-placeholder-row" />)}
        </div>
      </section>
    );
  }
  const items: DescriptionsProps['items'] = [
    { key: 'name', label: '设备', children: deviceLabel(deviceName, serial) },
    { key: 'serial', label: '序列号', children: <Typography.Text code copyable={{ text: serial, tooltips: ['复制序列号', '已复制'] }}>{serial}</Typography.Text> },
    { key: 'android', label: 'Android', children: info ? `${valueOrDash(info.androidVersion)} (SDK ${valueOrDash(info.sdk)})` : '—' },
    { key: 'build', label: '构建', children: valueOrDash(info?.build) },
    { key: 'abi', label: 'ABI', children: valueOrDash(info?.abi) },
    { key: 'packages', label: '应用', children: packageCount == null ? '—' : `${packageCount} 个` },
    { key: 'fingerprint', label: '指纹', children: <span className="identifier" title={info?.fingerprint}>{valueOrDash(info?.fingerprint)}</span> },
  ];
  return (
    <section className="device-summary" aria-label="设备信息">
      <div className="device-summary-heading">
        <h2 className="device-summary-title">设备信息</h2>
        <Tag color={loading ? 'processing' : 'success'}>{loading ? '读取中' : '已连接'}</Tag>
      </div>
      <Descriptions column={1} size="small" items={items} />
    </section>
  );
}