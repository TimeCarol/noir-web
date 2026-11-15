# React 界面约定

前端在 `web/`, 使用 React 19、TypeScript 7、Vite 8、Ant Design 6、Radix UI Colors、TanStack Query 5 和 React Router 7.

## 构建与开发

```bash
npm install --prefix web
npm run dev --prefix web
npm run build --prefix web
```

- 开发服务器默认 `http://127.0.0.1:5174`. WebUSB 在回环地址下可用
- 生产产物在 `web/dist`, 由 nginx 或静态托管直接提供, 不需要 Node 运行时
- 不手改 `web/dist`
- 生产 JS/CSS 必须压缩, 不发布 source map
- `npm run lint` 使用 Oxlint, `fast` / `full` 入口会执行
- 生产构建生成 service worker、预缓存清单和 gzip/brotli 文件, 由 `check-build.mjs` 校验预算
- 首次访问后缓存应用外壳; 弱网显示骨架, chunk 失败只重试一次并提供重新加载入口

## 页面结构

- `app/App.tsx` 提供可调宽度侧栏、移动导航和三条路由
- 页面根节点使用 `.page-stack`, 页面之间保持 24px 间距
- 页面主操作放在卡片标题右侧或内容顶部, 一个区域只保留一个主按钮
- 页面不放大段设计说明. 必要的业务边界和控制说明放在操作发生处

## 色彩

- 中性色使用 Radix Slate
- 主操作和选中态使用 Iris
- 成功和在线状态使用 Jade
- 警告和待授权使用 Amber
- 错误和危险操作使用 Tomato
- 辅助强调使用 Cyan
- 不写自造十六进制色值. 品牌 SVG 的默认值只是无主题时的兜底

## 排版与间距

- 基础字号只使用 12 / 14 / 24px. 标签和辅助文本 12px, 正文 14px, 页面标题 24px
- 标题使用字重和颜色建立层级, 不靠字号堆叠
- 边框使用 `0.5px`, 圆角 6px, 卡片和表格不使用阴影
- 关闭装饰性动画, 尊重 `prefers-reduced-motion`
- 触屏输入字号 16px, 主要按钮和输入区域至少 44px

## 响应式

- 960px 及以下隐藏桌面侧栏, 使用顶部三列移动导航
- 760px 及以下收窄页面内边距, 连接页改为单列
- 至少检查 280px 到 5120px 宽, 568px 到 2160px 高, 覆盖带鱼屏, 4K, 2K, 1080p, 720p, 笔记本, 平板, 手机, 双折叠, 三折叠和上下折叠
- 运行 `bash scripts/test.sh viewports` 执行 39 个视口矩阵, 结果写入 `web/test-results/viewports.json`
- 浏览器模拟通过不等于真机软键盘、安全区域和折叠姿态通过

## 无障碍

- 每个输入有可见或 `aria-label` 名称
- 连接状态使用 `role="status"` 和 `aria-live="polite"`
- 主内容在连接或读取时设置 `aria-busy`
- 焦点样式使用 0.5px Iris 轮廓, 不依赖颜色单独传达状态
- 图标按钮必须有 `aria-label` 和 `title`

## 文案

- 使用中文, 英文标点, 保留顿号. 逗号、分号、冒号后空一格
- 不用中点 `·` 作分隔, 不用 `/` 拼接不同字段, 末尾不加句号
- 不把未实现功能写成已可用. M0 页面明确写"权限和端点在 M1 开放"
- 页面标题格式为 `页面名称 - NOIR Web`

## Ant Design

- 只从 `antd`, `antd/locale/*`, `@ant-design/icons` 导入
- 不导入 `antd/es`, `antd/lib` 或 `@ant-design/pro-*`
- 使用 `ConfigProvider` 统一 locale 和主题 token
- 使用 `Card`, `Alert`, `Button`, `Descriptions`, `Steps`, `Table`, `Input`, `Tag`, `Typography` 的现有 API
- 改动组件、主题或样式 API 前, 按 [AGENTS.md](../AGENTS.md#ant-design-文档) 查官方文档并核对已安装版本

## M0 页面

- 连接页: 兼容性状态, 三步授权, 设备摘要, 仅失败时出现错误指引
- 应用列表: 包名和基础 APK 路径, 搜索, 客户端分页
- 路线图: 紧凑的 M0 到 M3 里程碑
- 页头: 设备状态和主题切换按钮
- 侧栏: 三条导航, 可拖拽宽度, 底部圆角收起按钮, 不放说明文字