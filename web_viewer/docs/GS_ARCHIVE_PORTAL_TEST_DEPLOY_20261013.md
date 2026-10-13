# 2026-10-13 路径地址 + head 外壳测试站发布记录

用户明确授权：“请你部署测试站点”。目标沿用 `gs-archive-preview` 项目的 `gs-architecture-device-test` 测试分支；**未动正式站**，未改 `noindex`。

## 发布身份

- 发布源码：`1bcf3498c21489b413dc0c390bf545e242f8349c`（分支 `claude/portal-static-route-20261012`，已推送）。
- 固定测试地址：<https://cdba3915.gs-archive-preview.pages.dev>
- 测试别名：<https://gs-architecture-device-test.gs-archive-preview.pages.dev>
- 读取模型 release：`ee86933bac73734f681d7a21ff498c8b39a6e73543d88b2e0a21dac070b68bee`（候选 `E:\GS_readmodels_candidate_20261012_age`）。
- 沿用 R2 data revision：`854190ad908cc47df022dfb35181838fa4e0fd385a537e8fc8b611053b7b0bd4`；没有上传或修改 R2 素材。
- 覆盖前别名上的版本：`865e4970`（是本次源码的祖先，落后 42 个提交；其他分支没有更新的提交），覆盖不丢他人工作。

包含：L0 写入裁剪、L1 路径地址（`/idols/<id>/`、`/units/<code>/`）、L2 的 65 个 head 外壳与标签页标题、Portal 加载占位（CLS 修复），以及外壳的 `no-cache` 缓存头。

## 命令

```text
npm run build:check
node scripts/prepare-readmodel-preview.mjs --models E:/GS_readmodels_candidate_20261012_age --out .deploy/test-pages-20261013-1bcf3498 --data-revision 854190ad908cc47df022dfb35181838fa4e0fd385a537e8fc8b611053b7b0bd4
node scripts/verify-entity-head-shells.mjs --dist=.deploy/test-pages-20261013-1bcf3498/dist
# 在包目录：
npx --no-install wrangler pages deploy dist --project-name gs-archive-preview --branch gs-architecture-device-test --commit-hash 1bcf3498c21489b413dc0c390bf545e242f8349c --commit-dirty=false
```

包：10,900 个文件 / 159,823,752 字节（预算 18000）；上传 6,442 个新文件，4,456 个已存在。包保留在 `.deploy/test-pages-20261013-1bcf3498`。

## 线上验收

| 检查 | 结果 |
|---|---|
| 别名与固定地址的 `preview-receipt.json` | source `1bcf3498`、release `ee86933b…`，一致 |
| `/idols/001tom/`、`/units/05w00/`、`/units/01jup/`（`Twitterbot`/`Discordbot` UA） | 200；`<title>`、`og:title`、`og:url`、`og:image` 正确；`Cache-Control: no-cache` |
| `/idols/001tom`（无尾斜杠） | 308 到带斜杠地址 |
| `/` | 站点通用标题 |
| 外壳引用的入口 JS、`og:image` | 200 |
| `verify-portal-path-locator-browser.mjs <别名>` | **20/20 通过**（桌面 + 手机视口）。P12：890 个同源请求，无相对路径、无失败——本地包检查时唯一的失败（称号图片本地缺失）在线上不存在 |
| `measure-portal-cold-load.mjs deployed-test-20261013 --runs=3 --profile=mobile --pages=portal,idol,unit --paths` | 三页 CLS 均为 0.000（正式站 Portal 为 0.679）；内容空窗 0 |

冷加载时间本轮噪声大：TTFB 中位 1.1–3.5 s（新部署首访边缘缓存未热，且本机走代理），FCP/LCP 不能与 [性能基线](GS_ARCHIVE_PORTAL_PERF_BASELINE_20261013.md) 的正式站数字直接比较；只采信 CLS 与空窗结论。数据在 `.analysis/perf-baseline/deployed-test-20261013/`，旅程证据在 `.analysis/path-locator-deployed-20261013/`。

全部为 headless Chromium，**不是真机**。

## 已知边界

- `canonical` 与 `og:url` 固定指向正式域名 `gs-archive-preview.pages.dev`（生成脚本 `DEFAULT_ORIGIN`）。正式站尚未发布路径地址，所以在测试站分享时，遵循 `og:url` 的抓取方（如 Facebook）可能转去正式站的同名地址并拿到通用标题；X、Discord 读取被分享页面自身的标签。需要时可用 `--origin` 为测试站单独生成。
- 整站仍带 `X-Robots-Tag: noindex, nofollow`（不影响分享卡片，影响搜索收录），待用户决定。
- 148px 头像 / Unit 标志只够 `summary` 小卡。

## 待用户做

1. 在 X、Discord、LINE 粘贴 `https://gs-architecture-device-test.gs-archive-preview.pages.dev/idols/001tom/` 与 `/units/05w00/` 看卡片。
2. iPhone / Android 真机打开偶像详情页与首页（计划 §2.5）。
3. 是否发布正式站、是否放开 `noindex`。

---

## 第二轮：接入 `preview.gs-archive.com`（同日）

用户购买 `gs-archive.com`（Cloudflare 注册，2026-10-12），自行完成 DNS：`CNAME preview -> gs-architecture-device-test.gs-archive-preview.pages.dev`（Proxied），并在 Pages 项目添加了自定义域名（API 查询：`active`，验证与证书均 `active`）。用户授权“现在可以部署 preview”。

- `5a306081`：`prepare-readmodel-preview.mjs` 新增 `--origin`（外壳 canonical / og:url / og:image 的站点，回执记 `entityHeadShellOrigin`）；`verify-entity-head-shells.mjs --dist` 配套 `--origin=`。默认仍为 `DEFAULT_ORIGIN`。
- 包：`.deploy/test-pages-20261013-preview-5a306081`（10,900 文件），`--origin https://preview.gs-archive.com`。部署到同一测试分支，只上传 66 个变化文件（65 外壳 + 回执）。
- 固定地址：<https://98921ebf.gs-archive-preview.pages.dev>；别名与 <https://preview.gs-archive.com> 都指向它。**测试别名上的外壳现在也指向 preview 域名**，这是有意的：测试统一走自定义域名。

| 线上检查（`preview.gs-archive.com`） | 结果 |
|---|---|
| 回执 | source `5a306081`，`entityHeadShellOrigin` = `https://preview.gs-archive.com` |
| `/idols/001tom/`、`/units/05w00/` | 200，`no-cache`，`noindex, nofollow`；title、canonical、og:url、og:image 都在 preview 域名下 |
| `/idols/001tom` | 308 → 带斜杠 |
| `/`、`/idols/xyz/` | 200，站点通用标题 |
| og:image（头像、W 标志）、`/_catalog/bootstrap.json` | 200；头像实际以 `image/webp` 返回（R2 已是 WebP） |
| `verify-portal-path-locator-browser.mjs https://preview.gs-archive.com` | **20/20 通过**；P12：914 个同源请求无失败 |

网络边界：本机代理（`127.0.0.1:33317`）对这个新域名 TLS 握手失败（对 `pages.dev` 与 GitHub 时好时坏），检查改为直连；直连与代理都偶有单次超时，重试即 200，耗时约 1 s。这是本机网络，不是站点问题，但说明大陆网络到 Cloudflare 的质量需要真机再看。证据：`.analysis/path-locator-preview-domain-20261013/`。
