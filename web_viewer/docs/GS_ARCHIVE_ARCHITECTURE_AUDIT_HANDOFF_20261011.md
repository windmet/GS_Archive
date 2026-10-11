# GS Archive 架构审计核实与后续交接

日期：2026-10-11。输入：用户提供的《当前分支现行代码架构审计》全文；本地分支 `codex/portal-architecture-cleanup-20261004`，核实 HEAD `47d76acca1c16184c7f0a5f6c813191b9dc90d76`。

本轮只读源码、核对已有文档及路由账本，并新增本交接文档；没有修改实现、重启端口、构建、Browser 验收或部署。以下是结构性风险与建议方案，不能当作已复现的返回错误、播放故障或性能回归。行号均以输入 HEAD 为准，实施前重新定位符号。

## 1. 结论与优先级

审计的主要方向成立：最值得继续整理的是 Reader 跨域适配与路由上下文，而不是再拆一轮 Vue 文件。数据工程、ReadModel 与 Story Runtime 已有可复用边界。没有证据把本次结构债务列为 P0 线上故障。

| 优先级 | 工作包 | 具体收益 | 建议顺序 |
| --- | --- | --- | --- |
| P1 | Reader 返回策略与播放桥接 | 把多来源身份、返回选择、正文到演出的证明分开，降低新增故事来源的联动范围 | 第一批先做纯返回策略；之后分批迁移入口和桥接 |
| P1 | Route 内部模型分层与一致性检查 | 区分当前实体、来源上下文、播放请求，保护深链接和刷新 | Reader 第一批之后；先保留现有 URL 协议 |
| P2 | App 已确认的六项领域残留 | 将默认选择、资格规则、名称与集合计算交回领域 owner | 按独立规则逐项处理，可先做 Home 默认选择这一小项 |
| P2 | ReadModel 剩余迁移项清点 | 区分真正旧数据消费者、兼容入口和设备证据缺口，避免误删 | 先调查，不把“全部移除 legacy”当成单次任务 |
| P2 | Home 场景生命周期 | 收口预备语音、快速切换、阶段就绪与销毁，便于维护 | Reader/Route 边界稳定后；有实际竞态时上调 |
| P2 / P3 | Event / Card 详情投影补齐 | 减少组件内重复关系计算，保留聚合页的合理职责 | Event 剩余资源合并先评估；Card 次之 |
| P3 | StoryViewer 展示协调收口、Portal 视觉分区 | 降低维护成本，保持现有 Runtime owner | 无行为问题时不优先实施 |
| P3 | 发布绑定自动化 | 降低人工绑定漂移，保留现有发布门禁 | 常态化发布前可上调；不与导航重构混批 |

P1 表示下一轮架构工作优先处理，不表示必须阻断当前测试版本。每个工作包独立提交和验收，发生兼容问题可单独回退。

## 2. 对原审计的必要修正

| 原审计说法 | 当前源码核实 | 交接处理 |
| --- | --- | --- |
| Reader 约 44 项依赖 | `useReaderNavigation` 入参实际为 44 项，涉及状态、传输、导航、播放和来源数据 | 成立，但减少参数数目不是验收指标；禁止只是把 44 项装进一个大对象 |
| 需要建立 ReaderSession | 已有 `src/core/ReadingSession.js`，负责单文档加载和原子状态发布；另有 ChapterReadingSession | 新增的是跨域入口上下文，不能重复创建 repository/session 或替换现有加载 owner |
| `prepare` 意味着旧全量数据准备 | `App.vue:800` 的 `prepareArchivePage` 调用 `prepareArchiveRoute`；后者只并行等待组件与传入的数据 Promise | 不能按函数名判定 legacy 加载，要追到具体 loader 和实际请求 |
| ReadModel 仍有不少未迁移页面 | 39 项账本中，除 Player 的 entry 为 partial，其余 entry 均 migrated；仍存在 actions、stage data 和兼容回程未完成项 | 按账本逐项核实实际消费者，不扩大为所有目录仍依赖全量旧数据 |
| 工具页有三个并列工具，仍叫“舞台小人” | 当前 `ArchiveExperiments.vue` 已为 LIVE 卡片内“谱面 / 2D舞台”双入口，摄影工作台为独立卡片 | 信息架构图需更新；现状是入口分组，两边仍各自选曲，不等于共用一个 LIVE 播放会话 |
| Card/Event 尚需建立投影 | 已有 Card 数据合并与 `CardDetailSemantics`；Event 接收 `view` 投影，也有 `eventResourceGraph` | 只迁移剩余规则，不能再建一套平行数据层 |
| StoryViewer 需要 session | 已注入 `PlayerSession`，已有 playback controller、Voice、Cue、Snapshot 等边界 | 先定位仍在 Viewer 内的展示协调，不新建第二个播放 session owner |

已有 [10 月 8 日 App 职责审计](GS_ARCHIVE_APP_ORCHESTRATION_AUDIT_20261008.md) 明确允许路由事务、跨域调度、来源恢复和根生命周期留在 App。本轮没有推翻这个边界。原审计中“移走手动 reset / dispatch”的建议需要逐项举证，不能直接作为整体搬迁授权。

## 3. P1：Reader 的可执行拆分方案

### 现有位置与问题

| 位置 | 当前职责 / 依赖 |
| --- | --- |
| [useReaderNavigation.js](../src/composables/useReaderNavigation.js):16–28 | 44 项注入；App 装配点为 [App.vue](../src/App.vue):1403 |
| 同文件 :47–90 | reading locator shard 读取、目录选择、单文档及章节 session 创建 |
| :98–166、:210–233 | collection / event / idol story / seasonal / work 入口、章节切换、row 定位 |
| :168–208 | `closeStoryReader` 的 legacy event / work / seasonal / event / collection 返回分支；Player 返回 Reader 的字段恢复 |
| :235–291、:304–325 | 演出 target、版本与范围证明、选集成员关系、语言偏好、continuation source |
| :327–400 | `applyReaderRoute` 同时发布来源 refs、切换页面、决定章节 plan、加载正文、恢复 Player |
| [ReadingSession.js](../src/core/ReadingSession.js):3、[ChapterReadingPlan.js](../src/core/ChapterReadingPlan.js) | 已有加载与章节 plan owner，必须复用 |

主要风险是入口语义被多个 refs 隐式表示，新增来源时容易遗漏返回、语言继承、章节导航或 Player 恢复的一环。当前代码已有 intent、revision、range 检查，抽取不能削弱这些证明。

### 拟议边界

以下模块名是建议，尚未创建：

1. `ReaderReturnPolicy`：纯函数接收当前 Reader 来源快照，返回恢复来源、应用目标路由或回目录的决策。由原调用层执行 `restoreDetailSource` / `applyArchiveRoute` / history。优先完整保留现有分支顺序，尤其 legacy event URL 的差异。
2. `ReaderEntryContext`：各来源 adapter 产出有判别字段的入口描述，例如 `{ source: { kind, identity }, documentId, returnRoute, scope, chapterContext }`。入口描述不携带几十个 Vue ref；已保存语言与共享链接语言的优先级显式写入合同。
3. `ReaderPlaybackBridge`：接收文档、locator、entry context 和 intent，验证 revision、source file、row、范围及目录成员，再交给现有 playback controller。只能依赖窄接口；不能取得所有 App 状态。
4. `useReaderNavigation` 留为 feature 编排层：连接上述策略与已有 ReadingRepository、ReadingSession、ChapterReadingSession，统一发布结果。

这里的“Reader 会话上下文”是导航描述，不是替代 `createReadingSession` 的新加载器。单文档正文、章节正文、Player 媒体分别保留既有 owner；可选章节目录失败仍不能阻断可读正文。

### 最小交付批次

- R0：固定现有行为矩阵，复用 `scripts/lib/reader-navigation-harness.mjs`。先检查现有用例，再补未覆盖的返回组合，避免重新搭 mock 系统。
- R1：仅抽 `closeStoryReader` 的目标选择；旧入口、字段、history 顺序全部保持。完成后可停止，不要求同步拆播放桥接。
- R2：依次将 work / seasonal / event / collection / idol story 入口转成明确上下文；保留旧 ref 适配，逐个移除不用的注入。
- R3：抽桥接的身份与范围证明，再迁移 bridge 的异步调用；重构不得允许非相邻 continuation 或伪造选集范围。

完成标准：来源规则可脱离 App 测试；App 只装配；旧 URL 可刷新恢复；快速切章/离开时旧请求不能覆盖新页面；正文定位、返回位置、语言、选集范围均不变。参数数目和文件行数不作为成功证据。

## 4. P1：Route 分层，先保持 URL 兼容

定位：[archiveRoute.js](../src/core/archiveRoute.js):1–175 定义 query keys、views、contracts 和导航；:177–270 处理来源白名单、Portal/Home 回程、source frames；:287 起规范化；:459 起面包屑；:599 起读取；:664 起编码。source frames 当前已有深度 16、长度 8192 和旧嵌套来源兼容，不是无约束的历史栈。

App 的另两处表达为 :733 的异步组件 loader 表、:1741 的路由事务及 :2529 起的恢复准备链；[routes.json](../readmodels/contracts/routes.json) 还记录迁移状态与证据。**迁移账本不是运行时 router**，不应为了“单一 registry”将其全部导入浏览器。

建议步骤：

1. 定义内部 `CanonicalRoute` / `NavigationContext` / `PlaybackEntry` 的字段职责表，先以现有 normalized route 为兼容外观。Player 已有 [PlayerEntryRequest.js](../src/core/PlayerEntryRequest.js)，优先扩展其合同。
2. 将来源 query 编解码独立为纯模块，外部继续通过 `archiveRoute.js` 导出；逐步消除 feature 直接拆解 query 的需要。保留当前长度、深度、禁止视图和旧 URL 规则。
3. 增加一致性验证：VALID_VIEWS、路由 contracts、loader 表、template 挂载及账本的差异必须被明确解释。通过后再决定是否抽轻量运行时 registry；不生成庞大的 feature 总工厂。
4. 最后才评估哪些短暂上下文适合 history.state。先定义刷新、新标签、分享、浏览器前进后退的恢复规则，不能直接删除 `from` / `via` / `parent` / `return`。

返回来源是用户可见行为的一部分。禁止在 Reader 重构同批更换 URL 格式、删旧链接支持或改变来源优先级。

## 5. P2：App 的六项残留，按当前行号复核

| 规则 | 当前位置 | 建议 owner / 最小验收 |
| --- | --- | --- |
| 偶像卡片计数、搜索、组合筛选 | `App.vue:1137–1179` | 偶像/卡片目录 selector 或投影；对照成员范围、无卡偶像、数量、组合与译名搜索 |
| legacy story collection 身份与视觉回退 | `App.vue:1260–1305` | Story 身份/展示 helper；保留编号映射、资源路径、生日视觉优先级 |
| 偶像名称归一化、反向查找、语言回退 | `App.vue:1566–1615` | 现有名称 presentation / 翻译 repository adapter；保留 locale revision 失效 |
| Home cue/costume 默认选择 | `App.vue:1873–1882` 的 `requestedHomeIdol` 及后续选择 | Home selection resolver；请求→cue 对应服装→首件优先级以及缺失参数恢复 |
| Stage candidate 资格 | `App.vue:2398` | Song/Stage helper；保留 choreography_candidate / special_single 白名单 |
| Event Player queue 成员资格 | `App.vue:2471` | Event queue selector；保留 exists、file、顺序与范围规则 |

每次只处理一项。`commitView`、`applyArchiveRoute` 的 intent 检查、事务发布顺序、全局 popstate/unmount、来源恢复不为减少体积迁移。状态清理如需改变，先记录“哪个状态属于谁、何时释放”，再验证对应行为。

## 6. P2：ReadModel 尾项必须先分清类型

当前账本的未完成范围：

- `player`：entry/data/actions/player 都为 partial，记录的剩余原因是 returnView 白名单还有未覆盖目标。优先检查 [useStoryPlaybackController.js](../src/core/useStoryPlaybackController.js):12–13、:192、:292 和 App 的 `loadPlayerQueue`，建立返回目标清单。
- `chibi_stage`：data/actions 为 partial，choreography 和 timeline manifest 仍为 feature-local 来源；`ChibiStageViewer.vue:1013–1025` 可见 timeline、manifest、choreography 的真实加载。先统计首开与选曲请求，再判断是否需要 bounded descriptor / 按曲目分片。舞台专用 timeline 不因位于旧路径就必须改成 ReadModel。
- `spine_lab`：actions 为 partial，因多人舞台入口仍有未迁移数据路径；这是维护域，不应优先于普通 Reader 用户旅程。
- `portal` / `home` / `song_detail`：actions 为 partial，分别涉及未迁移返回目标、兼容 helper、进入舞台后才加载的 timeline。不要把懒加载自身判为缺陷。
- 账本的 device/parity 证据需另行检查；代码 migrated 不自动等于设备验收完成。

处理流程：对每个尾项列出入口→loader→请求→返回目标→证据缺口；分为“代码迁移”“保留的专用资源”“兼容删除待审”“仅验收待补”。确认消费者为零后再删 fallback。README 的“full route cutover 未完成”是总状态，不能代替具体源码调查。

## 7. P2/P3：Home、Player、Card/Event 的已有边界与方案

### Home

[ArchiveImmersiveHome.vue](../src/components/archive/ArchiveImmersiveHome.vue):433 起有 queuedVoiceAbort / stageTapAbort；:540 使用 `useVoicePlayer`；:578 使用 `useStoryRuntimeCues`；:695–750 为触摸与下一句预备语音；:752 为 stopVoice；:811 起处理模式切换，卸载附近释放 pending/prepared voice 并 dispose。

因此“Home 又复制了一套底层 Voice/Cue”没有成立：共享 adapter 已在使用。仍值得抽取的是这些调用的场景会话协调。建议 `useHomeSceneSession` 持有 tap/preload ownership、stage readiness、取消/释放、选句命令；UI 保留设置焦点、目录面板、背景筛选等交互。先让 active idol/cue/costume 的唯一状态来源明确，不能同时在 App 和新 session 各存一份。

快速切偶像、切服装、Spine/Card 模式、连点舞台、自动语音开关、兼容重试、离开页面必须验收；已有首页 cue 去重留在数据生产 owner，不移动到场景 session。Home 不继承 Story 的章节/快照/选项语义。

### StoryViewer

实际文件为 [src/core/StoryViewer.vue](../src/core/StoryViewer.vue)。:326 已使用 `usePlayerSession`；:532–608 为 freeze/frame hold；:671 使用 StoryNavigation；:712–780 为快照/已读/回看关联；:985 起接 Cue 与 pause；:1249 卸载；:1314 加载 scenario。

建议仅从明确的展示协调块开始，如 immersive viewport / overlay focus；frame hold、snapshot restore 和导航状态要先画时序再动。不重写 StoryClock / StoryAudioSession / SpineCueRuntime，也不建立通用 VN 框架。现有 runtime ownership 比“Viewer 文件很长”更重要。

### Card / Event

- [ArchiveCardDetail.vue](../src/components/archive/ArchiveCardDetail.vue):316 已使用 [CardDetailSemantics.js](../src/presentation/CardDetailSemantics.js)；:440 为突破材料显示补齐；:513–568 为关系项归类与打开。`readmodels/lib/checkout_adapter.mjs:98` 已合并卡片基础与详情。先区分语言/图框等显示计算和真正关系推导，仅将后者前移；不把选择图框、lightbox、语种显示固化到生成数据。
- [ArchiveEventDetail.vue](../src/components/archive/ArchiveEventDetail.vue):203 建 readingByFile；:220–222 根据 identity 查 `eventResources`，合并 rewards / hero；:230–243 建报酬索引及 derived-only cards。这些是优先检查的重复合并点。若同规则被多个消费者使用，补入 Event detail projection 或纯 selector；单组件显示索引不必全部生成。
- provenance / Wiki 补录只沿已有 `eventResourceGraph` 和原来源证据处理；不能为了让 Vue 简单而猜关系或丢弃来源。投影形状改变必须同步版本、生成器、校验与消费者，不能只改组件。

Portal 的 [useArchivePortalData.js](../src/components/archive/useArchivePortalData.js):5 明确不拥有 catalogue filters 或 player detail，并独立持有 Abort/revision。维持该边界；按视觉区块拆分仅列 P3。

## 8. P3：发布绑定自动化的具体范围

现有门禁已经能发现多处不一致：[archive-build-audit.mjs](../scripts/lib/archive-build-audit.mjs):67 检查 routes 与 bootstrap release；[prepare-readmodel-preview.mjs](../scripts/prepare-readmodel-preview.mjs):19–30 检查 committed source、candidate、inline bootstrap；[assemble_pages.mjs](../readmodels/tools/assemble_pages.mjs):19–20 额外要求完整 cutover/device 证明。不能写成“当前没有绑定校验”。

建议新增 release descriptor 及 `bind-release --check / --write`（拟议，当前无此工具）：输入 verified model release、source commit、dataRevision、mediaEpoch 和 artifact receipts；先输出差异与缺项，再在本地统一更新确有必要的绑定文件并执行一致性校验。实现前先清点全部读写消费者，不能假定审计列出的 facets/config 每项都需要手动同步。

“原子”仅限本地描述与绑定的一致性，Cloudflare Pages 与 R2 仍是不同发布动作。descriptor 不授予部署许可、不上传资源、不把 preview 当 production acceptance；原有 hash / HTTP / Browser / device 证据继续保留。此任务不与 Reader/Route 混合提交。

## 9. 实施后的验收与交付合同

下面是后续实施要运行的验证，**本次文档工作没有运行这些应用回归，也没有继承旧版本通过结果**。

| 工作包 | 现有验证入口（按实际变更选用） | Browser 必须覆盖 |
| --- | --- | --- |
| Reader | `node scripts/verify-reader-navigation.mjs`；`node scripts/verify-reader-navigation.mjs --local-sources`；`node scripts/verify-reading-playback.mjs`；`node scripts/verify-reader-loading.mjs` | event / work / seasonal / collection / idol story 各入口→Reader→Player→Reader→来源；共享定位、刷新、前进后退、快速切换 |
| Route / App | `npm run verify:routes`；`node scripts/verify-archive-route-preparation.mjs`；`node scripts/verify-readmodel-ownership.mjs`；`npm run verify:portal-navigation` | 偶像→卡→活动→Reader→Player 逐层返回；Portal/Home 回程；直接 Player 链接不得强制 hydrate 返回页 |
| Home | `node scripts/verify-home-navigation.mjs`；`npm run verify:home`；`npm run verify:story-audio` | 上节所有切换与取消；离开后无残留播放，重新进入可播放；卡面与 Spine 两模式 |
| Card / Event | `node scripts/verify-card-readmodel-navigation.mjs`；`node scripts/verify-event-readmodel-navigation.mjs`；`npm run verify:card-semantic-dictionaries` | 无关系统计/缺素材/复刻活动、报酬与推导卡区分、语种切换、来源说明与关联跳转 |
| Player 展示 | `node scripts/verify-player-session.mjs`；`npm run verify:story-runtime-foundation`；`npm run verify:story-audio`；按改动运行对应 UI/暂停/快照验证 | ADV/Phone/Chat、backlog、overlay pause、auto/skip、返回、换集及恢复 |

涉及前端代码时按 [BUILD_ACCEPTANCE_POLICY.md](BUILD_ACCEPTANCE_POLICY.md) 使用 `npm run build:check`；不复制 public 全库。ReadModel 形状变更另运行对应 `readmodels/tests` 与 artifact 校验，并记录 candidate/release 身份。Browser 用可用的 Browser 插件覆盖桌面与手机视口，记录确切 HEAD、端口进程、模型版本和实际走过的旅程；手机视口不等于真机验收。首次接手需确认在用服务归属，不重启别的窗口服务。

每批交付记录：输入/输出 commit、明确改动边界、验证命令与结果、Browser 旅程/未覆盖项、旧 URL 兼容、是否涉及模型/媒体/部署；显式 stage，commit/push。发布与 R2 资源操作另按用户授权处理，不能由重构方案推导。

## 10. 推荐给下一位实施者的第一单

**仅实现 ReaderReturnPolicy，保持全部可见行为和 URL 不变。**先读 `closeStoryReader`、现有 reader harness 及 App 的 `restoreDetailSource`；建立新旧 event 来源、work mode、seasonal participant、collection/detail 缺失上下文的决策用例；抽纯决策函数，保留异步执行和 revision 检查。完成相关回归、build:check 和 Browser 返回旅程后提交这一批，再决定是否进入 ReaderEntryContext。

暂不同时改 route codec、StoryViewer、Home session、投影生成器或发布工具。北斗贴图、首页 cue 去重及 LIVE/2D舞台修复属于已经完成的独立测试反馈批次，见 [反馈交接](GS_ARCHIVE_TEST_FEEDBACK_HANDOFF_20261011.md) 与 [发布验收](GS_ARCHIVE_TEST_FEEDBACK_RELEASE_20261011.md)；本架构文档不重开这些问题，也不替代后续重构验收。

## 11. 本文档交付检查

已对照输入 HEAD 阅读上述关键函数、既有 App 审计、路由账本、发布门禁及验证脚本入口；确认 Reader 44 项入参、账本 39 项、现行 LIVE 分组。全部 Markdown 相对链接目标存在；新增文件纳入暂存后执行 `git diff --cached --check`。本批仅交付文档，按构建政策不执行应用构建或 Browser 验收。工作区原有未跟踪文件全部保留。
