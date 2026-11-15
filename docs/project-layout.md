# 目录与依赖边界

项目是纯静态 React 应用. 浏览器负责 WebUSB、ADB、APK 解析和报告生成, 没有 Go 服务、数据库或 API 进程.

## 目录职责

```text
noir-web/
├── AGENTS.md                    # 跨工具共享约束入口
├── CLAUDE.md                    # 只有 @AGENTS.md
├── ARCHITECTURE.md              # 总体结构、线程和安全边界
├── DESIGN.md                    # NOIR Web 设计提案
├── README.md                    # 项目状态、运行和部署
├── docs/
│   ├── agent/
│   │   ├── README.md            # Agent 入口和验证边界
│   │   ├── domain-rules.md      # WebUSB、ADB、APK、规则、部署
│   │   └── workflow.md          # 交接、真机记录和错误复盘
│   ├── project-layout.md        # 本文件
│   └── react-ui.md              # React、Ant Design 和视觉约定
├── deploy/
│   └── nginx.conf               # 静态部署和安全头
├── scripts/
│   ├── test.sh                  # fast / full / viewports 验证入口
│   ├── check-antd-entry.mjs      # 禁止 antd/es, antd/lib, ProComponents
│   └── check-antd-usage.mjs      # 拦截已废弃的 Ant Design 属性
└── web/
    ├── package.json
    ├── package-lock.json
    ├── index.html
    ├── tsconfig.json
    ├── vite.config.ts
    ├── .oxlintrc.json           # Oxlint 规则
    ├── sw-template.js           # service worker 模板, 构建时注入版本
    ├── scripts/
    │   ├── viewport-check.mjs   # 39 个尺寸, 离线和弱网浏览器检查
    │   ├── generate-sw-manifest.mjs
    │   ├── precompress.mjs      # gzip / brotli
    │   └── check-build.mjs      # sourcemap 和体积预算
    ├── test-results/            # 生成的视口报告, 不提交
    ├── dist/                    # 生成产物, 不手改
    └── src/
        ├── main.tsx             # React root 和 QueryClient
        ├── style.css            # 工作台、连接页、包列表
        ├── app/
        │   ├── App.tsx          # 导航、路由、主题
        │   ├── adb-context.tsx  # ADB 连接生命周期
        │   ├── brand.ts         # 主题化 SVG favicon
        │   ├── lazy.ts          # 路由 chunk 重试
        │   ├── prefetch.ts      # 空闲预取
        │   ├── RouteBoundary.tsx # chunk 失败兜底
        │   ├── service-worker.ts # 生产环境注册
        │   └── theme.ts         # Radix -> Ant Design token
        ├── adb/
        │   ├── connect.ts       # WebUSB 授权和 ADB 认证
        │   ├── device.ts        # getprop 设备快照
        │   ├── errors.ts        # 连接失败指引
        │   ├── packages.ts      # pm list packages -f
        │   └── types.ts         # 连接、设备、包数据边界
        ├── apk/                 # M1: ZIP, AXML, DEX, Manifest
        ├── core/                # M1: 规则、评分、报告、diff
        ├── components/
        │   ├── DeviceStatus.tsx  # 页头连接状态
        │   ├── NetworkStatus.tsx # 离线状态
        │   └── RouteSkeleton.tsx # 弱网骨架
        ├── features/
        │   ├── connect/         # 连接页、设备摘要
        │   ├── apps/            # 包列表和搜索
        │   └── roadmap/         # 当前范围和里程碑
        ├── lib/
        │   ├── errors.ts        # 未知异常转短文本
        │   └── format.ts        # 设备名和空值
        ├── assets/
        │   └── noir.svg         # 品牌标记
        ├── test/
        │   └── deadlines.ts     # 慢设备测试预算
        └── test-setup.ts        # jsdom 清理和浏览器能力
```

## 依赖方向

```text
app/App.tsx
  -> features/*
  -> components/*
  -> app/adb-context
       -> adb/*
       -> lib/*

features/* -> components/*, lib/*, adb/*, apk/*, core/*
components/* -> lib/*
adb/* -> lib/*, @yume-chan/*
apk/* -> lib/*, core/*
core/* -> 不依赖 React, 不依赖 adb/*
```

- `adb` 只管连接、认证和 shell, 不导入页面
- `apk` 只管字节解析, 不导入 React 或 ADB 连接
- `core` 只放纯规则和报告, 不读 DOM, 不发请求
- `features` 可以组合上述模块, 但不能反向被底层导入
- `app` 只做装配和跨页面生命周期, 不实现协议细节

## 新代码的归属

- 新增一个页面时, 在 `features/<name>/` 下放页面组件、页面子组件和测试
- 新增一个 ADB 命令封装时, 放在 `adb/` 的对应文件, 不放进页面组件
- 新增一个 APK 解析器时, 放在 `apk/`, 输入和输出用明确类型
- 新增一个跨页面展示组件时, 放在 `components/`
- 只服务一个页面的组件留在该 feature 目录, 不提前上提
- 不新增无业务含义的 `utils` / `common` / `helpers`
- 不为两行复用抽一层包装, 不为假设中的 M1 需求提前建空模块

## 测试放置

- 纯解析和规则测试放在实现同目录, 命名 `*.test.ts`
- React 组件测试放在组件同目录, 命名 `*.test.tsx`
- 测试使用合成数据, 不连接真实设备
- 组件测试使用 Testing Library, 通过可见文本和角色查询
- 视口矩阵在 `web/scripts/viewport-check.mjs`, 通过 `npm run test:viewports` 或 `bash scripts/test.sh viewports` 执行
- 真机验收不进入 CI, 记录在交接说明或 `docs/agent/workflow.md`