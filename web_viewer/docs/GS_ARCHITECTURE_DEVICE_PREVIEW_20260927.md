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

## 已完成的本地验收及部署

- 测试包源版本：`c3380de6441de4735dc92278e039e6e52bfecc36`；[完整 Source Gate](https://github.com/windmet/GS_Archive/actions/runs/36306730472) 成功。
- 当前 HEAD 的 `build:check`、`verify:build-audit` 成功：`sourceDirty=false`，入口 gzip 107,724 B；`forbiddenModules=[]`、`productionLegacyModules=[]`、`legacyCallSites=[]`、`globalArchiveLoadRemoved=true`。
- r23 全部数据通过 `verifyArtifacts`；测试包 8,541 文件、62,630,601 B，打包后逐文件重新核对哈希通过。包位于 `.deploy/rebuild-device-preview-c3380de`，含清单和回执，不含 public 媒体副本。
- 最终 assembler 对同一代码/r23 执行 `--check-only` 仍以 cutover gate 未满足拒绝，没有最终 candidate。错误文案包含历史 global-loading 描述；本次实际阻塞是 routes parity/device，并非全局 loader 重新出现。
- Cloudflare Preview：`https://c405746d.gs-archive-preview.pages.dev`；稳定测试别名：`https://gs-architecture-device-test.gs-archive-preview.pages.dev`。部署分支为 `gs-architecture-device-test`，回执 `preview-receipt.json` 的 source/release 与本机一致。
- 上传 8,524 个新文件，15 个文件复用；Functions、headers、routes 上传成功。重新查询 Production 仍为原 `6ed057d8` / `master`，未切换生产。
- 线上 78 项 HTTP 验收全部通过：每种 ReadModel kind 抽取一个完整哈希样本、版本目录 immutable 缓存、index/bootstrap/preview receipt 同包哈希、真实 R2 品牌 PNG、gzip 剧情解码后源哈希、版本化数据读取及语音 206/416 Range。抽样不等于全量内容 parity；回执位于包根 `http-receipt.json`。

## Browser 旅程与边界

Browser 插件可用；未使用外部浏览器替代。沿用既有窄屏约 465×492，另在新本地标签页观察桌面布局。截图在本次会话中直接核对。

| 环境 | 旅程与观察 | 结果 |
| --- | --- | --- |
| 5188 阻断旧大表服务 | 门户→卡片→ブライトストライク→勝利を掴め！→刷新 Player→返回同一卡片 | 导航、正文、刷新返回通过；该服务缺外置卡图，不能用于媒体验收 |
| `127.0.0.1:2374` | 实际部署包静态文件 + 固定旧 Production 资源代理；单卡普通/特训图、卡片剧情画面 | 图片与剧情可见，无框架覆盖层，检查的 console error 为空 |
| 同一本地测试包 | 卡池直达→GROWING FES 分类 | 57 个卡池、分类 4/57 与选择状态一致 |
| 线上不可变 URL | 门户→故事→主线第1章→阅读 EPISODE 01→展开分段→EPISODE 02→刷新 | 正文与分段恢复一致，截图正常，最终 error/warn 日志为空 |

线上最初 `cua` 导航/AX 查询多次超时；使用同一 Browser 已有标签页的开发接口后取得截图、DOM 和交互结果。后续部分调用仍耗时约 21–55 秒，不能据此推算真实首屏性能，也不能把它笼统归因于网站或网络。分段控件位于折叠区；首次按错误标签定位失败后，按实际可见控件展开并完成选择。

未覆盖：32 条路由完整 parity、舞台 choreography/multi-stage 长稳、iPhone/iPad/Android 真机、主观音频听感和真实移动网络首屏指标。`allPublicRoutesMigrated=false`、`deviceReviewAccepted=false` 保持不变。这个地址用于下一阶段设备验收，不是最终发布签收。
