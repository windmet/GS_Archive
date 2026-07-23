# Snapshot Runtime 与旧 Timer 清理验收

> 状态更新：迁移期 rollback flag 与旧 index-only restore 分支已在 `STORY_RUNTIME_LEGACY_OWNER_CLEANUP_20260722.md` 所记录的清理提交中退役；下文“下一提交”描述仅作为迁移历史保留。

日期：2026-07-22

## 结论

Snapshot-backed history/restore 已默认启用，`runtimeSnapshots=0` 保留旧 index stack 回滚。旧 `useStepSceneEffects._snapshotTimer`、`clearSnapshotTimer()` 与 `scheduleSnapshot()` 已删除，不再有逐步创建的 snapshot setTimeout owner。

显式 `?snapshotAt=<seconds>` 调试抓图现在由 StoryClock/EffectScheduler 注入 `debug.snapshot.capture` cue。它不阻塞 Auto，但标记为不可 Skip；到点调用 `freezeScene('snapshotAt')` 并发布 `window.__SNAPSHOT__`，导航/unmount 会随当前 Scheduler generation 一起取消。

## Snapshot 语义

- 前进时为可读步骤记录 normalized settled snapshot、entry snapshot、choice identity 与 dialogue；
- 返回时优先 pop `SceneSnapshotStore` node，恢复 entry/navigation snapshot 并截断后续历史；
- transient cue 在 restore 前取消，不重放旧步骤延迟演出；
- `runtimeSnapshots=0` 继续使用历史 step index，作为临时回滚入口；
- `snapshotAt` 仅为显式调试能力，不替代 History snapshot，也不会在普通 URL 中创建 cue。

## 验收

- 自动验证 snapshot flag 默认值、`runtimeSnapshots=0` 及其对 `runtimeCues=1` 的回滚优先级；
- SceneSnapshotStore 的 detached clone、navigation snapshot、truncate/pop 与 choice identity 验证通过；
- debug cue 的 at/lifecycle、start capture 与 navigation cancel 验证通过；
- 浏览器 default：a 第 11 步前进到第 12 步后返回，恢复第 11 步人物、文本与导航边界；
- 浏览器 rollback：`runtimeSnapshots=0` 同一路径仍可使用 index stack 返回；
- `snapshotAt=1` 在 Scheduler 日志中准时出现 cue start，并以 `snapshotAt` 原因停止 voice；
- `snapshotAt=2` 在到点前退出播放器，等待 2.4 秒未出现旧 cue start，证明没有遗留 timer；
- 应用错误为 0，受控浏览器标签始终为 1。

## 后续

下一提交进入旧 timeline/scene 分支清理：评估并删除已失去默认 owner 的 compatibility 代码，同时保留明确的一组整体回滚边界。BGM/ambient/voice 的完整音频统一仍是后续独立范围。
