# Screen/Fade Runtime 唯一 Owner 验收

日期：2026-07-22

## 结论

`screen.fade` 与 `screen.directional_wipe` 已默认由 `useStoryRuntimeCues` 的 Clock/Scheduler/PerformanceHandle 路径唯一驱动。`applyStepSceneState` 默认只保留非 fade 类 `screen_effects`，不再写 fade 或 directional wipe。

明确回滚入口为 `runtimeScreen=0`。该参数即使与 `runtimeCues=1` 同时出现也优先关闭 Screen Runtime，并恢复完整 legacy screen 分支。回滚分支计划在 background、camera、SE 三个 channel 均完成默认验收后统一删除；在此之前不得新增第二个默认 owner。

`useStepSceneEffects` 中的 `_fadeAutoTimer` 只负责 transition step 的导航推进，并通过 `hasBlockingAuto()` 等待 Runtime cue；它不写 Pixi overlay，不是 screen visual owner。该 timer 仍属于后续“snapshot timer / 旧 scene timer 清理”批次，不在本提交混迁。

## Owner 矩阵

| 路径 | fade/wipe visual owner | 非 fade screen effect | 用途 |
| --- | --- | --- | --- |
| default | Runtime Scheduler | legacy Pixi effect player | 正式默认 |
| `runtimeScreen=1` | Runtime Scheduler | legacy Pixi effect player | 显式同默认 |
| `runtimeCues=1` | Runtime Scheduler | legacy Pixi effect player | 全 channel 试运行 |
| `runtimeScreen=0` | legacy scene watcher | legacy Pixi effect player | 临时回滚 |

## 自动验证

`node scripts/verify-story-runtime-foundation.mjs` 覆盖：

- default 与 `runtimeScreen=0` 的 owner 选择；
- `runtimeCues=1&runtimeScreen=0` 的回滚优先级；
- fade start 与 settle 的终态写入；
- wipe cancel 对活动 overlay 的清理；
- entry snapshot restore 先清除两个 transient overlay，再恢复稳定 curtain；
- a/d 固定剧情中的 wipe/fade cue 正规化。

## 单标签浏览器验收

全程仅使用一个受控标签页，端口为 `127.0.0.1:5174`：

- `1_4_001_01_a` 第 6/8 步：默认路径日志仅出现 `ScreenCueRuntime` 的 directional wipe start，黑幕 covered stage 正常；
- `1_4_001_01_d` 第 12 步：在 7.3 秒延迟 cue 启动前点击 Next，Runtime 将 fade 与同一步可跳过演出 settle 到终态，剧情步未误前进；
- 第 14 步延迟 fade 启动前返回：该 cue 被当前 generation 取消，重新进入第 12 步时 entry snapshot 恢复可见场景；
- 1280×720 切换到 390×844 后，stage 与 screen overlay 仍覆盖完整视口，布局无溢出；
- `runtimeScreen=0` 同一 a 锚点由 legacy 路径呈现 covered stage，未出现 Screen Runtime start；
- 应用级 console error 为 0，受控标签数始终为 1。

## 本批未迁移

background transition、camera、SE、snapshot timer 与其余旧 scene/timeline 分支仍按既定顺序分别迁移，不与本提交合并。
