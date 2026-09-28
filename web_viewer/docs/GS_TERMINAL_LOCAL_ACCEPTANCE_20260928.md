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

审计来源摘要记录于 `.analysis/terminal-media-audit.json`，source signature `4a8702d65382db373f36d6e5b7db8a0deb1a2bee318f0f91ca6026536f3e6b30`。本地菜单位于 `public/data/terminal/wallpapers.json` 与 `backgrounds.json`；图片位于 `public/assets/terminal/`。生成器没有修改原始 PNG。菜单与图片属于同一批发布内容；图片受仓库忽略规则保护，**本批没有将菜单提交或将图片发布至 R2/Pages**，以免远端菜单指向尚未发布的图片。

## 代码与浏览器检查

- 包内 `verify-terminal-contracts.mjs` 40 项、`test_terminal_media.py` 9 项，以及现有 startup、Portal、routes、navigation state/async、Home 状态合同均通过。
- `npm run build:check` 通过，2557 模块完成 Vite 代码编译，输出 `.analysis/build-check`，没有复制 `public` 资源包。
- Browser 插件当前未提供；使用本机已有 Playwright/Chromium，访问当前构建和本地 public 映射服务 `http://127.0.0.1:5176/`。验证新用户 Welcome（中性底色、0 canvas、壁纸/terminal 请求 0）、轻量入口进入 Portal、壁纸弹层真实目录、选中后保存 ID、桌面横图 1600px、手机竖图 640px、偏好槽位选人后不更改 startupMode/startupIdol。相关流程无页面异常或 HTTP 失败。
- 模拟 1440×900、1180×820、1024×768、1024×1366、390×844、320×740、390×540、512×768、844×390 九个视口，Portal 八入口均存在、末项可滚动到达、无根级横向溢出、所选横竖图方向正确、无 pageerror。截图在 `.analysis/ui-qa/terminal-*`，属于本地 Chromium，非真机。

## 尚未完成的验收

Home 真实场景更换尚未验收：构建内嵌的 read-model release `409c9f9e2f5f010da609a44c15f9b6f5bc15329c86d2969bf90b22f20d81cdd9` 在本机已有旧候选目录中缺少 `/_catalog/v/<release>/home/index.json`，请求 HTTP 404；现有 `openGameHome` 正常显示“游戏风首页暂时无法打开”。本次未混用其他 release 的 home 页。需要生成/接入与内嵌 bootstrap 一致的完整 read-model 候选，然后补测固定背景、换人/换装/切句、快速切换和失效回退。

本轮未完成真实 iPad Safari、Android Edge、浏览器工具栏变化、软键盘、200% 缩放或用户所报底部闪烁的视频复测。因此不声称真机、Home 背景或发布验收通过。上线前还须把本地生成的两份菜单与全部被引用 WebP 作为同批资源发布，并核对发布清单与实际 HTTP；代码提交本身不触发这一结论。
