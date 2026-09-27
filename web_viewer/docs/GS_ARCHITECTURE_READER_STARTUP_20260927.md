# Reader 直达启动验收（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `82c5a06`。本批次修复 `restoreRoute` 对 `reader` 及 `player?return=reader` 的启动分类：两者走 Reading locator / 页面模型路径，不再先等待 `loadArchiveData` 的旧版整批数据。`applyArchiveRoute` 原有 Reading 定位及版本校验不变。另补齐脚本对启动分类的断言，以及上一批动态导入改动所需的测试桩。

## 验证

- `node scripts/verify-reading-navigation.mjs`：通过，包含 Reader 与返回 Reader 的播放器启动分类。
- `node scripts/verify-reading-playback.mjs`：通过，包含版本化链接、来源校验与返回路径。
- `node scripts/verify-archive-startup-route.mjs`：通过。
- `npm run build:check`：通过；产物复用 `.analysis/build-check`，未复制 `public` 语料，不是完整发布包。
- Browser：以 `.analysis/build-check` 的 JS/CSS、当前 `public`、`E:\GS_readmodels_candidate_20260927_r22\pages` 映射在本机 `127.0.0.1:5184`。测试服务让 Reading manifest 和除 `/data/reading/`、`/data/compiled/episodes/` 以外的旧 `/data/` 请求返回 503。直达 `?view=reader&reading=1_4_001_00_a` 显示《新たな夢の開演》EPISODE 01 正文；切换至 EPISODE 02 后 URL 与正文同步。点击“播放完整剧情（实验）”进入 `return=reader` 播放器，返回后恢复 EPISODE 02。直接打开同一播放器 URL 也进入播放界面。

此结果仅覆盖本机 Browser 的上述 Reader 与播放器旅程。播放器仍按需读取 `/data/compiled/episodes/` 原场景文件；其他尚未迁移的页面仍可能使用旧资料源。未执行全量媒体打包、真机或线上部署验收。
