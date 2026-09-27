# 旧剧情别名与资源页按路由加载（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `ba2ee53`。本批将 `groups`、`files`、`episode_zero_units`、`episodes`、`archive_status` 五个已使用局部 Read Model 的页面组件，从 `App.vue` 静态导入改为按路由加载；路由账本的组件状态与阻塞原因同步更新。页面数据生产和导航语义未改。`external_story_resources` 仍为静态组件，且它的直达入口仍触发旧数据读取，本批不将其标作完成。

## 验证

- `npm run verify:archive-startup-route`、`npm run verify:archive-async-navigation`、`npm run verify:cutover-routes`：通过；路由账本组件就绪从 26/32 增至 31/32，parity 与设备签收仍均为 0/32。
- `npm run build:check`：通过，复用 `.analysis/build-check`，没有复制 `public` 媒体语料。五个页面生成了独立代码片；入口 JS gzip 估算 127,605 字节。`npm run verify:build-audit` 的阶段模式通过，仍明确列出旧 Repository 和全量加载调用，因此不是最终 cutover 签收。
- Browser：`127.0.0.1:5186` 映射当前生产代码、当前 `public`、`E:\GS_readmodels_candidate_20260927_r22\pages`；Reading manifest、compiled index 和旧整批 `/data/` 来源被阻断，按需 compiled 场景文件放行。直达 `?view=groups&category=main_story` 显示两个各 11 文件的序章，点击首组进入 11 条有资源 ID 和语音/口型摘要的文件列表。直达 `?view=episode_zero_units` 显示 16 个组合，点 Jupiter 进入三章。直达 `?view=archive_status` 显示验证、覆盖率、资产清单和视觉资源摘要；首屏截图检查无框架错误覆盖层。当前标签未记录相关 error/warn。

`groups` 必须带合法 `category`；裸 `?view=groups` 按现有 URL 合同回退到 Home，不能用作分组页验收。本机代表路径不等于全部内容、真实设备、完整媒体包或线上部署验收。
