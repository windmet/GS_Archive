# 移除门户生产入口的旧整批资料加载（2026-09-27）

## 输入与改动

- 输入 HEAD：`e55a730a323421d79aa70191cad9532113b4a40f`，分支 `codex/gs-architecture-rebuild`；ReadModels release：`409c9f9e2f5f010da609a44c15f9b6f5bc15329c86d2969bf90b22f20d81cdd9`。
- `App.vue` 不再导入 `ArchiveDataRepository.js`，也不再调用 `loadArchiveData`、`ensureLegacyArchiveData` 或 `runWhenLegacyReady`。直接进入页面、门户返回、来源返回和历史恢复不再等待旧整批资料。
- 偶像名称、切换列表和组合归属使用内嵌 bootstrap；活动与故事的出演引用优先使用已有的 ReadModel 投影。资料状态页只用资源 ReadModel；生日故事的视觉图继续优先使用确定性本地候选，再用故事明细投影。
- 站外视频资源当前按发布策略关闭；移除了它唯一剩余的旧通信索引加载接线。若要重新开放，需要另行设计并审核该功能的投影、数据来源及验收。
- 更新启动竞态用例，使其等待真实的卡片目录按需加载；修正阅读导航测试的 VM 发布开关注入。旧数据仓库的独立测试文件仍保留，用于验证尚存的工具行为，不表示生产入口继续使用它。

## 验证

- `npm run build:check`：通过。Vite 生产代码编译到本工程 `.analysis/build-check`，`copyPublicDir:false`，未复制 public 媒体库。
- `npm run verify:build-audit`：通过，初始 JS gzip 估算 108,074 字节；生产模块图中 `productionLegacyModules=[]`、`legacyCallSites=[]`、`globalArchiveLoadRemoved=true`。仍有 `archiveSelectors.js`、`gashaCatalog.js` 两项启动禁用模块，尚未达到完整切换门槛。
- `npm run verify:archive-startup-route`、`verify:portal-navigation`、`verify:archive-async-navigation`、`verify:archive-navigation-state`、`verify:idol-reference`、`verify:unit-page`、`verify:story-catalog`、`verify:archive-presentation`、`verify:external-story-resource-ui`，以及 `node scripts/verify-reading-navigation.mjs`：通过。
- Browser：复用 `127.0.0.1:5188` 本地 QA 服务。该服务映射本工程 `.analysis/build-check`、现有 public 和 r23 页，并以 503 拒绝 `/data/compiled/index.json` 及大多数旧 `/data/` 索引。实际走通门户→剧情→活动→偶像→返回活动、活动详情刷新、活动→组合→卡片目录→门户→返回卡片目录；页面有内容、无框架错误覆盖层，浏览器 error/warn 日志为空。当前验收视口为浏览器现有窄屏视口，截图已在 Browser 会话中查看。

## 边界

- 本批证明生产入口已脱离旧整批资料仓库；`src/data/ArchiveDataRepository.js` 文件仍为离线工具和独立测试保留。功能内的阅读正文、场景时间线等按需路径仍存在，应逐项按其合同验收。
- 路由进度仍为 32 条中入口 31、数据 30、动作 26；parity 与真机验收尚未完成。`build:check` 与本地 Browser 不等于完整媒体包、离线、真机或线上部署验收。本批未部署 Pages / R2。
