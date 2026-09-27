# 偶像目录与详情按路由加载（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `89dd301`。本批把 `ArchiveIdolGrid`、`ArchiveIdolDetail` 从 `App.vue` 静态导入改为 `idols`、`idol_detail` 两条路由的按需组件。页面数据读取逻辑未改。

`npm run verify:archive-startup-route`、`npm run verify:archive-async-navigation`、`npm run build:check` 均通过。构建输出复用 `.analysis/build-check`，未复制 `public` 语料；本次入口 JS 为 414.31 kB（gzip 132.70 kB），入口 CSS 为 45.29 kB（gzip 9.45 kB），并生成独立的偶像目录与详情代码/样式片。体积不是下载速度或设备性能指标。

Browser 使用本机生产代码映射服务 `127.0.0.1:5186`，读取当前 `public` 与 `E:\GS_readmodels_candidate_20260927_r22\pages`；旧整批 `/data/` 来源被阻断，保留按需场景文件。直达 `?view=idols` 显示 49 位偶像及组合筛选，点入天ヶ瀬 冬馬资料，关联资料、歌曲和活动可见；刷新详情 URL 后资料仍恢复。该标签错误日志为空。本次只验证了这条代表路径，没有验证真机、完整媒体包或线上部署。
