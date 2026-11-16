#!/usr/bin/env bash
# 职责: 校验 NOIR Web 的 HTTPS 证书, 重定向, 安全头和静态缓存
# 用法: bash deploy/verify-https.sh https://noir.example.com
# 退出码: 0 全部通过, 1 存在失败项
set -uo pipefail

base="${1:-}"
if [[ -z "$base" ]]; then
  echo "用法: $0 https://noir.example.com" >&2
  exit 2
fi
base="${base%/}"
if [[ "$base" != https://* ]]; then
  echo "地址必须以 https:// 开头" >&2
  exit 2
fi
host_port="${base#https://}"
host="${host_port%%/*}"
hostname="${host%%:*}"
http_base="http://${host}${base#https://${host}}"

fail=0
pass() { printf 'PASS  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; fail=1; }

echo "NOIR Web HTTPS verification"
echo "target: $base"
echo "host:   $hostname"
echo

# 1. HTTP 必须 301/308 到 HTTPS
location="$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' "$http_base" 2>/dev/null || true)"
if [[ "$location" == 30[18]*"https://${hostname}"* ]]; then
  pass "HTTP redirects to HTTPS ($location)"
else
  fail "HTTP redirect missing or wrong ($location)"
fi

# 2. 证书有效期和主机名
if echo | openssl s_client -connect "${hostname}:443" -servername "$hostname" -verify_return_error >/dev/null 2>&1; then
  pass "TLS certificate chain and hostname verify"
else
  fail "TLS certificate chain or hostname verification"
fi
cert_dates="$(echo | openssl s_client -connect "${hostname}:443" -servername "$hostname" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || true)"
if [[ -n "$cert_dates" ]]; then
  echo "$cert_dates" | sed 's/^/       /'
else
  fail "could not read certificate dates"
fi

# 3. 关键安全头
headers="$(curl -sS -D - -o /dev/null "$base/" 2>/dev/null || true)"
check_header() {
  local pattern="$1" label="$2"
  if echo "$headers" | grep -Eiq "$pattern"; then pass "$label"; else fail "$label"; fi
}
check_header '^strict-transport-security:.*max-age=31536000' 'HSTS max-age'
check_header '^content-security-policy:' 'Content-Security-Policy'
check_header '^permissions-policy:.*usb=\(self\)' 'Permissions-Policy usb=(self)'
check_header '^x-content-type-options:.*nosniff' 'X-Content-Type-Options nosniff'
check_header '^x-frame-options:.*DENY' 'X-Frame-Options DENY'
check_header '^referrer-policy:.*no-referrer' 'Referrer-Policy no-referrer'
check_header '^cross-origin-resource-policy:.*same-origin' 'Cross-Origin-Resource-Policy same-origin'

# 4. 入口和 Service Worker 不缓存
check_cache() {
  local path="$1" expected="$2" label="$3"
  local value
  value="$(curl -sS -I "$base$path" 2>/dev/null | tr -d '\r' | awk 'BEGIN{IGNORECASE=1} /^cache-control:/{print; exit}')"
  if echo "$value" | grep -Eiq "$expected"; then pass "$label ($value)"; else fail "$label missing/incorrect ($value)"; fi
}
check_cache '/index.html' 'no-cache|no-store' 'index.html not cached'
check_cache '/sw.js' 'no-cache|no-store' 'sw.js not cached'

# 5. 静态资源缓存和 gzip 预压缩
asset="$(curl -sS "$base/" 2>/dev/null | grep -oE '/assets/[^" ]+\.js' | head -1 || true)"
if [[ -n "$asset" ]]; then
  asset_headers="$(curl -sS -H 'Accept-Encoding: gzip' -D - -o /dev/null "$base$asset" 2>/dev/null || true)"
  if echo "$asset_headers" | grep -Eiq '^cache-control:.*(max-age=31536000|immutable)'; then
    pass "hashed asset long cache ($asset)"
  else
    fail "hashed asset cache header ($asset)"
  fi
  if echo "$asset_headers" | grep -Eiq '^content-encoding:.*gzip'; then
    pass "hashed asset gzip precompression"
  else
    fail "hashed asset gzip precompression"
  fi
else
  fail "could not find a hashed JS asset in index.html"
fi

# 6. 安全上下文和 Service Worker 可达
if curl -sS -o /dev/null -w '%{http_code}' "$base/sw.js" 2>/dev/null | grep -q '^200$'; then
  pass "service worker reachable"
else
  fail "service worker unreachable"
fi

echo
if [[ "$fail" -eq 0 ]]; then
  echo "verify-https: all checks passed"
else
  echo "verify-https: failures detected"
fi
exit "$fail"
