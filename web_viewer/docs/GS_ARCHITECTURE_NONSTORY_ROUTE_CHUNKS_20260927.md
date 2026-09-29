# 资料馆页面按路由加载（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `2a1f5f2`。本批把卡片列表/详情、卡池列表/详情、歌曲列表/详情、Mobile 通信、组合列表/详情这九个页面组件从 `App.vue` 的静态导入改为按路由加载。导航提交与 URL 恢复时预取目标组件。此变更只调整页面代码加载时机，没有迁移页面内部仍需旧资料的功能。

## 验证

- `npm run verify:archive-async-navigation`、`npm run verify:archive-navigation-state`、`npm run verify:archive-startup-route`、`node scripts/verify-portal-navigation.mjs`、`node scripts/verify-reading-navigation.mjs`、`node scripts/verify-reading-playback.mjs`：通过。脚本中随函数更名更新了调用桩。
- `npm run build:check`：通过，输出复用 `.analysis/build-check`，未复制 `public` 语料。前后同一构建方式的入口 JS 从 535.81 kB（gzip 168.64 kB）变为 429.42 kB（gzip 136.73 kB）；入口 CSS 从 123.82 kB（gzip 约 22.25 kB）变为 58.23 kB（gzip 11.55 kB）。这是文件体积，不代表下载耗时或真机性能。
- Browser：本机生产代码映射服务 `127.0.0.1:5186` 读取当前 `public` 与 `E:\GS_readmodels_candidate_20260927_r22\pages`；Reading manifest、`/data/compiled/index.json` 和除 `/data/reading/`、`/data/compiled/` 场景文件以外的旧 `/data/` 请求返回 503。直达歌曲目录显示 60 首，点入 `DRIVE A LIVE` 详情；直达卡池目录显示 57 个卡池，点入 `GROWING FES -光彩のポートレート-` 详情；直达卡片目录后点入冬馬 `スタートライン` 详情；Mobile 入口选冬馬后显示个人聊天 20、电话通信 9、组合聊天 6、随机话题池 5；直达组合目录显示 16 个组合，点入 Jupiter 详情，刷新该详情 URL 后仍恢复成员、歌曲、团活及组合剧情。相关浏览器标签的错误日志为空。

歌曲详情的舞台版本目录在旧数据被屏蔽时提示暂时无法读取，说明该功能仍有旧资料依赖。上述 Browser 验收是本机选定路径，不覆盖全部路由、全部语料、真实设备、完整媒体包或线上部署。
