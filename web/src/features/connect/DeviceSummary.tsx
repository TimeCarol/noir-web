/**
 * 职责: 展示已连接设备的型号, 系统标识, 网络和设备标识
 * 导出: DeviceSummary
 * 依赖: Ant Design Descriptions / Typography
 * 约束: 空字符串, null 和 unknown 字段不展示, 不伪造设备数据
 * 作者: timecarol
 * 日期: 2026-11-16 01:45
 * 版本: v1.5
 */
import { Descriptions, Tag, Typography } from 'antd';
import type { DescriptionsProps } from 'antd';
import type { DeviceInfo } from '../../adb/types';

/** DeviceSummaryProps 是设备摘要所需的只读数据 */
interface DeviceSummaryProps {
  deviceName: string;
  serial: string;
  info?: DeviceInfo;
  loading: boolean;
}

/** DeviceSummary 将连接结果组织成可扫描的字段列表 */
export function DeviceSummary({ deviceName, serial, info, loading }: DeviceSummaryProps) {
  if (!serial) {
    return (
      <section className="device-summary device-summary-empty" aria-label="设备">
        <h2 className="device-summary-title">设备</h2>
        <div className="device-placeholder" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => <span key={index} className="device-placeholder-row" />)}
        </div>
      </section>
    );
  }

  const items: DescriptionsProps['items'] = [];
  const add = (key: string, label: string, value: string | null | undefined) => {
    const cleaned = (value ?? '').trim();
    if (!cleaned || cleaned.toLowerCase() === 'null' || cleaned.toLowerCase() === 'unknown') return;
    items.push({ key, label, children: cleaned });
  };

  add('deviceName', '设备名称', info?.deviceName || deviceName);
  add('model', '型号', info?.model);
  add('manufacturer', '制造商', info?.manufacturer);
  add('device', '设备', info?.device);
  add('board', '主板', info?.board);
  add('platform', '平台', info?.platform);
  add('brand', '品牌', info?.brand);
  add('googleAdId', '谷歌广告ID', info?.googleAdId);
  add('androidId', '安卓设备ID', info?.androidId);
  add('serialNumber', '硬件序列号', info?.serialNumber || serial);
  const fingerprint = info?.fingerprint?.trim();
  if (fingerprint) {
    items.push({
      key: 'fingerprint',
      label: '设备指纹',
      span: 'filled',
      children: <Typography.Text className="identifier device-fingerprint" title={fingerprint} ellipsis={{ tooltip: fingerprint }}>{fingerprint}</Typography.Text>,
    });
  }
  add('signalType', '设备信号类型', info?.signalType);
  add('carrier', '运营商', info?.carrier);
  add('networkType', '网络类型', info?.networkType);
  add('wifiMac', 'WLAN MAC 地址', info?.wifiMac);
  add('bluetoothMac', '蓝牙 MAC 地址', info?.bluetoothMac);
  if (info?.usbDebugging !== undefined && info.usbDebugging !== null) {
    add('usbDebugging', 'USB调试', info.usbDebugging ? '已开启' : '已关闭');
  }

  return (
    <section className="device-summary" aria-label="设备">
      <div className="device-summary-heading">
        <h2 className="device-summary-title">设备</h2>
        <Tag color={loading ? 'processing' : 'success'}>{loading ? '读取中' : '已连接'}</Tag>
      </div>
      <Descriptions size="small" column={{ xs: 1, sm: 1, md: 2, lg: 3 }} items={items} />
    </section>
  );
}