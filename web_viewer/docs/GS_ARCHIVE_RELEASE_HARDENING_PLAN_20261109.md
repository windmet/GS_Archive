# 正式站发布治理方案（2026-11-09）

外部审计（站长 11-09 转来，「Production Readiness Audit」）的逐条本地核实，以及据此排定的治理工作包。本文是计划，不是发布记录；现状仍以 [CURRENT_STATE.md](CURRENT_STATE.md) 为准（它停在 10-30，刷新列在 W3）。

- 核实基线：master `203eb830`（#192），LF worktree `GS_Archive_Domain_Work/release-hardening-20261109`，分支 `docs/20261109-release-hardening`。
- 线上探测：2026-11-09，从本机经代理 `curl`；DNS 用 Cloudflare DoH 查询。
- 与 Sonolus 互不干扰：引擎在独立仓库 `GS_Archive_Domain_Work/sonolus-engine`，交接分支 `docs/20261109-sonolus-engine-handoff` 不动。转换器要 import 主仓库的纯 JS 谱面模块，所以本方案的任何工作包都**不移动、不改名** `src/presentation/SongChart*.js`、`SongTrack*.js`，也不给它们加 polyfill。

## 1. 审计说法逐条核实

| # | 审计说法 | 本地核实 | 处理 |
|---|---|---|---|
| A1 | master 与 11-04 正式版「历史已分叉」 | master 领先 81 个提交；正式源码 `ff69dc7b` 独有的 1 个提交是 `chore(release): refresh resource audit`，每个 release 分支都会有这一个。没有分叉，只是正式站落后 | 下一次正式发布自然解决，不单列 |
| A2 | 启动预算三处来源冲突 | 属实。`startup-policy.json` 216,064；`budgets.json` 204,800；`assemble_pages.mjs:18` 写死 `200 * 1024`。本地 `build:check` 实测 215,723（单入口 chunk `index-*.js`），余量 341 B；11-04 也曾因 216,070 超限临时拆分过一次 | W2：统一读 `startup-policy.json`；见 §3 R5 |
| A3 | 没有闭合的正式打包流程 | 属实。10-12、11-04 两次正式发布都是先出预览结构的包、再手工改成正式包（11-04 用 `prepare-readmodel-preview.mjs` 出包，再用 scratchpad 里的 `make-production.mjs` 改 `_headers` 与 receipt）。`assemble_pages.mjs` 从来没有用于真实发布（它拒绝 `_headers`，也不带实体页、译文、季节正文） | W2 主体 |
| A4 | 路由 39/38/34/12/0/0 | 数字属实（entry 39、data 38、actions 34、player 12/12、parity 0、device 0）。`routes.json` 的 `reviewedSourceRevision` 还停在 `0f1ebbd4` | W2：重定义发布门，见 §3 R1 |
| A5 | 启动失败无兜底 | 属实：`main.js` 直接 `createApp(App).mount('#app')`，全仓没有 `window.onerror` / `unhandledrejection` / `app.config.errorHandler`。但 `readBootstrap()` 抛错不是运行时网络风险：bootstrap 内联在 HTML 里，打包时 `prepare-readmodel-preview.mjs` 已断言它与候选一致。真正的运行时缺口是入口 chunk 下不来/执行失败，以及首个路由挂住（见 N5） | W1 |
| A6 | 图片失败处理不统一 | 部分属实：53 个含 `<img>` 的组件里 23 个没有 `@error`。但全局 `installImageReveal()` 会标记失败的图片，alt 和组件占位照常显示，不会一直隐形 | 降为 P2，见 §3 R2 |
| A7 | 没有 404/5xx 页 | 属实，但**不能直接加 `404.html`**：Cloudflare Pages 在没有顶层 `404.html` 时才做 SPA 回退，`/office/<idol>/` 等「认不出的路径按裸入口启动」（#65）就靠它 | W3：应用内「未找到」，见 §3 R4 |
| A8 | `r2-resource.js` 没有统一错误协议 | 状态码其实已经分清：400/404/405/406/410/416/502/503。真正的缺口只有一个：`bucket.head()` / `bucket.get()` 抛异常时没人接，会变成 Cloudflare 1101 错误页；503 也没带 `Retry-After` | W1 小修；JSON 信封不做 |
| A9 | 9 处 ES2023 方法、无 polyfill | `findLast` 8 处 + `findLastIndex` 1 处属实，但全在小人舞台和谱面（按需加载），不在启动路径。启动路径上真正的下限是 `ReadModelClient.mjs:134` 的 `Object.hasOwn`（Chrome 93 / Safari 15.4）；CSS 用了 `:has()` 40 处、容器查询 52 处（GsInfo 的 `popover` 用 `showPopover?.()`，不支持时退回 fixed 定位，不算下限）。Vite 6 默认 target chrome87 只降语法、不补 API | W1 加能力检测；见 D1 |
| A10 | Vivo X300s 打不开 | ES2023 解释不了：X300s 上的当前版 Chrome 早已支持这些 API。「停在加载界面」至少对应三种不同故障（N5），需要分段证据 | W1 的启动守卫同时就是诊断工具 |
| A11 | `verify:design-tokens` 没进 CI | **不属实**。它在 `config/verifier-coverage.json` 的 `batch` 里，Source Gate 的 `npm run verify:source-batch` 每次都跑；本地输出「none added」通过（棘轮：存量 209 处字号、335 处颜色，只禁新增） | 无需处理 |
| A12 | `CURRENT_STATE.md` 停在 10-30 | 属实 | W3 |
| A13 | R2 容量数据是 10-09 的 | 属实。`resource-audit.json` 的 `storage.checkedAt` 是 10-09（7.62 GB）；WebP 转换之后桶约 6.1 GiB，需要重新实测 | W2：打包时刷新或标注日期 |
| A14 | 翻译摘要与正式记录不同 | 属实但属预期：正式站落后 81 个提交，11-07 译文复校在其后。真正的问题是 receipt 里**没有**翻译 release 字段（11-04 的值只写在文档表格里） | W2：receipt 补字段 |

## 2. 审计没有发现、本地实测发现的问题

**N1 正式域名根本没有解析（P0，需站长操作）。** DoH 查询 `gs-archive.com` A 记录：NOERROR、无 Answer、SOA 在 `annabel.ns.cloudflare.com`；`www` 是 NXDOMAIN；`curl https://gs-archive.com/` TLS 握手失败。也就是说 11-04 的「正式站」只能从 `gs-archive-preview.pages.dev` 访问，而这个**允许收录**的部署里 1,523 个实体页的 `canonical` / `og:url` 全部指向打不开的 `https://gs-archive.com/...`（已抓 `/cards/` 确认）。

**N2 Pages 的 SPA 回退把缺失的代码和爬虫文件都回成 200 HTML。** 实测正式站：`/_app/does-not-exist.js`、`/robots.txt`、`/sitemap.xml` 都是 `200 text/html`（`/data/*`、`/assets/*` 走 Functions，正确 404）。后果：
- 部署后仍开着的旧标签页懒加载旧哈希 chunk，拿到 HTML，模块 MIME 报错。资料页有 `errorComponent: ArchivePageLoadError` 兜底；但 `App.vue:704–715` 的 StoryViewer、SpineViewer、ChibiStageViewer、ArchiveImmersiveHome、ArchiveOnboarding 用的是裸 `defineAsyncComponent`，失败就是空白。全仓也没有处理 `vite:preloadError`。
- 允许收录的站点没有 `robots.txt`，爬虫拿到的是首页 HTML。

**N3 preview 与 production 共用一个 Pages 项目和一个 R2 桶**（`gs-archive-preview` / `sidem-archive-preview`）。`data/`、`compiled/` 按 revision 分键，互不影响；`assets/` 键不分版本，而且边缘缓存 1 天（`r2-resource.js` 的 `Cloudflare-CDN-Cache-Control`）。所以「为测试站重传或替换一张图」会直接改到正式站。

**N4 回滚语义没有实测过。** 11-04 记录写的是「回滚部署，同时手动把 Production 环境变量改回」。Pages 部署对象是否自带环境变量快照，决定了这一步要不要做；可以通过 API 读取部署详情来确认，不需要真的回滚。

**N5 Vue 的 `__boot__` 幕布和 HTML 静态壳是同一个画面**（11-03 加载统一的设计）。所以「停在加载界面」可能是：入口脚本没下载完；入口脚本执行出错；或者应用已挂载、首个路由挂住。用户分不出来，审计也分不出来。

**N6 open PR #194 也改 `index.html`。** W1 的启动守卫要改同一个文件，W1 要在 #194 合并后从 master 开分支。

## 3. 降级或不采纳的建议

| # | 审计建议 | 处理 | 理由 |
|---|---|---|---|
| R1 | 39 个路由逐一达到视觉 parity + 真机验收才能发布 | 不采纳 | 这个门 10-12、11-04 两次都靠例外授权绕过；一个每次都被绕过的门既保护不了什么，也让「例外」变成常规。改为发布级核心旅程（W2-3），parity/device 继续作为进度记录，不作为发布前置 |
| R2 | 七态资源协议（idle…exhausted） | 不采纳 | 只在已有的 `ReadModelClient` 和 `loadImageTexture` 里落实「404 不重试、5xx/超时有限退避」，不新建协议层 |
| R3 | 统一 JSON 错误信封 + requestId | 不采纳 | 保留状态码，补 try/catch 和 `Retry-After`；`cf-ray` 已经是请求 ID |
| R4 | 502/503 自定义错误页（Custom Error Rules） | 不作为前置 | Functions 只服务 `/assets/*`、`/data/*`（`_routes.json`），HTML 和 JS 都是静态文件，Functions 出错时页面本身照常启动，数据错误由应用内处理。404 走应用内「未找到」状态，不加会关掉 SPA 回退的 `404.html` |
| R5 | 首屏 JS 压回 200 KiB，列为 P0 | 降为 P1 | 先统一预算来源（W2），再在 W3 把非首屏组件改成异步，目标留出 ≥10 KiB 余量。11-04 正式站就是 213 KB 上线的；它是维护余量问题，不是用户可感知的发布阻断 |
| R6 | 独立诊断页 + 启动 watchdog 两套 | 合并为一个 | 启动守卫加 `?diag=1` 直接显示诊断面板，少一个要维护和部署的文件 |
| R7 | 每张图片都要重试按钮 | 降为 P2 | 只给核心旅程的封面统一占位；`imageReveal` 已经保证失败图片不会隐形 |
| R8 | 新建 `PRODUCTION_READINESS.md` 作为唯一现状 | 改为 `RELEASE_CONTRACT.md` | `CURRENT_STATE.md` 已经是唯一现状页，再开一个会出现两个「唯一」。新文件只写稳定规则：每道门证明什么、发布步骤，不写快照 |

## 4. 工作包

每个工作包从最新 master 开自己的分支、单独 PR、单独验收，不混改。分支前缀按 [GIT_WORKFLOW.md](GIT_WORKFLOW.md)：代码改动用 `portal/`，`release/` 只放部署记录。

### 站长操作（随时可做，不依赖代码）

- **O1 DNS**：在 Cloudflare 的 `gs-archive.com` zone 加根记录 CNAME → `gs-archive-preview.pages.dev`（根域 CNAME 由 Cloudflare 自动展平，开代理），然后在 Pages 项目 → Custom domains 确认状态变成 active。wrangler 的 OAuth 看不到这个 zone，AI 做不了这一步。
- **O2** 验收并合并 #193、#194（W1 要等 #194）。
- **O3 Vivo 信息**：当时打开的是哪个网址（pages.dev / preview.gs-archive.com）、浏览器版本、Wi-Fi 还是蜂窝网络。W1 上测试站后，再用同一台手机打开 `?diag=1` 截图。

### W1 运行时兜底（P0，`portal/<日期>-boot-guard`，#194 合并后开）

1. **启动守卫**：`index.html` 里加一段内联经典脚本（ES5、无依赖、gzip 后 < 2 KB，放在模块脚本之前）。
   - 记录阶段：`html` → `entry`（入口模块开始执行）→ `mounted` → `ready`（首个路由完成）。
   - 在模块执行前就挂 `error` / `unhandledrejection`，并给入口 `<script>` 和 modulepreload 加 `onerror`。
   - 12 秒未到 `mounted`、或 30 秒未到 `ready`，就把静态壳换成面板：卡在哪个阶段、哪些入口资源还没出现在 `performance.getEntriesByType('resource')` 里、错误名与信息、UA、能力检测结果；按钮：重新加载、绕缓存重载、复制诊断信息。
   - `?diag=1` 立即显示面板。
   - 面板不依赖 Vue、Pixi、ReadModel；文案随 HTML 静态生成。
2. **信号接线（复用已有节点，不新造状态）**：`main.js` 包住 `mount()` 并设置 `app.config.errorHandler`，成功后标记 `mounted`；`App.vue` 现有的 `onMounted` 首路由 `restoreRoute()` 成功/降级分支里标记 `ready`。
3. **能力检测**：`Object.hasOwn`、`Array.prototype.at`、`structuredClone`、`CSS.supports('selector(:has(*))')`、容器查询。缺失时直接显示「浏览器版本过旧」和最低版本说明，不再无限加载。下限见 D1。
4. **旧 chunk**：处理 `vite:preloadError` 和动态 import 失败，用 sessionStorage 防循环，自动重载一次；N2 列的 5 个异步组件改用与资料页相同的 `errorComponent` 写法（复用 `ArchivePageLoadError`）。
5. **`r2-resource.js`**：`head` / `get` 包 try/catch，失败返回 `503`、`Retry-After: 5`、`Cache-Control: no-store`。

验收：
- 新 verifier 要做变异测试：把守卫改回旧写法后必须 FAIL。
- 浏览器探针：CDP `Network.setBlockedURLs` 挡入口 chunk → 面板显示 `entry` 阶段与被挡的 URL；注入模块异常 → 面板显示错误；延迟首个路由数据 → 面板显示 `mounted` 但未 `ready`。
- 夜神 WebView 92（不注入 polyfill）→ 显示「浏览器版本过旧」，或者能正常进入。
- 启动守卫是 HTML 内联，不计入 `initialJsGzipEstimate`；体积单独记在 `startup-policy.json`。
- 部署测试站后，用 K60 Edge（CDP）和 Vivo 复测。

### W2 正式发布流水线（P0，`portal/<日期>-release-pipeline`，可与 W1 并行）

1. **一个打包脚本两种目标**：`prepare-readmodel-preview.mjs` 泛化为 `--target preview|production`，把 `make-production.mjs` 的逻辑收进仓库。
   - production 必须带 `--origin`（等于 siteOrigin），并要求站长授权原话与日期作为参数，写进 `production-receipt.json`。
   - 去掉 noindex；生成 `robots.txt`（以及可选的 `sitemap.xml`）。
   - receipt 补上翻译 release 摘要和包清单的 sha256。
   - O1 完成前不用 `--origin https://gs-archive.com` 出正式包，否则 canonical 继续指向死域名。
2. **预算单一来源**：打包和 CI 都读 `startup-policy.json`；删掉 `budgets.json` 的 `initialJsGzipEstimate`。`assemble_pages.mjs` 及其测试退役：它的单文件 25 MiB、18,000 文件、bootstrap 一致性检查，预览脚本里都已经有。
3. **重定义发布门**：
   - `routes.json` 每个视图加 `class`：public / internal / experimental / alias / boot-state。
   - 发布要求：所有 public 视图 entry+data 已迁移，加上一份针对冻结 `sourceDigest` 的 `release-journeys` 回执（W3 的核心旅程，每台设备 pass/fail）。
   - 回执缺失时，只有带 `--exception "<站长原话>"` 才能出正式包。例外从手改文件变成显式参数，并写进 receipt。
   - `allPublicRoutesMigrated` / `deviceReviewAccepted` 保留为进度字段，不再作为前置。
4. **部署冒烟** `verify-deployed-site.mjs <origin> --package <dir>`，检查：
   - receipt 与包一致；noindex 头只在 preview 出现；
   - `index.html` 引用的入口 chunk 返回 200 且 MIME 是 JS；`_catalog/bootstrap.json` 可读；
   - 从读模型抽样若干 `/data/`、`/assets/` 键；
   - 实体页 canonical 等于 siteOrigin；`robots.txt` 是 `text/plain`；
   - 最后串上现有的 `verify-deployed-translations.mjs`。
   用 curl 访问（node https 不走代理），URL 加 `?t=` 绕缓存。
5. **回滚**：用 API 确认 N4；把回滚命令写进 `RELEASE_CONTRACT.md`。规则：最近两个正式部署引用的 R2 data/compiled revision 不删；`assets/` 键只增不替换，替换就算正式站变更（N3）。

验收：同一输入打包两次，清单逐字节相同；preview 部署后冒烟全绿；正式部署仍须站长明确授权。

### W3 最终验收与清理（P1/P2，W1 合并后开，不碰发布脚本）

1. **核心旅程（约 10 条）**：
   - 冷启动首页 → 偶像 → 卡片详情；深链接刷新 `/idols/<id>/`、`/cards/<id>/`；返回/前进；
   - 剧情阅读器；剧情播放器（语音）；歌曲试听；谱面；2D 舞台；摄影工坊；搜索与筛选。
   - 设备：桌面 Chrome、K60 Edge（CDP）、iPad Safari（直接测测试站，绕开校园网问题）、夜神 WebView 92（只验下限提示）。
2. **响应式复验**：现有 `collect-responsive-stress-browser.mjs`、`verify-layout-integrity-browser.mjs` 都支持 `--base=`，直接指向测试站，宽度 320/360/390/430/768/1024/1440；复核 RR-01…03。iOS 输入框缩放用运行时探针（读输入框的 computed font-size 是否小于 16px），不靠 grep。
3. **404**：未知路径和不存在的实体显示应用内「未找到」（带返回资料馆、搜索入口），同时写入 `<meta name="robots" content="noindex">`；不加静态 `404.html`。
4. **Legacy**：
   - `ArchiveDataRepository.js` 只剩 6 个 verifier 和 2 个 readmodel 工具在引用，可与这些 verifier 一起退役。
   - `RETIRED_DIRECTORY_VIEWS`、`experiments → live` 保留，用于旧书签兼容，写明归属。
   - 舞台与小人的 feature-local 时间轴记录为数据边界，不按「legacy」删除。
5. **首屏余量（R5）**：把入口 chunk 里非首屏的静态 import 改成异步，目标 ≤ 206,000 B。
6. **封面占位（R7）**：核心旅程上的封面统一占位。
7. **文档**：刷新 `CURRENT_STATE.md`；10 月审计文档加「历史快照」头注；`PREVIEW_DEPLOYMENT.md` 和 `GS_ARCHIVE_RELEASE_CHECKLIST_20261007.md` 中被 `RELEASE_CONTRACT.md` 取代的段落标注出处。

## 5. 顺序

1. O1（DNS）随时可做。
2. #193/#194 验收合并 → 开 W1；W2 同时开。
3. W1 上测试站 → Vivo / K60 / iPad 用诊断面板复测，确认真实故障点。
4. W2 合并 → 从冻结的 master 出预览包 → 冒烟 → 核心旅程回执 → 站长授权 → 脚本出正式包并部署 → 冒烟 → 写 `release/<日期>` 记录。
5. W3 与 4 并行，只要不碰打包脚本。

## 6. 待站长拍板（附默认值，不拍板就按默认值推进）

- **D1 浏览器下限**：默认 Chrome/Edge 105+、Safari 16+（2022 年），不加 polyfill；更旧的浏览器看到明确提示。备选：补 JS API 到 Chrome 87，但 `:has()` / 容器查询补不了，布局照样会坏，所以不推荐。
- **D2 例外发布**：默认保留站长的例外权，但做成脚本参数并写进 receipt；备选：完全取消例外，严格等核心旅程回执。
- **D3 启动预算**：默认先统一到 216,064，W3 再压到 ≤ 206,000；不作为发布阻断。
- **D4 404**：默认应用内「未找到」+ noindex；备选：静态 `404.html` 加逐段显式路由，维护成本高，不推荐。
