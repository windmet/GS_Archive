# GS 偶像目录轻量入口：2026-09-25

- 输入分支 `codex/gs-architecture-rebuild`，开始于 `3b021b7`。沿用已核验的 r4 inline bootstrap（release `91e0d3fdc9821a3496e8337784f711b73a66e435f65b88aa8e137540c8eeb7f8`），不重新生成候选。
- `idols` 目录用 bootstrap 中 49 位偶像身份与组合归属渲染网格、搜索和组合筛选；直接打开 `?view=idols` 会规范为 `category=idol`。点击偶像档案或组合资料时才准备尚未迁移的旧数据；返回目录保留筛选。
- `verify:archive-navigation-state`、`verify:archive-startup-route`、`verify:portal-navigation` 与 `build:check` 通过。后者只编译代码到 `.analysis/build-check`，不复制 `public` 语料。
- Codex 应用内 Browser 使用 `127.0.0.1:5176` 的已构建代码和现有 `public`：直接打开偶像目录显示 49 位、16 组；选 Jupiter 后只显示 3 位；点击天ヶ瀬冬馬进入档案，再返回保留 Jupiter 筛选。控制台该旅程无新 error/warn。QA 服务日志显示目录直达只有页面请求，点击档案后才发起旧 `/data` 批量请求。
- 本批仅迁移目录入口。偶像档案及组合资料仍使用旧数据；候选未发布，未做部署或真实设备验收。
