# L0 记录：idol/unit 详情页启用路由 schema 写入裁剪

日期：2026-10-12 至 10-13。输入 HEAD：`f9935ed2`；分支 `claude/portal-static-route-20261012`。计划见 [门户静态化路线](GS_ARCHIVE_PORTAL_STATIC_ROUTE_PLAN_20261012.md) §0.2；机制见 [路由 schema 审计](GS_ARCHIVE_ROUTE_SCHEMA_AUDIT_20261011.md) 批次 F。

## 改动

- `src/core/routeSchema.js`：`idol_detail`、`unit_detail` 加入 `ENFORCED_ROUTE_VIEWS`。写出的地址只剩各自 schema 的参数（`category`、`idol` / `unit`）。解析不变：旧链接里的多余参数照常可读，下一次写入时被丢弃。
- `scripts/verify-route-schema.mjs`：
  - 通用的“脏状态只写 view”断言放宽为“只写 view 和该视图自己的参数”（详情页必须保留身份参数）；
  - 新增两条精确断言：残留了 unit 筛选、搜索词、卡片、故事类型等状态时，偶像/Unit 详情页分别只写 `?view=idol_detail&category=idol&idol=001tom`、`?view=unit_detail&unit=01jup`；
  - 带多余参数的旧偶像链接可以打开，写回时被缩短。
- `scripts/verify-archive-detail-identity-browser.mjs`（新增，登记在 `config/verifier-coverage.json` 的 `localOnly.external`）：CDP 浏览器旅程，同时作为 L1 旅程脚本的模板。

## 裁掉了什么、影响在哪

`node scripts/audit-route-schema.mjs` 在改动前的测量：偶像详情可能写出 12 个非自有参数（`availability card episode event mobile_mode mobile_scenario q sort story_mode story_section story_type unit_filter`），Unit 详情 14 个。这些参数都不被两个详情页读取（详情页只接收 `currentIdolProfile` / `currentArchiveUnit` 等身份派生数据）。

唯一可见的行为差异：偶像详情面包屑的“偶像”一级会沿用当前路由里的列表筛选（`breadcrumbFilters` 里的 `unitFilter`、`query`）。同一会话内面包屑读取的是内存状态，不受影响；**刷新或分享偶像详情链接后**，“偶像”面包屑不再带列表筛选。页内“返回”走 history NavigationContext，不受影响（下方 J4 验证）。这符合“详情页地址只承载身份”的目标。

视图恢复键（`archiveViewRestoration.js:8`）由同一个 `buildArchiveUrl` 生成，读写两端一致；改动前保存的偶像详情恢复记录，若当时带有多余参数，会有一次对不上，属于无害的一次性失效。

## 命令与结果

| 命令 | 结果 |
|---|---|
| `node scripts/verify-route-schema.mjs` | 通过 |
| `npm run verify:routes` | 通过 |
| `node scripts/verify-archive-startup-route.mjs` | 通过（中途打印的 7 行调用栈改动前就有，已在改动前的代码上复现确认） |
| `node scripts/verify-archive-startup-preferences.mjs` | 通过 |
| `npm run verify:archive-navigation-state` | 通过（62 refs，1856 组合，恢复与关系导航） |
| `node scripts/verify-archive-route-preparation.mjs` | 通过 |
| `node scripts/verify-verifier-coverage.mjs` | 通过（400 scripts，125 batch，55 local-only） |
| `npm run build:check` | 通过，输出 `.analysis/build-check`，不含 public |
| `npm run verify:entry` | 退出码 0 |

未运行：`npm run verify:source-batch` 全量（合并前跑）。

## Browser 实际旅程

环境：dev 服务 `127.0.0.1:5177`，`SIDEM_READMODEL_CANDIDATE=E:/GS_readmodels_candidate_20261012_age`（release `ee86933b…`，与 `bootstrap.inline.json` 一致）。浏览器为 **headless Playwright Chromium，原生 CDP 驱动**，不是有头浏览器，也不是真机。

1. `node scripts/capture-gallery.mjs schema-detail-prune --base=http://127.0.0.1:5177 --only=app-idol,app-idol-list`：6/6 通过（1280×900、768×1024、390×844 三档，无空白、无横向溢出、无 console error）。截图在 `.analysis/gallery/schema-detail-prune/`。
2. `node scripts/verify-archive-detail-identity-browser.mjs http://127.0.0.1:5177 .analysis/schema-detail-prune/journey`（1280×900）：

| # | 操作 | 实际地址 | 结论 |
|---|---|---|---|
| J1 | 打开 `/?view=idol_detail&idol=001tom&unit_filter=1&q=x&card=c&story_type=main` | `/?view=idol_detail&category=idol&idol=001tom` | 通过 |
| J2 | 打开 `/?view=unit_detail&unit=01jup&q=x&card=c&idol=002sht` | `/?view=unit_detail&unit=01jup` | 通过 |
| J3 | Unit 页点第一个成员 | `/?view=idol_detail&category=idol&idol=001tom` | 通过 |
| J4 | 偶像页刷新后点页内“返回” | `/?view=unit_detail&unit=01jup`，Jupiter 页面完整渲染 | 通过 |
| J5 | `history.back()` 再 `history.forward()` | 依次为偶像页、Unit 页 | 通过 |
| — | 全程 console error | 0 | 通过 |

说明：页内“返回”会压入一条新的历史记录（不是 `history.back()`），所以 J5 必须先后退再前进；最初按“先前进”写的断言是脚本假设错误，已修正，不是产品问题。截图在 `.analysis/schema-detail-prune/journey/`。

服务由本次启动，验收后已关闭。

## 已知限制与待用户执行

- 未做有头浏览器和真机验证。
- 未覆盖“偶像目录带 unit 筛选 → 详情 → 刷新 → 点面包屑‘偶像’”这一条已知的预期差异路径；如需保留该行为，应改由 history 上下文提供面包屑筛选，而不是放回地址栏。
