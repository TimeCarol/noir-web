# 领域规则

改 WebUSB、ADB、APK、规则、报告、隐私、浏览器或部署前, 必须先读本文件里同名的节, 读完再改代码. 根目录 [AGENTS.md](../../AGENTS.md) 要求这一步. 本文件不会因为写在这里就被各工具自动读入.

## WebUSB 与 ADB

- 浏览器直接说 ADB 协议, 不启动本地 `adb` server, 不依赖 Android SDK. 传输层固定使用 Tango `@yume-chan/adb` 2.6.x
- `requestDevice()` 必须由用户点击触发. 页面加载时不能静默扫描 USB 设备
- ADB RSA key 由 WebCrypto 生成, 只保存在当前 origin 的 IndexedDB credential store. 不写日志, 不提供导出
- 设备快照, 包清单和扫描结果统一写入 OPFS; 不使用 IndexedDB 或 localStorage 保存设备数据
- 第一次连接必须在手机上允许 USB 调试. 密钥被撤销或站点数据被清除后需要重新授权
- ADB 接口同一时间只能被一个程序占用. `DeviceBusyError` 必须显示 `adb kill-server` 和关闭 Android Studio / scrcpy / 其他标签页的指引
- WebUSB 只在安全上下文可用. 生产必须 HTTPS, 本地开发使用 `http://localhost`
- 浏览器不能建立原始 TCP 连接, 所以不做无线 ADB. Chrome for Android 只有在手机作为 USB host 连接另一台 Android 时才有意义
- WebUSB 只在主线程使用. `dumpsys` 逐行解析, ZIP 使用异步流, 单包解析不进入 UI 状态; CPU 时间长的 DeepScan 放 Worker, 但不假设 Worker 里一定拿得到 `navigator.usb`
- 默认只读. `appops set`, `pm uninstall`, `pm revoke` 都必须先展示命令和回滚方式, 再由用户确认. 不自动卸载
- `dumpsys package` 可能很大, 必须流式读取和解析, 不把完整输出拼成一个巨大字符串
- USB 断开或 shell 超时必须终止扫描并给出重新连接入口, 不能让页面停在进度条上; 不自动重试不可恢复的 ADB transport 中断
- split APK 和 `pm path` 的多路径在 M1 处理, M0 只读 `pm list packages -f` 的基础 APK

## 隐私与数据

- 不加遥测、崩溃上报、第三方统计、远程字体、远程脚本或 CDN. 所有资源自托管
- 设备数据只在当前浏览器内处理, 不上传服务器. 页面不提供"上传 APK 到云端分析"的默认入口
- 报告可能包含包名、端点、设备指纹和序列号. 示例、截图和测试夹具只使用合成数据
- 公共 Git 文档和提交日志不得包含真实设备数据、真实端点、ADB 私钥或商户凭据
- CSP 在生产环境限制 `connect-src`, 不加载第三方脚本. 部署头见 [deploy/nginx.conf](../../deploy/nginx.conf)
- 任何导出文件都由浏览器本地生成, 不经过后端

## 规则与报告

- 规则、分类、评分、数据流关联和域名分档移植自 NOIR, 保留 MIT 版权声明. 不复制 CC BY-NC-ND 项目的代码
- 评分保持可解释: 每个发现都能追溯到权限或 APK 里的字符串
- `report.json` 字段与 NOIR 保持兼容, 至少保留 `environment`, `device`, `apps[].package`, `score`, `categoryKey`, `permissions`, `endpoints`
- 规则外置为静态 JSON, 版本号进入缓存 key. 规则变化只重算分数, 不重扫 APK
- 分类和厂商归因先看包名前缀, 再看上报域名, 忽略基础设施域名
- DeepScan 默认只做 DEX 级方法/字符串信号, 不声称与 jadx 源码级扫描 1:1 等价
- 报告里的静态证据只说明"应用具备这个能力并且代码里有这个端点", 不能证明某次传输真的发生

## 浏览器与部署

- 只支持 Chromium 桌面: Chrome, Edge, Opera. Firefox 和 Safari 没有 WebUSB, 必须显示明确提示
- Windows 需要 ADB 接口绑定 WinUSB. Linux 需要 udev 权限. macOS 通常无需额外配置
- 这是纯静态 SPA, 构建产物在 `web/dist`. 不新增后端、数据库、登录或 API 代理
- nginx 必须正确设置 `.wasm` 的 `application/wasm`, SPA 回退到 `index.html`, 并发送 CSP、HSTS 和 `Permissions-Policy: usb=(self)`
- `index.html` 不缓存, 带 hash 的静态资源长缓存
- GitHub Pages / Cloudflare Pages 也可以部署, 只要 HTTPS 和 MIME 正确

## 构建与网络

- 生产构建必须 minify, 关闭 source map, 生成 gzip 和 brotli 预压缩文件, 并通过 `check-build.mjs` 的体积预算
- service worker 按构建 ID 版本化缓存, 导航网络优先并回退缓存, 带 hash 资源缓存优先
- 弱网不能空白等待: 路由使用骨架, chunk 只重试一次并交给错误边界, 空闲预取在省流或 2G 网络跳过
- 离线状态只显示图标, 不堆叠解释文字; 首次访问后才能缓存应用外壳
- Oxlint 与 TypeScript 都必须通过, 不把 lint warning 留在默认入口

## 界面与文案

- 手写前端在 `web/`: React, TypeScript, Vite, Ant Design 6
- 颜色只用 Radix UI Colors. 不用 ProComponents, 不写自造色值
- 基础字号 12 / 14 / 24px, 边框 0.5px, 不加装饰性阴影和动画
- 响应式至少检查 320, 360, 390, 768, 1280, 1440, 1920 宽度和手机横屏
- 触屏主要按钮和输入区域至少 44px, 输入字号 16px, 不禁止用户缩放
- 文案用中文, 英文标点, 不用中点 `·` 分隔, 不用 `/` 拼接字段, 末尾不加句号
- 不在页面放解释设计或实现方式的说明文字. 未实现功能明确写"未实现", 不伪造成功状态

## 测试与验收

- `bash scripts/test.sh fast` 至少包含类型检查、组件测试、Ant Design 导入检查和 production build
- 单元测试使用合成数据, 不连接真实设备, 不调用真实上游
- 真机验收必须写清设备型号、Android 版本、操作系统、浏览器版本和失败现象
- 测试通过不能证明 Ant Design 文档已经读过, 也不能证明真实 WebUSB 授权和驱动可用
- 修改连接、权限或报告后, 先写失败回归, 再改实现. 同一类错误再次出现时先读 [workflow.md](workflow.md)