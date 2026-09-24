# 正式发布准备（2026-09-24）

状态：已执行 Production 发布，正式入口已切换；发布后验证见下方记录。用户已确认真实测试没有问题，并选择 `https://gs-archive-preview.pages.dev` 为正式入口。此确认记为用户验收；未推断设备、浏览器或全部剧情覆盖。

## 发布内容

- 项目 `gs-archive-preview`，复用私有桶 `sidem-archive-preview`，绑定 `ARCHIVE_ASSETS`；不重新上传或复制媒体。
- 候选源码 HEAD `bc5dc389d54a23998c3327d07c7be5daed092c1c`；相对已验收部署源码 `03167e0`，后续仅脚本和文档变化，没有前端或 Functions 变化。远端 master 核对为 `3e547e7caad69b94056c98349bbe42d7d2c4d65f`。
- 从已验收部署的本地 stage 冻结 `E:/Web_build/SideM_Archived/web_viewer/.deploy/production-preparation/package`，57 文件、2,028,054 B。包含 dist、Functions、shared 和配置，不包含媒体全库；保留原 canary stage。
- 线上 `3412e295` 的 index.html 与候选包字节一致；Functions/shared 与当前源码逐文件一致。各文件 SHA256 在同级 `receipt.json`。无需重复构建改变已验收产物。
- `ARCHIVE_GZIP_MODE=all`；`ARCHIVE_DATA_REVISION=c5ab806ee57778bc387322acfcf5211ecdf0521721a6df279dbe52a6e006e5b9`。候选配置显式写入 production 的 vars 与 R2 绑定，避免环境继承歧义。
- Wrangler 4.131.1 实时下载的项目配置在 `remote-config/wrangler.toml`；该文件 production 段仅显式列出 R2 绑定。随后通过 Cloudflare API 实时核实：Production 分支为 `master`，自动 Production Git 部署关闭，域名仅 `gs-archive-preview.pages.dev`；Production R2 绑定正确。脱敏结果见 `project-settings.json`。

## 资源与验收边界

资源依据 `.deploy/voice64/full-manifest.json`，SHA256 `7c833a160bfea852c585ff9d97046271bc05343d1d3b0a5523dc5d174a2f7f58`。98,032 对象，6,574,047,523 B；按其他用途最低 880,000,000 B 预留，距 10 GB 控制线仍余 2,545,952,477 B（本次语音迁移完成时测量）。此次 Pages 发布无新增 R2 媒体占用。

已有验证：全量 32,421 语音 checksum 一致；160 条语音 HTTP 抽查通过；60 条结构化 gzip、3,176 条数据 JSON HTTP 验证通过。2026-09-24 用户补充真实播放验收通过。

仍有 [82 项既存音频依赖缺失](PRODUCTION_MISSING_DEPENDENCIES_20260924.md)：75 BGM、6 SE、1 ambient。清单没有包含这些对象，相关请求可能 404／无声音。用户实测通过不能等同于这些依赖已补齐。旧 Preview 合同禁止将 `--allow-missing` 当 Production 验收：本次已获用户对这份具体清单的明确接受，详见下方 release acceptance。本次不调用旧 exporter、不重传旧 128k 文件。

## 正式发布执行

Production 分支和绑定已核对；落实上述缺失决策、重新核对候选回执文件 hash 后，用冻结包部署同一 Pages 项目，命令为：

```powershell
npm exec --offline --no -- wrangler pages deploy dist --cwd .deploy/production-preparation/package --project-name gs-archive-preview --branch master --commit-hash bc5dc389d54a23998c3327d07c7be5daed092c1c --commit-message 'Release accepted gzip and 64k archive' --commit-dirty=true
```

上述命令已成功执行，正式入口已切换。不要通过推送旧 master 或创建第二个桶代替发布。

发布完成后对正式 origin 执行 `verify-preview-http.mjs`（显式传 `.deploy/voice64/full-manifest.json`）与 `verify-voice64-http.mjs`，并复核 gzip、数据快照、翻译和用户验收剧情入口；保存部署 ID、正式入口结果及 Production 配置。Preview 已通过的检查不冒充正式 origin 验收。

## 回退

保留 `3412e295` Preview 与 `.deploy/storage-compression/pages-canary`。如果正式入口异常，先继续使用已验收 Preview；使用其兼容 gzip 与固定 data revision 的冻结包重新发布 Production。初次 Production 若无兼容历史部署，不承诺可一键 rollback。禁止回退至 gzip 前代码或清空/还原 R2；旧代码不兼容当前物理对象。

## Production release acceptance

2026-09-24 用户明确批准：Production candidate accepted with known non-blocking audio gaps，并授权正式入口切换。

本次 Production 接受 75 项 BGM、6 项 SE、1 项 ambient 的既存未闭合依赖为已知非阻断发布限制。清单不包含剧情台词语音；这些依赖在本轮压缩、R2 重建和 64k 替换前已存在，不属于本次发布引入的回归。用户报告候选真实测试无问题，未发现其阻断核心浏览、阅读与播放流程。

接受不代表全部 82 项都已确认是真实媒体缺失，也不代表问题关闭。后续分别调查 sentinel/control、mapping-unresolved、source-unresolved、confirmed-missing；不在本次上线前逐项定性。详细清单仍由技术文档维护，旧 Preview 的 `--allow-missing` 规则不变。

About 的简短档案完整性说明及分类恢复工作安排在上线后，不写死数量，不向播放器添加缺音警告弹窗；本次保持现有运行时行为。

## Production 执行回执

部署 ID：`6f231f60-907c-4e32-9705-a4cae5dd9bb3`；不可变部署地址：<https://6f231f60.gs-archive-preview.pages.dev>；正式入口：<https://gs-archive-preview.pages.dev>。

Cloudflare API 已确认 canonical deployment 为上述 ID、environment 为 production；Production gzip mode、固定数据 revision 和 R2 绑定均与候选配置一致。Wrangler 编译 Functions 成功，35 个静态文件全部复用远端已上传字节。本轮没有写入或删除 R2 对象，没有更改 Git 自动部署设置。

正式入口首页与候选文件 SHA256 一致；3 个受版本控制的翻译 JSON 逐字节一致。证据保存在 `.deploy/production-preparation/production-live.json` 和 `deploy.log`。用户真实播放验收来自发布前相同候选；部署后的自动验证是 HTTP/字节/协议证据，不冒充新的人工播放验收。

正式入口 35 个静态发布文件已逐字节匹配冻结包（`production-static-receipt.json`）；60 条 gzip 检查与 160 条 64k 语音检查全部通过、0 失败。图片映射、品牌 PNG、ETag/304、HEAD、Range/416、404/405 检查通过。分别见 `production-gzip-receipt.json`、`production-voice-receipt.json`、`media-http.log`。

正式入口全量 3,176 条数据 JSON 校验全部通过、0 失败（状态、类型、大小、SHA256），见 `production-data-receipt.json`；完成时间 2026-09-24T11:01:55.440Z。本次 Production 发布及自动检查已完成。
