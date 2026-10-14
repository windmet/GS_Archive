# 卡池短链接与栏目根路径（2026-10-14）

接在 [静态路由 L2](GS_ARCHIVE_PORTAL_STATIC_ROUTE_L2_20261013.md) 之后，把剩下的卡池详情和各栏目目录也改成路径。

## 地址

| 页面 | 地址 |
| --- | --- |
| 卡池详情 | `/gashas/<公告 ID>/`（6–8 位数字）或 `/gashas/ticket-<16 位 hex>/`（券专用卡池） |
| 栏目目录 | `/idols/` `/units/` `/cards/` `/songs/` `/events/` `/gashas/` `/stories/` `/items/` `/honors/` `/photos/` |

- 筛选条件仍放在查询参数里，例如 `/cards/?idol=004ter&rarity=SSR`、`/events/?event_kind=collection`。
- 旧的 `?view=...` 链接打开后会就地改写为路径，不会多出历史记录。
- 卡池从哪里打开（`parent`，以及从额外故事集打开时的 `story_type` / `story_section`）跟活动一样存进 `history.state`，不写进地址；刷新后返回仍能回到原处。
- 标签页标题：卡池用译名，栏目用栏目名（偶像、组合、卡片、歌曲、活动、卡池、故事、道具、称号、摄影资源）。

## 静态外壳

- `generate-entity-head-shells.mjs` 新增 86 个卡池（61 个公告卡池 + 25 个券专用卡池）和 10 个栏目根路径。
- 卡池的分享图用头图；券专用卡池用第一张券的图标。
- `prepare-readmodel-preview.mjs` 的 `_headers` 给新增前缀设为 no-cache。

## 验证

- **路由与导航**：以下检查通过。
  - `verify-route-schema`
  - `verify-archive-path-locator`
  - `verify-archive-navigation-state`
  - 事件和摄影目录导航（需 `--experimental-vm-modules`）
  - `verify-portal-directory-navigation`
- **卡池数据**：`verify-gasha-ticket-evidence` 和 `verify-gasha-loading-boundary` 通过。
- **构建**：`npm run build:check` 通过，之后的 `verify-entity-head-shells --dist` 确认 1107 个外壳都是最新的。
- **Browser 旅程**（`verify-portal-path-locator-browser.mjs`，1280 与 390）：47 项通过，其中新增 4 项：
  - P38：卡池冷启动，返回卡池目录。
  - P39：券专用卡池的旧链接改写为路径。
  - P40：从目录进入卡池后返回。
  - P41：栏目根路径的标题，以及侧栏写出的路径。

## 未做

- 没有部署，也没有上传 R2。
