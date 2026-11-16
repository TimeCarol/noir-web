/**
 * 职责: 预览, 应用和回滚 appops 处置动作
 * 导出: ActionCard
 * 依赖: AdbProvider / Ant Design / adb/appops / storage/action-log
 * 约束: 修改必须经过 Popconfirm, 并保留修改前模式用于回滚
 * 作者: timecarol
 * 日期: 2026-11-16 09:45
 * 版本: v1.0
 */
import { useEffect, useState } from 'react';
import { Alert, Button, Card, Popconfirm, Space, Table, Tag, Typography, type TableColumnsType } from 'antd';
import { CheckOutlined, UndoOutlined } from '@ant-design/icons';
import type { ConnectedDevice } from '../../adb/types';
import { adbShell } from '../../adb/shell';
import { readAppOpMode, setAppOpMode, type AppOpMode } from '../../adb/appops';
import { appOpCommand, appOpLabel, type AppOpAction } from '../../core/actions';
import { errorText } from '../../lib/errors';
import { actionKey, loadActionLog, saveActionLog, type ActionRecord } from '../../storage/action-log';

interface ActionCardProps {
  device: ConnectedDevice;
  serial: string;
  user: string;
  actions: readonly AppOpAction[];
}

interface ActionState {
  mode: AppOpMode;
  record?: ActionRecord;
  busy: boolean;
  error?: string;
}

const MODE_LABELS: Record<AppOpMode, string> = {
  default: '默认',
  allow: '允许',
  ignore: '已限制',
  deny: '已拒绝',
  unknown: '未知',
};

const MODE_COLORS: Record<AppOpMode, string> = {
  default: 'default',
  allow: 'green',
  ignore: 'red',
  deny: 'red',
  unknown: 'gold',
};

/** ActionCard 管理 appops 动作的读取, 应用和回滚 */
export function ActionCard({ device, serial, user, actions }: ActionCardProps) {
  const [states, setStates] = useState<Record<string, ActionState>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (actions.length === 0) {
      setStates({});
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    const shell = adbShell(device.adb);
    void (async () => {
      try {
        const log = await loadActionLog(serial);
        const entries = await Promise.all(actions.map(async action => {
          const key = actionKey(action.pkg, action.op);
          const mode = await readAppOpMode(shell, action.pkg, action.op, user);
          return [key, { mode, record: log.get(key), busy: false }] as const;
        }));
        if (active) setStates(Object.fromEntries(entries));
      } catch (readError) {
        if (active) setError(errorText(readError));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [actions, device, serial, user]);

  async function apply(action: AppOpAction) {
    const key = actionKey(action.pkg, action.op);
    const current = states[key];
    if (!current) return;
    setStates(previous => ({ ...previous, [key]: { ...current, busy: true, error: undefined } }));
    try {
      const shell = adbShell(device.adb);
      const changed = await setAppOpMode(shell, action.pkg, action.op, 'ignore', user);
      if (!changed.ok) {
        setStates(previous => ({ ...previous, [key]: { ...current, busy: false, error: changed.output || '设置失败' } }));
        return;
      }
      const mode = await readAppOpMode(shell, action.pkg, action.op, user);
      const log = await loadActionLog(serial);
      const record: ActionRecord = {
        pkg: action.pkg,
        op: action.op,
        before: current.mode === 'unknown' ? 'default' : current.mode,
        appliedAt: new Date().toISOString(),
      };
      log.set(key, record);
      await saveActionLog(serial, [...log.values()]);
      setStates(previous => ({ ...previous, [key]: { mode, record, busy: false } }));
    } catch (applyError) {
      setStates(previous => ({ ...previous, [key]: { ...current, busy: false, error: errorText(applyError) } }));
    }
  }

  async function rollback(action: AppOpAction) {
    const key = actionKey(action.pkg, action.op);
    const current = states[key];
    if (!current) return;
    const target = current.record?.before && current.record.before !== 'unknown' ? current.record.before : 'default';
    setStates(previous => ({ ...previous, [key]: { ...current, busy: true, error: undefined } }));
    try {
      const shell = adbShell(device.adb);
      const changed = await setAppOpMode(shell, action.pkg, action.op, target, user);
      if (!changed.ok) {
        setStates(previous => ({ ...previous, [key]: { ...current, busy: false, error: changed.output || '回滚失败' } }));
        return;
      }
      const mode = await readAppOpMode(shell, action.pkg, action.op, user);
      const log = await loadActionLog(serial);
      log.delete(key);
      await saveActionLog(serial, [...log.values()]);
      setStates(previous => ({ ...previous, [key]: { mode, busy: false } }));
    } catch (rollbackError) {
      setStates(previous => ({ ...previous, [key]: { ...current, busy: false, error: errorText(rollbackError) } }));
    }
  }

  const columns: TableColumnsType<AppOpAction> = [
    { title: '风险', dataIndex: 'risk', key: 'risk', width: 80, render: risk => <Tag color={risk === 'HIGH' ? 'red' : risk === 'MED' ? 'gold' : 'blue'}>{risk}</Tag> },
    { title: '应用', dataIndex: 'pkg', key: 'pkg', width: 260, render: pkg => <Typography.Text copyable={{ text: pkg, tooltips: ['复制包名', '已复制'] }} ellipsis={{ tooltip: pkg }} style={{ maxWidth: '100%' }}>{pkg}</Typography.Text> },
    { title: '操作', dataIndex: 'op', key: 'op', width: 110, render: op => appOpLabel(op) },
    {
      title: '当前',
      key: 'mode',
      width: 90,
      render: (_, action) => {
        const mode = states[actionKey(action.pkg, action.op)]?.mode ?? 'unknown';
        return <Tag color={MODE_COLORS[mode]}>{loading ? '读取中' : MODE_LABELS[mode]}</Tag>;
      },
    },
    {
      title: '命令',
      key: 'command',
      render: (_, action) => {
        const command = appOpCommand(serial, user, action.pkg, action.op, 'ignore');
        return <Typography.Text code copyable={{ text: command, tooltips: ['复制命令', '已复制'] }} ellipsis={{ tooltip: command }} style={{ maxWidth: '100%' }}>{command}</Typography.Text>;
      },
    },
    {
      title: '处置',
      key: 'actions',
      width: 220,
      render: (_, action) => {
        const key = actionKey(action.pkg, action.op);
        const state = states[key];
        const applied = state?.mode === 'ignore';
        const command = appOpCommand(serial, user, action.pkg, action.op, 'ignore');
        return (
          <Space size={4} wrap>
            <Popconfirm
              title="应用此命令?"
              description={<span className="identifier">{command}</span>}
              okText="应用"
              cancelText="取消"
              onConfirm={() => void apply(action)}
            >
              <Button size="small" icon={<CheckOutlined />} disabled={loading || !state || state.busy || applied}>应用</Button>
            </Popconfirm>
            {(applied || state?.record) && (
              <Popconfirm
                title="回滚此命令?"
                description={<span className="identifier">{appOpCommand(serial, user, action.pkg, action.op, state?.record?.before ?? 'default')}</span>}
                okText="回滚"
                cancelText="取消"
                onConfirm={() => void rollback(action)}
              >
                <Button size="small" icon={<UndoOutlined />} disabled={loading || !state || state.busy}>回滚</Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Card title="设备处置" extra={<Space wrap><Tag>{actions.length} 项</Tag><Tag color="gold">写操作</Tag></Space>}>
      {error && <Alert type="error" showIcon title="读取 appops 失败" description={error} />}
      {Object.entries(states).some(([, state]) => state.error) && (
        <Alert
          type="error"
          showIcon
          title="部分动作失败"
          description={Object.entries(states).filter(([, state]) => state.error).map(([key, state]) => `${key}: ${state.error}`).join('; ')}
        />
      )}
      <Table<AppOpAction>
        rowKey={action => actionKey(action.pkg, action.op)}
        columns={columns}
        dataSource={[...actions]}
        loading={loading}
        scroll={{ x: 980 }}
        pagination={false}
      />
    </Card>
  );
}