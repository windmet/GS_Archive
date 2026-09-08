# Story 状态与生命周期边界

2026-09-08，重构 B1–B3。此表描述现行代码，不宣称完整任意时间重建或全量真实画面验收。

## 从来源到执行

| 状态/动作 | 生成与兼容解释 | 运行时 owner | renderer 执行 |
| --- | --- | --- | --- |
| 背景 entry/transition | Python `ScenarioState` / `authoritative_scenario`；legacy 经 `ScenarioNormalizer` | `useStoryRuntimeCues` 应用 entry，`BackgroundCueRuntime` 执行 cue | BackgroundManager |
| 镜头 entry/transform | 同上，`camera_zoom` → `camera.transform` | `CameraCueRuntime` | CameraController |
| 黑幕/fade/wipe | `screen_*` → snapshot/cue | `ScreenCueRuntime` | ScreenEffectManager |
| 角色实例、位置、模型、基础姿态 | entry snapshot（legacy 回退 state） | `SpineStage.applyState`：模型加载与场景投影 | PixiStageManager / SpineManager |
| delayed face/body/neck/tint | RAW idol 命令 → timeline → v2 Spine cue | `SpineCueRuntime`：目标就绪、执行、结束/取消 | manager 的 updateSpineFace/playSpineAnim/playSpineNeckAnim/setSpineColor |
| 背景 filter/blur/color、非 fade 屏幕效果 | 现有 step scene state | `applyStepSceneState`，由 SpineStage 调用 | 相应 manager |
| SE | `se_events` → cue | `SeCueRuntime` | 共享 StoryAudioSession 上的 AudioManager |
| Voice/BGM/Ambient | dialogue/state/音频引用 | useStepSceneEffects/useVoicePlayer adapter | StoryAudioSession 生命周期 |
| cue 时间、暂停/速率 | v2 cue 的 at/duration/lifecycle | EffectScheduler + StoryClock | adapter 不另建 step 时间线 |
| 历史/分支/恢复 | entry/settled snapshot、choice identity | StoryViewer + SceneSnapshotStore + useStoryNavigation | prepareRestore 路径应用快照并抑制 cue 重播 |

`SpineCueRuntime` 只接收 cue、step、manager accessor 和当前导航 generation；
它不解析 RAW、不创建调度器、不拥有下一步导航。显式可注入 RAF、时钟、timeout
和 motion lookup，以便测试慢加载和取消，生产默认仍使用现有浏览器 API。
原 `useStoryRuntimeCues` 的 `settleSpineNeckCue` 导出保留兼容转发。

## 本批实际复现与修复

旧版总调度器内的 `performWhenReady` 请求 RAF，却不保存返回句柄。
当 entry 预期有角色而模型尚未就绪时，cleanup 后仍有 1 个 callback；
只有下一次动画帧检查 generation 时才退出。新测试在原代码和仅机械提取后
均以 `1 !== 0` 失败，修复后无需下一帧即可释放。

第二个失败场景为“模型未就绪 → Skip settlement → cleanup”。原
`createPerformanceHandle.transition` 遇到已有 settlement Promise 会直接复用，
使取消不能执行。现在 cancellation 可抢占 settlement，过期完成/失败不能再
将句柄改回 settled/failed；重复取消只执行一次回调。异步 start/pause/resume
也不得在取消后恢复活动状态。

Spine adapter 负责释放自己的 readiness RAF、等待 Promise、颈部 fallback
timeout 和临时 complete listener。step-change/load-step 继续保留颈部最终姿态；
cleanup 等取消仍清理 neck track；Skip 仍将 neck track 定格在 animationEnd。
不改变 body 动画参数、motion lookup、5 秒模型等待上限或颈部 250ms 容差。

## 可重跑证据

`npm run verify:story-spine-cues` 使用真实生产模块、可控帧/计时器与 renderer test
double，覆盖：

- 四个 committed RAW timing fixtures：实际 Python 编译 compatibility/strict，
  与 JS normalizer 的目标、动作值和 stage 时长对照；cue 保留 command_start；
  严格 cue 进入新 Spine adapter 并核对 renderer 调用。
- 角色未加载时退出、Skip 后退出、切到下一步后旧模型迟到、缺失目标 fail-open。
- future cue 不在 entry 执行、stateful Skip 落地、history restore 不重播 cue。
- face/body/tint/neck-play/neck-stop 参数与正常执行；颈部 natural/fallback/Skip/
  step-change/cleanup 释放计时器和 listener；模型超时不虚构目标。
- pending settlement 被取消后迟到 resolve/reject、异步 start/pause/resume 结束后
  不复活句柄、cancel-before-start。

相关现有门禁：`verify:story-runtime-foundation`（含 clock/snapshot/choice/播放模式）、
`verify:story-playback-range`（导航范围）、`verify:story-timing-semantics -- --source-only`、
`verify:story-audio`、`verify:story-schema`、`verify:release-soak`。

这不是像素、真实 Spine 资产加载或实音长稳测试。没有证据说明此前用户遇到的
所有显示错误均由这两个生命周期问题引起。

## 后续仍需完成

B2 已补充模型发布的场景归属检查，B3 已移除 metadata 完成后重复投影并接入
entry readiness，见下节；跨 channel 的中间态与完整长稳仍未完成。

1. 按属性继续核对 entry 与 delayed cue 的中间态；B3 已覆盖 Spine 慢元数据、
   复用模型、换步和 entry-ready 后动作顺序。仍需扩展暂停后恢复及图片/镜头等
   异步资源，现有测试不覆盖所有 channel 的真实组合时序。
2. 将未知 RAW/legacy 字段的诊断连接到稳定来源位置，逐类扩展语义回归；不要
   把当前 compatibility normalization 的存在等同于所有命令已正确支持。
3. 建立统一 state plan / renderAt 之前，对 background、camera、screen 和
   Spine 的过渡中间态分别建立证据；现有 entry/settled 尚不等于任意时刻状态。
4. 独立 reading model、named catalog、App 导航拆分和 Python package 迁移仍按
   `ARCHITECTURE_REFACTOR_20260908.md` 推进。P2-B 实音长稳仍未完成。

## B2：异步模型发布归属

`SpineStage` 将已有 `applyStateToken` 的有效性以 `isCurrent` predicate 传给
`PixiStageManager.spawnSpine`，没有新增另一份导航状态。manager 在开始前与资产
加载结束后检查它；过期对象只销毁自身，不进入舞台或调试实例表。未传 predicate
的独立模型查看器保持原有调用契约。

旧 `applyState` 在 await 返回后发现过期，会调用 `removeSpine(sid)`。如果新步骤
的同角色模型先完成，这会删掉新实例。该清理已移除：未发布对象归 manager 释放，
当前场景实例归当前投影管理。仅靠 manager 的 per-id spawn token 仍不够，因为
切到空场景时不会发生下一次同 ID spawn，旧加载也必须被场景 generation 拒绝。

`npm run verify:story-stage-loading` 从生产 Vue 源码提取 `applyState`、从 manager
提取 `spawnSpine` 执行，以可控资产 Promise 和 renderer double 验证以下路径：
新模型先完成、旧模型先完成、导航到空场景、离开剧情、旧加载失败、直接调用、
开始前即过期。恢复旧按 ID 清理后测试报 current model 被删除；去掉加载后场景
检查后测试报 departed character 被发布。测试不复制两段生产实现，也不验证像素。

本批 stage-loading、spine-cues、runtime-foundation 与 source-only Vite 构建通过。
CI 加入 stage-loading。内置浏览器对 `1_3_10001_01.json` 做了真实资产冒烟：
标题推进至三角色场景、下一段文本更新、上一段文本恢复，稳定截图中三角色均存在，
没有 error 日志或框架错误层。检查为窄面板、`noAudio=1`；不是桌面/移动端完整矩阵，
也未在浏览器中人为延迟资源来复现竞态。保留 Pixi Spine 调用 rgb2hex/hex2rgb 的
弃用警告；构建的两条背景路径仍由运行时挂载解析。P2-B 实音长稳没有执行。

## B3：entry readiness 与元数据

原 prefab/motion ready watcher 会再次调用整个 `applyState`，包括 face/body/neck/
color 的初始值。现将 body type、prefab、motion 三组元数据并行等待后一次应用
entry，移除两个 ready ref/watcher。加载器继续 memoize，失败继续使用原有空值
回退；用于诊断名称的 costume dictionary 仍独立加载，不阻塞剧情。

`SpineStage.isSpineReady(target, expectedStep)` 要求该角色存在、该 step 的投影
已完成、当前 props 仍是同一个 step 对象。`projectedStep` 只是完成结果标记，
不调度时间或持有第二份状态；异步取消仍由已有 applyStateToken 管理。
`StoryViewer` 提供实际 `stageStep`，runtime 在创建 cue 时捕获它；不能拿 normalizer
生成的副本做对象身份比较，也不能仅比较可能跨剧情重复的 step_id。

Spine cue 在执行前同时检查实例和 stage readiness，避免复用旧实例时提前落地动作。
未提供 stage readiness 的独立 adapter 调用保持原有实例检测契约。现行 5 秒等待
上限与超时跳过行为保留；首次投影会等待元数据，极慢/不返回的网络仍可能触发超时，
本批没有把它声称为完整资源失败恢复策略或任意时刻重建。

新增回归先在旧执行器复现 `1 !== 0`（entry 尚未就绪已调用 face）。stage-loading
将生产 `applyState`、`isSpineReady` 与真实 `SpineCueRuntime` 接起来，验证慢元数据时
没有初始/延迟 face 调用，全部就绪后调用顺序恰为 entry-face → cue-face；复用模型、
相同 step_id 的不同对象、props 先于 watcher 更新、等待元数据时切步均有覆盖。

本批 stage-loading、spine-cues、runtime-foundation、playback-range、audio verifier
及 source-only Vite 构建通过。内置浏览器对同一三角色剧情观察到 1.4/2/5 秒三个
Spine cue settled、无 target unavailable/error，正常界面前进与回退文本正确。
本批稳定截图为 1280×720，三角色与对白正常；此为 noAudio 桌面冒烟与可控时序
测试，保留 Pixi 弃用警告，未执行本批窄屏矩阵或实音长稳。

## B4：背景加载与过渡共用生命周期

`BackgroundManager` 原来在 texture await 后才创建过渡记录，加载期间 cancel
直接返回 false，迟到纹理仍可能发布。现在从请求开始就建立同一 `_bgTransition`
记录；pending 状态没有 newSprite，不能 settle，但可以 cancel。新背景请求先
取消尚未安装的请求，再捕获实际旧背景，避免 C 取消后回到从未显示的 B。
加载失败只允许当前 token 回退 ID，旧同 ID 请求的迟到失败不能覆盖新请求。

`verify:story-background-loading` 直接导入生产 BackgroundManager 和真实 Pixi
Container/Sprite/Texture，使用可控纹理 Promise 和 ticker。旧实现先复现
pending load must be cancellable（false !== true）。修复后覆盖加载取消、
B→C 后取消、同 ID 迟到失败、clear 后加载完成、已开始的过渡取消/settle、
当前加载失败；检查 sprite 归属、旧背景恢复和 ticker 清理。

Runtime foundation 与 publicDir:false 生产构建通过。实际浏览器使用 noAudio，
进入 C.FIRST `episodes/1_1_016_01_a.json`，2→3→5 显示天峰秀对白，再返回集合。
该浏览器检查没有人为延迟纹理，也不是像素级渐变/窄屏矩阵或真实音频长稳；
竞态证据来自可控 Promise 测试。未修改转场时长或公共剧情产物。

## B5：背景渐变读取剧情时钟

背景渐变原来直接读取 performance.now，scheduler 暂停或调整 rate 不会改变
Pixi ticker 的 alpha 插值。现在 BackgroundCueRuntime 接收可选 nowMilliseconds，
useStoryRuntimeCues 将现有 StoryClock.now 的秒值转换为毫秒传入；BackgroundManager
用这一时间源计算渐变。独立 stage 调用继续默认使用实际时间，没有增加第二个时钟。
保留纹理加载完成后开始计时的行为；此批不改变慢加载的追赶策略。

background-loading verifier 将真实 StoryClock、EffectScheduler、背景 cue handle
和 Pixi BackgroundManager 接通，可控实际时间先在旧实现复现 alpha 不等于 0.25。
修复后验证渐变中暂停、暂停期间纹理完成、恢复无跳变、2x 与 0.5x 动态切换，
以及完成后旧 sprite 和 ticker 清理。原取消/settle 回归、runtime foundation 与
publicDir:false 构建通过。此改动只覆盖背景切换渐变，镜头及其他特效的时间源
仍需独立审计；不能据此声称所有 channel 已支持统一暂停或真实音频长稳通过。

实际浏览器 noAudio 冒烟：同一 C.FIRST 剧情 2→3→4→5 显示预期对白，返回恢复
集合 16。此项只验证路由与播放操作，暂停/倍速的 alpha 证据来自上述可控时钟测试。

## B6：镜头缓动读取剧情时钟

CameraCueRuntime 与背景使用同一个 scheduler.clock，向 CameraController 传入
可选 nowMilliseconds。通用 runRafTween 接受时间源，默认仍为 performance.now；
镜头的渐变与延迟瞬时变换均使用注入值。保持 easeOutCubic、坐标转换、背景边缘
约束以及取消停留在中间态、settle 立即到终态的既有行为。

新增 verify:story-camera-clock，直接运行生产 CameraController、cue handle、
StoryClock 与真实 Pixi Container，可控 RAF 和实际时间。旧实现先复现 1 秒时
scale 不等于 1.875；修复后覆盖中间位置/缩放、长暂停、恢复、2x/0.5x 切换、
取消后无迟到更新、暂停中 settle、带延迟的瞬时变换及 RAF 清理。已接入 CI。
runtime foundation、background-loading、source-only timing semantics 和
publicDir:false 构建通过。其他 runRafTween 调用仍保留默认时间源，屏幕特效、
角色动作与 resize 中间态恢复等不属于本批完成证据。

浏览器 noAudio 集成冒烟完成 C.FIRST 剧情 2→3→4，对白正常并可返回集合 16。
该路径只验证播放集成；镜头缓动数值与暂停/倍速结论来自可控 RAF 回归。

## B7：屏幕淡入淡出与擦除读取剧情时钟

ScreenCueRuntime 将 scheduler.clock 的毫秒时间源通过 PixiStageManager 传给
tweenOverlayFade/Slide，复用 runRafTween 的注入入口。保留原来的颜色、alpha、
四向坐标、缓动曲线与遮罩显隐语义；没有时间源的独立调用保留实际时间默认值。
entry/settle 的零时长操作不受暂停限制，取消仍通过 token 阻止下一帧更新。

verify:story-screen-clock 导入生产 PixiStageManager 方法、ScreenCueRuntime、
StoryClock 和真实 Pixi Sprite，跳过 GPU 初始化，用可控 RAF 验证 fade in/out
以及四方向 wipe in/out。旧实现先复现 1 秒时 alpha 不等于 0.1；修复后覆盖
中间 alpha/位置、暂停恢复、2x/0.5x、终态显隐、暂停中 settle、取消后的帧清理。
新增 CI gate，foundation、camera-clock、background-loading、source-only timing
semantics 与 publicDir:false 构建通过。粒子、punch 等其他屏幕效果以及真实音频
长稳不在此批证据范围内。

浏览器 noAudio 集成冒烟完成 C.FIRST 剧情 2→3→4，显示预期对白并返回集合 16。
此项验证实际播放流程；遮罩数值与暂停/倍速结论来自上述可控 RAF 测试，未执行
像素级四向录屏或窄屏矩阵。

## B8：切步保留倍速与暂停意图

EffectScheduler.start 原先每次默认 rate=1，切步会丢失已选倍速。现默认复用
StoryClock.rate，显式 rate 参数仍可覆盖。新增 paused 启动入口，暂停时将逻辑
时间固定在 offset，不执行 tick，不启动 at=0 cue 或申请 scheduler RAF。

StoryViewer 通过 isPaused 回调提供现有 runtimePauseReasons，runtime 在新分段
和快照恢复时读取该意图；没有再持有一份暂停标记。不能从 clock.state 推断意图，
因为切步前 cancelAll 会将 clock 停止。暂停时允许应用 entry/恢复快照，演出在
最后一个暂停原因解除后由原有 resume 流程启动。

新增 verify:story-step-playback-state，直接运行 useStoryRuntimeCues 与 scheduler，
旧实现先复现首段 rate 1 !== 2。修复后验证预设/切步倍速、多暂停原因下导航、
at=0 cue 不提前执行、解除后执行一次、暂停中改速、历史快照不重播及 RAF 清理。
此测试不构造 Vue DOM 或音频设备。foundation、background/camera/screen clock
回归与 publicDir:false 构建通过，新增 CI gate。

浏览器 noAudio 冒烟：C.FIRST 第 2 段打开/关闭菜单后，前进经 3 到 4 显示预期
对白，再返回集合 16。浏览器没有注入倍速或强制后台切步，不将此项冒烟替代
生产 runtime 的切步状态回归，也不作为真实音频长稳证据。

## B9：切步先移交注册表归属，再等待取消清理

PerformanceRegistry.cancelAll 原先等待 handle.cancel 后才由 finished 回调移除
条目。切步立即注册新 cue 时，旧条目仍阻塞 Auto/输入，同 ID 重载还会抛 duplicate
performance id。现同步移除本次取消的 active 条目，再执行异步清理。原 finished
回调的对象身份检查保留，旧完成结果不能删除新同 ID 条目，完成记录仍收集。

注册表用 _cancelling 跟踪尚未完成的清理 Promise，dispose 等待这些已经移交
归属的操作。取消批次等待所有清理完成后聚合错误，单个失败不会提前放弃其他
清理。该集合只跟踪清理任务，不持有第二份演出状态。

新增 verify:story-registry-handoff，旧实现先复现退役 cue 仍阻塞 Auto。覆盖
延迟取消时注册同 ID、旧完成不删除新条目、dispose 等待退役清理、部分失败
仍等待其他清理、同步连续三次 loadStep/start 同一 cue。foundation、切步状态、
Spine cue 回归通过；此批是可控异步生命周期验收，不声称浏览器时序故障注入
或真实音频长稳通过。

本批 publicDir:false 生产构建通过，保留已有两个背景资源构建期解析警告。

## B10：部分 settle 不停止剩余不可跳过事件

EffectScheduler.settleSkippable 原来无条件停止 scheduler RAF。若当前同时存在
延迟的不可跳过事件，跳过其他演出后该事件永远不再启动。现仅在没有活跃的
不可跳过事件时停止 ticker；暂停状态继续保持，恢复仍由原 resume 入口负责。

verify:story-partial-settlement 使用生产 scheduler、registry、clock 和可控 RAF，
旧实现先复现剩余事件没有调度帧（0 !== 1）。修复后验证运行中及暂停中 settle，
延迟事件只启动一次，完成后释放 blocker 和 RAF。foundation、切步状态回归
通过，新增 CI gate。这是调度层混合生命周期回归，不代表浏览器中所有入口
都允许跳过不可跳过事件，也不替代真实音频长稳验收。

本批 publicDir:false 生产构建通过；没有改动公共剧情产物。

## B11：颈部动画完成兜底使用剧情时钟

SpineCueRuntime 的 Track 3 完成监听原有 duration + 250ms setTimeout 兜底，
暂停期间仍会解除自动播放阻塞。现改为受归属管理的 RAF 检查，由 runtime 注入
StoryClock 毫秒时间，保留动画长度和 250ms 余量。自然完成、settle、cancel 均
取消检查帧并恢复原监听器。模型 readiness 的 5 秒实际时间上限保持独立。

Spine cue verifier 使用真实 StoryClock 与可控 RAF 验证非零起始偏移、暂停经过
9.5 秒实际时间仍未完成、2 倍速恢复后按剩余逻辑时间完成；既有自然完成、
兜底、跳过、切步保留姿势、cleanup 与模型超时检查通过。foundation、切步
暂停/倍速回归及 publicDir:false 构建通过，保留两个背景路径解析提示。
本批只统一完成兜底的时间，不证明所有 Spine 渲染动画和粒子已使用统一时钟，
也不替代真实浏览器的实音长稳验收。

## B12：Spine tint 的时间与取消归属

setSpineColor 接受可选剧情时钟并返回本次 RAF tween。SpineCueRuntime 保存该
句柄，失效/跳过/取消仅停止自己的过渡；旧 tween 的清理按对象身份检查，不能
删除后来注册的过渡。模型移除或全部清空也释放颜色帧。即时设色清除旧记录，
现有非剧情调用仍默认实际时间，颜色插值继续使用原 easeOutCubic。

verify:story-spine-cues 纳入新的 tint verifier，以实际 PixiStageManager 方法、
BackgroundManager 色值转换和 StoryClock，在不创建 GPU renderer 的情况下
验证中间色、暂停、2 倍速、取消保持中间色、旧句柄不删除新句柄、跳过终态、
单模型/全部模型移除后的零 RAF。Spine、foundation、screen-clock 与
publicDir:false 构建通过。两个已知背景路径提示保留。未据此宣称浏览器
像素/实音长稳通过，粒子及其他舞台属性仍需检查。

## B13：屏幕特效延迟回调和销毁归属

playScreenEffects 现在保存延迟启动计时器，替换/clearScreenEffects 时逐一取消，
执行时从集合移除；token 仍抑制已经排队的旧回调。清理在检查 overlay 前执行，
因此 overlay 丢失不会泄漏计时器。destroy 首先使效果 token 失效并清理计时器，
迟到的 punch/落花纹理结果沿用 token 检查退出。

verify:story-screen-clock 纳入生命周期 verifier，实际执行 stage 方法，覆盖
替换只剩新计时器、已排队旧回调、正常执行释放记录、缺失 overlay 清理、销毁
中的纹理完成不被消费，以及重复 destroy。屏幕时钟、foundation 和
publicDir:false 构建通过，两个已知背景路径解析提示保留。本批只完成上述
资源归属，粒子更新/延迟启动仍使用实际时间，未宣称暂停/倍速和浏览器长稳通过。

## B14：活跃屏幕粒子的即时释放

拳击贴图与落花/红叶/星形组合原先依赖下一次 ticker 检查 token 后自毁，
停帧时无法及时释放。现在 _ownScreenEffect 持有创建时的 ticker 与显示对象，
clearScreenEffects/destroy 立即取消登记并销毁对象；正常结束和旧排队回调
复用幂等 cleanup，释放过程不销毁共享 texture/baseTexture。

生命周期 verifier 使用实际 Pixi Sprite/Container/Texture 和生产舞台方法，
覆盖四种效果的切步清理或 destroy 后零 ticker、零登记、显示对象已销毁、
根容器无残留、重复清理/旧回调安全及缓存纹理保留。screen-clock、foundation
和 publicDir:false 构建通过，两个已知背景路径提示保留。这是无 GPU 的
资源归属验证，尚不覆盖粒子视觉、抖动/overlay 缓动清理和暂停/倍速迁移。

## B15：屏幕 overlay/拳击抖动缓动清理

闪光与拳击抖动现在通过 _ownScreenTween 登记取消句柄，自然结束移除登记，
clear/destroy 立即停止 RAF。拳击取消复原容器起点并隐藏 overlay；共享
runRafTween 增加取消标记，已排队的回调在取消后不再更新或重新排帧。

生命周期回归使用生产 stage/tween 和可控 RAF，覆盖两种效果的 clear、destroy、
自然结束，检查零 RAF/登记、位置复原；取消后模拟新镜头位置再执行旧回调，
新位置与 overlay alpha 不被覆盖。screen-clock、camera-clock、Spine（含 tint）
及 publicDir:false 构建通过。两个已知背景路径提示保留。上述回归不证明
粒子暂停/倍速、同时叠加镜头与抖动的合成关系或浏览器实音长稳已完成。

## B16：屏幕特效共用剧情时钟

StoryViewer 将 runtime 的只读 nowMilliseconds 回调传给 SpineStage，再经
applyStepSceneState 传入屏幕特效。剧情内延迟以受清理管理的 RAF 检查逻辑
时间，punch 贴图/抖动、闪光及落花/红叶/星形运动沿用同一回调；独立舞台
未传时钟时仍保持实际时间入口。落花旋转从逐帧累加改为起始角 + 已过秒数
× 60 × 原每帧增量，以原 60fps 速度为基准，避免刷新率改变旋转速度。

生命周期 verifier 从实际 applyStepSceneState 发起四类效果，使用真实
StoryClock/Pixi 对象和可控 RAF/ticker，覆盖非零时钟偏移、暂停延迟不触发、
2 倍速启动、运动/旋转/抖动暂停冻结、相同时间多次 tick 不累加旋转、按剩余
时间完成及零资源残留。screen-clock、foundation、publicDir:false 构建通过。
浏览器 noAudio 剧情进入、前进和返回 C.FIRST 集合正常；这只是播放器接入
冒烟，不是实际粒子画面/刷新率视觉验收，也未执行实音长稳。

## B17：背景模糊与颜色叠层共用剧情时钟

applyStepSceneState 将舞台已有 nowMilliseconds 回调传给背景 blur/color
接口；PixiStageManager 透传，BackgroundManager 的模糊、色值插值和恢复
白色的 alpha 淡出均读取该时钟。强度、配色和 easeOutCubic 保持不变，
未提供时钟的独立调用仍使用实际时间。

verify:story-background-loading 纳入属性回归，从实际场景应用入口经舞台
adapter 到 BackgroundManager/Pixi 对象，检查延迟暂停、2 倍速中间值、
暂停保持颜色/模糊、恢复原色后移除 overlay/filter、新状态替换后迟到回调
不覆盖。背景加载、foundation 和 publicDir:false 构建通过，两个已知背景
路径提示保留。此为无 GPU 的属性/时间验收，未完成实际背景滤镜画面与
实音长稳，也不代表持续背景粒子通道已迁移。

## B18：持续背景效果失败与 alpha 归属

雨纹理失败的 catch 分支补充 loadToken/容器有效性检查，移除或销毁后的失败
不再创建降级 Graphics/ticker，当前失败仍保留降级雨层。背景效果 alpha 使用
已有 runRafTween 保存取消句柄，保持原线性曲线和 delay；替换/移除立即取消，
自然完成清空句柄，旧排队帧不能再执行。

背景门禁纳入真实 BackgroundManager/Graphics 的生命周期回归，以无 GPU
白纹理替代浏览器 canvas 初始化；验证迟到失败、当前降级、线性中间 alpha、
替换只留一个 RAF、移除/销毁后零资源，以及旧帧不复活。背景加载/属性门禁
与 publicDir:false 构建通过，两个已知背景路径提示保留。持续背景粒子的
跨步时钟连续性与实际画面/实音长稳仍待验收。

## B19：持续背景跨步时间连续性

StoryClock 新增 elapsed() 累计实际播放的逻辑秒数，复用同一暂停/倍速状态；
start/seek 改变步内时间但不回退累计时长。舞台 nowMilliseconds 改读累计值，
剧情 cue 仍读步内 now()。背景效果创建时保存该时间源，雨/暴雨/落花按已过
时间定位，alpha 和 pendingEndUntil 也使用相同时间。独立舞台默认实际时间，
cameraflare 仍按原策略禁用。雨纹理降级动画按原 60fps 速度/循环长度投影。

背景门禁覆盖累计时钟的非零 offset、seek、暂停、倍速、stop，以及四类真实
Pixi 背景效果在步内时钟 reset 后位置不跳、暂停冻结、倍速继续、重复 tick
不累加运动、跨步省略 end 效果仍等候剩余淡出，最终零 ticker/RAF。背景、
foundation、切步状态、屏幕特效门禁与 publicDir:false 构建通过。两个已知
背景路径提示保留。实际粒子视觉/刷新率与实音长稳仍未完成。

## B20：首段调度等待异步舞台

实际浏览器验收 episodes/1_1_002_02_a.json、start_step=13/end_step=20，
修复前停留首段仍为晴天，前进后才出现阴雨背景。源产物该段明确包含 at=0、
duration=4 的 background.change（bg004_townst_out_01 → _05）。原因是
runtime 在异步 SpineStage manager 可用前启动 cue，背景 handler 的可选调用
无操作完成，之后仅补入场快照。

现先等待 manager 并应用入场快照，再 loadStep/start；等待期间阻止自动推进，
使用现有 generation 取消过期等待。就绪时读取当前暂停状态，暂停挂载不执行
事件。新增 stage-readiness verifier 纳入切步状态门禁，覆盖首 cue 发布顺序、
暂停后恢复、等待中切步只执行新段、卸载无迟到写入及零 RAF。切步、Spine、
foundation、背景门禁与 publicDir:false 构建通过。

浏览器复验仍停留首段即呈阴雨背景；本次截图窄窗口约 319×542，对白和
播放控件可见。此前菜单打开/关闭与前进正常。该证据证明真实首段背景问题
已修复，不是完整视口矩阵，未证明雨滴运动/暂停视觉或实音长稳通过。

B20 补充：foundation 的缺失角色夹具将 manager:null 改为已挂载的空 manager，
将角色缺失与舞台未挂载分开验证；缺失角色仍不阻塞 Auto，基础门禁复跑通过。

## B1–B20 整合回归（代码基线 414697c）

按 source gate 选取与近期播放器/导航改动相关的 20 项，逐项记录退出码，
本地原始日志与初次汇总在 `.analysis/integration-414697c/`（不提交临时日志）。
初次 19 项通过，story-audio 的旧源码断言仍要求 App 内声明 view；修正为
验证 App 使用导航模块的 view，且实际初值为 __boot__ 后重跑通过。未改动
音频实现或弱化启动静音约束。下面“通过”包含这一项单独复跑的结果。

| 门禁 | 结果 |
| --- | --- |
| verify:story-schema | 通过 |
| verify:story-audio | 通过（断言迁移后复跑） |
| verify:story-runtime-foundation | 通过 |
| verify:story-background-loading | 通过 |
| verify:story-camera-clock | 通过 |
| verify:story-screen-clock | 通过 |
| verify:story-step-playback-state | 通过 |
| verify:story-registry-handoff | 通过 |
| verify:story-partial-settlement | 通过 |
| verify:story-timing-semantics -- --source-only | 通过 |
| verify:story-spine-cues | 通过 |
| verify:story-stage-loading | 通过 |
| verify:archive-data | 通过 |
| verify:archive-navigation-state | 通过 |
| verify:archive-async-navigation | 通过 |
| verify:archive-startup-route | 通过 |
| verify:episode-queue | 通过 |
| verify:release-soak | 通过 |
| verify:silhouette | 通过 |
| verify:external-story-resource-ui | 通过 |

全量 runtime shape 覆盖 10,326 scenarios、315,124 snapshots、175,600 cues、
48,073 lip records；音频门禁含 100-cycle 的可控 BGM/Ambient 生命周期。
release-soak 仅证明记录器/分析器用例，不是实际长稳数据；timing 使用 source-only，
未运行 mounted Event RAW。此轮也未执行整个 CI 的 masterdata/publisher 门禁、
完整媒体 build/copy、实音长稳或发布。只修改测试断言，不重复生产构建。
