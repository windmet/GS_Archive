# Masterdata 驱动的 UI 与交互重构方针 - 2026-07-10

## 结论

现在可以开始整体 UI 架构重构。目标应定义为“保留原游戏主界面体验的 SideM 资料馆”，而不是单一的后台式资料目录，也不是立即复刻完整游戏系统。

现有 masterdata 已经足以驱动故事、卡片、偶像、组合、服装、背景、音乐、首页互动、短 ADV、生日与季节通讯的身份、分组、标题和资源关联。编译后的 scenario/raw 仍然负责单个剧情内部的镜头、角色、对白、音频和时间轴。两者不能互相替代。

推荐采用双层界面：第一层是原游戏式的沉浸首页，承担角色、背景、首页互动和主要入口；第二层是资料馆目录，承担大量故事、偶像、卡片与资源的搜索和筛选。播放器继续作为第三个独立边界。播放器内部暂时只做回归修复，不与 UI 重构同时大改。

## 2026-07-13 原游戏主界面参考后的修订

用户补充的原游戏主界面表明，首页差异不是可以最后统一替换的“皮肤”，而是交互骨架差异：

- 原游戏首页以全屏背景和中央角色为第一视觉层，角色不是目录封面或卡片缩略图。
- 顶部承担状态与全局工具，底部承担高频模式入口；故事只是主入口之一。
- 首页对白、左右切换和角色互动属于舞台体验，不能被常驻侧栏和大面积列表替代。
- 故事、卡片等大量内容进入下一层后，才适合使用搜索、筛选、列表与详情检查器。

因此不采用“先做完整资料馆首页，之后再换成游戏皮肤”的路线。这样会重复改动首页布局、导航状态、移动端结构和资源生命周期。当前即确定以下双层结构：

1. `GameHomeStage`：全屏背景、角色舞台、简短互动、顶部工具和底部主导航。
2. `ArchiveShell`：故事、偶像、卡片、互动记录等二级目录的密集浏览壳层。
3. `StoryViewer`：独立播放器，保持现有 scenario 驱动和回归边界。

已经创建但尚未接入的 `ArchiveShell.vue` 保留，定位改为二级资料目录，不作为应用首页。此前生成的侧栏视觉方案也只作为桌面资料目录参考。

### 原游戏入口在归档版中的映射

| 原游戏区域 | 归档版第一阶段处理 |
| --- | --- |
| 中央角色与背景 | 使用本地 Spine、背景目录和已确认的首页互动数据实现 |
| Story | 进入故事资料目录 |
| Growing | 进入偶像/组合资料目录 |
| Work | 进入工作、短 ADV 与相关剧情目录 |
| Gasha | 不模拟抽卡；可在后续映射为卡片档案入口，并明确标注为 Archive |
| Live | 当前没有完整玩法数据，不伪造可玩的 Live 系统 |
| ST、货币、礼物、信箱 | 当前没有账号状态来源，不显示虚构数值；后续有权威数据再接入 |
| Menu | 打开资料域、设置、调试入口等全局菜单 |

视觉上保留原作的圆润功能按钮、白底高对比、绿色/青色功能区分和全屏角色舞台，但不直接照搬已经失去语义的运营按钮或账号数值。

## 范围决策与成本估算

以下估算以当前工作树为起点，按一名开发者持续完成数据整理、界面实现、桌面/移动端回归和文档计算。由于 raw/masterdata 字段解释和素材完整度仍有不确定性，整体误差按约 ±40% 预留。

| 方案 | 范围 | 当前剩余成本 | 主要风险 |
| --- | --- | ---: | --- |
| A：纯资料库 | 故事、偶像、卡片、语音、搜索、详情和播放器 | 12–20 个工作日 | 原作首页体验较弱 |
| B：游戏式首页 + 资料库 | 首页舞台与原作风格导航，二级页面使用资料库结构；不复刻经济和玩法系统 | 25–40 个工作日 | 需要协调舞台性能与目录信息密度 |
| C：完整游戏界面复刻 | 首页、育成、工作、抽卡、Live、信箱、礼物与菜单等界面 | 60–100 个工作日 | 很多页面可能只有外观而没有权威逻辑 |
| C+：完整可运行系统 | 再加入账号、体力、货币、成长、掉落、抽卡和 Live 玩法 | 150–300+ 个工作日 | 数据和规则可能不足，且需要持久化后端 |

在用户确认 A/B/C 前，不继续扩大首页或资料目录视觉范围。当前 `GameHomeStage` 只视为 B 方案的方向性原型，必须通过构建和浏览器验证后才能算作可保留实现。

## 2026-07-10 实施进度

P1 基础层已经开始落地：

- 新增 `src/data/ArchiveDataRepository.js`，统一并行加载、缓存、响应类型检查和基础结构校验。
- 新增 `src/data/archiveSelectors.js`，集中建立故事文件关联、卡片 map、角色卡片列表和稀有度统计。
- selector 会按 `resource_id`、cue 和 scenario resource 去重。浏览器验证中，冬马卡片从原始的 21 行修正为 19 个唯一资源，`001tom_ssr02` 首页语音从重复的 8 行修正为 4 个唯一 cue。
- 新增 `src/core/archiveRoute.js`，URL 可表达 `view/category/idol/group/unit/episode/card/rarity/q/scenario/voice/return`。
- 现有页面现在支持刷新恢复、浏览器前进/后退、筛选深链接、故事目录深链接、旧 scenario 深链接和卡片语音预览深链接。
- `startStep`、`noVoice` 等播放器调试参数会在资料馆路由更新时保留。
- 源码 smoke 构建通过；桌面与 390px 移动端浏览器回归通过。
- 已提取 `ArchiveHome.vue`、`ArchiveListHeader.vue`、`ArchiveCardList.vue` 和 `ArchiveCardDetail.vue`。
- 卡片图片 URL 与 fallback 已移入 `CardAssetResolver.js` 和卡片组件；`App.vue` 不再负责卡片展示细节。
- `App.vue` 从约 1509 行降至 1156 行。首页、卡片列表、卡片详情与移动端布局保持视觉等价。
- 第二轮目录拆分已完成：`ArchiveIdolGrid.vue`、`ArchiveGroupList.vue`、`ArchiveFileList.vue`、`ArchiveUnitGrid.vue` 和 `ArchiveEpisodeList.vue` 已接管偶像、故事和第零话目录。
- `App.vue` 进一步降至约 939 行；剩余主要内容是领域查询、路由恢复、scenario 加载/预览和 `showAnims` debug helper。
- 偶像目录、主线 group/file、第零话 unit/episode、文件选择进入播放器及刷新恢复均已通过浏览器回归。

视觉等价拆分阶段已经完成。下一边界不再是继续拆小组件，而是先建立 `GameHomeStage`，再把 `ArchiveShell` 接到故事、偶像、卡片等二级页面。现有 archive 页面组件作为资料目录内容区使用；暂不移动 `StoryViewer`、剧情预加载或舞台状态。

## 当前基础

### 已经可以信任的数据

`public/data/masterdata/` 当前包含：

- `story_master_index.json`
- `card_index.json`
- `idol_unit_dictionary.json`
- `costume_dictionary.json`
- `speaker_dictionary.json`
- `background_catalog.json`
- `music_catalog.json`
- `home_interaction_index.json`
- `short_adv_profile_index.json`
- `seasonal_communication_index.json`

当前验证报告中，主线、活动、组合、个人、卡片、工作、生日和额外剧情到 compiled scenario 的覆盖率均为 100%；卡片语音和首页语音预览覆盖率也是 100%。这已经足以支撑稳定的资料浏览、搜索、筛选、详情页和播放器入口。

### 当前前端的主要约束

- `src/App.vue` 约 1500 行，同时承担首页、分类、角色、故事、卡片、资源 URL、预加载和播放器跳转。
- 导航主要依赖组件内的 `view` 和多个 `current*` ref，浏览器历史、深链接和刷新恢复能力有限。
- masterdata 的加载、归一化和页面展示逻辑混在 `App.vue` 中，不利于后续增加新资料域。
- `StoryViewer.vue` 与舞台层已有相对清晰边界，应作为稳定播放器保留。
- 部分新增 masterdata 索引仍需浏览器可见文本抽样；出现 `銆` 等字符的字段不能直接作为正式 UI 文案。
- `home_interaction_index` 中存在 masterdata 有记录但 compiled 资源尚未落地的条目。UI 必须显示可用性，不能默认所有记录都可播放。

## 数据职责边界

| 问题 | 权威来源 | UI 用途 |
| --- | --- | --- |
| 这是谁、属于哪个组合 | masterdata 字典 | 导航、筛选、标题、头像 |
| 这是哪张卡、哪一话 | masterdata 索引 | 卡片/故事列表与详情 |
| 资源是否真的可播放 | compiled index + 本地资源清单 | 启用/禁用播放入口 |
| 当前剧情怎样演出 | compiled scenario | 播放器 step 状态 |
| 镜头、角色位置、淡入淡出 | raw + compiled scenario | 舞台渲染与排错 |
| 页面怎样组织和返回 | 前端路由/交互模型 | UI 导航与历史恢复 |

核心规则：masterdata 决定语义，compiled 决定可播放内容和演出，前端只负责组织与呈现。

## 推荐目标架构

```text
App.vue
  -> GameHomeStage
      -> background + Spine + confirmed home interaction
      -> primary navigation
  -> ArchiveShell
      -> StoryCatalog
      -> IdolCatalog
      -> CardCatalog
      -> InteractionCatalog
      -> MediaCatalog
  -> StoryViewer (保持独立)
  -> route state / browser history
  -> MasterdataRepository

MasterdataRepository
  -> fetch public/data/masterdata/*.json
  -> normalize domain models
  -> join compiled availability
  -> expose loading/error/cache state
```

建议模块边界：

- `src/data/MasterdataRepository.js`：加载、缓存和基础校验。
- `src/data/archiveSelectors.js`：故事、角色、卡片、互动的关联与筛选。
- `src/core/useArchiveNavigation.js`：URL、返回栈和刷新恢复。
- `src/components/home/GameHomeStage.vue`：原游戏式首页舞台、主导航和首页互动。
- `src/components/archive/ArchiveShell.vue`：二级资料目录导航、内容区和播放器入口。
- `src/components/archive/StoryCatalog.vue`：主线/活动/组合/个人/生日分类。
- `src/components/archive/CardCatalog.vue`：卡片筛选、详情和语音入口。
- `src/components/archive/InteractionCatalog.vue`：首页、短 ADV、季节通讯。

不要求一次性创建全部文件。先建立数据层和路由契约，再拆页面。

## 值得立即做的工作

### P0：稳定数据与播放器边界

- 保留 `1_4_001_01` 等回归样本，继续覆盖前进、后退、自动过渡和角色清理。
- 给每个公开 masterdata 索引增加轻量 schema/字段校验。
- 把 `compiled_exists`、图片存在、音频存在统一为可用性状态。
- 对正式显示字段做浏览器抽样，区分日文原文、显示编码问题和真实 mojibake。

### P1：重构导航骨架

- 将 `App.vue` 的数据加载和查询逻辑移入 repository/selectors。
- 用 URL 表达页面状态，例如分类、偶像、卡片、故事和播放器资源 id。
- 支持刷新恢复、浏览器前进后退、可分享深链接。
- 保持现有视觉和播放器行为不变，先完成结构迁移。

### P2：建立原游戏式首页与资料馆 UI

- 首页使用全屏背景与角色舞台，底部提供与归档能力对应的主入口。
- 不在首页展示没有权威状态来源的 ST、货币、礼物或运营通知。
- 故事页采用“分类侧栏/标签 + 可搜索列表 + 详情摘要”。
- 偶像页统一角色、组合、卡片、个人故事和互动入口。
- 卡片页保留稀有度、觉醒前后、语音和关联剧情，并增加稳定 URL。
- 明确展示“可播放”“仅有 masterdata”“缺少本地资源”等状态。

### P3：首页与互动逻辑原型

- 使用 `home_interaction_index`、`short_adv_profile_index` 和时间段字段建立只读互动浏览器。
- 第一版让用户主动选择偶像、时间段和互动条目，不模拟随机概率或账号进度。
- masterdata 找到资源且 compiled 存在时进入播放器；否则保留资料条目并标记缺失。
- 等资源和字段语义稳定后，再考虑基于时间段的自动推荐或随机轮播。

## 暂时不要做的工作

- 不从 masterdata 猜镜头、动作、表情或对白时间轴。
- 不立即复刻体力、任务、抽卡、货币、解锁进度等账号系统。
- 不把 `compiled_exists: false` 的条目伪装成可播放。
- 不在 UI 重构期间同时重写 Spine 动作、neck 或 cameraflare。
- 不把所有 masterdata 原始字段直接暴露给组件；先形成稳定领域模型。
- 不在现有 `App.vue` 内继续添加大块新页面。

## 第一阶段实施顺序

1. 建立 `MasterdataRepository` 和统一可用性模型，保持现有页面输出不变。
2. 建立 URL 导航模型，将现有 home/files/cards/player 状态逐个迁移。
3. 建立 `GameHomeStage`，接入真实背景、角色和可用主入口，不模拟账号系统。
4. 将 `ArchiveShell` 接为故事、偶像、卡片等二级目录壳层。
5. 完成桌面和移动端的首页与资料目录 UI 第一版，并接入已确认且可播放的首页互动。
6. 通过回归样本后，再决定是否继续扩展音乐、背景、服装和季节通讯页面。

## 第一阶段完成门槛

- 刷新任意故事、卡片或偶像详情 URL 后能恢复同一页面。
- 浏览器前进/后退不丢失筛选条件和播放器返回位置。
- 故事与卡片现有功能无回归。
- 页面组件不直接读取 masterdata 的数字字段名。
- 所有播放按钮都经过统一可用性判断。
- masterdata 文本异常不会直接污染正式 UI。
- `App.vue` 不再承担目录查询、资源拼接和所有页面渲染。
- `npm run build` 与核心浏览器回归通过。

## 当前决策

2026-07-13 用户正式选择方案 A，并指定 [Sekai Viewer](https://sekai.best/) / [Sekai-World/sekai-viewer](https://github.com/Sekai-World/sekai-viewer) 作为资料产品方向参考。后续不继续游戏式首页，也不复刻账号和玩法系统。

当前路线改为：`ArchiveShell` 成为首页与所有资料页的全局外壳；故事、偶像、卡片、通讯和资源按资料域组织；`StoryViewer` 与 `SpineViewer` 保持独立全屏工具。具体对照和实施顺序见 `SEKAI_VIEWER_DIRECTION_GUIDANCE_20260713.md`。masterdata 新发现继续进入 repository/selectors；播放器、neck 和 cameraflare 保持现状。
