# 下一阶段：实体展示、导航外框与歌曲时间轴

日期：2026-09-13。核查起点：`e109c89`，分支 `codex/p1-effect-texture-deps`；审计结束时另一窗口提交到 `011aa70`（人物选择分页与滚动）。此前 `018ac7d` 已实施轻启动，`d25c2e1` 修复集合/Work 恢复。不是沿用 `d7bd143` 时的未实施状态。

本轮是**代码与本地索引审计、开发路线制定**，没有实施下列功能，也没有重复 Browser 验收或构建。审阅输入为附件 `a3d0903d-f732-4251-8b9d-db730f87201d`（实体展示）、`33f8afb9-1e81-4e34-a97c-489fa2bb889c`（Song/Chibi）及用户正文（Navigation Chrome）。审阅建议与已验证事实分开记录。

## 当前工作区和协作边界

- 另一窗口正在修改 `src/components/archive/ArchiveWelcome.vue`，现场 diff 涉及搜索、分页、选中反馈、设置显示条件；审计过程中 `docs/PORTAL_STARTUP_UX_PLAN_20260912.md` 也出现未提交修改。本窗口不编辑、stage 或覆盖这两份文件。
- `docs/sidem_title_fx_css_rebuild_v9.html` 是原有无关未跟踪文件，继续保留。
- 人物选择流程、默认值、偏好持久化由另一窗口继续；本路线消费其完成后的合同，不重复改一套选择器。
- 已向另一窗口说明：picker Back / 根 Portal Back 与本路线有交集，应指定一个批次收口，不能以“不重合”为由遗漏，也不要两个窗口同时修改 App/route。
- 上述未提交状态是审计过程快照；`011aa70` 已提交 Welcome 和启动计划改动，本轮没有将其纳入自己的提交。

## 三份审阅核实与修正

### A. 实体展示缺少共同合同：成立

| 页面/消费者 | 当前代码事实 | 下一步 |
| --- | --- | --- |
| ArchiveCardList | 整行 button 打开卡片；compact/grid 均只有卡图、稀有度、标题、语音/剧情数量，没有 owner 名 | 全体模式首先补规范角色名；不在整行 button 里面嵌偶像 button |
| ArchiveCardDetail | card 有 character_id；同系列卡消费 character_name，但详情 emits 没有 open-idol | 正式“所属偶像”关系区，捕获 Card 来源后进 Idol |
| SongPresentation / ArchiveSongDetail | performers 已有 id/displayName/actionable；成员和 audioGroups 使用文字 chip | 共享身份投影；表演成员 portrait，声部列表 compact，不能把声部收录误写成确定演唱阵容 |
| EventDetail / App | eventStoryIdolVisualUrl 按 idolCode 查 raw candidate、promoted；否则模板用 icon | visual 模式，但素材有来源依据才选用 |
| StoryDetail / UnitDetail | 自行拼 image_chara_icon 路径、各自小头像布局 | 迁入共同引用组件，保留各自密度 |
| Portal / IdolDetail | 各自头像尺寸与交互；Portal 关联当前 preferred idol | 稍后迁入身份显示，不接管偏好写入/选择流程 |

修正审阅中的三个隐含前提：

1. 本地 `masterdata/card_index.json` 当前有 **836 条记录**，不是审阅中的固定 826。索引条数不等于所有 UI 筛选后的可见卡数；验收应从当前数据计算，不写死旧数字。
2. `CharacterImageResolver.js` 目前只有种类白名单、raw query 开关及 promoted registry 查询。它**没有**通用 portrait 目录、网络失败降级、裁剪布局或可用性完整合同。应在其上加很薄的 policy/projection，不宣称只调用现成 resolver 即可完成。
3. 当前 event visual 查询只以 kind + idolCode 为键，并没有 eventId。不能仅凭 `event_story_visual` 文件名认定它属于某场活动，也不能优先到所有 Song/Card。上下文绑定必须来自 registry/source evidence；不能凭文件名前缀推断。

建议合同分两层：

- `IdolReferencePresentation`：canonical idolCode、displayName、unitName（可选）、actionable、imageCandidates、source/context；只做身份和素材投影，不导航、不加载媒体运行时、不持有用户偏好。
- `ArchiveIdolReference`：compact / portrait / visual 三种明确密度；统一焦点、键盘、名称和整块点击。通过 emit 交给 App 已有 provenance；未知身份输出有意义的非交互文本，不能补成冬马、用 unit alias 冒充 idol。

降级策略必须包含“无候选”和“URL 存在但图片解码/HTTP 失败”两条路径：合法上下文素材→允许的通用头像→文本占位；失败候选每个最多尝试一次。固定图片槽与 aspect-ratio 防止跳动；懒加载非首屏引用。复用卡图的列表可仅加名字，不额外请求 836 张头像。人物图旁已有姓名时避免重复无意义的读屏朗读。

### B. Navigation Chrome 不统一：成立，但不全是视觉问题

| 位置 | 当前证据 | 归属 |
| --- | --- | --- |
| ArchiveShell.vue | is-portal 同时涵盖 Portal/Reader；两者隐藏共享 topbar；普通页用独立 grid 顶栏 | 外框/滚动架构 |
| ArchiveStoryReader.vue | reader-top 高64px、position:relative，位于阅读滚动区域；自有返回按钮 | Chrome 消费者 |
| ArchivePortalLauncher.vue | 自有 header/pill；portal-launcher overflow-y:auto；顶部 header 非 sticky | Chrome 消费者 |
| Shell archive-back | padding:7px 4px，没有最低44px尺寸 | 触控与可访问性 |
| Portal 其他操作 | 小屏 portal-action 最低36px，preferred-panel nav 也是36px | 不应只检查 Back 一个按钮 |
| ArchiveListHeader.vue | 英文 ← Back、蓝描边；有自身 sticky 与 filter-bar top:48px | 仍有消费者，先迁移/适配再删除，不可直接删文件 |
| Portal 根入口 | portalFrom 可为空，但组件总渲染 Back；closeArchivePortal 无空来源分支 | **返回语义**，先定义再画按钮 |
| idol_picker | section=home 导致 Shell 隐藏 topbar；openIdolPicker 只 commit；selectionOnly 不提供常规返回 | **返回语义**，与另一窗口边界交接 |
| Safe area | 档案/Reader/Portal 没有统一顶部和左右 inset；Player 已独立处理 | 共用 token，不整体套用 Player |

根 Portal 的空来源会进入 readPortalReturnRoute 的默认回退，并非真实上一页。具体落点还受新的 startup/Home 规则影响，不能再断言“永远默认冬马”。建议无真实来源就不显示 Back，“游戏风首页”保留为显式不同动作。

先定义 `canGoBack` / `backLabel` / `onBack` 的语义输入，再抽 `ArchiveBackAction` 与薄 `ArchivePageChrome`（title/actions slots）。UI primitive 不读取 history.length、不自行拼 URL、不新增 parent refs。picker 是否允许回 Portal、Welcome 设置是否要回打开设置的来源，应由入口合同显式决定；这是本轮建议中的小型语义补口，不能以“完全不碰路由”为硬约束。

共享导航触控区至少44×44、ArrowLeft、字号/focus ring、左右 gutter、safe-area tokens、顶栏基线与分隔线。统一的是可预测的导航骨架，**不是强制同一标题排版或一律同一固定高度**：普通档案搜索/面包屑可有第二行，Reader/Portal 保留内容身份。

每页明确唯一滚动容器与 sticky 所属层，避免 Shell 顶栏+页内顶栏双重 sticky、safe-area 双加、filter-bar 硬编码48px遮挡。长 Reader、键盘焦点滚动、浏览器后退 scroll/focus 恢复要一起验证。长来源标题只用于截断的桌面标签/aria-label，窄屏显示“返回”；标题解析只用已有轻数据，不能为 Back 标签加载媒体或大索引。

Player 保留独立 PlayerTopBar 和演出模式；Spine/Chibi 可消费 dark tone Back primitive，但不把实验工具栏移入档案状态 owner。

### C. Song / Chibi 能力回流：成立，必须先验证版本与时间基准

实读本地文件的结果：

| 指标 | 当前结果 |
| --- | --- |
| song_catalog.json | 61 个 song_code |
| live-chibi/choreography/index.json | 8,267,629 bytes（约7.88 MiB），118个编排版本，60个songCode |
| 未映射目录条目 | reason |
| 带 lyricEvents 的编排 | 118；不等同于118个可用歌词播放器 |
| drv999_live_effect | duration=0，有21个歌词事件，最后歌词终点110200ms；用户明确这是社长愚人节独立歌曲版＋社长单独小人，没有普通编舞 |
| brndnf_live_effect | startTime=-2000ms，编排duration=123450ms；最后歌词终点124830ms |
| brndnf音频 | music index duration≈130650.907ms；正式 song_playback_audio 指向同一 /assets/live-chibi/music/brndnf.m4a，duration_seconds≈130.650907 |

这说明不能直接用编排 duration 截断歌词，也不能看到负 startTime 就一律加/减2秒。BRAND NEW FIELD 已有相同音源的正面证据，但时间轴映射仍须原声起句、中段、尾句和 seek 实测；其他版本不得据此外推。

**drv999 的产品语义以用户本轮补充为准**：它不是待补齐多人编舞的坏条目。独立歌曲页保留，能力应表示音频、待核验的歌词时间轴与社长单独小人展示；普通编舞不适用。索引里出现 motions/events 或零 duration 都不能反推其具备普通 Live choreography。小人展示按其专用动作/资源合同运行，不要求套用多人 lineup、SwitchSinger 或完整舞台时长；也不自动判定为静态图。时间轴上限与歌词同步另按对应音源核验。

比审阅更紧迫的一点：`ArchiveSongLineupPlayer.vue` 已经通过 `songPerformanceData.js` 拉整份约7.88 MiB编舞表，并非只有 Chibi 实验页才拉。轻量投影应同时迁移这个现存消费者，否则新增歌词虽变轻，Song 的编成模式仍沿用大索引。

ChibiStageViewer 确实已包含动作、站位、SwitchSinger、镜头、屏幕、图片/物件层、灯光、歌词、口型、音频等消费者。但 onMounted 先创建 Pixi，再获取 manifest/choreography 和六类辅助 index，默认选择 drvalv_live_effect；props 目前只有 audioExperiments。**现有返回来源机制可复用，不等于 Song→Stage 的目标身份已经实现**。仅调用 openChibiStage() 会打开默认歌曲，必须补显式 songCode + choreographyId/variant、刷新恢复和无效目标错误态。

现有时钟也不能视为完全统一：SinglePlayer 是原生 audio；ExperimentalPlayer 的 solo 使用 useSongPerformanceSession，其他模式保留 HTMLAudio/currentTime；Lineup 与 Chibi 也使用 session，但 Chibi stageTime 是毫秒，session/audio 是秒，Chibi 无音频时还可用 RAF 时间。应适配统一接口，不让歌词另起 RAF 计时，也不让新“共享时钟”反过来抢走已有 transport 的播放所有权。

## 推荐实施顺序与逐批验收

| 批次 | 交付及主要文件 | 必须通过的门槛 |
| --- | --- | --- |
| P0 边界冻结 | 接收另一窗口的人物选择提交；确认 root Portal/picker/settings 返回语义归属；更新本路线基线 | 无共享文件未分工写入；把语义未决项记成待做而非CSS完成 |
| P1 身份投影与Cards | presentation模块、ArchiveIdolReference；CardList名字、CardDetail owner、App open-card-idol接线 | 全体/单人compact/grid；未知ID/缺图；Card→Idol→Back保留卡、过滤与来源；无嵌套button |
| P2 跨页人物引用 | Song performers/audioGroups 优先，随后 Unit/Story/Event；Portal最后随选择器稳定后迁入 | 固定组合/自由编成/特别阵容语义正确；3人/5人/大量成员；图片失败无布局跳动；不无条件请求活动立绘 |
| N1 导航语义补口 | root Portal可返回性、picker来源、settings出口；复用既有来源合同 | 直达、刷新、从不同页打开、取消/选人后的去向逐条确定；不借UI抽象掩盖返回错误 |
| N2 Chrome迁移 | BackAction/PageChrome；Shell→Reader→Portal→旧ListHeader→Lab | 390px与桌面、长内容、safe-area、键盘focus、44px触控、唯一滚动owner；Player不迁入 |
| S0 轻量时间轴投影 | 生成器+schema+manifest/按曲文件；替换 songPerformanceData 的全库消费 | songCode/choreographyId/variant/音源映射；时间单位、hash/revision、负起点、空/重叠/同刻/零duration；reason无映射与drv999特别版单人展示分别建模 |
| S1 时钟适配与歌词 | 先做FullMix clock adapter，再Lyrics组件；最后接Experimental/Lineup | play/pause/seek/end/waiting/error/rate切换；原声头中尾核验；用户滚动可脱离自动跟随且可返回当前句；无歌词不阻塞音频 |
| S2 Song→舞台 | Song轻量能力入口；route/App传明确stage目标；Chibi按需初始化 | 返回/刷新仍是选中歌曲版本；默认不播放、不加载舞台运行时；缺资源明确失败可返回；卸载停音频/RAF并释放纹理 |
| S3 编成接续 | 传lineup/slot语义、vocalMode和gain；明确resume时间是否传递 | singer stagePosition≠performerSlot≠idolCode；暂停旧transport后才启动新transport，不双响；旧异步结果不覆盖新选择 |
| S4 有证据的VFX | 按曲目列效果支持/近似/缺失，独立小批 | 不把复杂Unity粒子/shader复刻当上述正式入口前置门槛 |

P1/P2 是用户最先可感知的信息架构改进，N1/N2 随后收口统一导航；如根返回造成明显误导，可先单独做 N1。S0 可以做数据分析但不要与人物/Chrome大批同时改 App。审阅提出的“歌词后再抽clock”应调整为 **S0 → 最小clock adapter → 歌词**，否则会先造一套临时时钟再迁移。

轻量 timeline 建议分 capability manifest 和按曲/版本加载的详情；字段除 lyricEvents/counts 外须有 source hashes、audioRef、timeUnit、timelineToAudio映射及 alignmentStatus。音频、歌词、单人小人展示、完整编舞是独立能力；每项再区分证据存在、可解释、资源可用与已实测，不能只有 has_choreography 布尔值。drv999可有特别版小人入口而没有完整编舞入口。歌词只在匹配音源/版本后启用同步 seek；未确认的可以保留资料状态，不能给假同步。

不要让 Song 为歌词 import ChibiStageViewer 或 liveChibiSpine。正式页也不应预创建隐藏canvas。源码依赖图/Browser请求同时检查：无舞台操作时不得加载 Pixi/Spine、舞台背景、物件、灯光等；性能目标按当前 measured baseline 设预算，不能在生成前承诺索引必然只有几十KB。

## 提交、验收及文档规则

- 每批只提交完成的范围，明确改动、回归、实际 Browser路线、未执行项；跨页截图不代替语义/资源验证。
- 使用现有 verify:archive-navigation-state、verify-archive-routes.mjs、Reader/Portal/startup验证器，以及对应 Song/Chibi singer-slots/audio验证器；新增测试对合同和故障行为，不只检查组件名字符串。
- 代码需要时使用 `npm run build:check`，固定 E 盘 `.analysis/build-check`、copyPublicDir:false。纯文档不构建。本轮不新建QA包，不复制public；完整打包仅按 BUILD_ACCEPTANCE_POLICY 的发布条件执行。
- 规划中的可用性、歌词对齐、移动端sticky和Stage释放门槛均未在本轮执行；不能将本次源代码审计标记为功能或Browser PASS。

本路线是下一步主要开发方向，不重开已经完成的导航多层来源重构，也不提前进入完整Unity VFX/runtime替换工程。

## P1 首批实施：卡片所属偶像

输入HEAD `5e870c4`。新增 `IdolReferencePresentation`，只从原始偶像字典解析规范ID与姓名、从档案关系取组合，缺失身份保持不可操作且不补成其他偶像；当前图像候选仅为相同ID的通用头像。`ArchiveIdolReference`提供 compact / portrait / visual 三种密度、整块键盘可操作入口，以及图片请求失败后的固定尺寸文字占位。当前正式消费者是卡片详情；其余页面仍待P2迁移，不能把组件存在写成跨页统一完成。

Cards总览在整行卡片按钮内增加所属偶像姓名，不嵌第二个按钮，也不为826条可见卡片新增头像请求。卡片详情增加“所属偶像”关系入口；App捕获当前卡片来源后进入 Idol，返回时恢复原卡，继续返回恢复卡片筛选。原始索引836条的所属ID全部能解析；当前正常目录筛选显示826条，两者口径不同。

验证：`verify:idol-reference`覆盖836条索引、冬马规范姓名/Jupiter归属及未知ID不可操作；`verify:card-filters`、`verify:archive-navigation-state`、`verify:routes`与`npm run build:check`通过，后者只生成E盘`.analysis/build-check`代码产物，不复制public。5175 Browser实走桌面总览、网格、卡片详情及390px详情；从SSR＋标题筛选进入卡片→偶像→卡片→原筛选列表，查询与筛选恢复；桌面/390px无横向溢出。独立Edge CDP核对826行无嵌套按钮、零额外owner头像，并阻断冬马头像请求，确认同尺寸文字占位和可点击入口，未见console error。此批尚未验收Song/Unit/Story/Event跨页人物引用、导航Chrome或歌曲时间轴。

## P2 分批实施：歌曲页人物引用

输入为P1提交 `5eea343`；实施期间，人物选择页按用户反馈取消人数分页、改为完整名单自然滚动，并独立提交 `ce46adb`。P2本批只迁移Song：`SongPresentation`把已有演唱成员和个人声部条目投影为共同的偶像引用，`ArchiveSongDetail`以portrait密度展示确定演唱成员；大量个人声部条目只展示文字入口，不新增49张头像请求。组合声部仍是组合链接，声部收录没有被标成确定演唱阵容。身份与组合来自字典和档案manifest；未知人物保持不可操作。

验证：`verify:archive-presentation`覆盖61首歌、Jupiter固定组合、ANYWHERE特别五人阵容、DRIVE A LIVE自由编成与49条个人声部、未知ID及原始证据不变；`verify:song-domain-landing`、`verify:idol-reference`、`verify:archive-navigation-state`、`verify:routes`与`npm run build:check`通过。5175 Browser实走BRAND NEW FIELD三人入口、翔太→偶像→返回歌曲，检查ANYWHERE五人和DRIVE A LIVE声部区；补充Edge CDP在1440×900与390×844核对头像数、0横向溢出和0控制台错误。构建只生成E盘`.analysis/build-check`代码产物，不复制public。Unit/Story/Event/Portal迁移、导航Chrome和歌曲时间轴仍待后续批次，不在此批验收范围内。

## P2 分批实施：组合页成员入口

组合成员仍由原有manifest成员关系排序与计数，不改动`buildUnitCatalog`的冻结数据合同。`ArchiveUnitDetail`接收现有身份字典与manifest，仅在展示层把各成员映射成共享偶像引用；点击继续向App传原成员对象，沿用既有`unit_detail→idol_detail→unit_detail`来源链。窄屏成员布局改为单列，保证姓名和入口完整可读。

验证：`verify:unit-page`保持16组、34种身份路径与旧版投影等价；`verify:idol-reference`核对49名manifest成员全都解析为规范姓名且可操作；`verify:archive-navigation-state`通过。5175 Browser实走Jupiter三人头像与翔太进入偶像、返回原组合；390px Edge CDP检查High×Joker五人头像、0横向溢出及0控制台错误。代码编译使用`build:check`，仅E盘`.analysis/build-check`，不复制public。Story/Event/Portal展示迁移仍未完成。
