# 卡片消费者移除旧索引兜底（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `eb05575`，Read Model release `409c9f9e2f5f010da609a44c15f9b6f5bc15329c86d2969bf90b22f20d81cdd9`。卡片目录叶子已有资源状态、关联标记和偶像引用；单卡详情叶子已有完整卡片、资源状态和活动/卡池关系。本批让卡片列表、筛选、详情关系、共通系列和活动/卡池到卡片的跳转只使用这些读模型。详情叶子未到达时相应字段保持空值，不用旧索引填充。

验证：`npm run verify:card-filters` 对 826 张规范化卡片的 1,225 组筛选组合通过；`verify:card-voice-preview`、`verify:archive-async-navigation`、`node scripts/verify-archive-relation-navigation.mjs`、`verify:cutover-routes`、`build:check` 与 `verify:build-audit` 通过。构建只写复用的 `.analysis/build-check`，未复制 public 语料。审计显示初始 JS gzip 估值 118,389 字节，旧 `ArchiveDataRepository` 仍在生产依赖中。

Browser 使用本机 `127.0.0.1:5188`，映射当前生产代码编译结果、现有 public 与 `E:\GS_ReadModels_QA\candidate_20260927_r23\pages`；除舞台运行时本地时间轴外，旧 `/data/` 来源被服务阻断。直达 `?view=cards` 显示 826 张卡，进入天ヶ瀬 冬馬的「スタートライン」后能看到详情和共通系列；点击“下一张：GROWING STARS”正确切换卡片。返回目录选择“有可显示卡图”和“有卡片小剧情”，结果显示有剧情的卡；以上操作无浏览器 console error。服务日志记录卡片目录页和两张单卡叶子的请求。Browser 旅程只覆盖代表性卡片与两种筛选，不能充当全部卡片 parity 或真机验收。

跨域的活动/组合展示仍有旧卡片索引引用，`cards` 的 actions 在路由台账中保持 partial；整体旧 `ArchiveDataRepository` 仍在生产链中。本批不是完整 cutover、媒体打包或部署验收。

后续批次已移除上述跨域卡片索引引用，见 [组合与活动叶子记录](GS_ARCHITECTURE_UNIT_EVENT_LEAVES_20260927.md)；本段保留本批提交时的状态边界。
