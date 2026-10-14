# 2026-10-14 测试站发布（交接：R2 上传未完成）

用户授权「部署到测试」。目标与 10-13 相同：`gs-archive-preview` 项目的 `gs-architecture-device-test` 分支（`preview.gs-archive.com`）。**不动正式站。**

## 已完成

| 步骤 | 结果 |
|---|---|
| 源清单 | `.analysis/release-20261014/source-inventory.json`：105,515 项，缺 82 项（都是已知的 bgm/se/ambient 音频）。用 `export-preview-assets.mjs --inventory --follow-junctions --models <rm-currency-costume>` 生成，worktree 的语料目录是联接，需要这个参数 |
| 远端清单 | `.analysis/release-20261014/remote-before.json`：127,981 个对象 |
| 第六层描述 | `.analysis/release-20261014/overlay-20261009.json`：补上 10-09 那次上传，之前没有生成 |
| 增量批次 | `.deploy/release-20261014`：7,088 个对象，550,028,045 B。主要是新 data revision 下的数据；素材有 665 个服装/货币图标、248 个技能演出视频、132 个 live-chibi、83 个卡池图、4 个属性图。没有误选背景或卡面 |
| 新 data revision | `f1a9b99712d0740cf6184ee67c7e4f706b4821fef81f08fdad6629b4347ffbb4` |
| 图片验收 | 通过：859 张 PNG→WebP 无损，尺寸与可见像素一致 |
| plan | 通过：桶内预计 8,152,873,669 B / 上限 8.6 GB；账户预计 9.03 GB |
| read-model | `E:/Web_build/GS_Archive_Domain_Work/rm-release-20261014`，release `1770c925…`，`verify_artifacts` 通过；四个绑定文件已改（`6a5efbf1`） |

## 未完成：从这里接着做

在 worktree `E:/Web_build/GS_Archive_Domain_Work/native-relations-integrated-20261013/web_viewer` 里执行（批次目录必须在当前 checkout 的 `.deploy` 下）。

1. **上传**：第一次在第 1/6 组（880 张 WebP）中途停掉了，远端可能已有一部分。rclone copy 会跳过已有对象，直接重跑即可：
   ```
   node scripts/upload-preview-incremental-assets.mjs .deploy/release-20261014/manifest.json cloudflare:sidem-archive-preview --upload
   ```
   完成后应生成 `.deploy/release-20261014/upload-receipt.json`（`mode: --upload`，有 `completed_at`）。
2. **打包**（先 `npm run build:check`，源码必须已提交；然后恢复 `config/resource-audit.json`、`config/translation-release.json`、`public/translations/manifest.json`）：
   ```
   node scripts/prepare-readmodel-preview.mjs --models E:/Web_build/GS_Archive_Domain_Work/rm-release-20261014 --out .deploy/test-pages-20261014-<短 sha> --data-revision f1a9b99712d0740cf6184ee67c7e4f706b4821fef81f08fdad6629b4347ffbb4 --origin https://preview.gs-archive.com
   node scripts/verify-entity-head-shells.mjs --dist=.deploy/test-pages-20261014-<短 sha>/dist --origin=https://preview.gs-archive.com
   ```
3. **部署**（在包目录里）：
   ```
   npx --no-install wrangler pages deploy dist --project-name gs-archive-preview --branch gs-architecture-device-test --commit-hash <完整 sha> --commit-dirty=false
   ```
   覆盖前先看别名上的 `preview-receipt.json`。现在是 `96294431`，是本次源码的祖先，覆盖不会丢掉别人的工作。
4. **线上验收**：
   - `node scripts/verify-portal-path-locator-browser.mjs https://preview.gs-archive.com`
   - 抽查：`/costumes/`、`/currencies/?entity=currency:free-gem`、一张 SSR 卡页的技能演出播放、`/gashas/210042/` 卡池规则、舞台小人（新素材第一次上线）
5. **收尾**：
   - 写 `.analysis/release-20261014/overlay-20261014.json`，格式同 `overlay-20261009.json`，填本批 manifest、receipt、source-inventory 的 SHA-256 和新 data revision。
   - 把 `.deploy/release-20261009/manifest.json` 和本批 manifest 加进 `scripts/verify-preview-http.mjs` 的 `DEFAULT_CHAIN`。前者在主 checkout，本批在 worktree；需要时用命令行显式传链。
   - 在本文补线上结果，更新 [CURRENT_STATE.md](CURRENT_STATE.md) 的测试站一行。
