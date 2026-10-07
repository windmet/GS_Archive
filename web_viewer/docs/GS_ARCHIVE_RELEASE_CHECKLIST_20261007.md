# 测试页发布核验清单（2026-10-07）

交给执行上传的窗口用。目标：把 10-06 发布之后的内容上测试分支 `gs-architecture-device-test`。**不发布 Production。** 每一步写了「期望」；结果对不上就停下来回报，不要绕过门禁。

---

## 0. 这次要上线什么（已核对）

上一次部署：源码 `a0fa1aa6`，dataRevision `13133316…78da`，read-model release `ce317169…0b1`（见 `docs/QA_BACKGROUND_THUMBNAILS_PREVIEW_20261006.md`）。

| 内容 | 现状 | 走哪条路 |
|---|---|---|
| 49 张签名图 `public/assets/idols/signs/image_chara_sign_*.png` | 本地有，git 忽略，R2 上没有 | R2 增量批次（清单会自动扫到 `public/assets` 下所有文件） |
| `music_catalog.json` / `song_catalog.json` 的原曲站位字段（`c83e0cb1`） | `a0fa1aa6` 之后唯一改动的数据文件 | R2 新 dataRevision 快照 + read-model 重建 |
| 首页背景分类数据 `masterdata/background_variants.json`（`7cc9e8c7`） | **已在 10-06 发布里**（`7cc9e8c7` 是 `a0fa1aa6` 的祖先） | 只需在线确认，不用重传 |
| 「电话」标签（`49c90f2d`） | **已在 10-06 的源码里** | 只需在线确认 |
| 桌面首页背景一行三张（`da66e017`）及之后所有 UI 提交 | 不在 10-06 发布里 | Pages 代码包 |

> 交接文档 §1 说背景分类和「电话」还没上线。按提交关系看，它们 10-06 就已经发出去了，在线确认一下即可（见 §5）。

---

## 1. 前置条件

- [ ] 工作目录 `E:\Web_build\SideM_Archived\web_viewer`。上传和部署的子进程里清掉 `HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy`（参照 `.deploy/upload-direct.cmd`）。
- [ ] 本地分支 HEAD 至少是 `9f574186`（含三个 CI 修复）。推不推送都不影响下面的流程（Pages 包由本地打包、wrangler 直传），但打包时要求**源码已提交**（`sourceDirty=false`）。
- [ ] `git status`：工作区里 `config/resource-audit.json` 和 `public/translations/zh-CN/archive-general/skills.json` 有改动（后者只差换行符）。如果第 4 步的 build-check 报 `sourceDirty`，先看是哪一个文件造成的再处理，不要直接 `git checkout`。
- [ ] 不要碰 5175 端口；不要运行 `vite build` / `npm run build`（会拷 8 GB 进 `dist/`）。
- [ ] 容量门禁：目标桶 `cloudflare:sidem-archive-preview` 总量必须**严格小于** 8,600,000,000 B。上次的预计值是 7,320,107,118 B；签名图很小，这次只多一个数据快照，应该远低于上限。

---

## 2. R2 增量批次（签名图 + 新数据快照）

批次目录：`.deploy/release-20261007`；证据目录：`.analysis/release-20261007`。

1. **源清单**
   ```
   node scripts/export-preview-assets.mjs --inventory --out .analysis/release-20261007/source-inventory.json
   ```
   - [ ] 期望：清单里有 49 个 `assets/idols/signs/image_chara_sign_*.png`。

2. **远端当前清单**（只读）
   ```
   rclone lsjson cloudflare:sidem-archive-preview --recursive --files-only --no-mimetype --no-modtime > .analysis/release-20261007/remote-before.json
   ```

3. **准备增量批次**。三层上传记录的描述文件都已备好，第三层 `.analysis/release-20261007/overlay-20261006.json` 是本窗口生成的，三层链已在本地用 `loadPreviewUploadedBaseline` 验证通过：
   ```
   node scripts/prepare-preview-incremental-assets.mjs \
     --inventory .analysis/release-20261007/source-inventory.json \
     --remote .analysis/release-20261007/remote-before.json \
     --out .deploy/release-20261007 \
     --baseline-overlay .analysis/release-20261004/uploaded-baseline.json \
     --baseline-overlay .analysis/release-20261006/overlay-20261004.json \
     --baseline-overlay .analysis/release-20261007/overlay-20261006.json \
     --baseline-remote cloudflare:sidem-archive-preview
   ```
   - [ ] 期望选中的对象：49 张签名图（物理 key 是 `assets/idols/signs/*.webp`，无损）+ 新 dataRevision 下的版本化 JSON 快照（`versions/<新 rev>/…`）。
   - [ ] **如果选中了大批其它图片（背景、卡面、剧情等），就停下来回报**：这说明叠加链没生效，不是这次真有变化。
   - [ ] 记下新的 `dataRevision`，后面都要用。

4. **图片验收**
   ```
   python scripts/verify-preview-incremental-images.py --manifest .deploy/release-20261007/manifest.json
   ```
   - [ ] 期望全部通过：签名图逐项 RGBA 比对，必须是 VP8L 无损。

5. **上传**：先 plan，再 upload。工具只做 copy，不会 sync 或 delete。
   ```
   node scripts/upload-preview-incremental-assets.mjs .deploy/release-20261007/manifest.json cloudflare:sidem-archive-preview --plan
   node scripts/upload-preview-incremental-assets.mjs .deploy/release-20261007/manifest.json cloudflare:sidem-archive-preview --upload
   ```
   - [ ] plan 通过容量门禁，并且预计总量 < 8,600,000,000 B。
   - [ ] upload 生成 `upload-receipt.json`（`mode: --upload`，有 `completed_at`）。

6. **刷新资源审计并提交**（交接里说「等签名上传后一起提交」的就是这一步）
   ```
   npm run audit:resources:r2
   git add config/resource-audit.json && git commit -m "chore: resource audit records the uploaded idol signatures"
   ```

7. **为下一批备好第四层描述文件**：`.analysis/release-20261007/overlay-20261007.json`，格式同 `overlay-20261006.json`，填入本批的 manifest、receipt、source-inventory 的 SHA-256 和新的 dataRevision。

---

## 3. 重建 read-model

read-model 构建器要求输入文件都已提交（第 2.6 步之后满足）。

```
node readmodels/tools/build_readmodels.mjs --repo /e/Web_build/SideM_Archived \
  --out <暂存目录>/rm-20261007 \
  --data-revision <第 2.3 步的新 dataRevision> \
  --media-epoch voice64-gzip-all-20260924
node readmodels/tools/verify_artifacts.mjs <暂存目录>/rm-20261007
```
- [ ] `media-epoch` 沿用 10-06 已发布的值 `voice64-gzip-all-20260924`（取自上次包的 `_catalog/bootstrap.json`）。这次没有新的语音或媒体。
- [ ] 暂存目录放在仓库外，同一个盘。
- [ ] `verify_artifacts` 通过。
- [ ] 本地预览抽查（可选但建议）：`SIDEM_READMODEL_CANDIDATE=<暂存目录>/rm-20261007 node node_modules/vite/bin/vite.js --configLoader native --port 5177 --strictPort`，打开小人舞台，选一首有站位的歌（例如 High×Joker 的 jfhtmk），确认「原曲成员」的顺序是 四季、隼人、旬、夏来、春名。用完关掉 5177。

**把代码里所有绑定 read-model release 的文件一起改到新 release**（参照 10-05 的 `68a260c9`，那次改了前三项）。少一项，第 4 步的 `build:check` 或 CI 批量检查就会失败。2026-10-07 第一次执行就停在这里：当时只改了 bootstrap，见 `docs/QA_RELEASE_20261007_STOP_REPORT.md`。

| 文件 | 怎么改 | 谁会检查 |
|---|---|---|
| `readmodels/bootstrap.inline.json` | `cp <暂存目录>/rm-20261007/bootstrap.inline.json readmodels/` | 打包工具：inline bootstrap 必须与候选一致 |
| `readmodels/contracts/routes.json` | 只改 `release` 字段为新 release，并在 `note` 末尾追加一句「Release binding updated on 2026-10-07 for the signature/standing-order test deploy; route, parity and device claims are unchanged.」。**不改任何路由的状态或证据** | `build:check` 的构建审计：`Route ledger release differs from bootstrap` |
| `public/data/assets/portal_card_facets.json` | `node scripts/generate-portal-card-facets.mjs <暂存目录>/rm-20261007` | 门户 bento 检查 |
| `config/collection-browse.v1.json` | `node scripts/generate-collection-browse.mjs --models <暂存目录>/rm-20261007` | `verify-ipad-collection-repair`（CI 批量检查） |

```
node scripts/verify-ipad-collection-repair.mjs
git add readmodels/bootstrap.inline.json readmodels/contracts/routes.json public/data/assets/portal_card_facets.json config/collection-browse.v1.json
git commit -m "chore: bind the 2026-10-07 read-model release"
```
- [ ] 四个文件里的 release 都等于新 bootstrap 的 `release`。
- [ ] `git diff readmodels/contracts/routes.json` 只有 `release` 和 `note` 两行变化。
- [ ] `portal_card_facets.json`：卡片详情文件里本身带 release，所以 826 个 `detailSha256` 会全部变化，这是正常的。要核对的是：把详情里的 release 换回旧值后哈希全部吻合，且每张卡的属性不变（2026-10-07 已按此核对，证据 `.analysis/release-20261007/facet-binding-comparison.json`）。有任何一张对不上才停下回报。

---

## 4. 代码包与 Pages 部署

```
npm run build:check
node scripts/verify-archive-build-audit.mjs --progress
node scripts/prepare-readmodel-preview.mjs --models <暂存目录>/rm-20261007 \
  --out .deploy/test-pages-20261007 --data-revision <新 dataRevision>
```
- [ ] build-check 报告 `sourceDirty=false`。
- [ ] `preview-package.json` 里：`branch: gs-architecture-device-test`、`productionApproved: false`、`sourceRevision` 等于当前 HEAD、`dataRevision` 是新值。
- [ ] 部署（在包目录里执行；只发测试分支）：
  ```
  cd .deploy/test-pages-20261007
  npx wrangler pages deploy dist --project-name gs-archive-preview --branch gs-architecture-device-test
  ```
- [ ] 记下这次部署的 hash 子域（`https://<hash>.gs-archive-preview.pages.dev`）。分支别名只指向最近一次成功构建，验收要用 hash 子域。

---

## 5. 线上核验（用 hash 子域）

自动 HTTP：
```
node scripts/verify-preview-incremental-http.mjs https://<hash>.gs-archive-preview.pages.dev .deploy/release-20261007/manifest.json
```
- [ ] 全部通过：字节、Content-Type、ETag/304、版本化 JSON、gzip。

逐项手动确认：

| # | 核验项 | 期望 |
|---|---|---|
| 1 | `GET /assets/idols/signs/image_chara_sign_001tom.png` | 200，`image/webp`。49 张抽查 3 张（001tom / 025suz / 049eis） |
| 2 | 探针 `GET /assets/__preview_probe_missing__.png` | 404（返回 503 说明 R2 binding 没进这次部署） |
| 3 | `/preview-receipt.json` | `dataRevision` 是新值，`sourceRevision` 等于部署的 HEAD |
| 4 | 门户 `/?view=portal`，担当头图（偏好 `{"preferredIdol":"005kao","portalDefaultScope":"favorite"}`） | 签名显示在立绘后面；手机 390 宽和桌面都要看 |
| 5 | 小人舞台，选 jfhtmk | 「原曲成员」：四季、隼人、旬、夏来、春名。选一首没有站位记录的歌：显示「原曲站位未收录」 |
| 6 | 首页背景选择器（桌面） | 按时段分类，桌面一行三张；缩略图都能载入 |
| 7 | 通信 / 卡片剧情 | 卡片通话标为「电话」 |
| 8 | 摄影台（手机矮屏） | 不压扁；旋转钮可点；0°/90° 吸附 |
| 9 | 小人舞台纯净模式（H） | 控制条收在顶部，指针在舞台上时隐藏 |
| 10 | 控制台 | 没有新的 error（以前就有的 Spine deprecation warning 不算） |

---

## 6. 回报格式

请回报以下内容：新 dataRevision、read-model release、部署 hash 子域、上传前后的桶总量、HTTP 回执路径、上表 10 项各自的结果（含截图路径）。任何一项不通过就写明失败的现象，**不要**为了通过去改门禁或验证脚本。
