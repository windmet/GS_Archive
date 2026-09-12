# 2026-09-12 分支审计与新窗口交接

本文件是当前恢复入口。先核对实际 HEAD/工作区，再读取这里列出的专题文档；旧交接中的历史状态不代表现在。用户本轮要求核对新分支、修正偏移、更新文档并交接，不启动下一整批功能。

**后续执行更新（同日）：** 用户已要求继续；标题生命周期修复与本轮验收见文末。上述“不启动下一整批功能”属于前次审计范围，不是当前停止指令。接下来进入 P1 需求边界核对，原生后台事件及系统 reduced-motion 补验仍单列保留。

## 检出与提交范围

- 仓库：`E:/Web_build/SideM_Archived`；前端目录：`web_viewer`。
- 当前分支：`codex/p1-effect-texture-deps`。审计输入 HEAD：`c0904259fd2df21612f2713e1d8786d97833604c`。
- 已 fetch origin；审计开始时本地与同名远端一致。旧分支 `codex/archive-architecture-refactor` 的 `4bc5d7e` 是比较基线，不要切回去覆盖新工作。
- 新增四提交：`8867549` 特效纹理依赖；`2c9dc36` v9 CSS 标题动画；`9f00784` 通信 UI 依赖；`c090425` 依赖审计补充。
- 用户未跟踪设计稿 `docs/sidem_title_fx_css_rebuild_v9.html` 保留，不属于本次提交。其他 worktree 不处理。
- 本交接所在提交是在上述输入之上的审计修订；用 `git log -1` 确认交接提交，不将输入 HEAD 误当最终 HEAD。

## 当前进度：已经实现与仍未实现

| 主线 | 核对结果 | 下一步 |
| --- | --- | --- |
| 手机门户 / 展示契约 | 既有成果保留，本轮四提交未重做这些模块 | 不重新设计门户；保留真实 315 背景方向 |
| Reader R1–R3 | Reading v2；本轮来源校验仍为 204 份、183 ready、21 unsupported | 保持文本身份/表演主体/视觉存在分离；unknown 的姓名不能泄露 |
| Reader 产品 | 普通 UI 已撤下逐句播放与显式书签；深链、搜索和返回定位保留 | 不能因旧交接恢复书签或旧工具栏 |
| E1 / F | 只读 projector/shadow 与 playback controller 回归通过 | E1 仍 partial，E2 未接管；不继续无边界拆 helper |
| P1 特效 | 映射区分 bg/screen handler，禁用 cameraflare 与未实现特效保留诊断；共享真实纹理 URL | 这是需求发现进展，不是效果渲染全验收 |
| P1 通信 | 共享 URL helper、复用 presentation context、按 step 扫描通信背景/icon/stamp/emoji | 线性历史及原文扫描的覆盖边界仍需补验 |
| P1 atlas | 既有逐页加载及依赖展开回归通过 | 特殊模型、配置/回退及计划到执行器的闭包仍未完成 |
| P1 加载状态 | `src` 尚无 createStoryAssetPlan 消费者；旧 Preloader 仍在使用 | 可信任务状态、失败/取消/重试、入口 ready 尚待接入 |
| 标题动画 | 保留 CSS v9；已接入共享暂停、步骤归属与 generation 内的 cue 结算续进，完成行为回归与 Browser 交互检查 | 原生后台事件、系统 reduced-motion 设置仍需补验；模拟路径已通过，详见文末 |
| P2–P5 | 未形成分层执行、局部 buffering、统一 transport/cache 和网络验收闭环 | 保持原路线编号，不将代码存在写成产品交付 |

路线仍以 [Reader/Player 产品契约](READER_PLAYER_NEXT_PHASE_20260909.md) 为准：
**P1 资源计划与可信状态 → P2 Critical/Near/Deferred → P3 局部 buffering → P4 transport/cache → P5 网络验收。**
正式 pre-E 长稳继续后移；日常长时间稳定的用户反馈不能改写为正式长稳通过，也不能反过来用长稳阻塞当前工作。

## 本轮修正与未关闭风险

1. **已修正：标题前进请求跨步骤残留。** `StoryViewer` 的 currentStep watcher 现在清除 `titleAdvancePending`。测试直接执行生产回调，覆盖离开标题后进入另一标题的场景。没有改变 v9 美术表现。
2. **已纠正文档：** 旧交接的书签现状与 P2/P3 合并编号；特效/通信已实现部分补记为当前进展；共享 URL 不再被注释宣称能保证完整发现。
3. **标题暂停缺口已复现并修复。** 菜单暂停时原有七个 CSS 动画仍运行至 2760ms；模拟 visibility 暂停时旧代码会继续进入对白。现由同一 runtimePauseReasons 驱动 TitleUI 的整组 CSS 暂停，隐藏界面保留同一组件实例。Browser 菜单、backlog、界面隐藏恢复及模拟 visibility 检查通过，原生环境限制见文末。
4. **标题 settlement 卡住已复现并修复。** 给真实标题步骤附加 30 秒 screen.fade cue，旧代码在显式结算后停留于淡出标题。现由运行代次内的结算完成回调唤醒当前步骤的续进请求；导航、销毁和旧标题事件不能推进下一标题。生产构建的同一边界 fixture 已进入后续对白。
5. **通信 parity 的证据有限。** 扫描采用 `historyStack: []` 与 `dialogue.source_text`。verifier 已有不同历史产生不同 context 的 fixture，但整库对比仍沿用同一 resolver/线性输入，不能证明任意分支历史、显示译文标记和全部聊天消息都已覆盖。先从真实 MobileChat/MobileCall 消费输入独立核对；无法确定的需求保持 unresolved，不凭 chara_id 猜完整闭包。
6. **特效 verifier 的异常吞噬已修正，真实渲染仍待验收。** 继续执行时改用合法的内存 PIXI.Texture，分别检查请求、Sprite/TilingSprite 初始化数量、一次 tick 和销毁后的 ticker/frame 清理；无全局 unhandledRejection 吞噬，warn/error 保持输出且使校验失败。注入对象创建失败、未处理 rejection 均以 exit 1 失败。该证据是合成纹理下的 CPU 对象生命周期，不是实际 PNG 解码或 GPU 渲染。

## 本轮验证证据（2026-09-12）

已通过：

- `verify:story-asset-plan`
- `verify:effect-texture-parity`（仅请求级，限制见上）
- `verify:communication-assets:source`：204 份，3308 个通信 step，6071 条需求；线性对比 divergence 0；**204 个 plan 仍 open**。其中 communication-without-unit 46、communication-without-character 513。未解析不等于网络丢失。
- `verify:title-transition`：静态契约 + 本轮新增生产导航回调执行测试；不等于浏览器动画验收。
- `verify:reading-sources`：204 份产物校验，183 ready / 21 unsupported。
- `verify:story-projector`、`verify:playback-controller`、`verify:spine-atlas-pages`、`verify:story-runtime-foundation`、`verify:shared-scenario-normalizer`。

源码构建通过：Vite native config、`copyPublicDir:false`，输出 `.analysis/audit-20260912-build`，避免复制本地媒体库。2497 modules；主入口 525.79 kB，保留超过 500 kB 的构建提示，未在本轮扩展为 bundle 优化。
本轮未启动真实浏览器验收、未做真实媒体长稳、未发布站点、未重编译/灌入剧情数据。既有 dist 或旧 localhost 不作为本轮验收证据。

## 新窗口按此执行

1. `git status --short --branch`、fetch、核对 HEAD 和本文件；保留未跟踪 HTML。确认本机服务实际端口/PID，不能沿用历史 5175 的假设。
2. **标题生命周期代码与本轮可执行验收已完成，保留两项环境补验。** 见文末；不要重新实现暂停或引入标题计时器。后续有支持原生后台事件/系统 reduced-motion 的浏览器环境时补验，不将模拟检查改写为原生事件已验证。沿用用户 v9 设计。
3. **接着收口 P1 的剩余需求边界。** 独立核对通信消费者与分支历史、修正特效探针证据，列出特殊模型/配置回退未闭合项。只在有真实消费者证据后解除 pending/unresolved。
4. **再接 P1 执行与状态，逐批进入 P2–P5。** 区分 discovered/fetched/decoded/renderable、failed/cancelled；进度不能把失败计成资源 ready。定义取消、迟到响应隔离和重试，再替换旧 Preloader；不要一次性合入整个加载重构。
5. 每个可审阅小批做适当验证、显式路径 commit、推送同名分支；不默认开 PR 或部署。更新本交接或新增有明确入口的新交接，保留未验收事项。

补充约束：Wikiwiki 是用户既有补字参考，尚无本轮批量导入授权需求；缺字工作仍应保留来源和文本边界。Sekai 审计的借鉴继续落实在轻量 Reader、消费者驱动依赖、可信加载和故障可见性上，不为模仿成熟项目扩展无关框架。

## 继续执行：标题生命周期修复与验收（2026-09-12）

输入 HEAD：`61a8449`。仍在 `codex/p1-effect-texture-deps`；未跟踪 v9 HTML 保留。

实现：

- TitleUI 接收暂停状态，根动画及所有子动画一起暂停；start/complete/cancel 携带所属 step。
- Viewer 复用 reactive runtimePauseReasons；挂载时读取初始 document.hidden。界面隐藏时保留标题实例，以 visibility 隐藏并暂停，恢复不重播开场。
- 标题完成请求绑定 step，并等待真实 cue settlement Promise 完成；暂停中不推进。Runtime 回调校验 generation；导航/销毁清除请求，旧卡片取消或完成事件不影响新卡片。
- 没有增加定时器，没有修改 v9 关键帧、美术尺寸、剧情文本或数据产物。

验证入口与证据：

| 范围 | 结果 / 边界 |
| --- | --- |
| `verify:title-transition` | 执行生产 Viewer 回调及真实 Runtime scheduler/handle，覆盖暂停、结算期间暂停、重复完成、overlay 竞态、连续标题归属、手动 next、销毁和 frame 清理 |
| `verify:playback-controller`、`verify:story-runtime-foundation` | 通过 |
| Vite native 构建 | 2497 modules；copyPublicDir:false，仓库外 build-final；保留主入口 >500 kB 提示 |
| Browser 入口 | `mcp__cua_repl` 内置 Browser 可用，用户纠正后改用它；无需另装 Browser。早期复现用过已有 Playwright/Edge，不代表后续浏览器入口缺失 |
| 真实页面 | `http://127.0.0.1:5175/?scenario=episodes/1_4_001_00_a.json&start_step=5`；1280×800、390×844、320×740 |
| 页面 / 布局 | 标题与后续对白均可见，无框架错误遮罩；document scrollWidth 分别等于 1280、390、320。截图已在本次任务显示 |
| 交互 | 菜单 / backlog 停留超过原 2.76s 后标题仍在；关闭恢复。320px 隐藏/显示 UI 后继续同一标题。模拟 visibility 暂停时 step index=4、clock=2.0169 保持不变，恢复后继续；手动 next 从标题进入 2/23 过渡再到 3/23 对白，返回按钮可在标题期间离开到首页 |
| 生产构建 fixture | 仓库外本地服务 5181，使用真实组件与真实 episode 的内存副本；30 秒 cue 结算后进入 3/23 对白；连续两个标题后进入 3/23 对白，无跳过 |
| reduced-motion | 仓库外服务模拟 matchMedia 并启用对应 CSS 媒体分支；标题保持静态（无 play class），手动下一段有效。不是 Windows 系统设置验收 |
| Console | 标题检查未见页面异常；后续角色出现时有两条来自 Spine.update / Spine.tint 的 warn 调用栈，保留记录，不宣称全静默 |

环境补验：Browser 的 visibility.set(false) 及切换内置标签未提供已确认的 document.hidden=true（诊断仍 visible），所以本轮证明的是生产 visibility 处理入口的模拟路径；真实 OS 后台/恢复事件和系统 reduced-motion 偏好仍未验收。没有做真实音频长稳或发布。

临时 fixture/server/build 位于 `C:/Users/windm/.codex/qa/sidem-title-20260912/`，不提交测试媒体或截图。下批仍先核对通信消费者/分支历史、特效探针异常，再接 P1 执行状态；不可据标题修复宣称 P1 完成。

## P1 特效校验修订（标题批之后）

- `verify:effect-texture-parity`：通过；覆盖两种 domain 的现有探针、disabled/unmapped 行为、真实 PIXI 对象创建与清理，无假纹理警告。
- `verify:story-asset-plan`：通过。
- 负向验证：注入 Sprite 添加失败时，雨效果对象数量断言失败（exit 1）；注入未处理 rejection 时进程失败（exit 1）。不再把异常当作成功的请求证据。
- 本批只修改校验与交接文档，不改变 renderer、资源映射或产品视觉。真实图片和 GPU 验收继续单列。
- 通信消费者独立阅读发现需核对的具体差异：MobileChatScene 的显式 step.stamp 会覆盖正文；只有整条文本恰为 stamp marker 才走 stamp，混合文本中的相同 marker 在 MobileMessageBubble 走 emoji URL；显示译文与 choiceTexts 也参与实际消息图片请求。后续执行测试确认 step.stamp 已由计划主循环收集，问题是额外扫描了被覆盖的正文，不能将其称为显式 stamp 遗漏。旧 corpus 对比复用同一 helper，不能独立证明上述覆盖。

## P1 通信源文本需求修订（特效校验批之后）

输入 HEAD：`0b2365d`。执行 MobileChatScene 的生产 stepToMessage 与 MobileMessageBubble 的生产 messageParts，预期 URL 不调用计划的 marker/helper；测试先复现显式 stamp 覆盖正文后仍多算 emoji。

- 修正整条 stamp / 混合文本的分类：混合文本里的 image_mobile_stamp_* 标记按实际 Bubble 消费者记录为 emoji URL；只有整条文本匹配 stamp 才记录 stamp URL。
- 显式 step.stamp.id 覆盖消息正文时不扫描被隐藏的正文；stamp 仍由计划主循环收集，未重复添加需求。
- 独立 fixture 覆盖显式 stamp、整条 stamp、混合 stamp-shaped emoji、重复 emoji、非法 inline marker 保留文字；每项验证 strict-v2 和 compat-v1。
- corpus 对比明确标为同 helper 的线性一致性检查，删除任意历史 superset 已证明的表述；发现 divergence 现在必须断言失败，不能仅打印数字。
- `verify:communication-assets`、`verify:story-asset-plan`、`verify:communication-assets:source` 通过。204 份、3308 个通信 step、6071 条线性需求、divergence 0；204 个 plan 仍 open，without-unit 46、without-character 513。本批没有改变真实 corpus 的资产总数，修正由边界 fixture 证明。
- 本批没有修改渲染消费者或接入旧 Preloader；不主张新的浏览器/网络验收。完整分支历史、累积消息在不同 context 下重投影、外部译文和 choiceTexts 仍需处理，随后才接 P1 执行与可信状态。

## P1 legacy / 内联译文 / 选择回复依赖（源文本修订之后）

输入 HEAD：`5db3337`。纯计划复用已有无副作用的 LegacyDialogueAdapter 和 StoryTextResolver；不 fetch 外部 overlay、不执行 choice、不修改消费者。

- 原文来源按 source_text → text_jp → text，内联 text_cn 按原文、译文、双语三种显示方式取并集。整条 stamp 与 LocalizedTextBlock 的 primary/secondary inline 图片分别扫描，避免双语下遗漏 emoji 路径。
- 有 chat 的 scenario 枚举所有可选回复的 source selection record，并按 Producer 消息的 inline emoji 规则记录；即使当前线性 choice 在 call 中，后续 chat 的回复图片也能发现。uses 保留 stepIndex/stepId/optionIndex，不替用户选择分支。
- 涉及通信的 choice 保留 communication-history-dependent；具有 text_ref.unit_id 的聊天消息/选择回复保留 communication-translation-overlay-pending。这些不是下载失败；待运行入口的真实 history 和已校验 translation overlay 参与需求闭包时再解除。
- 九组消息 fixture 覆盖 strict/compat 和三种语言模式；生产 historyMessages 回调验证选择回复始终按 Producer/非 stamp 投影；验证 source 不变及 option 来源。外部 overlay 未提供的 fixture 必须保持 dependenciesComplete=false。
- `verify:communication-assets:source`：204 份，3308 个线性通信步骤，线性旧子集 6071 条需求；生产 stepToMessage + messageParts + LocalizedDisplay 共 78 次图片 URL 检查，漏项 0。此证据限定为直接入口 context 下的原文/内联译文消息，不包含任意分支重投影或远端译文。
- `verify:story-asset-plan` 与 `verify:story-asset-plan-sources` 通过。实际在 7 篇中新增按篇去重 14 条 emoji 需求，例如 1_4_001_06_b 的 stepIndex=38 / stepId=39 的 image_talk_emoji_01。不是 14 个跨篇唯一文件，也不是 14 个下载成功。
- 204 个 plan 仍 open：history-dependent 64、translation-overlay-pending 11、without-unit 46、without-character 513；Spine 等现有 pending 仍保留。本批无渲染变化或新的浏览器验收。

下一批需要将已校验本地化显示和真实 history 的需求纳入执行输入，并独立核对 call caller 与 chat 历史头像；同时保留特殊模型/配置回退和真实特效渲染的未验收项，继续朝 P1 执行状态接入推进。

## P1 通信 caller / avatar 消费者对照

输入 HEAD：`e19339b`。独立执行 MobileCallScene 的 charaId computed 及 MobileChatScene 的 stepToMessage，首先复现只有姓名的 caller 未被发现。

- Call 按真实消费者优先级：step.chara_id → dialogue.speaker 姓名表 → scene context，通话背景和 profile avatar 使用同一 caller。
- Chat 按每条消息的 presentation context、stamp actor、step actor、speaker identity、姓名表及现有继承规则识别头像；Producer 消息不要求头像。不能把 scene primaryCharaId 无条件当作 Bubble avatar。
- 非标准消息角色 ID 可随当前 history context 改变头像，新增 communication-history-avatar-pending；fixture 验证保留此项，本次 204 篇的直接入口扫描未产生该诊断。不代表任意历史已经验收。
- 六个独立 actor fixture 覆盖姓名 caller、直接 ID 与 context 冲突、聊天姓名头像、stamp actor 优先、Producer 无头像及旧角色继承。
- `verify:communication-assets:source`：204 篇，5146 次 caller/background/avatar 存在性对照漏项 0，原有 78 次消息图片对照漏项 0。按篇 mobile-icon 从 382 减为 367，通话背景仍 348；更正后的线性 surface/source 子集为 5800 条。
- `verify:story-asset-plan` 通过。204 个计划仍 open；分支历史 64、外部译文 11、缺 unit 46、缺 character 513 继续保留。本批没有改动 Call/Chat 的渲染规则，也没有把消费者一致性写成资源下载或网络可用性。

下一步转向 P1 执行输入与状态：把这些已发现逻辑需求映射为真实任务，并明确未闭合项、取消/迟到响应、失败和重试；结合已有消费者加载器推进，避免继续只扩展无调用者的静态校验。

## P1 导航取消接入（执行状态第一批）

输入 HEAD：`9cf4722`。导航 intent 持有 AbortSignal，切换、关闭及销毁先撤销旧发布权，再取消旧工作；信号从 playback controller 经 prepareScenario / App 传入现有 Preloader。

- 剧情 fetch、skeleton fetch 及完整响应体读取支持取消。每个预载任务的超时也中止实际适配器；图片取消移除 src 和事件监听器，清理定时器及 abort 监听器。
- 取消后不启动后续批次、不回写旧进度，不把过期 AbortError 显示为当前播放错误。动态 import 本身不能取消，但准备流程不再等待它，也不会发布过期结果。
- 新增 `verify:story-preload-cancellation`：本地真实 HTTP 服务保持剧情/skeleton 响应体打开，验证切换与关闭会断开请求；验证无后续批次、无迟到进度、发布权先撤销、预取消不启动、超时信号及等待 import 的取消。图片清理使用 Image 测试替身，不能据此宣称真实浏览器图片请求已中止。
- 专项测试、`verify:playback-controller`、`verify-archive-async-navigation.mjs`、`verify-reading-playback.mjs` 及 diff check 通过。Vite native 构建通过，2497 modules；输出仓库外 `C:/Users/windm/.codex/qa/sidem-preload-cancel-20260912/build`，不复制媒体，保留主入口超过 500 kB 提示。
- 再次实际确认 `mcp__cua_repl` 内置 Browser 可用；核对 5175 的 PID 45024 命令属于本仓库后打开首页，完成首页 → 门户点击、DOM、截图与日志读取。无错误遮罩，仍有 Spine.update / Spine.tint 两条 warn。此项是 Browser 可操作性与导航冒烟，未模拟慢网或证明浏览器取消完整链路。

下一批仍需将 StoryAssetPlan 接入真实执行输入，并替换旧百分比的失败语义。当前 Preloader 仍扫描旧 state 子集、仍将非取消失败计入已处理进度；不能把它描述为资源 ready 或 P1 完成。真实图片取消、计划闭包、可信状态与重试、后续 P2–P5 验收继续待办。

## P1 预载结果与前端进度语义（取消接入之后）

输入 HEAD：`dbae877`。按 P1 先交付前端进度语义修正的顺序，当前执行范围仍是 legacy 背景 / skeleton 预热子集，本批没有扩大为整集资源执行器。

- 每项记录 discovered / loading / image-loaded / fetched / failed / cancelled；每份报告包含 phase、total、succeeded、failed、pending、cancelled 及不可回溯修改的 task 快照。scope 为 legacy-cache-warm，dependenciesComplete 固定 false，不能将总数当作整集闭包。
- 图片 onload 只记 image-loaded；skeleton 完整非空响应体只记 fetched，不声称 decoded、parsed 或 renderable。HTTP 失败、空响应、图片错误、超时不再被吞成成功。取消与失败分开，待启动的任务也归为 cancelled。
- 报告经 prepareScenario / controller 真实传到 App。导航失效、关闭及新播放清除旧报告；旧回调不能覆盖新报告。原数字回调仅保留兼容内部调用，计成功预热比例，零任务不再上报 100。
- LoadingScreen 移除百分比和确定进度条，显示“正在准备演出…”及已预载 / 失败项数；Player 保留可展开的失败提示及原因，提示位于顶部导航下方。当前仍沿用 best-effort 进入，关键资源阻断、重试与首帧 gate 属于待实现部分，不能把可见失败提示当作完整故障恢复。
- `verify:story-preload-status` 使用真实 HTTP 验证 404 / 空体，Image 事件替身验证图片成功 / 失败与清理；检查去重、历史报告不变、失败不抬高百分比、零任务语义。取消测试新增 9 项 cancelled 及 controller 不接受过期报告。playback-controller、archive-async-navigation、reading-playback 均通过。
- Vite native 生产构建通过，2497 modules，主入口 528.22 kB（保留大小提示）。仓库外 build / 临时 fixture 服务位于 `C:/Users/windm/.codex/qa/sidem-preload-status-20260912/`，未修改真实剧情或媒体。
- 页面验收使用 5182 的生产构建，数据 / 媒体转发至本项目 5175。fixture 是真实 strict-v2 episode 的内存副本，仅在 legacy state 注入一个等待 8 秒后 404 的背景，实际验证等待文案 → 失败 1 项 → 展开原因；这不是整集资源闭包或慢网全流程验收。
- 故障页面检查 1280×800、390×844、320×740；scrollWidth 分别等于 viewport width。390px 截图先发现提示覆盖导航，修正 top=64 后在 320 / 1280 复验返回可用；320px 返回首页后提示消失。切回未改动的 episodes/1_4_001_00_a.json 后无失败残留，菜单能打开。保留已有 Spine.update / tint 两条 warn，无新增应用错误遮罩。

下批直接推进 StoryAssetPlan 的真实来源 hash / 执行输入和资源适配器，不再扩展旧 step.state 扫描。仍需闭合 Spine atlas pages、模型适配与通信动态依赖，并逐步接入 P2 的入口优先级 / 重试、P3 的局部等待、P4 transport 和 P5 网络验收。Browser 直接用于验收，不再重复说明可用性。

## P1 资源计划接入真实准备流程

输入 HEAD：`f391f56`。prepareScenario 在来源校验完成后，以本次响应原始字节的 SHA-256 和 file 生成 StoryAssetPlan，动态加载计划模块；Reader 原有 SHA / 行身份校验继续先于媒体导入和预载。取消覆盖响应读取、摘要 / 计划模块等待及播放器导入等待，迟到结果不发布。

- App / Preloader 实际入参已从 steps 改为 plan；删除 scanStepAssets，不再扫描 step.state。strict-v2 依据 entry / settled / cues；compat 只经已有 normalizer。发布给 Viewer 的原始 scenario 不被计划生成修改。
- 新增 StoryAssetAdapters：背景、stage icon、通信背景 / 头像 / stamp / emoji、特效图片走已有消费者 URL；普通 spine-skeleton 走 native fetch。已知 silhouette-only 模型不探测缺失 skeleton，等待模型适配；atlas、bundle、音频、配置等未适配需求明确 deferred，不假装执行。
- 任务报告保留计划 key、source、uses、dependencies / dependencyState、unresolved；required:false 记 excluded，不下载、不计成功。total 是当前逻辑条目数，pending 包含 deferred；dependenciesComplete 只沿用逻辑计划，不代表 fetched / decoded / renderable。仍不展示整集分母或声称全部就绪。
- `verify:story-plan-preparation` 验证含空白原始响应 SHA（不是 JSON 重序列化 SHA）、来源先于媒体、strict snapshot / cue-only 实际任务 URL、旧 state 冲突不执行、用途记录、图片适配、excluded / unsupported 不执行、真实 episode 原始字节输入。
- `verify:story-preload-status` 改用计划，成功 2 / 失败 3 / deferred 6 的 fixture 明确保留 bundle / atlas 待处理；空逻辑计划可 dependenciesComplete=true，但不等于渲染就绪，仍不上报 100。preload-cancellation、story-asset-plan、playback-controller、archive-async-navigation、reading-playback 均通过。导航测试改用真实 Response 和有界条件等待，保留读取对象及竞争条件断言。
- 生产构建通过：2501 modules，主入口 531.22 kB，保留 >500 kB 提示。构建和临时服务在仓库外 `C:/Users/windm/.codex/qa/sidem-plan-execution-20260912/`。
- 5183 生产构建 fixture 使用真实 strict-v2 episode 的内存副本，在旧 state 放入 must_not_use_legacy_state，在末步 cue 加入等待 8 秒后返回 404 的 status_fixture_missing。服务请求记录证明：旧 state 背景未请求；cue-only 背景被请求；普通背景与 3 个 skeleton 被请求。页面显示已预载 4 项，随后失败 1 项，可展开原因并返回。
- 1280×800 与 320×740 检查无横向溢出或错误遮罩；原始 episodes/1_4_001_00_a.json 能进入 3/23 对白、打开菜单，无 fixture 失败提示残留。日志仍保留既有 Spine.update / tint 两条 warn。无真实音频长稳或发布。

下一批处理 Spine atlas 页依赖与特殊模型适配，把 deferred 逐类变成有证据的任务，继续保留 bundle 未渲染状态。通信外部译文 / history、音频 transport、入口分层 / critical 重试、首帧与局部 buffering 仍待推进；当前仍为 best-effort 准备后进入，不宣称 P1 或 P2–P5 完成。

## P1 atlas 页执行与静态剪影适配

输入 HEAD：`6dfc144`。预载现在读取普通模型 atlas 的完整响应体，以共享 decodeSpineAtlasText / readSpineAtlasPages 规则解析，并按原始 atlas 字节 SHA 调用已有 resolveSpineAtlasDependencies 扩展计划。

- atlas 记录 atlas-parsed；新页保留完整相对路径 key、atlasSource.sha256 / page / modelId 和 bundle uses，加入有界队列。初始批次不足 6 项时仍执行新追加的任务；原输入计划与早期报告不被回溯修改。
- SpineTextureUrl 与舞台共享页 URL 策略：先 HEAD 检查原页，单页可检查 comu.png 回退，多页禁止将缺页别名成同一张 comu.png。任务同时保留逻辑 page 和最终物理 URL。解析/页下载不等于 skeleton binary 解析或 GPU readiness，bundle 继续 deferred。
- resolveStaticSpineModels 只依据现有 isSilhouetteOnlyModel 白名单，将这类 bundle 改为依赖 silhouette PNG，原 skel / atlas 标记 excluded。没有将其他模型的运行时失败推断为 PNG-only，也没有修改舞台显示政策。
- 失败 atlas 不解除闭包；atlas 成功而某页失败时，逻辑依赖可以已闭合，但任务明确 failed，bundle 仍 pending。取消覆盖新发现页的 HEAD；退出后不再启动它的 Image 加载。
- 新增 `verify:story-spine-preload`：真实 HTTP atlas / HEAD、受控 Image 事件，覆盖双目录同名页、缺第二页、多页不回退、单页回退、atlas SHA 与 step 用途、畸形路径、短批次追加任务、剪影不访问 rig、新页 HEAD 中取消。不是 synthetic PNG 的真实解码证明。
- `verify:story-preload-status`、`verify:story-preload-cancellation`、`verify:spine-atlas-pages`、`verify:story-plan-preparation`、playback-controller、story-stage-loading、reading-playback 通过。取消 fixture 现在是 17 个预载任务（8 skel + 8 atlas + 1 image），初始 5 个二进制请求被终止，bundle 的 deferred 不算 cancelled。
- Vite native 构建通过：2502 modules，主入口 535.51 kB，保留大小提示。产物 / 临时服务在仓库外 `C:/Users/windm/.codex/qa/sidem-spine-preload-20260912/`。
- 5184 的生产构建使用真实 episode 内存副本，仅在末步 settled spines 增加白名单剪影模型，start_step=12。请求记录含 047shu / 001tom / 004ter 的 skel、atlas、页 HEAD 与 PNG GET；102sha_001_00 只请求 silhouette PNG，无对应 rig 请求。
- 1280×800 中实际角色正常显示，unknown 姓名仍为 ？？？；390×844 从 1/16 推进至 2/16 白文，scrollWidth=390，无错误遮罩或预载失败提示。保留已有 Spine.update / tint 两条 warn。预载后舞台仍重复 GET 部分资源，尚未验证缓存命中或性能改善。

下一步继续处理模型配置与其他未适配需求，并将实际入口 / range 纳入 P2 的 critical 集合和恢复动作。完整音频、通信动态上下文、bundle parse / renderer readiness、局部等待、transport / 缓存仍待实现或验收；未做正式长稳，不宣称整个 P1 已完成。

## P1 配置预载与模型级口型回退

输入 HEAD：`885a71a`。五类固定配置（placement、body types、motion、prefab metadata、costume dictionary）现已接入原生 JSON 预载；固定 URL 与原 Store / AssetResolver 共用，沿用既有 cache 选项，不声称共享内存缓存已建立。

- 计划新增按 actor/model 区分的 model-mouth 子任务，idol-mouth 只保留逻辑依赖组。模型前缀 / 偶像候选顺序通过 MouthSettingCandidates 与真实 LipSyncController 共用；同一演员的不同模型不再混作一份口型配置。白名单剪影的 mouth 子任务 excluded。
- 配置在 JSON parse 和消费者结构字段检查后记 json-parsed。placement 检查有限 positionY，索引检查 dataList / entries / models / by_model_resource_id，mouth 检查非空 mouthes；不保证索引覆盖每个模型、骨骼名匹配或舞台已采用该数据。
- 口型仅在 HTTP 非成功时尝试下一候选，保留 attempts URL / status 和成功 URL。网络错误、解析错误、空 mouthes 不触发偶像回退，与现有消费者一致；失败仍可见，取消不会触发后续回退。逻辑组不计为又一份成功 JSON。
- 新增 `verify:story-config-preload`：真实 HTTP 与真实 LipSyncController 对照 primary 成功、HTTP 回退、坏 JSON、空配置、网络断开；另验取消、同 actor 多模型、剪影跳过及当前磁盘 metadata 结构。相关 plan、atlas、预载状态 / 取消、stage-loading 与 reading-playback 验证通过。
- 204 篇来源校验通过：新增按篇去重 model-mouth 828 项，204 个逻辑计划仍 open；history 64、translation overlay 11、without-unit 46、without-character 513 保留。没有更新编译剧情或媒体。
- Vite native 构建通过：2504 modules，主入口 537.30 kB，保留大小提示。仓库外构建 / 服务在 `C:/Users/windm/.codex/qa/sidem-config-preload-20260912/`。
- 5185 生产构建的原始 episodes/1_4_001_00_a.json / start_step=12 页面，请求记录包含 3 人 placement / mouth 和 4 个全局索引，进入对白无配置失败提示，下一段可用，unknown 姓名仍受保护。仍有既有 Spine.update / tint warn；仍有预载后消费者重复请求，不能声称缓存或性能改善。

本轮页面检查新发现并对照确认的既有问题：窗口缩放后 Spine 不重排。当前构建首次截图角色偏左，下一段及稳定视口重载恢复；上一批 885a71a 的独立生产构建（5184）同样可复现“390px 定位角色 → 放大到 1280px → 角色停留旧横坐标”。PixiStageManager._observeResize 源码明确为保留拖拽位置而不重排 Spine，因此不将这次配置批记为首帧 / 缩放全面通过。

下一批优先修复故事舞台的缩放重投影，保留 Spine Lab 拖拽语义且不重播 cue / 覆盖暂停或结算状态；再继续 P2 实际入口 / range、critical 失败恢复，以及音频和通信上下文的未闭合项。总体目标继续进行，P1–P5 尚未完成。

## 故事舞台缩放重投影修复

输入 HEAD：`116d089`。StoryViewer 显式启用 SpineStage 的 responsivePositions；其他舞台默认保留像素位置，不将布局行为绑定到诊断 releaseOwner。

- ResizeObserver 按角色最近一次定位的视口重新投影 x / y，保留显式故事 baseline 和宽度比例下的 posY；不重跑 applyState、不重播 cue、不改 pose / scale / alpha。Spine Lab 默认保留手动拖拽位置。
- 正在移动的角色投影起止点并使用最后一次采样的 eased progress；缩放不采样或推进 StoryClock，不新建 RAF，不重置时长。取消与移除清理对应投影记录，暂停期间不恢复移动。
- 新增 `verify:story-stage-resize`，使用真实 manager / StoryClock、受控 ResizeObserver / RAF，覆盖固定 baseline、窄宽往返、暂停中移动、完成 / 取消、移除及 Lab 默认像素行为。position-clock、stage-loading、playback-controller 和 spine-atomic-fade 检查通过；后者两处旧源码断言更新为包含既有 isCurrent 守卫，不代表新增 GPU 淡入验收。
- Vite native 生产构建通过：2505 modules，主入口 537.30 kB，保留大小提示。仓库外产物位于 `C:/Users/windm/.codex/qa/sidem-stage-resize-20260912/`。
- 5186 生产构建使用未修改的 episodes/1_4_001_00_a.json / start_step=12。真实页面由 390×844 放大到 1280×800，角色在同一段对白重新居中；菜单打开后缩到 320×740 再关闭，仍为 1/16，无横向溢出。最终显式 prop 构建再验 320 → 1280，同样居中且对白不推进。保留既有 Spine.update / tint warn，无新增错误遮罩。
- 浏览器验证范围为静态角色与菜单暂停时的布局；移动中缩放和 Lab 保留位置由上述受控测试验证，未执行实际 Lab 拖拽、原生后台切换或真实音频长稳。

下一批回到 P2 实际入口 / range 的 critical / near / deferred 分类及失败恢复；音频、通信动态上下文、bundle renderer readiness、局部 buffering、transport / 缓存仍待推进。总体目标继续进行，P1–P5 尚未完成。

## P2 实际入口投影与分层执行顺序

输入 HEAD：`87d558b`。此前 controller 没有把 startStep / initialStep / endStep 交给准备流程；现在通过 playbackEntry 传入，预载与 useStoryNavigation 共用 StoryPlaybackWindow 的 synopsis 跳过、episode 推断、range clamp 和初始位置规则。一基入口是数组位置，不当作 authored step_id。

- 静态 StoryAssetPlan 保持不变。独立 StoryAssetPriority 按实际 entryIndex 的所有已发现用途保守标 critical（包含该步 entry / settled / cues），后续最多 3 步为 near，遇 choice / flow.advance=choice 停止，不选择分支或执行 cue；其余 deferred。此处尚未进一步区分入口一步内部的延迟 cue。
- Preloader 状态记录 projection 和各项 priority，与任务 state 分离；critical bundle 仍可能是 deferred renderer-pending。执行同层最多 6 项，当前层结束才启动低层；atlas 动态发现页按用途继承优先级，首屏页面不会排到后续人物之后。
- 新增 verify:story-asset-priority：非连续 step_id、实际 prepare 参数、默认 synopsis、范围截断、choice 边界、原计划不变、受控 atlas 等待及动态页排序。原真实 HTTP 取消 fixture 现在首先启动 critical skel / atlas 两个请求及一个 Image，关闭后全部终止；17 项 cancelled 保留，near 不启动。
- playback-range、plan-preparation、preload-cancellation / status、spine-preload、config-preload、playback-controller、archive-async-navigation、reading-playback 全部通过。构建 2507 modules，主入口 539.10 kB，保留 >500 kB 提示；产物及临时服务位于 `C:/Users/windm/.codex/qa/sidem-priority-20260912/`。
- 5187 生产构建使用原始 episodes/1_4_001_00_a.json；start_step=12 / end_step=15 / at_step=13 实际显示 2/4 正确对白，上一段回到 1/4 并禁用，1280×800 角色居中。请求记录含入口 047shu 页 GET 在其他人物 rig 之前。页面保留既有 Spine.update / tint warn，无错误遮罩。
- at_step=14 的另一轮观察在语音启动后变成 4/4，日志证明先进入了第 14 步，但尚未定位其随后推进原因；不据此宣称音频自动推进验收通过。第 13 步无语音入口及上一段边界用于本批页面验收。

当前仍等待所有可执行预热结束后 best-effort 进入；没有宣称 critical readiness gate、后台 deferred、动态 near 重排、共享缓存或重试已经完成。下一批接入当前入口失败的重试 / 返回及 critical 与后台工作的生命周期分离；首帧 gate 必须保持媒体准备与 renderer readiness 两阶段，未适配音频 / 通信依赖继续显式保留。总体 P1–P5 继续进行。

## P2 当前入口失败阻断与恢复操作

输入 HEAD：`649f785`。实际优先级执行中，只要一个批次出现 critical failed，就停止启动后续批次并报告 phase=blocked；未执行任务保留 discovered，不虚报成功或取消。prepareScenario 在此结果下不发布 scenario。尚未适配的 deferred / renderer-pending 不是失败，也不是就绪证明，本批没有把这条边界扩充成完整首帧 gate。

- controller 保存失败请求的 file / returnView / options，提供 retry / canRetry；重试取得新的导航 intent，不复用 Reader / route 恢复传入的旧 intent。来源校验 readScenario、initialStep / range、queueCommit 都保留，队列仅在成功后提交。
- 新导航、退出、预览和 reset 清理过期恢复状态；失败前尚未 publish 时，返回仍使用失败请求自己的目的地。旧导航回调不能重新发布错误或恢复按钮。
- App 的来源错误 / critical 预载错误显示可点击“重试载入 / 返回”，可展开失败资源；320px 实测修复 fixed 面板 shrink-to-fit 导致的按钮竖排，设定宽度和 nowrap，保留顶部导航。
- 新增 verify:story-entry-retry，受控图片失败覆盖阻止 mount / 低层启动、失败 inherited intent 后重试、Reader 重新验证、入口范围不变、queue 仅提交一次、返回 / 其他导航清理。playback-controller、asset-priority、preload-cancellation / status、plan-preparation、reading-playback、archive-async-navigation 通过。
- Vite native 构建通过：2507 modules，主入口 540.19 kB，保留大小提示。仓库外产物 / 临时服务位于 `C:/Users/windm/.codex/qa/sidem-retry-20260912/`。
- 5188 生产构建 fixture 是真实 strict-v2 episode 的内存副本，背景仅在首次请求返回真实 HTTP 404，后续提供真实 PNG。实际失败时无播放器挂载，点击重试后在 start=12 / end=15 / initial=13 的 2/4 正确对白进入。最终布局 320×740 无横向溢出，返回清除提示；1280×800 另验证不存在剧情 URL 的来源解析失败有恢复按钮。未修改真实剧情 / 媒体，未做长音频验收。

本批重试重新读取来源并执行计划，尚非复用缓存的失败项增量重试；未执行的 critical 仍需下次重试处理。正常成功路径仍等待全部可执行预热。下一批继续 critical 与后台生命周期分离、当前步 near 重排、媒体准备 / renderer ready 两阶段及缓存复用；音频和通信动态依赖未闭合项保留。P1–P5 继续进行。

## 用户优先插入：虎牙道 ep5/ep6 人物遗漏修复

用户要求先核查并解决《核查状态机问题.md》中的两处缺人，再继续加载工作。基线9eb5e54，已从具体原始命令证实：idol_slidein 被映射到普通 slide，只改位置，无法恢复淡出后的 visible；不是列表整体覆盖。分离 slide/in/out 可见性语义，并对本地 e30–36、f15–19 及 aggregate 应用经旧/新编译器匹配的 roster 差量，保留步号、对白、语音和其他状态。

详见 `docs/THEKOGADO_EP5_EP6_ROSTER_AUDIT_20260912.md`，包含原始命令索引 / SHA、忽略产物的可复现修复脚本、测试和 Browser 对照。实际 e31/e32、f16 已恢复漣左少年右；正常 f26→28 对照仍双人。此批未调整滑动 delay/起始位置/缓动，也没有原始视频逐帧验收，不宣称全部演出时序一致。具体缺人问题已修复，接下来继续加载首屏/后台生命周期工作；总体目标仍在进行。

## 用户插入：Reader 排版 A 批与全剧情覆盖 B 批

用户提供 Reader 硬换行 / main pilot 覆盖的分析并要求着手处理；两个目标均纳入后续工作，加载任务在此之后继续。

A 批：新增纯显示 ReadingTypography.reflowReadingText，仅用于 ArchiveStoryReader 主文/副文插值。ja/zh 单换行直接拼接，其他 locale 以空格连接；CRLF 统一，双换行及带空白的空行保留段落。source_text / text_ref / source_hash / 锚点 / 翻译匹配 / 搜索输入不改。正文宽度从42em放宽到min(100%,52em)，保留pre-wrap但改break-word、strict line-break和normal word-break。

验证：新增 reading-typography 测试，包含真实1_4_001_00_a第13步及原文对象不变；实际Vue SSR检查该句不再含原textbox换行，原文/译文/双语unknown身份保护及行锚点检查通过；reading-playback通过。native构建2508 modules，主入口540.44 kB，保留大小提示。Browser直接检查5175实际Reader，在1280×800正文两句连续呈现；390×844随容器自然折行，scrollWidth=390；篇内查找“から、今日まで”跨原换行命中1处。该批没有重生成ReadingDocument。

B 批尚未完成，不把A批当作全剧情推广：现有204文档仍未扩张。现场inventory：catalog resourceIds有磁盘episode文件 main204 / event396 / unit_story540 / idol_story390（共520个resourceIds）/ extra2；birthday152、work637、card342等大量输入是非episodes文件。下一批应以published catalog的source关系和ReadingDocument.status投影可用性，记录不支持/缺失，不仅改main_section列表。除App main条件与closeStoryReader外，ReadingContract的source_file也强制episodes/前缀，archiveRoute写Reader返回上下文也仅保留main，均需一并处理。通信贴图与不完整choice继续unsupported，不为覆盖率伪造正文。先落实B，再继续Player加载工作。

## Reader B1：发布目录发现与通用入口扩展

输入 HEAD 212f18d。本批推进 B 的来源与通用入口基础，替代上段“仍为204份”的现状；专属页面与通信覆盖尚未结束。

- ReadingCatalog 从 story_catalog.entries 的已发布父文件及实际 episodes 边界发现正文；整文件也可生成，不扫描目录冒充已发布。strict-v2 继续要求 authoritative publication registry。记录缺失来源、拒绝越界路径和 episode/aggregate 身份错配。
- 生成2734份文档：ready2419、unsupported315。按域 ready/unsupported：main183/21，unit_story540/0，event362/34，idol_story416/2，birthday151/1，work637/0，card_scenarios94/248，extra36/9。另缺少 episodes/1_2_001_12.json，单独写入 public/data/reading/coverage.json。不能据此声称全剧情或完整通信覆盖。
- 通用 StoryCollection 与 StoryDetail 按 manifest ready 状态提供入口；详情页只有一个阅读按钮，多分段在 Reader 内切换。Reader 选择器限制为同一 logical_id，避免列出2734项。config/reading-samples.v1.json 现在仅是回归样本，不决定生成范围。
- Reader 接受安全的根目录整文件来源；App 恢复、URL及导航状态保留非主线 storyType/storySection/story。无section时返回原story_detail，有section时返回原story_collection。Browser 实测发现并修复了 applyArchiveRoute 遗留的 main-only 判断。
- 校验：2734份源文件重新生成一致性 --check；reading全套（目录发现fixture、正文hash/anchor、repository、导航、演出和Vue SSR）；真实整文件生日来源hash/完整演出范围；archive-routes与story-collections。构建在仓库外 C:/Users/windm/.codex/qa/sidem-reading-catalog-20260912/build，保留入口chunk大小提示。
- Browser5175：THE虎牙道第3话ep5从目录进入正文，选择器10段，刷新后返回原组合及章节；生日1_x_001tom_1_8_001_01从详情进入整篇，刷新后返回原详情；1280及390宽检查无横向溢出，console无error。未对2734篇逐篇视觉或媒体验收。

下一步：将已生成正文接到活动/工作/个人/卡片等专属页面的自然入口，保留各自返回上下文；通信来源需独立识别及贴图/分支处理，不能直接从文件库存扩充。完成Reader用户插入项后，继续加载任务的critical与后台生命周期分离。未PR、未部署；本地compiled仍是忽略产物，v9 HTML保持无关未跟踪。

## Reader B2：活动页面入口与返回

输入HEAD dc7dc83。活动详情的每个分段按source_file对应manifest，仅ready显示独立阅读按钮；unsupported保留原播放器入口。沿用event、parent路由字段及currentEventId/eventParentView，Reader和Player(return=reader)都保留来源活动；刷新后返回活动，再返回其原父页面。普通Reader入口清理无关event，避免串页。活动阅读目录失败提供重试。

验证：36个活动396个分段均对应正确的父文件，362份ready正文全部可由活动页面分段路径到达；Vue SSR验证ready/unsupported按钮区别；App导航及Reader→Player→Reader/刷新测试验证event与parent保存；archive-routes通过。Browser5175实测430018「運命光年」ep1阅读→刷新→返回原活动，390px再打开ep2；1280/390无横向溢出，窄屏阅读按钮约68×58px，console无error。构建2509 modules，入口542.32kB，既有大小提示保留；仓库外产物sidem-reading-event-20260912/build。没有宣称活动媒体全部验收。

下一步继续工作、个人、卡片专属入口及通信来源；工作组件已定位ArchiveWorkStory.vue，短剧情使用story.compiled_file，场景台词使用line.compiled_file，当前选中偶像在currentCharacterId；返回还需保留工作页与偶像上下文。之后继续加载路线。整体目标未完成。

## Reader B3：工作短剧情与场景台词

输入HEAD 6a5e73e。ArchiveWorkStory按compiled_file匹配ready正文，短剧情和场景台词均有独立阅读按钮。工作来源复用storyType=work、idol、story路由字段：Reader/Player(return=reader)及返回工作页保留偶像和来源文件；Work组件由来源文件恢复短剧情/场景台词页签，普通Reader清理无关偶像。进入新的工作档案或切换偶像清理旧来源文件。没有新增媒体加载路径。

验证：49名偶像的196篇短剧情、441条场景台词全部映射到637份ready正文；导航测试覆盖work/Reader URL和工作页来源文件保留；演出往返/刷新测试覆盖偶像上下文；Vue SSR覆盖两类入口及返回页签；archive-routes通过。Browser5175冬马短剧情「大衆向けアニメのお仕事」阅读刷新后返回原偶像；场景「テレビ局スタジオ」阅读刷新→返回→工作页刷新均保留场景台词页签。1280×900和390×844截图与DOM检查无横向溢出，console无error。构建2509 modules，入口543.78kB，保留原大小提示，仓库外产物sidem-reading-work-20260912/build。未声称637篇逐篇媒体验收。

下一步个人/卡片专属阅读入口、通信来源与unsupported边界，之后继续Player加载的critical/后台生命周期路线。整体目标仍未完成；v9 HTML继续无关未跟踪，未PR/部署。

## 用户截图复核：虎牙道ep6第30步遮挡

用户暂停个人/卡片/通信新增入口，改为先修剧情与活动资源，再继续加载时序。原始scenario_1_1_013_03_f给039mcr设置idol_priority=1；已发布第30步保持该值。旧SpineStage将数值升序投影为Pixi绘制顺序，令道流盖住两侧角色，与用户提供的原演出截图相反。本批按源深度降序投影到Pixi背到前顺序，保留同深度源顺序和没有显式priority时的既有行为，不修改坐标、模型、编译正文或媒体。

verify-story-spine-order覆盖三人桥段、相同深度稳定顺序及源数组不变；构建2510 modules通过。Browser5175实际start_step=30/end_step=43显示同一句“この、離せっ！”且道流被漣和タケル遮挡，符合截图；仅验证遮挡关系，不宣称全演出时序逐帧一致。后续检查運命光年ep2的01jup图标路径、活动重复logo及北斗缺少正式立绘登记。

## 運命光年ep2入口资源修复

入口失败来自image_icon=01jup/layer=2：预载及舞台都调用偶像头像路径image_chara_icon_01jup.png，实际01jup为组合代码，本地已有units/logos/image_unit_logo_01jup.png。新增共用getSceneIconUrl，组合代码解析为unit logo，偶像代码仍为chara icon；必要资源门槛不放宽，原编译文件不修改。scene-icon解析回归、asset-plan与entry-retry通过。Browser实际打开episodes/1_3_30018_01_c.json进入5/26翔太对白，Jupiter标志成功显示，缺失图标不再阻断；未宣称ep2全部镜头/坐标通过，目前此镜头有原有取景裁切待加载/舞台路线继续复核。

## 活动页图像链路修复

红框后加载图标是ArchiveEventDetail在完整宣传banner上又绝对定位一个event-logo图片，非浏览器重复下载导致；移除该独立img、计算URL与样式，不改变banner本身。北斗回退头像来自正式registry只登记冬马/翔太：本地RAW/asset/image_chara_event_story_visuals.unity3d包含003hok Sprite，使用现有candidate提取及promotion脚本完成正式登记，不用临时候选URL或换脸替代。源bundle SHA b2c586614b404c0fffb6103ba331a8700f6b1f9089880d228adf5cc8fd10f8e8，Sprite path_id -3495293882974298537，输出594×796，PNG SHA 61859ca8ca805e662d97b9c82d6b9739acfc8e1979c9c704439325f00577a478。备份.analysis/raw-migration/character-image-backups/event-story-hokuto-20260912。

正式PNG、registry及tracked-binary清单一并提交。RAW promotion验证（53个正式登记）与185个PNG库存校验通过，SSR覆盖无重复logo，构建2510 modules通过。Browser430018活动页确认event-logo节点为0，三人event-story-visual均complete且naturalWidth>0，截图北斗完整立绘与另外两人一致。ep2修复提交d5149b0的TLS推送失败已通过单次openssl后端重试成功，不改变全局Git配置或关闭证书校验。

个人/卡片/通信新增阅读入口按用户指示停止。下一步回到加载时序主线：critical与后台预热生命周期分离，以及实际ep2镜头裁切需单独复核；上述4个具体问题按三批完成，不将入口可播放扩写成所有演出/时序通过。

## 加载时序：critical与后台预热分离

输入HEAD cf0b399。Preloader新增entryOnly选项，先处理所有critical任务（包含atlas新发现的critical纹理页），在进入低优先级批次前返回entry-warmed与幂等startBackground续跑函数；续跑闭包沿用相同plan/outcomes，已完成资源不会重跑。prepareScenario仍等待来源验证、Player模块和critical结果；Controller发布Player后启动续跑。默认完整预载API行为保留。

每次准备有独立AbortController，跟随导航撤销，reset也可独立取消；回调同时检查intent和warming signal。后台失败保留partial明细，不变成入口失败、不重新打开loading；重置期间取消首屏也不产生retry错误。不会将entry-warmed宣称为renderer/GPU/audio ready，尚待动态当前步近邻重排及完整媒体就绪门槛。

新增verify-story-background-preload（接入verify:story-entry-retry）：可控后续图片未完成时Player已发布、critical只执行一次；后台成功/失败不变导航；后台reset及critical准备中reset取消无迟到错误。entry-retry、plan-preparation、playback-controller、preload-cancellation/status、spine/config-preload、reading-playback均通过。构建2510 modules通过，仓库外sidem-background-20260912/build。Browser活动430018 ep1经正常入口进入冬马/翔太对白并返回原活动，console无error；不提供无冷缓存对照依据的提速百分比，不把受控测试当真实全媒体压力测试。

下一步继续当前步与后台优先级/两阶段媒体ready、缓存复用及ep2取景裁切；个人/卡片/通信新增Reader入口仍停止。整体加载路线未完成。

## 加载时序：随播放位置重排后台任务

输入HEAD 7d9c115。StoryViewer发出带playbackInstance的实际currentStepIndex，App接到当前Controller。Controller验证实例、播放范围及取消状态，再以当前源数组索引重算StoryAssetPriority；不使用可能不连续的step_id代替索引。Preloader.updatePriority仅更新discovered任务，正在下载的批次继续，已完成任务不重跑；动态atlas新增页继承最新projection。后台新提升为critical的资源失败仅产生partial，不回滚成入口blocked或丢弃余下队列。后台结束释放update回调，避免后续步号把settled状态改回warming。

验证：新增verify-story-background-priority，12个不同背景且非连续step_id的受控源，从第一批near任务暂停时跳到第11步，确认bg10先于旧deferred任务、bg11随后、每资源只执行一次；当前步资源失败仍完成其他任务，abort后更新被拒绝。Controller回归覆盖旧实例/越界事件忽略及完成后不再改状态。entry-retry/background、asset-priority、playback-controller、preload-status/cancellation、spine-preload、reading-playback通过；构建2510 modules、主入口545.20kB，产物在仓库外sidem-background-priority-20260912/build。Browser430018 ep1从7/34冬马对白推进到8/34翔太对白再返回，console无error；真实网络提速比例未测量。

下一步媒体/renderer就绪条件与缓存复用、ep2镜头裁切复核。正在下载批次不抢断；此批不能代表GPU/audio ready或P1–P5全部完成。个人/卡片/通信新增Reader仍停止。

## 加载时序：同背景请求共享完成结果

输入HEAD 7b8f973。核查ready链路发现BackgroundManager在纹理下载前写入currentBgId，第二次相同ID请求直接返回，导致运行时调用方提前收到完成。现在同ID请求等待原transition.finished，包含纹理下载及淡入；失败、取消均返回同一终态。下载期间收到duration=0的落定要求，记录settleOnLoad，图片到达后立即落定，不启动原淡入，不重复下载。

新增受控回归覆盖同ID下载未完成、已加载但淡入未完成、下载中落定、失败、取消；背景加载/属性时钟/效果生命周期及runtime-foundation全部通过。Vite构建2510 modules通过，主入口545.20kB，既有chunk提示保留；产物C:/Users/windm/.codex/qa/sidem-background-completion-20260912/build。Browser5175活动430018第二话进入5/26，推进6/26后返回原活动，console无error；当前窄屏截图背景、翔太、Jupiter标志均显示。没有冷网络或全媒体长测结论。

整体ready仍未闭合：StoryViewer挂载后预热/5秒兜底emit ready并不证明场景完成；SpineStage ready目前也仅证明manager构造完成；App导航onFinish与publish提前清除loading。下一批需要共同设计入口场景、运行时背景快照、人物投影及实例隔离的就绪/失败门槛，不能只删超时或等待构造事件冒充GPU/audio ready。此批仅修正背景层提前完成，未改播放器ready门槛；ep2镜头裁切仍待复核，个人/卡片/通信Reader扩展仍停止。

## 加载时序：人物投影后启动运行时时钟

输入HEAD bb3c921。Runtime原先只等待manager构造，会在SpineStage异步元数据/人物加载与初始姿势设置期间开始镜头、淡入、音效，既消耗演出时间又可能被迟到的初始定位覆盖。现在Stage暴露isSceneProjected(expectedStep)，沿用既有projectedStep和当前props.step身份；Runtime捕获当前投影对象，等到该步投影结束才应用运行时入口快照并启动共同cue时钟。无场景快照的步骤不额外等待人物；原isSpineReady复用该身份判断。沿用generation/managerFrame撤销机制，等待期间阻塞Auto，不增加第二套人物状态。

verify-story-stage-readiness新增manager存在但人物未投影时不启动、旧步投影不能放行新步、暂停加载与销毁撤销；runtime-foundation和背景加载/属性时钟/效果生命周期通过。Vite2510 modules构建通过，产物C:/Users/windm/.codex/qa/sidem-projection-clock-20260912/build，既有chunk大小提示保留。Browser5175活动430018第一话正常进入7/34冬马对白并推进8/34翔太对白，窄屏截图人物背景完整，console无error。

本批不宣称全场景/GPU/audio ready：投影结束仍可能存在异步剪影图片、背景纹理和独立语音准备；Stage现有资源失败降级也未改成统一错误门槛。StoryViewer旧ready及App loading发布关系继续待修，ep2取景裁切待复核。整体目标保持进行中。

## 用户原片复核：運命光年ep2镜头Y方向与错误身份浮层

输入HEAD31f03b5。用户提供ep2开头原片截图，指出翔太上移裁切、左上角Jupiter常驻，并补充人物也应随镜头放大。此前d5149b0仅修复图标URL并把显示成功当作正确行为，判断不充分；本批撤销该渲染假设。

原始文件E:/BaiduNetdiskDownload/SideM/scripts/scenariodata/1_3_30018_01/scenario_1_3_30018_01_c.json，SHA256 044592414fe6b56f99aa6e6151e06a5ff0d8f03c49f89ab8e2750a77cabae9e9。命令索引4为camera_zoom [0,0,0,90,1]，5为image_icon [01jup,01jup,2]，11为翔太idol_position [002sht,0,60]，22为camera_zoom [0,0.5,0,90,1.3]。编译值保留一致，未改剧情文件。

CameraController原targetY以负号使用offset_y，而角色game coord明确以向上为正转换到Pixi。改为centerY*(1-zoom)+offset_y*width/1280*zoom，使源坐标中的相机目标点在缩放后仍映射屏幕中心；X不变，不增加角色专属补偿。背景和人物层仍共享1.3倍。Browser实际data-stage-debug显示bgScale=spineScale=1.3，翔太baseScale=0.26、effectiveScale=0.338，未取消同步放大，也未叠加第二次1.3。

移除SpineStage按image_icon/layer自行构建的左上角scene-icon DOM/CSS；源metadata仍保留，编译器注释不再声称其必为头像文件。StoryAssetPlan不再生成此舞台图片依赖，并移除无其他使用者的scene-icon解析器/adapter。组合资料/偶像资料/通信图标保留其独立消费者。P1文档已纠正，旧smoke源中的image_icon只作为元数据。

回归覆盖队标与社长、空/非空layer/string均不生浮层依赖且源不变；相机正负Y/1、1.3、2倍/1280×720、1968×1060、390×844，目标点居中与背景人物同步缩放；沿用暂停/速率/取消回归。camera-clock（现含scene-icon）、asset-plan、entry-retry/background、stage-readiness通过。构建2510 modules通过，主入口545.12kB，产物C:/Users/windm/.codex/qa/sidem-camera-icon-20260912/build。

Browser5175横屏第二话正常到5/26，头部回到画面内、无队标，推进到6/26；1280无横向溢出。截图与用户原片画幅、动作时刻不同，本批不宣称逐像素或逐帧还原。总体媒体就绪门槛继续待做。
