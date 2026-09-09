# E1 只读运行时对照验收

2026-09-09；起点 c6659a3，codex/archive-architecture-refactor。

本批接通纯 projector 与实际运行时的按需对照，覆盖既定 background mix、camera
stage transform、screen fade/wipe 三类输出。Spine 采样、滤镜、粒子、背景几何裁切
等继续明确未投影；不声称全画面或全库 parity，不进入 E2 renderer 接管。

## 入口与所有权

在现有 `runtimeDebug=1` 诊断面板点击 `E1 SHADOW`，得到只读 JSON 文本框。
报告包含采集时间、scenario/step、逻辑时间、viewport、查询上下文、预期、实际、
逐字段差异与适用范围。只保留最近一份报告，不增加计时器或持续采样循环。
普通 soak collector 默认不调用 projector，也不把 shadow 报告混入原长期记录。

scheduler 仅在原有 entry 上补记 started_at/completion_mode。背景记录原纹理
就绪后的逻辑起点；原 RAF tween handle 暴露原始起点、末次采样时间及取消标志。
这些字段不推动时钟、不改变插值，不调用任何新的 start/settle/cancel/restore。
屏幕 manager 保留原 tween handle 供读取，取消仍由既有 token 负责。

runtime adapter 记录本次 entry 所绑定的 source/step/manager，以及 restore 的
显式快照。切页、清理和 manager 被替换后不会把旧查询上下文当作新舞台依据。
manager 替换时保留已观察到的差异，同时标记 `not-comparable/stage-manager-replaced`。
恢复快照使用 `cuePolicy=suppressed`，不重新执行已读步骤的 cue。

## 时间与判定

对照为当前已完成绘制状态的读取，不能改变帧进度。背景使用真实纹理就绪起点，
镜头/fade/wipe 使用实际 tween 起点；派发时间只用于尚无实际 tween 记录的情况。
数值容差固定 0.001，不把时间窗口包络算作 PASS。动画进行中可能出现采样帧滞后，
报告原样保留差异、实际 tween 起点和 sampled_at，便于判断。

状态区分 match / difference / partial / not-comparable。纹理等待、尚未派发、
主动提前结算、失败/取消和不支持的投影不会被简单当作正确或错误。match 仅指
scope 中的三个已覆盖输出，不代表未投影通道的状态。

## 实际浏览器证据

Browser/IAB，确认服务 5175 的 PID 33944 属于本 checkout。未启动正式 soak。

- `1_4_001_00_a` step 20：稳定镜头状态及全部已覆盖通道匹配。
- 同篇 step 4：暂停于 time=0 时，screen 正确标记 cue-awaiting-dispatch。
  恢复后再暂停，最初捕获到 fade.alpha 约 0.0011068 的差异。核对发现派发时间
  早于 tween 真正开始；读取真实 tween 起点后，time=0.265 的中间态三通道匹配，
  起点为 0.0073，末次采样恰为 0.265。保留修正前报告，未放宽误差阈值。
- `1_4_001_01_a` step 4：time=0.2765 的背景混合匹配；两个背景层透明度约
  0.8386/0.1614，实际纹理起点 0.0344。
- `1_4_001_00_a` step 18：time=0.5432 的镜头中间态匹配；tween 起点 0.3022。
- 正常推进到 step 21 后返回 step 20：报告为 resolved-entry / suppressed，
  三通道匹配。没有用直接改页面内部状态代替真实按钮操作。
- 390×844 完整刷新、随后切至 1280×800，三通道仍匹配；手机页无横向溢出。
  开发过程曾在热更新后切尺寸得到混合状态差异，保留为未隔离 HMR 的开发证据，
  不把它当成尺寸切换缺陷。完整刷新后同路径不复现，并补上 manager 身份边界。
- 该正常验收页 console 无 error；原 Pixi 兼容 warnings 不作为本批新故障。

证据在 `C:/Users/windm/.codex/evidence/sidem-projector-shadow/2026-09-09/`：
camera-live、fade-paused-live、fade-middle-live（修正前）、
fade-middle-live-corrected、background-middle-live、camera-middle-live、
history-restore-live、mobile-fresh-live、resize-fresh-live JSON 及桌面/手机截图。
`resize-difference-live.json` 是热更新窗口内的开发证据，不能作为稳定版本回归结论。

## 验证与后续

verify:story-projector 已包含 verify-projector-shadow；测试真实 scheduler 的时间
元数据、数值差异、纹理等待、实际 tween 起点、提前结算、历史恢复、清理、manager
替换与默认不开启采样。相关 Runtime foundation、背景、镜头、屏幕、registry handoff、
partial settlement 和 release-soak-recorder 回归通过。source-only 构建通过（2,488 modules），
保留主 chunk 超过 500kB 的既有提示；不复制或发布完整媒体。

E1 首批三个输出的纯查询→运行时读取→差异报告闭环已具备上述证据。仍保留契约中
不支持的背景类型/重叠切换及其它未投影通道；不能以首批 match 覆盖这些限制。
下一阶段先收口 E1 支持范围与 pre-E 冻结基线，再决定 E2 每个 channel 的接管门槛。
本批不是 pre-E 长稳 PASS、听感验收、发布或全体重构完成。

## 角色 RGB tint 运行时只读对照

起点 `05faa2f`。新增 scope `spine-rgb-tint` 与逐角色结果。读取真实 Spine tint、
现有颜色 tween 的起点/末次采样时间，以及 SpineStage 对当前 step 的 readiness。
SpineCueRuntime 只给可扩展的真实 tween handle 加 cue 身份标记，不改变插值、
起点或生命周期；未返回对象的 manager 实现仍可正常执行。

缺失模型、未 ready、未观察到实际起点、无法归属当前 cue 的颜色 tween、
主动提前结算、失败/取消均明确 not-comparable。非法/未支持投影也不算匹配。
纯读取不能启动 tween、推进时钟或修改管理器。默认 soak 采集仍不调用 projector。
整数 RGB 只要差 1 就报告差异，不使用扩大后的视觉近似容差。

机械测试覆盖上述边界、延迟起点、RGB 差异及不变性；verify:story-projector、
verify:story-spine-cues 与 source-only 构建通过。构建保留既有 500 kB 警告。

Browser/IAB 在本 checkout 的 5175（PID 33944）实测 `1_4_001_05_j`：

- step 3 的三位角色静态 tint 匹配。
- step 4 中间态：逻辑采样 0.3154 秒，实际末次绘制 0.3086 秒，两个 tint 有差异。
  各 tween 真实起点 0.1136/0.1138 秒已在报告中保留。时间差约 7 ms，仍记录为
  difference；不把推测的帧滞后作为自动通过理由。
- step 4 结束状态和 step 5 结束状态：三位角色全部匹配。
- 从 step 5 用“上一段”回到 step 4：resolved entry / suppressed，三位角色匹配。
- 正常路径无 console error；未启动长稳录制。

仓库外证据：`C:/Users/windm/.codex/evidence/sidem-tint-shadow/2026-09-09/` 的
`tint-middle-difference.json`、`tint-settled.json`、`tint-next-step.json`、
`tint-history-restore.json`。本批未证明全部中间帧匹配，也未覆盖 alpha、骨骼姿势、
过滤器或像素级合成。它完成 tint 查询到真实读取/差异报告的闭环，E2 仍未接管。
