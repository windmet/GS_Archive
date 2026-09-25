# GS 歌曲档案 read-model 接线：2026-09-25

## 基线与范围

- 输入分支：`codex/gs-architecture-rebuild`，本批开始于 `f0116a5`；保留工作区原有无关未跟踪文件。
- 使用已核验的 r3 只读候选：`E:\GS_readmodels_candidate_20260925_r3`，release `ebbc9c4bfc54d019e1927d7f3ef7c6cee9d6476c30c05fd5536b2af4817e5fb8`。未改动生产者、资源语料或发布目标。
- Portal 的歌曲入口、歌曲目录直达、歌曲详情直达改为通过固定 release 的 `ReadModelClient` 加载。目录读取索引与页；详情按歌曲 ID 读取实体。60 首主曲目、特殊版本详情沿用现有展示组件。
- 歌曲详情去往尚未迁移的组合、偶像、剧情时，才读取旧数据；从直达详情返回旧栏目也执行同样准备。其他栏目仍采用旧数据路径。

## 验证

- `npm run verify:portal-navigation`、`npm run verify:routes`、`npm run verify:archive-navigation-state`、`npm run verify:archive-async-navigation`、`node --test readmodels/tests/*.test.mjs` 均通过。
- `npm run build:check` 通过：完整 Vite 代码编译，输出仅在本 checkout 的 `.analysis/build-check`，没有复制 `public` 语料；主 JS 约 594 kB（gzip 约 187 kB），仍有大 chunk 提示。
- Codex in-app Browser 对 `127.0.0.1:5176` 的已构建代码检查了 Portal → 歌曲 60 首、3DMV 11 首筛选、`BRAND` 搜索 → 详情 → 保留搜索返回、主曲 → 特殊版本、特殊版本刷新直达，以及详情 → 组合和直达详情刷新后返回组合。详情展示和路由可用，控制台没有 error。
- QA 静态服务只将 `.analysis/build-check`、原 `public` 和 r3 候选 `pages` 映射到同一 origin。日志显示歌曲旅程请求歌曲索引、目录页、单曲详情和舞台时间线目录；未请求旧版 21 份 `/data` 批量数据。进入未迁移组合后才触发旧数据读取。此证据是本地编译包加显式静态映射的 Browser 验收，并非部署、完整媒体包或真实播放验收。

## 后续边界

- read-model 候选在仓库外，发布仍需按指导包的汇编和完整资源合同处理，不能直接部署 `build:check` 输出。
- Home、偶像、组合、卡片、卡池、剧情等仍未迁移；静态入口的代码 chunk 也未完成分拆。下一批按路由合同继续迁移并单独验收。
