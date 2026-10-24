# 组合页 / 歌曲页 / 通信页重构交接（2026-10-23）

外部方案《组合页与歌曲页深度重构方案》已逐条对照 `origin/master`（2bdd3de4）的代码和数据核对过。结论：**大部分可以吸收**。有 4 处不能照着方案直接搬，已在各节用 ⚠ 标出。

方案里的示例数据（成员属性分配、剧情话名、"110×84"、"56px" 等尺寸）不是实测值，**不要照抄**。所有数字都要从现有字段取。

涉及文件（按批次的最小改动集合）：

| 批 | 页面 | 文件 |
|---|---|---|
| H1 | `/units/` | `src/components/archive/ArchiveUnitCatalog.vue` |
| H2 | `/units/:id/` | `src/components/archive/ArchiveUnitDetail.vue`（成员副标题可能要动 `src/presentation/IdolReferencePresentation.js`） |
| H3 | `/songs/` | `src/components/archive/ArchiveSongCatalog.vue` + 分类函数（见 3.1） |
| H4 | `/songs/:id/` | `src/components/archive/ArchiveSongDetail.vue`（歌词搬家另立一批 H5，见 4.4） |
| H6 | `/mobile/…` | `src/components/archive/ArchiveMobileArchive.vue`（合并累进条件时加 `src/data/idolCommunicationSelectors.js`） |

---

## 1. 组合列表 `/units/`（H1）——采纳

现状：左侧场景图 `94×94` cover；Logo 放在右侧文字区，框为 `width:min(132px,100%); height:32px; object-fit:contain`，左对齐。所以方正的徽章型 Logo 最多只有 32px 高，而扁长型能占到 ~112×32，面积差约 3.5 倍。方案的诊断是对的。

做法：
- 场景框改成 `168×94`，`position:relative`，叠一层浅色遮罩，Logo 在框内水平、垂直都居中，加 `drop-shadow`。
- Logo 用双上限：`max-width:128px; max-height:54px; width:auto; height:auto`。扁的先碰到宽度上限，方的先碰到高度上限。
- 右侧只保留 `unit_name` + 统计行。Logo 移走后，名字不再和 Logo 上下重复。
- 成员头像 `30 → 40`（`ArchiveIdolAvatar :size`）。
- ⚠ 方案想加「N 首组合曲」，但目录 entry 现在没有歌曲数。要从组合详情用的同一份 songs 来源算出来，再挂到 entry 上，不要另写一套统计。拿不到就不显示这一项。
- `without-background` 分支（没有 `representative_bg` 的组合）：Logo 改放在纯色框里（`unit_color` 的浅色 wash），不要退回到旧的左对齐写法。
- ≤520 现在会隐藏场景图（`.unit-entry > img {display:none}`）。手机端保持这一点：场景框整块隐藏，Logo 回到文字区第 1 行，现有的 grid-area 写法不用改。

验收：16 个组合的 Logo 视觉面积接近；390px 宽度下没有横向滚动。

## 2. 组合详情 `/units/:id/`（H2）——采纳，3 处改动

现状顺序：hero → 简介（单独一节）→「成员卡片」只有 4 个数字 → 成员 → 组合歌曲 → 固定组合团活 → 属性团曲出演 → 跨组合团活出演 → 组合剧情。

新顺序：
1. **Hero**：把简介收进 hero（左侧渐变遮罩，文字放左半）。卡片统计改成 hero 底部的一个胶囊按钮「82 张卡片 · 11 SSR · 15 有卡片小剧情 ›」，点击仍走 `emit('open-cards')`。去掉「成员卡片」这一节。「单卡面」这个数字读者用不上，不放进胶囊。
   - 简介要看长度：有的组合简介比较长。hero 改成 `min-height`，不要定死高度；手机端简介留在 hero 下方（保持现在的分离写法）。
   - 方案提到的「直接展示 4 张 SSR 卡面」：**这次不做**，因为要新增请求，超出本批范围。
2. **成员**：`repeat(auto-fill, minmax(200px,1fr))` 改成 `auto-fit, minmax(160px,1fr)`。`--gs-content-width` 是 1120px，5×160 加上间隔放得下。≤760 维持现在的单列。
   - 副标题去掉重复的组合名，换成 **CV**（`idol_unit_dictionary.json` 的 `idols[].cv` 有数据）。
   - ⚠ 方案写的「属性色点 Phy/Int/Men」：字典里**没有偶像级属性字段**（属性在卡片/活动层面），**不要做**，否则就是编出来的数据。备选：CV + 生日（`birthday` 字段有）。
   - 改副标题要在 `ArchiveIdolReference` / `buildIdolReference` 上加一个可选的副标题来源（例如 `subtitle: 'cv'`），不要在组合页里另写一个成员卡组件。参见 memory「IdolReference 默认改内容行」。
3. **组合歌曲 + 组合剧情并排**（左 55 / 右 45），≤980 改为上下排列。任一边为空时，另一边占满整行。
4. **活动合并成一节「活动与企划出演」**，标题栏用筛选胶囊（全部 / 固定组合团活 / 属性团曲 / 跨组合混活）。复用 75c0bf39 统一过的 filter chip 样式；三个 `relationItems(...)` 原样合并，每一项的 `label` 已经带有分类。数量为 0 的胶囊不显示。

## 3. 歌曲列表 `/songs/`（H3）——采纳，1 处改动

### 3.1 编制筛选
数据核对（60 首 primary，看 `performance_mapping.performer_scope`）：`fixed_unit` 47、`configurable_formation` 5、`fixed_special_lineup` 7、`unspecified_special` 1。方案的 5/47/8 是对的。

⚠ 门户（`ArchivePortalOverview.vue:277`、`PortalOverviewPanels.js:62`）的「特别编成」只算 `fixed_special_lineup`（7 首），名称也叫「**代表曲**」，不叫「全体曲」。歌曲页**必须和门户用同一个分类函数、同一套名称**，否则同一个分类在两个页面显示的数字不一样。做法：把门户的分类和名称提取到 `src/presentation/SongPresentation.js`（那里已经有 `fixed_special_lineup` 的文案），两边都从这里 import。`unspecified_special` 归不归「特别编成」，两处要一起决定（建议归入，并同时改门户）。

筛选条分两组，中间加一条竖线分隔：`全部 | 代表曲 | 组合曲 | 特别编成 ‖ 3DMV | MV LIVE | 分轨演唱 | Center 台词 | 特殊版本`。编制和技术标签是**两个独立维度**，按交集过滤。现在 `scope` 是单值并且绑在 URL 上，要么扩成两个参数，要么编制单独用一个 query 参数。旧的 `scope=movie` 这类 URL 要能继续用。

### 3.2 卡片
- 封面放大到 72×72，圆角 8。
- 「含特殊版本 / 分轨演唱」等徽章已经是 `song-badges` 一行。之所以会变成 4 行，是因为有 `credits` 的卡片多了一行。统一高度的做法：credits 固定只占 1 行并截断，徽章放到标题右侧。
- 卡片右侧的 `▷` 图标可加可不加：整张卡片本来就是按钮，加了只是装饰。

## 4. 歌曲详情 `/songs/:id/`（H4）——部分采纳

现状：桌面端左栏 = `song-record-column`（难度与解锁 → 关联活动 → 演唱者 → 音源收录 → 版本 → 档案 → 影像 → 专辑 → 制作），右栏 = `song-listen-column`（播放器 + 歌词 + 2D 舞台按钮），**只有能完整放进视口时才 sticky**（`listeningColumnFits`）。

1. **音源收录提前，组合版做成直接可见的胶囊**——采纳。`playUnit(unit.code)` 已经存在，现在只是被藏在折叠的 `<details>` 里。把「全员合唱 / 伴奏 / 各组合版」做成一排胶囊放在 hero 下方；49 人的 Solo / ＋编成继续放在折叠区。
   - 只有 `song.playback.experiment` 的 3 首（`byndtd`/`drvalv`/`grwsml`，各 16 个组合版）有这一块。其他 57 首不受影响，不要为了这 3 首调整所有歌曲的区块顺序。
2. **难度表压缩成 4 格**——采纳。`repeat(4,1fr)`，每格是「EASY / 等级 / Combo」。解锁条件和历史放在下面一行，保持不变。
   - ⚠ **不要搬进右侧 sticky 栏**。右栏只有在高度不超过视口时才 sticky，再加 64px 以上的内容，会让更多歌曲（尤其是有分轨编成面板的）超高、失去 sticky，播放器反而跟不住页面。难度条放在左栏，位置在演唱者/音源之后。
3. **右栏加卡片容器**——采纳。用 `--gs-surface` + `--gs-line` 圆角边框（不要写方案里的 `#f8fafc` / `#e2e8f0` 硬编码色值，要用 token），并把「2D 舞台演出」按钮移到播放器标题行。
4. ⚠ **歌词搬到左栏——不能直接搬**。`ArchiveSongLyrics` 不是独立的区块，它在三个播放器里各被实例化一次（`ArchiveSongSinglePlayer.vue:24`、`ArchiveSongExperimentalPlayer.vue:76`、`ArchiveSongLineupPlayer.vue:80`）。它吃播放器内部的 `currentTime` / `stage-clock` / `ready`，五槽编成模式还要吃 `selectedArrangement` 时间轴，点击歌词会 `@seek` 回播放器。直接移动模板会断掉同步和跳转。
   - 要搬的话，需要先把三个播放器的时钟统一，经由 `songPlayer` ref 或 provide/inject 暴露出来（`{ currentTime, ready, seek, timeline }`），再由 `ArchiveSongDetail` 在左栏只渲染**一份**歌词。这是另一批（H5），要单独验收：三种模式下歌词都高亮正确、点击能跳转、切换声部后时间轴正确。
   - 现在放在右栏也有道理：歌词跟着 sticky 播放器走，边听边看。H5 做完以后，右栏只剩控制区，sticky 更容易放得下。所以 H5 和第 2 点是配套的。

> 第二版方案又提了一次「歌词搬到左栏」和「难度表放进右栏 sticky」。结论不变，原因见上面第 4.2 点和第 4.4 点。

## 5. 通信页 `/mobile/:idol/`、`/mobile/unit/…`（H6）——采纳，2 处改动

文件：`src/components/archive/ArchiveMobileArchive.vue`。如果要合并累进条件，再加 `src/data/idolCommunicationSelectors.js`。骨架（名片、切换器、4 个 Tab）不动。

现状核对：
- `content-heading` 里的 `<h3>{{ activeTab.label }}</h3>` 和上面高亮的 Tab 重复；右侧 `<strong>{{ contentSummary }}</strong>` 已经有「N 条记录」，电话是「N 通电话 · 来自 N 张卡片 · N 通有其他人在场」。
- `<details class="unlock-explainer">` 展开后只有一句说明，确实是「假折叠」。
- 没有日期的条目第一行显示 `kindLabel(kind)`，在个人聊天里就是重复的「偶像聊天」（`:82`, `:293`）。
- 每个 `bundle.unlocks` 都单独渲染一个图标加一段文字（`:83–91`），所以累进聊天有几个阶段就有几行锁。

做法：
1. **标题行和工具行合并成一行**：去掉显眼的 h3。⚠ 不要直接删掉：要保留成**视觉隐藏的 h3**（页面的标题层级和读屏都靠它），视觉上只留一行：左边是 `contentSummary`，右边是开关。说明文字「仅记录原游戏中的开放条件，不影响浏览与播放」改成开关的 `title`/`aria-describedby`，不要另占一行。390px 下允许换行，开关换到第二行时右对齐。
2. **`<details>` 换成真正的开关**「显示开放条件」，控制每条记录里 `.unlock-list` 的显示和隐藏。
   - **默认勾选**。卡片条件（`isRelatedUnlock`）是跳到卡片或个人剧情的入口，默认隐藏会让读者找不到这些导航。
   - 记住选择属于单个读者的偏好：用 `localStorage`，读写都要 try/catch，读不到时按默认值处理。不要放进 URL，也不要放进共享状态。
   - 随机话题 Tab 没有开放条件，不显示开关（现在的 `v-if="mode !== 'random'"` 保留）。
3. **无日期条目的第一行**：有 `releaseAt` 就显示日期；没有就**不渲染这一行**，不再写 `kindLabel`。Tab 本身已经说明了类别。⚠ 方案说「没有日期时显示开放条件胶囊」，这样会和下面的 `.unlock-list` 重复显示同一条条件，而且关掉开关后又会变成一个空行，所以不采纳。
4. **合并累进条件（7 个锁 → 1 行）**——可以做，但要注意数据形态：这类条件的 `kind` 是 `scenario_title_mission`，`param_a/param_b` 是空的，**只有任务标题文本**（例如「『天ヶ瀬 冬馬』と累計3回お仕事しよう」），数值是写在文本里的。
   - 合并要放在 selector 里：把文本中的数字替换成占位符，得到模板；同一模板的多个阶段合并成一项 `{ template, values:[3,5] }`，显示为「工作 3 / 5 次」这样的写法。不同模板之间用 ` · ` 连接，最后加「（共 N 阶段）」。
   - 卡片条件和剧情条件**不参与合并**，它们各自是可以点的入口。
   - 解析不出数字、或者模板只出现一次的条件，原样显示。这一项**必须写 fixture verifier**：至少覆盖「3 个模板 × 多阶段」「单阶段」「无数字文本」「中文 locale 的 `presentMissionText` 输出」，然后按 memory「Verifier must be mutation-tested」把合并逻辑改坏，确认 verifier 会报 FAIL。
   - 名称沿用电话篇的约定：电话就叫「电话」（参见 memory「Card scenarios are phones」）。

验收：手机 390px 首屏能看到的记录数比现在多（方案估计省 56px，以实测为准）；关掉开关后没有残留的空行；电话 Tab 的卡片跳转照常可用。

## 建议顺序

H1 → H3（分类函数抽出来以后，门户也一起切过去）→ H2 → H6（1–3 点很小，可以和 H1 同一天做；第 4 点带 verifier，单独提交）→ H4（1–3 点）→ H5（歌词搬家）。每批跑 `npm run build:check` 和 `npm run gate:source`；视觉验收用 `preview.gs-archive.com`，或按 memory「Browser acceptance recipe」在本地截图，宽度 1440 / 980 / 390。
