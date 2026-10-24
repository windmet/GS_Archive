# 交接：门户 v8 细节精修（G 批，2026-10-23 晚）

本文写于 master = `2bdd3de4`（#93 读模型绑定、#94 315 岁时记都已合入）。工作区规则、worktree、提交、门禁、截图脚本仍按 [GS_ARCHIVE_HANDOFF_20261023_PORTAL_REVIEW.md](GS_ARCHIVE_HANDOFF_20261023_PORTAL_REVIEW.md) 第 0 节执行；A–F 批的定案见那份和 [GS_ARCHIVE_HANDOFF_20261023_PORTAL_LAYOUT.md](GS_ARCHIVE_HANDOFF_20261023_PORTAL_LAYOUT.md)，本文不改它们。

外部审阅 v8 已和代码核对。用户的意见是「大体同意，结合实际情况取舍」，下面的取舍**已经定好，不要重新评估**。各条按「先核实、再动手」写：有两处审阅描述和现有代码对不上（第 2.1 节第 3 点、第 6 节），要先截图确认是真问题。

## 0. 分支和范围

- 分支 `portal/<日期>-v8-polish`，从最新 `origin/master` 开，LF worktree。一个分支、一个 PR，每节一个提交，按本文顺序做。几节都改 `ArchivePortalOverview.vue`，**不要拆成并行分支**。
- 改动范围：`src/components/archive/ArchivePortalOverview.vue`、`PortalCardBento.vue`、`src/presentation/PortalOverviewPanels.js`；如果第 3 节要算比例条分段，可以加纯函数，放进 `PortalOverviewPanels.js`。**不改读模型、不加请求**。所有数字都必须来自 scope 里已有的字段（`cardCounts`、`storyCounts`、`songCounts`、`preferredStats`、`footprints`、`collectionCounts`、`gatewayCountsByAction`），缺字段就不显示，不要用预览行去估。
- 只改桌面端：桌面指 `@container portal (min-width:981px)`。≤980 和手机端的布局不变，除非某节另有说明。
- 视觉验收截图：1366 和 1920 两个宽度。担当视图用 `?view=portal&portal_scope=` 加偶像代码，至少截 3 位偶像：005kao 樱庭薰（审阅原图）、006tsu，再挑一位卡少或故事少的；全站视图截两次，一次用当前月，一次切到一个生日少、活动多的月份。

## 1. 取舍总表

| # | 审阅条目 | 决定 | 和审阅原文的差别 |
|---|---|---|---|
| 1 | 担当 2×2 统计磁贴改造 | **采纳，有改动** | 图标用 lucide，不用 emoji；顶部统计行只在担当视图、桌面端隐藏；等高问题先测量再改 |
| 2 | 故事档案左下空洞 | **采纳，有改动** | 不合并「额外剧情」和「季节企划」；格子数为奇数时，最后一格跨两列；不要求和左侧歌曲栏严格等高 |
| 3.1 | 故事胶囊和「查看全部」撞车 | **采纳** | 字号、内边距用现有 token，不硬写 12px |
| 3.2 | 通信与图鉴折行落单 | **采纳** | 图标沿用侧栏的 `archiveNavigationIcons` |
| 3.3 | 岁时记左右高度差 | **只采纳右栏改 2 列** | 生日偶像卡不改成名片卡，不追求左右等高 |
| 3.4 | 竖卡卡名和稀有度 | **采纳，先核实** | 代码里竖卡已经有一行文字，要先查清截图里为什么是空的 |

## 2. 担当视图：顶部统计行和 2×2 磁贴（审阅第 1 节）

### 2.1 先处理重复和对齐

1. **顶部统计行**（`.overview-footprint`，「17/826 卡片 4/60 相关歌曲…」）：只在**担当视图、桌面端**隐藏，因为这时右侧磁贴已经显示了同样的数字。全站视图和 ≤980 的担当视图都保留这一行：手机端没有磁贴（`.overview-personal-stats` 在 ≤980 是 `display:none`），这一行是唯一的数量入口。
2. 统计行里的分母移到磁贴上，显示成 `17 / 826`。分母取 `footprints` 中同一 id 的 `total`：卡片、出场剧情、参与歌曲各有一个；通信没有全站总数，就不显示分母。统计行原来的第 4 项「活动足迹 3/59」不搬进磁贴，下方「活动足迹」标题后面已经有数量。
3. **左右等高要先测量。** 人物卡和磁贴本来就在同一个 grid 行里（`.overview-featured:not(.is-all-view)`，`repeat(2,minmax(0,1fr))`），磁贴网格的行是 `minmax(0,1fr)`，按理应该已经被拉成一样高。审阅说的「左边高一截」可能其实是磁贴里内容居中（`align-content:center`）、上下留白太多，看起来像没对齐。用 `scripts/verify-portal-preferred-alignment-browser.mjs` 量出两边外框的 top/bottom：
   - 外框本来就对齐：只做 2.2 的内部改造，不碰外层 grid；
   - 外框确实不齐：先找出原因（比如 `.overview-personal-meta` 的绝对定位、`min-height:228px`、手机端用的 `.overview-directory` 有没有在桌面端占格子），修掉原因，**不要用固定高度去凑**。
   - 无论哪种情况，都在这个 verifier 里加上「磁贴网格外框底边 = 人物卡外框底边（±1px）」的断言，并做变异测试：把磁贴网格改成 `align-self:start`，断言必须 FAIL。

### 2.2 磁贴内部改成三段

每块磁贴改成 `display:flex; flex-direction:column; justify-content:space-between`，内边距用 `--gs-space-*`：

1. **顶行**：左边是 lucide 图标加标签，图标和侧栏同一套（`archiveNavigationIcons` 里的 cards / stories / songs / interactions）；右边是大号数字，后面跟浅灰的 `/ 总数`，再加一个 `ArrowUpRight`。整块磁贴仍然是一个按钮，点击行为不变（`openStatTile`）。
2. **中行：比例条**。高 6px、圆角、`display:flex`，每段的 `flex-grow` = 该分类的数量。分段数据就用磁贴现在 `meta` 里的那几项（卡片：SSR/SR/R/N；出场剧情：主线/活动/个人/其他；参与歌曲：代表曲/组合曲/特别编成；通信：个人聊天/电话）。颜色用横幅已经在用的偶像色变量（`heroStyle` 里由 `idolStageLight` 给出的 `--hero-light` / `--hero-ink`，把它们的作用域扩大到磁贴所在的容器），按段的顺序用 `color-mix` 调出由深到浅的几级，不要另起一套彩色色板。数量为 0 的分类不画分段。总数为 0 或缺数据时，整根条不画。
3. **底行：分类胶囊**。把 `meta` 字符串拆成一排小胶囊（`SSR 2`、`SR 11`、`R 3`）。每个胶囊前面加一个小色块，颜色和比例条对应那段相同，这样胶囊同时充当图例。只显示数量大于 0 的分类；N 卡只在 `cardCounts.rarity.N > 0` 时出现。
   - 实现方式：`portalPreferredStatTiles` 改为返回结构化的 `parts: [{id,label,count}]`。`meta` 字符串保留，用作 `aria-label`，不要删。组件根据 `parts` 渲染比例条和胶囊。`verify-archive-portal-presentation.mjs`（或现在覆盖 `portalPreferredStatTiles` 的那个 verifier）要断言：`parts` 的数量之和 = 磁贴上的数字。注意「其他」类可能导致加起来不等于总数，如果真的不等，就要写明哪个是权威数字，不能悄悄改数。

## 3. 全站视图：故事档案改成上下两层（审阅第 2 节）

`.overview-story-hub` 现在是「左：两张主线横幅 / 右：7 个入口列表」，左边比右边短一截。改成：

- **上层**：两张主线横幅并排，`grid-template-columns:repeat(2,minmax(0,1fr))`，横幅下面那行文字（章名、节数·话数、箭头）保持不变。
- **下层**：7 个入口（`storyGateways` 里除去 external-resources 后剩下的 7 个）排成同样的 2 列网格，列间距和上层相同，所以中间的缝隙在同一个 x 坐标上。每格：lucide 图标、名称、数量加单位、`ArrowUpRight`，格与格之间用细线分隔（沿用现在 `.overview-story-gateways` 的样式）。
- **入口数是奇数**：最后一格跨两列（`:last-child:nth-child(odd){grid-column:1 / -1}`）。**不要合并「额外剧情」和「季节企划」**：它们打开不同的目录，数量的单位也不同（篇 / 组）。如果以后入口数变成偶数，这条规则自然不生效。
- 不要求故事档案和左边的「歌曲与舞台」严格等高。歌曲栏的高度会随演唱范围胶囊的切换而变，追求等高只能靠固定高度，那样做不划算。验收只看一点：**故事档案面板内部不再出现大块空白**。
- ≤980 保持现在的单列堆叠（`.overview-story-hub` 在 980 以下已经是单列），横幅仍然在前。

## 4. 两处胶囊（审阅第 3.1、3.2 节）

### 4.1 「出场故事」胶囊和「查看全部」撞车

- 现在的情况：胶囊组是 `flex:1; min-width:0; overflow-x:auto`，放不下就横向滚动。所以「其他」并没有和别的元素重叠，而是被滚动区域的边缘截断了；但看上去就是坏的。
- 改法：
  1. 担当视图里，第一个胶囊只写「全部」，不带数字，因为标题后面已经写了总数。
  2. 标题栏里的「查看全部」加 `flex-shrink:0; white-space:nowrap`。
  3. 胶囊组还有没显示完的内容时，在右边缘加一段渐隐遮罩（`mask-image`，只在确实溢出时加，用一个 class 切换），让人知道可以横向滚动，而不是看到半个字。
  4. 胶囊的内边距、字号可以收紧一级，但要用现有 token（`--gs-space-3`、`--gs-text-meta` 之类），**不要硬写 12px**。卡面区的属性、稀有度胶囊和岁时记的月份胶囊用的是同一套标题栏胶囊样式，改了要三处一起截图检查。
- 验收：1366 宽度下，樱庭薰的 5 个胶囊要么全部显示完整，要么右边缘有渐隐提示；不能出现被硬切掉的文字。

### 4.2 通信与图鉴：从流式胶囊改成固定列的小卡片

- 审阅说得对：现在的圆角胶囊和月份胶囊长得一样，看起来像筛选条件，而不是栏目入口；而且图鉴 6 项会折出 1 项单独占一行。
- 改法：`.overview-hub-links` 从 `flex-wrap` 改成 `grid-template-columns:repeat(3,minmax(0,1fr))`。通信 3 项排一行，图鉴 6 项排 3×2。每格是一张小卡片：上面是 lucide 图标和名称，下面是数量；用方角卡片的样式（`--gs-radius-media` + 细边框），**不用 pill 圆角**，和胶囊区分开。
- 图标：图鉴各项用 `archiveNavigationIcons[entry.id]`；通信 3 项用 MessageCircle / Users / Phone（如果侧栏的通信标签已经有对应图标，就用同一个）。「其他语音」没有数量，那一格就不显示数字，不要写 0 或「—」。
- 两组的栏宽相同（`.overview-hub-groups` 本来就是 2 等分），所以两边 3 列小卡片的宽度一致。
- ≤640 时 `.overview-hub-groups` 已经变成单列，小卡片仍然保持 3 列；390px 下要检查名称是否放得下（「摄影资源」「组合聊天」）。放不下就降到 2 列，不要缩小字号。

## 5. 315 岁时记：右栏改成 2 列（审阅第 3.3 节）

- 只改一处：桌面端 `.overview-almanac .overview-event-grid` 从 `minmax(0,1fr)` 改成 2 列。但右栏只占半屏，1366 宽时每张活动卡只有约 290px，所以要用 container query 加条件：右栏宽度 ≥560px 才用 2 列，否则保持 1 列。
- 不把生日偶像改成名片卡或 2×2 头像卡，也不追求左右等高。有的月份只有 0–1 位偶像过生日，无论怎么做左栏都会更短；岁时记要展示的是「这个月发生过什么」，留白可以接受。
- 验收：当前月和一个「生日少、活动多」的月份各截一张图；活动标题过长时要省略号截断，不能把卡片撑高。`verify-portal-almanac.mjs` 不需要改，它不检查布局。

## 6. 竖卡加卡名和稀有度（审阅第 3.4 节）

- **先核实。** `PortalCardBento.vue` 里竖卡已经有 `.bento-tile-caption`：担当视图显示 `card.title`，全站视图显示 `card.idolName`。但审阅的截图里，担当视图的竖卡底部是空的。先在真 app 里打开 005kao，看 DOM：
  - 如果 caption 元素在但文字是空的：问题在数据，担当 scope 的卡片预览行可能缺 `title`。去查是哪个投影把它丢了，修投影；不要在组件里拿 `card.id` 之类的值顶替。
  - 如果有文字但看不见：查遮罩或层叠顺序。
- 改法：竖卡说明文字改成和横卡一样的两级结构。
  - 担当视图：一行 `{稀有度} · {卡名}`。
  - 全站视图：上面一行小字 `{稀有度} · {偶像名}`，下面一行 `{卡名}`。
  - 两行都单行省略。1366 宽时竖卡只有约 200px 宽，卡名大多会被截断，这可以接受，完整卡名放进 `aria-label`（现在已经有了）。
- 同时改掉 `PortalCardBento.vue` 里那条注释「Rarity is marked on the lead only」，它已经不成立了。`verify-portal-bento.mjs` 要加断言：每张竖卡的说明文字里都包含稀有度和卡名（全站视图还要有偶像名），并做变异测试：去掉竖卡的稀有度，断言必须 FAIL。

## 7. 收尾

- 门禁：LF worktree 跑 `npm run gate:source`，再跑 `npm run build:check`；不要直接跑 `vite build`。
- 浏览器验收：在真 app 里截图（不要用探针页），宽度和偶像见第 0 节；再加一张 390px 手机截图，确认手机端没有变化。截图放 `.analysis/portal-v8-20261023/`。
- 本批只改代码，不改读模型，所以**不需要重新绑定读模型，也不需要上传 R2**。部署要另行取得用户授权。
- PR 描述里逐条写明第 1 节表格中的取舍，特别是两处「先核实」的结论（第 2.1 节第 3 点和第 6 节）：是真问题还是截图里的偶然现象，都要写清楚。
