# 项目协作约定

本文件是仓库内跨工具、跨模型共享的约束入口, 不依赖某家工具的隐藏记忆. 展开和历史决定在链接的文档里. 修改某主题前先打开对应文档.

主题索引: [Agent 入口](docs/agent/README.md), [领域规则](docs/agent/domain-rules.md), [目录约定](docs/project-layout.md), [交接与复盘](docs/agent/workflow.md).

根目录 `CLAUDE.md` 是普通文件, 内容只有 `@AGENTS.md`. 不要改成符号链接, 不要在里面追加规则. 普通 Markdown 链接不会自动进入启动上下文. 下面写「必须先读」的文件, 要在改代码前打开.

## 改代码前必须先读

按任务打开对应文件, 读完对应节再改. 没有读完就不要开始改那一块.

- `web/` 的页面、布局、CSS、交互、表单、无障碍、浏览器 API 或前端性能: [React 界面约定](docs/react-ui.md)
- WebUSB、ADB、APK、规则、报告、隐私或部署: [领域规则](docs/agent/domain-rules.md) 里同名的节
- 目录、依赖边界和测试放置: [目录约定](docs/project-layout.md)
- Ant Design 组件、ConfigProvider、主题或样式 API: 本文件「Ant Design 文档」
- 同一类错误再次出现: [交接与复盘](docs/agent/workflow.md) 的「错误复盘」

## 安全边界

- 公共 Git 文档、提交的日志和测试夹具不得包含真实设备数据、真实包名、真实端点、ADB 私钥、设备截图或商户凭据
- 不发起真实设备写操作, 不执行 `appops set`, `pm uninstall` 或 `pm revoke`, 除非用户明确要求并在真机上人工确认
- 所有设备数据只在浏览器内处理. 不加遥测、崩溃上报、第三方统计、远程字体或远程脚本
- 不启动本地 adb server, 不做 `adb -a`, 不把 ADB 端口暴露到局域网或公网
- 报告可能包含设备上的包名和端点, 测试和示例只使用合成数据

## 技术栈与硬约束

- 前端固定为 React 19、TypeScript 7、Vite 8、Ant Design 6、Radix UI Colors、TanStack Query 5、React Router 7
- ADB 固定使用 Tango `@yume-chan/adb` 2.6.x. 升级前先核对 API 变更和浏览器行为
- 依赖版本写在 `web/package.json` 和 `web/package-lock.json`, 两处必须一致. 不引入 ProComponents
- 只从 `antd`, `antd/locale/*`, `@ant-design/icons` 导入. 禁止 `antd/es`, `antd/lib`, `@ant-design/pro-*`
- 颜色只用 Radix 色阶和 Ant Design 语义 token. 不写自造十六进制色值, 品牌 SVG 的默认值除外
- 基础字号只使用 12 / 14 / 24px, 边框 `0.5px`, 不加装饰性阴影和动画
- WebUSB 只在主线程使用. 重解析放 Worker, 但不假设 Worker 里一定拿得到 `navigator.usb`
- 默认只读. 写操作必须先展示命令和回滚方式, 再由用户确认
- 这是纯静态应用, 不新增后端、数据库、登录或 API 代理, 除非用户明确批准

## Ant Design 文档

改动会使用或调整 Ant Design 组件、ConfigProvider、主题或组件样式 API 时, 必须先查官方文档, 再修改代码. 禁止凭记忆猜测属性、主题 token 或样式 API.

必须按这个顺序做, 不能跳过:

1. 读取 `web/package.json` 与 `web/package-lock.json` 里已安装的 `antd` 版本. 以两处一致的版本为准
2. 打开索引 [llms.txt](https://ant.design/llms.txt), 选出本任务相关的组件、主题或样式链接. 中文说明优先 `-cn.md`
3. 需要完整示例或组件最佳实践时, 把 [llms-full-cn.txt](https://ant.design/llms-full-cn.txt) 下载到系统临时目录, 按一级组件标题或 `Source:` 路径定位相关节, 只读这些节
4. 只读取选中的 Markdown. 组件页是在文档路径后加 `.md`, 例如 [config-provider-cn.md](https://ant.design/components/config-provider-cn.md)
5. 对照文档里的版本标记, 例如「自 x.y.z 版本开始」. 标记高于已安装版本才提供的 API 不得使用

`llms-full-cn.txt` 约 2 MiB, 不整份读入上下文, 不复制进仓库, 不安装 Ant Design 的 MCP、CLI 或 npm 插件. 具体组件规则见 [Ant Design 最佳实践](docs/antd-best-practices.md).

官方页面打不开时, 必须在交付说明写明打不开的 URL、失败现象, 以及仍可核验的来源和版本, 例如已安装包的类型定义. 没有读到的页面不能写成已读.

此类任务的交付说明必须列出实际打开的官方页面, 以及它们和已安装 `antd` 版本的对应关系.

## 开发

- 只实现当前需求所必需的改动, 不悄悄扩大范围, 不为假设中的需求提前增加抽象、配置或兼容逻辑
- 外部数据在接收入口完成一次解析和校验, 向内部传递结构明确、类型已确定的值
- 不提前提取只使用一次的函数. 主函数呈现正常流程, 校验和细节放在下方职责明确的小函数中
- 不手改生成文件. 要改结果就改生成源, 再按仓库已有命令重新生成
- 测试验证真实实现. 尽量减少 mock, 仅在隔离外部依赖或难以稳定复现的条件时使用
- 沿用已有构建、测试和发布流程, 不引入仓库未采用的工具
- 不熟悉的功能先检索仍在维护、许可证明确的开源实现, 比较适用性、依赖和问题. Star 数不能代替适用性. 不复制许可证不兼容或来源不明的代码
- JavaScript 公开接口使用 JSDoc. 注释与行为一致, 不给显而易见的代码逐行复述
- 注释遵循团队代码注释规范: 文件头、公开类型、公开函数、字段, 中文, 英文标点, 句末不加句号

## 源码落点

- `web/src/app` 只放应用壳、主题、品牌和顶层 Provider
- `web/src/adb` 放 WebUSB 连接、认证、设备属性、包列表和后续 shell 封装
- `web/src/apk` 放 ZIP、AXML、DEX 和 Manifest 解析, M1 开始使用
- `web/src/core` 放规则、分类、评分、报告和 diff, M1 开始使用
- `web/src/features` 按页面聚合组件、查询和交互, 一个功能一个目录
- `web/src/components` 放跨页面复用的展示组件
- `web/src/lib` 只放跨功能纯函数, 不新增无业务含义的 `utils` / `common` / `helpers`
- 一个目录一个职责. 子模块不反向依赖页面, 页面不直接实现协议解析

## 锁定目标

M0 的目标是: Chrome / Edge 桌面版通过 WebUSB 连接一台已授权的 Android 设备, 读取设备属性和基础 APK 清单, 不崩溃, 有明确错误指引.

M0 不包含: 权限解析, 端点抽取, AXML, 风险评分, 报告, appops, DeepScan, `noir diff`. 没实现的能力不能写成已可用.

未完成项以 [TODO.md](TODO.md) 为准, 变更记录写在 [CHANGELOG.md](CHANGELOG.md).

## 规范命令

在仓库根目录执行.

```bash
bash scripts/test.sh fast
bash scripts/test.sh full
bash scripts/test.sh viewports
npm run dev --prefix web
```

`fast` 不下载依赖, 适合 `node_modules` 已经存在时. `full` 会 `npm ci` (需要网络), 然后跑类型检查、Oxlint、组件测试、Ant Design 导入检查和 production build. 二者都不连接真实设备. `viewports` 只构建并运行本机 Chrome 的 39 个视口矩阵、离线重载和弱 3G 检查.

`scripts/test.sh` 成功时会打印一行 `verify-scope`, 只声明本次命令真正覆盖的项. 手工真机证据单独记录在 [交接与复盘](docs/agent/workflow.md), 不能写进这一行的 covered.

## 验证边界

- 单元和组件测试只能证明代码路径, 不能证明真实手机的 WebUSB 授权、驱动、线材和厂商 ROM 兼容
- 真机验收必须写清设备型号、Android 版本、操作系统、浏览器版本和失败现象
- 39 个视口矩阵只证明 Chromium 布局不溢出, 不证明真机软键盘, 安全区域和折叠姿态
- 离线重载和弱 3G 检查只使用本机 Chrome 网络模拟, 不证明真实运营商, 代理或企业网络
- 浏览器兼容性检查只覆盖 Chromium 桌面, Firefox 和 Safari 没有 WebUSB
- Ant Design 文档阅读是判断性的, 测试通过不能证明 Agent 读过文档

## 文案

- 界面使用中文, 描述用英文标点, 保留顿号. 逗号、分号、冒号后空一格
- 不用中点 `·` 作分隔, 不用 `/` 拼接不同字段, 末尾不加句号
- 用布局、层级、图标和交互反馈表达设计意图, 不在页面放解释设计或实现方式的说明文字
- 页面标题格式为 `页面名称 - NOIR Web`
- 不把未实现功能写成已可用, 不伪造设备数据或成功状态
- 不自动提交 Git. 用户明确要求提交时再执行