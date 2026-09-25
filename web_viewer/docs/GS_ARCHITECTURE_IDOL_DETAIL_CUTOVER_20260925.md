# GS 偶像档案 read-model 接线：2026-09-25

## 基线与范围

- 输入分支 `codex/gs-architecture-rebuild`，开始于 `d3a48fa`。沿用已核验的 r4 候选 `E:\GS_readmodels_candidate_20260925_r4`，release `91e0d3fdc9821a3496e8337784f711b73a66e435f65b88aa8e137540c8eeb7f8`；未重新生成、打包或发布。
- 偶像目录点击、个人资料选择器、歌曲关联、Home 偶像入口与 `idol_detail` 直达均通过固定 release 读取偶像索引、目录页和单人详情。详情包含档案、统计、歌曲和活动；切换偶像时保留较新的选择，失败可重试。无效偶像直达转到选择器。
- 去往卡片、个人故事、聊天、电话、活动或组合资料时再准备尚未迁移的旧数据；从歌曲或卡片返回仍保留来源。其余旧页面的偶像入口仍可使用旧数据，后续迁移时逐一接线。

## 验证

- 将 r4 中 49 个偶像详情逐项与当前 checkout 的生产选择器输出比较，49/49 一致。
- `verify:archive-startup-route`、`verify:portal-navigation`、`verify:archive-navigation-state`、`verify:archive-async-navigation`、`verify:archive-presentation`、`build:check` 均通过。`build:check` 仅编译代码到 `.analysis/build-check`，不复制 `public` 语料；主 JS 约 600 kB（gzip 约 189 kB），仍有大 chunk 提示。
- Codex 应用内 Browser 使用 `127.0.0.1:5176` 的已构建代码、现有 `public` 与 r4 `pages`：偶像目录 → 天ヶ瀬冬馬、切换御手洗翔太、直达刷新、档案 → 歌曲 → 返回、歌曲直达 → 偶像 → 返回、档案 → 卡片 → 返回，以及无效档案直达 → 选择器 → 档案。页面渲染、来源路由和所选身份一致；该旅程无新控制台 error/warn。
- QA 服务日志显示纯档案与歌曲关联旅程只读取对应 read-model、歌曲时间线目录；点击尚未迁移的卡片入口后才读取旧批量 `/data`。这是本地编译代码加显式静态映射的 Browser 验收，不等于完整媒体包、部署、真实设备或真实播放验收。
