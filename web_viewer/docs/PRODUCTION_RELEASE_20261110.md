# 2026-11-10 发布记录（发布治理 W1–W3 之后的第一次）

这是第一次全程用 [RELEASE_CONTRACT.md](RELEASE_CONTRACT.md) 的新流水线（`prepare-pages-package.mjs` + `verify-deployed-site.mjs`）出包和验收。方案见 [加固方案](GS_ARCHIVE_RELEASE_HARDENING_PLAN_20261109.md)。

站长原话（11-09 夜）：**“我授权你可以合并，等都做完之后部署”**。正式包按契约第 4 节走例外发布：这句原话原样写进 `--approval`，加 `--exception`。原因是门 4 的必需设备里 android-edge（K60 未连接）和 ios-safari（iPad 网络不通）都测不了。

## 冻结版本

| 项目 | 值 |
| --- | --- |
| 源码 | master `7123e47af3fcf7071644f53ad37ccab0dae1e3cd`（含 #195–#200） |
| source digest | `5cfb33a26e9b7e7ccfdf4261727487e5e68af9d63c7f98bd61b523938ab39657`（preview 与 production 包相同） |
| read-model release | `a15e642d20f5003730751d6227d95b5248f908e473e598bcce5c48a10e0cc160`（候选 `rm-release-20261031`） |
| R2 data revision | `d049f4fa79d4740bdef1f6dd53b59e20a41d030697c443ba2a082c58d7d5adee`（与 11-04 相同） |
| compiled revision | `4afb61ee02808965c8149f335b2f246f3afe543423f65fd8b9afa5de2c02fbed`（与 11-04 相同） |
| 译文 release | `61c373ae`，1665 包 |
| 首屏 JS gzip | 197,441 / 216,064（11-04 是 213,334） |
| 实体 head shell | 1523，canonical 指向各自环境的 origin |

## preview

| 部署 | 源码 | 结果 |
| --- | --- | --- |
| `109adac3` | `53c3737c`（W1–W3） | `verify-deployed-site --with-translations` 全 PASS；在它上面跑了旅程和布局检查（见下） |
| `822161c6` | `7123e47a`（加 #200 修复） | 同上全 PASS，`r2-samples` 增至 6 个键；在线复核：手机标题省略号、启动守卫 `ready` 且无误报 error、关于页头像与 QQ 群码加载 |

一条预期 WARN：缺失的 `/_app/*.js` 被 SPA 回退成 200 HTML（契约门 3 已写明）。译文核对需要 `NODE_USE_ENV_PROXY=1`，否则 Node 的 https 不走本机代理会超时。

## production

<!-- PRODUCTION-DEPLOY: 部署后补 Pages 部署号、canonical 与冒烟结果 -->

状态：**包已出，未部署**。AI 执行 `wrangler pages deploy … --branch master` 被 Claude Code 的自动模式拦截（Production Deploy 类别），需要站长亲手执行：

```bash
cd E:/Web_build/GS_Archive_Domain_Work/release-20261110/web_viewer/.deploy/pkg-production-7123e47a
npx wrangler pages deploy dist --project-name gs-archive-preview --branch master --commit-hash 7123e47af3fcf7071644f53ad37ccab0dae1e3cd
```

之后在 `web_viewer` 下跑 `NODE_USE_ENV_PROXY=1 node scripts/verify-deployed-site.mjs https://gs-archive.com --package .deploy/pkg-production-7123e47a --with-translations`，并确认项目 `canonical_deployment` 已从 `924c79bb` 换成新部署。

包内容：`production-receipt.json` 为 `user-authorized-production-exception`，`approval`/`exception` 记录上面的原话与日期 2026-11-10；无 `X-Robots-Tag`；`robots.txt` 允许收录并指向 sitemap；`sitemap.xml` 1524 个 URL；本地 `--local` 检查通过。

包内 `wrangler.jsonc` 不再带 `ARCHIVE_WORK_BACKFILL_RELEASE`：`/_work-backfill` 在 `7056fe97` 已退役，作品剧情从 R2 快照读取（preview 自 11-06 起如此）。部署后 production 项目变量会少这一项，属预期。

## 门 4：核心旅程（在 preview `109adac3` 上）

| 设备 | 结果 |
| --- | --- |
| desktop-chrome（chrome-headless-shell 153，1366×900，CDP 自动） | 10/11 pass。`song-chart` 按当时写的规则判 fail：切难度会停播回 0:00。`loadChart()` 自 10-01 起就是这样设计的，#200 把规则改成描述这一行为 |
| android-webview-floor（夜神 WebView 92，可选） | 应用壳能挂载、无永久加载幕，但门户数据失败（`Object.hasOwn` 缺失）。启动守卫的“浏览器版本过旧”面板被门户盖住：`z-index:2e9` 不是合法 CSS 整数，算成 auto。#200 已修 |
| android-edge（K60） | 未测：设备未连接 |
| ios-safari | 未测：iPad 连不上测试站（校园网/热点问题，见设备通道记录） |

另：未知路径与不存在实体落到门户，显示“没有找到这个页面，已回到资料馆。”并带 noindex meta，离开后两者都消失；`?diag=1` 面板正常。

这一轮自动跑的是 headless 浏览器：音频只看 `currentTime` / `AudioContext` 是否前进，没有人耳试听，灯光效果也没有人工判断。

## 布局检查（`verify-layout-integrity-browser --base=https://preview.gs-archive.com`）

105 个用例：97 个 READY（几何候选待人工看），8 个 INCONCLUSIVE。8 个都出在 `live`、`chart`、`about` 三个探针：`/live/` 页面截图正常，是探针选择器过时（LIVE 改版后），不是站点问题；`about` 是等图片超时。

找出并已修：

- 活动页在 320/390 宽度下，顶栏长标题压到「中/日」切换下面。#200 修复，preview 在线复核标题止于 332，切换从 331 开始，带省略号。
- 关于页的 `owner-avatar.webp`、`qq-group-qr.png` 自 11-04 起在两个环境都是 404（文件只在本地，从没上过 R2）。11-10 用 rclone 作为新键补传（不覆盖任何已有对象），#200 让冒烟抽样从 `AssetResolver` 取全部品牌图。

记录但不改：桌面宽度下多处搜索框字号 13px（`small-input-risk`），手机宽度只有摄影工作台一处；iOS 输入框放大要真机确认。

## 回滚

发布前正式部署是 `924c79bb-43b3-4a1f-b4d7-0c33dd47d28c`（11-04，源码 `ff69dc7b`），发布前项目配置快照保存在本地 `GS_Archive_Domain_Work/release-20261110-production-before.json`（不入库）。两个部署引用同一组 data/compiled revision，回滚不涉及 R2。做法按契约第 5 节：Pages 控制台对 `924c79bb` 选 Rollback，然后跑 `verify-deployed-site.mjs https://gs-archive.com`。
