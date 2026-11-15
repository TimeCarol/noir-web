/**
 * 职责: 引导用户完成 WebUSB 授权并显示连接结果
 * 导出: ConnectPage
 * 依赖: AdbProvider / Tango / TanStack Query / Ant Design
 * 约束: 连接只读取设备属性和包列表, 不执行任何写操作
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.5
 */
import { Alert, Button, Card, Space, Steps, Tag, Typography } from 'antd';
import { ReloadOutlined, UsbOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useAdb } from '../../app/adb-context';
import { hasWebUsb, isSecureContext } from '../../adb/connect';
import { readAndStoreDeviceInfo, readAndStorePackages } from '../../storage/device-cache';
import { DeviceSummary } from './DeviceSummary';

/** ConnectPage 组合兼容性提示, 授权步骤和设备摘要 */
export default function ConnectPage() {
  const { device, phase, failure, connect, disconnect, clearFailure } = useAdb();
  const supported = hasWebUsb() && isSecureContext();
  const busy = phase === 'requesting' || phase === 'authorizing';

  const infoQuery = useQuery({
    queryKey: ['device-info', device?.serial],
    queryFn: () => readAndStoreDeviceInfo(device!.adb, device!.serial),
    enabled: Boolean(device),
    staleTime: Infinity,
    retry: false,
  });
  const packagesQuery = useQuery({
    queryKey: ['packages', device?.serial],
    queryFn: () => readAndStorePackages(device!.adb, device!.serial),
    enabled: Boolean(device),
    staleTime: Infinity,
    retry: false,
  });

  const steps = [
    { title: '连接' },
    { title: '授权' },
    { title: '读取' },
  ];
  const currentStep = device ? 2 : phase === 'authorizing' ? 1 : 0;

  async function handleConnect() {
    await connect();
  }

  return (
    <div className="page-stack">
      <Card
        title="连接"
        extra={<Tag color={device ? 'success' : 'default'}>{device ? '已连接' : '未连接'}</Tag>}
      >
        {!isSecureContext() && (
          <Alert
            type="warning"
            showIcon
            title="当前页面不是安全上下文"
            description="WebUSB 只在 HTTPS 或 localhost 下可用, 请通过 HTTPS 打开页面"
          />
        )}
        {isSecureContext() && !hasWebUsb() && (
          <Alert
            type="warning"
            showIcon
            title="当前浏览器不支持 WebUSB"
            description="请使用 Chrome, Edge 或 Opera 桌面版, Firefox 和 Safari 无法连接 Android 设备"
          />
        )}
        {failure && (
          <Alert
            type="error"
            showIcon
            title={failure.title}
            description={
              <div className="failure-detail">
                <p>{failure.description}</p>
                <ol className="guide-list guide-list-compact">
                  {failure.steps.map(step => <li key={step}>{step}</li>)}
                </ol>
                {failure.command && (
                  <Typography.Text code copyable={{ text: failure.command, tooltips: ['复制命令', '已复制'] }}>
                    {failure.command}
                  </Typography.Text>
                )}
              </div>
            }
            action={<Button onClick={clearFailure}>关闭</Button>}
          />
        )}

        <section className="connect-panel" aria-label="连接步骤">
          <Steps current={currentStep} status={failure ? 'error' : undefined} items={steps} />
          <Space wrap>
            <Button
              type="primary"
              size="large"
              icon={<UsbOutlined />}
              loading={busy}
              disabled={!supported}
              onClick={() => void handleConnect()}
            >
              {device ? '重新选择设备' : busy ? '等待手机授权' : '选择设备'}
            </Button>
            {device && (
              <>
                <Button icon={<ReloadOutlined />} onClick={() => { void infoQuery.refetch(); void packagesQuery.refetch(); }}>
                  重新读取
                </Button>
                <Button onClick={disconnect}>断开连接</Button>
              </>
            )}
          </Space>
        </section>
      </Card>

      <DeviceSummary
        deviceName={device?.name ?? ''}
        serial={device?.serial ?? ''}
        info={infoQuery.data}
        loading={Boolean(device) && infoQuery.isPending}
      />
    </div>
  );
}