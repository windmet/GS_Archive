# 歌曲目录与详情只展示 Read Model（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `b3302b9`。歌曲目录组件只接收目录 Read Model；单曲原资料与展示投影只接收当前歌曲 ID 的详情叶子。详情叶子未到时显示已有读取状态，避免使用旧歌曲表或前一首的资料。故事章节、Chibi Stage 返回单曲详情时按歌曲 ID 恢复；缺失叶子由带导航版本检查的监听补取。舞台音频实验也按歌曲 ID 隔离，独立舞台默认的 `drvalv` 实验仍可使用。

`verify:song-domain-landing` 新增生产投影与晚到响应回归；`verify:archive-async-navigation`、`verify:archive-navigation-state`、`verify:song-stage-handoff`、`verify:archive-presentation`、`verify:cutover-routes`、`build:check` 和 `verify:build-audit` 通过。构建复用 `.analysis/build-check`，未复制完整 public 媒体。Browser 在 `127.0.0.1:5186` 使用当前生产代码、public 和 r22 Read Model 映射，旧全量 `/data/` 被阻断。直达《BRAND NEW FIELD》、返回歌曲目录、选择《DRIVE A LIVE》、切换特殊版本并返回原曲、刷新原曲直达 URL，详情均恢复；检查时无 console error。当前 QA 映射阻断旧舞台索引，页面的舞台版本目录显示读取失败，因此不能据此判断舞台版本已迁移。舞台变体目录仍读取功能本地索引，歌曲详情操作状态保持 partial；本机代表旅程不是真机或发布包验收。
