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
- M1 的 `dumpsys` 解析、ZIP inflate、DEX 扫描放 Worker
- 不假设 Worker 里一定能拿到 `navigator.usb`
- Worker 通过 transferable `ArrayBuffer` 接收数据, 避免主线程拷贝

## 连接流程

1. 用户点击选择设备
2. 浏览器弹出 USB 设备选择器
3. `device.connect()` 打开设备并 claim ADB interface
4. `AdbDaemonTransport.authenticate` 完成 CNXN / AUTH
5. 首次连接在手机上允许 USB 调试
6. RSA key 存入当前 origin 的 IndexedDB
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
dumpsys package
  -> 候选应用 (INTERNET + 敏感权限)
  -> pm path (基础 + split APK)
  -> 远程 ZIP 读取 AndroidManifest.xml 和 classes*.dex
  -> AXML + DEX URL 扫描
  -> rules / classifier / exposure / advisor
  -> report.json / report.md / report.html / report.csv
```

## 数据所有权

- `ConnectedDevice` 由 `AdbProvider` 持有, 组件卸载或断开时关闭 ADB transport
- `DeviceInfo` 和 `PackageEntry[]` 是只读快照, 由 TanStack Query 按设备 serial 缓存
- 查询缓存在页面生命周期内有效, 不写入 localStorage
- M1 的 AppFacts 缓存放 IndexedDB, 按设备指纹 + 包名 + APK 路径 + size + mtime 失效

## 安全与隐私

- 无后端, 无遥测, 无远程字体或脚本
- ADB key 只存 IndexedDB, 不导出, 不写日志
- 默认只读. 写操作必须展示命令和回滚方式
- 设备数据只在浏览器内处理
- 生产部署使用严格 CSP, HSTS 和 `Permissions-Policy: usb=(self)`
- 公共测试夹具只使用合成数据

## 部署

`npm run build --prefix web` 生成 `web/dist`. nginx 直接提供静态文件, SPA 回退到 `index.html`, `.wasm` 使用 `application/wasm`. 也可以部署到 GitHub Pages 或 Cloudflare Pages.

## 当前范围

M0 只有连接链路和设备/包列表. M1 才引入 `dumpsys`, 远程 ZIP, AXML, DEX 和规则. M0 的页面文案必须明确这个边界.