# ADV 动作与颈层运行时审计 · 2026-11-06

## 结论

- **翔太这句在第 5 秒折颈。** 测试站确实按时发出了身体动作 `weight`。同一条 cue 先清掉已保持的 `neck_question`，头部世界旋转在 60 Hz 探针里一帧跳了 **−10.817°**。单做复位会得到几乎相同的跳变。身体混合只改变后续起身轨迹。
- **原版事务所也有这次即时复位的调用。** 原版走 `IdolController.ExecuteAnimationTask → ResetNeck → SetEmptyAnimation(1, 0)`。同一个 Pixi 骨骼改用零混合空轨，采样姿势仍相同。当前证据支持「零时长移除已保持的倾头」这一成因。原版设备的实际画面和逐帧幅度仍待对照，暂不能把折点定性成 Web 独有的偏差。
- **另有可独立复现的 Web 问题。** 颈部回正接新动作时，完成监听和 Skip 结算都可能落在回正片段上。复位后重放同一个事件键，还可能被旧去重键吞掉。

## 部署身份与证据边界

| 层 | 输入与验证 |
| --- | --- |
| 测试站 | [目标台词](https://preview.gs-archive.com/office/002sht/?home_cue=3_1_002_01)，浏览器 501×479，基础常服 `002sht_002_00`。点击「播放语音」，控制台记录四个 cue 启动。页面有一个 canvas，目标台词和演员正常呈现，所采控制台窗口无 error/warn。截图用于确认页面与模型，骨角来自下述运行时探针。 |
| 正式剧情 Browser 抽查 | [主线第 1 章](https://preview.gs-archive.com/stories/main/101/) → 序章 → 播放 EPISODE 01，进入 PROLOGUE EP01、进度 6 / 26，显示制作人台词与播放控制，所采控制台无 error/warn。点击快进后留在当前已揭示台词。此抽查确认正式 Player 入口，颈层分支使用真骨骼探针与回归验证。 |
| 部署包 | 在线 `index-BMmafVag.js`、`SpineStage-gcpTRSN2.js` 的 SHA-256 与 `release-20261106/.deploy/pkg-1b470e87` 对应文件一致。入口包 `7b21dc98…`，舞台包 `691fd9b8…`。收据源码 `1b470e87269a02904c1ee24bf903b52ff39da82d`，read model `a15e642d…`，数据 `d049f4fa…`，compiled `4afb61ee…`。 |
| 审计源码 | `origin/master` 的 `42b5b92f`。与部署源码比较，Home、StoryViewer、SpineStage、PixiStageManager、SpineManager、story-runtime 路径无差异。 |
| 原版 | Android 2.6.10 Ghidra 已注释反编译与 RAW Unity TextAsset。下表地址均为该二进制 RVA。 |
| 骨骼运行时 | 以 60 Hz 固定步长驱动实际 `@pixi-spine/runtime-3.8`、真实 `comu.skel`、动作表、`SpineManager`、`installNativeFramePose`、`createSpineCueHandle`。按生产归一化后的 cue 时刻驱动，face/eye 使用简化接线。该探针测骨骼，Browser 测部署入口、加载与实际 cue 调度。 |

## 从 RAW 到第 5 秒

UnityPy 直接读取 `RAW/asset/scenario_3_.unity3d`（SHA-256 `46a2be7f19c0f1d870eb17d0db0204ca6a04bfd17fc259dd989349986a736128`）中 `scenario_3_1_002`，TextAsset path ID `2752094396850685166`。RAW 命令从 0 计数。

| RAW 行 | 时间 | 作者指令 | Web 输入与实发 |
| --- | ---: | --- | --- |
| 11 | — | `jump_point 3_1_002_01` | Home index 绑定 compiled `3_x_002sht_3_1_002.json` step 3 |
| 12–14 | 0 s | `face_default`、`wait_loop`、`neck_question` | 入场快照，经 SpineStage 投影。在 Home，选中台词便能投影入场姿势，声音启动后才调度延迟指令 |
| 15 | 2 s | `face_surprise` | `step-3:000:spine-face` |
| 16–17 | 5 s | `face_swet`、闭眼、`weight` | `step-3:001:spine-face` 和 `step-3:002:spine-body`。无同刻颈 cue，Web 在身体动作前复位 track 1 |
| 18 | 7 s | `face_default`、恢复眼睛 | `step-3:003:spine-face` |
| 19 | — | 台词、语音 01、口型 | `3_1_002_01.m4a`，461 个 ADXLIP 样点 |

本地 compatibility compiled、Home 嵌入 preview 和 strict v2 候选在这四条延迟动画及入场颈姿上一致。Browser 日志也显示四条 cue 在 2 / 5 / 5 / 7 秒排程并启动。这句开场的 `neck_question` 来自本 cut RAW 第 14 行，属于有效的作者指令。作为反例，历史 `verify-home-neck-projection` 检查的是翔太另一条卡片台词 `2_2_002_01_00_09`，那条只有 1.5 秒的颈 cue。

### 单变量探针

`neck_question` 时长 1.600 s，结尾维持倾头。`weight` 时长 1.333 s，动作表指定随后进入 `weight_loop`。当前身体是 `wait_loop`，无需身体 back。下表角度为 `head.getWorldRotationX()`。每组 4.9833 s 时都是 −86.537°。

| 5.0000 s 分支 | 头部角度 | 相邻帧变化 |
| --- | ---: | ---: |
| Web 生产 cue：clearTrack + weight，身体 mix 0.3 s | −97.354° | −10.817° |
| 只清颈层，身体仍是 wait_loop | −97.352° | −10.815° |
| 用 SetEmptyAnimation(1, 0) 替代 clearTrack，身体 mix 仍为 0.3 s | −97.354° | −10.817° |
| 清颈层，身体使用 Pixi 默认 mix 0 | −97.378° | −10.841° |
| 保留颈层，仅启动 weight | −86.539° | −0.002° |

颈骨本地旋转同时从 −1.130° 变到 +0.672°，头骨本地旋转从 −2.013° 变到 +7.001°。对本机可读取的 15 套翔太剧情骨骼重复入场和第 5 秒身体 cue，世界旋转首帧差均为 −10.817°，其中部分衣装的 `weight` 时长不同。保留颈层只用于隔离成因，随后它会继续叠在身体动作上。

## 原版两条路径

| 环节 | 事务所原版 | 正式 ADV 原版 |
| --- | --- | --- |
| 入口 | `HomeIdol.<PlayAction>.MoveNext` `0x1d7c770` 取 decider 结果，把 scenario 和 label 交给 `IdolController.Play`。其状态机 `0x214c7fc` 装入命令 generators，用 `GetJumpIndex → JumpCut` 定位。 | `StoryView.PlayView` `0x1f60100` 按角色取得 `StoryCutCharaData`，交给 `AdventureCharacterParent.SetAdventureCharacterCoroutine`。 |
| 动作归并 | `IdolCommandAction` `0x2240bd8` 生成 body、face、eye、sweat、cheek、neck 等各类任务。`PlayCut.MoveNext` `0x214cd8c` 以开始时间排序，标记相应类别最后任务后逐个 Dispatch，包含跳过标记及完成回调。 | `GetCharaAnimation` `0x1d15558` 在每个角色内以 float 开始时间为键填同一动画记录。body、neck、face 各有字段，同字段再次写入会覆盖。排序后交给角色协程。 |
| 身体切换触发复位 | `ExecuteAnimationTask.MoveNext` `0x214ad7c` 在播放身体前直接调 `IdolController.ResetNeck` `0x224030c`。后者调用图层复位并将正在执行的 neck task 标记结束/跳过。它不会扫描同刻是否有另一条 neck 命令来豁免身体复位。 | `IdolCharacter.<CoPlayAnimation>.MoveNext` `0x21477d4` 先执行记录中的脸、颈和面部 flags，再执行身体。颈字段为显式 `ResetNeck` 时走 reset 分支，其他非空颈字段走 `PlayNeck(0, …)`。之后有身体且颈字段为空时，也会独立调用 ResetNeck（`0x2147fa0` 的接口调用）。记录的 `trackTime` 用于身体。 |
| cut 结束 | `PlayCut` 给最后 motion、neck、voice 等任务设完成标记。符合条件时 `ResetIdolAfterDelayIfNeeded` `0x2240588` 等 3000 ms 再复位演员。 | 角色动作、音频和 StoryView cut 等待共同决定推进。Web 的 Auto、历史、Seek 与只播本段有独立生命周期。 |

同一套骨骼底层：

1. **身体** `PlayMotionInternal` `0x2249ddc` 用 `IdolMotionSetting` 判 motion/pose/loop。非 motion 直接 Set。上一项是可回正的 motion/pose 且允许 back 时，先设 back、给 back 0.3 s mix，再排 motion。目标 pose 存在才排循环。直接路径沿 AnimationState 的混合配置。名称找不到还有原版查找分支。
2. **颈部** `PlayNeckInternal` `0x22497a0` 查 **当前 track 1** 的 clip。当前是可回正颈动作时，按 `IdolNeckChecker/Extension` 顺序找 back，0.25 s mix、Add，再排目标颈动作，目标也为 Add。回正与显式复位是两个分支。`ResetNeck` `0x2249620` 明确为 `SetEmptyAnimation(1, 0)`。
3. **完成** `PlayNeck` 使用 `PlayNeckInternal` 返回的目标 TrackEntry 注册一次完成回调，带回正时返回排队目标。闭嘴选择也发生在原版 face/body/neck 内部，尚需按素材对照 Web 的 lip/face ownership。
4. **逐帧** `SkeletonGraphic.Update(float)` `0x13a36e8` 在 Apply 前回 setup pose，再做 UpdateLocal 与 world transform。身体/颈/表情轨是 0/1/2，闭眼用 4。Web 保留同样的关键顺序，用独立 after-apply hooks 处理 cheek/swet、lip 及选配槽。

### 本轮补反编译与同源资产

以 Ghidra headless 的只读模式打开 `E:/Tools/ghidra_work/sidem/project/sidem_il2cpp` 中的 `libil2cpp.decrypted.so`，新增 10 个函数的导出，10 个成功。 `SetEmptyAnimation` `0x1683c9c` 给空 entry 写入相同的 mixDuration 和 trackEnd。 `ApplyMixingFrom` `0x16822b4` 在 mixDuration 为 0 时直接使用进度 1。这个分支没有渐变窗口。`SkeletonGraphic.Update` 本轮也重新核对了 setup、apply、局部委托、world transform 的顺序。

原版 `RAW/asset/costume_002sht_002_00.unity3d` 中 `comu_SkeletonData`（path ID `-8026563515892045385`）的 `defaultMix=0.0`，`fromAnimation/toAnimation/duration` 均为空。`SkeletonDataAsset.FillStateData` `0x139d204` 将默认值与逐对配置写进 AnimationStateData。因此 Web 的定时直切覆写 0.3 s 与这套原版资产配置存在可指认的差异。该 bundle 内 `comu.skel` 的 488,401 字节完整出现在 Web 文件包装内，原始负载 SHA-256 为 `f019578d0dc7b2491b95d61f725f764a78addd5af8ef245e6e5b5098a930971f`。探针读取的是这份包装中的原始负载。

## 差异与冗余

| 状态 | 差异 | 运行时影响或边界 |
| --- | --- | --- |
| 已复现 | [SpineCueRuntime](../src/core/story-runtime/SpineCueRuntime.js) 调用 `playSpineNeckAnim` 后读 `getCurrent(1)`，带 back 时读到 back。完成监听临时替换原 listener，fallback 也按这条 entry 的时长计算。 | 真骨骼 `neck_question → neck_back_question → neck_yes`。cue 在 1.483 s 报完成，`neck_yes` 仍在 next，自己的时长为 1.667 s。Skip 调 `settleSpineNeckCue` 时也把 back 跳到 1.467 s，目标仍排队。现有 mock 和队列形状测试都能通过。 |
| 已复现 | [SpineManager](../src/core/SpineManager.js) 以 `_currentNeckAnim` 记录请求目标，原版回正判断读当前 TrackEntry。清轨重置目标值和 token，但保留 `_lastNeckEventKey`。 | 排队态和播放态并行存在。真骨骼中 reset 后再次提交原事件键，track 1 仍是空。该结果来自 manager 层，具体哪些导航会复用同一实例和键需在 Browser 逐条确认。 |
| 已证实路径差异 | Web 事务所与正式 ADV 共享 [useStoryRuntimeCues](../src/core/story-runtime/useStoryRuntimeCues.js)。身体 cue 扫同刻颈 cue 决定是否复位。 | 正式 ADV 合并的规则被带到事务所，而原版 Home body task 总是先 reset。Home 同刻实际顺序需按 RAW 任务及排序验证，特别是颈任务先于身体时。此差异不改变目标台词第 5 秒无同刻颈 cue 的事实。 |
| 已证实路径差异 | Web 入场 [SpineStage](../src/components/SpineStage.vue) 把 body/face/neck 状态分开落地，并在 body 去重成功/失败后决定是否清颈。定时路径另有同刻扫描和强制重启。原版正式 ADV 按合并记录一次处理。 | 快照里的继承值、当前 cut 的显式指令、重复同名动作三者在 Web 的触发条件不同。同刻重复 lane 在实际语料里存在，需要保留源序后定义覆盖策略。 |
| 已证实路径差异 | [spineClientMotion](../src/core/spineClientMotion.js) 已覆盖正常 motion/pose/back/no-back 和 trackTime。定时 cue 在它返回后仍统一覆写第一个 TrackEntry 的 0.3 s mix。无动作表则退到旧 `*_loop / wait_loop` 猜测。 | 上表量到直接 `wait_loop → weight` 的身体混合差异，但解释不了头部瞬跳。目标原版衣装资产序列化默认 mix 为 0，且无 pair override。其他衣装、缺动作查找分支及表加载失败场景需分别补证。 |
| 已证实路径差异 | 复位 Web 是 `clearTrack`，原版是空动画；Web 直接 neck 强制 0 mix，原版直接 Set 沿状态配置。 | 目标台词对照中两种复位的采样姿势相同，空轨在 Pixi 仍多存在两帧。对 TrackEntry 回调、已在 mix 的链、紧接着同帧 Set 的影响需分别验收。 |
| 待运行时对照 | story clock 驱动 cue 和多种 tween，Pixi 另有渲染时钟。速率会传给 state.timeScale，暂停入口只显式暂停 cue/audio，舞台是否停 ticker 还受 presentation/visibility 控制。 | 现有暂停回归验证调度/音频与逻辑时间。真实骨骼在菜单、历史、后台和倍速中是否同步冻结，需要采样同一 TrackEntry 的帧时间。 |
| 已收敛，应保留 | 每帧 setup pose、Add 颈层、face 覆盖、闭眼轨、cheek/swet 过滤。历史 `ac4c2524` 已删除 ADV 的眨眼遮盖与手动复位 neck target。 | Studio 的 `neckOverlayAnimation` 是另一消费者。它保留的兼容处理未进入本次 Home/ADV 链。不能以该模块仍存在推断 ADV 仍有双重滤轨。 |

## 语料覆盖与回归

用当前归一化器遍历主检出 `public/data/compiled` 顶层有 steps 的 3,400 个文件（legacy 2,227，v2 1,173），共 70,772 steps，其中 `adv` 27,904、`choice` 2,130。计数以文件/step 内事件为单位，语料中重复入口或同故事衍生文件可能重复计入。

| 形状 | 数量 | 示例或意义 |
| --- | ---: | --- |
| 定时 body / face / neck play / neck stop | 15,028 / 32,163 / 3,836 / 896 | 两套 schema 都进入同一动作运行时 |
| 进场有 neck 字段 | 1,143 | 快照到动画的投影 |
| 同 step 内，已有 neck 后遇到无同刻 neck 的 body | 593 | 含进场 neck 或 step 内先播放 neck，按命令追踪，未按实际 clip 完成时间筛选 |
| 同角色同刻 body + neck | 87 | `002sht_201_2_2_002_01_00.json` step 2 / 2.2 s |
| 同角色同刻同 lane 多指令 | 28 | `002sht_302_2_3_002_02_00.json` step 4 / 5 s，`wait_loop` 和 `weight` |
| 已记为保持姿势后又来 neck | 92 | `008rei_402_2_4_008_02_00.json` step 4 / 3.15 s |
| 定时 no_back / 正 track_time | 164 / 172 | 两条身体切换分支都有实料 |
| actor 不在 entry snapshot | face 67 / body 35 / neck 5 / stop 1 | 运行时 fail-open 的输入分布。来源、角色是否晚出现和应不应该跳过仍需分别判定 |

已执行既有回归，范围覆盖身体/颈回正与 offset、真骨骼 setup pose/闭眼、ready/generation/Skip/restore、逻辑时钟、选择/回看/自动推进、BGM/环境音/语音、背景与场景放置。具体校验包括 `verify:spine-blink`、`verify:spine-frame-pose`、`verify:spine-neck-contract`、`verify:home-neck-contract`（source-only）、`verify:story-timing-semantics`、`verify:playback-controller`，以及对应的 spine-client-motion、neck-back、track-time、story-spine-cues、story-runtime-foundation、story-projector、projector-shadow、story-step-playback-state、story-stage-readiness、story-stage-loading、story-position-clock、story-partial-settlement、story-interaction-matrix、lip-sync-native、story-audio-session、native-audio-bus-routing、camera/screen/background clock、ADV 粒子及 registry-handoff 等脚本。回归通过只覆盖各自断言，本次真骨骼新增探针识别出表中仍存在的分支问题。

## 后续改动的验收顺序

1. 用同一 Home 标签、同一衣装在原版采 4.8–5.4 s 的画面和 track 状态。对齐 voice/cut 时间、颈结束帧、Face 与 Body 混合配置。原版若同样硬复位，应把平滑化作为单独的 Web 呈现决策。
2. 收敛颈动作的返回值和所有权。让启动、完成、Skip、取消统一引用目标 entry，并记录 back 与目标各自的时间。先用 `neck_question → neck_yes`、back 中打断、reset 后原事件重放验收。
3. 将正式 ADV 的「同角色同刻」归并落到统一入口，Home 保留自身 task 顺序证据。按 RAW 补同刻双写、有/无 neck、no_back、非零 trackTime、缺动作/表、跳过/回看及角色更换的回归，再去掉重复推断。
4. 逐项回归 body back/pose、Add 层复位、闭眼与唇形，最后比较 Browser 菜单暂停、历史跳回、后台恢复及倍速的骨骼时间与语音时间。

本批交付审计报告。固定帧探针、语料扫描脚本与日志在主检出 `.analysis/adv-runtime-20261106/`。这些结果覆盖本地运行时和测试站抽样，原机逐帧、全语料逐条视觉播放、不同浏览器/设备及正式部署验收仍待执行。
