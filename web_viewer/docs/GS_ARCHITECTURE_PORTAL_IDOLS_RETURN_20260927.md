# 偶像旧分类的门户返回不再启动旧整批数据（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `abcebb3`，Read Model release `409c9f9e2f5f010da609a44c15f9b6f5bc15329c86d2969bf90b22f20d81cdd9`。`idols` 页的公开分类参数由路由合同规范化；偶像目录显示使用 inline bootstrap，`cards` 分类另外按需加载卡片目录叶子。先前 `isBootstrapRoute` 只允许默认、`idol` 与 `cards` 分类，旧 `event` 等分类从门户返回时会启动 `loadArchiveData()`。本批让全部已规范化的 `idols` 分类走相同目录路径；门户导航遇到未知 section 时直接忽略，不再尝试准备旧整批数据后递归调用。

`verify:archive-startup-route`、`verify:portal-navigation`、`node scripts/verify-idol-navigation-ux.mjs`、`build:check` 和 `verify:build-audit` 通过。构建输出仍是复用的 `.analysis/build-check`，没有复制 public 语料；初始 JS gzip 估值 116,479 字节，生产 `ArchiveDataRepository` 仍未移除。

Browser 使用本机 `127.0.0.1:5188`，映射当前生产代码编译结果、现有 public 与 `E:\GS_ReadModels_QA\candidate_20260927_r23\pages`，阻断除舞台运行时本地时间轴外的旧 `/data/` 来源。直达 `?view=idols&category=event` 显示偶像目录，打开门户后点击“返回”恢复同一目录；浏览器无 console error，服务日志在此旅程未出现旧 `/data/` 请求。此验证只覆盖代表性分类与本地 Browser；外部故事资源启用时的发布数据、Player 其他 returnView、全量 parity 与设备验收仍需分别处理。
