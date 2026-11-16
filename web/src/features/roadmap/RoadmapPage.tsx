/**
 * 职责: 用里程碑展示当前实现阶段和后续范围
 * 导出: RoadmapPage
 * 依赖: Ant Design Card / Steps
 * 约束: 只展示阶段和范围, 不堆叠说明文字
 * 作者: timecarol
 * 日期: 2026-11-15 22:06
 * 版本: v1.2
 */
import { Card, Steps } from 'antd';

const milestones = [
  { title: 'M0 连接', status: 'finish' as const, content: 'WebUSB, ADB, 设备, 包列表' },
  { title: 'M1 数据', status: 'finish' as const, content: '权限, 端点, Manifest' },
  { title: 'M2 报告', status: 'finish' as const, content: 'HTML, diff, 缓存' },
  { title: 'M3 处置', status: 'process' as const, content: 'WASM, HTTPS 验收' },
];

/** RoadmapPage 用紧凑时间线表达实现边界 */
export default function RoadmapPage() {
  return (
    <Card title="里程碑">
      <Steps orientation="vertical" current={3} items={milestones} />
    </Card>
  );
}