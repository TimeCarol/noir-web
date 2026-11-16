/**
 * 职责: 展示单个应用的风险证据, Manifest 事实和端点
 * 导出: AppDetail
 * 依赖: Ant Design Descriptions / Tag / Typography
 * 约束: 只读取已计算结果, 不在展开行里发起新的设备查询
 * 作者: timecarol
 * 日期: 2026-11-15 23:55
 * 版本: v1.0
 */
import { Descriptions, Space, Tag, Typography, type DescriptionsProps } from 'antd';
import { DATA_TYPE_LABELS, type AppEntry, type DataType } from '../../core/models';
import { trackersFromEndpoints } from '../../core/trackers';
import { deepSignalLabel } from '../../core/deepscan';

/** AppDetail 渲染一个应用的完整证据 */
export function AppDetail({ app }: { app: AppEntry }) {
  const manifest = app.manifest;
  const exported = manifest?.components.filter(component => component.exported && component.enabled && component.permission === null) ?? [];
  const trackers = trackersFromEndpoints(app.endpoints);
  const leaks = Object.entries(app.leaks) as Array<[DataType, string[]]>;

  const items: DescriptionsProps['items'] = [
    { key: 'uid', label: 'UID', children: app.uid || '—' },
    { key: 'installer', label: '安装来源', children: app.installer ?? '—' },
    { key: 'shared', label: '共享 UID', children: app.sharedUid ?? '—' },
    { key: 'apk', label: 'APK', children: <span className="identifier" title={app.apkPaths.join('\n')}>{app.apkPaths.join('\n') || '—'}</span>, span: 2 },
    { key: 'data', label: '数据类别', children: app.dataTypes.length > 0 ? <Space size={[4, 4]} wrap>{app.dataTypes.map(type => <Tag key={type}>{DATA_TYPE_LABELS[type]}</Tag>)}</Space> : '—' },
    { key: 'trackers', label: 'SDK', children: trackers.length > 0 ? <Space size={[4, 4]} wrap>{trackers.map(name => <Tag key={name} color="blue">{name}</Tag>)}</Space> : '—' },
    { key: 'target', label: 'Target SDK', children: manifest?.targetSdk ?? '—' },
    { key: 'cleartext', label: '明文流量', children: boolText(manifest?.cleartext) },
    { key: 'backup', label: '允许备份', children: boolText(manifest?.allowBackup) },
    { key: 'debuggable', label: '可调试', children: boolText(manifest?.debuggable) },
    { key: 'network', label: '网络安全配置', children: manifest ? boolText(manifest.networkSecurityConfig) : '—' },
    { key: 'exported', label: '无权限导出组件', children: manifest ? String(exported.length) : '—' },
  ];

  return (
    <div className="audit-detail">
      <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }} items={items} />
      {leaks.length > 0 && (
        <section className="audit-detail-section">
          <h2>泄露路径</h2>
          <ul className="audit-plain-list">
            {leaks.map(([type, hosts]) => <li key={type}><strong>{DATA_TYPE_LABELS[type]}</strong><span>→</span><span>{hosts.join(', ')}</span></li>)}
          </ul>
        </section>
      )}
      {exported.length > 0 && (
        <section className="audit-detail-section">
          <h2>无权限导出组件</h2>
          <ul className="audit-plain-list">
            {exported.slice(0, 20).map(component => (
              <li key={`${component.kind}:${component.name}`}>
                <Tag>{component.kind}</Tag>
                <span className="identifier">{component.name}</span>
                {component.authorities && <span className="identifier">{component.authorities}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {(app.deepSignals?.length ?? 0) > 0 && (
        <section className="audit-detail-section">
          <h2>DEX 信号</h2>
          <Space size={[4, 4]} wrap>{app.deepSignals!.map(signal => <Tag key={signal} color="gold">{deepSignalLabel(signal)}</Tag>)}</Space>
        </section>
      )}
      {app.permissions.length > 0 && (
        <section className="audit-detail-section">
          <h2>敏感权限</h2>
          <Space size={[4, 4]} wrap>{app.permissions.map(permission => <Tag key={permission}>{permission}</Tag>)}</Space>
        </section>
      )}
      {app.endpoints.length > 0 && (
        <section className="audit-detail-section">
          <h2>端点</h2>
          <ul className="audit-endpoint-list">
            {app.endpoints.slice(0, 50).map(endpoint => (
              <li key={endpoint}>
                <Typography.Text code copyable={{ text: endpoint, tooltips: ['复制端点', '已复制'] }} ellipsis={{ tooltip: endpoint }}>
                  {endpoint}
                </Typography.Text>
              </li>
            ))}
          </ul>
          {app.endpoints.length > 50 && <Typography.Text type="secondary">另有 {app.endpoints.length - 50} 个</Typography.Text>}
        </section>
      )}
    </div>
  );
}

/** boolText 把三态布尔转为短文本 */
function boolText(value: boolean | null | undefined): string {
  return value === null || value === undefined ? '未知' : value ? '是' : '否';
}