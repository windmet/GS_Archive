# 站外资源暂停页直达与返回（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `edc12d1`。当前产品策略 `EXTERNAL_STORY_RESOURCES_ENABLED=false`，旧深链应只展示中性的暂停说明并能返回站内故事目录。此前该直达路由仍等待全站旧资料，且准备三份通信索引；页面组件也被静态导入。

本批使暂停状态的直达入口不等待旧资料或通信索引，暂停时导航条目始终为空，组件按路由导入。策略将来开启时，旧数据准备仍保留在启用分支，尚不能视为已迁移。Browser 复查发现暂停页“返回”曾进入未加载的故事目录，显示 0 项；改为调用故事目录的正常加载入口后再复验。路由账本的入口、数据、操作与组件状态仅描述当前关闭策略；parity 仍为 partial，设备仍为 pending。

## 验证

- `verify:archive-startup-route` 覆盖关闭策略直达无需旧全量、开启策略仍要求数据；`verify:external-story-resource-ui`、`verify:portal-navigation`、`node scripts/verify-archive-routes.mjs` 通过。
- `npm run build:check` 与阶段 `verify:build-audit` 通过；代码产物复用 `.analysis/build-check`，未复制 public 媒体。`ArchiveExternalStoryResources` 为独立代码片。严格最终 cutover 仍应拒绝生产入口的其他旧依赖。
- Browser 使用 `127.0.0.1:5186` 的本机生产代码映射、当前 public 与 `E:\GS_readmodels_candidate_20260927_r22\pages`；旧整批 `/data/` 被阻断。直达 `?view=external_story_resources` 显示暂停说明，无 error/warn；点击返回应显示故事目录实际计数与章节，刷新后同样恢复。此路径不测试已暂停的外部链接发布，也不构成真机或部署验收。
