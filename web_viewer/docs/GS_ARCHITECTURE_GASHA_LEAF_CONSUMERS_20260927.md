# 卡池页面移除旧索引显示兜底（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `6bb9e0b`，Read Model release `409c9f9e2f5f010da609a44c15f9b6f5bc15329c86d2969bf90b22f20d81cdd9`。卡池目录、统计、分类计数和单条详情已由有界读模型提供；本批移除 `App.vue` 中这些显示值对 `gashaIndexData` 的回落。详情叶子未到达时不展示旧索引拼装的详情，仍走页面原有加载状态。旧索引在额外故事域的兼容投影中还有引用，整体 `ArchiveDataRepository` 仍在生产依赖中。

`verify:gasha-catalog`、`verify:archive-async-navigation`、`node scripts/verify-archive-relation-navigation.mjs`、`build:check` 和 `verify:build-audit` 通过。构建只编译生产代码到复用的 `.analysis/build-check`，不复制 public 语料；审计的初始 JS gzip 估值为 116,509 字节，最终 cutover 仍为 false。

Browser 使用本机 `127.0.0.1:5188`，映射当前生产代码编译结果、现有 public 和 `E:\GS_ReadModels_QA\candidate_20260927_r23\pages`，阻断除舞台运行时本地时间轴外的旧 `/data/` 来源。直达卡池目录显示 57 个实际卡池、61 条公告及 336 条推定新卡关联；选择 GROWING FES 后显示 4/57；进入「光彩のポートレート」详情，再进入关联卡「幸福の象徴」并返回卡池。旅程无浏览器 console error。关联仍标示为推定，不据此断言实际招募内容；本机 Browser 也不构成全量 parity、真机或发布包验收。
