# 卡片详情与播放器返回路由：叶子加载收口（2026-09-27）

输入基线：`320d212`（`codex/gs-architecture-rebuild`）。本批仅调整卡片详情与播放器返回卡片详情时的路由加载时序；未制作发布包或部署。

## 改动

- `applyArchiveRoute` 在发布 `card_detail`，或发布 `returnView=card_detail` 的 `player` 前，按卡片 ID 读取卡片详情叶子；当前路由意图失效时不写入结果。
- 移除依赖 `view` 与 `currentCardId` 的事后兼容监听。卡片详情所需数据归路由意图所有。
- 异步导航回归覆盖卡片详情等待、播放器返回目标等待，以及旧请求晚到时不可覆盖新路由。
- `readmodels/contracts/routes.json` 移除已经解决的兼容监听剩余项；播放器的其他 `returnView` 目标仍保持 `partial`。

## 验证

- `npm run verify:archive-async-navigation`（含卡片 read-model 导航回归）：通过。
- `npm run verify:archive-startup-route`、`npm run verify:portal-navigation`：通过。
- `npm run verify:cutover-routes`、`npm run verify:build-audit`：通过；路由总数 32，`allPublicRoutesMigrated=false`。
- `npm run build:check`：通过。输出为 `.analysis/build-check`，不复制 public 语料，不是可部署的完整包。
- 本地 Browser，`http://127.0.0.1:5188`：卡片目录进入 `001tom_ssr01` 详情，打开卡片剧情进入播放器，刷新播放器 URL 后返回卡片详情，再返回目录并通过浏览器历史回到详情，路由与剧情均可恢复。测试中曾因可复用构建目录被覆盖，旧页面请求旧哈希 chunk 失败；刷新到当前构建后同一路径通过。

Browser 的 QA 服务没有映射外部卡图目录，卡片肖像和横图请求返回 404。因此本记录只确认路由、数据和操作流程，不构成卡图呈现验收。没有设备验收、完整媒体发布包或生产部署证据。
