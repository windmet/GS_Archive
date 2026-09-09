# 第二阶段重构交接：从基础稳定转向 Reading 与确定性状态投影

## 最新开发优先级：Reader 与 Full Player 产品契约

用户在 `9097cd8` 后提供 Reader/Full Player 审阅及“名字保密与视觉呈现分离”的补充。
已核对源码并形成 [下一阶段计划](READER_PLAYER_NEXT_PHASE_20260909.md)。**下一批从 R1
Reader 产品收口开始，再做 R2/R3 身份投影与文档迁移，随后 P1–P5 加载契约。**
暂不继续以 E1 零散通道增量替代这两条产品主线；E1 既有成果和未支持范围保留。
逐句播放能力保留但退出普通 UI，显式书签产品计划撤下；reading_row/返回定位保留。
本节是计划更新，不表示 UI、ReadingDocument v2 或 StoryAssetPlan 已实现；长稳仍后移。

## 当前恢复入口（2026-09-09，接续 `24e1cea`）

后文为阶段启动时的历史基线。当前继续工作请先核对 HEAD/工作区，再按以下入口恢复：

- M 手机门户已交付；[路线](MOBILE_PORTAL_READING_ROADMAP_20260909.md)保留设计与验收记录。
- H 展示语义已覆盖歌曲、关系及各门户详情/列表；[展示契约](ARCHIVE_PRESENTATION_CONTRACT_20260909.md)。
  `78f016d` 恢复 313 条真实卡片剧情标题；`24e1cea` 修正 10 张正式卡被教学卡覆盖的详情，
  见 [卡片修复](CARD_DETAIL_CANONICAL_FIX_20260909.md)。
- D 当前主线一、二章 204 个阅读产物，183 可读、21 明确未支持；
  [覆盖](READING_MAIN_COVERAGE_20260909.md)、[篇内搜索](READING_SEARCH_20260909.md)、
  [本机版本化阅读位置](READING_PROGRESS_20260909.md)均已实现。不能称为全库 Reading 完成。
- E1 已有全主线离线投影审计与 Spine tint 的运行时只读 shadow；
  [契约](STORY_PROJECTOR_CONTRACT_20260909.md)、[shadow 验收](PROJECTOR_SHADOW_ACCEPTANCE_20260909.md)。
  背景局部几何现已增加显式纹理尺寸投影与桌面/手机真实 shadow，详见同一投影契约；
  尚无全库纹理尺寸验收。动画、滤镜、粒子及音频副作用等仍有未覆盖范围；中途 tint 的实际帧差异保留。
  滤镜起点采集已推进至 `9097cd8`，见同一契约；浏览器过渡中途帧仍未验收。
  后续 E1 工作按顶部新优先级安排，不能把 partial 改写为完整确定性投影。
- F 播放 controller 已接管既有会话入口，详见 [验收](PLAYBACK_CONTROLLER_ACCEPTANCE_20260909.md)；
  G 后续仍只针对实际编译领域边界，不重启全仓 helper 拆分。
- 本批已关闭卡片修复验收发现的旧 CLI 快照失败，见
  [当前目录生成门禁](STORY_CATALOG_CONTRACT.md)。没有改动公共目录数据或发布状态。

用户明确要求正式长稳继续后移，不阻塞 D/E1 等独立工作；E2 renderer 尚未接管。
仍需区分产品覆盖、纯投影验证、真实媒体与正式长稳，不能据日常稳定反馈写成长稳通过。

日期：2026-09-09。核对代码基线：`876816e2ae9d942804f945ea717f7ca0e5c436fc`。
分支：`codex/archive-architecture-refactor`；本次开始时工作区干净，本地与已知远端引用一致。
本批仅核对现状、调整路线和保存交接，不启动长稳、不实现 D/E、不重编译或发布产物。
用户将在新窗口继续；从本文件进入，不必重新开展全仓微修审计。

## 最新执行调整（2026-09-09 用户补充）

实施进展：M 移动门户与 D1 小样本独立 Reader 已完成本地验收；下一批为 D2/F。
见 [D1 验收记录](READING_D1_ACCEPTANCE_20260909.md)。下文现状表保留本交接起点的历史状态。

用户已明确将 pre-E 正式长稳后移。当前执行顺序为移动迷你手机门户 → D1 Reading →
D2/F 阅读与演出往返 → E1 shadow；pre-E 在 E2 接管前补齐，不阻塞上述开发。
完整边界与 Sekai 审计吸收见 [移动门户与 Reading 路线](MOBILE_PORTAL_READING_ROADMAP_20260909.md)。
用户长期使用稳定的观察不改写正式长稳验收状态。以下长稳 protocol 保留，时序按本节更新。

## 1. 本次转向与历史文档的关系

用户提供了以 `876816e` 为基线的新指导，并明确要求梳理现状、准备下一阶段。
本文件将核实后的建议落实为下一阶段工作顺序，替代总评中“B 优先”的旧推进策略。
各批次历史验证记录继续有效，但不提升其证据等级。D 从此前参考功能方向转为
下一阶段正式交付目标；此处是计划，不能称为已经实现。

| 主线 | 实际现状 | 下一阶段处理 |
| --- | --- | --- |
| A 资源解析 | 共享解析与 HTTP adapter 回归已完成 | 本阶段完成、冻结；出现可复现阻塞才改 |
| B 基础稳定 | B1–B27 完成大量时钟、生命周期与竞态修复 | 阶段性完成、冻结；暂停主动寻找 B28+；不等于全 Runtime 或长稳验收完成 |
| C Story Catalog | C1–C7 完成；src 无旧 story_master_index 消费者 | 本阶段完成、冻结；不再增加 C8/C9；旧索引保留离线输入 |
| D Reading | 未找到独立 Reader 或 reading artifact 实现 | 独立按需文本产物 + 第二消费者，正式启动 |
| E 状态投影 | entry/settled、clock、history 已有；无完整 projectStoryState/renderAt | 最高架构优先级：E1 纯 shadow projector，E2 再接管 renderer |
| F feature ownership | 已到 F16；播放器进入/退出/准备/返回仍由 App 组合 | 下一刀是完整 Story playback controller，不再抽零散 helper |
| G compiler | G1–G25；词表、文本身份、音频状态、严格投影已拆出 | 后续限定真实 RAW command 领域状态变换，不能宣布 G 完成 |
| P2-B | 两次近期短回归，正式 2–4 小时长稳未完成 | 按用户决定后移至 E2 接管前；不阻塞 M/D/E1，失败保留证据 |

这里的冻结是停止主动扩展该线，不禁止 D/E 集成所必需的有证据改动。
暂停 schema v3、Pinia/Vue Router、Story Catalog 扩容以及为了拆文件而继续拆 masterdata。

## 2. 已核实的代码入口与所有权缺口

### D：数据可复用基础已有，轻量消费路径未建立

- `shared/story/ScenarioNormalizer.js` 已提供共用 normalization；
  `src/core/story-runtime/ScenarioNormalizer.js` 是兼容入口。
- `src/localization/story/StoryTextResolver.js`、`StoryLocalizationContext.js`、
  `TranslationRepository.js` 与 `data_pipeline/sidem_scenario/text_identity.py`
  是既有文本身份/显示边界，Reader 不应重新编号。
- `src/data/prepareScenario.js` 会获取完整 compiled 文件，并同时执行
  `loadPlayer()` 与 `preloadAssets()`；因此不能直接复用为 Reader 的加载路径。
- `App.vue` 已将 StoryViewer 设为异步组件，但仍静态引入 Preloader；
  “Reader 自身无 import”不足以证明整页无重型依赖，需检查入口依赖和实际网络。
- 当前 `story_catalog.json` 工作区文件为 2,733,965 bytes（含本地换行格式）；
  不把它当作所有对白的容器，也不据此与历史 LF/gzip 数字直接比较。

### E：快照选择不等于时间投影

- `StepSceneState.js` 只选择 entry_snapshot / state 或应用 override。
- `SceneSnapshotStore.js` 存储运行时访问历史、已选选项、entry/settled/captured 快照；
  不能从这些 API 的存在推导任意 step/time 均可重建。
- `useStoryRuntimeCues.js`、Background/Camera/Screen/SpineCueRuntime 仍执行 cue；
  `SpineStage.vue` 及 manager 仍负责画面更新和资源生命周期。
- `StoryClock.js`、`PerformanceRegistry.js` 和 B 系列 fixtures 是迁移证据与 adapter
  基础，不应为 E1 重新主动扫描每个 wall-clock tween。

### F：准备与队列已拆，编排仍在 App

- `useEpisodeQueue.js` 仅持有队列与游标，不拥有页面、加载、返回和异步有效性。
- `prepareScenario.js` 仅准备数据，不拥有 route、queue 或 loading。
- `App.vue` 中 `loadPlaybackEpisode`、`loadScenario`、`closePlayer`、`onPlayerReady`
  仍协调 currentScenario/file/start/end/instance、preview、returnView、loading、
  navigation intent 与 route 同步；恢复入口也会写这些状态。
- 抽取 controller 时必须接入已有 navigation 有效性与恢复流程，避免形成两个 owner。
  Card preview、episode queue 和 Reader 跳完整播放器的行为都需纳入契约。

### G：内部领域拆分刚起步

- `data_pipeline/sidem_scenario/commands.py`：RAW 名称到处理器的词表。
- `audio_commands.py`：音频状态变换和背景继承；返回 effect/继承标记，
  compiler 保持会话标记与资源提供者的组合。
- `compiler.py` 仍实现背景、角色、screen/camera、selection/jump、文本 step emission、
  voice filename、lip sync、timeline 和 episode/session 状态。
- 下一批先选一个完整领域，声明 state + Values + explicit context → effect，
  不只复制类方法；保持命令顺序、来源位置、异常和 compatibility/strict 输出。

## 3. 新窗口的执行顺序与验收门槛

### 后移至 E2 前：保存 pre-E 真实音频基线

执行依据：`../notes/03_audit/STORY_P2B_SOAK_PREFLIGHT_20260813.md`。
先确认代码仍为冻结基线及实际服务归属，直接使用可用 Browser 入口。
历史 5174 曾被无关站点占用、重构使用 5175；端口不是证据，不要停止无关进程。
新窗口中的 JS 变量/tab 对象不会自动继承，按工具入口正常连接即可，无需反复提示检查。

- 普通真实音频 + `runtimeDebug=1`，不得用 `noAudio=1` 代替。
- 按 protocol 覆盖长 choreography、Choice、Skip、Backlog、0.5×/2×、
  BGM/Ambient/SE/Voice、Page Visibility、episode navigation 和反复进入/退出。
- 不在录制中改变 Runtime 代码或把不同 commit 的记录拼为一个基线。
- 结束返回门户，等待至少 30 秒，QUIET ENDPOINT → STOP → EXPORT；报告放仓库外，
  仓库内记录 commit、URL、浏览器/OS、操作日志、console 边界及报告路径。
- 机器门槛：stopped v2、至少 2 小时、241 总样本、228 interval 样本、2 次完整 viewer
  cycle、最终退出后至少 30 秒的 quiet endpoint，所有 Story owner 活跃计数归零。
- `npm run verify:release-soak` 验证工具；`npm run analyze:story-soak -- <report.json>`
  才分析实际记录。`MACHINE_GATE_PASSED_REVIEW_REQUIRED` 仍需曲线、画面、听感和操作审阅。
- 提前发现单调增长或功能失败即保留失败报告；不得为了凑时长掩盖问题。
  仅修复阻断基线的可复现问题，修后重新标注基线，不顺带开启微修系列。

此前短回归是两份不同证据，不能拼接计时：

| 记录 | 代码基线与覆盖 | 结论 |
| --- | --- | --- |
| `STORY_REFACTOR_REAL_AUDIO_SHORT_20260908.md` | B1–B25 后约 163 秒，2 次 viewer cycle | 短交互/释放证据；INSUFFICIENT_EVIDENCE |
| `STORY_ENTRY_CLOCK_BROWSER_SHORT_20260909.md` | `8e24445`，131,564 ms，11 总样本/4 interval，1 次 cycle | 最新短回归；INSUFFICIENT_EVIDENCE；不证明 B26/B27 专属分支、听感或窄屏布局 |

两文件均位于 `../notes/03_audit/`。本次没有新增长稳或浏览器验收。

### D 的第一批独立交付（不等待长稳）

先选包含 dialogue/narration/choice 的小规模实际 scenario 样本，建立每 scenario
按需 reading JSON 和生成/验证入口。示例 rows 字段为 step、speaker_id、text_ref、
text、has_voice；最终契约需同时保留 scenario/source identity、choice 目标和来源范围。
不为建立 Reader 全量重编译或推广 strict-v2，输入边界需明确兼容与严格产物如何处理。

新增 ArchiveStoryReader，仅消费文本、speaker/avatar 和来源 step，复用 localization
契约；不 import StoryViewer/Pixi/Spine/AudioManager，不执行音频或舞台预加载。
从一行进入完整播放器时才加载该播放器。此接入可与 F controller 整批协同完成。
明确 step_id 与播放器 startStep 的映射，不能未经核对把数组下标当来源 step。

验收：文本身份/选择/来源范围对照，按需独立请求，入口到 Reader 的依赖及网络证据，
无舞台/音频初始化，桌面与窄屏阅读、语言 overlay、跳指定行及返回上下文实测。
不要把 `StoryViewer?noAudio=1` 或“隐藏舞台”作为 D 的实现。

### E1：纯状态投影器，保持 shadow

先写输入/输出契约和时间规则，再实现纯函数。输入来自 normalized v2 与明确的
step/time，输出序列化 background/camera/screen/spines/filters/effects；不访问
Vue、Pixi、RAF、AudioContext、全局时钟或真实资源，不改变现有 renderer 调用链。

需要先解决的契约问题：

1. time 是本 step 相对时间还是 scenario 累计时间；边界、零时长、同刻 cue 的排序。
2. entry、settled 与跨 step 持续效果如何组合，不能偷偷读取正在运行的 manager。
3. 有分支/重复访问时，相同 step/time 是否足以确定状态；若不够，先在规范化的
   投影输入中明确可序列化的已解析历史/上下文，记录限制，不能声称隐藏历史无关。
4. 随机粒子、Spine 动画采样等超出首批范围的内容要显式列出，不伪造完整像素重建。

验收采用 B fixtures 和实际剧情多时间点：entry、cue 前/中/后、同刻 cue、跨步持续、
回看/跳转路径；重复输入一致、输入不变、调用顺序不影响结果。冻结旧行为只作对照，
分歧需回查 canonical semantics，不能把所有旧行为自动当正确答案。
E1 的结果先与现有 Runtime shadow 对照；纯测试通过不代表真实渲染验收。

### E2 / G / F：后续整块迁移

- E2 在 E1 对照与 pre-E 基线证据就绪后，按 background → camera → screen → spine
  visual 接管。逐 channel 指定唯一写入 owner 和旧入口退出条件；Backlog restore、
  seek、previous、step entry 最终共用 projector。每批保留独立回滚与真实媒体回归。
- G 选 background / spine / screen_camera / choice 等真实命令领域，沿用 audio 的
  显式依赖与 effect 模式；ScenarioCompiler 保留顺序、session、step emission、组合。
- F 下一批为 useStoryPlaybackController（暂定名），整体接管加载/进出/队列/返回/
  范围/准备；复用现有 navigation 和 prepareScenario/useEpisodeQueue，不另造状态副本。
  保留路由恢复、快速切换旧响应失效、错误/卸载、同文件不同范围与 preview 行为。

本计划允许独立模块开发，不要求使用多 Agent。先推进移动门户与 D/E1，E2 前关闭 baseline 缺口；
G/F 不能继续挤占这两项交付。不要边录制基线边热更新功能代码。

## 4. 验证入口与交接范围

本次核对代码、历史证据和文档引用，未重跑代码测试；下列是后续按变更选择的入口：

- D：verify:story-text、verify:story-localization、verify:story-playback-range，加新 reading
  contract 与真实浏览器网络/交互验收。
- E：verify:story-runtime-foundation、verify:story-spine-cues、verify:story-stage-loading、
  verify:story-background-loading、verify:story-camera-clock、verify:story-screen-clock、
  verify:story-step-playback-state、verify:story-registry-handoff、verify:story-partial-settlement、
  verify:story-audio；增加 projector 测试，保留 P2-B 实音证据门槛。
- F：verify:episode-queue、verify:archive-async-navigation、verify:archive-startup-route、
  verify:archive-navigation-state、verify:routes，以及播放器进入/退出/恢复的实测。
- G：verify:scenario-package、verify:scenario-resources、verify:story-text 与相关语义测试；
  必要时 verify:compiled-migration / verify:story-schema；临时产物测试不等于发布。

保留 RAW、ignored 真实媒体、worktree、public 产物和 publication ledger；不做全量
媒体复制、全库重编译、部署或 promotion。按可审阅整批验证、提交并推送当前分支，
不创建 PR。交接完成不等于原整体重构完成。

新窗口可直接使用这段任务：

> 阅读 docs/ARCHITECTURE_PHASE2_HANDOFF_20260909.md 与其指向的边界/验收文档，
> 确认 checkout 后按 MOBILE_PORTAL_READING_ROADMAP_20260909.md 推进移动门户、D/E1；
> 冻结 A、B1–B27、C1–C7，暂停微修审计。pre-E 后移至 E2 接管前。
> 随后交付 D 独立 Reading artifact/consumer 和 E1 纯 shadow projector；F 下一刀
> 是完整播放器编排，G 只做真实命令领域状态变换。Browser 能用就直接用。
> 明确区分测试、短回归、长稳和人工审阅，不将交接计划当成已实现功能。
