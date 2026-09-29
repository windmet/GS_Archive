# Story 播放器直达启动验收（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `e30357c`。本批次让返回目标为 `story_catalog`、`story_collection` 或 `story_detail` 的播放器 URL 使用既有 Read Model 启动路径，跳过 `restoreRoute` 对旧版整批资料的预等待。三个页面的普通直达路径此前已使用 Read Model；本批次补齐其播放器刷新入口。

## 验证

- `node scripts/verify-archive-startup-route.mjs`：通过，新增三个播放器返回目标的启动分类断言。
- `node scripts/verify-story-readmodel-navigation.mjs`、`node scripts/verify-reading-playback.mjs`：通过。
- `npm run build:check`：通过。输出为 `.analysis/build-check` 的生产代码编译，未复制 `public` 全库。
- Browser：在本机 `127.0.0.1:5184` 的生产代码映射服务中，Reading manifest 及除 `/data/reading/`、`/data/compiled/episodes/` 外的旧 `/data/` 请求返回 503。打开 `?view=story_collection&story_type=unit_story&story_section=10`，Café Parade 章节可见；点击第 1 话播放器，刷新 `return=story_collection` 的播放器 URL 后演出控件出现；点击返回后，Café Parade 章节及分段列表恢复。

Browser 实走覆盖 `story_collection` 播放器分支；`story_catalog` 与 `story_detail` 的启动分类由脚本验证。本批次未作完整媒体包、真机或部署验收。其他播放器返回目标尚未统一迁移。
