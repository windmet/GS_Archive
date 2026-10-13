# 2026-10-13 Portal 图片减载

分支 `claude/portal-image-budget-20261013`，从 `claude/portal-static-route-20261012`（`12cd24db`）开出；不基于边缘缓存实验分支。起因见 [图片边缘缓存实验](GS_ARCHIVE_PREVIEW_IMAGE_EDGE_CACHE_20261013.md)：模拟手机下 Portal 首屏拉约 3.2 MB，其中卡片 bento 的 3 张 640×800 立绘约 1.6 MB，在手机上位于首屏以下却立即加载。

## 改动

- `src/components/archive/useNearViewport.js`（新增）：目标进入视口 200px 范围才变 true；没有 IntersectionObserver（SSR）或 `eagerMedia` 命中时一开始就是 true。
- `src/components/archive/PortalCardBento.vue`：5 个 `<img>` 与主图 `<source srcset>` 都经它绑定；`eagerMedia: '(min-width:761px)'`，即宽布局（bento 在首屏、主图可能是 LCP）照旧立即加载，只有手机布局（≤760px，与组件自身断点一致）延后。网格行高固定（224px / 142px），不产生布局偏移；`img:not([src])` 隐藏，避免 alt 文字闪现。
- `scripts/serve-archive-build.mjs`：新增 `--assets-from=<https 源>`，把 `/assets`、`/data` 只读转发到已部署站点，本地运行拿到与线上相同的 R2 字节（WebP、卡面、gzip data）。本地 `public/` 没有 `card-art`，没有这个选项时卡面全是 404，图片字节也是原始 PNG，测量不可比。
- `scripts/verify-portal-image-budget-browser.mjs`（新增，localOnly.external）：按**实际发出的请求**判定——手机滚动前 0 个 card-art 请求、bento 图片无 src；滚到附近后加载并渲染；桌面不滚动即加载；均无页面错误。

## 为什么不用原生 `loading="lazy"`

实测位置（手机 390×844）：bento 顶部 1184px，三张卡在 1184/1184/1334px，离首屏底只有 340–490px；Chrome 的原生 lazy 会提前 1250–2500px 开始加载，挡不住。同页时间线横幅本来就是 `lazy`，位于 2943px，也在未滚动时被下载了。桌面（1350×940）bento 在 717px，三张卡都在首屏内，主图是 1800×960 横版（约 1.8 MB），是 LCP 候选。

第一版对桌面也走观察器，桌面 LCP 变差（等第一次回调才发请求），于是加了 `eagerMedia`。

## 测量

本地 `serve-archive-build.mjs --assets-from=https://gs-archive-preview.pages.dev` + `measure-portal-cold-load.mjs --pages=portal --paths`，同一构建流程只换 `PortalCardBento.vue`：

| 组 | 档位 | FCP | 实体出现 | LCP | CLS | 传输 KiB |
|---|---|---:|---:|---:|---:|---:|
| 新（第 1 次） | 手机 ×5 | 2452 | 2804 | 6808 | 0.000 | 1712 |
| 基准 | 手机 ×5 | 2456 | 2787 | 9992 | 0.000 | 3301 |
| 新（第 2 次） | 手机 ×5 | 2452 | 2818 | 8260 | 0.000 | 1712 |
| 新（eagerMedia 版） | 手机 ×5 | 2456 | 2819 | 6604 | 0.000 | 1712 |
| 基准 / 基准复测 | 桌面 ×3 / ×5 | 1040 / 992 | 277 / 286 | 1716 / 2496 | 0.043 | 5306 |
| 新（eagerMedia 版）×3 / ×5 | 桌面 | 1028 / 1028 | 281 / 288 | 2008 / 2056 | 0.043 | 5306 |

- 手机：首屏传输 3,301 → 1,712 KiB（−48%），LCP 9.99 s → 6.6–8.3 s；FCP 与实体出现不变。
- 桌面：字节相同（宽布局行为未变），LCP 两组都在 1.7–2.5 s 区间内波动，无回归。
- 浏览器验收 `verify-portal-image-budget-browser.mjs http://127.0.0.1:5181`：7/7（手机滚动前图片 1,414 KiB、0 个卡面请求；滚动后 3 张共 1,589 KiB 加载并渲染）。截图 `.analysis/portal-image-budget-local/`。
- 回归：`verify:source-batch` 128/128，`verify-portal-loading-layout.mjs`，`verify-portal-path-locator-browser.mjs` 20/20，`capture-gallery.mjs image-budget --only=app-portal,app-idol-path,app-unit-path` 9/9。

全部为 headless Chromium，不是真机。

## 第二批：故事横幅与歌曲封面

线上瀑布图（`623e6c72` vs `98921ebf`，模拟手机，各一次）显示 **Portal 的 LCP 元素是首屏的组合 logo**（`image_unit_logo_04bei.png`，每次测量都是），不是卡面。去掉卡面后 logo 组结束时间 11.3 → 10.3 s；但歌曲封面与故事横幅（297 KB，手机 1685–2728px、桌面 1198px 以下）仍在 3.5 s 与 logo 同时开始下载、抢带宽。

- `DomainMediaPreview.vue` 新增 `deferred` 属性（默认关，其他页面行为不变）；Portal 的章节横幅、歌曲封面、故事图、活动图传 `deferred`，所有宽度都等接近视口再请求（桌面同样在首屏以下）。
- `verify-photo-catalog-navigation.mjs` 的沙箱依赖白名单加入 `./useNearViewport.js`（真实模块；Node 无 IntersectionObserver，即立即加载）。
- 浏览器验收加两项：手机滚动前 0 个 songs/stories 图片请求；逐个滚到后 7/7 渲染。共 9/9。

本地 A/B/A（手机 ×5，只换这两个文件）：

| 组 | FCP | 实体出现 | LCP | 传输 KiB |
|---|---:|---:|---:|---:|
| 第二批 | 2444 | 2802 | 5616 | 1413 |
| 仅卡面（上一提交） | 2520 | 2914 | 7464 | 1712 |
| 第二批复测 | 2432 | 2816 | 6296 | 1413 |

相对最初基准：本地手机首屏传输 3,301 → 1,413 KiB（−57%），LCP 约 10.0 s → 5.6–6.3 s。回归：`verify:source-batch` 128/128；gallery `image-budget-rows`（portal、event、event-list、collection-list、photo-list、card、song）21/21；路径旅程 20/20。

## 仍可做（未做）

- 首屏 LCP 的组合 logo：原图 402×117、显示 95×34，且是原生 `lazy`（低优先级）。首屏内的几张可去掉 `lazy` 或加 `fetchpriority="high"`；首屏外的 Unit 卡片（连同 49 个偶像头像中的大部分）可用同一 composable 延后。需按 LCP 与请求实测验收。
- 中期：卡面缩略位用 256–320px 有损变体，桌面主图 1800×960 横版（显示 709×378）同样过大。需要动 R2 素材。

## 线上验收（preview，`9c136d94`）

部署到测试分支（固定地址 <https://05fafaa1.gs-archive-preview.pages.dev>，`preview.gs-archive.com` 指向它）。`verify-portal-image-budget-browser.mjs https://preview.gs-archive.com`：第一次 8/9（单项一次性失败，未保留明细），复跑 9/9。

线上冷加载 A/B/A/B（手机 ×5，`05fafaa1` 新 vs `98921ebf` 旧，均为 `pages.dev` 固定地址、无 zone 缓存）：

| 组 | 传输 KiB | 各次 LCP（ms） |
|---|---:|---|
| 新 | 1390 | 2648(H2) 8780 2788(H2) 2876(H2) 8532 |
| 旧 | 3277 | 10068 10164 10700 10732 10636 |
| 新复测 | 1390 | 7904 8952 6592 8892 2548(H2) |
| 旧复测 | 3277 | 10464 13448 12640 10772 9832 |

- 传输 3,277 → 1,390 KiB（−58%），线上与本地一致。
- 只看 LCP 元素是组合 logo 的运行：新 6 次中位约 8.6 s（6.6–9.0），旧 10 次中位约 10.6 s（9.8–13.4），约快 2 s。
- 新版有 4/10 次 LCP 记为 `H2`（约 2.7 s），即浏览器没把 logo 计为 LCP；原因未查明，**不把这些算作提速**，报告中位数时应剔除或单列。FCP、实体出现两组相同（约 2.8–3.3 s / 3.2–3.7 s）。
