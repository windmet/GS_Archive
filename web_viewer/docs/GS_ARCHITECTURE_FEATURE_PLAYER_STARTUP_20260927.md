# 已迁移页面的播放器直达恢复（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `4ce336e`。本批将 `event_detail`、`seasonal_campaign`、`work_archive`、`idol_story_archive` 的播放器返回目标纳入 Read Model 启动分类，避免刷新播放器 URL 时先等待 `loadArchiveData()`。事件播放器刷新另需在 `restoreRoute` 预取对应 event detail，才能恢复队列与返回页；其余三个目标已有同类预取。

## 验证

- `npm run verify:archive-startup-route`、`npm run verify:episode-queue`，以及 event、seasonal、work、idol-story Read Model 导航脚本：通过。
- `npm run build:check`：通过；代码输出在复用的 `.analysis/build-check`，未复制 `public` 语料。
- Browser：本机生产代码映射服务使用当前 `public` 和 `E:\GS_readmodels_candidate_20260927_r22\pages`。`127.0.0.1:5184` 屏蔽 Reading manifest 及除 `/data/reading/`、`/data/compiled/episodes/` 外的旧 `/data/`；`127.0.0.1:5186` 另外放行 `/data/compiled/` 原场景文件，但 `/data/compiled/index.json` 与其他旧资料仍返回 503。先从实际页面点入播放器，再刷新播放器 URL、点击返回：
  - 事件 `430018`：返回后仍显示 GROWING SELECTION -運命光年-、11 章与 3 张报酬卡。
  - 天ヶ瀬 冬馬个人故事：返回后仍显示两话和其分段列表。
  - 天ヶ瀬 冬馬工作档案：返回后仍显示工作短剧情列表。
  - `valentine_2023`：返回后仍显示 Happy Valentine 2023 与角色剧情列表。
  上述复验标签的控制台未出现旧资料请求错误。

工作与季节场景文件位于 `/data/compiled/` 根目录，播放器需要按需获取；QA 阻断旧整批数据时必须保留这些文件。Browser 检查覆盖本机选定实例，不代表全部语料、真机、完整媒体包或线上部署已验收。其他播放器返回目标仍需逐项审查。
