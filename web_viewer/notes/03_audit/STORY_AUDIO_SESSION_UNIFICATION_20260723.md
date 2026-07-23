# Story Audio Session 统一审计（2026-07-23）

## 结论

StoryViewer 的 Voice、BGM、Ambient 与 Runtime SE 已收口到单个 `StoryAudioSession`。该会话是唯一 `AudioContext` owner，并建立 `master -> bgm/ambient/voice/se` mixer；菜单、Backlog、episode finished 与页面可见性使用可叠加的 pause reason，同步暂停/恢复 Runtime scheduler 与音频上下文。

本批实现提交：`3ecd5b54d108d5ab83ef320f99ac01b9e520df1a`。

长会话竞态加固提交：`7747d23`。

## Owner 与生命周期

- `StoryViewer` 创建并最终销毁共享 `StoryAudioSession`。
- `AudioManager` 与 `useVoicePlayer` 接收同一个 session，不再各自创建 AudioContext。
- 首页 `ArchiveImmersiveHome` 不属于 StoryViewer session；它使用 `useVoicePlayer` 的独立 owned session，并在卸载时销毁。
- 用户手势统一调用 `unlockFromUserGesture()`；不再依次解锁两条上下文。
- source 注册到 session 后随 rate 更新，并通过幂等 release 从 active source 集合移除。
- Voice 旧 source 的 `onended` 只释放自身，不能误结束或释放后来启动的新 voice。
- AudioManager 提供 BGM/Ambient `captureState()` 与 `restoreState()`，并在 dispose 时清理 source、gain、cache 与延迟清理 timer。

## 自动验证

新增：

```powershell
npm run verify:story-audio
```

覆盖：

- 单 session 只创建一个 AudioContext；
- master 与四条命名 bus；
- 首次手势解锁；
- overlay/visibility 多暂停原因；
- rate 对逻辑时钟与已注册 source 的传播；
- source release 与 session dispose 幂等；
- 旧 voice `onended` 不影响新 voice；
- StoryViewer 向 AudioManager/useVoicePlayer 注入同一个 session；
- 两个 consumer 不再直接构造浏览器 AudioContext。

同批通过：

```text
npm run verify:story-audio
node scripts/verify-story-runtime-foundation.mjs
npm run verify:story-playback-range
npm run build
git diff --check
```

生产构建共转换 2400 个模块，耗时约 2 分 21 秒。

## 5174 单标签页验收

URL：

```text
http://127.0.0.1:5174/?view=player&story_type=main&story_section=101&scenario=episodes%2F1_4_001_01_d.json&start_step=1&end_step=48&return=story_collection
```

实际操作：首次 Next 手势解锁并前进；Runtime SE 启动；进入带 voice 的对白；打开/关闭菜单；恢复后继续前进；返回故事集合触发 StoryViewer 卸载与 voice dispose。应用级 console error 为 0，退出日志包含 `StoryViewer onBeforeUnmount` 与 `stopCurrentVoice: dispose`。验收结束后恢复上述 URL，浏览器标签页数量为 1。

## 2026-07-23 长会话 soak follow-up

审计发现原 `playBgm()` / `playAmbient()` 缺少异步 generation guard：快速跨 episode 切换时，较早但较慢的成功或失败响应可能晚于新音轨完成，造成旧 source 启动或把新 cue 清空。`7747d23` 为 BGM/Ambient 增加 generation ownership，stop/dispose 也会使 pending load 失效，并把 timer 注入与 `AudioManager.inspect()` 纳入可重复验证边界。

`npm run verify:story-audio` 现执行 100 轮确定性 soak，覆盖：

- BGM/Ambient 反复 crossfade 后 steady-state active source 不超过 2；
- cleanup timer 每轮收敛为 0；
- 每十轮执行 capture → stop → restore，cue 与 ambient volume 精确恢复；
- visibility/overlay 双 pause reason 反复叠加与解除；
- 新请求先完成、旧请求后成功或后失败时，旧请求均不能覆盖/清空新 cue，也不能创建 source；
- dispose 后 active source 清零。

detached source-only checkout 已重新安装依赖并通过 audio soak、Runtime foundation 与 2400-module production build。5174 单标签实际从 d episode 完成态切换到 e，旧 StoryViewer 触发 unmount，新 episode URL/正文加载成功，应用 error 为 0；最终恢复完整 d URL，标签数为 1。

这组证据关闭了“异步旧音轨复活”和“确定性 source/timer 不收敛”风险，但浏览器隔离环境未提供可信 heap/audio global 读取，因此不把它写成真实浏览器内存长测通过。

## 2026-07-23 单标签混合操作与浏览器曲线

`5d62b48` 增加仅由 `runtimeDebug=1` 开启的主世界诊断面，将 audio source 的 bus/kind/cue/age、AudioManager timer、Playback pause reason、Runtime clock、Spine instance 与 Chromium `performance.memory` 输出到可测试 DOM；默认页面不创建诊断 timer，也不显示诊断 UI。调试面提供明确标为 `debug_override` 的 hidden/visible 按钮，复用真实 `visibilitychange` 的暂停函数，但不把该模拟结果表述为操作系统级后台切换。

同一 5174 标签完成以下真实 UI 链路：AUTO 到 Choice 停下 → 选择 → 菜单暂停 → Backlog → 定点恢复 → SKIP all 到第一个 Choice 停下 → 选择 → SKIP all 到第二个 Choice 停下。过程中发现 SKIP 越过有 voice 的对白进入无 voice Choice 时，旧 dialogue source 仍存活；根因是 `playVoice()` 的无 voice 分支没有停止旧 source。修复后从 step 39 快速 SKIP 到 step 44 Choice，诊断只剩 BGM/Ambient 两个 loop，voice source 为 0；自动 verifier 也新增“进入无 voice 步骤必须释放上一句 dialogue source”断言。

同一标签另执行 6 轮“d step 6（2 个 Spine）→ d step 39（0 个 Spine）”页面切换：

- Spine instance 每轮严格为 `2 → 0`；
- source 每轮为 `2 → 0`（未解锁页面上的 pending voice/SE 不计为持续播放通过）；
- used JS heap 在约 102–198 MB 间随 GC 波动，第 5/6 轮普通页回落到约 102/104 MB，不呈单调累积；
- 新增 marker destroy 参数后，6 轮卸载均未再出现 `Failed to destroy debug marker`。

该证据可关闭“短程重复导航立即单调泄漏”和“混合 SKIP 遗留 voice”风险；它仍是受 CPU 约束的 bounded smoke，不替代数小时真实后台/听感/heap soak。

## 尚未覆盖

- Edge 与不同 autoplay policy 的首次解锁对照；
- 数小时真实浏览器 BGM/Ambient 听感与 heap 曲线；代码级 100 轮 soak 和浏览器 6 轮 heap/Spine 曲线已覆盖；
- 自动化触发 `document.hidden` 的后台切换音频听感对照；
- 跨 episode 数小时连续播放；d→e 单次真实切换及单 episode Auto/Skip/Backlog/Choice 混合链路已通过；
- 操作系统级真实后台恢复；debug override 已验证同一 pause 函数的 reason/clock/context 收敛。

因此本批可以宣称“音频 owner 与基础生命周期统一完成”，但不能宣称完整 release stability 已完成。
