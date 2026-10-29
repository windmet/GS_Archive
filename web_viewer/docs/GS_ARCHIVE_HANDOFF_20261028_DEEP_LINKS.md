# 深链接（短链接）收尾交接：约法三章与分批执行

日期：2026-10-28。
分支：`portal/20261028-deep-links`。按 [GIT_WORKFLOW](GIT_WORKFLOW.md) 规则 3，短链接归 portal 线。
起点：`origin/master` `36743743`（#117 合入后）。下文 `App.vue` 行号按这个提交。
worktree：`E:/Web_build/GS_Archive_Domain_Work/deep-links-20261028`，LF 检出，`node_modules` 是联接。

执行确认（2026-10-28）：用户已确认 D1 使用 `/live/ /studio/ /about/ /status/`，D2 使用方案 A（读模型 id 原样）。R1 #121 已以 `b1065a8f` 合入，见 [R1 执行记录](GS_ARCHIVE_DEEP_LINKS_R1_20261028.md)。R2 #123 已经 CI 成功后以 `11e7418c` 合入，见 [R2 执行记录](GS_ARCHIVE_DEEP_LINKS_R2_20261028.md)。用户随后要求“之后不需要问授权，直接做下去”：本任务内继续按验证门禁提交、建 PR 和合并，不再逐次询问。R3/R4 的技术前置继续生效。

本文是执行文档。外部审计稿《GS_Archive 短链接与正式路由迁移审计》（基线 `2bdd3de4`）只当背景。审计稿和本文有出入时，以本文 §3 的核对为准。

前序文档：

- [静态路由计划](GS_ARCHIVE_PORTAL_STATIC_ROUTE_PLAN_20261012.md)，其中 §3.2 的设计原则、§8 的易错点仍然有效。
- [路由 schema 审计](GS_ARCHIVE_ROUTE_SCHEMA_AUDIT_20261011.md)。
- [卡池短链接与栏目根](GS_ARCHIVE_SHORT_LINKS_20261014.md)。
- 导航交接第 4 步（`/office/`、`/mobile/`，PR #65）。

---

## 0. 结论

1. **能和门户样式改造同期做，但只限地址层。** 下面两批现在就能开工，和样式线几乎不碰同一批文件：
   - R1：目录收口和工具入口路径；
   - R2：剧情归属页路径。

   下面两批要等对应的门户批次合入：
   - R3：谱面、舞台、摄影、图鉴实体；
   - R4：Reader、Player。
2. **审计稿的主体判断成立**：实体路径、目录根路径、外壳、强制裁剪集合、迁移台账的数字都对得上。另外有四处要补正：
   - 参数泄漏有真实的触发路径，不只是理论上界；
   - 草案 schema 有 6 处和页面实际不符，直接启用会坏；
   - 正式站至今没有任何路径地址；
   - 阅读文档 id 会换键。

   详见 §3。
3. **R1 的第一步不是加路径**，而是两件事：
   - 把分散在 4 个文件里的路由事实合成一张表；
   - 校正 schema 后，再对 8 个目录启用裁剪。

---

## 1. 约法三章

### 第一章：只动地址层，不碰画面

本分支只管三件事：

- 一个页面叫什么地址；
- 地址里放什么参数；
- 直接打开这个地址时，head 里写什么。

**本分支可以改的文件：**

- `src/core/archiveRoute.js`：只改地址部分，即 locator、`publicArchiveUrl`、`readArchiveRoute`、`buildArchiveUrl`、history 上下文、`writeArchiveRoute`。
- `src/core/routeSchema.js`、新建的 `src/core/publicRoutes.js`。
- `src/core/useArchiveNavigationState.js`：只改 `currentArchiveRoute()`。
- `src/core/archiveStartup.js`：仅当 locator 语义变化时才改。
- `scripts/generate-entity-head-shells.mjs`。
- `scripts/prepare-readmodel-preview.mjs`：只改外壳与 `_headers` 两段。
- `scripts/audit-route-schema.mjs` 和路由类 verifier。
- `config/verifier-coverage.json`：只增行。
- `readmodels/contracts/routes.json`：只改证据。

**只能小改的文件**（每处在 PR 描述里逐条列出行号）：

- `src/App.vue`：只允许改 `archiveTabEntityName`（:1476）和导航打开函数里的状态赋值，不改模板。
- `src/composables/use*Navigation.js`：只改状态赋值和 history 上下文，不改加载逻辑。
- `src/presentation/ArchiveDocumentTitle.js`：只改标题表。

**不改的部分：**

- 任何 `.vue` 的 `<template>` 和 `<style>`；
- `GS_UI_TOKENS.css`；
- `src/presentation/*`（标题表除外）；
- `archiveSections.js` 的文案；
- `buildArchiveBreadcrumbs`（`archiveRoute.js:491–633`），面包屑归门户线。

需要改模板的事项一律记进 §8，交给门户线。例如把按钮换成 `<a href>`，让右键能复制链接。

### 第二章：旧链接永远能打开；先收紧，再上路径

- **内部表示不动。** `buildArchiveUrl` 的 query 输出是内部规范，来源帧、视图恢复键（`archiveViewRestoration.js:8`）、阅读链接都依赖它。路径只存在于 `publicArchiveUrl` 这一层。这是静态路由计划 §3.2 的原则，不变。
- **一个 view 要上路径，先要被强制裁剪。** 它必须已经在 `ENFORCED_ROUTE_VIEWS` 里，而且它的 schema 已按页面实际读取的 props 逐项核对过。从 R1-1 起，这条由 verifier 机械执行。
- **兼容规则：**
  - `?view=` 永远优先于路径；
  - 旧链接打开后用 `replaceState` 就地改写，不新增历史记录；
  - 认不出的路径按裸入口 `/` 启动（P46）；
  - 正式站至今只发布过 `?view=` 链接，这些链接永久可读。
- **路径段只用读模型里的稳定 id：** idol id、collection id、campaign id、event id 等。不用文件名、哈希或显示名。故事页一律经 `src/core/StoryOwner.js` 求归属，不另造第二套归属。
- **已公开的路径冻结，只增不改。** 测试站 `126567c8` 已经公开了：
  - 详情路径：`/idols/ /units/ /cards/ /songs/ /events/ /gashas/`；
  - 12 个目录根。

### 第三章：一张表，一批一 PR，先证后合

- **路由事实只写一次。** R1-1 之后写在 `src/core/publicRoutes.js`。外壳生成器、标签页标题、verifier 都 import 它，不再各写一份正则。
- **每批一个 PR。** 从最新 master 开分支，或用 `git merge origin/master` 跟上，不 rebase。
- **新断言必须做变异测试**：把修复改回坏版本，断言必须 FAIL。
- **合并前要通过的检查**（全部在 LF worktree 里跑）：
  - `npm run gate:source` 全绿；
  - `npm run build:check`；
  - 外壳 `--dist` 检查；
  - 浏览器旅程，从 P47 起续号。
- **不做的事：**
  - 不部署，不上传 R2；原“不自行合并 PR”已由上方用户后续指示替代，本任务通过门禁后直接合并；
  - 不在主 checkout 暂存；
  - 门户 PR 先合并时，冲突由本分支解决，不要求门户线让路。

### 对门户样式线的反向约定（只有两条）

1. **新入口一律调用现有的 `open*` / `navigateArchiveSection` 函数**，不手写 `?view=` 地址。目前 `src/components` 里没有一处手写的 `?view=`，R1-1 会加一个 guard 守住这一点。
2. 如果要在模板里放可复制的站内链接：
   - `href` 用 `buildPublicArchiveUrl`；
   - 普通左键点击要 `preventDefault`，把地址交给 `App.vue` 的 `followArchiveLink`（#120）；修饰键点击和中键留给浏览器。

   裸 `<a href>` 会让整个资料馆重载、出现启动屏，面包屑就因为这个出过问题（见 §3.2 ③）。`ArchiveBreadcrumb.vue` 的 `follow()` 是现成样例。

---

## 2. 同期排期

门户样式线当前状态：

- p15-shell worktree 在做 `portal/20261028-p6-event-detail`，改的是 `ArchiveEventDetail.vue`、`ArchiveIdolReference.vue`；
- #117（偶像详情，改了 `App.vue`、`ArchiveShell.vue` 等）已合入；
- #120（`fix/20261028-breadcrumb-in-place`，面包屑站内打开）待合，改了 `App.vue`、`ArchiveShell.vue`、`ArchiveBreadcrumb.vue`；
- 剩余批次：P6 的组合、卡池、图鉴，P7 的摄影、播放器、阅读器，以及 P2、P3、P4。

| 深链接批次 | 何时开工 | 前置 | 和样式线的交集 |
|---|---|---|---|
| R1-1 注册表合一 | 现在 | 无 | 生成器与标题表（P1.5 改过，P6/P7 不改） |
| R1-2 目录裁剪 | R1-1 之后 | 无 | 无组件改动 |
| R1-3 工具入口路径 | R1-2 之后 | D1 | 标题表；`portal` 显式路径等 P2 |
| R2 剧情归属页 | R1 合入后 | D2 | `App.vue:1476` 加 4 个分支；`useStoryNavigation.js` 的 parent 改走 history |
| R3 工具与图鉴实体 | 对应门户批次合入后 | D3；谱面线、舞台线收束 | P3 谱面、P4 舞台、P6 图鉴、P7 摄影 |
| R4 Reader / Player | 最后 | D4；P7；剧情语料晋升 | `ReaderWorkspaceControls`、`PlayerTopBar`、`ArchiveStoryCollection.vue:214` |

R1 和 R2 可以作为两个 PR 依次提交。门户 PR 合入后，本分支用 merge 跟上即可。

---

## 3. 现状核对（master `36743743`）

### 3.1 和审计稿一致的事实

- **8 类实体路径**：`archiveRoute.js:640–657`。其中 `/office/`、`/mobile/` 只把偶像放进路径，其余状态留在 query。
- **14 个目录根**：`archiveRoute.js:661–676`。
- **head 外壳共 1209 个**（本次实算）：

  | 类别 | 数量 |
  |---|---|
  | 偶像 idol | 49 |
  | 事务所 office | 49 |
  | 通信 mobile | 49 |
  | 组合 unit | 16 |
  | 卡片 card | 826 |
  | 歌曲 song | 61 |
  | 活动 event | 59 |
  | 卡池 gasha | 86 |
  | 目录根 section | 14 |

- **`ENFORCED_ROUTE_VIEWS` 共 17 个 view**：`routeSchema.js:40–48`。
- **迁移台账**（`readmodels/contracts/routes.json`，39 个 view）：

  | 维度 | 已迁移 |
  |---|---|
  | entry | 38 |
  | data | 37 |
  | actions | 33 |
  | 设备验收 | 0 |

  未完成项集中在 player、chibi_stage，以及 portal、home、song_detail、spine_lab 的 actions。
- **`reading_rev` 默认不写**（`readingRevisionPinned`），审计稿已更正。

### 3.2 补正与新发现

**① 参数泄漏有真实路径。** 只读审计脚本 `node scripts/audit-route-schema.mjs` 的当前结果：

| 测量 | 越权参数数 |
|---|---|
| 脏状态上界 emitted | 250 |
| 饱和 URL survives | 474 |

表中 `idols` 显示为 0，是因为脏状态被规范成了 `idol_detail`，不代表它干净。

真实触发链：

- 侧栏「卡片」走 `navigateArchiveSection('cards')`（`App.vue:1980`），再到 `openPrimaryCards`（`useCardNavigation.js:132`）。
- `openPrimaryCards` 不清 `currentStoryDomain`、`currentStorySection`、`currentEventId`、`currentEpisodeId`。
- `commitView`（`App.vue:1681`）也没有统一复位。

因此从生日合集切到卡片目录时，`story_type` 和 `story_section` 会进入 `/cards/?…`。R1-2 先用浏览器旅程实测这条路径（P47），再修。修法是启用裁剪，不靠逐个打开函数复位状态。

**② 草案 schema 有 6 处和页面实际不符，直接启用会坏。** 2026-10-28 做过一次试验：在本 worktree 临时把 8 个目录加进裁剪集合，跑现有 verifier，结果如下（已还原）：

- `verify-route-schema`：在 `idols` 处 FAIL，读回成了 `idol_detail`。
- `verify-archive-path-locator`：在 `/cards/?rarity=SSR` 处 FAIL，写成了 `/?view=cards&rarity=SSR`。

逐页对照 `App.vue` 模板 props 后的校正表：

| view | 草案 | 页面实际读的地址状态 | 校正 |
|---|---|---|---|
| `idols` | `category idol unit_filter q` | `q`、`unit_filter`（:120） | 去掉 `idol`：`idols + category=idol + idol` 是偶像详情的旧别名（`archiveRoute.js:332`） |
| `cards` | `idol q rarity card_attribute asset_state relation_state` | 同左，外加隐含的 `category=cards`（:138） | 裁剪必须保留目录的隐含参数，否则 `/cards/` 退回 query 地址 |
| `song_catalog` | `song_scope` | `idol`（scope-idol）、`q`、`song_scope`（:234–246） | 加 `idol`、`q` |
| `event_catalog` | `event_kind event_sort event_page` | `idol`、`q`、browse（:284–286） | 加 `idol`、`q` |
| `story_catalog` | `story_mode story_type event_scope availability sort idol q` | 另读 `:section`，按 `sectionId` 过滤（`useStoryCatalogProjection.js:33`） | 加 `story_section` |
| `collection_catalog` / `photo_catalog` | 无 `q` | 都有 `:query` 输入（:287–290） | 加 `q` |

`gashas` 补 `q`：Browser 实测顶部搜索 FES 会过滤卡池列表；`useGashaNavigation.js` 的 `filteredGashas` 消费 `filterQuery`，`App.vue` 传入的是已经过滤的列表。仅看组件 props 会漏掉该状态所有权。类型与搜索应共同保留为 `/gashas/?gasha_type=growing_fes&q=FES`。

**③ 站内几乎没有 `<a href>`，唯一用公开地址的面包屑还会整页重载。**

- 只有面包屑生成的是公开地址。
- 面包屑原来是裸 `<a href>`，没有拦截点击，每次点击都是整页跳转，应用冷启动并显示启动屏。用户 10-28 报告过这条路径：剧情目录 → 活动剧情 → 活动页 → 面包屑「活动」。
  - 已由 #120 修复：普通点击交给 `restoreRoute(..., { restoring: false })`。
  - 浏览器检查：`scripts/verify-archive-breadcrumb-browser.mjs` B1–B4，变异测试过。
- `ArchiveStoryCollection.vue:214` 的阅读链接仍是 query 形式，在路径页上靠「query 优先」规则照样能用。它已经拦截了普通点击（:217），所以不会重载。
- 其余入口都是按钮，所以「复制链接」只能复制地址栏。

这影响分享体验，但需要改模板，按第一章交给门户线，见 §8。

**④ 发布现状。**

- 正式站仍是 10-12 的 `?view=` 版本（`612f7519` 一线），没有任何路径。
- 测试站 `126567c8` 有 6 类实体路径和 12 个目录根，没有 `/office/`、`/mobile/`、`/scores/`、`/unused/`。

所以外部真正在流通的主要是 `?view=` 链接，兼容承诺必须覆盖它们。路径形状在正式发布前仍可调整，但已上测试站的那些按第二章冻结。

**⑤ 阅读文档 id 会换键。**

- `translation/studio/retirements/2026-10-09-birthday-small-talk-split.json` 退役了 `1_2_001_12` 这类旧 id。
- 现行 id 形如 `001tom_307_2_3_001_07_09_a`（3140 个，21–27 字符）。
- PR #78 的译文目录也换过键。

所以 Reader 路径不能把 `document_id` 直接当永久身份。

**⑥ 剧情归属页已有稳定 id。** 来自 release `1accd9d0` 的候选包 `rm-release-20261022`：

| 域 | 数量 | id 示例 |
|---|---|---|
| main | 3 | `101`–`103` |
| unit_story | 16 | `1`–`16` |
| extra | 10 | `601`–`610` |
| birthday | 51 | 49 位偶像 id，外加 `producer_birthday_common`、`101ken` |
| seasonal | 4 | `valentine_2022`、`white_day_2022`、`valentine_2023`、`white_day_2023` |
| idol-stories | 49 | 偶像 id |
| work | 49 | 偶像 id |

**⑦ Cloudflare Pages 的回退行为。**

- 没有外壳的路径会回退到根 `index.html`，带着 Portal 预载和通用 head。外壳会剥掉 `PORTAL_PRELOAD`（`generate-entity-head-shells.mjs:78`）。所以新路径要同时生成外壳，否则深页白白多付 Portal 预载。
- `_headers` 的 no-cache 规则按外壳目录自动派生（`prepare-readmodel-preview.mjs:69–70, 120`）。
- 新增的顶层前缀不能和 `assets`、`data`、`translations`、`_app`、`_catalog`、`_work-backfill`、`_seasonal-reading` 重名。

**⑧ 路由事实写在四处，外壳生成器还复制了正则。**

| 位置 | 内容 |
|---|---|
| `archiveRoute.js` | `PUBLIC_PATH_ROUTES`、`SECTION_PATH_ROUTES` |
| `routeSchema.js` | `ROUTE_SCHEMA`、`ENFORCED_ROUTE_VIEWS` |
| `ArchiveDocumentTitle.js:10–16` | `ENTITY_TITLE_VIEWS`、`SECTION_TITLES` |
| `generate-entity-head-shells.mjs:26–50` | `IDOL_ID` 到 `GASHA_ID` 六个正则、`eventPathSegment`、`SECTION_SHELLS` |

外壳生成器里的正则和 `eventPathSegment` 是 locator 的镜像，违反「plan/verifier 必须 import 运行时同一个 resolver」的规则。

---

## 4. R1：目录收口与工具入口

### R1-1 注册表合一（行为零变化）

**目标：** 一个 view 上路径只改一处；把「先裁剪后上路径」变成机械检查。

**步骤：**

1. 新建 `src/core/publicRoutes.js`，导出 `PUBLIC_ROUTES`。每项字段如下：

   ```js
   { kind: 'entity' | 'section' | 'place', view, prefix, param?, pattern?, implied, fromPath?, toPath?, section? }
   ```

   - 内容原样搬自 `archiveRoute.js:640–676`；
   - `section` 字段供标题表取栏目名。
2. `archiveRoute.js` 从注册表派生 `PUBLIC_PATH_ROUTES`、`SECTION_PATH_ROUTES`、`ARCHIVE_SECTION_PATHS`，现有导出名保持不变。
3. `generate-entity-head-shells.mjs` 删掉自己的 `IDOL_ID`…`GASHA_ID` 和 `eventPathSegment`，改为 import 注册表的 `pattern` / `toPath`。`SECTION_SHELLS` 的中文描述留在生成器里，按 prefix 对齐；缺一项就抛错，这个行为已有。
4. `ArchiveDocumentTitle.js` 的 `ENTITY_TITLE_VIEWS` 由注册表的 entity 和 place 项派生。`SECTION_TITLES` 由 section 项派生。
5. 在 `verify-route-schema.mjs` 加两条棘轮：
   - **棘轮 A：** 注册表里每个 view 都 ∈ `ENFORCED_ROUTE_VIEWS`。先带一个「已知例外」清单，内容是 8 个目录 view；R1-2 把它清空。清单只许变短。
   - **棘轮 B：** `src/components/**` 里不出现 `'?view='` 字面量。

**验收：**

- 外壳逐字节一致。改前改后各跑一次「`build:check` → `generate-entity-head-shells`」，`diff -r`，应为 1209 个、0 差异。
- `audit-route-schema.mjs` 输出逐字一致。
- `verify:routes`、`verify:route-schema`、`verify-entity-head-shells`（含 `--dist`）全绿。
- 变异测试：
  - 把注册表里 cards 的 pattern 改坏，`verify-archive-path-locator` 必须 FAIL；
  - 删掉一个例外，棘轮 A 必须 FAIL。

### R1-2 目录 schema 校正与启用裁剪

**步骤：**

1. 浏览器先测泄漏，记为 P47：生日合集 → 侧栏「卡片」→ 读 `location.search`。修之前应能看到 `story_type`。如果实测没有，在记录里写清楚，再继续往下做；这一批的价值不依赖泄漏是否真的发生。
2. 按 §3.2 ② 的表改 `ROUTE_SCHEMA`。
3. 改 `pruneToRouteSchema`（`routeSchema.js:53–58`）：注册表中 section 项的 `implied` 键永远保留，不再要求每个目录的 schema 手写 `category`。
4. 修 `verify-route-schema.mjs` 的脏状态循环（:52–63）：`idols` 遇到 `currentCharacterId` 时，应断言规范成 `idol_detail`，而不是断言 view 不变。
5. 把 8 个目录加进 `ENFORCED_ROUTE_VIEWS`：
   - `idols`、`cards`、`song_catalog`、`event_catalog`
   - `gashas`、`story_catalog`、`collection_catalog`、`photo_catalog`

   然后清空棘轮 A 的例外清单。
6. `verify-archive-path-locator.mjs` 补往返断言：
   - `/songs/?idol=001tom&q=x`
   - `/events/?idol=001tom&q=x&event_kind=…`
   - `/stories/?story_type=main&story_section=101`
   - `/items/?q=x`
   - `/photos/?q=x`
   - 旧链接 `/?view=cards&story_type=main&rarity=SSR` 改写为 `/cards/?rarity=SSR`。

**验收：**

- 下列回归全绿：
  - `npm run verify:archive-navigation-state`
  - `node scripts/verify-collection-route.mjs`
  - 活动、摄影目录导航（`--experimental-vm-modules`）
  - `verify-portal-directory-navigation`
- 记录 `audit-route-schema` 前后的数字。8 个目录的 emitted 应归零。
- 浏览器旅程：
  - **P47**：泄漏修复后，地址只剩卡片筛选。
  - **P48**：刷新 `/songs/?idol=001tom`，偶像筛选仍在。
  - **P49**：刷新 `/events/?idol=…&q=…`，两个筛选都在。
  - **P50**：旧 `?view=cards&…` 链接就地改写，`history.length` 不变。
- 变异测试：从集合里拿掉 `cards`，P47 必须 FAIL。

### R1-3 工具入口路径（D1 定名后做）

**候选路径**（命名待 D1 确认）：

| view | 路径 |
|---|---|
| `live` | `/live/` |
| `studio` | `/studio/` |
| `about` | `/about/` |
| `archive_status` | `/status/` 或 `/resources/` |

不进路径：

- `spine_lab`：留 query，实验页不发布。
- `portal`：等 P2「资料馆视角开关」定下来再决定。`/` 会走启动偏好，不能直接等价于资料馆。
- `experiments`：仍按旧别名转到 `live`。

**涉及的位置：**

- 注册表里加 section 项。
- 外壳：`SECTION_SHELLS` 加描述。这 4 个 view 已经在裁剪集合里，满足第二章。
- 标题：`SECTION_TITLES` 加入后，标签页标题从站名变成栏目名。这是 head 层改动，属于本线。
- 不碰 `ArchiveToolLanding.vue`。

**验收：**

- 扩展 P41：冷打开 4 个路径，检查标题；侧栏写出的也是路径。
- 确认 `isBareArchiveEntry('/about/') === false`。
- 外壳总数相应 +4。

---

## 5. R2：剧情归属页

### 5.1 路径形状（D2，推荐方案 A）

| 页面 | 方案 A（读模型 id 原样） |
|---|---|
| 剧情目录 | `/stories/` 已有；`?story_type=…` 仍是筛选 |
| 某域的落地页 | `/stories/<main\|extra\|birthday\|unit_story\|event>/`，`story_type` 隐含在路径里 |
| 合集 | `/stories/main/101/`、`/stories/unit_story/1/`、`/stories/extra/601/`、`/stories/birthday/029ass/` |
| 季节企划 | `/stories/seasonal_campaign/valentine_2022/` |
| 个人剧情 | `/stories/idol_story/001tom/` |
| 工作剧情 | `/stories/work/001tom/` |
| 社区剧情 | `/stories/external/` |

- 路径层级就是面包屑层级：资料馆 › 剧情 › 生日剧情 › X。
- 活动剧情的归属页仍是 `/events/<id>/`，电话仍是 `/mobile/<idol>/?mobile_mode=phone`，都已有路径。

**为什么推荐方案 A：** 这是单一来源。路径段就是 `StoryOwner.storyOwner()` 返回的 `domain` 和 `section`，零映射表，往返可以机械验证。

**方案 B** 是美化 slug，例如 `/stories/prequel/01jup/`、`/stories/seasonal/…`。这要多一张双向映射表，还要多一个 verifier。用户如果更看重地址好看，就选 B。

### 5.2 步骤

1. **locator 支持三段路径** `/{prefix}/{kind}/{id}/`。
   - 注册表项加 `segments`，例如 `[{ param: 'story_type', values: [...] }, { param: 'story_section', pattern }]`。每个域的 id 形状不同，按域给 pattern：birthday 是偶像 id，或 `producer_birthday_common`、`101ken`。
   - 二段路径 `/stories/<kind>/` 映射为落地页。
   - `locatorQuery`（`archiveRoute.js:686`）只扩展匹配，不改 query 优先的规则。
2. **schema 核对后启用裁剪**，涉及 `story_collection`、`seasonal_campaign`、`idol_story_archive`、`work_archive`、`external_story_resources`。
   - **注意 `story_collection` 的来源字段：**
     - 打开来源 `parent`（`useStoryNavigation.js:216`）；
     - 从歌曲进来时的 `song`（`useArchiveNavigationState.js:110–112`）；
     - 从个人剧情进来时的 `idol`（`goBackFromStoryCollection`，:332）。

     这三项都属于「从哪来」，照活动和卡池的做法移进 history 上下文：在 `archiveRoute.js:919–926` 旁加 `STORY_COLLECTION_CONTEXT_PARAMS`，并接到 `writeArchiveRoute` 和 `readArchiveRoute` 的 openedFrom。这样拷贝出去的链接不带来源，刷新后仍能原路返回。
   - **留在 query 的定位状态：**
     - 合集的 `story`（当前章节）；
     - 季节企划的 `idol`（参与者）；
     - 个人剧情的 `story_section`、`episode`；
     - 工作剧情的 `story`、`work_mode`。
3. **标签页标题。**
   - `App.vue:1476` 的 `archiveTabEntityName` 加 4 个分支，名字和页面 h1 同源：合集标题走 `src/presentation/StoryPageTitle.js`；个人剧情、工作剧情用 `archiveIdolPlaceName` 同款组合。
   - `ENTITY_TITLE_VIEWS` 由注册表自动包含这些 view。
4. **外壳**，约 183 个：

   | 类别 | 数量 |
   |---|---|
   | 合集 | 80 |
   | 季节企划 | 4 |
   | 个人剧情 | 49 |
   | 工作剧情 | 49 |
   | 社区剧情 | 1 |

   - **数据来源：** 和外壳同一 release 的候选包里的 `collections/`、`seasonal/` 目录页，不在仓库里。`loadEntitySources` 加一个 `candidate` 参数，`prepare-readmodel-preview.mjs` 传入它已有的 models 目录。
   - **CI 没有候选包**，`verify-entity-head-shells` 的纯检查部分用 fixture。参见门禁语料约束：compiled 和候选在 CI 都不可用。
   - **标题：** 和第 3 步同源。不要在生成器里另写一份中文标题。
5. **StoryOwner 往返检查**：扩展 `verify-story-owner.mjs`（localOnly）。对 1394 个故事逐个做：
   - 求 owner；
   - 用 `buildPublicArchiveUrl` 生成地址；
   - 用 `readArchiveRoute` 读回；
   - 断言读回的结果和 owner 是同一路由（`?story=` 定位一致）。

   这个检查不新增任何归属逻辑。
6. **旧链接：**
   - `?view=story_collection&story_type=birthday&story_section=029ass` 改写为路径；
   - `retiredDirectoryRoute`（:291）翻译出来的旧文件浏览链接，最终也应落到路径。

**验收：**

- 浏览器旅程 P51 起：
  - 每个域冷打开一次，检查标题和内容；
  - 目录搜索结果 → 归属页路径；
  - 合集 → Reader → 返回，回到原路径和原章节；
  - 季节企划切参与者，只改 query；
  - 从歌曲进合集后刷新，再返回，仍回到歌曲。
- 外壳 `--dist` 检查通过。
- `readmodels/tools/check_cutover_routes.mjs` 与 `verify-archive-build-audit.mjs` 通过。

**不做：**

- 不给 `story_detail` 路径。它只是故事链接别名，不是页面。
- 不给单个故事文件路径。
- 不改 `StoryOwner.js` 的归属规则。

---

## 6. R3 与 R4（有前置条件，先列方向）

**R3 工具与图鉴实体。** 门户对应批次和谱面、舞台线收束后再定。

- **谱面 `chart_lab`：**
  - 建议路径 `/songs/<code>/chart/`，复用 R2 的三段 locator；
  - 难度不进地址，沿用 #116 的决定；
  - 前置：P3。
- **舞台 `chibi_stage`：**
  - 有歌曲时 `/songs/<code>/stage/`；
  - 没有歌曲时用 `/live/stage/` 还是留 query，待 P4 定；
  - `stage` 参数的语义先问舞台线。
- **摄影工作台 `picture_studio`：** 等 P7 摄影的「开始方式」定下来。
- **图鉴和摄影实体**（`/items/?entity=item:10501` 这类）：
  - 先由用户在 D3 决定哪些实体值得有独立页；
  - 不批量生成；
  - 前置：P6 图鉴（`ArchiveCollectionCatalog` / `CollectionDetailPanel`）。

**R4 Reader / Player。** 最后做。

- **前置：**
  - P7 阅读器和播放器；
  - 剧情语料晋升完成，晋升后文档 id 会再次换键；
  - D4。
- **Reader 有三个方案：**

  | 方案 | 形状 | 前提或代价 |
  |---|---|---|
  | 甲 | `/read/<document_id>/?row=` | 要先有一张「退役 / 换键 id → 现行 id」别名表，从 `translation/studio/retirements/*` 和换键记录生成 |
  | 乙 | 归属页加话序号，如 `/stories/birthday/029ass/read/3/` | 话序号要在读模型里稳定 |
  | 丙 | 保持 query | 只把 `parent` 一类来源字段移进 history，现在已部分完成 |

  推荐先做丙，等语料晋升后再评估甲或乙。
- **Player：**
  - 保持 query；
  - 只收口 `routes.json` 里 player 的 partial，即 `returnView whitelist still has uncovered targets`；
  - 确认 `?scenario=` 链接在任何路径页上都能打开。

**横向事项（D5）：**

- 测试站的 `_headers` 带 `X-Robots-Tag: noindex, nofollow`。
- 外壳的 canonical 和 `og:url` 指向 `DEFAULT_ORIGIN = gs-archive-preview.pages.dev`。
- 正式域名、是否解除 noindex、要不要 sitemap，由用户决定。决定之前不做 sitemap。

---

## 7. 组件与文件指引

| 文件 | 角色 | 本线改什么 | 本线不改什么 | 门户线近况 |
|---|---|---|---|---|
| `src/core/publicRoutes.js`（新） | 路由事实唯一来源 | 全部 | — | — |
| `src/core/archiveRoute.js` | 解析和写地址 | :635–730 locator，:738–808 读，:810–902 写，:904–983 history 上下文 | :491–633 面包屑；:284–318 退役翻译（只读） | P1.5 动过面包屑 |
| `src/core/routeSchema.js` | 每页自有参数、裁剪 | 全部 | — | — |
| `src/core/useArchiveNavigationState.js` | 状态 → 路由对象 | `currentArchiveRoute()` 的来源字段 | ref 的定义和导出 | — |
| `src/core/StoryOwner.js` | 故事归属 | 不改，只消费 | 归属规则 | — |
| `src/core/archiveStartup.js` | 裸入口判断 | 仅当 locator 语义变化 | 偏好逻辑 | — |
| `src/core/archiveViewRestoration.js` | 视图恢复键 | 不改，只验证 query 键不变 | — | — |
| `src/presentation/ArchiveDocumentTitle.js` | 标签页标题 | 标题表派生 | 文案格式 | P1.5 动过 |
| `src/App.vue` | 编排 | :1476 标题名分支；必要时调整导航打开函数的状态赋值 | 模板、props、样式 | #117 已合；#120 加了 `followArchiveLink`；冲突热点 |
| `src/composables/useStoryNavigation.js` | 剧情导航 | parent、song、idol 来源改走 history | 加载与读模型调用 | — |
| `src/composables/useCardNavigation.js` 等 | 目录打开 | 原则上不改，用裁剪兜底 | — | — |
| `src/components/archive/ArchiveBreadcrumb.vue` | 面包屑 href | 不改，已经用公开地址 | — | P1.5 |
| `src/components/archive/ArchiveStoryCollection.vue:214` | 阅读链接 | R4 才动，而且只动 script | 模板 | — |
| `scripts/generate-entity-head-shells.mjs` | 外壳 | 改 import 注册表；加剧情外壳 | head 标签结构 | P1.5 动过 |
| `scripts/prepare-readmodel-preview.mjs` | 预览包 | 外壳段（:60–70）、`_headers` 段（:108–122） | 其余发布逻辑 | — |
| `scripts/verify-route-schema.mjs`、`verify-archive-path-locator.mjs`、`verify-entity-head-shells.mjs`、`verify-story-owner.mjs`、`verify-portal-path-locator-browser.mjs`、`audit-route-schema.mjs` | 守门 | 扩展断言、旅程续号 | 删减已有断言 | — |
| `config/verifier-coverage.json` | 门禁登记 | 新增 verifier 登记（batch 或 localOnly 带原因） | — | 各线都会加行 |
| `readmodels/contracts/routes.json` | 迁移台账 | 改了路径的 view 补证据 | 状态降级 | — |

---

## 8. 待办与待用户决定

**交给门户线的事项**（组件不在本线做）：

- R1 Browser P48 在基线 `36743743` 发现 `ArchiveSongCatalog.vue:177` 调用未定义的 `techCount`。用户授权独立小修 `3142c10e` / [PR #122](https://github.com/windmet/GS_Archive/pull/122)，组件仅一行复用 `filterCount`。随后用户明确授权仅合并 #122，已以 merge commit `dd7b28de` 合入；地址线以 `c1d526a9` merge 跟进。集成 P48 已通过冷开、筛选、详情返回和刷新，实际统计 4/1/0/0；详见 R1 执行记录。#121 后经用户授权合入，R2 #123 亦已合入；此处保留缺陷发现与独立修复的历史。

- 详情页加「复制链接」：`href` 用 `buildPublicArchiveUrl`。
- 卡片、目录行改成真 `<a href>`：支持中键新标签页和右键复制。普通点击 `preventDefault` 后仍走 `open*`（保留来源）；只有本来就不带来源的链接才交给 `followArchiveLink`。做法照 #120 的面包屑。

**待用户决定：**

| 编号 | 问题 | 推荐 |
|---|---|---|
| D1 | 工具入口路径名，以及 `archive_status` 用 `/status/` 还是 `/resources/` | `/live/ /studio/ /about/ /status/`；`portal` 等 P2 |
| D2 | 剧情路径用方案 A（读模型 id 原样）还是方案 B（美化 slug） | A |
| D3 | 哪些图鉴和摄影实体值得有独立页 | 等 P6 图鉴再议 |
| D4 | Reader 路径用甲、乙还是丙 | 先丙，语料晋升后再议 |
| D5 | 正式域名、noindex、canonical origin | 用户定，不阻塞 R1/R2 |

---

## 9. 验收手册

所有命令都在 `E:/Web_build/GS_Archive_Domain_Work/deep-links-20261028/web_viewer` 下运行。

```bash
# 路由单元
node scripts/verify-route-schema.mjs
npm run verify:routes                     # archive-routes + path-locator
npm run verify:archive-navigation-state
node scripts/verify-collection-route.mjs
node scripts/audit-route-schema.mjs       # 记录 emitted / survives 前后数字

# 构建与外壳
npm run build:check                       # 禁止 npm run build / 直接 vite build
node scripts/generate-entity-head-shells.mjs
node scripts/verify-entity-head-shells.mjs --dist=.analysis/build-check

# 全门禁（LF worktree，CI 同款）
npm run gate:source

# 本地专用
node scripts/verify-story-owner.mjs       # 需要候选包，dev 服务自动挑 rm-release-20261022
```

**浏览器旅程：**

1. 起 dev 服务：`npx vite --configLoader native --port 5240`。先确认端口空闲，不要关别人的服务。
2. 在沙盒外运行：`node scripts/verify-portal-path-locator-browser.mjs http://127.0.0.1:5240 .analysis/path-locator`。
3. 旅程从 P47 起续号。
4. 2026-10-28 的浏览器情况：
   - 这台机器上，Playwright 缓存的完整版 `chrome.exe` 在工具沙盒内外都起不来；`chrome-headless-shell` 在沙盒外能起。
   - `verify-portal-path-locator-browser.mjs` 只找 `chrome.exe`。R1 做第一个浏览器旅程之前，先把 `verify-archive-breadcrumb-browser.mjs`（#120）的选浏览器写法（优先 headless-shell，回退 chrome.exe）搬过去，再跑 P1–P46 打底。
   - 面包屑本身另有 `node scripts/verify-archive-breadcrumb-browser.mjs http://127.0.0.1:5240`（B1–B4）。

**注意事项：**

- `build:check` 会改写 `config/resource-audit.json`，不要提交。
- 在 LF worktree 里还原文件也要带两个 `-c`：

  ```bash
  git -c core.autocrlf=false -c core.eol=lf checkout -- <path>
  ```
- 新 verifier 先登记进 `config/verifier-coverage.json`，否则 `verify-verifier-coverage` 会红。

**每批的 PR 描述需写明：**

- 改了哪些「只能小改」的文件，逐条带行号；
- 变异测试做了什么、FAIL 输出是什么；
- 浏览器旅程编号与结果；
- 外壳数量变化；
- `audit-route-schema` 前后数字；
- 没做的事项。


## 后续前置核对（2026-10-28）

核对基线：`origin/master` `11e7418c`。这是地址线后续开工条件，不代表门户或语料工作的验收。

| 后续项 | 当前事实与下一步 |
|---|---|
| R3 谱面 | P3 未合入；等谱面页面结构收束，再实现 `/songs/<code>/chart/`，沿用 #116 的难度不进地址决定 |
| R3 舞台 | P4 未合入；无歌曲入口形状仍待收束。当前 `useStageNavigation.js` 写入 `target.choreographyId` 至 stageTargetId，`currentArchiveRoute()` 输出 stageId；不能把编舞身份当歌曲 code |
| R3 摄影 | P7 摄影未合入；开始方式尚未在本轮确认 |
| R3 图鉴实体 | 等 P6 图鉴的实际详情边界，再定实体路径集合（D3）；不批量创建实体路径 |
| R4 Reader / Player | P7 与剧情语料晋升仍未完成；CURRENT_STATE 的 13 个 RAW 核对文件与 Valentine b 段语音补抽门槛仍在。暂保留 Reader 方案丙与 Player query；晋升后再核对 D4、别名/稳定话序与 returnView 覆盖 |

核对时远端开放 PR 只有 #118（P6 活动详情）、#119（人物色影）、#120（面包屑站内打开），没有 P3/P4/P7 交付；未越过本任务范围合并其他门户 PR。后续从最新 master 重查这些前置，再开新地址分支。提交/建 PR/合并不再逐次征询，不把这一约定扩展为部署、资源上传或跨线改造授权。

本次收口只改文档，执行事实/相对链接/差异检查，不新增应用构建或 Browser 验收；前序代码、dev Browser、候选外壳证据及 R1 本地技能海报 404 边界仍按对应执行记录保留。


## 主干集成补验（2026-10-29）

输入 master `7c7312c1`，已补直接 Browser P67–P73（含失败复现），见 [集成记录](GS_ARCHIVE_DEEP_LINKS_INTEGRATION_20261029.md)。组合详情的具体章节入口遗漏 storyFile，已在现有导航参数处补齐；不涉及 R3/R4 新路径。该记录不是门户五类详情整页视觉或设备验收。
