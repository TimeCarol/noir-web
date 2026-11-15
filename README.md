# NOIR Web

Unofficial web port of [Verlintas/NOIR](https://github.com/Verlintas/NOIR): an Android privacy audit that runs entirely in the browser over Chrome WebUSB.

> Status: **M1 verified**. WebUSB connection, ADB authorization, permission/endpoint scanning, AXML manifest facts, risk scoring, recommendations and JSON/Markdown/CSV export were verified end-to-end on a Xiaomi MI 6, Android 14, Chrome 157 / macOS. DeepScan, report diff and appops are M2+ work.
>
> This project is not affiliated with Verlintas.

## What works now

- Chrome / Edge / Opera desktop connects to an Android device over WebUSB.
- First connection generates an ADB RSA key in the browser and stores it in IndexedDB.
- Device info: manufacturer, model, Android version, SDK, build, ABI, fingerprint.
- Base APK inventory: package name and APK path from `pm list packages -f`.
- Candidate filtering by `INTERNET` plus at least one granted sensitive permission.
- Streaming `dumpsys package` parsing with duplicate-block and shared-UID merging.
- Split APK discovery with `pm path`, device-side `unzip`/`strings` URL extraction and a `tail`/`head` remote-ZIP fallback.
- AXML parsing for exported components, backup, cleartext traffic, debuggable and target SDK.
- DEX URL extraction, NOIR-compatible scoring, vendor/category classification, data-flow correlation and recommendations.
- Audit page with scan progress, cancel, filters, evidence details, DNS domain tiers and JSON/Markdown/CSV export.
- Client-side search and pagination.
- Draggable, persisted sidebar width and a rounded collapse control.
- Minimal interface that uses layout and status instead of explanatory copy.
- Explicit guidance for `adb kill-server`, USB debugging, WinUSB, udev and authorization failures.
- System / light / dark theme, responsive shell, no backend.
- Offline app shell after the first visit, weak-network skeletons, chunk retry and a small offline indicator.
- 39-viewport layout matrix plus offline reload and weak 3G browser checks.

## What is not implemented yet

- DeepScan signals and the optional `dex-decompiler` WASM mode
- HTML report export, report import/diff and the IndexedDB AppFacts cache
- appops preview, apply and rollback
- Windows WinUSB and Linux udev acceptance matrices

## Stack

React 19, TypeScript 7, Vite 8, Ant Design 6, Radix UI Colors, TanStack Query 5, React Router 7, Tango `@yume-chan/adb` 2.6.x. Oxlint and Playwright Core cover lint and browser layout tests.

## Run

```bash
npm install --prefix web
npm run dev --prefix web
npm run lint --prefix web
```

Open `http://127.0.0.1:5174`. WebUSB works on the loopback address because it is a secure context.

Production build:

```bash
bash scripts/test.sh full
npm run build --prefix web
```

`npm run build` runs TypeScript, Vite production bundling, service worker generation and gzip/brotli precompression. Source maps are disabled and the build fails if the gzip budget is exceeded. See `web/scripts/check-build.mjs`.

Deploy `web/dist` behind nginx, GitHub Pages or Cloudflare Pages. HTTPS is required for WebUSB. See [deploy/nginx.conf](./deploy/nginx.conf) for CSP, MIME, `gzip_static` and cache headers.

## Hard requirements

- Chromium-based desktop browser. Firefox and Safari do not support WebUSB.
- USB data cable, Android USB debugging enabled, one-time authorization on the phone.
- Close any local `adb` server, Android Studio, scrcpy or other WebADB tab holding the USB interface:
  ```bash
  adb kill-server
  ```
- Windows needs the ADB interface bound to WinUSB. Linux needs udev permissions. macOS usually works without extra setup.
- A phone cannot audit itself over USB. Use a computer, or a second Android device as USB host.

## Project constraints

- [AGENTS.md](./AGENTS.md) - shared agent constraints
- [docs/agent/domain-rules.md](./docs/agent/domain-rules.md) - WebUSB, ADB, privacy, report and deployment rules
- [docs/antd-best-practices.md](./docs/antd-best-practices.md) - Ant Design 6.7.0 usage rules
- [docs/react-ui.md](./docs/react-ui.md) - React, Ant Design, Radix colors and responsive rules
- [docs/project-layout.md](./docs/project-layout.md) - directory responsibilities
- [ARCHITECTURE.md](./ARCHITECTURE.md) - browser-only architecture and thread model
- [DESIGN.md](./DESIGN.md) - full design proposal and milestones

## Privacy

All device data stays in the browser. There is no backend, telemetry, remote font, third-party script or upload path. Reports are generated locally. ADB private keys live in IndexedDB scoped to the site origin. Clearing site data removes them and requires re-authorization.

## Verification

GitHub Actions runs the same full suite on `master` pushes and pull requests. `bash scripts/test.sh full` passes the Ant Design import check, TypeScript type check, Oxlint, 49 unit/component tests, the production build, the 39-viewport browser matrix, offline reload and weak 3G checks.

The production bundle is 399 KiB gzip across JS/CSS/HTML, has no source maps, and ships 28 precompressed `.gz`/`.br` files. `web/scripts/check-build.mjs` fails the build if gzip exceeds 400 KiB or a source map appears.

Chrome DevTools checks on the dev and production builds:

- WebUSB connect, ADB authorization, device info, 352-package inventory, search and disconnect on Xiaomi MI 6
- Permission/endpoint audit, app detail expansion and report export on the same device
- Navigation across connect, apps, audit and roadmap pages
- Full audit on MI 6: 352 packages, 161 flagged apps, 11,701 endpoints, 44 recommendations
- Theme system/light/dark cycle with persisted preference
- Sidebar drag resize, keyboard resize and rounded collapse control at 1440px
- Copy command feedback
- Lighthouse snapshot: Accessibility 100, Best Practices 100, SEO 100
- Agentic Browsing 67 only because no ARD manifest is published at `/.well-known/ard.json`

First-visit install caches the hashed app shell. A 390×844 offline reload passed after the service worker was ready. A 180 KiB/s, 250 ms-latency 3G load reached the connect page in about 3 seconds.

The viewport matrix in `web/scripts/viewport-check.mjs` covers ultrawide, 4K, 2K, 1080p, 720p, laptops, tablets, phones and foldables from 280px to 5120px wide and 568px to 2160px tall.

Run it alone with:

```bash
bash scripts/test.sh viewports
```

`adb kill-server` must run before a real WebUSB test because the local adb server holds the interface.

## License

MIT. See [LICENSE](./LICENSE). NOIR is MIT © 2026 Verlintas; Tango (ya-webadb) is MIT © yume-chan. See [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) for notices.