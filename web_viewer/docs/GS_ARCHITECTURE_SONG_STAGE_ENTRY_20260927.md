# 单曲舞台入口从详情叶子读取（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `c7a4b3e`。生产者 `6d4e87c` 将源 `data/song_timelines/manifest.json` 的默认舞台条目投影到每首歌曲详情叶子，仅保留舞台条目 ID 与类型；源 manifest 的字节哈希参与 release。歌曲详情组件不再单独请求整张时间轴 manifest 来判断舞台入口。真正进入 Chibi Stage 后，舞台运行时仍按需读取功能本地时间轴文件。

新候选位于 `E:\GS_ReadModels_QA\candidate_20260927_r23`，release `409c9f9e2f5f010da609a44c15f9b6f5bc15329c86d2969bf90b22f20d81cdd9`，未部署。`readmodels` 的 41 项测试通过，真实语料测试逐首对比 61 首歌曲的舞台入口与源 manifest；8,419 个产物通过字节、描述符与 schema 验证，bootstrap 13,610 字节。仓库内 inline bootstrap 已同步至该 release。

`npm run build:check`、`npm run verify:build-audit`、`npm run verify:cutover-routes`、`npm run verify:song-domain-landing` 与 `git diff --check` 均通过。构建审计显示初始 JS gzip 估值 118,576 字节；全局 `ArchiveDataRepository` 调用点仍在，不能据此宣称整体切换完成。

在 `http://127.0.0.1:5188` 的受限 Browser QA 服务中，普通歌曲 `brndnf` 与特别版 `drv999` 的详情叶子均正常渲染舞台按钮，分别进入多人舞台与社长单人 2D 舞台，浏览器未记录错误。服务日志显示两次详情页请求各只读取对应新歌曲叶子；`/data/song_timelines/manifest.json` 均发生在点击入口后。该服务允许进入舞台后读取功能本地时间轴，同时阻断其他旧 `/data/` 路径。

舞台运行时尚未迁移时间轴来源，因此路由台账的歌曲详情 actions 继续记为 partial；本机浏览不能替代真机或发布包验收。
