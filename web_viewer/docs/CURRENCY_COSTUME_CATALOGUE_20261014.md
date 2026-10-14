# 货币、服装图鉴（2026-10-14）

收藏下新增两个板块（板块名原为「货币与资源」，已缩短为「货币」），结构照搬道具/称号：目录页在板块根路径，详情是同一路径加 `?entity=`。

| 板块 | 目录 | 详情示例 |
|---|---|---|
| 货币 | `/currencies/` | `/currencies/?entity=currency:free-gem` |
| 服装 | `/costumes/` | `/costumes/?entity=costume:001tom_101_00` |

旧式 `?view=collection_catalog&collection_kind=costumes&entity=…` 会读成同一路由，并改写为上面的短链接。身份不匹配的 entity（例如 `/costumes/?entity=item:1`）会被丢弃，只打开目录。

## 奖励普查结论（这批的起点）

- 7,943 条奖励全部可解析：5,802 条指向实体，2,141 条只有奖励类型（星钻、金币）。页面上不会出现「未解析」「奖励引用待确认」。
- 真正的问题在 2,141 条只有类型的奖励：显示日文原名（スタージェム ×50）、没有图标、不能点。这批已修好，见「读模型」。
- 商店全部由服务端下发（ShopMoney / Memorypiece / TimeBound / SelectionTicket / EventExchange / GashaCeilingExchange），客户端没有商品表。PremiumPacks 在本地，但没有价格。
- 本存档中以下表为空：SongRewards、MissionCategories、BirthdayStoryProducts、ContinuousLoginBonuses、IdolReliabilities、TutorialStoryRewards。

## 数据

### `currency_catalog.json`

- 生成：`scripts/generate-currency-catalog.py`（`--check` 复核）；条目定义在 `config/currency-catalog.v1.json`。
- 7 项：
  - 付费星钻：productType 1
  - 免费星钻：productType 2
  - 金币（マニー）：productType 3
  - 体力（ST）：productType 5
  - 制作人经验值：productType 14
  - 记忆之星：item 11401
  - 记忆碎片：item 11402
- 每项包含：
  - 客户端图标，按 SHA-256 固定；
  - 按来源分组的奖励，活动来源逐个活动列出；
  - wiki 卡池页整理出的可用卡池、兑换卡池；
  - 客户端 UI 原文引用。
- 主要数字：
  - 免费星钻：2,110 条奖励，分 12 组；可用于 64 个卡池。
  - 付费星钻：78 个卡池。
  - 金币：31 条奖励。
  - 记忆之星：66 个兑换卡池。
  - 记忆碎片：由 62 个卡池转换而来。

### `costume_catalog.json`

- 生成：`scripts/generate-costume-catalog.py`。
- 共 690 个模型：
  - 660 个有客户端缩略图（`image/image_costume_icon/`，约 140px），不需要渲染 Spine；
  - 30 个没有缩略图，显示占位图标；
  - 598 个有名称；
  - 500 个有卡片关联。
- 名称为空格的 27 条按未命名处理，显示「未命名衣装」加模型编号。
- 卡片关联只算卡片自己的 Live/剧情五个槽，和卡片页 `CardDetailSemantics.js` 的规则一致；主页默认、主页特训两个槽是可复用的主页选择，不计入。因此 98 个只出现在主页槽的模型（例如基础常服）没有卡片关联。
- `idolCode` 取 StoryCostumes/LiveCostumes 行里的穿着者。苍井兄弟的剧情行互换了模型（012yus 穿 `013kys_004_00`，反之亦然），所以读模型只校验 idolCode 的格式，不要求它与模型前缀一致。

## 读模型

- 新增 `domains.currencies`、`domains.costumes`（packed + searchable）。
- 只有类型的奖励会带上对应货币的 `currencyKey`、图标和 `collection_catalog` 目标，在活动页显示为「免费星钻 · 货币」，有图标，点开是快捷查看。
- 候选：`rm-currency-costume-20261014`，release `c3d99382115805a25a997a5b10f9911b51fac2beb1830aa4254d0d717fa87c8e`，`verify_artifacts` 通过。
- 已在四个文件中绑定，见提交 `06fc9496`。

## 页面

- **货币详情：**
  - 「用途」：客户端/wiki 原文引用，以及可用卡池、可兑换卡池的折叠列表，可直接跳到卡池页；
  - 「卡池中的获得」；
  - 「已知获得来源」：按来源分组，活动来源可以展开到每个活动，并跳到活动页。
- **服装目录：** 可按偶像、组合筛选，分类为「Live 与剧情衣装 / 仅剧情衣装」。
- **服装详情：** 所属偶像链接，以及「穿着此衣装的卡片」，每张卡标出槽位（Live 普通、剧情特训…），可跳到卡片页。
- **翻译：** 新增 source-bound 的 `currency` kind（`translation/studio/general/currency-drafts.mjs`），由 `generate-archive-general-translations.mjs` 生成：
  - マニー → 金币
  - 有償スタージェム / スタージェム → 付费星钻 / 免费星钻
  - 两个记忆道具沿用道具的译文
  - 审计标签为「货币」

## 卡片与服装的交叉关联

- 卡片页「关联衣装」：每个款式（通常版 / 突破版（+））是一块可点击的条目，包含：
  - 64px 客户端衣装图标；缺图的 30 个模型显示衣装图标占位；
  - 款式名与槽位标签；
  - 箭头。
  点开进入 `/costumes/?entity=costume:<模型>`，带 `card=` 返回上下文。图标地址和服装目录一致，由 `CardDetailSemantics.costumeLink` 按模型编号生成。苍井兄弟互换的模型按模型本身关联。
- 服装详情「穿着此衣装的卡片」：卡面缩略图放大到 56px，间距加大，加上箭头；槽位行可换行。点卡片回到卡片页。
- 每个服装模型最多只关联 1 张卡片。
- 1280、1024、820、390 宽的 Chromium 测量中都没有元素越出面板。这次是加固排版，没有找到可以复现的溢出。
- 资料馆入口：手机端「资料馆」目录给货币、服装补上图标（Coins / Shirt），桌面侧栏同样适用。

## 正比图

客户端没有静态的正比衣装图。衣装相关的静态图片只有：
- `image_costume_icon`：Q 版小人衣装图标，服装目录和卡片页用的就是它；
- `livecharacter/atlas`：Live Q 版图集。

正比只有剧情 Spine：`/assets/spines/<模型>/comu.atlas` 和 `comu.skel`，690 个模型都有。要在服装页显示正比，有两种做法：
- 在详情里按需挂载 SpineStage 实时渲染：需要 WebGL 舞台和资源释放管理；
- 离线渲染每个模型的正比静帧，再上传 R2：需要用户授权上传。

尚未实施。

## 验证

- `readmodels` 测试 68/68。
- 通过：`verify-route-schema`、`verify-archive-path-locator`（新增 4 个短链接用例）、`verify-entity-head-shells`（12 个板块根）、`verify-archive-assets`、`verify-portal-navigation`、`verify-archive-general-texts`、`verify-portal-bento`、`generate-collection-browse --check`、`build:check`。
- `verify:source-batch` 130/133。失败的三项中：
  - `verify-archive-general-texts`：已修复，现在通过。
  - `verify-design-tokens`、`verify-card-costume-presentation`：本批开始前已失败，来自 `04782fb3` / `e35303be` / `7a08f8e1` 对 ArchiveCardDetail、ArchiveSongDetail、ArchiveSongLineupPlayer 的改动（新增十六进制色值，引入 ArchiveSourceLink 依赖）。本批未修复，见待办。
- 浏览器旅程 21/21：5177，候选 c3d99382，1280 与 390 宽，截图在 `.analysis/currency-costume-qa/`。覆盖：
  - 货币目录、图标和标题；
  - 免费星钻详情 → 活动页 → 活动奖励行（有图标和标签）→ 快捷查看 → 完整页；
  - 金币名称；
  - 记忆之星 → 卡池页；
  - 服装目录、缩略图、分类与偶像筛选；
  - 服装详情 → 卡片页；
  - 手机宽度无横向滚动；
  - 无页面错误。

## 未完成

- 新增缩略图（`image/image_costume_icon/`、货币图标）还没有上传到 R2。上传和部署都需要用户授权。
- 商店与兑换所的商品只能从 wiki 整理，下一步做；歌曲、任务、生日奖励同样从 wiki 补。PremiumPacks 只做记录。
- 30 个没有缩略图的服装模型以后可以考虑用 Spine 渲染。
- `verify-card-costume-presentation` 已修复：补上 ArchiveSourceLink 桩；契约改为「只有款式条目本身可以点，点开各自的服装」。
- `verify-design-tokens` 仍未通过：ArchiveCardDetail、ArchiveSongDetail 视频区的 `#000`/`#fff`，ArchiveSongLineupPlayer 的两个原始字号。修复需要新增媒体色 token。
