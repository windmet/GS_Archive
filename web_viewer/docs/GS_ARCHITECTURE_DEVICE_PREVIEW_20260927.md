# 重构测试页与本地验收（2026-09-27）

输入 HEAD：`25f49d8`，高于审阅的 `320d212`。本轮用户授权本地验收和测试页部署；正式生产切换及设备签收不在此次已完成声明内。

## 部署合同

- 已核实正式 Pages 为 `gs-archive-preview` 项目的 `master`，Production deployment `6ed057d8-7178-4183-96bd-a5f5c1942406`。
- 使用独立 Preview 分支 `gs-architecture-device-test`，不用 Git 自动生成但缺少本地 ReadModels 的重构分支预览作为验收地址。
- `scripts/prepare-readmodel-preview.mjs` 是设备审阅专用打包器：检查当前 HEAD 构建审计、干净源代码、无禁止入口模块、无全局 loader、ReadModels 完整性及 bootstrap 一致性后，复制代码、ReadModels、已跟踪翻译和现有 Functions。
- 最终 `assemble_pages.mjs` 保持原有严格门禁；测试包写入 `productionApproved=false` 和待验收路线，不产生设备签收。
- 使用 r23：`409c9f9e2f5f010da609a44c15f9b6f5bc15329c86d2969bf90b22f20d81cdd9`，8,419 个产物，60,649,316 字节。候选目录 `E:\GS_ReadModels_QA\candidate_20260927_r23`。打包只复制约 61 MB 模型及代码，未复制完整 public 媒体库。
- 远端配置下载核对：`ARCHIVE_GZIP_MODE=all`、`ARCHIVE_DATA_REVISION=c5ab806ee57778bc387322acfcf5211ecdf0521721a6df279dbe52a6e006e5b9`，R2 binding 为 `ARCHIVE_ASSETS` / `sidem-archive-preview`。沿用只读资源服务，不覆盖 R2 对象。
- 本地 5188 服务映射当前 `.analysis/build-check`、r23 和现有 public，并阻断旧大索引。5186 仍映射旧 r22，不用于本轮。

## 提交前检查

- RAW character-image candidate 的旧断言已改为检查 App 消费 bounded `promotedVisualUrl`、生产者执行 promotion；candidate/promotion 两个回归通过。
- 路由账本 reviewedSourceRevision 更新至 `25f49d8`；保留 Stage/Player 和跨域 parity 缺口，未改变 parity/device 为通过。
- `verify:cutover-routes` 通过；打包器语法检查通过。完整 source CI、当前 HEAD 构建、实际 Browser 和远端 HTTP 结果在部署后另行记录。

## 设备验收应记录

使用最终部署的不可变 URL 记录设备型号、系统/浏览器版本、网络、首次打开与重访时间、卡片/剧情的来回导航和刷新、语音/BGM、舞台连续进出。至少覆盖 iPhone Safari、iPad Safari、Android Chromium；本机 Browser 结果不能替代这些记录。
