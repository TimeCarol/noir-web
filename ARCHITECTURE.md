# 架构

NOIR Web 是一个纯静态单页应用. 浏览器通过 WebUSB 直接和 Android 的 ADB daemon 通信, 读取设备属性和应用清单, 后续在浏览器内完成 APK 解析、规则评分和报告生成.

## 分层

```text
┌─────────────────────────────────────────────────────┐
│ React 页面层                                         │
│ connect / apps / roadmap                            │
│ 组合查询, 交互和展示                                  │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│ AdbProvider                                          │
│ 连接阶段, 设备生命周期, 查询缓存清理                  │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│ adb/                                                 │
│ WebUSB 授权, ADB 认证, getprop, pm list packages      │
└──────────────────────┬──────────────────────────────┘
                       │ USB bulk endpoints
┌──────────────────────▼──────────────────────────────┐
│ Android ADB daemon                                   │
└─────────────────────────────────────────────────────┘

M1 追加:
features -> core (规则/评分/报告)
features -> apk (ZIP/AXML/DEX)
apk -> core (证据和类型)
```

## 线程模型

- WebUSB 在主线程使用, `requestDevice` 必须由用户手势触发
- ADB I/O 是异步的, 不阻塞 UI
- `dumpsys` 逐行解析, 不保留完整输出; ZIP inflate 使用浏览器异步 `DecompressionStream`
- AXML 和 DEX 解析器不依赖 DOM, 后续可迁移到 Worker
- 不假设 Worker 里一定能拿到 `navigator.usb`; WebUSB 始终留在主线程

## 连接流程

1. 用户点击选择设备
2. 浏览器弹出 USB 设备选择器
3. `device.connect()` 打开设备并 claim ADB interface
4. `AdbDaemonTransport.authenticate` 完成 CNXN / AUTH
5. 首次连接在手机上允许 USB 调试
6. RSA key 存入当前 origin 的 OPFS
7. `Adb` 客户端执行 `getprop` 和 `pm list packages -f`
8. `AdbProvider` 把设备信息交给页面, 连接失败交给 `errors.ts` 生成指引

## 数据流

```text
Connect
  -> ConnectedDevice
  -> DeviceInfo (getprop)
  -> PackageEntry[] (pm list packages -f)
  -> React Query 缓存
  -> ConnectPage / AppsPage
```

M1 数据流:

```text
dumpsys package (逐行)
  -> 候选应用 (INTERNET + 敏感权限)
  -> 快速路径: unzip -l / unzip -p / strings / base64
  -> 回退路径: pm path + tail/head 读取 ZIP 中央目录
  -> AXML Manifest + DEX URL 扫描
  -> rules / classifier / exposure / advisor
  -> ScanResult -> OPFS scan.json -> 页面 / report.json / report.md / report.csv
```

## 数据所有权

- `ConnectedDevice` 由 `AdbProvider` 持有, 组件卸载或断开时关闭 ADB transport
- `DeviceInfo` 和 `PackageEntry[]` 是只读快照, 由 TanStack Query 按设备 serial 缓存
- 查询缓存在页面生命周期内有效, 不写入 localStorage
- 设备快照, 包清单, 扫描结果和 ADB 私钥统一存 OPFS, 按设备序列号分目录; UI 偏好仍用 localStorage
- AppFacts 缓存后续按 APK 路径 + size + mtime 失效

## 安全与隐私

- 无后端, 无遥测, 无远程字体或脚本
- ADB key 只存 OPFS, 不导出, 不写日志
- 默认只读. 写操作必须展示命令和回滚方式
- 设备数据只在浏览器内处理
- 生产部署使用严格 CSP, HSTS 和 `Permissions-Policy: usb=(self)`
- 公共测试夹具只使用合成数据

## 部署

`npm run build --prefix web` 生成 `web/dist`. nginx 直接提供静态文件, SPA 回退到 `index.html`, `.wasm` 使用 `application/wasm`. 也可以部署到 GitHub Pages 或 Cloudflare Pages.

## 当前范围

M1 已包含连接, 包列表, 权限与端点扫描, AXML, DEX URL, 规则, 建议和 JSON/Markdown/CSV 报告. DeepScan, 报告 diff 和 appops 属于 M2/M3.