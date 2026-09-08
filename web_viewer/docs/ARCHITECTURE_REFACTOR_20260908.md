# SideM_Archived 全仓结构评估与重构入口

日期：2026-09-08。状态：结构与关键链路审阅完成，第一批资源服务重构完成；
整体迁移尚未完成。外部《仓库阶段与可维护性评估》仅作问题线索，以下以本地代码为依据。
本次覆盖目录边界、tracked source、主要生产链路和验证入口；不声称逐条审阅全部
RAW、每篇剧情或所有历史 note，也不把结构审阅称为真实媒体验收。

## 1. 工作区与数据边界

- 初始工作区干净，位于 `codex/story-p2b-soak-preflight@da10858`。
- `git fetch origin` 后确认 `origin/master@58098c2` 仅多一个 PR #42 merge，
  两者文件树相同。重构分支 `codex/archive-architecture-refactor` 从该 master 创建。
- 根目录是 `SideM_Archived`，`web_viewer` 只是其中的消费者工程。
- `web_viewer-community-action` 是注册 worktree（分支
  `codex/story-community-action-p1@925055a`），工作区干净；不是待删除的副本。
  另有两个位于 Codex 目录的 detached worktree，本次均未修改。
- `RAW/asset`、`RAW/audio`、`RAW/movie` 是 ignored 物理证据；本次只核对目录身份。
  `voice_test`、根目录临时文件、ignored guided-fix 源码及历史备份不是产品源码。
- `public/assets`、本地 compiled 全集、`dist`、`.analysis` 与 Git tracked 文件是不同集合。
  不因某路径 ignored 就判断其无消费者或可删除。

在起点 `58098c2`，Git 列表包含：data_pipeline 39 文件、src 148、scripts 134、
schemas 19、public/data 279、notes 127、tools 11。它们是各目录 tracked 文件数，
不是功能数或全量本地媒体数。baseline source-only verifier 重算通过：
10,329 compiled JSON artifacts、183 tracked PNG；其余历史覆盖数字仍以
`notes/03_audit/CURRENT_ARCHIVE_BASELINE.md` 的证据等级为准，本次未重跑全库 RAW 审计。

## 2. 当前系统如何工作

| 层 | 当前入口/owner | 输出与消费者 | 主要维护问题 |
| --- | --- | --- | --- |
| 物理来源与配置 | `data_pipeline/archive_paths.py`、`scripts/lib/archive-sources.mjs` | RAW、masterdata、legacy、candidate/publish 路径 | 新配置与旧脚本硬编码并存 |
| masterdata 解码与域推导 | `data_pipeline/masterdata_extract.py` | `public/data/masterdata` 中字典与索引 | wire parser、表扫描、各实体 builder、CLI 同文件 |
| 剧情编译 | `scenario_compiler.py` → `authoritative_scenario.py` | compatibility steps 或严格 v2 artifact | 命令解释、累计状态、文本证据、timeline、口型定位集中 |
| 候选/发布 | `scripts/lib/authoritative-collection-*`、`raw-story-promotion.mjs`、`publication-ledger.mjs` | candidate、校验、发布、rollback、append-only ledger | 不能用普通批量重编译绕过 provenance |
| 门户数据访问 | `src/data/ArchiveDataRepository.js`、`archiveDataContracts.js` | 按 key fetch/cache 与独立契约检查，供 App/selector 使用 | F1 已分离请求/契约并移出三类固定数量；其他产品仍待更完整深层契约 |
| 门户域模型 | `archiveSelectors.js`、`storyCollections.js`、`idolCommunicationSelectors.js` 等 | 卡牌、剧情、角色与集合页面模型 | story selector 仍解释数字字段 |
| 导航与组合 | `src/App.vue`、`src/core/archiveRoute.js` | query URL、页面、返回/父级上下文 | root 持有实体、过滤、加载、播放器队列和导航状态 |
| 剧情调度 | `StoryViewer.vue`、`useStoryRuntimeCues.js`、`StoryClock.js`、`SceneSnapshotStore.js` | entry/settled 状态、cue、历史和播放模式 | legacy 兼容与正式调度同处产品路径 |
| 画面执行 | `SpineStage.vue`、`PixiStageManager.js` 及各 manager | Pixi/Spine、背景、镜头与屏幕 | Vue 异步舞台同步体量大，owner 迁移需行为证据 |
| 音频执行 | `StoryAudioSession.js`、`AudioManager.js`、`useVoicePlayer.js` | 共享音频生命周期和声音 source | 已有统一 owner，应保留并验证取消/恢复行为 |
| 本地 HTTP | `vite.config.js`、`server.js` | 静态产品资源；Vite 另有候选调试挂载 | 第一批已统一外部资源解析策略 |
| 本地化 | `src/localization/story/*` | 文本身份、翻译 overlay、降级显示 | 新 reading consumer 必须复用文本 identity，不能重新编号 |
| 契约与证据 | `schemas/`、`policies/`、`scripts/verify-*`、CI | schema/source/mounted/publication/soak 证据 | source gate 不等于浏览器或实音长稳 |

这是一套离线编译与静态消费系统，HTTP 服务主要是文件适配器。最需要解耦的
是领域语义和产物消费者，不能通过换 Web 框架解决。

## 3. 已确认的具体问题，以及尚不能下的结论

起点文件体量（行数 / 字节）：App 2,986 / 113,824；PixiStageManager
2,138 / 78,434；StoryViewer 1,123 / 45,949；SpineStage 1,369 / 45,628；
archiveRoute 496 / 20,397；masterdata_extract 3,767 / 160,307；
scenario_compiler 2,283 / 101,555。体量用于定位责任集中处，不单独作为拆分理由。

1. `archiveSelectors.buildStoryCatalog` 用 `row['1']` 建索引，按 `['2']` 关联
   chapter/group，并按 `['9']`、`['5']` 等确定标题/日期。masterdata builder
   输出也保留数字字段。这是可直接证明的跨层语义重复。
2. `ArchiveDataRepository.validatePayload` 把 birthday 4/181/78、extra 7、
   song full mix 61 写成浏览器运行条件。后续应保留版本、结构及关联完整性验证，
   将固定档案数量交给现有域 verifier；不能只删数字而削弱数据检查。
3. `ScenarioNormalizer` 会将 legacy state 转为 compat v2，记录未映射
   screen effects、spine fade/color transition 和未知 timeline。与此同时 Python
   `authoritative_scenario` 从 compatibility result 投影严格产物，Node
   `scripts/lib/authoritative-scenario-compiler.mjs` 又依赖浏览器 normalizer。
   因此不仅是两个文件大，还存在生成工具对前端实现的反向依赖。
4. `SpineStage.applyState` 使用 `getStepSceneState`，后者优先 entry snapshot；
   `applyStepSceneState` 当前只处理 filter、背景模糊/颜色及非 fade 屏幕效果。
   `useStoryRuntimeCues` 管 background/camera/screen entry 和 cue。
   两条调用链的存在不自动证明同一 channel 被双重调度，更不能证明某个显示 bug。
   下一步要按属性/channel 列 ownership 和重放矩阵，观察异步模型加载与取消。
5. `batch_compile.py` 仍带固定盘符并面向批量 legacy 输出。它的存在不能成为
   全库执行授权；严格发布需要走现有候选和 ledger 管道。
6. guidance 所提的通用 `renderAt(step,time)`、typed command IR 和独立阅读
   artifact 是迁移目标；现有 clock seek、debug snapshot 与 entry/settled snapshot
   不等于已具备完整任意时间重建能力。

P2-B 在本地权威入口仍为 NOT EXECUTED。新的重构任务可开展独立结构批次，
但不因此宣称长稳已通过或批量推广下一个 strict-v2 collection。

## 4. 第一批：共享资源解析

`scripts/lib/archive-assets.mjs` 现在统一：

- 本地 source config 与四个 `SIDEM_*_ROOT` override；
- SE 的 sfx → telephone → system → legacy 顺序，以及脚步声别名；
- ambient `_t` fallback、口型与卡图路径和根目录包含检查。

Vite/standalone 保留自己的 HTTP、缓存和缺失资源回退；candidate 路由仍只在
Vite。`src/utils/AssetResolver.js` 继续只生成浏览器 URL，不导入 Node 文件系统。
`server.js` 提供无监听副作用的 `createArchiveServer`，CLI 仍可直接启动。

有意修复的行为差异：standalone 现在尊重 archive source config，不再使用旧盘符；
音频 URL 会先去掉 query 并解码，与 Vite 对齐。旧机器若未配置 legacy_root，
需配置本地 sources 或保留明确环境 override；仓库不再猜测那台机器的路径。

验证入口：`npm run verify:archive-assets`。临时配置与临时字节文件经真实 Vite
配置和 standalone server 各请求 14 个资源（共 28），覆盖优先级、别名、回退、
query、编码文件名、口型、卡图 MIME/cache，另测越界与 standalone 缺失回退。
这些是假媒体字节，不能用来声称解码成功或实音播放验收。

## 5. 后续迁移按依赖推进

| 批次 | 具体结果 | 验收要求 |
| --- | --- | --- |
| A，已实现 | 共享资源解析，独立 HTTP 回归 | 配置、查找顺序、Vite/standalone 请求等价；保留 transport 差异 |
| B，推进中 | 剧情语义与状态 ownership characterization；B1 拆 Spine cue 执行，B2 补模型发布归属，B3 统一元数据等待与 entry readiness，见 `STORY_STATE_OWNERSHIP.md` | RAW fixture → 两种编译路径 → Spine adapter 已接通；模型替换/离场/慢元数据竞态回归及三角色浏览器冒烟通过；其余舞台属性中间态与跨 channel 状态仍需推进 |
| C，已实现 | Python 单一生成命名 Story catalog；浏览器目录消费者已迁移，见 `STORY_CATALOG_CONTRACT.md` | 1,394 条目录有/无 presentation 的全部属性 parity、缺失/合并 fixture、域门禁与桌面分类→前传入口通过；旧索引仍供其他 selector 使用 |
| D | 独立 reading artifact/consumer（功能扩展） | 复用 speaker/text_ref/overlay；choice 与来源 step 保真；浏览器请求证明无 Pixi/Spine/audio 初始化；桌面/窄屏交互验收 |
| E | Runtime 单一状态计划与 renderer adapter | 在 B 的证据上逐 channel 迁移；兼容留在显式边界；不要先删 normalizer；行为变化需真实媒体回归及长稳证据 |
| F，推进中 | F1 分离 repository 请求/契约；F2 移出导航状态与投影；F3 统一异步导航有效性和恢复生命周期，见 `ARCHIVE_DATA_BOUNDARIES.md`、`ARCHIVE_NAVIGATION_BOUNDARY.md`；feature 组合仍待拆分 | 数据/请求回归、1,792 组导航投影 parity、可控异步竞态、域门禁及真实剧情进入/返回通过；桌面/平板/390px、慢网络和启动/过滤完整矩阵仍待完成 |
| G，推进中 | G1 建立 sidem_scenario 包，分离 state/compiler/file_io/cli，旧入口重新导出同一类；G2 注入资源接口并隔离候选任务缓存；G3 统一候选来源配置；G4 分离 RAW transport/identity/voice 规则；G5 分离 masterdata wire；G6 分离身份字典领域；G7 分离 music/movie 领域；G8 分离剧情/手机/季节活动领域和公共资源匹配，见 `SCENARIO_PIPELINE_BOUNDARIES.md` | 10 组旧编译器输出/provenance hash、导入/CLI/临时批处理与 RAW→Spine 集成通过；资源 provider 与候选输出回归通过；候选配置与 JS 根路径一致性通过；RAW 单 bundle 旧新逐值一致；masterdata 47,204 记录旧新 hash 一致；五组身份字典完整输出一致；旧 API 默认、music/movie 四组输出一致；六组剧情/互动输出在两种资源证据下与旧实现一致；其余领域生成/publish 分层仍待迁移 |

B 优先服务反复反查 RAW 的维护痛点；不急于引入新 schema v3 或把所有已有 v2
产物重编译。D 是参考文档提出的功能方向，尚未实现，不应和行为保持的重构混为一谈。
每批可以独立提交/回滚；不得通过重写历史破坏已发布记录的 ancestry。

## 6. 本批验证记录

修改前：archive-sources、archive-baseline:source-only、routes 通过。
修改后：archive-assets、archive-sources、archive-baseline:source-only、routes、
story-runtime-foundation、story-audio、story-timing-semantics --source-only、
release-soak，以及 `publicDir:false` 的源代码生产构建通过。
构建输出放在 `.analysis/architecture-refactor-build`，不覆盖原有 dist 媒体。
Vite 提示两个背景路径留待运行时解析；主 index bundle 为 480.14 kB，后续仍需性能/挂载验证。

未执行：全量媒体 build/copy、所有 CI 域验证、真实浏览器画面、真实音频长稳、
全库重新编译、publication 或部署。本批不更改 UI、剧情语义、产物或发布记录。
回滚入口是本批独立 Git commit；回滚配置迁移时一并回滚两个 HTTP adapter 和共享模块。
