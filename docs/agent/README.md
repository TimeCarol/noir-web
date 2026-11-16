# Agent 入口

这些文件从根目录 [AGENTS.md](../../AGENTS.md) 分出, 或记录跨工具交接. 根文件仍是约束本身. 这里是展开、流程和本轮可复核的教训.

| 文件 | 用途 |
| --- | --- |
| [domain-rules.md](domain-rules.md) | WebUSB、ADB、APK、规则、报告、隐私、浏览器和部署. 根文件要求改这些主题前先读 |
| [workflow.md](workflow.md) | 串行切换、交接要写的证据和错误复盘 |
| [../antd-best-practices.md](../antd-best-practices.md) | Ant Design 6.7.0 官方最佳实践的落地规则 |
| [../react-ui.md](../react-ui.md) | React、Ant Design、Radix 色阶、排版、响应式和文案 |
| [../project-layout.md](../project-layout.md) | 目录职责、依赖边界和测试放置 |
| [../acceptance-matrix.md](../acceptance-matrix.md) | 真机、浏览器、自动化和部署验收矩阵 |
| [../../ARCHITECTURE.md](../../ARCHITECTURE.md) | 浏览器内 ADB 和后续扫描层的总体结构 |
| [../../DESIGN.md](../../DESIGN.md) | NOIR Web 的完整设计提案和里程碑 |

## Claude Code

根目录 [CLAUDE.md](../../CLAUDE.md) 是 Git 普通文件, 只有一行 `@AGENTS.md`. Claude Code 用官方 `@` 导入读取 [AGENTS.md](../../AGENTS.md). 该文件不是第二份规范, 也不要在里面追加项目规则.

## Ant Design 文档

操作约束只写在 [AGENTS.md](../../AGENTS.md#ant-design-文档). 改动 Ant Design 组件、ConfigProvider、主题或样式 API 前必须先查官方文档. 入口是索引 [llms.txt](https://ant.design/llms.txt) 和聚合参考 [llms-full-cn.txt](https://ant.design/llms-full-cn.txt), 组件页在路径后加 `.md`, 主题入口是 [customize-theme-cn.md](https://ant.design/docs/react/customize-theme-cn.md). 全量文件按组件标题或 `Source:` 路径定位相关节, 不整份读入上下文. 落地规则见 [Ant Design 最佳实践](../antd-best-practices.md).

## 验证边界

`bash scripts/test.sh` 成功时的 `verify-scope` 只声明本次命令实际覆盖的项. 类型检查、组件测试和 production build 都不能证明真实手机连接、驱动、线材或厂商 ROM 兼容. `real-device`, `real-browser`, `m1-scan` 没有跑过就不能写成通过. 离线与弱 3G 检查使用本机 Chrome 网络模拟, 不证明真实运营商网络.

公开导入检查是 [check-antd-entry.mjs](../../scripts/check-antd-entry.mjs). 它只检查静态 module specifier, 不能证明 Agent 已经读过 Ant Design 文档.

## 当前范围

M0 的 WebUSB 连接、ADB 认证和设备/包清单已通过. M1 完成权限、端点、AXML 和风险报告. M2 完成 HTML 对比、报告 diff、plan 和 AppFacts 缓存. M3 完成 appops 处置、DEX DeepScan、真机/浏览器验收矩阵和 HTTPS 配置; 可选 dex-decompiler WASM、正式域名 HTTPS 和 Windows/Linux 矩阵仍待执行.