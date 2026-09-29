# Terminal 补丁本地应用与验收（2026-09-28）

输入为用户提供的 `GS_Terminal_919b252_r1.zip`；包内文档作为指导与待核对说明。实际基线：`codex/gs-architecture-rebuild` / `919b2520fb0063a60184fae93fd2a4a417b60f96`。安装器默认 dry-run 的 18 处目标均匹配，随后应用 17 个文件和 App.vue 四处受保护接线。备份记录：`.analysis/terminal-install/e224852bf662/record.json`。无关未跟踪文件未修改。

## 本地素材与目录

来源是当前 `public` 发布元数据、`public/assets/bg` 和配置解析的 `E:/BaiduNetdiskDownload/SideM/GS_Res/ALL_PHOTOS/assets/resources/image/image_card`。生成器先只读审计，再以同参数 `--derivatives --write`，最后 `--check` 重算全部产物，三步均成功。

| 内容 | 数量/大小 |
| --- | ---: |
| SSR 资源 ID | 124 |
| 壁纸目录条目（base/p） | 248 |
| 合格不透明场景 | 139 |
| 排除的透明场景 | 53 |
| 新增内容寻址 WebP | 883 个，59,494,172 bytes |
| 本批派生预算 | 96 MiB，未超 |

审计来源摘要记录于 `.analysis/terminal-media-audit.json`，source signature `4a8702d65382db373f36d6e5b7db8a0deb1a2bee318f0f91ca6026536f3e6b30`。本地菜单位于 `public/data/terminal/wallpapers.json` 与 `backgrounds.json`；图片位于 `public/assets/terminal/`。生成器没有修改原始 PNG。派生媒体受仓库忽略规则保护，不包含在源码提交中；发布状态见下文。

## 代码与浏览器检查

- 包内 `verify-terminal-contracts.mjs` 40 项、`test_terminal_media.py` 9 项，以及现有 startup、Portal、routes、navigation state/async、Home 状态合同均通过。
- `npm run build:check` 通过，2557 模块完成 Vite 代码编译，输出 `.analysis/build-check`，没有复制 `public` 资源包。
- Browser 插件当前未提供；使用本机已有 Playwright/Chromium，访问当前构建和本地 public 映射服务。验证新用户 Welcome（中性底色、0 canvas、壁纸/terminal 请求 0）、轻量入口进入 Portal、壁纸弹层真实目录、选中后保存 ID、桌面横图 1600px、手机竖图 640px、偏好槽位选人后不更改 startupMode/startupIdol。相关流程无页面异常或 HTTP 失败。
- 模拟 1440×900、1180×820、1024×768、1024×1366、390×844、320×740、390×540、512×768、844×390 九个视口，Portal 八入口均存在、末项可滚动到达、无根级横向溢出、所选横竖图方向正确、无 pageerror。截图在 `.analysis/ui-qa/terminal-*`，属于本地 Chromium，非真机。

## 测试站点发布与远端验收

在核对已有 `E:/GS_ReadModels_QA/candidate_20260927_r23` 与内嵌 release `409c9f9e2f5f010da609a44c15f9b6f5bc15329c86d2969bf90b22f20d81cdd9` 一致后，使用 `scripts/prepare-readmodel-preview.mjs` 生成 8542 文件、62,682,069 bytes 的测试包。包内 `preview-receipt.json` 标明源码 `2d3f1ce694ed962ef859b3bf59ba2837f5134d89`、数据修订 `c5ab806ee57778bc387322acfcf5211ecdf0521721a6df279dbe52a6e006e5b9`、`productionApproved=false` 和测试分支 `gs-architecture-device-test`。本地预览服务在 `http://127.0.0.1:5199/`，提供该测试包及本地媒体。

两份菜单和 883 个 WebP 按 Pages 资源路由放入 R2 staging，共 885 文件、59,704,495 bytes。以 `rclone copy --immutable` 上传至 `cloudflare:sidem-archive-preview`，随后 `rclone check --one-way --download` 核对 885 文件一致、零差异；没有执行远端删除或覆盖已有对象。Pages 仅部署到 `gs-architecture-device-test` 预览分支，固定地址为 <https://ac82bee5.gs-archive-preview.pages.dev/>，分支地址为 <https://gs-architecture-device-test.gs-archive-preview.pages.dev/>。远端 receipt、Welcome、壁纸菜单与 WebP、Home 索引 HTTP 检查通过。

远端 Chromium 验证 Welcome 无提前媒体加载；Portal 壁纸选择后桌面加载 1600px 横图、手机加载 640px 竖图。Home 加载了与 receipt 一致的索引，场景目录显示首批 12 项。选固定背景后切换偶像及服装，背景保持固定；改回“跟随台词背景”后恢复台词场景。稳定进入 Home 后切场景，背景与角色均可见，相关资源 HTTP 200；进入 Home 后立即切场景再等待 25 秒，背景与角色同样恢复可见。截图及脚本保存在 `.analysis/ui-qa/terminal-*`。初次加载和立即切换期间见过临时黑屏与资源请求中止，最终画面恢复，不能据此断言所有网络/设备条件下无闪烁。

## 尚未完成的验收

本轮未完成真实 iPad Safari、Android Edge、浏览器工具栏变化、软键盘、200% 缩放或用户所报底部闪烁的视频复测。测试站点和桌面 Chromium 的通过不等于真机或生产发布验收。预览 receipt 仍明确标记 `allPublicRoutesMigrated=false`、`deviceReviewAccepted=false`。
