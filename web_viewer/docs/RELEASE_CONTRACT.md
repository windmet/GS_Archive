# 发布契约

本文件只写稳定规则，不写某一天的快照。某次检查的结果、部署编号、线上现状写在带日期的记录里（例如 `RELEASE_PIPELINE_CHECKS_20261109.md`）。

## 1. 两个环境

Cloudflare Pages 项目 `gs-archive-preview` 同时承载两个环境，并共用 R2 桶 `sidem-archive-preview`（绑定名 `ARCHIVE_ASSETS`）。

| 环境 | 部署分支 | 访问地址 | 收录 |
|---|---|---|---|
| preview | `gs-architecture-device-test` | `https://preview.gs-archive.com` | 禁止（`X-Robots-Tag: noindex, nofollow`、`robots.txt` 为 `Disallow: /`） |
| production | `master` | 项目的 `*.pages.dev` 地址与自定义域 `https://gs-archive.com` | 允许（无 noindex，`robots.txt` 带 sitemap） |

两个环境读同一个桶，所以对桶的任何写入都同时影响两边（见第 7 节）。

项目接了 GitHub（`windmet/GS_Archive`），但 production 自动部署是关的（`production_deployments_enabled: false`）。每次 push 只会在部署列表里留下一条 `github:push` 的 `queued/idle` 记录，preview 分支的推送也一样，从不构建、也不上线；真正生效的只有 `wrangler pages deploy` 上传的部署（`ad_hoc`）。因此：合并到 master 不等于上线；判断线上是哪个部署，只看项目的 `canonical_deployment` 和线上回执，不看列表里最新的一条；不要打开 Git 自动构建，CI 环境里没有语料和读模型候选，构建出来的包是残缺的。

## 2. 四道门

每道门只证明它能证明的事，没有一道能替代另一道。

### 门 1：source gate（CI，`npm run gate:source`）

- 证明：源码在干净检出里能过全部 fixture-only verifier、构建体积预算、路由分类、读模型与翻译契约。
- 不证明：任何语料内容、任何已部署的东西、真实设备上的表现。compiled 语料被 gitignore，CI 看不到它。

### 门 2：打包门（`scripts/prepare-pages-package.mjs`）

- 证明：包由已提交的源码构建（`sourceDirty` 为假）；首屏 JS 不超过 `readmodels/contracts/startup-policy.json` 的限值（这是唯一的限值）；`verify-archive-build-audit` 通过（preview 用 `--progress`，production 用 `--release`，即所有 public 类路由的入口与数据已迁移）；读模型、岁时记、译文发布与清单一致；生产包的批准语句与 journeys 或例外齐备；包是可复现的（`generatedAt` 取源码提交时间，清单含 sha256，`package-report.json` 带 `manifestSha256`）。
- 不证明：包在线上能工作；R2 里有它引用的 data/compiled revision；用户看到的页面是对的。

### 门 3：部署冒烟（`scripts/verify-deployed-site.mjs`）

对一个已部署的 origin 做只读 HTTP 检查（网络全部走 curl，URL 带 `?t=` 绕边缘缓存）：

- 回执（`preview-receipt.json` / `production-receipt.json`）与环境匹配；给 `--package` 时与包内回执逐字相同；
- `X-Robots-Tag: noindex` 只出现在 preview；
- `index.html` 引用的入口 chunk 返回 200 且为 JavaScript；
- 随机的 `/_app/<随机>.js` 的实际行为（返回 200 HTML 记为 warning，不是 fail）；
- `/_catalog/bootstrap.json` 与回执 release 一致，bootstrap 里的各域索引能取到；
- 抽样 `/data/`、`/assets/` 键返回 200（证明 Functions + R2 绑定在位）；
- 实体页 canonical 等于回执的 `siteOrigin`，且该 origin 能连上（不能解析会给出 DNS 答复）；
- `/robots.txt` 是 `text/plain` 且内容符合环境；production 另查 `/sitemap.xml`；
- `--with-translations` 调起 `verify-deployed-translations.mjs`。

`--package <包目录> --local` 对本地包用 Pages 语义做离线一致性检查（不碰网络和 R2，R2 抽样与 origin 探测显示 SKIP）。输出区分 `fail` 与 `warn`，有 `fail` 时退出码为 1。

- 证明：线上这一份确实是刚才那个包，且环境身份（收录、canonical、robots）正确。
- 不证明：任何页面能渲染、播放或交互；抽样之外的 R2 键存在；未知的 SPA 回退问题（缺失的 `/_app/*.js`、`/robots.txt` 在 Pages 上会被回退成 200 `text/html`，只有 `/data/*`、`/assets/*` 由 Functions 正确返回 404）。

### 门 4：浏览器旅程（`config/release-journeys.json`）

- 内容：一组核心读者旅程 × 必需设备（桌面 Chrome/Edge、Android Chromium、iOS Safari）。旅程必须在**已部署的 preview** 上走，不用 dev server。
- 结果文件格式：`{ schema_version: 1, kind: "release-journeys", sourceDigest, reviewer, checkedAt, results: [{ journey, device, status: "pass", browser }] }`。回执只对一个冻结的 `sourceDigest` 有效；任何一行缺失或失败、digest 不一致，打包门都会拒绝。
- 证明：真人或真机在真实部署上走通了核心路径。
- 不证明：旅程之外的页面；之后的任何代码或数据变化。

## 3. 命令序列

均在 `web_viewer` 下，先提交源码（工作区必须干净）。

### preview

```bash
npm run build:check
git -c core.autocrlf=false -c core.eol=lf checkout -- config/resource-audit.json   # build:check 会改写它，不提交
node scripts/prepare-pages-package.mjs --target preview \
  --models <读模型目录> --data-revision <64 位> [--compiled-revision <64 位>] \
  --origin https://preview.gs-archive.com --out <新的、不存在的目录>
npx wrangler pages deploy dist --project-name gs-archive-preview --branch gs-architecture-device-test   # 在 <out> 下执行
node scripts/verify-deployed-site.mjs https://preview.gs-archive.com --package <out> --with-translations
```

`--out` 必须是不存在的新目录，且与 `web_viewer` 在同一个盘。打包脚本不部署、不上传 R2、不改 Pages 项目；它只在 `<out>/README.txt` 写出该用的部署命令。

### production

先在已部署的 preview 上完成门 4，得到 journeys 结果文件，然后：

```bash
npm run build:check
git -c core.autocrlf=false -c core.eol=lf checkout -- config/resource-audit.json
node scripts/prepare-pages-package.mjs --target production \
  --models <读模型目录> --data-revision <64 位> [--compiled-revision <64 位>] \
  --origin https://gs-archive.com \
  --approval "<站长的原话>" --approval-date YYYY-MM-DD \
  --journeys <results.json> \
  --out <新的、不存在的目录>
npx wrangler pages deploy dist --project-name gs-archive-preview --branch master   # 在 <out> 下执行
node scripts/verify-deployed-site.mjs https://gs-archive.com --package <out> --with-translations
```

production 的硬规则（由 `parsePackageArgs` 与 `productionGate` 强制，`verify-release-package-contract` 钉住）：

- 必须同时给 `--origin`、`--approval`、`--approval-date`；
- 必须**恰好**给 `--journeys` 或 `--exception` 之一；
- journeys 的 `sourceDigest` 必须等于本次构建的 digest；
- 所有 public 类路由必须 `publicRoutesReady`（入口已迁移、数据已迁移或声明为 feature-local）。internal、experimental、alias、boot-state 类路由不挡发布。

`--target preview` 给 production 专属参数会被拒绝。

## 4. 例外发布

站长可以口头授权在没有 journeys 回执的情况下发布。做法是把原话原样放进 `--approval`，加 `--exception` 而不给 `--journeys`。脚本把它写进 `production-receipt.json`：

- `purpose: "user-authorized-production-exception"`；
- `approval: { statement, date }`；
- `exception: { date, ownerStatement, scope }`，范围只限这一个冻结的候选包；批准同时免除 journeys。

例外仍然要过 `publicRoutesReady`，不能用它绕过路由门。例外不延续：下一个包要重新授权或补齐 journeys。每次例外发布还应在当天的带日期记录里写一行（谁、何时、什么 source digest、为什么）。

## 5. 回滚

Pages 对每个部署保存快照，包括该部署的环境变量（`env_vars` 里的 `ARCHIVE_DATA_REVISION`、`ARCHIVE_COMPILED_REVISION` 等）和 R2 绑定。只读核对见 `RELEASE_PIPELINE_CHECKS_20261109.md`。因此：

1. 在 Pages 控制台（Deployments → 目标 production 部署 → Rollback to this deployment）把 production 回到上一个已知良好的部署。回滚不重新构建；部署对象里保存了当时的环境变量，据此推断旧部署带着自己的变量生效（这一点尚未实操验证，见检查记录的“未决”）。
2. 回滚前确认目标部署引用的 data/compiled revision 与 `assets/` 键仍在 R2 里（第 7 节保证最近两个正式部署的 revision 不删）。
3. 回滚后跑 `node scripts/verify-deployed-site.mjs https://gs-archive.com`（没有包目录时不带 `--package`），确认回执、catalog、R2 抽样一致。
4. 不要用 `wrangler pages deploy` 重新上传旧包来“回滚”：那会生成新的部署编号，并读取当前的项目级配置。

限制：回滚只回滚 Pages 这一层。R2 里 `assets/` 键是不分版本的共享对象，替换过的键不会随回滚恢复。

## 6. 例行边界

- 打包、部署、R2 写入是三件独立的事。打包脚本只产出目录；部署需要人执行 `wrangler pages deploy`；R2 上传另走 `PREVIEW_DEPLOYMENT.md` 的导出/上传流程。
- 不直接跑 `vite build`（会把语料拷进 dist），代码检查只用 `npm run build:check`。
- 包目录永远是新建的、一次性的；不改已部署过的包目录。

## 7. R2 规则

两个环境共用一个桶，所以：

- **最近两个正式（production）部署引用的 data revision 与 compiled revision 不删。** 回滚的目标是上一个部署，它引用的 revision 必须还在。清理旧 revision 之前，先列出最近两个 production 部署的 `env_vars`（`ARCHIVE_DATA_REVISION`、`ARCHIVE_COMPILED_REVISION`）与回执，把它们加进保留集合。
- **`assets/` 键只增不替换。** `assets/` 不分版本；替换一个已存在的键会同时改到 preview 和 production（包括被回滚到的旧部署）。需要改内容就换一个新键，由新的读模型引用。
- 删除或覆盖 R2 对象永远是单独评审的操作，不属于打包或部署流程。
