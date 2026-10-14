# 2026-10-14/15 测试站发布

用户授权「部署到测试」。目标：`gs-archive-preview` 项目的 `gs-architecture-device-test` 分支（`preview.gs-archive.com`）。**正式站没动。**

## 结果

| 项 | 值 |
|---|---|
| 部署源码 | `126567c8`（PR #50，并入 master `869d0a0e`） |
| read-model release | `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`（`E:/Web_build/GS_Archive_Domain_Work/rm-release-20261015`） |
| R2 data revision | `fda1a54c6df58cabc13e7a0d86b40ab14ff831270ca0d197fc9a7298279ec3ab` |
| Pages 部署 | `c016484d.gs-archive-preview.pages.dev`，别名 `gs-architecture-device-test`；覆盖前别名上是 `96294431`，它是本次源码的祖先 |
| 包 | worktree `.deploy/test-pages-20261015-126567c8`，1,109 个实体 head shell |

## 中间作废的一批（f1a9b997）

10-14 晚第一次准备的批次 `.deploy/release-20261014`（data revision `f1a9b997…`，7,088 个对象）**没有传完，已作废**：

- 上传在第 1/6 组中途停掉了，交给另一个 Agent 接手。
- 准备批次之后，source gate 修复（`8df54fd7`）改了 `public/data/archive_baseline_report.json`，所以这批数据和 master 对不上，上传脚本的源哈希检查会拒绝它。
- 另一个 Agent（codex）没有续传这一批，而是从主 checkout 的 `b32d152b`（stage 线尾）另外做了一批 `fef20b76…`，5,991 个对象，传完了。记录见 [R2_INCREMENTAL_UPLOAD_20261014.md](R2_INCREMENTAL_UPLOAD_20261014.md)（PR #49）。这一批的数据来自 stage 线，没有 portal 的改动，不能直接给 master 用；它的素材（live-chibi、剧情 gzip 等）已经在桶里。

## 实际上线的一批（fda1a54c）

在 worktree 里从 master `c1ab908c` 重新准备：

1. 源清单：`.analysis/release-20261015/source-inventory.json`，105,515 项，缺 82 项（已知的 bgm/se/ambient 音频）。
2. 远端清单：133,765 个对象。第一次 `rclone lsjson` 输出被截断，不是合法 JSON，准备脚本报错；去掉代理变量、加 `--fast-list` 重列后正常。
3. 叠加链：09-24 source baseline → 10-04 → 10-06 → 10-07 ×2 → 10-09 → codex `fef20b76`（`.analysis/r2-upload-20261014/uploaded-baseline.json`）。
4. 批次 `.deploy/release-20261015`：6,397 个对象，452,698,755 B。其中数据 5,397 个（165 MB）、技能演出视频 248 个（271 MB）、服装/货币图标 665 个、卡池图 83 个、属性图 4 个。
5. 图片验收通过（731 张 PNG→WebP 无损）。plan 通过：桶 8,315,077,916 / 8.6 GB 上限，账户 9.20 GB。
6. 上传：`--upload` 一次完成，`upload-receipt.json` 的 `actual_bucket_bytes` = 8,315,077,678，与预计一致。上传时清空了 `HTTP(S)_PROXY` / `ALL_PROXY`，并设 `NO_PROXY=*`。
7. read-model 用新 revision 重建，`verify_artifacts` 通过；四个绑定文件改到 `2430ef3d`，`verify-portal-bento`、`generate-collection-browse --check`、`build:check` 通过。

### 循环依赖说明

`public/data/assets/portal_card_facets.json` 记录 read-model release，而 release 又由 data revision 算出，data revision 包含这个文件。所以 R2 上 `fda1a54c` 快照里的 facets 写的是上一个 release（`1770c925`），和 bootstrap 对不上。

运行时没有影响：
- read-model 的 826 行卡片自带属性，卡片目录不会去取 facets；
- 门户 bento 在 App 里没有传 facets。

`cardAttribute` 遇到 release 不一致会返回空，不会显示错误属性。以后要真正用上 facets，得把它移出 data 快照，或者改成不记 release。

### 上传顺序

绑定会改 `portal_card_facets.json`，而上传脚本只在开头核对一次源哈希，之后从暂存目录读。所以要先准备批次，开始上传后再做绑定。

## 线上验收（2026-10-15）

- `preview-receipt.json`：sourceRevision `126567c8`、release `2430ef3d`、dataRevision `fda1a54c`。
- `verify-portal-path-locator-browser.mjs https://preview.gs-archive.com`：46 项全部通过。
- `verify-preview-http.mjs`：要从**主 checkout** 运行，并显式传整条链（两批分别在两个 checkout 下，`DEFAULT_CHAIN` 写不下）：
  ```
  node scripts/verify-preview-http.mjs https://preview.gs-archive.com .deploy/voice64/full-manifest.json .deploy/productization-assets-lossless-20261002/manifest.json .deploy/ui-gallery-lossless-20261004/manifest.json .deploy/lossy-pictures-20261006/manifest.json .deploy/background-finish-lossless-thumbs-20261006/manifest.json .deploy/release-20261007/manifest.json .deploy/release-20261009/manifest.json .deploy/r2-incremental-20261014/manifest.json E:/Web_build/GS_Archive_Domain_Work/native-relations-integrated-20261013/web_viewer/.deploy/release-20261015/manifest.json
  ```
  通过：完整清单 + 8 次上传，brand PNG、WebP 映射、ETag/304、data HEAD、语音 Range/416、404、405。
- Browser 抽查（headless Chromium，1280×900）：
  - `/costumes/`、`/currencies/?entity=currency:free-gem`、`/gashas/210042/`、`/cards/001tom_ssr01/`、`/songs/brndnf/`：没有控制台错误、没有 4xx 或失败请求、没有破图。
  - 卡池页显示「通常招募」标签和 5 种抽取道具。
  - 技能演出点击后从 R2 加载 `card-skill-movies/001tom_ssr01.mp4`，播放到 6.87 s 结束。
  - 舞台：BRAND NEW FIELD 的 2D 舞台「3/3 人就绪」，画布正常。只看了加载，没有看完整演出。
- 没做：手机实机、舞台完整播放和原片对照。

## 下一批

- 叠加链的最新一项：`.analysis/release-20261015/overlay-20261015.json`（worktree 内，manifest sha256 `f7cf81a8…`，receipt sha256 `96757ed5…`）。
- 在哪个 checkout 准备，`.deploy` 批次就放在那个 checkout 下；HTTP 校验按上面那样显式传链。
