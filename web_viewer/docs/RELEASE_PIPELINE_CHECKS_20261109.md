# 发布流水线检查记录（2026-11-09）

稳定规则见 [RELEASE_CONTRACT.md](RELEASE_CONTRACT.md)。本文件只记录 2026-11-09 当天的一次性结果。所有 Cloudflare 访问都是只读 GET，没有部署、没有写 R2、没有改项目配置。

## 1. 线上冒烟（未带 `--package`）

命令：`node scripts/verify-deployed-site.mjs <origin>`，全部经本机代理走 curl。

| 地址 | 结果 | 红项与说明 |
|---|---|---|
| `https://preview.gs-archive.com` | FAIL（1 项） | `robots`：`/robots.txt` 返回 200 `text/html`（SPA 回退）。线上预览包是 11-09 的 `95c8c896`，早于打包器新增 `robots.txt`，所以这是预期的旧包缺口，不是回归。其余行 PASS：回执为 preview（源 `95c8c896`）、`X-Robots-Tag: noindex, nofollow`、入口 chunk、catalog 与 23 个域索引、4 个 R2 抽样键、canonical 指向 `preview.gs-archive.com`。 |
| `https://gs-archive-preview.pages.dev` | FAIL（2 项） | `robots`、`sitemap` 同为 SPA 回退 HTML。线上 production 部署的回执是 11-04 的 `ff69dc7b`（`production-receipt.json`），此包早于 `robots.txt` / `sitemap.xml`。canonical 指向 `https://gs-archive.com`，该域名此刻能连上。 |
| `https://gs-archive.com` | FAIL（2 项） | 同上：`robots`、`sitemap` 为 SPA 回退 HTML。DNS 已生效，`site-origin` 通过（返回 200），回执、catalog、R2 抽样、canonical 全部 PASS，无 noindex。内容与 `pages.dev` 的 production 部署相同。 |

三个地址上都出现的 warning：`missing-chunk`，随机的 `/_app/<随机>.js` 返回 200 `text/html`（已知问题 N2，Pages SPA 回退）。这是 warning，不是 fail。

已知问题的覆盖情况：

- N1（canonical 指向无法解析的域名）：脚本有 `site-origin` 行，不能连接时给出 DNS 答复并直接失败。本次 `gs-archive.com` 已能解析，所以该行通过。fixture 里有反向用例（不可达 origin 必须 FAIL）。
- N2（缺失的 `/_app/*.js` 与 `/robots.txt` 被回退成 200 HTML）：前者记 warning，后者在 `robots` 行失败，三个地址都复现。
- `/data/*`、`/assets/*` 由 Functions 处理，4 个抽样键都是 200，没有发现回退成 HTML 的情况。

观察到的瞬时故障：同时并发跑两个冒烟时，其中一次对 `gs-archive.com` 出现 `curl 35 schannel: failed to receive handshake`（`site-origin` 与一个域索引失败）。同一地址单独重跑全部通过。这是本机代理在并发下的瞬时握手失败，脚本对传输失败会自动重试一次，但并发时仍可能撞上；冒烟请逐个串行跑。

另外，一次冒烟约 100 秒，慢在经代理的 curl 往返（约 60 个请求）。

只要 production 部署换成用新打包器出的包，上面三个地址的 `robots`、`sitemap` 两项预期转为 PASS（离线检查已验证包内容，见第 3 节）。

## 2. 回滚语义（只读核对）

方法：`npx wrangler pages deployment list --project-name gs-archive-preview --environment production` 列出部署；token 取自 wrangler 的 OAuth 配置，由临时脚本在进程内读取并调用 `GET /accounts/{account_id}/pages/projects/gs-archive-preview/deployments/{id}`，token 没有打印、没有写入任何文件。

结论：**Pages 部署对象保存环境变量快照。** `924c79bb` 与 `6ba4c547` 的对象都带 `env_vars`、`r2_buckets`、`compatibility_date`、`build_config`：

| 部署 | 创建时间 | 源提交 | `env_vars` |
|---|---|---|---|
| `924c79bb` | 2026-11-03 | `ff69dc7b` | `ARCHIVE_DATA_REVISION=d049f4fa…`、`ARCHIVE_COMPILED_REVISION=4afb61ee…`、`ARCHIVE_GZIP_MODE=all`、`ARCHIVE_SEASONAL_READING_RELEASE=seasonal-reading-v1`、`ARCHIVE_WORK_BACKFILL_RELEASE=2026-09-28-story-work-text-backfill-001` |
| `6ba4c547` | 2026-10-11 | `51535058` | `ARCHIVE_DATA_REVISION=854190ad…`、`ARCHIVE_GZIP_MODE=all`、`ARCHIVE_SEASONAL_READING_RELEASE=seasonal-reading-v1`、`ARCHIVE_WORK_BACKFILL_RELEASE=…`（**没有** `ARCHIVE_COMPILED_REVISION`） |

两个对象的变量不同，说明变量确实随部署固化，而不是读取项目的当前值。

另外：production 列表里比 `924c79bb` 新的条目（如 `bfae916c`，源 `203eb830`）都是 GitHub 推送触发的 `github:push` 部署，状态全部是 `queued/idle`，从未构建，也没有上线。项目的 `canonical_deployment` 仍是 `924c79bb`，`https://gs-archive.com/production-receipt.json` 也是它（源 `ff69dc7b`）。判断线上版本只看 canonical deployment 和线上回执，不看列表顺序。（验收时更正：子 agent 初稿误以为 `bfae916c` 已上线。）

对回滚的含义：

- 回滚到旧部署时，它引用的 data revision 与 compiled revision 必须仍在 R2（`6ba4c547` 引用旧的 `854190ad…`）。这是 RELEASE_CONTRACT 第 7 节“最近两个正式部署的 revision 不删”的依据。
- R2 的 `assets/` 键不分版本，回滚不会恢复被替换过的键。

**未决（没有查到或没有做）：**

1. 没有实际执行过一次控制台回滚，所以“回滚后旧部署使用自己的 `env_vars`”是由快照推断的，没有观测验证。需要一次可控的演练（例如回滚到上一个部署再回滚回来）才能确认；这会改动线上，本次不做。
2. `_headers` 中的 `X-Robots-Tag` 随部署内容固化，是否也随回滚生效，同样依赖上一条。
3. Pages 的 API 返回的 `latest_stage` / 别名等字段没有逐个核对。

## 3. 本次出包与离线检查（摘要）

出包目录在 `E:/Web_build/GS_Archive_Domain_Work/w2-pkgtest/`（`preview-a`、`preview-b`、`prod`），均为一次性目录，没有部署。

- `preview-a` 与 `preview-b`：7599 个文件、163,893,034 字节，`manifestSha256` 都是 `1c34fedb…f9f716`，逐文件的路径、字节数、sha256 全部相同（可复现）。
- `preview-a` 与 11-09 实际部署的预览包 `pkg-95c8c896`（7598 个文件）的差异：
  1. 新增 `robots.txt`（有意：两个目标都发 robots）。
  2. `preview-receipt.json` 字段更多（`target`、`translationRelease`、`startupPolicySha256`、`publicRoutesReady`、`siteOrigin`、`searchIndexing`、`journeys`、`initialJsGzipLimit`），并且 `sourceRevision`、`sourceDigest` 不同（源提交不同；有意）。
  3. `_app/` 下 106 个文件名中的哈希变了，1525 个非 `_app` 文件（主要是实体页壳 HTML 与 `idols`/`cards` 等）随之变化。**只有 `ArchiveStatus` 一个 chunk 的内容真实不同：它内嵌了 `sourceDigest` 常量。** 它被入口 chunk 动态引用，所以入口 chunk 的哈希变化，沿依赖链把其余 chunk 与引用它们的壳 HTML 的文件名全部改变；把 `-<8 位哈希>.js/.css` 归一化后，其余 chunk 与全部壳 HTML 字节相同。源码目录（`src/`、`index.html`）相对 `95c8c896` 没有变化，只有构建审计的源摘要不同。
- `prod`（`--exception`）与 11-04 正式包 `prod-ff69dc7b`：当时手改的三处现在都由脚本产出——`_headers` 无 noindex（两包的 `_headers` 内容相同）、`production-receipt.json`（新增 `target`、`approval`、`exception`、`siteOrigin`、`searchIndexing` 等）、`wrangler.jsonc` 的 vars（`ARCHIVE_GZIP_MODE`、`ARCHIVE_DATA_REVISION`、`ARCHIVE_COMPILED_REVISION`、`ARCHIVE_SEASONAL_READING_RELEASE` 由脚本写出）。差异中另有：新增 `robots.txt`、`sitemap.xml`（1524 个 URL）；`_app` 哈希变化，新包多出 `ArchiveVoiceRow`（js 与 css）、`gauge`、`rotate-cw` 共 4 个 chunk（11-04 之后的源码变更）；163 个译文文件变化（`61c373ae…` 的译文发布，1665 个文件）；`_work-backfill/` 整个目录（约 1400 个文件）与 `_routes.json` 里对它的排除项消失，`wrangler.jsonc` 也不再写 `ARCHIVE_WORK_BACKFILL_RELEASE`。这一条来自 master 的 `7056fe97`（“serve work stories from the R2 snapshots; retire the /_work-backfill 302”），不是打包器的行为；11-09 预览包 `pkg-95c8c896` 同样没有它。线上 production 部署的项目级变量里仍带 `ARCHIVE_WORK_BACKFILL_RELEASE`（`functions/data` 里保留旧引用），下一次正式部署前需确认该变量可以留着也可以去掉。
- 反向用例（均在不创建输出目录的前提下被拒绝）：缺 `--approval` 报 `Production requires --approval …`；既没有 `--exception` 也没有 `--journeys` 报 `Production requires exactly one of --journeys … or --exception`；`--exception` 与 `--journeys` 同给也报同一条；journeys 的 `sourceDigest` 与本次构建不一致报 `Journey results are for source digest ffff…, not this build's 89c92740…`。
- 离线冒烟 `--package <dir> --local` 对 `preview-a` 与 `prod` 均通过（0 fail，仅 `missing-chunk` warning 与需要网络的 SKIP）。
