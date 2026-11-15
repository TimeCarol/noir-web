# TODO

## M0

- [x] WebUSB device picker and ADB authentication
- [x] IndexedDB ADB key persistence
- [x] Device snapshot from `getprop`
- [x] Base APK inventory from `pm list packages -f`
- [x] Connect, apps and roadmap pages
- [x] Static build and nginx config
- [x] Unit and component tests with synthetic data
- [x] Chrome DevTools navigation, theme, sidebar drag/collapse, copy, responsive and Lighthouse checks
- [x] 39-viewport browser matrix from 280px to 5120px wide and 568px to 2160px tall
- [x] Production build preview
- [x] Real-device WebUSB authorization on Xiaomi MI 6, Android 14
- [x] Offline app shell, weak 3G load, route skeleton and chunk retry
- [x] gzip/brotli precompression, no source maps, build size budget and Oxlint
- [ ] Windows WinUSB matrix
- [ ] Linux udev matrix

## M1

- [x] Stream `dumpsys package` and port shared UID parsing
- [x] Filter candidates by INTERNET and sensitive permissions
- [x] Discover split APKs with `pm path`
- [x] Read ZIP central directory with `tail` and `head`
- [x] Inflate `AndroidManifest.xml` and `classes*.dex`
- [x] Port NOIR AXML parser and manifest facts
- [x] Extract URLs from DEX bytes
- [x] Port Rules, Classifier, Exposure and Domains
- [x] Keep `report.json` compatible with NOIR

## M2

- [x] Risk dashboard and app detail
- [x] Recommendations
- [ ] Rollback plan
- [x] JSON, Markdown and CSV export
- [ ] HTML export
- [x] DNS tracker, review and functional lists
- [ ] Import two reports and diff
- [ ] IndexedDB AppFacts cache with APK path, size and mtime

## M3

- [ ] DEX-level DeepScan signals
- [ ] Optional `dex-decompiler` WASM mode
- [ ] appops preview, apply and rollback
- [ ] Manual device and browser acceptance matrix
- [ ] Deployment verification on HTTPS