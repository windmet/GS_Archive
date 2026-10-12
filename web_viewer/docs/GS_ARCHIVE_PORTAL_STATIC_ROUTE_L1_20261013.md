# L1 记录：偶像 / Unit 详情页的公开路径地址

日期：2026-10-13。输入 HEAD：`28eb9575`；分支 `claude/portal-static-route-20261012`。计划见 [门户静态化路线](GS_ARCHIVE_PORTAL_STATIC_ROUTE_PLAN_20261012.md) §3；前置 [L0](GS_ARCHIVE_PORTAL_STATIC_ROUTE_L0_20261012.md)。

## 结果

| 路由 | 地址栏 / 可分享地址 | 旧地址 |
|---|---|---|
| 偶像详情 | `/idols/001tom/` | `/?view=idol_detail&idol=001tom` 等仍可打开，加载后原地改写为路径（不新增历史项） |
| Unit 详情 | `/units/01jup/` | `/?view=unit_detail&unit=01jup` 同上 |

其他所有页面的地址不变（pathname 恒为 `/`）。

## 改动

- `src/core/archiveRoute.js`
  - `PUBLIC_PATH_ROUTES`：两项映射（`idols` ↔ `idol_detail`，隐含 `category=idol`；`units` ↔ `unit_detail`），ID 必须匹配 `^[0-9]{3}[a-z]{3}$` / `^[0-9]{2}[a-z]{3}$`。
  - `locatorQuery(url)`：`readArchiveRoute` 解析前，若 query 没有 `view` 且 pathname 精确匹配，就注入 view 与身份。**query 有 `view` 时永远以 query 为准**。
  - `publicArchiveUrl(url)` / 导出的 `buildPublicArchiveUrl(input, route)`：把 query 形式的地址改写为公开地址；不在映射里的视图强制 pathname 为 `/`。
  - `writeArchiveRoute`：导航上下文照旧先从 query 抽进 history.state，最后用 `publicArchiveUrl` 写地址栏。修掉了“沿用当前 pathname”的隐患：离开路径页去卡片目录时写的是 `/?view=cards…`，不是 `/idols/001tom/?view=cards…`。
  - **`buildArchiveUrl` 输出不变**：source frames、Portal/Home 回程、视图恢复键等内部 `.search` 用途全部保持 query 形式。
- `src/components/archive/ArchiveBreadcrumb.vue`：面包屑 `href` 改用 `buildPublicArchiveUrl`，右键复制得到路径地址。
- `scripts/verify-archive-path-locator.mjs`（新增，进 CI batch，并挂在 `npm run verify:routes` 后）：计划 U1–U12，外加 `writeArchiveRoute` 在模拟 window 下的地址与 history.state 断言。
- `scripts/verify-portal-path-locator-browser.mjs`（新增，`localOnly.external`）：计划 P1–P13 的 CDP 旅程。
- `scripts/verify-archive-detail-identity-browser.mjs`：期望地址更新为路径形式。
- `scripts/capture-gallery.mjs`：新增 `app-idol-path`、`app-unit-path` 两个场景。

未改：`App.vue` 等处读 `location.search` 的调试开关（路径页上照样可带 `?playerTrace=1`）；`archiveStartup.isBareArchiveEntry`（路径不是裸入口，天然走显式路由）；`_routes.json`（`/idols/*` 不进 Functions）。

## 命令与结果

| 命令 | 结果 |
|---|---|
| `node scripts/verify-archive-path-locator.mjs` | 通过 |
| `npm run verify:routes` / `node scripts/verify-route-schema.mjs` | 通过 |
| `node scripts/verify-archive-startup-route.mjs` / `verify-archive-startup-preferences.mjs` | 通过 |
| `npm run verify:archive-navigation-state` | 通过 |
| `node scripts/verify-archive-route-preparation.mjs` / `verify-reader-navigation.mjs` | 通过 |
| `node scripts/verify-verifier-coverage.mjs` | 通过（402 scripts，126 batch，56 local-only） |
| `npm run build:check` | 通过，`.analysis/build-check`，不含 public |
| `npm run verify:entry` | 退出码 0 |
| `npm run verify:source-batch` | **126/126 通过** |

## Browser 实际旅程

环境：dev `127.0.0.1:5177` + `SIDEM_READMODEL_CANDIDATE=E:/GS_readmodels_candidate_20261012_age`；先用 curl 确认 dev 在 `/idols/001tom/`、`/units/01jup/` 返回 index.html。浏览器为 **headless Playwright Chromium（原生 CDP）**，非有头、非真机。服务验收后已关闭。

`node scripts/verify-portal-path-locator-browser.mjs http://127.0.0.1:5177 .analysis/path-locator-l1/journey`：

| # | 实际结果 |
|---|---|
| P1 | 偶像目录 `/?view=idols&category=idol` → 点偶像 → `/idols/001tom/`，无 console error（桌面、手机两档） |
| P2 | 页内返回 → 回到 `/?view=idols&category=idol` |
| P3 | 后退/后退/前进：`/idols/001tom/` → 目录 → `/idols/001tom/` |
| P4 | 路径页刷新后地址不变，页内返回仍回目录（history 来源跨刷新保留） |
| P5 | 新开 `/idols/001tom/` 正常渲染；页内返回落到 `/?view=home&home_idol=002sht`，与旧链接冷打开完全一致；旧链接显示为 `/idols/001tom/` |
| P6/P7 | 路径页点“偶像故事” → `/?view=idol_story_archive&…`（pathname 回到 `/`）；后退回 `/idols/001tom/` |
| P8 | `/?view=unit_catalog` → `/units/01jup/` → `/idols/001tom/` → 返回 `/units/01jup/` → 返回 Unit 目录 |
| P9 | 打开 `/?view=unit_detail&unit=01jup&q=x` 显示为 `/units/01jup/`，history.length 只 +1，上一项仍是之前的页面 |
| P10 | `/idols/xyz/` 落到默认入口，无未捕获异常 |
| P11 | “启动页 = Home”的偏好下直接打开 `/idols/001tom/`，仍进入偶像详情 |
| P12 | 全程无以 `/idols/<id>/` 或 `/units/<code>/` 为前缀的资源请求，无失败的同源请求 |
| P13 | 1280×900 与 390×844 均无横向溢出 |

首轮 P5、P11 失败，是脚本断言查的是日文“冬馬”，中文界面显示的是“天濑冬马”；地址与落点本身正确，已修正断言后全部通过。

另外：`verify-archive-detail-identity-browser.mjs` 5/5 通过；`node scripts/capture-gallery.mjs path-locator-l1 --only=app-idol,app-idol-path,app-unit-path,app-portal,app-idol-list` 15/15 干净；旧链接与路径入口的偶像页截图三档逐像素对比无差异（超阈值像素 0）。证据在 `.analysis/path-locator-l1/` 与 `.analysis/gallery/path-locator-l1/`。

## 生产注意（L2 / 发布时处理）

- Cloudflare Pages 在根目录没有 `404.html` 时把未匹配路径回退到 `/index.html`。现有打包脚本未生成 `404.html`，但发布前要在包里核对；L2 生成的 `idols/<id>/index.html` 外壳上线后会直接命中静态文件。
- 尚未部署，未在 Pages 上实测路径回退。

## 已知限制与待用户执行

- 未做有头浏览器与真机验证。真机建议：手机浏览器直接打开 `/idols/001tom/`、`/units/01jup/`，再从偶像目录点进详情、返回、刷新各一次。
- 分享出去的路径链接在部署包含路径回退（或 L2 外壳）的版本之前不可用；**在那之前不要对外发路径链接**。
