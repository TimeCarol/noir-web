# 交接与复盘

## 串行切换

同一工作目录一次只让一个 Agent 修改. 并行任务使用独立 worktree, 不共享未提交的 `web/src` 改动.

交接时写清:

- 当前任务和未完成项
- 修改的目录和关键文件
- 已运行命令和真实结果
- 未运行的真机、浏览器和部署检查
- 下一步的最小动作

## 错误复盘

同一类错误再次出现时, 先把它放到已有结构、类型或测试上, 不新增全局禁令.

优先顺序:

1. 能用类型表达的条件放进 TypeScript
2. 能用纯函数测试的表达放进 `*.test.ts`
3. 能用组件测试的表达放进 `*.test.tsx`
4. 只有无法自动化的系统条件才写进本文件

## 真机记录

真机验收使用以下格式:

```text
设备: 厂商 + 型号
系统: Android 版本 + SDK
主机: macOS / Windows / Linux + 版本
浏览器: Chrome / Edge + 版本
连接: 成功 / 失败
失败现象: 原始错误和发生步骤
```

没有真机记录时, 交付说明写 `real-device: 未运行`, 不写"已支持所有设备".

## 2026-11-15 M0 本地记录

已运行:

- `bash scripts/test.sh full`: Ant Design 导入检查, TypeScript 类型检查, Oxlint, 21 项组件/单元测试, production build 通过
- `bash scripts/test.sh viewports`: 39 个视口通过, 覆盖 280px 到 5120px 宽和 568px 到 2160px 高; 离线重载和 3G 弱网首屏通过
- 构建预压缩: gzip + brotli, 无 sourcemap, gzip 合计 374 KiB (预算 400 KiB)
- Chrome DevTools: WebUSB 连接/授权/设备信息/352 个应用/搜索/断开, 应用和路线图导航, 主题三态切换与持久化, 侧栏拖拽与收起展开, 复制命令反馈, 1440/390/320 布局无横向溢出
- 真机 WebUSB: Xiaomi MI 6, Android 14, SDK 34, Chrome 157 / macOS; 设备信息正确, 应用列表 352 个包, 搜索 chrome 得到 1 个结果, 断开后回到未连接
- Lighthouse snapshot: Accessibility 100, Best Practices 100, SEO 100, Agentic Browsing 67 (只缺可选 ARD manifest)
- 真实设备 Xiaomi MI 6, Android 14, SDK 34: `getprop` 属性可读, `pm list packages -f` 共 352 个包
- 用真实 `pm list packages -f` 输出验证 `parsePackageList`: 352 个包, 首项 `android`, 末项 `xzr.perfmon`

未运行:

- Windows WinUSB 驱动矩阵
- Linux udev 规则和发行版差异
- 厂商 ROM 的 `dumpsys` 和 `pm` 输出差异
- 长扫描时的标签页节流和休眠
- M1 远程 ZIP 读取和 AXML 解析

真机 WebUSB 复验步骤:

1. `adb kill-server`
2. 在 Chrome 打开 `http://127.0.0.1:5174`
3. 点击选择设备, 选中 Xiaomi MI 6
4. 在手机上允许 USB 调试, 勾选一律允许
5. 确认设备信息出现, 应用列表显示 352 个包
6. 断开连接, 确认页面回到未连接状态

2026-11-15 已按上述步骤通过一次, 当前记录为 `real-device: passed`