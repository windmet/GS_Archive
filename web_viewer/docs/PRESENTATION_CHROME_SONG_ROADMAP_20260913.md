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

## P2 分批实施：剧情详情登场角色

剧情详情的原始`characters`集合不变，展示层通过共享身份投影生成入口。已知偶像显示规范姓名、组合与头像；形似六字符偶像ID却不在字典内的NPC保留为不可操作的“姓名待确认”占位，不再进入无效偶像页。未知身份不用臆测成其他偶像；NPC专名的独立来源映射仍待后续资料审计。

验证：`verify:idol-reference`加入主线序章角色样本，确认3位偶像可操作、`101ken`不可操作；`verify:birthday-story-domain-landing`、`verify:archive-presentation`与`build:check`通过。5175 Browser实走主线序章冬马→偶像→返回原剧情；390px Edge CDP检查主线第一话11个六字符角色，其中9位偶像入口、2个未知占位，单列可读、0横向溢出、0控制台错误。构建仅为E盘代码产物，无public复制。Event/Portal及跨页完整迁移仍未完成。

## P2 分批实施：活动页出演人物与立绘

复核发现`raw_character_image_promotions.json`的`event_story_visual`条目已有`master_evidence.event_ids`与`compiled_files`，比本路线最初对只按人物查询的判断更具体。新`buildEventIdolReference`仅在当前活动ID和剧情文件同时属于同一条promotion时，把该立绘置于通用头像前；实验RAW候选也只能在此已证实关系下、显式URL参数打开时尝试。其余活动只用对应人物头像。活动页三人都走共享入口；visual卡固定230px，立绘HTTP失败时降级为头像而不改变卡高。

验证：真实注册表中冬马、翔太、北斗三人都将`430018 / 1_3_30018_01.json`列为关联；`verify:idol-reference`覆盖三人、剧情文件不匹配、NPC不可操作；`verify:raw-character-candidate`和`verify:raw-character-promotion`通过。5175 Browser确认430018三张立绘、北斗→偶像→返回活动，430017只呈普通头像。390px Edge CDP确认三张立绘均解码、无横向溢出；阻断北斗立绘请求后回退到北斗头像，三张卡仍同为230px，零控制台错误。`build:check`只生成E盘代码产物，无public复制。Portal展示迁移及N1/N2/S0-S4仍待后续批次。

## P2 分批实施：Portal“我的偶像”

Portal自推卡改用共享身份引用，规范姓名、组合和头像降级由同一合同提供；保留原五个快捷入口，不改变偏好设置与持久化。原有`Portal→资料→返回`实测误落Welcome：来源解析曾完全禁止Portal。本批让Portal作为受限来源帧，仍禁止其作为自身`portal_from`的递归目标；从自推卡和五个快捷入口进入人物/卡片/个人故事/Work/通信后，返回可恢复Portal及其原来源。根Portal本身仍显示一个无真实来源的Back，属于下一批N1语义补口，不把本批标为N1完成。

验证：`verify:portal-navigation`增加Portal来源经偶像URL刷新仍可返回、保留Portal自身来源及递归拒绝。5175 Browser通过设置页选翔太，实走Portal→资料→Portal，直达带来源的翔太URL→Portal，并逐一检查五个快捷入口返回。独立Edge CDP在1440×900与390×844检查翔太姓名/Jupiter/头像解码、五个快捷按钮44px、0横向溢出及0控制台错误；代码编译仅使用E盘`build:check`，不复制public。根Portal Back、picker取消与设置返回语义仍待N1处理。

## N1 导航语义补口：Portal、选择页与设置页

输入HEAD `d788b61`。根Portal没有真实来源，隐藏内页与Shell的返回并阻止空来源关闭；带`portal_from`的Portal仍显示返回并按原筛选恢复。Portal除明确跳转根首页外的七个图标入口保留Portal来源，目录及详情返回到Portal；Shell其他页面的全局导航继续按原根导航语义。`idol_picker`进入时捕获来源，显示“退出选择”：有来源则回来源页，直达无来源则进入根Portal。选定偶像进入目的页后，返回先到选择页，可重新选人或退出原入口。Welcome仅在从设置入口进入时携带来源并显示“返回来源页”；取消、稍后再选、选择轻量模式均回原入口，选择游戏风首页仍明确进入首页。Welcome和picker URL只保留自身目标与来源，不继承前页筛选字段；来源继续由既有16层/8192字符边界处理。

验证：`verify:portal-navigation`覆盖Welcome、picker、歌曲目录刷新来源，以及根Portal无来源关闭；`verify:archive-navigation-state`新增两种入口精简投影，旧页面1792组投影保持等价。`verify:archive-startup-route`、`verify:archive-async-navigation`、`verify:routes`及`build:check`通过，构建仍只在E盘`.analysis/build-check`生成代码。5175 Browser实走根Portal→设置→返回，带SSR筛选来源的Portal→设置→Portal→Cards，带来源picker→偶像→picker→Portal、无来源picker→Portal，Portal的故事/歌曲/偶像/卡片/卡池/互动/资源入口均返回Portal；设置URL刷新后仍显示返回。1440×900与390×844 Edge截图复核根Portal与49人picker，0横向溢出、取消按钮44px、0控制台错误。N2共享Chrome和S0–S4歌曲/舞台工作仍未执行。

## N2 首批：共享返回控件

新增不持有路由状态的`ArchiveBackAction`，由Shell、Portal、Reader、Welcome/picker及独立列表头消费；父级继续决定是否显示、按钮文案与返回处理。统一ArrowLeft、44×44最小触控区、焦点样式和颜色变量；Portal保留自身胶囊外观，Reader保留居中标题，Player顶栏未动。独立列表头的筛选栏sticky偏移同步改为实际69px头高；Portal窄屏设置操作升至44px并计入顶部safe area。未抽`ArchivePageChrome`及完整顶栏/滚动容器合同，不能标记N2全部完成。

验证：`verify:reading`全链、`verify:portal-navigation`、`verify:archive-navigation-state`与`build:check`通过；阅读导航验证器同步修正了旧首页URL断言为当前规范`?view=home`。5175 Browser实走带来源Portal→歌曲、Reader→剧情目录，零相关控制台错误。1440×900与390×844 Edge实际DOM测量Portal返回74×44、Shell和Reader返回72×44，三页无横向溢出、零控制台错误；截图检查移动端三个页面的顶栏、内容与底部导航。构建仍为E盘`.analysis/build-check`代码产物，无public复制。

## N2 第二批：薄页眉与安全区

`ArchivePageChrome`以`canGoBack`/`backLabel`/`back`事件和标题、动作插槽组织Shell、Portal、Reader与独立列表头；具体返回来源仍由App负责。三个页面保留各自标题与滚动身份：Shell普通页顶栏在网格第一行且主体只由子页面滚动，Portal/Reader继续各自单滚动容器且不额外显示Shell顶栏。Shell向下传顶部及左右safe-area变量；窄屏Shell顶栏、Portal和Reader分别消耗一次，不动Player独立顶栏。列表头仅在非embedded场景出现，筛选栏跟随其69px头高，App现有embedded消费者不叠第二顶栏。

验证：`verify:reading`、`verify:archive-navigation-state`、`build:check`通过；5175 Browser确认普通页、带来源Portal、Reader的返回动作与Reader原剧情目录来源，控制台零错误。Edge在1440×900与390×844再次核对三个返回区均≥44×44、页面无横向溢出，并截图复看窄屏的标题、正文与底部导航。具有非零safe-area的设备、独立列表头在App以外的嵌入场景仍未实机验证，不把此项外推成全设备验收。

## S0 轻量歌曲时间线：投影与现有合唱入口

输入HEAD `051897e`。`generate:song-timelines`从编舞索引、正式歌曲目录和播放音源目录生成确定性的v1 manifest及118个按编排ID独立加载的详情文件，记录三个源文件hash、每个编排的内容hash、毫秒单位、负起点、原顺序的歌手/歌词事件、音源引用及彼此独立的音频/歌词/舞台能力状态。61首目录歌曲中60首有时间线；`reason`明确列为`no_choreography_entry`。`drv999_live_effect`保留零duration及21条歌词，标记`special_single`，不宣称普通多人编舞。时间线到音频的偏移和歌词对齐一律`unverified`，资源存在只表示本地路径在生成时可找到，绝不表示实测同步或媒体可播。

歌曲详情的五槽合唱现在通过`fetchSongPerformanceArrangements(songCode)`只读取manifest和本曲的base编排，失败请求可重试；Chibi实验舞台仍有自己的整库入口，本批没有迁移或宣称其按曲加载。以`drvalv`为例，该入口JSON请求从原编舞索引8,267,629 bytes降到manifest加详情39,956 bytes。源编舞中负起点、重叠歌词和零duration保持原值；当前源没有同刻歌词的实证样例，投影不做按时间去重/排序，相关合成用例留在后续歌词消费合同中。

验证：`verify:song-timelines`含Ajv schema、全118条源字段与hash一致性、无映射reason、特殊版边界、按曲请求集合及503重试；`verify:song-experimental-audio`改为检查新轻量入口，`verify:live-chibi-singer-slots`、`verify:song-playback-audio`、`verify:song-domain-landing`和`build:check`通过。5175 Browser实开DRIVE A LIVE切五槽合唱，播放器ready、五条声部已解码、无页面错误；独立Edge CDP复核1440×900截图、0横向溢出、0控制台错误，网络仅有manifest与`drvalv_live_effect.json`两个时间线请求、无整库编舞请求。构建仍为E盘`.analysis/build-check`代码产物，无public复制。没有播放声音、听感或歌词同步验收，S1–S4仍待实施。

## S1 首批：正式完整混音的原生时钟适配

输入HEAD `39112da`。`createMediaElementClock`只观察当前`<audio>`，将metadata、播放/暂停、缓冲、seek、进度、速率、结束和错误整理为同一快照；不接管原生播放按钮、另起RAF或改写音频时间。`ArchiveSongSinglePlayer`绑定该时钟，在真实waiting状态才显示缓冲提示；更换歌曲或组件卸载时移除监听。此批是歌词消费前的时钟基础，还没有歌词UI或时间轴映射。S0中全部offset仍是`unverified`，不能据本批推断歌词同步。

验证：`verify:media-element-clock`以可控媒体事件验证加载、播放、缓冲、seek、rate、结束、错误、换音源和卸载；`build:check`通过。5175 Browser实开`brndnf`，音频metadata后时钟为ready，键盘在原生控件上播放后为playing、再次暂停后回ready，页面无相关控制台错误。未检验长音频头中尾的歌词对齐、seek后的实际听感及实验混音时钟；S1其余工作仍待实施。

## S1 第二批：可展开的原脚本歌词资料

输入HEAD `3b1a139`。正式完整混音下新增按需展开的歌词资料；打开后才按当前songCode读取base时间线，保留原脚本行顺序和重复行，不按时间合并或截断。界面明确说明与当前音源的时间偏移未校对，因此不跟随播放，也不把行点击解释为seek。没有编舞时间轴的`reason`显示无资料，音频照常可用；`drv999`只作为特别版原脚本资料展示，不宣称同步歌词。拉取失败可重试，曲目切换/收起后旧请求不能覆写新状态。

验证：`verify:song-timelines`覆盖base选择、`reason`缺映射及详情失败重试，`build:check`通过。5175 Browser确认`brndnf`可展开30行，提示可见、无相关控制台错误；`reason`展开为空态且音频ready；`drv999`可展开但保留未校对提示。独立Edge在1440×900和390×844复核歌词首屏、30行列表、窄屏单滚动容器、0横向溢出和0控制台错误。静态文本与原声头/中/尾的对应尚未听核，S1的同步跟随、seek以及实验混音适配仍待完成。

## S2 首批：歌曲详情直达对应舞台

输入HEAD `eb8a640`。歌曲详情只读取轻量时间线目录来判断有无普通多人编舞；有对应base条目才显示“打开本曲舞台”，特别版`drv999`及无编舞曲目不出现虚假的舞台入口。进入舞台时把`stage`编排ID、`song`歌曲码和原歌曲详情`from`一起写入URL，舞台先核对目标，再加载既有Pixi/Spine运行时与整库编舞。刷新和舞台内切歌保持明确目标；目标不存在时显示错误，不暗中回落到DRIVE A LIVE。旧的独立舞台入口继续保留默认曲目。初始状态为暂停；离开时既有卸载清理会停止音频、断开观察器并释放舞台资源，初始化期间离开也不会再创建Pixi实例。

验证：`verify:routes`、`verify:archive-navigation-state`覆盖目标URL、非法ID、来源与旧路由投影；`verify:song-timelines`和`build:check`通过。5175 Browser实走`brndnf`歌曲→对应舞台→刷新→返回歌曲，舞台内改选`anwhre`后URL与刷新目标一致，返回仍到原歌曲；无效目标呈明确错误，`drv999`无普通舞台入口，歌曲来源的舞台返回按钮标为“返回歌曲”。独立Edge核查进入前未请求Chibi/Pixi/Spine及编舞整库，进入后选中`brndnf_live_effect`且暂停；1440×900及390×844画面无横向溢出。`verify:archive-presentation`尝试两次，均在既有`ArchiveTechnicalDetails.vue`样式的Vite SSR模块加载处等待60秒超时，故此项未通过、不能记为验证完成。舞台控制台仍有`@pixi-spine/base`使用Pixi旧颜色工具的两条弃用提示，没有运行异常；此批不验证编舞与原声同步，也不把既有整库舞台加载宣称为按曲加载。S1实际时间校准、S3编成接续和S4特效证据仍未完成。

## S3 首批：五槽试听向舞台移交编成

输入HEAD `afa7741`。五槽实验试听在当前base编舞有舞台候选且音轨就绪时提供“以当前编成进入舞台”；至少须选择一位偶像。移交快照明确记录歌曲码、编舞ID、五组`performerSlot→stagePosition→idolCode`、声部与伴奏音量、原进度，以及`restart-at-zero`策略。歌曲页先释放现有AudioContext声源，舞台核对歌曲、编舞、五槽映射和角色资源后才应用编成，按舞台位置出场；空位不建角色也不发声，重复偶像共享一条解码声部。舞台启用既有同一音频时钟的实验伴奏/声部配置，但初始暂停且不带入原进度，避免尚未校对的两个音源产生伪同步。舞台内切歌会清掉临时移交状态并恢复空槽默认角色；刷新保留目标歌曲和编舞，但临时编成回到舞台默认值，界面明示此点。移交声部若加载失败则关闭实验声部并显示错误，官方混音可作为回退。

验证：`verify:song-stage-handoff`用真实`drvalv_live_effect`五槽映射核对中心3号位对应编组槽1、空位、重复偶像、音量、从头开始及无效映射拒绝；`verify:song-experimental-audio`和`build:check`通过。5175 Browser实测`drvalv`五槽里清空舞台位2、舞台位1/3均选冬马：舞台只出场1/3/4/5，加载3条去重声部，实验时钟ready、初始暂停；切换到`anwhre`后恢复5个舞台位并关闭临时声部模式。另一次实测0.65声部/0.40伴奏准确传入。独立Edge复核歌曲页入口及舞台1440×900、390×844截图，0横向溢出、0运行错误。`verify:archive-presentation`的Vite SSR超时仍未解除；本批没有原游戏音视频的头/中/尾校准，也没有主张从歌曲页返回后保留编成编辑状态。S1同步歌词与S4特效证据仍待后续。

## S4 首批：按编排列出的特效来源与实现缺口

输入HEAD `24372cb`。`buildStageVfxCoverage`从当前选中编舞、屏幕/图片/对象/灯效四份本地索引计算来源统计；舞台控制台按曲目显示镜头、屏幕、图片布景、浏览器近似灯光、已接线静态对象及未复刻粒子对象数量，展开后可查看未支持对象名。这里的“已登记”只代表索引中有素材记录，“已接线”只代表现有renderer接受`sprite/mixed`对象；两者都不是原游戏画面一致性证明。人物染色、聚光、pinspotlight与laserlight属于浏览器近似；Unity粒子与shader没有因此被归为已支持。

本地118份编排中，111份引用至少一种未复刻粒子对象，55份含已接线静态对象；按“每编排去重对象素材”累计有429次粒子引用、129次静态对象引用，1份编排另有4种对象未在本地索引登记。屏幕、图片布景与pinspotlight源引用在当前索引中均能找到对应条目，但尚未逐帧核对文件解码和原片表现。代表曲目的来源结果：

| 编排 | 静态对象种类 | 未复刻粒子种类 | 近似灯光事件 | 证据边界 |
| --- | ---: | ---: | ---: | --- |
| `drvalv_live_effect` | 0 | 2 | 50 | 舞台可播放不等于粒子完整 |
| `brndnf_live_effect` | 0 | 1 | 97 | 环状粒子未复刻 |
| `anwhre_live_effect` | 5 | 3 | 175 | 静态对象已接线，粒子仍缺 |

验证：`verify:stage-vfx-coverage`遍历全部118份编排，核查以上代表曲目及缺索引、未知对象种类分支；`build:check`通过。5175 Browser在DRIVE A LIVE和ANYWHERE间切换，逐曲数量同步更新，未影响舞台播放与编成；390×844 Edge截图复核说明可读、0横向溢出、0运行错误。此批没有新增粒子渲染，也没有做原游戏视频的视觉对照；S4的“支持/近似/缺失”是来源与代码能力分层，实际视觉验收仍需对应原片。

随后复验：此前两次`verify:archive-presentation`的Vite SSR样式加载60秒超时；独立加载`ArchiveTechnicalDetails.vue`与`ArchiveSongDetail.vue`分别成功后，全量验证重新运行并通过：61首歌曲、规范身份、能力边界、原证据不可变以及20个模板边界。此前超时保留为当时验证记录；当前HEAD不再有这项未通过检查。没有因此增加原声同步或原片视觉验收结论。

## S1 媒体元数据前置核查

输入HEAD `efe5ab5`。新增可单独运行的`verify:song-media-duration`，逐一使用ffprobe读取61份本地M4A容器时长，对照对应RAW cue的采样数/采样率与登记时长；当前61份均可读取，最大差异0.77ms。5175实际服务的61条歌曲路径也逐一通过HTTP HEAD。BRAND NEW FIELD容器约130.651秒、DRIVE A LIVE及`drv999`均约130.285秒但两份衍生文件SHA不同；`drv999`仍是独立特别版，不能只因时长相同合并身份。这些仅证明容器和时长元数据一致，不证明可持续解码、听感、歌词起句/中段/尾句对齐或舞台同步；时间线`timelineToAudio`仍保持`unverified`，正式歌词仍只作为文本资料。

## S1/S4 原片候选核查

核查官方歌曲视频 https://www.youtube.com/watch?v=5J364VmlFxQ（Jupiter／BRAND NEW FIELD SideM Play List）：本地临时参考文件约150.210秒，抽看35秒、75秒、125秒均为歌曲宣传画面、固定文案或游戏广告，不是游戏内Chibi舞台录像。该文件只保存在忽略的`.analysis/reference-video`供内部核对，不入库、发布或充当原游戏舞台验收证据。

进一步将视频和本地`brndnf.m4a`均转为4kHz单声道PCM，以归一化FFT互相关匹配。全段最高相关0.99016，视频时间0对应本地音频时间约2.206秒；本地10–30、55–75、100–120秒三个窗口分别得到2.206秒相同偏移，相关0.98918、0.99306、0.98859。视频SHA-256为`069b89f28faea046477e8a4a999281192194806c52cbb1c6871f6d77b8e56bfb`，本地M4A SHA-256为`fb863c0e215d29da793cc98ec3d02ef117bba24f79301bb4bf49b6d09d8e1d9a`；PCM及核对脚本均在忽略目录中。这确认两份音频在重叠段几乎同源、没有可测的头中尾漂移，但**不是**脚本歌词事件到音源的偏移，也不是游戏舞台镜头证据。该视频无人工字幕，日语自动字幕错词和时间交叠明显，不能用作逐句同步验收。`timelineToAudio`继续保持`unverified`；S1逐句同步及S4粒子/灯光原片一致性仍需逐句听核与真实游戏录屏或等效来源。

## N2 实验页返回触控区

输入HEAD `19f4d82`。`ArchiveBackAction`增加图标模式，深色实验页仍显示原箭头、保留动态返回文案为aria-label；Spine单人实验室和Chibi多人舞台都复用同一个最小44×44返回控件。两个实验页之间的顶部切换按钮也改为至少44px高，路由与舞台transport不变。`verify:archive-navigation-state`、`verify:live-chibi-singer-slots`及`build:check`通过，构建仍只生成E盘代码产物。5175 Browser在1280×720实测两个页面的返回与互跳按钮均高44px，实验室→多人舞台→实验室→直达入口Welcome路线可行；带`brndnf`歌曲来源的舞台按钮读为“返回歌曲”，点击回到原歌曲详情。多人舞台无页面横向溢出和console error，仍有已有Pixi Spine旧颜色工具弃用警告。本次IAB不支持临时viewport覆盖，未将390px结果冒称为本次实测；非零safe-area设备和实验页其他工具控件的触控区仍需专门复核。
