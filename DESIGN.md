# NOIR Web 设计方案

> 目标：把 [Verlintas/NOIR](https://github.com/Verlintas/NOIR) 的核心能力搬到浏览器里，用 Chrome WebUSB 直接连接 Android 手机，在线完成隐私审计，不下载桌面程序、不上传设备数据。
>
> 结论先行：**核心审计功能可以 100% 在前端完成，最终只需要 nginx + 静态文件（HTTPS）**。完整 jadx 反编译可以用 WASM 绕开后端；短链分享对大报告仍建议对象存储；无线 ADB 必须有本地 bridge。三者都不影响 v1。

---

## 1. 结论摘要

| 问题 | 结论 |
|---|---|
| 能否用 WebUSB 做网页版？ | **可以。** 浏览器直接实现 ADB 协议，已有成熟开源项目 Tango（ya-webadb）验证。 |
| 是否需要后端？ | **v1 不需要。** 静态 SPA + HTTPS 即可。 |
| 最终部署 | **nginx + `dist/` 静态文件**；也可以直接放 GitHub Pages / Cloudflare Pages。 |
| 数据是否离开本机？ | 不离开。ADB、APK 解析、报告生成全部在浏览器内完成。 |
| 功能是否和 NOIR 完全一样？ | 默认 `scan` 流程基本 1:1；`deepscan` 建议用 DEX 级信号替代 jadx 源码级扫描，或可选 WASM 反编译。 |
| 最大限制 | 仅 Chromium 桌面浏览器；需要数据线 + USB 调试；不能无线 ADB；本机 adb server 会抢占 USB 接口。 |

---

## 2. NOIR 在做什么

NOIR 是一个跑在电脑上的 Kotlin CLI，通过 `adb` 读取已连接 Android 设备的信息：

1. `pm list packages -f` / `pm path`：应用清单与 APK（含 split APK）路径。
2. `dumpsys package`：权限、granted 状态、系统/调试标记、installer、共享 UID。
3. 在设备端用 `unzip` + `strings` 从每个 APK 的 `classes*.dex` 抽取 URL；设备没有这些工具时，把 APK 拉回本地解析。
4. 解析 `AndroidManifest.xml`（二进制 AXML）：导出组件、明文流量、backup、debuggable、targetSdk。
5. 规则引擎：敏感权限、上报端点、分类、厂商归因、风险分、数据流关联、共享 UID。
6. 处置建议：appops、DNS 分档清单、回滚命令；默认只读。
7. 报告：JSON / Markdown / HTML / CSV；`noir diff` 对比两次扫描。
8. `deepscan`：拉 APK → jadx 反编译 → 源码关键字扫描 + Manifest 分析。

关键设计取舍：

- 端点抽取尽量在设备端完成，避免把几百个 APK 拉回电脑。
- 只审计“有 INTERNET + 至少一个敏感权限”的应用。
- 证据可解释：每个发现都能追溯到权限或 APK 里的字符串。
- 不联网、不上传、不需要账号。

这些取舍非常适合搬到浏览器：**浏览器就是那台“电脑”，WebUSB 就是 adb 的传输层，解析全部用 JS/WASM。**

---

## 3. 可行性分析

### 3.1 WebUSB 能做什么

WebUSB 暴露的是 USB 设备原始端点。Android 的 ADB 接口有固定标识：

- class `0xFF`
- subclass `0x42`
- protocol `0x01`

浏览器可以：

1. 让用户从 Chrome 的设备选择器里授权一台 Android 设备。
2. `open()` + `claimInterface()` 拿到 ADB 的 bulk in/out 端点。
3. 实现 ADB 的 `CNXN` / `AUTH` 握手。
4. 用 RSA 签名设备发来的 challenge（首次需要手机点“允许 USB 调试”）。
5. 建立 `shell:`、`sync:` 等逻辑 socket，执行 `pm`、`dumpsys`、`getprop`、`appops`，读写文件。

Tango（`ya-webadb`）已经把这些全部实现并开源：

- `@yume-chan/adb`：ADB 协议、认证、shell、sync、subprocess。
- `@yume-chan/adb-daemon-webusb`：WebUSB 传输层。
- WebCrypto 生成 RSA key，IndexedDB 保存。
- `@yume-chan/android-bin`：`pm`、`dumpsys` 等封装（可选）。

### 3.2 浏览器兼容性

| 浏览器 | WebUSB | 结论 |
|---|---|---|
| Chrome / Edge / Opera（桌面） | ✅ | 主目标 |
| Chrome for Android | ✅ | 理论可用，但手机要作为 USB host 去连另一台 Android；不能自己审自己 |
| Firefox | ❌ | 不支持 WebUSB |
| Safari / iOS | ❌ | 不支持 WebUSB |

> 建议同时提供“拖拽 APK 分析”模式，让 Firefox/Safari 用户也能用静态分析部分；这不会增加后端。

### 3.3 操作系统前置条件

| 系统 | 条件 | 说明 |
|---|---|---|
| macOS | 基本开箱即用 | 推荐开发/演示环境 |
| Windows 10/11 | ADB 接口需绑定 WinUSB | 安装 Google USB Driver / 厂商驱动后通常已满足；老 OEM 驱动可能需要 Zadig 或换驱动 |
| Linux | 需要 udev 规则 | 否则 Chrome 看不到设备；一次性系统配置，不是安装本应用 |
| ChromeOS | 通常可用 | 与 Linux 类似 |

这意味着“无需下载”并不等于“零系统配置”：Linux 可能要做一次 udev 规则，Windows 可能需要正确的 USB 驱动。这是 WebUSB 的固有限制，不是本项目能消除的。

### 3.4 不能做的事

1. **无线 ADB**：浏览器不能开原始 TCP socket；Android 11 的无线调试配对也走 TCP。除非加一个本地/远程 bridge（那就不是纯静态了），否则必须插线。
2. **手机自己审自己**：一台手机不能同时当 USB host 和 device（少数 USB-C OTG 场景例外，不作为产品假设）。
3. **完整 jadx 等价**：浏览器里跑 JVM/jadx 很重；推荐 DEX 级信号扫描，或把 `dex-decompiler` 编译成 WASM（Apache-2.0，已有 droid2web 验证）。
4. **Firefox/Safari**：没有 WebUSB，只能走 APK 拖拽模式。

### 3.5 最大的坑：USB 接口独占

ADB 接口同一时间只能被一个程序 claim：

- 本机 `adb` server 在跑 → WebUSB `claimInterface` 失败。
- Android Studio、scrcpy、Vysor、另一个 WebADB 标签页在连 → 同样失败。
- Windows 上甚至是“打开句柄”级别的独占。

**产品必须把 `DeviceBusyError` 做成一级错误页**，直接告诉用户：

```bash
adb kill-server
```

并提示关闭 Android Studio / scrcpy / 其他标签页。这是上线后最常见的支持问题。

---

## 4. 开源项目选型

### 4.1 核心依赖

| 项目 | License | 作用 | 建议 |
|---|---|---|---|
| [yume-chan/ya-webadb (Tango)](https://github.com/yume-chan/ya-webadb) | MIT | 浏览器 ADB：WebUSB、认证、shell、sync | **核心依赖**，锁版本 |
| [Verlintas/NOIR](https://github.com/Verlintas/NOIR) | MIT | 规则、分类、评分、报告格式、appops 逻辑 | **移植蓝本**，保留版权声明 |
| [101arrowz/fflate](https://github.com/101arrowz/fflate) | MIT | 纯 JS inflate/deflate、ZIP | 解析 APK 内 dex |
| [androguard/dex-decompiler](https://github.com/androguard/dex-decompiler) | Apache-2.0 | Rust DEX→Java，可编译 WASM | 可选 DeepScan |
| [jiusanzhou/apkman](https://github.com/jiusanzhou/apkman) | MIT | 浏览器 APK 解析/反编译参考 | 参考架构，不直接依赖 |
| [poping520/libdex-ts](https://github.com/poping520/libdex-ts) | MIT | TypeScript DEX 解析 | 可参考；建议自写最小解析器 |
| [xuantiandaozun/apk-meta-parser](https://github.com/xuantiandaozun/apk-meta-parser) | MIT | 浏览器 APK 元信息/AXML | 可参考 |

### 4.2 参考项目（不要抄代码）

| 项目 | License | 说明 |
|---|---|---|
| [thecybersandeep/adbauditor](https://github.com/thecybersandeep/adbauditor) | **CC BY-NC-ND 4.0** | 纯 JS 的 WebUSB ADB 审计工具，功能高度接近；**只可阅读参考，不能复制/修改分发** |
| [thecybersandeep/apkauditor](https://github.com/thecybersandeep/apkauditor) | **CC BY-NC-ND 4.0** | 浏览器 APK 安全分析；同样只参考 |
| [webadb/webadb.js](https://github.com/webadb/webadb.js) | 旧项目 | 早期实现，已不维护 |
| [DeviceFarmer/adbkit](https://github.com/DeviceFarmer/adbkit) | Apache-2.0 | Node.js ADB 客户端，不能直接在浏览器用，协议实现可参考 |
| [skylot/jadx](https://github.com/skylot/jadx) | Apache-2.0 | 仅在后端方案里使用 |

### 4.3 规则/数据源

| 数据源 | License | 建议 |
|---|---|---|
| NOIR 自带规则 | MIT | **首选**，直接移植，附版权声明 |
| Exodus Privacy tracker 列表 | AGPL / ODbL（数据库） | 许可证复杂，v1 不用；如要用需做合规评估 |
| DuckDuckGo Tracker Radar | CC BY-NC-SA 4.0 | 非商用限制，不适合作为默认内置数据 |
| 自建规则 JSON | 项目自身许可 | 推荐：可社区贡献、可版本化 |

> 结论：v1 的规则全部来自 NOIR（MIT）+ 自己的补充，避免许可证污染。

---

## 5. 总体架构

### 5.1 架构图

```text
┌─────────────────────────────────────────────────────────────┐
│ Chrome / Edge (HTTPS)                                       │
│                                                             │
│  UI (React + Vite + TS)                                     │
│   ├─ Connect / Scan / Dashboard / App Detail / Reports      │
│   └─ Settings / i18n / Error guidance                       │
│                                                             │
│  Main thread                                                │
│   ├─ WebUSB device picker (user gesture)                    │
│   ├─ ADB transport (Tango) ── USB bulk endpoints            │
│   └─ Scan orchestrator (queues, progress, cancel)           │
│                                                             │
│  Web Worker(s)                                              │
│   ├─ dumpsys parser (streaming lines)                       │
│   ├─ AXML parser                                            │
│   ├─ ZIP central directory + inflate                        │
│   ├─ DEX URL scanner / DEX signal parser                    │
│   ├─ Rules engine (score/classify/exposure/advisor)         │
│   └─ Report generator (JSON/MD/HTML/CSV)                    │
│                                                             │
│  OPFS + IndexedDB                                          │
│   ├─ IndexedDB: ADB RSA key (Tango credential store)        │
│   ├─ scan cache (per device/pkg/apk)                        │
│   ├─ scan history / imported reports                        │
│   └─ settings (lang/theme/rules version)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ USB
                              ▼
                    Android device (adb daemon)
```

### 5.2 线程模型

- **WebUSB 必须放在主线程**（Tango 文档明确说明；部分浏览器在 Worker 里拿不到 `navigator.usb`）。
- ADB I/O 是异步的，不会阻塞 UI；真正重的是 `dumpsys` 文本解析、ZIP inflate、DEX 扫描，全部放 Worker。
- 主线程只做：USB 读写、消息编排、UI 状态。
- Worker 通过 `postMessage` 接收 `ArrayBuffer`（transfer 所有权，避免拷贝）。
- 一次扫描最多 2–4 个 APK 并发；ADB socket 本身支持多路复用，但设备 CPU/IO 是瓶颈。

### 5.3 数据流

```text
Connect
  → Adb instance
  → pm list packages -f
  → dumpsys package (stream)
  → filter: INTERNET + sensitive + granted
  → for each candidate:
       pm path pkg (all splits)
       → remote ZIP read: AndroidManifest.xml + classes*.dex
       → AXML parse + DEX URL scan
       → AppFacts { permissions, endpoints, manifest, apk meta }
  → rules engine → AppEntry { score, category, vendor, leaks, ... }
  → Advisor → recommendations
  → report / dashboard / diff
```

**缓存的是 `AppFacts`，不是最终分数。** 这样规则更新后只需要重新计算，不需要重新扫 APK。

---

## 6. 核心模块设计

### 6.1 `adb/`：连接与命令

建议目录：

```text
src/adb/
  connect.ts        # requestDevice → connect → authenticate → Adb
  device.ts         # 设备信息、getprop、型号
  packages.ts       # pm list packages / pm path
  dumpsys.ts        # 流式读取 dumpsys package
  shell.ts          # 通用 shell 执行、超时、取消
  appops.ts         # appops get/set、rollback
```

连接代码（Tango 2.6.x）：

```ts
import { Adb, AdbDaemonTransport } from "@yume-chan/adb";
import { AdbDaemonWebUsbDeviceManager } from "@yume-chan/adb-daemon-webusb";
import { AdbOpfsCredentialStore } from "../storage/adb-credentials";

export async function connectDevice() {
  const manager = AdbDaemonWebUsbDeviceManager.BROWSER;
  if (!manager) throw new Error("当前浏览器不支持 WebUSB");

  // 必须由用户点击触发
  const device = await manager.requestDevice();
  if (!device) return undefined;

  const connection = await device.connect(); // DeviceBusyError 在这里
  const credentialStore = new AdbOpfsCredentialStore("NOIR Web");
  const transport = await AdbDaemonTransport.authenticate({
    serial: device.serial,
    connection,
    credentialStore,
  });

  return new Adb(transport);
}
```

第一次连接时手机会弹出“允许 USB 调试吗？”，勾选“一律允许”即可。密钥存在 IndexedDB，换域名/清站点数据后需要重新授权。

常用命令：

```ts
const pm = await adb.subprocess.noneProtocol.spawnWaitText([
  "pm", "list", "packages", "-f",
]);

const dump = adb.subprocess.noneProtocol.spawn(["dumpsys", "package"]);
const reader = dump.output.getReader();
// 逐行读取，避免把 10–30 MB 的字符串一次性拼出来
```

### 6.2 `dumpsys` 解析

直接移植 NOIR 的 `Dumpsys.kt`：

- `Package [pkg]` 开始一个包块。
- `sharedUser=SharedUserSetting{...}` 记录共享 UID。
- 尾部 `SharedUser [android.uid.system]` 段把权限合并回每个包。
- `android.permission.X: granted=true` 才算 granted。
- `flags=[... SYSTEM ...]`、`DEBUGGABLE`。
- `installerPackageName=`、`appId=`。

注意：

- OEM 的 `dumpsys` 缩进不固定；正则要允许任意空白。
- `dumpsys package` 会重复列出包，解析时要 merge。
- 大输出必须流式解析，不要 `await text()` 后再 split。

### 6.3 APK 端点抽取：三种策略

#### 策略 A：设备端 `unzip` + `strings`（NOIR 原版）

```sh
unzip -l "$apk" | sed -n 's/.* \(classes[0-9]*\.dex\)[[:space:]]*$/\1/p'
unzip -p "$apk" classes.dex | strings | grep -oE 'https?://...'
```

优点：USB 流量最小，几 KB/应用。

缺点：依赖设备有 `unzip` 和 `strings`；部分 ROM 没有。

#### 策略 B：远程 ZIP 读取（推荐主路径）

不拉整个 APK，只用 `tail`/`head` 读取 ZIP 的中央目录和需要的 entry：

```sh
# 读取文件尾部 128 KB，找 EOCD / 中央目录
tail -c 131072 "$apk"

# 读取任意区间（offset 从 0 开始）
tail -c +$((offset + 1)) "$apk" | head -c "$length"
```

流程：

1. `tail -c 131072` 拿 ZIP 尾部，解析 EOCD（`0x06054b50`）。
2. 根据 EOCD 的 central directory offset/size，读取中央目录。
3. 解析每个 entry：`classes*.dex`、`AndroidManifest.xml`，记录 `compressionMethod`、`compressedSize`、`localHeaderOffset`。
4. 对每个 entry，读取 local header 得到数据起点（`30 + nameLen + extraLen`），再读取 compressed bytes。
5. 本地 inflate：
   - method 0：原样；
   - method 8：`DecompressionStream("deflate-raw")` 或 `fflate`。
6. 一个 APK 可以把所有需要的 entry 合并成一次 shell 调用，按已知长度切分，减少 round-trip：

```sh
tail -c +$((o1+1)) "$apk" | head -c $l1; \
tail -c +$((o2+1)) "$apk" | head -c $l2; \
tail -c +$((o3+1)) "$apk" | head -c $l3
```

优点：

- 不依赖 `unzip`/`strings`，所有 Android 都有 `tail`/`head`（toybox）。
- 只读需要的字节，不拉整包。
- 同时拿到 Manifest 和 dex，便于后续 DeepScan。
- 可以做 ZIP64/异常回退。

缺点：

- 实现比策略 A 复杂；需要处理 ZIP 格式边界。
- 每个 APK 至少 2 次 shell round-trip。

#### 策略 C：整包 pull + 本地解析

`adb.sync().read(path)` 或 `adb pull` 整个 APK，然后用 `fflate` 解压。

优点：最简单、最兼容。

缺点：流量大、慢；只作为 A/B 都失败时的兜底。

**推荐顺序：B（主）→ A（设备工具存在时的快速路径）→ C（兜底）。**

### 6.4 AXML 解析

NOIR 的 `Axml.kt` 只有 165 行，直接移植成 TypeScript：

- 解析 `RES_XML_TYPE` 头。
- `CHUNK_STRING_POOL`（0x0001）：UTF-8/UTF-16 字符串池。
- `CHUNK_START_ELEMENT`（0x0102）：元素名、属性表、depth。
- 属性值类型：string / int dec / int hex / int boolean。
- 输出 `Node { name, attrs, depth }`。

然后移植 `Manifest.kt`：

- `application` 的 `allowBackup`、`usesCleartextTraffic`、`debuggable`、`networkSecurityConfig`。
- `uses-sdk` 的 `targetSdkVersion`。
- `activity/service/receiver/provider` 的 `exported`、`permission`、`authorities`、`enabled`。
- 没有 `exported` 时有 `intent-filter` 视为 `true`（Android 默认行为）。
- `exported && enabled && permission == null` 计入风险。

### 6.5 DEX 解析

#### 仅抽 URL（默认扫描）

不需要完整 DEX 解析，直接扫描 inflate 后的字节：

- 找 `http://` / `https://` 的 ASCII 起点。
- 向后收集 `[A-Za-z0-9._~:/?#@!&()*+,;=%-]`。
- 长度 4–300，去重，限制 300–1000 条。

这与 NOIR 的 `ApkScan.kt` 等价，简单、快、误报可控。

#### DeepScan 信号（可选）

完整 DEX 解析的最小集合：

1. Header：`string_ids_size/off`、`type_ids_size/off`、`proto_ids`、`field_ids`、`method_ids`、`class_defs`。
2. `string_id_item` → `string_data_item`（uleb128 + MUTF-8）。
3. `type_id_item` → string descriptor（`Lcom/foo/Bar;`）。
4. `method_id_item`：`class_idx` + `proto_idx` + `name_idx`。
5. `field_id_item`：`class_idx` + `type_idx` + `name_idx`。

把 NOIR 的 15 类信号映射到 DEX 的字符串/方法引用：

| 信号 | DEX 证据 |
|---|---|
| `exec` | `Ljava/lang/Runtime;->exec`、`Ljava/lang/ProcessBuilder;` |
| `dynamic-load` | `DexClassLoader`、`PathClassLoader`、`loadLibrary` |
| `disable-app` | `setApplicationEnabledSetting` |
| `a11y-hijack` | 字符串 `enabled_accessibility_services` |
| `screen-capture` | `MediaProjection`、`createScreenCaptureIntent` |
| `reflection` | `Class.forName`、`getDeclaredMethod` |
| `crypto` | `Cipher.getInstance`、`MessageDigest` |
| `network` | `HttpURLConnection`、`OkHttpClient`、`openConnection` |
| `set-prop` | `SystemProperties.set`、`Settings.Global.put`、`Settings.Secure.put` |
| `sms` | `SmsManager`、`sendTextMessage`、`content://sms` |
| `device-id` | `getDeviceId`、`getImei`、`getSubscriberId`、`getAndroidId`、`getSerial` |
| `webview-bridge` | `addJavascriptInterface` |
| `accessibility` | `AccessibilityService` |
| `notification-listener` | `NotificationListenerService` |
| `device-admin` | `DeviceAdminReceiver` |

风险公式沿用 NOIR：

```text
risk = Σ min(count(signal), 3) * weight(signal)
     + min(exportedWithoutPermission, 4)
     + (cleartext && hasUpload ? 2 : 0)
     + (allowBackup ? 1 : 0)
     + (debuggable ? 3 : 0)
cap 40
```

差异说明：

- jadx 是源码级 regex，计数是“每个源文件命中次数”；DEX 级是“方法/字符串引用次数”。两者风险排序高度一致，但数字不会完全相同。
- 如果要 1:1 对齐，可选 `dex-decompiler` WASM 做真正的 Java 反编译；代价是包体、CPU、内存。建议把它做成“深度模式（实验）”，不要默认开启。

### 6.6 规则引擎

直接移植 NOIR 的 `Rules.kt`、`Classifier.kt`、`Exposure.kt`、`Domains.kt`、`Advisor.kt`：

- 敏感权限列表。
- 上传/命令路径正则。
- 评分：权限数 + `QUERY_ALL_PACKAGES` + `READ_PRIVILEGED_PHONE_STATE` + `FOREGROUND_SERVICE_MEDIA_PROJECTION` + system + debuggable + command/upload endpoint。
- 厂商归因：包名前缀优先，域名投票兜底。
- 分类：已知包名 → 关键字 → 系统兜底。
- 数据类型映射 + 上传域名关联。
- 域名三档：tracker / review / functional。
- 建议：`PROJECT_MEDIA`、`GET_USAGE_STATS`、`REVIEW`、`BLOCK_DNS`。

建议把规则外置成 JSON：

```text
public/rules/
  rules.json          # version, sensitive, uploadRegex, commandRegex
  vendors.json        # package prefixes + domains
  categories.json     # known packages + keyword rules
  domains.json        # ignored/functional/block lists
  trackers.json       # endpoint/class fingerprints
```

好处：规则更新不需要重新构建应用；社区可以提交规则包；缓存 key 里带 `rulesVersion`，规则变了只重算分数，不重扫。

### 6.7 报告

保持与 NOIR `report.json` **字段兼容**，这样：

- 用户可以把网页报告丢给 `noir diff`。
- 网页也可以导入 NOIR 的旧报告做 diff。
- 迁移成本最低。

核心字段：

```json
{
  "environment": {
    "tool": "NOIR Web x.y.z",
    "host": "Chrome 120 / macOS",
    "android": "14",
    "sdk": "34",
    "build": "...",
    "fingerprint": "...",
    "user": "0",
    "generatedAt": "2026-...",
    "minScore": 0,
    "limit": 500
  },
  "device": { "serial": "...", "model": "..." },
  "apps": [
    {
      "package": "com.example",
      "uid": "10123",
      "system": false,
      "debuggable": false,
      "installer": "com.android.vending",
      "category": "工具",
      "categoryKey": "TOOL",
      "vendor": "Example",
      "sharedUid": null,
      "dataTypes": ["位置"],
      "dataTypeKeys": ["LOCATION"],
      "leaks": { "位置": ["api.example.com"] },
      "leaksByType": { "LOCATION": ["api.example.com"] },
      "score": 7,
      "permissions": ["ACCESS_FINE_LOCATION"],
      "endpoints": ["https://api.example.com/report"]
    }
  ],
  "recommendations": [
    {
      "package": "com.example",
      "action": "DNS 拦截",
      "actionKey": "BLOCK_DNS",
      "risk": "LOW",
      "reason": "存在多个上报端点，可在 DNS 层拦截",
      "autoSafe": false
    }
  ]
}
```

导出：

- JSON：完整结构。
- Markdown：人读。
- HTML：单文件、无外部资源、可离线打开。
- CSV：Excel。
- `domains-trackers.txt` / `domains-other.txt` / `domains-functional.txt`。
- `plan.txt` / `applied.txt` / `rollback.txt`（执行 appops 后）。

### 6.8 缓存

OPFS stores：

```text
facts       : key = serial|fingerprint|sdk|pkg|apkPath|apkSize|apkMtime
              value = { endpoints, permissions, manifest, sharedUid, ... }
scans       : id, deviceSerial, createdAt, options, reportJson
settings    : lang, theme, rulesVersion
```

IndexedDB stores the Tango ADB key through `@yume-chan/adb-credential-web`.

缓存策略：

- 命中条件：设备指纹 + SDK + 包名 + APK 路径 + size + mtime 全部一致。
- APK 更新后自动失效。
- 扫描失败不写缓存（与 NOIR 一致）。
- 规则版本变化只重算 `AppEntry`，不重扫 APK。
- 提供“清空缓存”“导出缓存”按钮。

### 6.9 UI/UX

页面：

1. **欢迎/兼容性检查**
   - 检测 `navigator.usb`、`isSecureContext`。
   - 不支持时引导用“APK 拖拽模式”。
   - 三步图：插线 → 授权 → 扫描。
2. **连接设备**
   - “选择设备”按钮（user gesture）。
   - 已授权设备列表（`getDevices()`）。
   - 设备信息：型号、Android 版本、SDK、序列号（可脱敏）。
   - 错误指引：`DeviceBusyError`、无设备、未授权。
3. **扫描**
   - 选项：`--min`、`--limit`、`--only`、是否包含系统应用、是否 DeepScan。
   - 进度：包总数、当前包、缓存命中、失败数、ETA、取消。
   - 实时日志（可选，折叠）。
4. **仪表盘**
   - 风险分布、分类分布、Top apps。
   - 搜索/筛选：包名、厂商、分类、分数、系统/用户、是否有上报。
   - 共享 UID 分组。
5. **应用详情**
   - 权限 → 数据类型 → 上报域名（leak paths）。
   - 端点列表（复制/搜索）。
   - Manifest facts：导出组件、cleartext、backup、debuggable、targetSdk。
   - 建议动作：复制 adb 命令、执行 appops、查看回滚。
6. **报告**
   - 导出 JSON/MD/HTML/CSV。
   - 导入两份报告做 diff。
   - 分享：默认只下载文件；可选 URL fragment 压缩（无后端）。
7. **设置**
   - 语言（zh/en/auto）。
   - 主题。
   - 清除 ADB key / 清除缓存。
   - 规则版本、第三方许可证。

交互原则：

- 默认只读；任何写操作（appops/uninstall）必须二次确认，并展示回滚命令。
- 失败要给出“怎么办”，不要只抛异常。
- 扫描可取消；取消后关闭 socket，不留后台任务。
- 长任务时请求 `navigator.wakeLock`，避免屏幕休眠/标签页节流。

---

## 7. 功能对齐矩阵

| NOIR 功能 | 网页版 | 实现 | 风险 |
|---|---|---|---|
| 设备检测 / adb | ✅ | Tango WebUSB | 需插线、授权、无 adb server 占用 |
| 应用清单 | ✅ | `pm list packages -f` | 低 |
| 权限 / system / debuggable / installer | ✅ | `dumpsys package` | OEM 格式差异 |
| 共享 UID | ✅ | 移植 `Dumpsys.kt` | 低 |
| APK 端点抽取 | ✅ | 远程 ZIP 读取 / `unzip` / pull | ZIP64、异常 APK |
| 分类 / 厂商 / 评分 | ✅ | 移植规则 | 规则版本 |
| 数据流关联 | ✅ | 移植 `Exposure.kt` | 低 |
| Manifest AXML | ✅ | 移植 `Axml.kt` | 异常 AXML |
| 建议 / appops / 回滚 | ✅ | `cmd appops` | OEM 限制 |
| 报告 JSON/MD/HTML/CSV | ✅ | 前端生成 | 低 |
| DNS 三档清单 | ✅ | 移植 `Domains.kt` | 低 |
| `noir diff` | ✅ | 前端对比 | 低 |
| DeepScan | ⚠️ 80–90% | DEX 级信号；可选 WASM 反编译 | 计数口径不同 |
| 完整 jadx 源码 | ❌/⚠️ | 需 WASM 或后端 | 重 |
| 无线 ADB | ❌ | 浏览器无 TCP | 需 bridge |
| iOS | ❌ | 不支持 | — |

---

## 8. 后端判定

### 8.1 v1：不需要后端

逐项检查：

| 需求 | 是否需要服务器 |
|---|---|
| 提供页面/JS/WASM | 静态文件 |
| WebUSB | 浏览器 API |
| ADB 协议 | 浏览器 JS |
| `dumpsys`/`pm`/`getprop` | ADB shell |
| APK ZIP/AXML/DEX 解析 | 浏览器 JS |
| 规则 | 内置 JSON |
| 报告 | Blob 下载 |
| 缓存 | OPFS |
| diff | 浏览器 |
| 隐私承诺 | 无后端更容易证明 |

**结论：nginx + `dist/` + HTTPS 足够。**

### 8.2 什么时候才需要后端

| 场景 | 是否需要 | 建议 |
|---|---|---|
| 服务端 jadx 深度反编译 | 可选 | 默认关闭；用户显式上传 APK，明确告知隐私影响 |
| 报告短链分享 | 可选 | 先用本地文件/URL fragment；短链再考虑对象存储 |
| 账号/配额/计费 | 可选 | 只有做 SaaS 才需要 |
| 规则管理后台 | 不需要 | 静态 JSON + Git 提交即可 |
| 遥测/崩溃上报 | 不建议 | 与 NOIR 隐私定位冲突 |
| 无线 ADB bridge | 不建议 | 需要本地程序，且暴露 ADB 端口风险高 |

**不要为了“以后可能需要”先加后端。** 后端会带来：部署、证书、数据库、备份、鉴权、限流、隐私合规、攻击面。v1 的卖点就是“没有后端，数据不出浏览器”。

### 8.3 静态部署要求

- **HTTPS 必须**：WebUSB 只在 secure context 可用；`http://localhost` 例外（开发用）。
- 正确的 MIME：`.wasm` → `application/wasm`。
- 正确的 CSP/Permissions-Policy。
- SPA 回退：`try_files $uri $uri/ /index.html`。
- 静态资源长缓存，`index.html` 不缓存。
- 如果部署在子路径（GitHub Pages），Vite `base` 要匹配。

### 8.4 nginx 示例

```nginx
server {
    listen 443 ssl http2;
    server_name noir.example.com;

    root /var/www/noir-web;
    index index.html;

    # TLS: certbot / 自己的证书
    ssl_certificate     /etc/letsencrypt/live/noir.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/noir.example.com/privkey.pem;

    # SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 入口不缓存
    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    # 带 hash 的静态资源
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # WASM
    location ~* \.wasm$ {
        types { application/wasm wasm; }
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # 规则 JSON：短缓存 + ETag
    location /rules/ {
        add_header Cache-Control "public, max-age=3600";
    }

    # 压缩
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/javascript application/json application/wasm image/svg+xml;

    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header X-Frame-Options "DENY" always;
    add_header Permissions-Policy "usb=(self)" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" always;
}
```

> 如果使用 WASM 多线程，才需要 `Cross-Origin-Opener-Policy: same-origin` 和 `Cross-Origin-Embedder-Policy: require-corp`。v1 建议单线程，避免额外限制。

### 8.5 也可以不用 nginx

- **GitHub Pages**：纯静态，HTTPS 自动；适合开源演示。
- **Cloudflare Pages / Netlify / Vercel**：静态托管 + 自定义域。
- **对象存储 + CDN**：S3/OSS + CloudFront/CDN。

只要满足 HTTPS + 正确 MIME + 安全头，效果一样。

---

## 9. 安全与隐私设计

### 9.1 威胁模型

网页拥有 ADB shell 权限，等同于“这台电脑上的 adb”。因此：

- **最大威胁是 XSS/供应链攻击**：恶意脚本可以读 IndexedDB 里的 ADB 私钥，进而控制手机。
- **其次是钓鱼/仿冒站点**：用户可能把 ADB 授权给假站点。
- **报告本身是敏感数据**：包名、端点、设备指纹。

### 9.2 措施

1. **严格 CSP**：无内联脚本、无第三方脚本、`connect-src 'self'`。
2. **自托管所有资源**：字体、图标、JS、WASM；不用 Google Fonts/CDN。
3. **无遥测、无错误上报、无广告**。
4. **依赖锁定 + SRI/构建校验**；发布 GitHub Actions 构建产物。
5. **ADB key 只存 IndexedDB**，不提供导出；清除站点数据即失效。
6. **写操作二次确认**，默认只读；展示回滚命令。
7. **报告脱敏选项**：隐藏序列号、fingerprint、包名（可选）。
8. **明确免责声明**：仅用于自己的设备或已授权设备；静态证据不等于实际传输。
9. **开源可审计**：MIT；README 里写清“非官方 Web 移植，与 Verlintas 无隶属关系”。

### 9.3 不建议的做法

- 不要用 `adb -a` 或把 ADB 端口暴露到局域网。
- 不要做“远程 ADB 代理”后端；这会把用户手机暴露给服务器。
- 不要在页面里加载第三方统计/客服/字体。

---

## 10. 性能设计

### 10.1 目标

| 指标 | 目标 |
|---|---|
| 首屏 JS（gzip） | < 300 KB（不含可选 WASM） |
| 300 个应用首次扫描 | 2–6 分钟（USB 2.0，取决于 APK 大小） |
| 缓存命中扫描 | < 10 秒 |
| 500 行表格滚动 | 60 fps（虚拟列表） |
| 内存峰值 | < 300 MB（典型） |
| 单 APK 解析 | 50–500 ms（不含 USB 传输） |

### 10.2 优化点

- **流式解析** `dumpsys`，不要一次性字符串。
- **远程 ZIP 读取**，只拉 dex/manifest，不拉整包。
- **一次 shell 调用读取多个 entry**，减少 round-trip。
- **Worker + transferable ArrayBuffer**，避免主线程卡顿和拷贝。
- **顺序/有限并发**：2–4 个 APK 并发，避免把设备 IO 打满。
- **缓存**：按 APK 路径 + size + mtime 失效。
- **虚拟列表**：500+ 应用不要全量 DOM。
- **按需加载**：DeepScan、diff、HTML 报告生成用动态 import。
- **取消**：`AbortController` + 关闭 socket；不要让后台任务继续跑。
- **Wake Lock**：扫描时保持屏幕唤醒。

### 10.3 内存注意

- 一次只保留一个 dex 的 inflated 数据；扫描完立即释放。
- 不要把 300 个 APK 的 dex 都留在内存。
- `dumpsys` 解析只保留需要的字段，不保留原始文本。
- 报告生成后再序列化，避免同时持有两份大对象。

---

## 11. 里程碑与工作量

| 阶段 | 内容 | 预估 |
|---|---|---|
| M0 Spike | Vite + TS + Tango 连接；列包；设备信息；错误页 | 2–3 天 |
| M1 核心扫描 | `dumpsys` 解析 + 候选过滤 + 远程 ZIP + URL 抽取 + AXML + report.json | 5–7 天 |
| M2 UI/报告 | 仪表盘、应用详情、建议、导出、缓存、i18n | 5–7 天 |
| M3 增强 | DeepScan（DEX 信号）、diff、appops 执行/回滚、移动端适配 | 5–7 天 |
| M4 硬化 | 跨平台测试、错误指引、性能、CSP、部署、文档 | 3–5 天 |

总计：**3–4 周全职**；业余 4–6 周。

### 验收标准

1. 在 macOS Chrome 上连接一台 Android 13+ 设备，完成默认 `scan`。
2. 同一台设备上，网页 `report.json` 与 `noir scan` 的：
   - 应用集合一致（允许 APK 读取失败导致的差异）；
   - 权限集合一致；
   - 分数/分类/厂商一致；
   - 端点集合差异可解释（`unzip/strings` vs 远程 ZIP）。
3. 300+ 应用扫描不崩溃、内存 < 500 MB。
4. 断线/取消/重连有明确提示。
5. `DeviceBusyError` 能正确引导 `adb kill-server`。
6. 部署到 HTTPS 后，CSP 无报错，WebUSB 可用。
7. 报告可被 `noir diff` 读取。

---

## 12. 风险清单

| 风险 | 影响 | 对策 |
|---|---|---|
| WebUSB 仅 Chromium | 用户覆盖有限 | 提供 APK 拖拽模式；明确浏览器要求 |
| 本机 adb server 占用 | 连接失败 | 一级错误页 + `adb kill-server` |
| Windows 驱动不是 WinUSB | 设备不出现 | 文档引导安装 Google/OEM 驱动 |
| Linux 无 udev 规则 | 设备不出现 | 提供 udev 规则片段 |
| 首次授权弹窗 | 用户不知道点 | 图文引导；密钥持久化 |
| Android 11+ 7 天不用自动撤销 | 需要重新授权 | 错误提示 + 重新授权按钮 |
| OEM `dumpsys` 格式差异 | 解析失败 | 容错正则 + 原始样本反馈入口 |
| ZIP64/异常 APK | 端点抽取失败 | 回退整包 pull；标记失败不缓存 |
| 大 APK 内存 | 页面崩溃 | 流式/单 dex 处理；限制大小 |
| 标签页后台节流 | 扫描变慢/暂停 | Wake Lock + 提示保持前台 |
| Tango API 不稳定 | 升级破坏 | 锁版本 + adapter 层 + 集成测试 |
| 供应链/XSS | ADB 私钥泄露 | CSP、自托管、无第三方脚本、代码审计 |
| 商标/仿冒 | 法律/信任 | 注明非官方；不要用官方 logo |

---

## 13. 建议的仓库结构

下面是完整目标结构, M0 只实现其中 `app`, `adb`, `components`, `features` 和 `lib` 的一部分. 当前实际目录见 [docs/project-layout.md](./docs/project-layout.md).

```text
noir-web/
├─ DESIGN.md
├─ README.md
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
├─ index.html
├─ public/
│  ├─ rules/
│  │  ├─ rules.json
│  │  ├─ vendors.json
│  │  ├─ categories.json
│  │  ├─ domains.json
│  │  └─ trackers.json
│  └─ icons/
├─ src/
│  ├─ main.tsx
│  ├─ app/
│  │  ├─ App.tsx
│  │  ├─ routes/
│  │  ├─ components/
│  │  └─ state/
│  ├─ adb/
│  │  ├─ connect.ts
│  │  ├─ device.ts
│  │  ├─ packages.ts
│  │  ├─ dumpsys.ts
│  │  ├─ shell.ts
│  │  └─ appops.ts
│  ├─ apk/
│  │  ├─ remote-zip.ts
│  │  ├─ zip.ts
│  │  ├─ axml.ts
│  │  ├─ manifest.ts
│  │  ├─ dex.ts
│  │  ├─ dex-signals.ts
│  │  └─ urls.ts
│  ├─ core/
│  │  ├─ models.ts
│  │  ├─ rules.ts
│  │  ├─ classifier.ts
│  │  ├─ exposure.ts
│  │  ├─ domains.ts
│  │  ├─ advisor.ts
│  │  ├─ diff.ts
│  │  └─ report.ts
│  ├─ workers/
│  │  ├─ parse.worker.ts
│  │  └─ scan.worker.ts
│  ├─ storage/
│  │  ├─ cache.ts
│  │  ├─ settings.ts
│  │  └─ history.ts
│  ├─ i18n/
│  │  ├─ zh.ts
│  │  └─ en.ts
│  └─ styles/
├─ tests/
│  ├─ fixtures/          # 脱敏 dumpsys / AXML / DEX / APK
│  ├─ dumpsys.test.ts
│  ├─ axml.test.ts
│  ├─ dex.test.ts
│  ├─ rules.test.ts
│  └─ report.test.ts
└─ deploy/
   ├─ nginx.conf
   └─ Dockerfile
```

---

## 14. 技术栈

实现采用与 `workbuddy-gateway/web` 相同的前端栈:

| 层 | 选择 | 理由 |
|---|---|---|
| 构建 | Vite 8 + TypeScript 7 | 快、静态产物简单 |
| UI | React 19 + Ant Design 6 + Radix UI Colors | 与现有工作台一致, 组件和色阶可复用 |
| 状态 | TanStack Query 5 + React Context | 设备/包查询缓存和连接生命周期分离 |
| 路由 | React Router 7 `HashRouter` | 静态托管不需要服务端重写 |
| 表格 | Ant Design Table | 包列表和后续审计结果共用 |
| 图表 | 轻量 SVG / CSS bar | 避免重型图表库 |
| ADB | `@yume-chan/adb@2.6.4` + webusb 2.3.2 + credential-web 2.1.0 | 锁版本, 已验证浏览器 ADB 实现 |
| 压缩 | `fflate` + `DecompressionStream` | 小、快 |
| 缓存 | OPFS | 大对象、结构化 |
| 测试 | Vitest 5 + Testing Library | 单元和组件测试 |
| 校验 | `tsc`, `check-antd-entry.mjs`, production build | 类型、导入边界和构建 |
| 部署 | nginx / GitHub Pages / Cloudflare Pages | 纯静态 |

---

## 15. 最终建议

1. **先做 M0 Spike**：只做“连接 + 列包 + 显示设备信息”，在 macOS/Windows/Linux 各测一次。这是整个项目风险最高的部分，先验证。
2. **M1 用远程 ZIP 读取做端点抽取**，不要一开始就做设备端 `unzip/strings` 脚本；前者更可控，且能同时拿 Manifest。
3. **规则直接移植 NOIR**，保持 `report.json` 兼容；先求“和 CLI 结果对得上”，再考虑增强。
4. **DeepScan 放 M3**，先做 DEX 级信号；WASM 反编译作为可选实验。
5. **不要加后端**。v1 的竞争力就是“无后端、无上传、打开网页就能用”。
6. **把错误指引当一等功能**：`DeviceBusyError`、驱动、udev、授权、断线，这决定用户能不能用起来。

---

## 16. 参考资料

- NOIR: https://github.com/Verlintas/NOIR
- Tango / ya-webadb: https://github.com/yume-chan/ya-webadb
- Tango 文档: https://tangoadb.dev/
- ADB 协议: https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/main/protocol.txt
- WebUSB 规范: https://wicg.github.io/webusb/
- WebUSB 安全上下文/MDN: https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API
- Android DEX 格式: https://source.android.com/docs/core/runtime/dex-format
- Android AXML（非官方说明）: https://github.com/androguard/androguard
- fflate: https://github.com/101arrowz/fflate
- dex-decompiler: https://github.com/androguard/dex-decompiler
- APKMan: https://github.com/jiusanzhou/apkman
- ADB Auditor（参考，CC BY-NC-ND）: https://github.com/thecybersandeep/adbauditor
- APK Auditor（参考，CC BY-NC-ND）: https://github.com/thecybersandeep/apkauditor

---

## 17. 许可证与归属

建议项目使用 **MIT**。

需要保留的第三方声明：

- NOIR — Copyright (c) 2026 Verlintas — MIT。
- Tango / ya-webadb — Copyright (c) yume-chan — MIT。
- fflate — Copyright (c) 101arrowz — MIT。
- dex-decompiler — Copyright (c) Androguard — Apache-2.0（如果使用）。

**不要复制** ADB Auditor / APK Auditor 的代码：它们是 CC BY-NC-ND 4.0，禁止演绎和商业使用。只能阅读其思路，自行实现。

---

*本文档是设计提案，不是最终实现。建议先完成 M0 Spike，再根据真机结果细化 M1。*