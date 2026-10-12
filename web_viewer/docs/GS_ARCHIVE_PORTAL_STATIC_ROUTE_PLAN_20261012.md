# 门户静态化路线：路径 URL、head 外壳、性能基线与 SSG 决策门

日期：2026-10-12。作者：Claude Opus 5.5（与用户讨论后定稿）。
分支：`claude/portal-static-route-20261012`，起点 `15d52496`（`codex/portal-architecture-cleanup-20261004` 的 HEAD；比 `origin/master` 的 `612f7519` 多 6 个提交，包括 `0ab258af` Reader 导航上下文进 history.state，本计划依赖这些提交）。

本文写给执行实施的模型（可能是更便宜的模型），所以每一步都写到“改哪个文件、用什么命令、看到什么算通过”。执行前必读 `AGENTS.md` 与 [BUILD_ACCEPTANCE_POLICY.md](BUILD_ACCEPTANCE_POLICY.md)。

---

## 0. 背景与已定结论

外部做了两轮“是否迁 Astro”的审计，结论已收敛：

- **现在不迁 Astro。** 先把公开 URL 身份和导航上下文分开（对应 [10/11 架构交接](GS_ARCHIVE_ARCHITECTURE_AUDIT_HANDOFF_20261011.md) 的 P1「Route 分层」），再用实测数据决定渲染层。
- 仓库**没有**生产 SSR/SSG：`src/main.js` 是纯客户端 `createApp(App).mount('#app')`，`App.vue:704`、`:892`、`:909` 在 setup 顶层直接读 `window.location`，`:1003` 读 `localStorage`。已有的 `verify-reading-render.mjs` 等只证明**单个 SFC 可在 Node 里 `renderToString`**，不等于整个 App 能 hydrate。
- Astro 可以在服务端直接渲染现有 Vue SFC，不需要改写成 `.astro`；它的真正成本在 App 编排、路由、导航上下文、全局偏好，而不在组件。
- 决策顺序：**路径 URL → head 外壳（OG） → 性能基线 → 两页 SSG 实验 → 决策门**。

### 本计划明确不做

- 不改 Reader / Player / Home 的 URL 格式；不删任何旧 `?view=` 链接支持。
- 不在 Vue 里自造 island / 局部 hydration。
- 不对 826 张卡、Reader 正文全量生成静态页。
- 不在拿到基线数据前对框架下结论。
- 不自行部署（任何 `wrangler pages deploy` 都必须先得到用户明确授权，见 §2.7）。

### 与 Reader R1 的关系

10/11 交接把 Reader R1（`ReaderReturnPolicy` 纯函数抽取）排在 Route 之前。阶段 L1 只动 idol/unit 两个视图的公开地址编解码，不碰 Reader，可以在本分支先做；如果 Reader R1 在另一分支同时进行，两者都改 `src/core/archiveRoute.js` 时需要 rebase 合并，**不要把两者放进同一个提交**。

---

## 1. 阶段总览

| 阶段 | 内容 | 是否改 App 行为 | 产出 | 谁决定是否进入下一阶段 |
|---|---|---|---|---|
| **L1** | idol/unit 路径 URL：`/idols/<id>/`、`/units/<code>/` | 只改地址栏写入和地址解析 | 代码 + 回归脚本 + Browser 证据 | 执行者自检后交用户复核 |
| **L2** | 65 个实体的 head 外壳（title/description/OG/canonical） | 不改 | 生成脚本 + 校验脚本 | 执行者 |
| **L3** | 冷加载性能基线（本地生产包 + 正式站，桌面/模拟手机；真机由用户补） | 不改 | 测量脚本 + 基线报告 | 用户看报告 |
| **L4** | 两页 SSG 实验：A 外壳 / B 预渲染+替换挂载 / C 真 hydration | 实验分支，不合入 | 实验报告 | — |
| **L5** | 决策门 | — | 决策文档 | **用户** |

每个阶段单独提交、单独写记录（§7 模板），可以单独回退。

---

## 2. 工具手册（执行前通读）

### 2.1 Shell 与路径

- 环境是 Windows 11。可用 Git Bash（POSIX 语法，路径写 `/e/Web_build/...`）或 PowerShell 5.1（不支持 `&&`，用 `; if ($?) {}`）。同一个操作不要在两种 shell 之间拼接，尤其是删除。
- 仓库根是 `E:\Web_build\SideM_Archived`，前端工程在 `web_viewer/`。下文命令默认在 `web_viewer/` 下执行。
- 所有临时产物放 `web_viewer/.analysis/<主题>/`（已被仓库根 `.gitignore:41` 忽略；不要用仓库根的 `../.analysis`）。**禁止写 C 盘**（包括 `%TEMP%` 下的大文件；CDP 浏览器 profile 这种几 MB 的临时目录可以，用完删）。

### 2.2 开工前核对

```bash
git status -sb                      # 应为 claude/portal-static-route-20261012
git log --oneline -3
netstat -ano | grep -E ":(517[0-9]|518[0-9]|519[0-9]) .*LISTENING"   # 看哪些端口已被占用
```

PowerShell 等价：`Get-NetTCPConnection -State Listen | Where-Object LocalPort -in 5170..5199`。
**不要关闭不是自己启动的进程**（5173/5175 可能是用户或其他窗口的服务）。自己启动的服务用完要关。

已知的无关未跟踪文件（保持原样，不要 add、不要删）：`../.analysis/`、`../GS_Archive_source_for_repair.zip`、`.wrangler/`、`docs/GS_ARCHIVE_PREVIEW_WEBP_R2_HANDOFF_DEEPSEEK.md`、`docs/sidem_title_fx_css_rebuild_v9.html`、`public/data/terminal/`、`scripts/render-voice-listening-review.py`。

### 2.3 开发服务（带 read-model 数据）

偶像/Unit 详情走 read-model。dev 服务必须指向与 `readmodels/bootstrap.inline.json` 一致的候选包。当前绑定的 release 是 `ee86933b…`，候选目录：`E:\GS_readmodels_candidate_20261012_age`（含 `bootstrap.inline.json`、`pages/_catalog`）。

```bash
# Git Bash；端口选一个空闲的，5177 是惯例
SIDEM_READMODEL_CANDIDATE=E:/GS_readmodels_candidate_20261012_age \
  node node_modules/vite/bin/vite.js --configLoader native --host 127.0.0.1 --port 5177 --strictPort
```

- 用 Bash 工具的 `run_in_background` 启动，不要用 `&`。
- 启动后先 `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5177/` 确认 200。
- 若 `bootstrap.inline.json` 的 release 与候选不一致，dev 插件会用候选的 bootstrap；以 `node -e "console.log(require('./readmodels/bootstrap.inline.json').release)"` 和候选目录里同名文件对比确认。
- 不带 `SIDEM_READMODEL_CANDIDATE` 时，read-model 页面会按设计降级报错，不能用来验收 idol/unit 详情。

### 2.4 代码构建

```bash
npm run build:check
```

- 完整 Vite 生产编译，`copyPublicDir:false`，输出固定在 `.analysis/build-check`（每次覆盖）。还会先跑三个 generate 脚本（翻译 release、翻译审计、资源审计）。
- **禁止** `npm run build` / `npm run smoke` / 直接 `vite build`（会复制整个 public 语料库）。
- `build:check` 产物缺 public 资源，不能当可部署包；它可以用来做 head 外壳生成和 HTML 结构检查。

### 2.5 浏览器验收：三条路径

#### 路径 A：仓库现成的截图脚本 `scripts/capture-gallery.mjs`（首选，自动化）

- 原理：启动本机缓存的 **Playwright Chromium**（`%USERPROFILE%\AppData\Local\ms-playwright\chromium-1243\chrome-win64\chrome.exe`，已安装 1234 与 1243 两版），以 `--headless=new --remote-debugging-port=<随机>` 运行，通过**原生 CDP WebSocket** 控制。**不需要** npm 的 playwright 包（node_modules 里没有）。
- 用法：
  ```bash
  node scripts/capture-gallery.mjs <label> --base=http://127.0.0.1:5177 --only=app-idol,app-portal
  ```
  在 desktop 1280×900、tablet 768×1024、phone 390×844 三档各截一张，输出 `.analysis/gallery/<label>/*.png` 与 `report.json`；判定空白页、横向溢出、console error 即 FAIL。
- 它会预写 `localStorage['sidem:archive-user-preferences']` 为“回访读者”，避免 onboarding 弹窗遮挡。
- L1 需要在 `APP` 列表里**新增**路径式场景（见 §3.6），不要改已有场景。

#### 路径 B：自写 CDP 旅程脚本（L1 的点击/后退/刷新旅程、L3 的性能测量）

照抄 `capture-gallery.mjs:52-90` 的骨架：`findChrome()` → `spawn(chrome, ['--remote-debugging-port=PORT','--headless=new','--user-data-dir=<mkdtemp>', ...])` → 轮询 `http://127.0.0.1:PORT/json/list` → `new WebSocket(webSocketDebuggerUrl)` → `send(method, params)`。常用 CDP 方法：

| 目的 | CDP 方法 |
|---|---|
| 打开页面 | `Page.navigate { url }`，之后轮询 `Runtime.evaluate` 等内容出现 |
| 执行 JS / 读 DOM | `Runtime.evaluate { expression, returnByValue:true, awaitPromise:true }` |
| 点击 | `Runtime.evaluate` 里 `document.querySelector(sel).click()`；或 `Input.dispatchMouseEvent` |
| 后退/前进 | `Runtime.evaluate('history.back()')`，或 `Page.getNavigationHistory` + `Page.navigateToHistoryEntry` |
| 刷新 | `Page.reload { ignoreCache:true }` |
| 读地址栏 | `Runtime.evaluate('location.href')` |
| 读 history.state | `Runtime.evaluate('JSON.stringify(history.state)')` |
| 视口 | `Emulation.setDeviceMetricsOverride { width, height, deviceScaleFactor, mobile }` |
| 预置 localStorage | `Page.addScriptToEvaluateOnNewDocument { source }` |
| 截图 | `Page.captureScreenshot { format:'png' }` → base64 写文件 |
| 收 console error | 订阅 `Runtime.exceptionThrown`、`Runtime.consoleAPICalled(type=error)`（先 `Runtime.enable`） |
| 网络 | `Network.enable`；`Network.setCacheDisabled {cacheDisabled:true}`；`Network.emulateNetworkConditions`；事件 `Network.responseReceived` / `Network.loadingFinished`（`encodedDataLength`） |
| CPU 降速 | `Emulation.setCPUThrottlingRate { rate: 4 }` |
| 运行时指标 | `Performance.enable` + `Performance.getMetrics`（`ScriptDuration`、`TaskDuration`、`JSHeapUsedSize`） |

注意：
- 每个脚本自己创建并在 `finally` 里删除临时 profile（`mkdtempSync(os.tmpdir())` 只有几 MB，可以接受）；`chrome.kill()`。
- 任一 CDP 调用加超时（参照 gallery 的 60 s），防止 WebGL 场景卡死。
- 不要在 headless 里验证 Spine/Pixi 画面质量（swiftshader 软件渲染），只验证页面和路由。

#### 路径 C：有头浏览器，人工或半自动

- 本机有 Edge：`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`。可以有头启动并带 `--remote-debugging-port`，用路径 B 的脚本接管，也可以纯手工。
- 若会话里有 **Claude in Chrome** 或 **桌面 App 内置浏览器** 工具（工具名分别为 `mcp__claude-in-chrome__*`、`mcp__Claude_Browser__*`），先加载对应 skill（`anthropic-skills:chrome-browser` / `anthropic-skills:built-in-browser`）再用。它们适合“点一下看看”的人工旅程，结果要截图存证到 `.analysis/<主题>/`。
- 没有这些工具时，**不要假装做过 Browser 验收**；在记录里写明“只做了 headless CDP”。

#### 真机（只能由用户执行，执行者负责写清步骤）

- Android：手机开 USB 调试，电脑 Edge 打开 `edge://inspect`（或 Chrome `chrome://inspect`），可看真机 Network/Performance。
- iPhone：Safari Web Inspector 需要 Mac；没有 Mac 时用录屏 + 秒表记录“点开链接 → 看到偶像名字 → 看到头像图”的时间，每页 3 次取中位数。
- 真机步骤写进对应阶段记录的“待用户执行”一节，不要把模拟结果写成真机结果。

### 2.6 HTTP / 元数据检查

```bash
curl -s http://127.0.0.1:5179/idols/001tom/ | grep -E "<title>|og:|canonical|description"
curl -s -A "Twitterbot/1.0" https://<部署地址>/idols/001tom/ | grep og:    # 模拟爬虫 UA
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" <url>
```

外部预览（Discord/X/LINE 卡片）只能在**已部署**的地址上测，需要用户授权部署后由用户粘贴链接检查。

### 2.7 部署与正式站

- 正式站：<https://gs-archive-preview.pages.dev>（Pages 项目 `gs-archive-preview`，R2 `sidem-archive-preview`），见 [PRODUCTION_RELEASE_20261012.md](PRODUCTION_RELEASE_20261012.md)。
- 本计划内**不部署**。L2 若需要外部 OG 实测，执行者准备好说明（包内容、文件数增量、回滚方式），**交用户决定**是否部署到预览分支别名。
- 对正式站只做只读 GET（L3 测量），每页最多 5 次，不压测。

### 2.8 回归脚本速查

| 命令 | 用途 |
|---|---|
| `npm run verify:routes` | `scripts/verify-archive-routes.mjs`，路由规范化/编码 |
| `node scripts/verify-archive-startup-route.mjs` | 启动路由解析 |
| `node scripts/verify-archive-startup-preferences.mjs` | 启动偏好 |
| `npm run verify:archive-navigation-state` | 导航状态 + 视图恢复 + 关系导航（1792 组合） |
| `node scripts/verify-archive-route-preparation.mjs` | 路由准备 |
| `npm run verify:entry` | 入口构建审计 |
| `npm run verify:source-batch` | CI 同款全量 source 批次（125 项，较慢）；合并前跑一次 |

新增 verifier 必须登记到 `config/verifier-coverage.json`（`batch` 或带理由的 `localOnly`），否则 `verify-verifier-coverage.mjs` 会失败。

### 2.9 提交规范

- `git diff --check` → **按路径**显式 `git add <file>...`（不要 `git add -A`）→ commit。
- 提交信息沿用仓库风格：`feat(route): ...` / `test(route): ...` / `docs(plan): ...`，正文写“为什么”，末尾加 `Co-Authored-By:` 行（按当前会话给定的署名）。
- push 到 `origin claude/portal-static-route-20261012`；不默认开 PR、不部署。

---

## 3. L1：idol/unit 路径 URL

### 3.1 目标

| 路由 | 新的公开地址 | 旧地址（永久兼容） |
|---|---|---|
| `{ view:'idol_detail', idol:'001tom' }` | `/idols/001tom/` | `/?view=idol_detail&idol=001tom`（以及 `view=idols&category=idol&idol=…`） |
| `{ view:'unit_detail', unit:'01jup' }` | `/units/01jup/` | `/?view=unit_detail&unit=01jup` |

- 偶像 ID 形如 `\d{3}[a-z]{3}`（49 个，见 `readmodels/bootstrap.inline.json` 的 `idols[].id`）。Unit 码形如 `\d{2}[a-z]{3}`（16 个，`idols[].unitCode` 去重）。正则用 `^[0-9]{3}[a-z]{3}$` 与 `^[0-9]{2}[a-z]{3}$`。
- 末尾斜杠固定保留（与 L2 生成的 `/idols/<id>/index.html` 对齐）。
- 路由上除身份外的其他公开参数（若有）继续留在 query，例如 `/idols/001tom/?q=x`。

### 3.2 设计：内部表示不变，只换“对外地址”

**关键约束**：代码里大量把路由序列化成 query 字符串（`.search`）当内部值使用：

- `archiveRoute.js:207`、`:238`、`:254`、`:271`、`:410`：source frames、home_from；
- `archiveViewRestoration.js:8`：视图恢复的存储键；
- `ArchiveStoryCollection.vue:157`、`useHomeNavigation.js:64`：生成相对链接 / 来源。

如果让 `buildArchiveUrl` 直接输出路径形式，这些 `.search` 会丢掉 `view` 和身份，导致来源恢复、视图恢复全部错乱。所以：

1. **`buildArchiveUrl` 行为保持不变**，继续输出 query 形式，作为内部规范表示。
2. **新增 `buildPublicArchiveUrl(input, route)`**（同文件导出）：先调用 `buildArchiveUrl`，如果 `view` 在路径映射表里，就把 `view` 和身份参数从 query 移到 pathname；否则把 pathname 强制设为 `/`。
3. **`readArchiveRoute` 同时接受两种形式**：pathname 匹配 `/idols/<id>/` 或 `/units/<code>/` **且 query 里没有 `view`** 时，把 `view` 和身份注入后再走原有解析；**query 里有 `view` 时 query 优先**（兼容旧链接，也兼容在路径页上点击生成的相对 `?view=...` 链接，它会解析成 `/idols/001tom/?view=cards...`）。
4. 映射表集中写成一个常量，例如：
   ```js
   const PUBLIC_PATH_ROUTES = [
     { view: 'idol_detail', prefix: 'idols', param: 'idol', field: 'idol', pattern: /^[0-9]{3}[a-z]{3}$/ },
     { view: 'unit_detail', prefix: 'units', param: 'unit', field: 'unit', pattern: /^[0-9]{2}[a-z]{3}$/ },
   ]
   ```
   L1 只放这两项；以后扩到 song/event/card 只加行。
5. 路径不匹配格式（如 `/idols/xyz/`）时：不注入，按无 `view` 处理，走现有默认（进入 portal/home 的逻辑）；不要抛错。记录在回归用例里。

### 3.3 必改位置

| 位置 | 改动 |
|---|---|
| `src/core/archiveRoute.js` `readArchiveRoute`（约 :608） | 解析 `url.pathname`，按 §3.2-3 注入 |
| `src/core/archiveRoute.js` 新增 `buildPublicArchiveUrl` | 按 §3.2-2 |
| `src/core/archiveRoute.js` `writeArchiveRoute`（约 :806） | 把 `buildArchiveUrl(window.location.href, route)` 改为 `buildPublicArchiveUrl(...)`。**这是最大的坑**：现在它以当前地址为基准，只改 query、**沿用当前 pathname**；如果在 `/idols/001tom/` 上导航到卡片目录而不改，会写出 `/idols/001tom/?view=cards`。新函数必须显式设置 pathname。注意它后面会从 `url.searchParams` 里取导航上下文参数再删除，这段逻辑对路径形式同样适用，要确认没有把身份参数当上下文删掉 |
| `src/core/archiveStartup.js:11` `isBareArchiveEntry` | 现在只把 `/`、`/index.html` 当“裸入口”。`/idols/001tom/` 返回 false → 走 explicit 路由，这正是想要的。**不改**，但要加用例确认 |
| `src/components/archive/ArchiveBreadcrumb.vue:42` | 面包屑 `href`。改用 `buildPublicArchiveUrl`，让右键“复制链接”得到路径形式 |
| 其他生成 `<a href>` 指向 idol/unit 详情的地方 | 执行者用 `grep -rn "idol_detail\|unit_detail" src --include=*.vue --include=*.js` 逐一检查，凡是生成**对外可见的 href** 的改用 `buildPublicArchiveUrl`；凡是内部 `.search` 用途的**不要动** |

不改：`App.vue:704/892` 的 `URL_FLAGS`（调试开关，读 query，路径页上照样能带 `?playerTrace=1`）、`SpineStage.vue`、`StoryViewer.vue`、`BackgroundEffectManager.js` 的同类读取。

### 3.4 嵌套路径下资源能否加载

- `index.html` 引用 `/src/main.js`（dev）和 `/_app/...`（构建），均为绝对路径。
- 已用 `grep -rnE "[\"'\`](assets|data|_catalog|translations)/" src` 检查，未发现相对资源路径；但 Browser 验收时仍要在 `/idols/001tom/` 打开 Network，确认没有 `/idols/001tom/assets/...` 这类 404。
- Vite dev 默认 `appType:'spa'`，未知路径回退 `index.html`；需在 dev 上实测 `curl http://127.0.0.1:5177/idols/001tom/` 返回的是 index.html。
- 生产（Cloudflare Pages）：根目录没有 `404.html` 时，未匹配路径按 SPA 回退到 `/index.html`。执行者要检查打包产物里没有 `404.html`；L2 生成的外壳文件存在后则直接命中静态文件。
- `_routes.json` 当前 `include: ['/assets/*','/data/*']`，`/idols/*` 不会进 Functions，不需要改。

### 3.5 回归脚本

新建 `scripts/verify-archive-path-locator.mjs`（纯 Node，不起浏览器），登记到 `config/verifier-coverage.json` 的 `batch`，并在 `package.json` 的 `verify:routes` 后追加或新增 `verify:path-locator`。覆盖：

| # | 输入 | 期望 |
|---|---|---|
| U1 | `readArchiveRoute('http://x/idols/001tom/')` | `view:'idol_detail', idol:'001tom'` |
| U2 | `readArchiveRoute('http://x/units/01jup/')` | `view:'unit_detail', unit:'01jup'` |
| U3 | `/idols/001tom`（无尾斜杠） | 同 U1 |
| U4 | `/?view=idol_detail&idol=001tom` | 同 U1（旧链接） |
| U5 | `/idols/001tom/?view=cards&idol=002sht` | query 优先：`view:'cards', idol:'002sht'` |
| U6 | `/idols/xyz/`、`/idols/001tom/extra/`、`/units/1/` | 不注入，结果等于 `readArchiveRoute('http://x/')` |
| U7 | `buildPublicArchiveUrl('http://x/idols/001tom/', {view:'cards', idol:'001tom'})` | pathname 为 `/`，query 含 `view=cards` |
| U8 | `buildPublicArchiveUrl('http://x/?view=portal', {view:'idol_detail', idol:'001tom'})` | `/idols/001tom/`，query 不含 `view`、`idol`、`category` |
| U9 | 往返：对 `VALID_VIEWS` 中每个 view 构造最小合法路由，`readArchiveRoute(buildPublicArchiveUrl(r))` 与 `readArchiveRoute(buildArchiveUrl(r))` 规范化结果相同 | 全部相同 |
| U10 | `buildArchiveUrl(...)` 对 idol/unit 路由的 `.search` 与改动前完全一致 | 内部表示未变（保护 source frames 与恢复键） |
| U11 | `isBareArchiveEntry('http://x/idols/001tom/')` | `false` |
| U12 | `resolveArchiveStartup('http://x/idols/001tom/', {startupPage:'home'})` | `source:'explicit'`，不被 Home 偏好劫持 |

`readArchiveRoute` 在 Node 下 `window` 不存在时以 `http://localhost/` 为基准，可直接传完整 URL 测试；`history` 参数传 `{ history:false }`。

改完后全部重跑：`npm run verify:routes`、`node scripts/verify-archive-startup-route.mjs`、`node scripts/verify-archive-startup-preferences.mjs`、`npm run verify:archive-navigation-state`、`node scripts/verify-archive-route-preparation.mjs`、`npm run build:check`、`npm run verify:entry`。合并前再跑一次 `npm run verify:source-batch`。

### 3.6 Browser 验收（dev 服务，路径 A + B）

**截图（路径 A）**：在 `scripts/capture-gallery.mjs` 的 `APP` 数组追加两项（`readModel:true`）：

```js
{ id: 'app-idol-path', url: `${base}/idols/001tom/`, readModel: true },
{ id: 'app-unit-path', url: `${base}/units/01jup/`, readModel: true },
```

然后 `node scripts/capture-gallery.mjs l1-path --base=http://127.0.0.1:5177 --only=app-idol,app-idol-path,app-unit-path`，三档宽度全部 `ok`，且 `app-idol-path` 与 `app-idol` 截图内容一致（肉眼对比，或用 `.deploy/compare-captures.py` 一类现有工具）。

**旅程（路径 B）**：新建 `scripts/verify-portal-path-locator-browser.mjs`（登记为 `localOnly`，理由“需要 dev 服务与 read-model 候选”），逐条记录实际 `location.href`、`history.state`、console error、截图：

| # | 操作 | 期望 |
|---|---|---|
| P1 | 打开 `/?view=portal`，点任一偶像进入详情 | 地址栏变为 `/idols/<id>/`；页面显示该偶像；无 console error |
| P2 | P1 后按页内“返回” | 回 Portal，地址 `/?view=portal…`，搜索与范围保留 |
| P3 | P1 后 `history.back()` 再 `history.forward()` | 前进后回到 `/idols/<id>/`，内容正确 |
| P4 | 在 `/idols/<id>/` 刷新（`Page.reload`），再点页内返回 | 仍回 Portal（来源在 history.state 中保留） |
| P5 | 新 profile 直接打开 `/idols/001tom/` | 正常显示；页内返回落到契约兜底（与旧链接 `/?view=idol_detail&idol=001tom` 冷打开的行为一致，两者对比记录） |
| P6 | 在 `/idols/001tom/` 点“卡片”等关联入口 | 地址 pathname 变回 `/`，query 为对应 view；**不得**出现 `/idols/001tom/?view=…` |
| P7 | P6 后返回 | 回到 `/idols/001tom/` |
| P8 | Unit 目录 → `/units/01jup/` → 成员偶像 → 返回 → 返回 | 依次为 `/units/01jup/`、`/idols/<id>/`、`/units/01jup/`、Unit 目录 |
| P9 | 打开旧链接 `/?view=idol_detail&idol=001tom` | 页面正常；地址栏被规范化为 `/idols/001tom/`（`replaceState`，不新增历史项） |
| P10 | 打开 `/idols/xyz/` | 不白屏，落到默认入口；无未捕获异常 |
| P11 | Home 偏好 = home 的用户直接打开 `/idols/001tom/` | 进入偶像详情，不被 Home 劫持 |
| P12 | 在 `/idols/001tom/` 打开 Network 记录 | 没有 `/idols/001tom/` 前缀的资源请求，没有 404 |
| P13 | 390×844 与 1280×900 各跑一次 P1–P3 | 无横向溢出 |

另外复跑 [深链接验收清单](GS_ARCHIVE_DEEPLINK_BROWSER_ACCEPTANCE_CHECKLIST_20261012.md) 的 A1–A5（与 idol 相关），确认原有来源上下文行为不变。

### 3.7 L1 完成标准

- §3.5 全部通过，原有路由/导航回归全部通过，`build:check` 通过。
- §3.6 P1–P13 通过，截图与 `report.json` 存在 `.analysis/path-locator-l1/`（或 gallery 目录），记录里写明是 headless CDP 还是有头浏览器。
- 写 L1 记录（§7 模板）提交到 `docs/`。

---

## 4. L2：head 外壳（静态 OG / title / canonical）

### 4.1 目标

构建后给 49 个偶像、16 个 Unit 各生成一个 `index.html` 副本，放在 `idols/<id>/index.html`、`units/<code>/index.html`，**只替换 `<head>` 里的 title、description、OG、canonical**，`<body>` 和脚本完全不变。爬虫（X/Discord/LINE 不执行 JS）能看到实体元数据；浏览器照常启动 SPA，由 L1 的路径解析接管。

### 4.2 实现

新建 `scripts/generate-entity-head-shells.mjs`：

- 参数：`--dist=<目录>`（默认 `.analysis/build-check`）、`--origin=<站点根>`（默认 `https://gs-archive-preview.pages.dev`）、`--check`（只校验不写）。
- 数据源：`readmodels/bootstrap.inline.json` 的 `idols[]`（`id`、`name`、`kana`、`unitCode`、`unitName`）。Unit 列表由 `unitCode`/`unitName` 去重得到（实测 16 个）。不要额外读 read-model 分片。
- 每页 head 内容：
  ```html
  <title>天ヶ瀬 冬馬 · GS Archive</title>
  <meta name="description" content="天ヶ瀬 冬馬（あまがせ とうま，Jupiter）的卡牌、剧情、歌曲与相关档案。">
  <link rel="canonical" href="https://gs-archive-preview.pages.dev/idols/001tom/">
  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="GS Archive">
  <meta property="og:title" content="天ヶ瀬 冬馬 · GS Archive">
  <meta property="og:description" content="…同 description…">
  <meta property="og:url" content="https://gs-archive-preview.pages.dev/idols/001tom/">
  <meta property="og:image" content="https://gs-archive-preview.pages.dev/assets/idols/icons/image_chara_icon_001tom.png">
  <meta name="twitter:card" content="summary">
  ```
  Unit 页 `og:type` 用 `website`，description 列出成员名。文案写成常量，和 `index.html` 现有标题风格一致（`GS Archive · SideM GROWING STARS 资料馆`）。
- `og:image` 路径来自 `src/utils/AssetResolver.js:237` `getCharaIconUrl`（`${ASSET_BASE}/idols/icons/image_chara_icon_<id>.png`）。执行者必须对正式站 `curl -s -o /dev/null -w "%{http_code} %{content_type}"` 抽查 3 个确认 200 且为图片（R2 曾做 WebP 迁移，扩展名可能变化，以实测为准）。Unit 图片若没有现成单图，就用站点 logo，不要编造路径。
- 所有插入文本做 HTML 转义（`& < > " '`）。
- 替换方式：从 `<dist>/index.html` 读模板，删掉原 `<title>`，在 `</head>` 前插入上述片段。断言模板里恰好一个 `<title>`、一个 `</head>`。
- **不接入**现有发布打包脚本（`build-preview.mjs`、`readmodels/tools/assemble_pages.mjs`、`prepare-readmodel-preview.mjs`）。接入发布流程是单独的、需要用户确认的一步，在 L2 记录里写清应该在哪个脚本的哪一步之后调用。
- 可选 L2b：导航时在客户端更新 `document.title`（目前全站没有任何 `document.title` 写入，标题固定为 index.html 的值）。只为 idol/unit 做，放在 App 路由提交之后；单独提交。

### 4.3 校验

新建 `scripts/verify-entity-head-shells.mjs`（登记 `batch`，用临时目录造一份假 `index.html` 跑，不依赖 build 产物；另提供 `--dist` 模式校验真实产物）：

- 文件数 = 49 + 16；路径集合与 bootstrap 完全一致。
- 每个文件：恰好一个 `<title>`；`og:title/description/url/image`、`canonical` 各一个；`canonical` 与 `og:url` 等于 `origin + 路径`；`<body>` 部分与模板逐字节相同。
- 转义用例：名字含 `<`、`&`、`"` 时输出已转义。
- 文件数预算：读取 `readmodels/contracts/budgets.json` 的 `combinedPagesFiles`（18000），用上次正式包 10836 文件 + 65 计算余量，写进报告。

### 4.4 验收

1. `npm run build:check` → `node scripts/generate-entity-head-shells.mjs --dist=.analysis/build-check` → `node scripts/verify-entity-head-shells.mjs --dist=.analysis/build-check`。
2. 本地静态预览：`node node_modules/vite/bin/vite.js preview --configLoader native --outDir .analysis/build-check --host 127.0.0.1 --port 5179 --strictPort`，然后 `curl -s http://127.0.0.1:5179/idols/001tom/ | grep -E "<title>|og:|canonical"` 应输出该偶像的元数据；`curl -s http://127.0.0.1:5179/` 仍是原标题。此预览缺 public 资源，**只用于 head 检查**，页面内容不能在这里验收。
3. 外部卡片实测（Discord/X/LINE）：需要部署，交用户决定（§2.7）。部署后用 `curl -A "Twitterbot/1.0"` 和 `curl -A "Discordbot/2.0"` 复核，用户在各平台粘贴链接截图。

---

## 5. L3：性能基线

### 5.1 测什么

| 页面 | 地址 |
|---|---|
| Home | `/?view=home` |
| Portal | `/?view=portal` |
| 偶像详情 | `/idols/001tom/`（L1 前用 `/?view=idol_detail&idol=001tom`） |
| Unit 详情 | `/units/01jup/` |
| 卡片目录 | `/?view=cards&idol=001tom` |

对每页记录：TTFB、FCP、LCP（及 LCP 元素）、CLS、Long Tasks 总时长与个数、`ScriptDuration`、`TaskDuration`、`JSHeapUsedSize`、请求数、按类型（document/script/stylesheet/fetch/image/font）分的传输字节、入口 chunk 名和大小，以及最关键的**“App 首次出内容”时间**：页面主体里的实体名字（偶像名 / Unit 名）第一次出现在 DOM 的时刻。

### 5.2 测量脚本

新建 `scripts/measure-portal-cold-load.mjs`（`localOnly`，理由“需要浏览器与网络，结果非确定”）：

- 用法：`node scripts/measure-portal-cold-load.mjs <label> --base=<url> [--runs=5] [--profile=mobile|desktop]`。
- 每次运行：新建 profile（冷缓存）→ `Network.enable` + `Network.setCacheDisabled` → `Performance.enable`。
- mobile 档：`Emulation.setDeviceMetricsOverride {width:390,height:844,deviceScaleFactor:3,mobile:true}`；`Emulation.setCPUThrottlingRate {rate:4}`；`Network.emulateNetworkConditions {offline:false, latency:150, downloadThroughput:1.6*1024*1024/8, uploadThroughput:750*1024/8}`（Lighthouse 移动端预设）。desktop 档：1350×940，不降速。
- `Page.addScriptToEvaluateOnNewDocument` 注入观察器：`PerformanceObserver` 订阅 `paint`、`largest-contentful-paint`、`layout-shift`（排除 `hadRecentInput`）、`longtask`，结果存 `window.__gsPerf`；再用 `MutationObserver` 记录目标文本第一次出现的 `performance.now()`。预置“回访读者”偏好（同 gallery），避免 onboarding。
- 等到网络空闲 2 s 或 30 s 超时后读取 `window.__gsPerf` 与 `Performance.getMetrics`，网络字节由 `Network.loadingFinished.encodedDataLength` 按 `responseReceived.type` 汇总。
- 每页跑 N 次取**中位数**，输出 `.analysis/perf-baseline/<label>/report.json` 和一张 Markdown 表。

### 5.3 测哪些环境

1. **正式站** `https://gs-archive-preview.pages.dev`（只读 GET，每页 5 次）。这是 L1 之前的真实基线，**先测这个**。
2. **本地 dev**：只作参考，dev 不打包，数值不可与生产比较，报告里单独标注。
3. 真机：按 §2.5 写好步骤交给用户（iPhone 与 Android 各测偶像详情、Home 两页）。

L1/L2 合入并部署后，用同一脚本、同一参数再测一次，作为 A 组数据。

### 5.4 基线报告

`docs/GS_ARCHIVE_PORTAL_PERF_BASELINE_<日期>.md`：环境、参数、每页中位数表、主要观察（例如“HTML 到达后 X ms 才出现偶像名，其中 JS 执行占 Y ms”）、限制（模拟非真机、网络波动）。只写测到的，不推测。

---

## 6. L4：两页 SSG 实验 与 L5 决策门

### 6.1 先定语言策略（需要用户确认）

界面语言来自 `src/utils/LanguageStore.js` 保存在 localStorage 的 `ui_locale`（`zh-CN` 默认 / `ja-JP`），构建时无法知道。建议：**静态 HTML 按 `zh-CN` 渲染，`ja-JP` 用户由客户端切换**；不做 `/ja/` 路径前缀（文件数翻倍且需要额外的 URL 规则）。执行者在实验前把这个建议写进实验记录，等用户确认后再测 B/C。

### 6.2 实验分支

从本分支切 `claude/portal-ssg-experiment-20261012`，**不合入**。只做 `001tom` 和 `01jup` 两页。

| 组 | 做法 | 主要改动 |
|---|---|---|
| **A** | 只有 L2 head 外壳（就是 L1+L2 的结果） | 无 |
| **B** | 预渲染正文 + `createApp` 直接替换挂载 | 新脚本：用 `vite.createServer({ appType:'custom', server:{ middlewareMode:true } })` + `ssrLoadModule` 加载 `ArchiveIdolDetail.vue` / `ArchiveUnitDetail.vue`（做法参照 `scripts/verify-reading-render.mjs:15-25`），喂入候选包里对应的 read-model 数据，`renderToString(createSSRApp(Component, props))`，把结果连同页面外框（顶栏/导航的静态 HTML）写进外壳的 `<div id="app">`。`main.js` 不改，`createApp().mount('#app')` 会清空并替换它 |
| **C** | 真 hydration | `main.js` 改为 `createSSRApp`；`App.vue` 顶层的 `window.location` / `localStorage` 读取改为从启动参数注入或移到 `onMounted`；初始 read-model 数据序列化到 `window.__GS_INITIAL__` 供客户端复用；记录 dev 控制台 `Hydration ... mismatch` 警告的数量和来源 |

### 6.3 每组记录

- §5 的全部指标（同一脚本、同一参数，mobile 档）；
- B：替换挂载瞬间是否闪烁，CLS 增量，焦点/滚动是否异常（截图对比挂载前后）；
- C：改了多少文件、多少行，mismatch 数量，hydration 后 JS 执行时间与 A 的差值，有没有为了消除 mismatch 而不得不改的业务逻辑；
- 三组都要跑 §3.6 的 P1–P4，确认导航不受影响。

### 6.4 L5 决策门（阈值为建议，最终由用户定）

| 结果 | 决定 |
|---|---|
| A 或 B 在模拟移动档下偶像页 LCP ≤ 2.5 s、实体名出现 ≤ 2.0 s，且 B 的 CLS ≤ 0.1 | 停在 Vue；B 推广到 Song/Event，卡牌页另评估文件数 |
| C 可行且改动小（例如 ≤ 10 个文件，无业务逻辑改写，mismatch 可清零） | 正式做 Vue SSG（hydration） |
| C 需要大量手写局部 hydration，或 hydration 后 JS 执行仍是主要耗时 | 启动 Astro 原型：Idol/Unit 用 Astro 服务端渲染现有 Vue SFC，只给交互部分加 `client:*`，与 B/C 同指标 A/B |

决策文档写入 `docs/`，列出数据、选择和理由。

---

## 7. 每阶段记录模板

文件名 `docs/GS_ARCHIVE_PORTAL_STATIC_ROUTE_<阶段>_<日期>.md`：

```markdown
# <阶段> 记录
输入 HEAD：<sha>；分支：claude/portal-static-route-20261012
## 改动
- 文件与目的（每条一句）
## 命令与结果
- `<命令>`：通过 / 失败（失败贴关键输出）
## Browser 实际旅程
- 环境：dev 5177 + 候选 E:\GS_readmodels_candidate_20261012_age / headless CDP（Playwright Chromium 1243） / 有头 Edge / 真机
- P1…：实际 URL、结论、截图路径
## 产物
- 目录、是否含 public、大小
## 已知限制与待用户执行
- …
```

不要把 headless 结果写成真机结果，不要把 `build:check` 写成可部署包，失败项照实写。

---

## 8. 易错点清单（执行前对照）

1. `writeArchiveRoute` 沿用当前 pathname → 必须改用 `buildPublicArchiveUrl` 并显式设置 pathname（§3.3）。
2. 不要改 `buildArchiveUrl` 的输出；所有 `.search` 内部用途依赖它（§3.2）。
3. query 有 `view` 时 query 优先，否则路径页上的相对链接会失效（§3.2-3、U5）。
4. 旧链接打开后用 `replaceState` 规范化，不能新增历史项（P9）。
5. 新 verifier 要登记 `config/verifier-coverage.json`。
6. 不用 `npm run build`；不写 C 盘大文件；不关别人的端口；不部署。
7. 只 `git add` 本阶段文件；无关未跟踪文件保持原样（§2.2）。
8. OG 图片路径以正式站实测为准，不要编造。
9. 每阶段单独提交、单独记录；Reader R1 不混进来。
