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
