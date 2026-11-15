/**
 * 职责: 展示系统版本, 运行时, 安全状态和内核信息
 * 导出: SystemSummary
 * 依赖: Ant Design Descriptions
 * 约束: 空字符串和未知字段不展示, 不伪造系统状态
 * 作者: timecarol
 * 日期: 2026-11-16 02:00
 * 版本: v1.0
 */
import { Descriptions } from 'antd';
import type { DescriptionsProps } from 'antd';
import type { DeviceInfo } from '../../adb/types';

/** SystemSummaryProps 是系统摘要所需的只读数据 */
interface SystemSummaryProps {
  info?: DeviceInfo;
  loading: boolean;
}

/** SystemSummary 将设备快照组织成系统卡片 */
export function SystemSummary({ info, loading }: SystemSummaryProps) {
  if (!info && loading) {
    return (
      <section className="device-summary device-summary-empty" aria-label="系统">
        <h2 className="device-summary-title">系统</h2>
        <div className="device-placeholder" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => <span key={index} className="device-placeholder-row" />)}
        </div>
      </section>
    );
  }

  const items: DescriptionsProps['items'] = [];
  const add = (key: string, label: string, value: string | null | undefined, span?: 'filled') => {
    const cleaned = (value ?? '').trim();
    if (!cleaned || cleaned.toLowerCase() === 'null' || cleaned.toLowerCase() === 'unknown') return;
    items.push({ key, label, children: cleaned, span });
  };
  const addStatus = (key: string, label: string, value: boolean | undefined, yes: string, no: string) => {
    if (value === undefined) return;
    items.push({ key, label, children: value ? yes : no });
  };

  add('versionName', '版本名', info?.androidVersion);
  add('apiLevel', 'API 版本', info?.sdk);
  add('systemVersion', '系统版本号', info?.build, 'filled');
  add('buildTime', '构建时间', info?.buildTime, 'filled');
  add('deviceVersion', '设备版本号', info?.deviceVersion);
  add('securityPatch', '安全补丁级别', info?.securityPatch);
  add('baseband', '基带版本', info?.baseband, 'filled');
  add('language', '语言', info?.language);
  add('timezone', '时区', info?.timezone);
  addStatus('rooted', 'Root 权限', info?.rooted, '已 Root', '未 Root');
  add('uptime', '已开机时长', info?.uptime);
  add('partitionLayout', '分区布局', info?.partitionLayout);
  addStatus('seamlessUpdates', '无缝更新', info?.seamlessUpdates, '支持', '不支持');
  addStatus('dynamicPartitions', '动态分区', info?.dynamicPartitions, '支持', '不支持');
  addStatus('treble', 'Project Treble', info?.treble, '支持', '不支持');
  add('javaRuntime', 'Java Runtime 版本', info?.javaRuntime);
  add('javaVm', 'Java 虚拟机', info?.javaVm);
  add('javaHeap', 'Java 虚拟机堆栈大小', info?.javaHeap);
  add('kernelArch', '内核架构', info?.kernelArch);
  add('kernelVersion', '内核版本', info?.kernelVersion);
  add('openGlEs', 'OpenGL ES', info?.openGlEs);
  add('selinux', 'SELinux', info?.selinux);
  add('openssl', 'OpenSSL 版本', info?.openssl);

  return (
    <section className="device-summary" aria-label="系统">
      <div className="device-summary-heading">
        <h2 className="device-summary-title">系统</h2>
      </div>
      <Descriptions size="small" column={{ xs: 1, sm: 1, md: 2, lg: 3 }} items={items} />
    </section>
  );
}