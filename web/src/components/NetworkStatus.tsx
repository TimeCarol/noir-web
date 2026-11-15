/**
 * 职责: 在页头提示当前处于离线状态
 * 导出: NetworkStatus
 * 依赖: React / Ant Design Icons
 * 约束: 只显示图标和可访问名称, 不堆叠说明文字
 * 作者: timecarol
 * 日期: 2026-11-15 23:10
 * 版本: v1.0
 */
import { useEffect, useState } from 'react';
import { DisconnectOutlined } from '@ant-design/icons';

/** NetworkStatus 监听浏览器在线状态, 离线时显示一个图标 */
export function NetworkStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (online) return null;
  return (
    <span className="network-status" role="status" aria-label="离线" title="离线">
      <DisconnectOutlined />
    </span>
  );
}