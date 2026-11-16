# Changelog

## Unreleased

### Added

- Streaming `dumpsys package` parser with shared-UID permission merging
- Candidate filter for `INTERNET` plus granted sensitive permissions
- Split APK discovery, device-side `unzip`/`strings` scanning and remote ZIP range fallback
- AXML parser and Manifest facts for exported components, backup, cleartext, debuggable and target SDK
- DEX URL extraction and NOIR-compatible Rules, Classifier, Exposure, Domains, Advisor and Trackers
- Audit page with progress, cancel, risk table, evidence details and domain tiers
- USB disconnect and shell timeout handling with retained progress and reconnect guidance
- OPFS persistence for device snapshots, package inventories and scan results
- Last scan restore on reconnect
- Real MI 6 dumpsys and AOSP AXML fixtures for parser and interruption tests
- JSON, Markdown and CSV report export with NOIR-compatible `report.json`
- GitHub Actions `verify` workflow for master pushes and pull requests

- WebUSB to ADB connection with Tango, browser-generated RSA key and IndexedDB credential store
- Device snapshot from `getprop`
- Expanded connect-page device card with identifiers, network state, MAC addresses and USB debugging; empty fields stay hidden
- System card with version, build, security, partition, runtime, kernel and graphics facts
- Self-contained HTML report export
- Plan export with appops and rollback commands
- Device action card with appops preview, apply and rollback plus an OPFS action log
- Report comparison page for two NOIR JSON files
- OPFS AppFacts cache with APK path, size and mtime invalidation
- Hide device and system cards until a device is connected
- Detect physical WebUSB disconnect while idle on the connect page
- Connecting no longer navigates directly to the apps page
- Base APK inventory from `pm list packages -f`
- Connect page with compatibility checks, authorization steps and failure guidance
- Apps page with package/path search and pagination
- Roadmap page that states the M0 boundary
- React 19, TypeScript 7, Vite 8, Ant Design 6, Radix Colors, TanStack Query and React Router shell
- Static deployment config, agent constraints and design documents
- `robots.txt` and `llms.txt` for crawlers and AI discovery
- Accessible navigation and heading structure verified by Lighthouse
- 39-viewport Chrome matrix covering ultrawide, 4K, 2K, 1080p, 720p, laptops, tablets, phones and foldables
- Real-device WebUSB verification on Xiaomi MI 6, Android 14
- Offline service worker, gzip/brotli precompression, build size budget and Oxlint
- Route skeleton, one-shot chunk retry, idle prefetch and offline indicator
- Ant Design 6.7.0 best-practice guide and deprecated-prop check
- Accessible clear label on search and width-bounded package ellipsis

### Changed

- ADB private keys use the IndexedDB credential store again; any legacy OPFS key is removed on the next connection
- Theme-aware brand mark in the sidebar
- Sidebar supports drag and keyboard resize, with persisted width and a rounded collapse control
- Removed static explanatory copy from the connect, apps and roadmap pages
- Empty device state uses placeholder rows instead of instruction text

### Not yet

- HTML report export, report import/diff and OPFS AppFacts cache
- appops apply/rollback and DeepScan