# HTTPS 部署与验证

本目录包含 NOIR Web 的 nginx 配置和 HTTPS 验收脚本。应用是纯静态 SPA，不需要后端；HTTPS 是 WebUSB 的必要条件。

## 前置条件

- 一个已解析到服务器的域名，例如 `noir.example.com`
- nginx 1.25.1+，支持 TLS 1.3、`http2 on` 和 `gzip_static`
- certbot，或已经准备好的证书链
- 构建产物 `web/dist`
- 服务器上的 `/var/www/noir-web` 和 `/var/www/letsencrypt`

## 部署步骤

1. 构建并运行本地验证：

```bash
npm ci --prefix web
bash scripts/test.sh full
npm run build --prefix web
```

2. 复制静态文件：

```bash
sudo mkdir -p /var/www/noir-web
sudo rsync -a --delete web/dist/ /var/www/noir-web/
sudo install -d -m 755 /var/www/letsencrypt
```

3. 安装配置：

```bash
sudo install -m 644 deploy/nginx.conf /etc/nginx/conf.d/noir-web.conf
```

修改配置中的两处占位：

- `server_name noir.example.com`
- `/etc/letsencrypt/live/noir.example.com/...` 证书路径

4. 申请或放置证书：

```bash
sudo certbot certonly --webroot -w /var/www/letsencrypt -d noir.example.com
```

如果使用其他 CA，确保证书链和私钥路径与配置一致，并且 `chain.pem` 存在。

5. 检查并加载 nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

6. 运行 HTTPS 验收：

```bash
bash deploy/verify-https.sh https://noir.example.com
```

脚本检查：

- HTTP 到 HTTPS 的 301/308 重定向
- 证书链和主机名
- HSTS、CSP、Permissions-Policy、nosniff、frame、referrer、CORP
- `index.html` 和 `sw.js` 不缓存
- 带 hash 的静态资源长缓存和 gzip 预压缩
- Service Worker 可访问

## 手动浏览器验收

在 HTTPS 域名上打开页面，确认：

1. 地址栏是 HTTPS 且证书有效。
2. 点击“选择设备”可以打开 Chrome WebUSB 选择器。
3. 授权后设备信息和包列表出现。
4. Service Worker 已注册，刷新后离线壳仍可打开。
5. 报告下载和 OPFS 持久化正常。
6. 开发者工具 Network 中带 hash 资源的 `Cache-Control` 为长缓存，`index.html`/`sw.js` 为 no-cache。

## 缓存与安全头

配置预期：

```text
/assets/*       Cache-Control: max-age=31536000
/index.html     Cache-Control: no-cache
/sw.js          Cache-Control: no-cache
/sw-manifest.json Cache-Control: no-cache
```

安全头：

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self' blob:; ...
Permissions-Policy: usb=(self)
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Cross-Origin-Resource-Policy: same-origin
```

注意：`includeSubDomains` 会影响同一父域下的所有子域。如果该域名还有未启用 HTTPS 的子域，先移除该指令，确认后再启用 HSTS preload。

## 故障排查

- `nginx -t` 报证书路径错误：检查 certbot 实际域名目录和 `chain.pem`。
- 浏览器不显示 WebUSB 选项：确认页面是 HTTPS，且 `Permissions-Policy` 没有被代理或 CDN 覆盖。
- Service Worker 不更新：确认 `/sw.js` 和 `/sw-manifest.json` 返回 no-cache，并清理旧站点数据。
- 带 hash 资源 404：确认 `web/dist/assets` 完整复制，且没有把 `index.html` 缓存成旧版本。
- 报告下载被 CSP 阻止：确认 `default-src` 包含 `blob:`，且没有网关重写响应头。

## nginx 配置检查

本地没有安装 nginx 时，可用 Docker 验证语法：

```bash
docker run --rm -v "$PWD/deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine nginx -t
```

配置里的证书路径在容器中不存在，`nginx -t` 会报证书文件缺失；这是预期现象，语法错误会先于证书检查暴露。正式验证请在目标服务器执行 `nginx -t`。

## 部署验收记录模板

```text
域名:
服务器:
证书签发机构:
证书到期:
nginx -t:
verify-https.sh:
Chrome 版本:
WebUSB:
Service Worker:
离线重载:
报告下载:
OPFS 恢复:
备注:
```