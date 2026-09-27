# 组合与活动展示只使用路由叶子（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `d80fa5c`，Read Model release `409c9f9e2f5f010da609a44c15f9b6f5bc15329c86d2969bf90b22f20d81cdd9`。组合目录、组合详情和活动详情已有有界目录/详情叶子；本批移除这些页面的旧 `buildUnitCatalog`、事件关系、卡片索引与故事/歌曲列表显示兜底。`App.vue` 不再持有 `cardIndexData`，活动报酬卡链接仍经卡片目录和单卡叶子打开。叶子尚未到达时，页面关系数据为空，由现有加载状态处理。

`npm run verify:archive-async-navigation`、`node scripts/verify-archive-relation-navigation.mjs`、`npm run build:check` 和 `npm run verify:build-audit` 通过。构建仍是 `.analysis/build-check` 中不复制 public 的生产代码编译。构建审计中 `src/data/unitPage.js` 已退出禁止模块名单，初始 JS gzip 估值 116,793 字节；`ArchiveDataRepository` 仍在生产依赖中，不能宣称整体完成。

Browser 使用本机 `127.0.0.1:5188` 的生产代码映射、现有 public 和 `E:\GS_ReadModels_QA\candidate_20260927_r23\pages`，旧 `/data/` 来源除舞台运行时本地时间轴外被阻断。直达组合目录显示 16 个组合；进入 Jupiter 后显示 3 位成员、卡片统计、3 首歌曲及组合剧情；点击 GROWING SIGN@L -Inner Dignity- 打开活动详情，显示 11 章与 3 张报酬卡；点击「湧き上がる対抗心」进入单卡详情，再返回活动。此代表性旅程无浏览器 console error。未做全部组合/活动 parity、真机或媒体发布包验收。

卡片目录及其自身操作不再引用旧卡片索引，因此 `cards` 的 actions 记为 migrated、`legacyRemaining` 置空。活动和组合的详细路由状态保持既有记录；路由账本的 parity 和设备验收仍未通过。
