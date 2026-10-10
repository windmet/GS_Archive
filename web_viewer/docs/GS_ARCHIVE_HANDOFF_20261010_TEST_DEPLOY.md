# 2026-10-10 测试站部署交接

状态：额度不足，暂停于此。下面是已完成的事、做法、以及等额度够了再做的事。

## 当前线上测试站

- 最新 hash 地址：`https://dbbe684c.gs-archive-preview.pages.dev`（验收用 hash 子域）
- 分支别名：`https://gs-architecture-device-test.gs-archive-preview.pages.dev`（只指向最近一次成功部署）
- 代码：提交 `7725368d`（分支 `codex/portal-architecture-cleanup-20261004`）
- 读取模型：release `0d220947edea…`，沿用 `.deploy/test-pages-20261009` 的 `/_catalog`，没有重建
- 包目录：`.deploy/test-pages-20261010`（= 20261009 包 + 新前端代码 + 新翻译清单与卡面台词）
- 验证边界：只用 curl 确认门户索引 200、`card-lines.json` 可下载；没有跑浏览器验收，没有跑 `verify:preview-http`

## 本轮做了什么

1. 首页白边：根因是 `SpineStage.vue` 的 `updateFraming` 用取整的 `clientWidth/Height`，非整数缩放下画布少不到 1px。改为 `getBoundingClientRect()` 向上取整（`1d28df17`）。背景和 spine 同在一块画布，所以一起漏。曾尝试只改背景 cover，既不对症又让首页加载不出来，已回退，不要重试。
2. 门户“资料暂时无法读取”：Pages 的 Git 自动构建（`npm run build:preview`）只打前端代码，不含 `/_catalog/v/<release>/…`。必须用本地打包 + `wrangler pages deploy`。
3. 卡面语音翻译缺失：不是 R2。`translations/` 是 Git 跟踪文件，随 Pages 发布。复用旧包时带进了旧版 `card-lines.json`（63 字节空壳，仓库版 1,281,160 字节）和旧 `manifest.json`。
4. 断句：`ArchiveText.js` 与 `ReadingTypography.js` 等 12 个文件的改动此前只在工作区、未提交，所以从未进过部署包。现已提交为 `7725368d`：
   - `reflowText` 在 CJK/拉丁边界合并游戏文本框的硬折行，空行保留为段落边
   - `archiveLineText` 只对译文应用；日文原文保留原折行
   - 新增样式 `.gs-flow`（`white-space: pre-line` 等）
   - 更新了 `verify-character-line-text.mjs` 中译文断言（旧断言要求译文保留折行）

## 低成本重新部署流程（代码或翻译变化时）

读取模型不变时，不要重建、不要重传素材：

1. 在 `.deploy` 下对已提交 HEAD 建临时 worktree（`git worktree add --detach .deploy/wt-head HEAD`）。仓库根在 `E:\Web_build\SideM_Archived`，应用在其下 `web_viewer/`。
2. 把原 `web_viewer/node_modules` 用 junction 链进 `wt-head/web_viewer/node_modules`，运行 `npm run build:preview`。
3. 把包里 `dist/_app` 和 `dist/index.html` 换成新构建；`translations/` 从 `public/translations/` 同步（至少 `manifest.json` 与有变化的分片）。
4. 在包目录执行 `npx wrangler pages deploy dist --project-name gs-archive-preview --branch gs-architecture-device-test --commit-dirty=true`（wrangler 已用 OAuth 登录；只传变化的文件，几乎不花额度）。
5. 删除 junction 时只用 `rmdir`，不要对带 junction 的目录 `rm -rf` 之前不先 `rmdir`，否则可能删到原 `node_modules`。然后 `git worktree remove --force` 和 `git worktree prune`。
6. 包内用 `diff -rq public/translations dist/translations` 核对（`scenarios/.gitattributes` 例外，不发布）。

## Cloudflare Pages 项目设置变更

- 预览分支白名单（`preview_branch_includes`）原为三个分支：`codex/p1-effect-texture-deps`、`codex/mobile-story-immersive`、`codex/archive-image-loading-p1`。曾临时加入当前分支，已改回原样。不要加回：自动构建不含 `/_catalog`，出来的站是打不开的，还白占额度。

## 未提交 / 待处理

- 工作区未跟踪：`../.analysis/`、`../GS_Archive_source_for_repair.zip`、`docs/GS_ARCHIVE_PREVIEW_WEBP_R2_HANDOFF_DEEPSEEK.md`、`docs/sidem_title_fx_css_rebuild_v9.html`、`public/data/terminal/`、`scripts/render-voice-listening-review.py`。没动，也没纳入任何提交。
- `verify:preview-http` 对某素材的 Range 断言失败（返回 `bytes 0-31/17904`，期望 `/36655`）。未查；素材存储没变，怀疑是素材或脚本本身问题，未证实。
- 浏览器验收未做：首页在 90%/110%/125%/150% 缩放下四角无白边；卡面语音译文与新断句；门户目录能打开。

## 等额度够了再做（按优先级）

1. 浏览器验收上面三项，并给断句加专门 verifier（日文折行、中文译文折行、拉丁词被截、空行、制作人占位符、标点附近）。
2. Seasonal 数据层：另一份交接说明已重编 559 个 compiled 文件、306 篇 Reader 文档、3 处空白台词、678 条不存在的语音文件名，需要新的 R2 dataRevision + 新读取模型 + 当前前端一起发布；本次测试站不含这些。这和断句是两件事。
3. R2 容量：外部审计称桶已用约 88.6%（约 7.62 GB，上限按 8.6 GB 配置计），余约 0.91 GiB。注意桶内含旧版本残留，不等于当前线上需要的量。下次完整 RC 前做 live / superseded / orphan 分类，再决定压实（compaction）。该数字来自外部报告，我没有复核。
4. Git 体积：外部报告称仓库约 174 MB，主要是 `docs/` 里的回滚 ZIP 与大证据 JSON。建议今后不再提交新的回滚 ZIP；要不要重写历史，先跑最大对象审计再定。同样未复核。
5. 发布门槛：Pages 文件数告警线可定在 8000 / 8500 / 9000，目前约 6294（外部报告数字）。

## 不要做的事

- 不要为这类前端改动重新导出或上传 R2 素材。
- 不要把生产分支（`master`）当作这个包的目标。
- 不要用 Direct Upload 新建 Pages 项目；项目已绑定 Git，包部署只发到测试分支别名。
