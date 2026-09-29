# Spine 实验室直达启动（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `608fdfd`。`spine_lab` 组件已按需导入，内部自取 live-chibi manifest、编排和音频索引。本批把它列为不需要 `loadArchiveData()` 的启动路由；未改变 Pixi、模型或多人物舞台的运行时实现。路由账本只将实验室直达入口与自有数据标为 migrated；跳往 `chibi_stage` 的操作仍为 partial，阶段 parity/设备证据未完成。

`verify:archive-startup-route`、`verify:archive-navigation-state`、`verify:spine-atlas-pages`、`verify:story-spine-cues` 与 `build:check` 均通过。代码输出复用 `.analysis/build-check`，未复制 public 媒体。

Browser 使用 `127.0.0.1:5186` 的当前生产代码、public 与 r22 Read Model 页面映射；旧整批 `/data/` 来源返回 503。直达 `?view=spine_lab` 后实验室标题、49 人角色选项、动作库与冬馬模型实际画面可见；资源状态页点击“Spine 实验室”进入带来源 URL 的实验室，点击“返回来源页”恢复资源状态。无 error；加载模型时记录到一条 Spine/Pixi 警告堆栈。本批没有验证全部角色/动作、声音、多人舞台、真实设备或发布包。
