/**
 * 职责: 展示已安装应用的包名和基础 APK 路径
 * 导出: AppsPage
 * 依赖: AdbProvider / TanStack Query / Ant Design Table
 * 约束: M0 只读取基础 APK 清单, 不推断权限, 端点或风险分
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.4
 */
import { useMemo, useState } from 'react';
import { Alert, Button, Card, Input, Result, Space, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAdb } from '../../app/adb-context';
import { listPackages } from '../../adb/packages';
import type { PackageEntry } from '../../adb/types';
import { errorText } from '../../lib/errors';

const columns: TableColumnsType<PackageEntry> = [
  {
    title: '包名',
    dataIndex: 'packageName',
    key: 'packageName',
    width: 360,
    render: (packageName: string) => (
      <Typography.Text copyable={{ text: packageName, tooltips: ['复制包名', '已复制'] }} ellipsis={{ tooltip: packageName }} style={{ maxWidth: '100%' }}>
        {packageName}
      </Typography.Text>
    ),
  },
  {
    title: '基础 APK 路径',
    dataIndex: 'apkPath',
    key: 'apkPath',
    render: (apkPath: string) => <span className="identifier" title={apkPath}>{apkPath}</span>,
  },
];

/** AppsPage 只在已连接设备后读取包列表, 搜索仅过滤当前内存结果 */
export default function AppsPage() {
  const { device } = useAdb();
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['packages', device?.serial],
    queryFn: () => listPackages(device!.adb),
    enabled: Boolean(device),
    staleTime: Infinity,
    retry: false,
  });

  const rows = useMemo(() => {
    const packages = query.data ?? [];
    const keyword = search.trim().toLowerCase();
    if (!keyword) return packages;
    return packages.filter(item => item.packageName.toLowerCase().includes(keyword) || item.apkPath.toLowerCase().includes(keyword));
  }, [query.data, search]);

  if (!device) {
    return (
      <Result
        status="info"
        title="未连接设备"
        extra={<Link to="/connect"><Button type="primary">连接设备</Button></Link>}
      />
    );
  }

  return (
    <Card
      title="已安装应用"
      extra={<Space><Tag>只读</Tag><Tag>{query.data?.length ?? 0} 个</Tag></Space>}
    >
      <div className="package-toolbar">
        <Input
          allowClear={{ label: '清除搜索' }}
          prefix={<SearchOutlined />}
          placeholder="搜索包名或 APK 路径"
          aria-label="搜索包名或 APK 路径"
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
        <Typography.Text type="secondary">设备 {device.name || device.serial}</Typography.Text>
      </div>
      {query.error && (
        <Alert
          type="error"
          showIcon
          title="读取应用列表失败"
          description={errorText(query.error)}
          action={<Button onClick={() => void query.refetch()}>重试</Button>}
        />
      )}
      <Table<PackageEntry>
        rowKey="packageName"
        columns={columns}
        dataSource={rows}
        loading={query.isPending}
        scroll={{ x: 860 }}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50],
          showTotal: total => `共 ${total} 个应用`,
        }}
      />
    </Card>
  );
}