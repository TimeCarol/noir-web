/**
 * 职责: 验证应用详情中的 Manifest, 泄露路径和端点展示
 * 导出: 测试用例
 * 依赖: Testing Library
 * 约束: 使用合成应用, 不发起设备查询
 * 作者: timecarol
 * 日期: 2026-11-16 00:05
 * 版本: v1.0
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AppEntry } from '../../core/models';
import { AppDetail } from './AppDetail';

const app: AppEntry = {
  pkg: 'com.example.alpha',
  uid: '10200',
  isSystem: false,
  debuggable: false,
  installer: 'com.android.vending',
  permissions: ['READ_SMS', 'PACKAGE_USAGE_STATS'],
  endpoints: ['https://collect.example.com/report'],
  score: 7,
  category: 'TELEMETRY',
  vendor: 'Example',
  sharedUid: null,
  dataTypes: ['SMS', 'APPS'],
  leaks: { SMS: ['collect.example.com'] },
  manifest: {
    components: [
      { kind: 'service', name: '.SyncService', exported: true, permission: null, authorities: null, enabled: true },
      { kind: 'activity', name: '.MainActivity', exported: false, permission: null, authorities: null, enabled: true },
    ],
    allowBackup: true,
    cleartext: false,
    debuggable: false,
    targetSdk: '34',
    networkSecurityConfig: true,
  },
  apkPaths: ['/data/app/alpha/base.apk'],
};

describe('AppDetail', () => {
  it('展示 Manifest 事实, 无权限导出组件和泄露路径', () => {
    render(<AppDetail app={app} />);
    expect(screen.getByText('Target SDK')).toBeInTheDocument();
    expect(screen.getByText('34')).toBeInTheDocument();
    expect(screen.getByText('.SyncService')).toBeInTheDocument();
    expect(screen.getAllByText('短信').length).toBeGreaterThan(0);
    expect(screen.getByText('https://collect.example.com/report')).toBeInTheDocument();
    expect(screen.getByText('READ_SMS')).toBeInTheDocument();
  });
});