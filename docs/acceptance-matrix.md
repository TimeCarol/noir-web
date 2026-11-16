# 验收矩阵

本文件记录 NOIR Web 的自动化、浏览器、真机和部署验收边界。状态含义：

- **通过**：本轮或已记录的同一版本上有实际证据
- **部分**：代码/配置已就绪，但只覆盖了部分环境
- **未执行**：没有对应环境或还没有跑

## 环境

| 项目 | 值 |
| --- | --- |
| 日期 | 2026-11-16 |
| 主机 | macOS 14.8.4（Apple Silicon） |
| 浏览器 | Google Chrome 157.0.8103.78 |
| 设备 | Xiaomi MI 6，Android 14，SDK 34 |
| WebUSB | 通过 USB 数据线，Chrome 桌面版 |
| 构建 | Vite 8，生产构建，gzip 416 KiB，预算 425 KiB |

## 自动化矩阵

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| TypeScript | 通过 | `npm run typecheck` |
| Oxlint | 通过 | `npm run lint` |
| 单元/组件测试 | 通过 | `npm test`，86 项 |
| Ant Design 导入边界 | 通过 | `scripts/check-antd-entry.mjs` |
| Ant Design 废弃属性 | 通过 | `scripts/check-antd-usage.mjs` |
| 生产构建 | 通过 | `npm run build` |
| gzip 预算 | 通过 | gzip 416 KiB，预算 425 KiB |
| 无 source map | 通过 | `scripts/check-build.mjs` |
| gzip/brotli 预压缩 | 通过 | 36 个 `.gz`/`.br` 文件 |
| 39 视口矩阵 | 通过 | `web/scripts/viewport-check.mjs` |
| 离线重载 | 通过 | 390×844，Service Worker |
| 弱 3G 首屏 | 通过 | 约 2.5 秒，180 KiB/s、250ms latency |

### 视口覆盖

| 类别 | 覆盖 |
| --- | --- |
| 超宽屏 | 5120、3440 |
| 4K/2K/1080p/720p | 3840、2560、1920、1280 |
| 笔记本 | 1366、1440、1512、1680、1920、2560 |
| 平板 | 768、1024、820、1180、834、1194、800、1280 |
| 手机 | 280、320、360、375、390、393、412、430 |
| 折叠/双屏 | 344、673、720、840、1008、1116、540、1116、344、412 |

## 浏览器矩阵

| 浏览器 | 平台 | WebUSB | 结果 | 备注 |
| --- | --- | --- | --- | --- |
| Chrome 157 | macOS 14.8.4 | 支持 | 通过 | 本机真机验收 |
| Edge | macOS/Windows | 支持 | 未执行 | 本机未安装 |
| Opera | macOS/Windows | 支持 | 未执行 | 本机未安装 |
| Firefox | 桌面 | 不支持 | 不适用 | 没有 WebUSB |
| Safari | macOS | 不支持 | 不适用 | 没有 WebUSB |
| Chrome for Android | Android | 不作为 USB host | 不适用 | 需要第二台 Android 设备 |

## 真机矩阵

| 设备 | 系统 | 结果 | 覆盖 |
| --- | --- | --- | --- |
| Xiaomi MI 6 | Android 14 / SDK 34 | 通过 | WebUSB、授权、352 个包、扫描、取消、断线、重连、appops、报告 |
| 其他 Xiaomi/Redmi | Android 12–15 | 未执行 | 需要设备 |
| Google Pixel | Android 13–15 | 未执行 | 需要设备 |
| Samsung | Android 12–15 | 未执行 | 需要设备 |
| Android 8/9 | 旧版 shell/toybox | 未执行 | 需要设备 |
| Windows 主机 | WinUSB 驱动 | 未执行 | 需要主机 |
| Linux 主机 | udev 规则 | 未执行 | 需要主机 |

## 功能验收

| 能力 | 状态 | 证据/边界 |
| --- | --- | --- |
| WebUSB 设备选择 | 通过 | Chrome 157 / macOS |
| ADB 首次授权 | 通过 | 手机 USB 调试弹窗 |
| ADB key 持久化 | 通过 | IndexedDB credential store |
| 设备基础信息 | 通过 | MI 6 型号、序列号、SDK、构建 |
| 系统信息卡 | 通过 | 版本、构建、补丁、基带、分区、Treble、ART、内核、OpenGL、SELinux |
| 包清单 | 通过 | 352 个包 |
| 候选筛选 | 通过 | INTERNET + 敏感权限 |
| `dumpsys` 共享 UID | 通过 | 真实 MI 6 裁剪样本 + 真机 |
| 设备端 APK URL 扫描 | 通过 | `unzip`/`strings`，真机 |
| 远程 ZIP 回退 | 通过 | 真实系统 APK，`tail`/`head` + `DecompressionStream` |
| AXML Manifest | 通过 | 公开 AOSP Tag APK fixture + 真机 |
| 完整扫描 | 通过 | 352 包 / 161 应用 / 11,701 端点 / 44 建议 |
| 评分、分类、域名分档 | 通过 | 真机扫描与单测 |
| DeepScan 字符串信号 | 通过 | 真机按需扫描前 20 个应用，深度列出现 12–40 风险分 |
| AppFacts 缓存 | 通过 | 真机第二次扫描约 8 秒完成，命中全部 161 个应用 |
| 扫描取消 | 通过 | 161 个候选中手动停止 |
| 扫描中拔线 | 通过 | 25/161 时停止，保留进度 |
| 空闲拔线 | 通过 | 连接页状态切换为未连接 |
| 重新连接 | 通过 | 插回后重新连接并开始新扫描 |
| appops 读取 | 通过 | `GET_USAGE_STATS` 当前模式 |
| appops 应用 | 通过 | 真机 `default → ignore`，UI 确认 |
| appops 回滚 | 通过 | 真机 `ignore → default`，状态已恢复 |
| JSON 报告 | 通过 | 真机页面下载 4,042,130 字节 `report.json` |
| Markdown 报告 | 通过 | 单测、页面下载 |
| CSV 报告 | 通过 | 单测、页面下载 |
| HTML 报告 | 部分 | 单测通过；自动化浏览器多下载策略阻止第二次下载 |
| plan.txt | 通过 | appops 命令和回滚命令单测 |
| 报告对比 | 部分 | 页面加载和两份合成 JSON 组件测试；未用真机报告手工上传 |
| OPFS 设备快照/包/扫描 | 通过 | 真实 Chrome OPFS 探针 + 单测 |
| OPFS 最近扫描恢复 | 通过 | 刷新后恢复 352 包 / 161 应用，并显示“本地”标记 |
| 主题三态 | 通过 | 系统/浅色/深色与持久化 |
| 侧栏拖拽/收起 | 通过 | 桌面指针和键盘 |
| 移动导航 5 项 | 通过 | 280–430px 视口 |
| 离线壳 | 通过 | 首次访问后离线重载 |
| 弱网 | 通过 | 180 KiB/s + 250ms |

## HTTPS 部署矩阵

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| nginx SPA 回退 | 通过（容器） | `deploy/nginx.conf`；nginx:alpine `nginx -t` 通过 |
| HTTP→HTTPS 重定向 | 通过（容器） | 本地容器 301 到 `https://noir.example.com/test`；正式域名待执行 |
| Let's Encrypt/certbot | 配置完成 | `deploy/README.md` |
| HSTS/CSP/Permissions-Policy | 通过（容器） | 本地容器已验证 HSTS、CSP、Permissions-Policy、nosniff、frame、referrer、CORP |
| `verify-https.sh` | 脚本完成 | `bash -n` 通过；需要有效证书域名执行 |
| HTTPS 真实验收 | 未执行 | 需要域名、DNS、证书和服务器 |
| 离线/弱网 HTTPS | 未执行 | 依赖正式部署 |
| WebUSB HTTPS | 未执行 | localhost 已验证；正式 HTTPS 待域名 |

## 未覆盖项

- Windows WinUSB 和 Linux udev 真机矩阵
- 非 Xiaomi 厂商 ROM 的 `dumpsys` 格式
- 可选 `dex-decompiler` WASM 模式
- 正式域名 HTTPS 证书和响应头
- 多标签页同时占用 USB 的冲突演练
- 锁屏、休眠和长时间扫描的标签页节流

## 证据位置

- CI：`.github/workflows/verify.yml`
- 视口报告：`web/test-results/viewports.json`
- 报告/缓存/DeepScan 单测：`web/src/core/*.test.ts`
- appops 单测：`web/src/adb/appops.test.ts`
- 真机记录：`docs/agent/workflow.md`
- HTTPS：`deploy/README.md`、`deploy/nginx.conf`、`deploy/verify-https.sh`