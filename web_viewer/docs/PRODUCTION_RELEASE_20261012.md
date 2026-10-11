# 2026-10-12 正式发布记录

本次已完成合并、推送与 Cloudflare Pages Production 部署。用户明确接受未完成的路由迁移、一致性和设备验收项，批准例外发布；原验收 ledger 没有改写为通过。

## 冻结版本与上线结果

| 项目 | 实际值 |
| --- | --- |
| 合并 PR | [#47](https://github.com/windmet/GS_Archive/pull/47) |
| 验证与打包源码 | `fc5b8e0a184c5666b07ed26f925de603319efc23` |
| master 合并提交 | `51535058e1204b9797dbba89e17d05fd3bea4899`，与冻结源码的 viewer 内容相同 |
| 完整 CI | [38155974232](https://github.com/windmet/GS_Archive/actions/runs/38155974232)，123 个步骤全部成功 |
| read-model release | `999b2c90598cde6c09c46712cd66b2a08152355c404423e93b301c6097a3be0c` |
| R2 data revision | `854190ad908cc47df022dfb35181838fa4e0fd385a537e8fc8b611053b7b0bd4` |
| Production 部署 | `6ba4c547-7789-4c00-a5cc-8408eed60ff3`，状态 `success` |
| 正式入口 | [gs-archive-preview.pages.dev](https://gs-archive-preview.pages.dev/?view=live) |
| 不可变部署 | [6ba4c547](https://6ba4c547.gs-archive-preview.pages.dev/?view=live) |
| Pages / R2 项目 | `gs-archive-preview` / `sidem-archive-preview` |

正式部署使用显式 production 变量与 R2 binding。`ARCHIVE_WORK_BACKFILL_RELEASE` 为 `2026-09-28-story-work-text-backfill-001`，`ARCHIVE_SEASONAL_READING_RELEASE` 为 `seasonal-reading-v1`。项目自动生产部署仍关闭。本记录是部署后的纯文档提交，不改变上述已部署代码身份。

## 本轮实际变化

- LIVE 落地页恢复「谱面预览」「2D舞台」两块独立图片与入口，沿用现有版式。摄影工作台保持独立一级导航。
- 随包补发 306 份季节 Reading 正文，解决旧 R2 快照缺少正文造成的 404。季节剧情尚未翻译；本次没有新增翻译，也没有将原文可读当作译文验收。
- 活动资源图更新 Reading manifest 来源哈希，内容不变；重建 read-model 并同步四份消费端绑定。
- 修复累计分支的 CI 接线：回执原始换行字节、恢复函数的共享依赖、现行季节 ledger 展示输入、2D舞台文案和派生技能字段断言，以及路由 schema 的覆盖登记。
- 制作人称呼待审核队列从 440 条同步为 484 条。原清单没有人工审核结论或备注；保留交集记录，并保存增删 ID 与前后哈希。
- 生日合并稿的退休补入 `2026-10-12-birthday-small-talk-retirement-001` supersede 记录。保留现行分段稿和旧 release 历史，没有恢复旧合并稿覆盖分段结果；当前账本为 202 releases / 1365 stable logical IDs，strict-v2 登记基线为 4 collections / 1170 standalone / 1199 artifacts。

## 验证边界

- `npm run build:check` 通过，固定输出 `.analysis/build-check`，未复制 public 媒体语料库。
- LIVE 的本地 Browser 桌面、390×844 手机布局，以及进入谱面、进入舞台和返回 LIVE 的旅程通过。
- 最终完整 Source Gate 通过，包括 125 项 source-only 批次、导航、Reading、展示边界、schema、发布账本及构建审计。
- 6276 份 read-model 产物校验通过；1379 份冻结来源与本地字节匹配。
- 新季节正文在先前测试部署已完成 306/306 GET 和 SHA-256 核对。用户确认测试站可用后要求停止在线季节交互测试；正式部署后仅核对关键 HTTP 文件，没有重跑季节翻译或完整 Browser 旅程。
- 不可变部署与正式域名各 13 项 HTTP 200 / SHA-256 核对通过，包括 HTML、生产回执、bootstrap、入口与 LIVE 代码、谱面及舞台图片、季节正文、发布 manifest 和新增退休 release。Cloudflare API 确认 environment=production、branch=master、commit 与合并提交一致。

## 例外授权与包

标准 `readmodels/tools/assemble_pages.mjs:19` 要求 `allPublicRoutesMigrated=true` 和 `deviceReviewAccepted=true`。当前仍未满足：41 条路由的设备验收均为 pending，迁移及一致性记录也有未完成项。用户在获知这些边界后明确回复：**“接受已列明的未完成项，例外发布”**。

本次以独立生产例外回执记录该决定；两个验收字段继续为 false。该授权只针对本次冻结候选，不代表以后可以默认绕过正式门禁。

正式包复用 `.deploy/production-exception-20261012-e8dceb5d`，其目录名是准备阶段名称，准确版本以 `production-package.json` 和线上 `production-receipt.json` 为准。最终共 10836 文件 / 158765694 字节；Wrangler 上传文件数排除 `_headers`、`_routes.json` 后为 10834。本次没有上传、覆盖或删除 R2 对象。

第一次代理上传长时间没有进展，停止的仅为本次 Wrangler 进程。使用同一冻结包临时清除进程内代理后，6379 个新增文件约 68 秒上传完成，4455 个文件复用缓存；随后 Worker、headers、routes 部署成功。

本地证据：`.analysis/release-final-build.log`、`.analysis/release-final-audit.json`、`.analysis/production-before-20261012.json`、`.analysis/production-after-20261012.json`、`.analysis/production-http-20261012/report.json`。这些是本工作区证据，不属于提交的媒体包。

## 回滚

发布前正式部署为 `6ed057d8-7178-4183-96bd-a5f5c1942406`，不可变地址 [6ed057d8](https://6ed057d8.gs-archive-preview.pages.dev)。如需要回滚，在同一 Pages 项目的 Production 部署列表中选择该部署并执行回滚，同时复核当时的环境变量与 R2 revision；发布前配置保存在上述 before 证据中。不要删除当前或旧 R2 快照。
