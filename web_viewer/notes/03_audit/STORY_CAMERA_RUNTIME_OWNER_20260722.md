# Camera Runtime 唯一 Owner 验收

日期：2026-07-22

## 结论

`camera.transform` 已默认由 Runtime Scheduler/PerformanceHandle 唯一驱动；legacy `applyStepSceneState` 默认不再写 camera zoom。回滚入口为 `runtimeCamera=0`，并优先于 `runtimeCues=1`。

Runtime entry snapshot 会以 `duration=0, delay=0` 恢复稳定 camera；cue start 只向 `CameraController` 交付 Scheduler 已处理过 delay 的 tween；settle 直接安装终态；cancel 取消唯一 RAF tween，随后由导航 snapshot 恢复目标步骤。

## Resize 修正

此前 ResizeObserver 只调用 `BackgroundManager.handleResize()`，camera 的 x/y 仍保留旧 viewport 坐标。现在 `CameraController.handleResize()` 会取消旧 tween，并按当前宽高重新计算已授权 camera 终态；`PixiStageManager` 在 resize 时同时调用 background 与 camera controller。

## 验收

- 自动验证：default/`runtimeCamera=0` owner、`runtimeCues=1&runtimeCamera=0` 回滚优先级、entry restore、start、settle、cancel，以及 1280×720 到 390×844 的坐标重算；
- 浏览器固定锚点：`1_4_001_01_a` 第 38 步 `パパパ、パーッション！！`，5.5 秒 delay / 0.2 秒 zoom；
- delay 尚未到达时点击 Next，camera cue settle 到 `zoom=1.2, offset_y=20`，剧情步保持不变；
- 切换 390×844 后 zoom 覆盖与人物构图仍按新 viewport 重算；
- `runtimeCamera=0` 等待 6.2 秒后 legacy delay/RAF 呈现同一 zoom，且无 `CameraCueRuntime` 日志；
- 应用错误为 0，受控浏览器标签始终为 1。

## 回滚期限与后续

legacy camera 分支暂保留到 SE 与 snapshot timer 完成默认迁移后的 compatibility 清理提交。本批不迁移 SE、snapshot timer 或其他 scene/timeline 分支。
