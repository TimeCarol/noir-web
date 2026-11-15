#!/usr/bin/env bash
# 职责: 提供 NOIR Web 的 fast / full / viewports 验证入口
# 导出: 退出码和 verify-scope 行
# 依赖: Node.js 24 / npm / 已安装的 web 依赖 / 可选系统 Chrome
# 约束: 不连接真实设备, 不调用真实上游, 视口检查只读取本地 dist
# 作者: timecarol
# 日期: 2026-11-15 22:06
# 版本: v1.1
set -euo pipefail
cd "$(dirname "$0")/.."

mode="${1:-fast}"
case "$mode" in
  fast)
    ;;
  full)
    (cd web && npm ci --no-audit --no-fund)
    ;;
  viewports)
    (cd web && npm run build)
    (cd web && node scripts/check-build.mjs)
    (cd web && npm run test:viewports)
    echo "verify-scope covered=production-build,build-budget,viewport-matrix uncovered=real-device,real-browser,m1-scan"
    exit 0
    ;;
  *)
    echo "用法: bash scripts/test.sh [fast|full|viewports]" >&2
    exit 2
    ;;
esac

node scripts/check-antd-entry.mjs
node scripts/check-antd-usage.mjs
(cd web && npm run typecheck)
(cd web && npm run lint)
(cd web && npm test)
(cd web && npm run build)
(cd web && node scripts/check-build.mjs)

set +e
(cd web && npm run test:viewports)
viewport_code=$?
set -e

viewport_scope=""
if [ "$viewport_code" -eq 2 ]; then
  echo "viewport-check skipped: 未找到 Chrome, 设置 CHROME_PATH 后重试"
elif [ "$viewport_code" -ne 0 ]; then
  exit "$viewport_code"
else
  viewport_scope=",viewport-matrix"
fi

echo "verify-scope covered=antd-entry,antd-usage,typecheck,lint,component-tests,production-build,build-budget${viewport_scope},m1-scan uncovered=real-device,real-browser"