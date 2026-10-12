# L2 记录：偶像 / Unit 的 head 外壳与标签页标题

日期：2026-10-13。输入 HEAD：`6d30a44b`；分支 `claude/portal-static-route-20261012`。计划见 [门户静态化路线](GS_ARCHIVE_PORTAL_STATIC_ROUTE_PLAN_20261012.md) §4。

## 改动

- `scripts/generate-entity-head-shells.mjs`（新增）：以构建产物的 `index.html` 为模板，为 49 个偶像、16 个 Unit 写出 `idols/<id>/index.html`、`units/<code>/index.html`。只替换 `<title>` 并在 `</head>` 前插入 description、canonical、`og:type/site_name/locale/title/description/url/image`、`twitter:card=summary`；body 与脚本逐字节不变。
  - 名称：偶像用 `public/translations/zh-CN/entities/idols.json` 的中文名（与界面一致，例如“天濑冬马”），description 附原名与所属 Unit；Unit 用 bootstrap 的 `unitName`（界面同样显示原名），description 列出成员中文名。
  - 图片：偶像 `/assets/idols/icons/image_chara_icon_<id>.png`（148×148，正式站实际返回 `image/webp`），Unit `/assets/units/logos/image_unit_logo_<code>.png`。**正式站已逐个实测 49/49、16/16 返回 200。**
  - 参数 `--dist`（默认 `.analysis/build-check`）、`--origin`（默认 `https://gs-archive-preview.pages.dev`）、`--check`（只校验）。
  - 独立的构建后步骤，**未接入任何发布打包脚本**（见下文“上线前必须处理”）。
- `scripts/verify-entity-head-shells.mjs`（新增，进 CI batch）：合成模板上的转义、回退、无 Unit、非法 ID、重复 `<title>` 用例；真实 bootstrap 下每个偶像都有中文名、每个外壳恰好一组标签、canonical 与 `og:url` 等于路径、body 不变；`--dist` 模式校验产物最新且没有 `404.html`；标签页标题常量与 `index.html` 一致。
- `src/presentation/ArchiveDocumentTitle.js`（新增）+ `src/App.vue` 一处 `watch`（L2b）：偶像/Unit 详情页的标签页标题为“名字 · GS Archive”（与外壳相同，生成脚本也复用这个函数），其他页面恢复站点标题；名字尚未加载时保持当前标题，不闪回站点标题。此前全站没有任何 `document.title` 写入。
- **L1 缺陷修正（单独提交 `9b6773b4`）**：W 的 Unit 码是 `05w00`，原正则 `^[0-9]{2}[a-z]{3}$` 不认，`/units/05w00/` 从未生成。改为 `^[0-9]{2}[a-z0-9]{3}$`，并在 `verify-archive-path-locator.mjs` 里遍历全部 bootstrap 偶像与 Unit 做路径往返。这是写 L2 生成脚本时对全量数据断言才暴露的。

## 命令与结果

| 命令 | 结果 |
|---|---|
| `node scripts/verify-entity-head-shells.mjs` | 通过 |
| `node scripts/verify-archive-path-locator.mjs` | 通过（含 49 偶像 + 16 Unit 往返） |
| `npm run build:check` → `node scripts/generate-entity-head-shells.mjs` → `node scripts/verify-entity-head-shells.mjs --dist=.analysis/build-check` | 通过，65 个外壳最新 |
| `npm run verify:entry` | 退出码 0 |
| `npm run verify:source-batch` | **127/127 通过** |

文件数：`.analysis/build-check` 共 290 个文件（含 65 个外壳）。按上次正式包 10836 个文件计算，加 65 后为 10901，在 `readmodels/contracts/budgets.json` 的 `combinedPagesFiles`（18000）以内。

## HTTP 检查（本地静态预览）

`node node_modules/vite/bin/vite.js preview --configLoader native --outDir .analysis/build-check --host 127.0.0.1 --port 5179 --strictPort`，用 `curl -A "Twitterbot/1.0"` 抽取标签：

| 地址 | 结果 |
|---|---|
| `/idols/001tom/` | `<title>天濑冬马 · GS Archive</title>`，description“天濑冬马（天ヶ瀬 冬馬，Jupiter）的卡牌、剧情、歌曲与相关档案。”，canonical 与 og:image 正确 |
| `/units/05w00/` | `W · GS Archive`，“W（苍井悠介、苍井享介）的成员、卡牌、剧情与歌曲档案。” |
| `/units/01jup/` | `Jupiter · GS Archive`，成员三人 |
| `/`、`/idols/xyz/` | 站点通用标题 |
| `/idols/001tom`（无尾斜杠） | vite preview 走 SPA 回退，显示通用标题。Cloudflare Pages 对目录 index 会 308 到带斜杠地址；应用写出和分享的都是带斜杠形式 |

此预览缺 public 资源，只用于 head 检查。预览服务验收后已关闭。

## Browser 实际旅程

dev `127.0.0.1:5177` + 候选 `E:/GS_readmodels_candidate_20261012_age`，headless Playwright Chromium（原生 CDP）。服务验收后已关闭。

- `verify-portal-path-locator-browser.mjs`：P1–P15 共 20 项全部通过。新增 P14：打开 `/?view=unit_detail&unit=05w00` 显示为 `/units/05w00/`；P15：标签页标题依次为 `W · GS Archive`、`天濑冬马 · GS Archive`，进入关联页面后回到站点标题。
- `verify-archive-detail-identity-browser.mjs`：5/5 通过。
- `capture-gallery.mjs path-locator-l2 --only=app-idol-path,app-unit-path,app-portal`：9/9 干净。

证据：`.analysis/path-locator-l2/`、`.analysis/gallery/path-locator-l2/`。

## 上线前必须处理（需用户确认后单独做）

1. **生成时机**：`scripts/prepare-readmodel-preview.mjs:32` 断言代码包只含 `index.html` 与 `_app/`，`readmodels/tools/assemble_pages.mjs:80-81` 会往 `index.html` 注入 bootstrap。外壳必须在**打包完成后、对最终 `dist`** 运行：`node scripts/generate-entity-head-shells.mjs --dist=<package>/dist`，然后 `node scripts/verify-entity-head-shells.mjs --dist=<package>/dist`。不要放进 bundle 阶段。
2. **缓存头**：两处 `_headers` 只给 `/index.html` 设了 `Cache-Control: no-cache`。外壳同样引用带哈希的 `_app` 代码块，必须补 `/idols/*` 与 `/units/*` 的 `no-cache`；否则部署后浏览器可能拿到旧外壳去请求已不存在的代码块。
3. **收录**：`prepare-readmodel-preview.mjs` 的 `_headers` 对 `/*` 设置了 `X-Robots-Tag: noindex, nofollow`。X/Discord/LINE 的预览不受影响，但搜索引擎不会收录。是否放开由用户决定。
4. **外部预览实测**：部署后用 `curl -A "Twitterbot/1.0"`、`curl -A "Discordbot/2.0"` 复核，再在 X/Discord/LINE 粘贴 `/idols/001tom/`、`/units/05w00/` 截图。148px 的头像只够 `summary` 小卡；若要大图卡需要另备 1200×630 图片。
5. 部署包含 L1 的版本之前，不要对外发路径链接。

## 上线前事项的执行状态（2026-10-13 更新）

- **1. 生成时机：已接入。** `d1828696` 让 `scripts/prepare-readmodel-preview.mjs` 在代码与模型文件复制进 `dist` 之后、回执与文件清单之前，从包内最终 `index.html` 渲染 65 个外壳（断言与候选包同一 read-model release），回执新增 `entityHeadShells`。
- **2. 缓存头：已接入。** 同一提交给 `/idols/*`、`/units/*` 加了 `Cache-Control: no-cache`。
- 端到端验证：`npm run build:check` 后执行 `node scripts/prepare-readmodel-preview.mjs --models E:/GS_readmodels_candidate_20261012_age --out .deploy/shell-package-check-20261013 --data-revision 854190ad…`（数据版本沿用当前正式站 R2 快照）。结果：10900 个文件 / 159,823,752 字节（预算 18000），`verify-entity-head-shells.mjs --dist=<包>/dist` 通过（外壳内含内联 bootstrap），`_headers` 含两条新规则。用本地映射服务浏览包内 `dist` 跑 `verify-portal-path-locator-browser.mjs`：19/20 通过，唯一失败 P12 是称号图片 `/assets/domain-images/…` 本地 `public/` 不存在（正式站经 R2 返回 200，dev 由中间件提供），与打包无关。验证包为可重建产物，已删除；清单与 `_headers` 留在 `.analysis/shell-package-check/`。
- **3. 收录（noindex）**：未改，仍待用户决定。
- **4. 外部预览实测 / 5. 部署**：未做，需要用户授权部署。
