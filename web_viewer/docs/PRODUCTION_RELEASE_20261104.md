# 2026-11-04 正式发布记录

本次是站长授权的例外发布。站长原话：**“按例外发布，允许收录， gs-archive.com”**。和 10-12 一样，`allPublicRoutesMigrated` 与 `deviceReviewAccepted` 仍为 false，路由验收 ledger 没有改写为通过；授权只针对本次冻结候选。

## 冻结版本与上线结果

| 项目 | 实际值 |
| --- | --- |
| 打包源码 | `ff69dc7bf54b37e2302cc30c37df6bbe219f9119`（分支 `release/20261104-site`）= 本 PR 的 `197f530e` + resource-audit 刷新提交 |
| 基于 master | `2b254465`（含 #162 译文、#169、#170） |
| read-model release | `a15e642d20f5003730751d6227d95b5248f908e473e598bcce5c48a10e0cc160` |
| R2 data revision | `d049f4fa79d4740bdef1f6dd53b59e20a41d030697c443ba2a082c58d7d5adee`（10-12 为 `854190ad…`） |
| compiled revision | `4afb61ee02808965c8149f335b2f246f3afe543423f65fd8b9afa5de2c02fbed`（10-12 未设置） |
| 翻译 release | `9f5db982…`，1665 包 |
| Production 部署 | `924c79bb-43b3-4a1f-b4d7-0c33dd47d28c`，environment=production |
| 正式入口 | [gs-archive-preview.pages.dev](https://gs-archive-preview.pages.dev/)；gs-archive.com 见下文 |
| 同源 preview | `6278377e`，[preview.gs-archive.com](https://preview.gs-archive.com/) |
| Pages / R2 项目 | `gs-archive-preview` / `sidem-archive-preview`（不变） |

## 本轮实际变化（相对 10-12 正式站）

- 10-12 之后合入 master 的全部前端工作：门户重设计、阅读器独立页、加载系统统一、关于页、深链接与静态路径等。
- 关于页：译文署名改为「主力 Gemini 3.8 Flash；GPT 6.1 Sol、Claude Sonnet 5.5、Claude Opus 5.5 负责整体审阅和专有名词核对」；「新人 P」从名字下的小字改为站长介绍正文；传送门补上 wikiwiki、Gamerch 两个参考站和三个官方 YouTube 剧情合集。
- 首屏站点说明拆到 `src/content/siteLine.js`：原先首屏 import 整个关于页内容，加链接后启动 JS 估算 216,070，超过 216,064 上限；拆分后为 213,334。
- 允许搜索引擎收录：正式包去掉了 `_headers` 里的 `X-Robots-Tag: noindex, nofollow`。preview 继续 noindex。

## 包怎么来的

仓库没有正式打包脚本（`assemble_pages.mjs` 要求两个验收字段为 true，且不带 head shell、译文、季节正文等）。本次与 10-12 一样另做：

1. `prepare-readmodel-preview.mjs --origin https://gs-archive.com`，生成与 preview 相同结构的包，实体 head shell 的 canonical 与 og 地址指向 gs-archive.com。
2. 对包做三处改动：删除 `_headers` 开头的 noindex 规则；`preview-receipt.json` 换成 `production-receipt.json`（`purpose: user-authorized-production-exception`、`productionApproved: true`、`branch: master`，并记录授权原话、日期、范围）；检查所有 HTML 不含 preview 域名。
3. `wrangler pages deploy dist --project-name gs-archive-preview --branch master`。包内 `wrangler.jsonc` 同时把 Production 环境变量更新为上表的 data/compiled revision。

共 8873 个文件；上传 1524 个，复用 7347 个。没有上传、覆盖或删除 R2 对象。

## 验证

- 发布源码分支 `npm run build:check` 通过；`verify-interaction-contracts`（47 flows / 229 steps）与 `check_cutover_routes --progress` 通过；本 PR 的完整 CI 见 PR 页。
- 线上：`production-receipt.json` 的 sourceRevision / release / dataRevision / compiledRevision 与上表一致；首页响应头无 `X-Robots-Tag`；`/about/`、`/_catalog/bootstrap.json`、`/data/compiled/manifest.json` 均为 200；Cloudflare API 确认 canonical deployment 为 924c79bb、environment=production、Production 环境变量已更新。
- `verify-deployed-translations.mjs https://gs-archive-preview.pages.dev`：1665 包逐字节一致。
- 未做：本次没有在真实浏览器里跑正式站旅程；preview 上只核对了关于页 chunk 的内容。

## gs-archive.com

已通过 Pages API 把 `gs-archive.com` 加为项目自定义域名，状态 pending，提示 “CNAME record not set”。部署用的 wrangler 授权看不到该域名的 zone，DNS 需要站长在 Cloudflare 后台处理：把 `gs-archive.com` 根记录改为 CNAME → `gs-archive-preview.pages.dev`（代理开启），之后 Pages 会自动签发证书并转为 active。

## 回滚

发布前正式部署为 `6ba4c547-7789-4c00-a5cc-8408eed60ff3`（10-12）。回滚：在 Pages 项目 Production 部署列表选择它并回滚，同时把 Production 环境变量 `ARCHIVE_DATA_REVISION` 改回 `854190ad908cc47df022dfb35181838fa4e0fd385a537e8fc8b611053b7b0bd4` 并删除 `ARCHIVE_COMPILED_REVISION`。发布前项目配置保存在本地 `.analysis/production-before-20261103.json`（发布 worktree 内，不入库）。不要删除任何 R2 快照。
