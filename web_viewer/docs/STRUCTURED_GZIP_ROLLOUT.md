# 结构化资源 gzip：本地候选与发布步骤

## 范围和默认状态

本轮从 `origin/master` 产品基线 `3e547e7` 新开 `codex/storage-compression`，只 cherry-pick 两个审计文档提交，不包含 About UI。

当前实现为 **默认关闭的 gzip-v1 增量部署通道**。现有 PNG/WebP、音频、歌曲、背景和 v2 完整 exporter 保持原行为。原 `.deploy/r2`、`.deploy/r2-manifest.json` 不覆盖、不裁剪。没有远端上传、配置切换或 GC。

白名单：

| 逻辑请求 | 物理对象 | Content-Type |
| --- | --- | --- |
| `data/compiled/**/*.json` | 原键 + `.gz` | `application/json` |
| `assets/lipsync/**/*.json` | 原键 + `.gz` | `application/json` |
| `assets/live-chibi/motions/**/*.{motion,bin}` | 原键 + `.gz` | `application/octet-stream` |

motion 是真实二进制，不是 JSON；不能统一标 application/json。所有 gzip 逐字节 round-trip。Schema 3 增量 manifest 有 source/deployed 双 SHA-256、size、Content-Type 和 deployed_content_encoding；不要用 v2 验证器验证 v3 增量。

## 当前基线

执行 `npm run audit:preview-baseline`：使用现有 exporter 同一枚举和依赖闭包，读取当前每个文件完整内容，不复制媒体。

- 98,032 个源文件，10,676,951,559 B；10,416 个 scenario。
- 相比旧 manifest：526 个 source size drift，另有 2 个 same-size content drift：`data/archive_baseline_report.json`、`data/reading/coverage.json`。
- 旧 WebP manifest 缺少 15,399 张原 PNG 的 source hash；不能据旧 deployed hash 声称这些原件没变。本轮已为所有当前源生成 source hash。
- 82 个外部音频缺失仍显式保留。它们不是 gzip 新增缺失。
- 新 baseline 与旧 manifest hash 均记录在 `.deploy/storage-compression/source-baseline.json`；文件存在时拒绝覆盖。新批次须先明确归档本地旧批次，再建立新基线。

## 命令与产物

在 `web_viewer` 执行。所有资源派生物留在 E 盘 `.deploy/storage-compression/`，Git ignored。

```powershell
npm run audit:preview-baseline
# 可选参数是包含实际剧情/口型/动作请求键的 JSON 数组；每类最多30条。
npm run prepare:gzip-canary -- .deploy/storage-compression/pinned-keys.json
npm run verify:gzip-routing
npm run verify:gzip-assets
npm run build:check
npm run serve:gzip-canary
# 另一个终端
npm run verify:gzip-http -- http://127.0.0.1:5180
```

canary 每类20条，本轮共60条。生成器在编码前再次检查 source size 和 SHA（同大小变化也失败）；JSON 才做 JSON.parse，二进制原样编码。输出目录必须不存在，失败不把部分输出当成功 manifest。校验器重新比对 encoded hash、解压 hash、baseline 绑定、目录闭包和 metadata。

`serve:gzip-canary` 使用 build:check 的生产代码、当前 baseline 对应源资源及 public/translations；只有选中键经过真实 `serveR2Resource` 和本地 R2 adapter。不是完整静态发布包，也不是 Cloudflare runtime。设置 `SIDEM_GZIP_CONTROL=1`、`SIDEM_CANARY_PORT=5181` 可启动同 bundle 的未压缩对照。

全量生成要求 `canary-acceptance.json` 明确 HTTP、Browser 通过、环境及证据，并绑定 baseline 与 canary manifest hash；不是工具自动将测试数量视为通过。本轮该 receipt 仅批准 **本地派生物生成**。

```powershell
node scripts/prepare-structured-gzip.mjs --full
node scripts/verify-structured-gzip.mjs .deploy/storage-compression/structured-manifest.json
```

`structured-manifest.json` 是三域 delta，**不是完整部署清单**。尤其不能把旧 staging + gzip delta 直接当当前完整发布：gzip 外的 source drift 尚须与远端/旧对象对账。

## 当前全量本地结果

43,970 个当前源文件：**1,448,677,657 → 202,599,949 B**，gzip 派生物约 **193.21 MiB**，较原字节节省 **1,246,077,708 B（1.161 GiB）**。生成时与独立校验时均做了完整解压/source hash 比对，包含白名单完整覆盖与 staging 闭包校验。

这是真实本地 delta，不是旧8.454GiB基线减法的线上结果。本次 Node v24.14.1 / zlib 1.3.1-e00f703 产出与上次 Python gzip 估算的压缩大小不同，以本次 manifest placement hash/size 为准；不可混用旧审计的压缩字节 hash。没有重编码图片，也没有复制未变音频或整库媒体。

## HTTP 合同

- gzip 对象透传 `writeHttpMetadata`，校验 gzip encoding 与原内容类型；metadata 缺失/错误返回502，不猜测。
- Workers Response 使用 `encodeBody: 'manual'`，避免对预压缩字节再次自动编码。
- gzip 不声明 Accept-Ranges；忽略 Range，完整200，不返回206；音频原206/416行为有独立回归。
- ETag 使用物理 representation 的 R2 ETag；支持 GET/HEAD/304、弱比较与列表条件。
- `Vary: Accept-Encoding`；明确拒绝 gzip 的请求（identity、gzip;q=0等）返回406且不缓存。本轮未实现 identity 解压分支。浏览器常规 gzip 请求已实测。
- HTTP verifier 使用原始 HTTP 客户端验证 compressed hash，再以 fetch 自动解码验证 source hash；不能混用二者。HEAD Length 为 encoded size。

参考：[Workers Response encodeBody](https://developers.cloudflare.com/workers/runtime-apis/response/)、[R2 HTTP metadata](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)、[Cloudflare Range](https://developers.cloudflare.com/cache/reference/range-requests/)。本地 Node 验证了 Response 构造选项和字节传递，真实 Workers 行为仍须云端 canary。

## 上传与切换：尚未执行

上传工具默认只生成计划、校验本地候选。按 MIME 分组使用 rclone `--metadata --metadata-set content-type=... --metadata-set content-encoding=gzip`，依据显式文件清单执行 copy，绝不 sync/delete。`--ignore-times` 确保重新执行时 metadata 也重新写入；仅作用于 manifest 列出的 gzip 键。[rclone S3 metadata](https://rclone.org/s3/#metadata)

```powershell
node scripts/upload-structured-gzip.mjs .deploy/storage-compression/canary-manifest.json cloudflare:sidem-archive-preview --plan
# 真正远端 dry-run 与 upload 是后续发布步骤，本轮未执行：
# 把 --plan 改成 --dry-run 或 --upload
```

发布顺序：

1. 对账当前源 baseline、528 个已确认内容变化、82 missing 和远端 inventory。旧 JSON 为回滚版本保留；预算按新旧并存峰值计算，不按理论净省空间计算。
2. 先上传60条 canary 的新物理键；核对远端 metadata 与原始压缩字节。
3. 独立 Preview 环境设置 `ARCHIVE_GZIP_MODE=canary`，`ARCHIVE_GZIP_CANARY_KEYS` 为 canary manifest 的 request_key JSON 数组；对应 Function 代码发布后执行同一 HTTP verifier + Browser Story/口型/Reading/Chibi。
4. 云端通过后再上传全量 structured delta，并结合更新的非 gzip 清单完成版本闭包。设置 `ARCHIVE_GZIP_MODE=all` 前确认每个白名单键均已就位。
5. 回滚：先将 mode 关闭/移除，恢复旧原键和对应产品数据版本；不要提前删除旧对象。关闭gzip开关只回退表示格式，不自动回退产品数据。
6. 稳定后另开 manifest GC 批次，保留活跃/回滚版本并集。上传新增 `.gz` 会先增加远端占用；净收益要等受控清理旧 representation 后才实现。

不得启用 all 后继续用只生成 v2 原布局的 exporter 当完整发布流程；此时需使用 v3 delta 加经对账的完整发布计划。语音另开下一批，当前不改音频编码。

## 本轮本地验收

Browser 插件/技能未在会话列出（Browser plugin not available），使用已捆绑 Playwright + 本机 Edge headless，无新浏览器依赖安装。URL `127.0.0.1:5180`，对照5181，1280×850；另测390×844阅读页双语切换，无横向溢出。不是物理手机或Safari验收。

| 检查 | 结果 |
| --- | --- |
| 页面身份/非空/无框架错误覆盖 | 通过；SideM Story Viewer，剧情、阅读、小人界面可见 |
| 60条 raw HTTP / HEAD / 304 / Range忽略 / 双hash | 全通过 |
| 60条真实浏览器 fetch 自动解码 source hash | 全通过 |
| Story + 口型 | `episodes/1_4_001_00_a.json&at_step=12` 进入playable，点击推进至13；口型a1003走gzip |
| Chibi motion | 单人实验室动作2→3，标签与渲染变化，两条motion均走gzip |
| Reading | `reading=1_4_001_01_d` 点击双语，原文/已存在译文呈现；reading资源本身不在gzip范围 |
| 控制台 | 无pageerror；序章缺可选翻译404、Pixi update/tint警告在未压缩对照也存在，未宣称全零告警 |
| 代码构建/相关回归 | build:check；旧Preview routing/transform、新gzip routing、资源transport、reading repository、plan preparation、Spine preload、step playback与playback controller通过 |

验收发现并单独修复了既有 Story 阻塞：`retainedStageStep` 的深 ref 把原步骤包装为代理，导致 `SpineStage` 对象身份校验永久等待 scene-renderable。改用 shallowRef 后，两条对照均变为playable；提交 `1f212cf`。原源码错误不能算成压缩错误，也没有绕过 readiness。

最初 Vite canary 在大目录上请求超时，改为明确的生产bundle+资源映射服务后，60条HTTP完整通过。没有停止其他工程服务。

60条编码 benchmark：gzip9为222,162 B，Brotli q9为204,286 B；测得压缩/round-trip计时约89ms vs Brotli压缩348ms（计时范围略不同，不作严格性能结论）。分域样本外推 Brotli额外收益约10.4MiB，非全量结果；继续gzip。

本机证据：`.deploy/storage-compression/` 的 baseline、两个manifest、HTTP receipt、acceptance与请求日志；截图及浏览器hash/对照日志位于 `C:/Users/windm/.codex/visualizations/2026/09/24/01a0d19a-0135-74a1-a491-58a3b8b641b0/`。旧审计仍见 [存储审计](STORAGE_HOSTING_AUDIT_20260924.md)。

## 2026-09-24 云端 canary 进展

已向现有私有 R2 bucket 上传 60 条新 gzip 键（222,162 B），保留全部旧对象；已在现有 Pages 项目的 `codex/storage-compression` 分支发布独立 canary。当前固定地址：<https://cf53d8f0.gs-archive-preview.pages.dev>，代码提交 `2e3ab55`。尚未开启 all、未上传全量 43,970 条、未清理远端对象。

真实云端首次检查发现 Cloudflare 会规范化 Accept-Encoding，使 identity 请求误返回200。现已优先读取 `request.cf.clientAcceptEncoding`，增加原始值为空、identity、gzip;q=0、gzip 的边缘回归。依据：[Cloudflare HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/)。修复后 60 条 raw gzip/source 双hash、GET、HEAD、304、Range完整200、fetch解码与identity406全部通过。相关本地 routing 回归也通过；本轮执行一次无public的 build:preview，后续只更新Function，无前端重复构建。

浏览器使用 Codex in-app Browser 实测：剧情序章显示台词，下一段使进度11→12；单人实验室通用动作2→3，画面有角色渲染。阅读原文正常，双语按钮切换成功，但提示译文暂时无法载入。因此 **cloud browser acceptance仍为false**；不可把本地双语通过沿用成云端通过。口型资源的HTTP字节已经验证，云端口型动画的专项观察仍待完成。浏览器控制接口存在30–60秒超时，后续读取确认动作已执行；不把超时记作产品失败。

上传前 `rclone size` 为98,048对象 / 9,077,325,614 B；上传后完整路径/大小清单为98,108对象 / 9,077,547,776 B，精确增加60对象 / 222,162 B。所有60条远端大小与manifest相符；内容由云端HTTP双hash验证。

与旧schema2清单对账：旧键无缺失；`data/image_bundle_relation_catalog.json` 远端为7,258,441 B，旧清单为7,461,866 B；另有16个旧PNG键共392,558 B。此对账只验证旧对象路径/大小，不代表全库远端hash已重验。当前baseline的528条变化全部在gzip三域之外，必须独立完成版本对账，不能把gzip delta当当前完整数据发布。

审计清单使用 `rclone lsjson ... --recursive --files-only --fast-list --no-modtime --no-mimetype`，避免为每个对象额外读取时间/MIME。最初的remote-before.json因逐对象读取过慢而中止，是不完整文件，不可作为快照；remote-gzip-before.json枚举跨越了上传时刻，也不可当上传前原子快照。权威完成清单为 `.deploy/storage-compression/remote-after-canary.json`；汇总与差异为 `remote-canary-summary.json`、`remote-reconciliation.json`。

证据：同目录 `canary-http-local-receipt.json`保留本地结果，`canary-http-receipt.json`为云端成功结果，`canary-cloud-acceptance.json`明确记录尚未完整通过；两个部署日志保留首次失败和修复后环境。Pages配置与代码包位于E盘的 `pages-canary/`，不包含媒体库。下一步先补齐翻译部署闭包、528条非gzip变化对账和云端口型观察，再决定全量切换；语音仍按独立后续批次处理。
