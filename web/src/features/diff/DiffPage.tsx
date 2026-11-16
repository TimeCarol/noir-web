/**
 * 职责: 导入两份 NOIR report.json 并展示逐应用差异
 * 导出: DiffPage
 * 依赖: Ant Design / core/report-diff
 * 约束: 文件只在浏览器内解析, 不上传服务器
 * 作者: timecarol
 * 日期: 2026-11-16 08:35
 * 版本: v1.0
 */
import { useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Space, Table, Tag, Typography, type TableColumnsType } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { CATEGORY_LABELS, type Category } from '../../core/models';
import { diffReports, parseReport, type AppDiff } from '../../core/report-diff';
import { errorText } from '../../lib/errors';

type Side = 'base' | 'target';

const STATUS_COLORS: Record<AppDiff['status'], string> = {
  added: 'green',
  removed: 'red',
  changed: 'gold',
  same: 'default',
};

/** DiffPage 管理两份报告的文件输入和对比结果 */
export default function DiffPage() {
  const [base, setBase] = useState<ReturnType<typeof parseReport> | null>(null);
  const [target, setTarget] = useState<ReturnType<typeof parseReport> | null>(null);
  const [names, setNames] = useState<Record<Side, string>>({ base: '', target: '' });
  const [error, setError] = useState<string | null>(null);
  const baseInput = useRef<HTMLInputElement>(null);
  const targetInput = useRef<HTMLInputElement>(null);
  const diff = useMemo(() => (base && target ? diffReports(base, target) : null), [base, target]);

  async function loadFile(side: Side, file: File | undefined) {
    if (!file) return;
    try {
      const document = parseReport(await file.text());
      if (side === 'base') setBase(document);
      else setTarget(document);
      setNames(current => ({ ...current, [side]: file.name }));
      setError(null);
    } catch (loadError) {
      setError(errorText(loadError));
    }
  }

  const columns: TableColumnsType<AppDiff> = [
    { title: '状态', dataIndex: 'status', key: 'status', width: 88, render: status => <Tag color={STATUS_COLORS[status as AppDiff['status']]}>{statusLabel(status as AppDiff['status'])}</Tag> },
    {
      title: '包名',
      dataIndex: 'pkg',
      key: 'pkg',
      width: 260,
      render: (pkg: string) => <Typography.Text copyable={{ text: pkg, tooltips: ['复制包名', '已复制'] }} ellipsis={{ tooltip: pkg }} style={{ maxWidth: '100%' }}>{pkg}</Typography.Text>,
    },
    {
      title: '分数',
      key: 'score',
      width: 150,
      render: (_, row) => row.status === 'added'
        ? row.target?.score
        : row.status === 'removed'
          ? row.base?.score
          : <span>{row.base?.score} → {row.target?.score} <Typography.Text type="secondary">({row.scoreDelta > 0 ? '+' : ''}{row.scoreDelta})</Typography.Text></span>,
    },
    {
      title: '类别',
      key: 'category',
      width: 120,
      render: (_, row) => {
        const key = row.target?.categoryKey || row.base?.categoryKey || '';
        return CATEGORY_LABELS[key as Category] ?? (key || '—');
      },
    },
    {
      title: '权限',
      key: 'permissions',
      width: 110,
      render: (_, row) => <ChangeCount added={row.permissionsAdded.length} removed={row.permissionsRemoved.length} />,
    },
    {
      title: '端点',
      key: 'endpoints',
      width: 110,
      render: (_, row) => <ChangeCount added={row.endpointsAdded.length} removed={row.endpointsRemoved.length} />,
    },
    { title: '厂商', key: 'vendor', width: 110, render: (_, row) => row.target?.vendor ?? row.base?.vendor ?? '—' },
  ];

  return (
    <div className="page-stack">
      <Card
        title="报告对比"
        extra={diff && <Space wrap><Tag>{diff.rows.length} 个应用</Tag><Tag color="gold">{diff.summary.changed} 个变化</Tag></Space>}
      >
        <div className="diff-files">
          <FileRow title="基准报告" name={names.base} model={base?.model} generatedAt={base?.generatedAt} onPick={() => baseInput.current?.click()} />
          <FileRow title="对比报告" name={names.target} model={target?.model} generatedAt={target?.generatedAt} onPick={() => targetInput.current?.click()} />
        </div>
        <input ref={baseInput} className="screen-reader-status" type="file" accept=".json,application/json" tabIndex={-1} aria-label="选择基准报告" onChange={event => { void loadFile('base', event.target.files?.[0]); event.target.value = ''; }} />
        <input ref={targetInput} className="screen-reader-status" type="file" accept=".json,application/json" tabIndex={-1} aria-label="选择对比报告" onChange={event => { void loadFile('target', event.target.files?.[0]); event.target.value = ''; }} />
        {error && <Alert type="error" showIcon title="报告读取失败" description={error} />}
      </Card>

      {diff && (
        <>
          <div className="audit-stats" aria-label="报告差异摘要">
            <div className="audit-stat"><span className="audit-stat-label">新增</span><span className="audit-stat-value">{diff.summary.added}</span></div>
            <div className="audit-stat"><span className="audit-stat-label">移除</span><span className="audit-stat-value">{diff.summary.removed}</span></div>
            <div className="audit-stat"><span className="audit-stat-label">变化</span><span className="audit-stat-value">{diff.summary.changed}</span></div>
            <div className="audit-stat"><span className="audit-stat-label">未变</span><span className="audit-stat-value">{diff.summary.same}</span></div>
          </div>
          <Card title="差异">
            <Table<AppDiff>
              rowKey="pkg"
              columns={columns}
              dataSource={diff.rows}
              scroll={{ x: 980 }}
              expandable={{ expandedRowRender: row => <DiffDetail row={row} />, rowExpandable: row => hasChanges(row) }}
              pagination={{ defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50], showTotal: total => `共 ${total} 个应用` }}
            />
          </Card>
        </>
      )}
    </div>
  );
}

/** FileRow 显示一个报告文件选择和摘要 */
function FileRow({ title, name, model, generatedAt, onPick }: { title: string; name: string; model?: string; generatedAt?: string; onPick: () => void }) {
  return (
    <section className="diff-file">
      <div className="diff-file-heading">
        <h2>{title}</h2>
        <Button icon={<UploadOutlined />} onClick={onPick}>选择 JSON</Button>
      </div>
      {name ? (
        <Typography.Text ellipsis={{ tooltip: name }} style={{ maxWidth: '100%' }}>
          {name}{model ? ` · ${model}` : ''}{generatedAt ? ` · ${generatedAt}` : ''}
        </Typography.Text>
      ) : <Typography.Text type="secondary">未选择</Typography.Text>}
    </section>
  );
}

/** DiffDetail 展示某个应用新增和移除的权限与端点 */
function DiffDetail({ row }: { row: AppDiff }) {
  return (
    <div className="diff-detail">
      <ChangeList title="新增权限" values={row.permissionsAdded} />
      <ChangeList title="移除权限" values={row.permissionsRemoved} />
      <ChangeList title="新增端点" values={row.endpointsAdded} />
      <ChangeList title="移除端点" values={row.endpointsRemoved} />
      {!hasChanges(row) && <Typography.Text type="secondary">无字段变化</Typography.Text>}
    </div>
  );
}

/** ChangeList 展示一组变化值 */
function ChangeList({ title, values }: { title: string; values: string[] }) {
  if (values.length === 0) return null;
  return <section><h3>{title} {values.length}</h3><Space size={[4, 4]} wrap>{values.map(value => <Tag key={value}>{value}</Tag>)}</Space></section>;
}

/** ChangeCount 展示新增和移除数量 */
function ChangeCount({ added, removed }: { added: number; removed: number }) {
  if (added === 0 && removed === 0) return <Typography.Text type="secondary">—</Typography.Text>;
  return <Space size={4} wrap>{added > 0 && <Tag color="green">+{added}</Tag>}{removed > 0 && <Tag color="red">-{removed}</Tag>}</Space>;
}

/** hasChanges 判断行是否有可展开的差异 */
function hasChanges(row: AppDiff): boolean {
  return row.status !== 'same';
}

/** statusLabel 将差异状态转为中文 */
function statusLabel(status: AppDiff['status']): string {
  return { added: '新增', removed: '移除', changed: '变化', same: '未变' }[status];
}