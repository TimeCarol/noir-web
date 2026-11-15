/**
 * 职责: 运行设备隐私审计, 展示风险证据并导出 NOIR 兼容报告
 * 导出: AuditPage
 * 依赖: AdbProvider / TanStack Query / Ant Design / core/scan
 * 约束: 扫描只在用户点击后开始, 取消时立即中止 ADB 流
 * 作者: timecarol
 * 日期: 2026-11-15 23:55
 * 版本: v1.0
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Input,
  Progress,
  Result,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  type TableColumnsType,
} from 'antd';
import {
  DownloadOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAdb } from '../../app/adb-context';
import { RouteSkeleton } from '../../components/RouteSkeleton';
import { readDeviceInfo } from '../../adb/device';
import { listPackages } from '../../adb/packages';
import { adbShell } from '../../adb/shell';
import { downloadText } from '../../lib/download';
import { errorText } from '../../lib/errors';
import {
  ACTION_LABELS,
  CATEGORY_LABELS,
  type AppEntry,
  type Recommendation,
  type ScanResult,
} from '../../core/models';
import { domainExport, downloadName, reportCsv, reportJson, reportMarkdown } from '../../core/report';
import { scanPackages, type ScanProgress } from '../../core/scan';
import { trackersFromEndpoints } from '../../core/trackers';
import { AppDetail } from './AppDetail';

type ScanStatus = 'idle' | 'running' | 'done' | 'error';

const PHASE_LABELS: Record<ScanProgress['phase'], string> = {
  dumpsys: '读取包信息',
  filter: '筛选候选',
  scan: '分析 APK',
  report: '生成结果',
  done: '完成',
};

const RISK_COLORS: Record<Recommendation['risk'], string> = {
  HIGH: 'red',
  MED: 'gold',
  LOW: 'blue',
};

/** AuditPage 管理一次扫描的输入, 进度, 结果和导出 */
export default function AuditPage() {
  const { device } = useAdb();
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [minScore, setMinScore] = useState(0);
  const [search, setSearch] = useState('');
  const controllerRef = useRef<AbortController | null>(null);

  const infoQuery = useQuery({
    queryKey: ['device-info', device?.serial],
    queryFn: () => readDeviceInfo(device!.adb),
    enabled: Boolean(device),
    staleTime: Infinity,
    retry: false,
  });
  const packagesQuery = useQuery({
    queryKey: ['packages', device?.serial],
    queryFn: () => listPackages(device!.adb),
    enabled: Boolean(device),
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => () => controllerRef.current?.abort(), []);

  const rows = useMemo(() => {
    if (!result) return [];
    const keyword = search.trim().toLowerCase();
    if (!keyword) return result.apps;
    return result.apps.filter(app => app.pkg.toLowerCase().includes(keyword)
      || (app.vendor ?? '').toLowerCase().includes(keyword)
      || CATEGORY_LABELS[app.category].includes(keyword)
      || trackersFromEndpoints(app.endpoints).some(name => name.toLowerCase().includes(keyword)));
  }, [result, search]);

  const domains = useMemo(() => result ? domainExport(result) : null, [result]);
  const running = status === 'running';
  const ready = Boolean(device && infoQuery.data && packagesQuery.data) && !running;
  const endpointCount = result?.apps.reduce((sum, app) => sum + app.endpoints.length, 0) ?? 0;

  async function startScan() {
    if (!device || !infoQuery.data || !packagesQuery.data) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus('running');
    setResult(null);
    setError(null);
    setNotice(null);
    setProgress({ phase: 'dumpsys', done: 0, total: 0 });
    try {
      const scan = await scanPackages({
        shell: adbShell(device.adb),
        serial: device.serial,
        model: infoQuery.data.model,
        product: infoQuery.data.manufacturer,
        info: infoQuery.data,
        packages: packagesQuery.data,
        host: typeof navigator === 'undefined' ? 'browser' : navigator.userAgent,
      }, {
        minScore,
        limit: 500,
        signal: controller.signal,
        onProgress: setProgress,
      });
      setResult(scan);
      setStatus('done');
    } catch (scanError) {
      if (controller.signal.aborted) {
        setStatus('idle');
        setProgress(null);
        setNotice('扫描已停止');
      } else {
        setStatus('error');
        setError(errorText(scanError));
      }
    }
  }

  function stopScan() {
    controllerRef.current?.abort();
  }

  if (!device) {
    return (
      <Result
        status="info"
        title="未连接设备"
        extra={<Link to="/connect"><Button type="primary">连接设备</Button></Link>}
      />
    );
  }

  if (infoQuery.error || packagesQuery.error) {
    return (
      <Card title="隐私审计">
        <Alert
          type="error"
          showIcon
          title="读取设备信息失败"
          description={errorText(infoQuery.error ?? packagesQuery.error)}
          action={<Button icon={<ReloadOutlined />} onClick={() => { void infoQuery.refetch(); void packagesQuery.refetch(); }}>重试</Button>}
        />
      </Card>
    );
  }

  if (infoQuery.isPending || packagesQuery.isPending) {
    return (
      <Card title="隐私审计">
        <RouteSkeleton />
      </Card>
    );
  }

  const recommendationColumns: TableColumnsType<Recommendation> = [
    { title: '风险', dataIndex: 'risk', key: 'risk', width: 80, render: risk => <Tag color={RISK_COLORS[risk as Recommendation['risk']]}>{risk}</Tag> },
    { title: '动作', dataIndex: 'action', key: 'action', width: 180, render: action => ACTION_LABELS[action as Recommendation['action']] },
    { title: '包名', dataIndex: 'pkg', key: 'pkg', width: 280, render: pkg => <Typography.Text copyable={{ text: pkg, tooltips: ['复制包名', '已复制'] }} ellipsis={{ tooltip: pkg }} style={{ maxWidth: '100%' }}>{pkg}</Typography.Text> },
    { title: '原因', dataIndex: 'reason', key: 'reason' },
    { title: '执行', dataIndex: 'autoSafe', key: 'autoSafe', width: 90, render: safe => <Tag color={safe ? 'green' : 'default'}>{safe ? '可自动' : '需确认'}</Tag> },
  ];

  const appColumns: TableColumnsType<AppEntry> = [
    { title: '分数', dataIndex: 'score', key: 'score', width: 80, sorter: (left, right) => left.score - right.score },
    { title: '包名', dataIndex: 'pkg', key: 'pkg', width: 280, render: pkg => <Typography.Text copyable={{ text: pkg, tooltips: ['复制包名', '已复制'] }} ellipsis={{ tooltip: pkg }} style={{ maxWidth: '100%' }}>{pkg}</Typography.Text> },
    { title: '类别', dataIndex: 'category', key: 'category', width: 120, render: category => <Tag>{CATEGORY_LABELS[category as AppEntry['category']]}</Tag> },
    { title: '厂商', dataIndex: 'vendor', key: 'vendor', width: 110, render: vendor => vendor ?? '—' },
    { title: '来源', dataIndex: 'isSystem', key: 'isSystem', width: 80, render: system => <Tag color={system ? 'gold' : 'default'}>{system ? '系统' : '用户'}</Tag> },
    { title: '权限', dataIndex: 'permissions', key: 'permissions', width: 80, render: permissions => permissions.length },
    { title: '端点', dataIndex: 'endpoints', key: 'endpoints', width: 80, render: endpoints => endpoints.length },
    {
      title: 'SDK',
      key: 'trackers',
      width: 180,
      render: (_, app) => {
        const names = trackersFromEndpoints(app.endpoints);
        if (names.length === 0) return '—';
        return <Space size={[4, 4]} wrap>{names.slice(0, 2).map(name => <Tag key={name} color="blue">{name}</Tag>)}{names.length > 2 && <Tag>+{names.length - 2}</Tag>}</Space>;
      },
    },
  ];

  return (
    <div className="page-stack">
      <Card
        title="隐私审计"
        extra={<Space wrap><Tag>{packagesQuery.data.length} 个应用</Tag>{result && <Tag color="blue">{result.apps.length} 个命中</Tag>}</Space>}
      >
        <div className="audit-toolbar">
          <Space wrap>
            <Button
              type="primary"
              icon={<SafetyCertificateOutlined />}
              loading={running}
              disabled={!ready}
              onClick={() => void startScan()}
            >
              {running ? '扫描中' : result ? '重新扫描' : '开始扫描'}
            </Button>
            {running && <Button icon={<StopOutlined />} onClick={stopScan}>停止</Button>}
            <Select
              aria-label="最低风险分"
              value={minScore}
              disabled={running}
              onChange={setMinScore}
              options={[0, 5, 10, 15].map(value => ({ value, label: `最低分 ${value}` }))}
            />
          </Space>
          {running && progress && <Typography.Text type="secondary">{phaseText(progress)}</Typography.Text>}
        </div>
        {running && <Progress percent={progressPercent(progress)} status="active" />}
        {error && (
          <Alert
            type="error"
            showIcon
            title="扫描失败"
            description={error}
            action={<Button onClick={() => void startScan()}>重试</Button>}
          />
        )}
        {notice && <Alert type="info" showIcon title={notice} />}
      </Card>

      {result && (
        <>
          {result.failed.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title={`${result.failed.length} 个应用未能读取 APK`}
              description={result.failed.slice(0, 20).join(', ')}
            />
          )}
          <div className="audit-stats" aria-label="扫描摘要">
            <div className="audit-stat"><Statistic title="扫描包数" value={result.packageCount} /></div>
            <div className="audit-stat"><Statistic title="命中应用" value={result.apps.length} /></div>
            <div className="audit-stat"><Statistic title="端点" value={endpointCount} /></div>
            <div className="audit-stat"><Statistic title="建议" value={result.recommendations.length} /></div>
          </div>

          <Card
            title="处置建议"
            extra={<Typography.Text type="secondary">设备 {device.name || device.serial}</Typography.Text>}
          >
            <Table<Recommendation>
              rowKey={item => `${item.pkg}|${item.action}`}
              columns={recommendationColumns}
              dataSource={result.recommendations}
              scroll={{ x: 860 }}
              pagination={{ pageSize: 10, hideOnSinglePage: true, showTotal: total => `共 ${total} 条` }}
              locale={{ emptyText: '无建议' }}
            />
          </Card>

          <Card
            title="应用"
            extra={<Space wrap><Tag>{rows.length} 行</Tag></Space>}
          >
            <div className="audit-app-toolbar">
              <Input
                allowClear={{ label: '清除搜索' }}
                prefix={<SearchOutlined />}
                placeholder="搜索包名, 厂商, 类别或 SDK"
                aria-label="搜索审计结果"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <Space wrap>
                <Button icon={<DownloadOutlined />} onClick={() => downloadText(reportJson(result), downloadName(result, 'json'), 'application/json')}>JSON</Button>
                <Button icon={<DownloadOutlined />} onClick={() => downloadText(reportMarkdown(result), downloadName(result, 'md'), 'text/markdown')}>Markdown</Button>
                <Button icon={<DownloadOutlined />} onClick={() => downloadText(reportCsv(result), downloadName(result, 'csv'), 'text/csv')}>CSV</Button>
              </Space>
            </div>
            <Table<AppEntry>
              rowKey="pkg"
              columns={appColumns}
              dataSource={rows}
              scroll={{ x: 1100 }}
              expandable={{ expandedRowRender: app => <AppDetail app={app} /> }}
              pagination={{
                defaultPageSize: 20,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50],
                showTotal: total => `共 ${total} 个应用`,
              }}
              locale={{ emptyText: '无命中应用' }}
            />
          </Card>

          {domains && (
            <Card title="域名">
              <div className="audit-domains">
                <DomainGroup title="可拦截" values={domains.trackers} color="red" />
                <DomainGroup title="待复核" values={domains.review} color="gold" />
                <DomainGroup title="功能域名" values={domains.functional} color="blue" />
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/** DomainGroup 展示一组域名的标签或空状态 */
function DomainGroup({ title, values, color }: { title: string; values: string[]; color: string }) {
  return (
    <section className="audit-domain-group">
      <h2>{title} <Typography.Text type="secondary">{values.length}</Typography.Text></h2>
      {values.length > 0
        ? <Space size={[4, 4]} wrap>{values.map(value => <Tag key={value} color={color}>{value}</Tag>)}</Space>
        : <Typography.Text type="secondary">无</Typography.Text>}
    </section>
  );
}

/** phaseText 生成当前阶段和逐包进度文本 */
function phaseText(progress: ScanProgress | null): string {
  if (!progress) return '';
  if (progress.phase === 'scan') return `${PHASE_LABELS.scan} ${progress.done}/${progress.total}`;
  return PHASE_LABELS[progress.phase];
}

/** progressPercent 将阶段和逐包进度映射为单条进度条 */
function progressPercent(progress: ScanProgress | null): number {
  if (!progress) return 0;
  if (progress.phase === 'dumpsys') return 4;
  if (progress.phase === 'filter') return 8;
  if (progress.phase === 'scan') return progress.total === 0 ? 12 : 12 + Math.round((progress.done / progress.total) * 83);
  if (progress.phase === 'report') return 97;
  return 100;
}