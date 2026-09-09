# Reader 产品收口、展示身份与 Full Player 加载契约

日期：2026-09-09；核对基线 `9097cd8`，分支 `codex/archive-architecture-refactor`。
本文件是下一阶段开发计划，本批只更新文档，不表示所列改造已实现或验收。

后续进展：R1 首批已实现并完成桌面/390/320 真页面验证，见
[R1 交付与验收](READING_R1_ACCEPTANCE_20260909.md)。以下设计条目保留作为阶段目标；
R2 纯投影及源数据矩阵已实现，见 [R2 投影记录](READING_R2_PROJECTION_20260909.md)；
R3 公开产物/消费者主迁移已实现，见 [R3 记录](READING_R3_MIGRATION_20260909.md)。
Reader 404 回退及有效译文页面补验已完成，证据见 R3 记录；P1–P5 仍待实施。

## 来源、现状与优先级调整

本轮两份审阅为：用户附件
`C:/Users/windm/.codex/attachments/ea298333-5d7f-4ecf-bb3a-ba48b0ed3018/pasted-text.txt`
中的 Reader/Full Player 审阅，以及用户消息中“文本公开身份—表演主体—视觉主体”的补充。
附件是审阅意见，不自动成为全项执行或发布授权；以下为结合源码后采纳的计划。
Sekai 的外部实现评价沿用审阅提供的参考，本轮没有重新审计其线上代码。

当前改造主线调整为 **R1 Reader 产品收口 → R2 展示身份 → R3 阅读契约迁移 →
P1 资源计划 → P2 分层预载 → P3 局部 buffering → P4 transport/cache → P5 网络验收**。
E1 已完成的纯投影与 shadow 增量保留，暂不继续以零散通道扩展挤占这两条产品主线。
E2 未接管；G 不新增无领域收益的 helper 拆分。正式长稳按用户要求继续后移，不能
以未做长稳阻塞 R/P 设计、实现或短网络验收，也不能把短验收写成长稳通过。

源码核对结果：

| 问题 | 当前证据 | 结论 |
| --- | --- | --- |
| Reader 工具密度 | `src/components/archive/ArchiveStoryReader.vue` 每行渲染“从这里演出”“记住此处”，搜索 sticky，正文 max-width 720px | 首先调整产品交互粒度，不推翻文本/导航基础 |
| unknown 无头像 | `shared/reading/ReadingDocument.js` 的 readingAvatarEntity 只接受 named/idol；readingPresentationSpeaker 清除 unknown 的姓名解析输入 | 姓名保护正确，但头像资格不应依赖它 |
| 行级播放范围重复 | 同文件为每个 row.anchor 写入完整 playback range；`src/core/ReadingPlayback.js` 校验行身份及 source SHA | 数据迁移必须保留版本校验和定位能力 |
| 旧预载扫描 | `src/utils/Preloader.js` 仅扫描 step.state；任务只有背景 Image 与 .skel fetch | 不覆盖 authoritative v2 的完整需求 |
| 百分比含义 | 失败任务也 report，零任务直接 100；`LoadingScreen.vue` 仅接收数值 | 100 是已结束任务比例，不能宣称整集资源就绪 |
| 进入与实际加载 | `src/data/prepareScenario.js` 等 loadPlayer/preloadAssets 后返回；spineSpawnPipeline 随后读取 atlas/skel/texture | 缓存预热、资源可用、实例可渲染是不同状态 |
| ready 兜底 | `src/core/StoryViewer.vue` 有 5 秒发 ready 的兜底及“所有 assets 已缓存”旧注释 | 新契约不能用计时器或注释代替真实就绪 |
| transport | prepareScenario、useVoicePlayer 等存在 Date.now/no-store；voice/lipsync 按需抓取 | 生产缓存策略尚未形成，不能称智能前瞻已完成 |

## R1：以一节剧情为单位的 Reader

先保持 ReadingDocument v1 与现有 route/ReadingSession/唯一 playback controller，
完成可单独审阅的产品改造。普通阅读页：标题、Episode、语言切换、按需查找、
唯一的“播放完整剧情（实验）”、概要、正文。分段选择降为次级导航，不占据正文工具区。

- 移除每行的“从这里演出”按钮；底层定点播放仍供深链、调试与已有调用使用。
- 移除显式书签产品：逐句保存、继续书签、清除记录等 UI 及 Reader 自动读取/写入链。
  不主动清空用户已有 localStorage，也不临时换成自动书签。ReadingProgressStore
  是否删除按实际剩余引用决定；更新对应测试，不能让旧验收迫使已撤销的功能留在 UI。
- 保留 reading_row、搜索定位、语言状态、Player 返回 Reader 的位置恢复；它们不是书签。
- 查找默认关闭，标题区按钮打开，关闭后不留 sticky 工具块。沿用篇内匹配逻辑，
  明确 Esc/关闭后的焦点与高亮清理，不能偷偷抹掉 URL 定位或播放返回锚点。
- 桌面采用约 900–1040px 的内容卡区域，正文另控制舒适行长；白底、青色强调。
  标题、概要、旁白、对白、choice/choice_detail、caption 分别定义表现，不做聊天气泡。
  手机优先 48px 头像与正文；320px 可将正文换到整行，具体值以浏览器验收为准。
- 顶部完整演出必须从本篇合法范围的开头开始，不能借“第一句对白”跳过标题/开场。
  复用 controller 和源 SHA 校验；加载期间可返回，旧请求不得迟到覆盖新导航。

验收：普通正文没有逐行操作；完整演出只出现一个主入口；标题/概要顺序不重复；
原文/中文/双语、搜索开关/上下匹配、无匹配、深链刷新、演出失败、返回定位均正确。
桌面及 390/320px 检查真实渲染、焦点、触控目标、横向溢出和 console。
Reader 路由只加载正文/翻译/头像所需数据，不因显示完整演出按钮提前加载 Pixi、音频或舞台。

## R2：文本身份、表演主体、视觉存在分离

已核实 `public/data/compiled/episodes/1_4_001_00_a.json` 为 strict-v2。
step_id=12（数组 index=11）有 chara_id=047shu，speaker_identity 为 unknown/idol/047shu，
source_name=？？？；entry_snapshot 与 settled_snapshot 均有 visible=true 的
047shu_005_00，face_surprise/hello。第 14、16、20 步也保留 unknown 与同一偶像身份。
因此不是 RAW/compiler 丢身份，不回 RAW 猜、不改 unknown 为 named、不覆盖原文/翻译。

目标职责：

| 层 | 来源与用途 | 禁止事项 |
| --- | --- | --- |
| speaker（文本公开身份） | canonical speaker identity → 姓名与本地化 | unknown 不显示真实姓名，不能因头像可见而解密 label |
| performance（表演主体） | 当前对白步骤的 chara_id 与现有偶像身份字典 → 当前发言实体 | 不从附近角色、首个 Spine、文件名或多人列表猜 speaker |
| visual（视觉存在） | 同步骤、指定观察点的 scene snapshot → 头像资格 | 有 entityId 不等于可见；附近某一步可见也不是本步证据 |

计划中的行投影示意（尚非已发布 schema）：

```js
row.performance = { entityType: 'idol', entityId: '047shu' }
row.visual = {
  entityType: 'idol', entityId: '047shu', presence: 'visible',
  source: 'stage-snapshot', snapshot: 'entry', stepId: 12
}
```

常规舞台对白以该行 entry snapshot 为观察点：chara_id 解析为单人偶像，且对应
Spine 明确 visible=true、没有 silhouette/特殊隐藏证据，才允许正常头像。
entry 与 settled 不一致时不自动选择更“完整”的后者；动画中途、延迟出场或证据不明
需保留诊断，不能以未来状态提前展示。兼容数据由已有 normalization 边界解释，
记录来源/不确定性；不在 Vue 再解析 RAW，也不把缺失 visible 直接当 true。

visual 可表达 visible/hidden/offstage/silhouette/unknown 等语义，最终字段枚举在
schema 迁移时冻结。规则先看文本行种类/媒介，再看当前发言者及视觉证据：

| 场景 | 姓名 | 头像 |
| --- | --- | --- |
| unknown + 047shu 明确可见 | ？？？ | 秀头像 |
| named + 同一演员可见 | 正常本地化姓名 | 对应头像 |
| unknown/named + 不在画面/visible=false | 保留公开标签 | 无正常头像 |
| silhouette 或特殊隐藏 | 保留公开标签 | 轮廓/中性标记或无头像，不能用正常头像揭示 |
| 多人同屏 | 当前发言者标签 | 只匹配当前发言者，不取第一人 |
| narration/title/synopsis/Producer | 各自文本策略 | 无偶像头像；Producer 可用专用标记 |
| 电话、聊天、画外音 | 保留其标签 | 各自 presentation policy；未定义前不借用舞台邻近状态 |

姓名保护也覆盖头像 alt/title、aria-label、tooltip、搜索文本等可读表面：unknown
头像使用中性描述，不能通过辅助文本泄露真实姓名。原始身份保留在结构化证据中。
不为绕过书面保密而改 localization resolver，不直接使用 unknown && entityId。

验收必须包含上述正反例、entry/settled 冲突、缺 snapshot、演员与 speaker 冲突、
头像缺图回退，以及秀第 12 步的原文/中文/双语实际页面。原文、text_ref、source SHA
和 canonical speaker identity 不变；普通姓名和旁白也按 visual policy 验证。

## R3：ReadingDocument v2 与头像投影一起迁移

R2 先确定纯投影与测试；避免先给 v1 偷加必需字段、随后再次全量重写。
R2 的公开 artifact 交付与本次 v2 迁移合批验收，R1 可先独立落地。
v2 将 file/start_step_index/end_step_index 提升到 document.playback，row.anchor
保留 row_id/step_id/step_index 与源证据，并加入 performance/visual。
定点演出通过 document.playback + row.anchor.step_index 组合；顶部全篇演出直接使用
document range。数组下标与 step_id 不可混用，现有 URL 的一基转换集中在播放适配器。

同步更新 generator、manifest、ReadingRepository 校验、ReadingPlayback、Reader 和
相关 verifier。已有 v1 如需过渡，只在 repository 单一适配；不允许各组件猜 schema。
保持 document_id/row_id 稳定及 reading_row 可恢复；artifact hash 更新，源 SHA 仍
指向同一 compiled。旧 artifact/新 consumer 或旧 compiled/新 artifact 组合要明确拒绝
或走已定义的版本适配，不能静默错位。只重生成既有批准范围，保留 21 个 unsupported，
不借 schema 迁移扩大分支支持、strict-v2 发布或 Wiki 批量补录。

## P1：StoryAssetPlan 与可信加载状态

从 canonical/normalized v2 生成纯需求计划；legacy 仅经既有 normalizer 进入。
覆盖 entry/settled、cue payload、当前 dialogue，以及必要的初始/恢复继承状态；
source file/hash、step 身份、资源用途与依赖来源可追溯。相同资源按稳定 key 去重，
同一资源可被多步引用；资源发现与网络加载分离，Preloader 不再读旧 step.state 猜测。

至少列出 background、Spine bundle、BGM、ambient、SE、voice、lipsync、screen/bg
effect texture、image/icon。Spine 是 skel+atlas+atlas 实际依赖纹理的完整依赖组，
不能把一个 modelId 或 skel 下载计为 bundle ready；不能假设只有一张纹理。
若纹理依赖需解析 atlas 才能确定，计划分“逻辑需求/已解析依赖闭包”，未闭合不能
宣称所有任务已知或全部完成。未知资源类别保留 unresolved/unsupported，不当零需求通过。

静态 episode plan 与根据当前入口、range、step、选择路径计算的优先级投影分开。
调试从中段开始、Reader 定点播放、历史恢复、episode queue 都必须得到对应 critical
集合；不用整集第一个 state 代替实际入口，也不预演 choice 或执行有副作用的 cue。

加载状态替代单一百分比：phase、total、succeeded、failed、pending、cancelled，
以及可选后台统计。任务身份/依赖闭包稳定后才展示确定分母；失败或超时不是成功，
零任务也不代表“整集完整”。HTTP bytes、decode/parse、实例可渲染分别建状态。
缓存预热不是资源可用证明；5 秒 ready 兜底只能结束等待并报告超时/失败，不能 PASS。

先交付需求计划与前端进度语义修正，独立核对首篇 strict-v2 和 legacy parity，
再替换实际 preload 执行器。旧注释和 100% 文案与状态迁移同时清理。

## P2：Critical / Near / Deferred 执行契约

Critical：实际入口的 Player chunk、首屏背景、可见人物完整 bundle，以及立即发生的
音频/效果依赖。哪些允许降级必须逐类定义并可见报告，不由任意 timeout 自动放行。
首屏媒体就绪与 renderer 首帧就绪分开：加载必需依赖后可 mount，首帧 ready 后揭示
演出；防止要求 mount 前完成 GPU 实例化造成循环等待。

Near：随当前 step 推进，优先准备后续少量步骤/即将发生的资源。3–5 步或
15–20 秒只是初始候选参数，剧情有用户停留与分支，不能保证精确墙钟时间。
跳转/返回时重排；Deferred：有界并发、低优先级暖剩余确定资源，可取消、不得饿死 Near。

资源执行层负责去重、优先级、取消/重试与缓存；controller 仍是进入/退出/queue/route
的唯一 owner。导航失效后不发布旧 scenario 或进度；共享 in-flight 请求以消费者引用
决定取消，不能因旧场景退出中断仍被新场景使用的资源。不新建第二套导航 generation。
失败要有当前入口的明确重试/返回动作，不依赖全局刷新。

正常 UI 显示“正在准备演出 x/y”及当前必要资源类别；进入后只在必要时显示局部等待。
全篇/near/deferred、decoded 数等只在诊断面板展开。只有将来真的实现“整集完整预载”
模式才使用“整集资源 x/y”，本轮不默认新增该模式。

## P3：准备下一步与提交下一步分离

下一步 critical 未就绪时保留当前画面，使用现有暂停原因机制暂停剧情、音频、自动
推进和相关视觉时钟，显示局部 buffering。ready 后在同一会话/StoryClock 下提交目标步，
不能让语音先播、人物晚到，也不重建播放器伪装恢复。用户暂停/隐藏等原因仍独立保留，
buffering 结束不能清除其他暂停原因；seek/skip/choice/快速返回不得泄漏旧等待任务。
会话累计时间与步骤时间分别处理，沿用现有 clock.elapsed/now 的边界。

不会因一个 404 永久冻结：有界重试后进入明确失败状态并可返回/重试。不借网络缓冲
改写 authored fade、音频顺序、分支或 publication 状态。

## P4：缓存与部署 transport

网络层可缓存压缩 voice bytes，解码层只保留有界的当前/邻近 AudioBuffer；起始候选
current + next 2 + previous 1，必须按实际字节/内存上限验收，不能只按句数假装有界。
缓存需版本键、LRU/预算、in-flight 去重、退出回收；不做整集 PCM 常驻。
压缩缓存与 bounded decode 的接口在 P1/P2 时预留，避免预取被播放器再次请求。

正式 transport 使用稳定内容 hash/version URL，与 HTTP/CDN 缓存头一致；先提供
版本产物与更新策略再移除 Date.now，不能直接关 cache-bust 导致旧内容被错误复用。
immutable 仅用于真正不可变版本资源；目录、manifest、入口文件另设更新策略。
IDM workaround 留在显式本地 dev adapter。此计划不构成上线、CDN 配置或发布授权。

## P5：分阶段验收与记录

| 批次 | 核心验收证据 |
| --- | --- |
| R1 | Reader 真页面桌面/390/320；无逐句工具；搜索、全篇播放、返回锚点；无新增媒体请求 |
| R2/R3 | 身份矩阵正反例；秀未知姓名+可见头像；v1/v2 契约；源 hash/定位稳定；全既有阅读产物验证 |
| P1 | strict-v2/compat 资源需求枚举与运行时消费者对应；依赖闭包/去重/未知类别；失败不计为成功 |
| P2 | 实际入口 critical、near 重排、deferred 限流；快速切换取消；资源缓存被实际 loader 复用 |
| P3 | 缺背景/纹理/语音时保留画面；全部时钟与暂停原因正确；恢复无双播、跳步、过期提交 |
| P4/P5 | 版本更新、冷/热缓存、压缩与解码预算、退出后回收；真实部署设置另行实测 |

网络矩阵必须包括正常网络、高延迟/Fast 3G、404、单个 Spine texture 延迟、voice
延迟、离线后恢复；分别记录冷缓存与热缓存、入口/range、资源类别和失败原因。
统计 click→first-frame、critical 耗时、buffering 次数/时长、资源失败、活跃请求/owner
cleanup、压缩缓存及 decoded bytes。先量基线再约定阈值，不在计划里虚构秒开保证。
故障注入通过受控测试资源/transport adapter 完成，不修改正式源剧情或生产媒体。

现有相关入口：`npm run verify:reading`、`verify:reading-sources`、`verify:playback-controller`、
`verify:archive-async-navigation`、`verify:story-runtime-foundation`、`verify:story-audio`、
`verify:story-playback-range`。按改动增加真实行为用例；预载计划/网络矩阵的专门 verifier
尚待实现，不能列为已通过。源码测试不替代实际页面、资源请求、声音与网络条件验收。

每批独立提交、记录证据与剩余范围。下一批从 **R1** 开始；R2/R3 紧随其后，
不继续增加逐行按钮、显式书签或照搬 Sekai 的功能密度。
