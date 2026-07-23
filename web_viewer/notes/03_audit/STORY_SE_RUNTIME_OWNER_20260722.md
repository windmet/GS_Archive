# SE Runtime 唯一 Owner 验收

> 状态更新：迁移期 rollback flag 与 legacy SE timers 已在 `STORY_RUNTIME_LEGACY_OWNER_CLEANUP_20260722.md` 所记录的清理提交中退役；ambient、BGM、voice 仍属于后续音频统一范围。

日期：2026-07-22

## 结论

`se.play` 已默认由 Runtime Scheduler 唯一调度。`useStepSceneEffects` 默认不再创建 legacy `_seTimers` 或直接播放 SE；显式 `runtimeSE=0` 恢复完整 preload/setTimeout/play 回滚路径，并优先于 `runtimeCues=1`。

## 生命周期与多 SE

- handler 创建时预加载音频，避免延迟 cue 到点后才开始解码；
- authored `delay` 由 StoryClock/Scheduler 管理，不再交给第二套 setTimeout；
- 到点的 transient SE 调用 `playSE`，允许同一步多个 SE 重叠；
- 用户在到点前 Next/Skip 时，settle suppress 该 SE，不补播；
- navigation cancel 同样不播放尚未开始的 SE；已经开始的一次性音效不被倒带。

## 验收

- 自动验证 default watcher 不产生 legacy preload/play，`runtimeSE=0` 才走旧路径；
- 两个同 channel SE 分别验证自然 start、提前 suppress 与 cancel；
- 固定浏览器锚点为 `1_4_001_01_a` 第 38 步：`cloth_move_l01` 在 4.0 秒自然 start，5.6 秒的 `vibraslap_comical` 在 4.94 秒点击 Next 后 suppress；
- 点击 Next 后仍停留同一步，证明 settle 没有误推进；
- `runtimeSE=0` 下同一锚点无 `SeCueRuntime` 调度，legacy 路径保留；
- 应用错误为 0，受控浏览器标签始终为 1。

## 回滚期限与后续

legacy `_seTimers` 保留到 snapshot timer 完成迁移后的 compatibility 清理提交。ambient、BGM 与 voice 尚未纳入本次 SE channel，不以本批结论推导完整音频统一已完成。
