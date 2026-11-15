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
## 2026-11-16 M1 本地记录

已运行:

- `bash scripts/test.sh fast`: Ant Design 导入检查, TypeScript 类型检查, Oxlint, 70 项组件/单元测试, production build, gzip/brotli 预压缩, 400 KiB gzip (预算 410 KiB)
- `bash scripts/test.sh viewports`: 39 个视口通过, 离线重载和 3G 弱网首屏通过
- 真机 WebUSB 全量审计: Xiaomi MI 6, Android 14, SDK 34, Chrome 157 / macOS; 352 个包, 161 个候选应用, 11,701 个端点, 44 条建议; 全量扫描约 8 分钟
- 真机 UI: 审计进度, 取消, 应用详情展开, 处置建议, 域名三档和报告导出按钮可用; 修复设备端脚本包名变量后, 进度按包递增; 161 个应用的 Manifest 由真机 base64 传输后解析
- 同一 `scanPackages` 代码路径经 adb 定向扫描一个系统浏览器应用: 端点和 Manifest 组件均非空; 用于在浏览器自动化无法弹出 USB 选择器时验证解析链路
- OPFS 真实浏览器验证: 在 127.0.0.1 Chrome 中写入并读取 JSON/设备扫描记录, 清理探针目录; `navigator.storage.getDirectory()` 可用
- 真实数据测试: MI 6 裁剪 dumpsys 样本验证共享 UID 和权限隔离, 公开 AOSP Tag 系统 APK 的 7052 字节 Manifest 验证 AXML
- 合成测试覆盖: dumpsys 重复块和共享 UID, 合成 AXML, DEX URL, 远程 ZIP 中央目录, 候选过滤, 评分, 报告 JSON/Markdown/CSV 和域名分档
- USB 中断测试: exec/stream 在 disconnect promise 或空闲超时后立即拒绝, 扫描保留最后进度, 页面显示重新连接
- 远程 ZIP 回退在真实系统 APK 上通过: `tail`/`head` 读取中央目录, `DecompressionStream` 解压 Manifest 和 DEX

未运行:

- 没有 `unzip`/`strings` 的整机环境; 回退函数已在真实 APK 上验证
- Android 8/9 和更多厂商 ROM 的 `dumpsys` 格式
- Windows WinUSB 和 Linux udev 矩阵
- 长扫描期间的标签页节流和休眠
- 真实物理拔线中途断开的 WebUSB 手工复验
