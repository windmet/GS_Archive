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
