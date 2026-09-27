# 旧剧情别名路由切换验收（2026-09-27）

本批从 `f901a35` 开始。数据投影分别在 `210d7ce` 和 `1357fd3` 提交；页面切换使用同一批生成的 read-model release `08317d8456f9d2b142821409bd34f124f1838fb3f8676b3d5c0713451f93c3c1`。候选目录为 `E:\GS_readmodels_candidate_20260927_r19`，不在应用仓库内。

## 改动

- `groups`、`files`、`episode_zero_units`、`episodes` 及从 `files` 返回的播放器路由使用局部投影。分组、章节与文件点击先读取目标实体，再更新页面和 URL；直达链接按 URL 恢复实体及其父级。
- 列表标题、顺序、数量、文件元数据与 extra 缺失文件补充由投影提供。错误保留在当前页面并显示读取失败状态。
- 从旧别名列表移除对完整 compiled index、story catalog 的运行时列表构造。

## 验证

- `readmodels` 的 `npm test`：31/31 通过；候选产物校验：5,574 文件，bootstrap 13,345 字节。
- `npm run verify:archive-async-navigation`：通过，包括旧导航时序与其他已迁移路由的回归。
- `npm run verify:archive-navigation-state`：通过，包括 1,792 个路由与返回状态用例。
- `npm run build:check`：通过，Vite 源码构建输出在本仓库 `.analysis/build-check`，未复制 public 媒体语料。
- Codex Browser 在 `127.0.0.1:5179` 的候选数据与上述构建上复查：主线分组直达页显示两个序章，每组 11 个文件；点击首组进入有标题、资源 ID 和语音/口型摘要的文件列表。第零话直达页显示 16 个组合；点击 Jupiter 显示 3 个章节；点击首章进入 1 个可播放文件。此前同批 Browser 检查还覆盖文件页播放与返回、刷新第零话文件深链、偶像剧情、聊天组合和 extra 分组。

## 边界

这是本地候选数据与源码构建的 Browser 验收，不代表完整媒体打包、离线设备或生产部署验收。完整 index 仍服务尚未迁移的旧路由；本批仅切换上述别名路径。Reader locator、功能模块按需加载与最终发布验证留待后续批次。
