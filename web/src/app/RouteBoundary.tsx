/**
 * 职责: 捕获懒加载页面失败并提供重新加载入口
 * 导出: RouteBoundary
 * 依赖: React error boundary / Ant Design
 * 约束: 只处理渲染和 chunk 加载错误, 不吞掉页面自身的业务状态
 * 作者: timecarol
 * 日期: 2026-11-15 23:10
 * 版本: v1.0
 */
import { Component, type ReactNode } from 'react';
import { Button, Result } from 'antd';

interface RouteBoundaryState {
  failed: boolean;
}

/** RouteBoundary 在页面 chunk 加载失败时显示可重试的结果页 */
export class RouteBoundary extends Component<{ children: ReactNode }, RouteBoundaryState> {
  state: RouteBoundaryState = { failed: false };

  static getDerivedStateFromError(): RouteBoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <Result
          status="error"
          title="页面加载失败"
          extra={<Button type="primary" onClick={() => window.location.reload()}>重新加载</Button>}
        />
      );
    }
    return this.props.children;
  }
}