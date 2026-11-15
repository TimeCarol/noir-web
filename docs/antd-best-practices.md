# Ant Design 最佳实践

本文件是 NOIR Web 对官方 Ant Design 文档的落地约定. 官方全量参考是 [llms-full-cn.txt](https://ant.design/llms-full-cn.txt), 当前安装版本是 `antd 6.7.0`.

全量文件约 2 MiB. 不整份读入上下文, 不复制进仓库. 使用时按一级组件标题或 `Source:` 路径定位相关节, 再对照 `web/package.json` 和 `web/package-lock.json` 的版本标记.

## 通用

- 只从 `antd`, `antd/locale/*`, `@ant-design/icons` 导入. 禁止 `antd/es`, `antd/lib`, `@ant-design/pro-*`
- 根节点使用 `ConfigProvider` 统一 `locale`, `theme` 和 `button.autoInsertSpace`
- 静态 `message`, `modal`, `notification` 没有使用时不必包 `App`; 一旦使用, 通过 `App.useApp()` 或 `<App>` 提供上下文
- 主题只使用 Radix 色阶映射到 Ant Design token, 不写自造色值
- 生产构建使用动态主题, 不启用 `zeroRuntime`; 不手工引入全量 `antd/dist/antd.css`
- 组件只使用已安装版本存在的 API, 不使用文档标记为更高版本才提供的属性
- 一个操作区域最多一个主按钮; 图标按钮必须有 `aria-label`
- 页面标题层级只从 `h1` 到 `h2`, 不跳级
- 触屏主要控件至少 44px, 输入字号 16px, 尊重 `prefers-reduced-motion`

## 组件约定

### Alert

- 使用 `title`, 不使用已废弃的 `message`
- 需要关闭操作时使用 `closable` 对象形式, 不使用已废弃的 `onClose`
- 操作按钮放在 `action`, 不把按钮塞进标题文本
- 只有真实错误使用 `type="error"`; 信息提示使用 `type="info"`

### Button

- 主操作使用 `type="primary"`, 同一区域只保留一个
- 图标按钮必须提供 `aria-label`; 纯文本按钮由内容提供名称
- 异步操作使用 `loading`, 避免重复提交
- 图标位置使用 `iconPlacement`, 不使用已废弃的 `iconPosition`
- 填充样式使用 `variant="filled"` 和 `color="default"`, 不依赖内部 class

### Card

- 标题使用 `title`, 操作使用 `extra`
- 边框形态使用 `variant`, 不使用已废弃的 `bordered`
- 卡片内部不再嵌套同视觉层级卡片; 需要分组时用留白和细边框

### Descriptions

- 使用 `items` 和 `column` 数据化 API, 不逐项写 `Descriptions.Item`
- 只读字段保持 label 和 value 的对应关系, 空值显示占位而不是默认值
- 长文本使用可换行容器或 `Typography.Text` 的 ellipsis, 不撑破卡片

### Input

- 搜索输入使用 `allowClear`; 6.7.0 支持 `allowClear={{ label: '清除搜索' }}` 提供无障碍名称
- 输入框必须有可见 label 或 `aria-label`
- 不在输入框内放解释性长文案
- 触屏字号 16px, 控件高度至少 44px

### Result

- 页面级空状态、错误和成功结果使用 `Result`
- `status` 表达语义, `title` 保持短句, `extra` 放一个明确操作
- 不在页面内重复堆叠说明段落

### Space

- 新代码使用 `orientation` 和 `wrap`, 不使用已废弃的 `direction` 作为新约定
- 行内间距优先 `small` / `medium`, 表单操作区使用 `wrap`

### Steps

- 使用 `items` 数据化 API
- 步骤说明使用 `content`, 不使用已废弃的 `description`
- 当前步骤使用 `current`, 失败使用 `status="error"`, 不为装饰添加无意义步骤
- 移动端依赖组件的响应式行为, 不手写横向滚动步骤条

### Table

- 必须提供稳定 `rowKey`
- 大数据表格使用分页; 需要横向滚动时设置 `scroll.x`
- 列标题保持短标签, 复杂说明放在单元格或 Tooltip
- 不把整页数据一次性渲染成无分页长表
- 表格行操作使用明确的按钮名称, 不只放图标

### Tag

- 使用 `color` 表达状态, 同时保留文本, 不只靠颜色传达含义
- 标签数量多时由父布局换行, 不横向溢出页面

### Typography

- 复制操作使用 `copyable` 和明确的 `tooltips`
- 长标识使用 `ellipsis` 并给 `maxWidth: '100%'`, 不撑破表格
- 正文使用 `Paragraph` / `Text`, 不用标题标签模拟正文

## 验证

```bash
npm run lint --prefix web
npm run typecheck --prefix web
npm test --prefix web
bash scripts/test.sh viewports
```

- `check-antd-entry.mjs` 拦截禁用的导入路径
- `check-antd-usage.mjs` 拦截已废弃的 `message`, `onClose`, `description`, `iconPosition` 和 `bordered`
- `check-build.mjs` 检查无 sourcemap、预压缩文件和体积预算
- Lighthouse 检查无障碍、最佳实践和 SEO
- 真实浏览器检查主题、侧栏、表格、分页和移动布局