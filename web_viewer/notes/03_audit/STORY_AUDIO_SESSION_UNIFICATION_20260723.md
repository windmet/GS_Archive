# Story Audio Session 统一审计（2026-07-23）

## 结论

StoryViewer 的 Voice、BGM、Ambient 与 Runtime SE 已收口到单个 `StoryAudioSession`。该会话是唯一 `AudioContext` owner，并建立 `master -> bgm/ambient/voice/se` mixer；菜单、Backlog、episode finished 与页面可见性使用可叠加的 pause reason，同步暂停/恢复 Runtime scheduler 与音频上下文。

本批实现提交：`3ecd5b54d108d5ab83ef320f99ac01b9e520df1a`。

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

## 尚未覆盖

- Edge 与不同 autoplay policy 的首次解锁对照；
- 真实 BGM/Ambient 长时间交叉淡化与 snapshot restore；
- 自动化触发 `document.hidden` 的后台切换音频听感对照；
- 跨 episode 长时间连续播放、Auto/Skip/Backlog/Choice 混合操作；
- 长时间 active source、Timer、Spine 与内存增长观察。

因此本批可以宣称“音频 owner 与基础生命周期统一完成”，但不能宣称完整 release stability 已完成。
