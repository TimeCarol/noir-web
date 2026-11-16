/**
 * 职责: 提供 NOIR Web 的工作台导航, 主题和页面入口
 * 导出: App
 * 依赖: Ant Design / Radix 主题 / React Router
 * 约束: 桌面侧栏和移动导航共享同一组路由, 不在页面里解释设计实现
 * 作者: timecarol
 * 日期: 2026-11-15 23:55
 * 版本: v1.8
 */
import { Suspense, useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { Button, ConfigProvider, Space } from 'antd';
import {
  ApiOutlined,
  AppstoreOutlined,
  CompassOutlined,
  DesktopOutlined,
  DiffOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  MoonOutlined,
  SafetyCertificateOutlined,
  SunOutlined,
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { AdbProvider, useAdb } from './adb-context';
import { createBrandIcon } from './brand';
import { lazyWithRetry } from './lazy';
import { prefetchRoutes } from './prefetch';
import { RouteBoundary } from './RouteBoundary';
import { SidebarResizeHandle, readSidebarWidth } from './SidebarResizeHandle';
import { createTheme, type ThemeMode } from './theme';
import { DeviceStatus } from '../components/DeviceStatus';
import { NetworkStatus } from '../components/NetworkStatus';
import { RouteSkeleton } from '../components/RouteSkeleton';

const ConnectPage = lazyWithRetry(() => import('../features/connect/ConnectPage'));
const AppsPage = lazyWithRetry(() => import('../features/apps/AppsPage'));
const AuditPage = lazyWithRetry(() => import('../features/audit/AuditPage'));
const DiffPage = lazyWithRetry(() => import('../features/diff/DiffPage'));
const RoadmapPage = lazyWithRetry(() => import('../features/roadmap/RoadmapPage'));

const themes = {
  system: { label: '跟随系统', icon: <DesktopOutlined /> },
  light: { label: '浅色', icon: <SunOutlined /> },
  dark: { label: '深色', icon: <MoonOutlined /> },
};
const themeOrder: ThemeMode[] = ['system', 'light', 'dark'];
const navigation = [
  { key: '/connect', label: '连接设备', short: '连接', icon: <ApiOutlined /> },
  { key: '/apps', label: '应用列表', short: '应用', icon: <AppstoreOutlined /> },
  { key: '/audit', label: '隐私审计', short: '审计', icon: <SafetyCertificateOutlined /> },
  { key: '/diff', label: '报告对比', short: '报告', icon: <DiffOutlined /> },
  { key: '/roadmap', label: '路线图', short: '路线', icon: <CompassOutlined /> },
];

/** Shell 提供可收起的桌面导航和共享页面入口 */
function Shell({ themeMode, changeTheme }: { themeMode: ThemeMode; changeTheme: (mode: ThemeMode) => void }) {
  const location = useLocation();
  const { phase } = useAdb();
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);
  const selected = navigation.find(item => item.key === location.pathname);
  const nextTheme = themeOrder[(themeOrder.indexOf(themeMode) + 1) % themeOrder.length];
  const busy = phase === 'requesting' || phase === 'authorizing';

  useEffect(() => {
    document.title = `${selected?.label || '连接设备'} - NOIR Web`;
  }, [selected?.label]);

  return (
    <div className={`workspace${collapsed ? ' workspace-collapsed' : ''}`} style={{ '--sidebar-expanded-width': `${sidebarWidth}px` } as CSSProperties}>
      <aside className="sidebar" id="primary-sidebar">
        <NavLink to="/connect" className="brand" aria-label="NOIR Web">
          <span className="brand-mark" aria-hidden="true" />
          {!collapsed && <span className="brand-name" title="NOIR Web">NOIR Web</span>}
        </NavLink>
        <nav className="sidebar-navigation" id="primary-navigation" aria-label="主导航">
          {navigation.map(item => (
            <NavLink
              key={item.key}
              to={item.key}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link-active' : ''}`}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Button
            className="sidebar-toggle"
            variant="filled"
            color="default"
            aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
            aria-expanded={!collapsed}
            aria-controls="primary-navigation"
            icon={collapsed ? <DoubleRightOutlined /> : <DoubleLeftOutlined />}
            onClick={() => setCollapsed(value => !value)}
          >
            {!collapsed && '收起'}
          </Button>
        </div>
      </aside>
      {!collapsed && <SidebarResizeHandle width={sidebarWidth} onChange={setSidebarWidth} />}
      <div className="workspace-main">
        <header className="workspace-header">
          <h1>{selected?.label || '连接设备'}</h1>
          <Space size={8}>
            <NetworkStatus />
            <DeviceStatus />
            <Button
              aria-label={`主题设置, 当前${themes[themeMode].label}, 切换到${themes[nextTheme].label}`}
              title={`当前${themes[themeMode].label}, 切换到${themes[nextTheme].label}`}
              type="text"
              icon={themes[themeMode].icon}
              onClick={() => changeTheme(nextTheme)}
            />
          </Space>
        </header>
        <nav className="mobile-navigation" id="mobile-navigation" aria-label="移动导航">
          {navigation.map(item => <NavLink key={item.key} to={item.key}>{item.short}</NavLink>)}
        </nav>
        <main className="app-content" aria-busy={busy}>
          <RouteBoundary>
            <Suspense fallback={<RouteSkeleton />}>
              <Routes>
                <Route path="/connect" element={<ConnectPage />} />
                <Route path="/apps" element={<AppsPage />} />
                <Route path="/audit" element={<AuditPage />} />
                <Route path="/diff" element={<DiffPage />} />
                <Route path="/roadmap" element={<RoadmapPage />} />
                <Route path="*" element={<Navigate to="/connect" replace />} />
              </Routes>
            </Suspense>
          </RouteBoundary>
        </main>
      </div>
    </div>
  );
}

/** App 保存主题模式并同步 favicon, 页面和组件共享同一 Radix 色阶 */
export default function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('noir-theme');
      return saved === 'light' || saved === 'dark' ? saved : 'system';
    } catch {
      return 'system';
    }
  });
  const [systemTheme] = useState(() => window.matchMedia('(prefers-color-scheme: dark)'));
  const [systemDark, setSystemDark] = useState(systemTheme.matches);

  useEffect(() => {
    function updateSystemTheme() {
      setSystemDark(systemTheme.matches);
    }
    systemTheme.addEventListener('change', updateSystemTheme);
    return () => systemTheme.removeEventListener('change', updateSystemTheme);
  }, [systemTheme]);

  useEffect(() => {
    try {
      localStorage.setItem('noir-theme', themeMode);
    } catch {
      // 浏览器禁止持久存储时当前主题仍然有效
    }
  }, [themeMode]);

  const dark = themeMode === 'system' ? systemDark : themeMode === 'dark';

  useEffect(() => {
    prefetchRoutes();
  }, []);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    const icon = createBrandIcon(dark);
    document.documentElement.style.setProperty('--brand-icon', `url("${icon}")`);
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) favicon.href = icon;
  }, [dark]);

  return (
    <ConfigProvider locale={zhCN} button={{ autoInsertSpace: false }} theme={createTheme(dark)}>
      <HashRouter>
        <AdbProvider>
          <Shell themeMode={themeMode} changeTheme={setThemeMode} />
        </AdbProvider>
      </HashRouter>
    </ConfigProvider>
  );
}