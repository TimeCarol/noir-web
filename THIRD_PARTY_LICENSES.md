# Third-party notices

NOIR Web is an unofficial web port. It is not affiliated with Verlintas.

## Runtime dependencies

| Project | License | Use |
| --- | --- | --- |
| [Tango / ya-webadb](https://github.com/yume-chan/ya-webadb) | MIT | WebUSB transport, ADB authentication, shell |
| [React](https://github.com/facebook/react) | MIT | UI runtime |
| [Ant Design](https://github.com/ant-design/ant-design) | MIT | UI components |
| [Radix UI Colors](https://github.com/radix-ui/colors) | MIT | Color scales |
| [TanStack Query](https://github.com/TanStack/query) | MIT | Read-only device and package queries |
| [React Router](https://github.com/remix-run/react-router) | MIT | Static hash routing |
| [Playwright Core](https://github.com/microsoft/playwright) | Apache-2.0 | Test-only Chrome viewport matrix |
| [Oxlint](https://github.com/oxc-project/oxc) | MIT | Static lint checks |

## Design and rule references

| Project | License | Use |
| --- | --- | --- |
| [Verlintas/NOIR](https://github.com/Verlintas/NOIR) | MIT | Audit pipeline, rules, report schema and appops design |
| [Androguard dex-decompiler](https://github.com/androguard/dex-decompiler) | Apache-2.0 | Planned optional WASM DeepScan |
| [APKMan](https://github.com/jiusanzhou/apkman) | MIT | Browser APK parsing reference |
| [ADB Auditor](https://github.com/thecybersandeep/adbauditor) | CC BY-NC-ND 4.0 | Reference only, no code copied |
| [APK Auditor](https://github.com/thecybersandeep/apkauditor) | CC BY-NC-ND 4.0 | Reference only, no code copied |

Test fixtures include a 7 KB AndroidManifest.xml from the AOSP Tag application (Apache-2.0) and a redacted `dumpsys package` excerpt from a Xiaomi MI 6. The excerpt contains only public system package names and permission lines; it has no serial number, account, endpoint or ADB key.

CC BY-NC-ND projects cannot be copied, modified or redistributed. They are listed only as prior art.

## Fonts

The UI uses system fonts. No remote font is loaded.