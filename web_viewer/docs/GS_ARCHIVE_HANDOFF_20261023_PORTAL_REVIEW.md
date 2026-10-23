# 交接：门户/导航外部审阅的吸收（2026-10-23）

本文给接手的新会话用。外部审阅（v4→v5→v6 三版）已经逐条和代码核对、取舍完毕，**不要重新评估**，按下面的批次顺序直接做。每批一条新的 `portal/<日期>-<主题>` 分支，从最新 `origin/master` 切；做完一批开一个 PR。规则见 [GIT_WORKFLOW.md](GIT_WORKFLOW.md)、[../AGENTS.md](../AGENTS.md)。

## 0. 开工前必读（工作区规则摘要）

- 先读 [CURRENT_STATE.md](CURRENT_STATE.md)。本文写于 master = `8e748036`（#85 Portal scope 预载、#86 侧栏都已合入）。
- **分支**：`portal/<日期>-<主题>`，从最新 `origin/master` 开。不在 master 上直接开发，不 rebase、不 force push；PR 只用 merge commit 合并，**合并由用户手动操作**。
- **worktree**：放在 `E:/Web_build/GS_Archive_Domain_Work/<名字>`，用 LF 检出（两个 `-c` 都要带）：
  ```sh
  cd /e/Web_build/SideM_Archived && git fetch origin
  git -c core.autocrlf=false -c core.eol=lf worktree add -b portal/<日期>-<主题> E:/Web_build/GS_Archive_Domain_Work/<名字> origin/master
  powershell -NoProfile -Command "New-Item -ItemType Junction -Path 'E:\Web_build\GS_Archive_Domain_Work\<名字>\web_viewer\node_modules' -Target 'E:\Web_build\SideM_Archived\web_viewer\node_modules'"
  ```
  语料不拷、也不联接：dev 服务找不到的 `/assets`、`/data` 会自动从主 checkout 读（PR #63）。
- **不要在主 checkout `E:/Web_build/SideM_Archived` 里改东西**：它在 `stage/20261022-particle-gaps` 分支上，有别的会话的未提交改动，而且和其他会话共用暂存区。`git add` 只在自己 commit 的那条命令里做，提交前先跑 `git diff --cached --stat` 确认暂存区里只有自己的文件。
- **提交**：`git -c core.autocrlf=false -c core.eol=lf commit ...`。提交信息末尾加：
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  PR 描述末尾加：`🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- **代码检查**：只用 `npm run build:check`。**禁止** `npm run build` 或直接 `vite build`，会把约 8 GB 语料拷进 dist。
- **完整门禁**：在 LF worktree 的 `web_viewer` 里跑 `npm run gate:source`（约 15 分钟，适合放后台），目标 116/116。跑完它会改写 `config/resource-audit.json`，**不要提交**，用 `git -c core.autocrlf=false -c core.eol=lf checkout -- web_viewer/config/resource-audit.json` 还原。
- **dev 服务**：`npx vite --configLoader native --port <N> --strictPort`（在 worktree 的 `web_viewer` 里）。后台任务最长 2 小时就会被关掉，截图时临时起、拍完就关。已占用的端口：5177 / 5179 / 5191 / 5213；PR #86 用的是 5195。
- **浏览器验收**：本机没有 playwright 包，用缓存的 Chromium（`~/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe`），通过 Node 内置 WebSocket 走 CDP 驱动。截图脚本可以复用 `C:/Users/windm/AppData/Local/Temp/claude/E--Web-build-SideM-Archived/c7b50210-3556-4649-9fc8-8f5b5dc776d3/scratchpad/shots.mjs`，建议先拷到自己的 scratchpad。用法：
  ```sh
  MSYS2_ARG_CONV_EXCL='*' SHOT_PREF_KEY='sidem:archive-user-preferences' \
  SHOT_PREFS='{"version":3,"preferredIdol":"003hok","startupPage":"portal","onboardingComplete":true}' SHOT_WAIT=6000 \
  node shots.mjs <输出目录> http://127.0.0.1:<端口> "名字|宽|高|路径|@measure.js"
  ```
  `MSYS2_ARG_CONV_EXCL` 必须设，否则 Git Bash 会把 `@xxx.js` 改写成 Windows 路径。偏好的 key 是 `sidem:archive-user-preferences`，内容要带 `version:3`。
- **旅程测试**：`node scripts/verify-portal-path-locator-browser.mjs http://127.0.0.1:<端口> <输出目录>`。**P37（Reader→播放器）在本机未改动的 master 代码上也失败**（本地没有 compiled 语料给播放器），是环境基线，与改动无关；其余步骤应全部通过。
- **改读模型或 R2 之前先问用户**：上传 R2、绑定 read-model、部署测试站/正式站都需要授权，而且走 `release/` 分支。

## 1. 已完成：批次 A 侧栏（PR #86，2026-10-23 已合并，合并提交 `8e748036`）

- PR https://github.com/windmet/GS_Archive/pull/86 。原分支 `portal/20261023-sidebar-split-rows` 合并后被自动删除；之后一次误推送又在远端把它建了回来（只多了一个交接文档提交，已移到 `portal/20261023-review-handoff`），**这个远端分支可以删**。worktree `E:/Web_build/GS_Archive_Domain_Work/sidebar-split-20261023` 现在在 `portal/20261023-review-handoff` 上；本文合并后这个 worktree 可以移除（`git worktree remove`，先解除 node_modules 联接）。
- 两个提交：
  - `a7eaad48`：第一版，一行放两个链接（如「剧情 · 通信」）。v6 审阅指出右列没有图标、也没有按钮边界，看起来不平衡，所以改了。
  - `73bafe5b`：最终版。8 个核心栏目改成单列，每项有自己的图标（与手机抽屉同一套 `archiveNavigationIcons`），组与组之间靠间距区分，组名保留为 `aria-label`。图鉴改成可折叠行（`aria-expanded`）：点开不跳转页面，当前页属于图鉴时自动展开；展开后 6 项放在两列填色格里。窗口高度 ≤880px 时行高改为 36px。64px 图标栏（横屏手机）不变。
- 只改了 `src/components/archive/ArchiveShell.vue`，另外在 `scripts/verify-portal-path-locator-browser.mjs` 里把 P41/P45 改成直接点「卡池」「通信」。
- 验证：门禁 116/116；`build:check` 通过；在 1366×768、1024×768、1180×820、1440×900、1920×1080 下图鉴展开也不需要滚动；1280×640 下图鉴展开要多滚约 84px（可以接受）。
- **已否决、不要再提的方案**：双列且每格带图标（侧栏 188px，两列每格约 83px，「摄影资源」加图标需要约 94px，放不下）；把第二项做成右侧小胶囊（会让平级栏目看起来像附属项）；缩短「其他语音」的名称（10-20 就已否决）。

## 2. 批次 B：卡面缩略图档（性能，先于 C 做）

**目标**：门户卡面区改用有损缩略图，降低桌面门户首屏的传输量。现在约 4.7 MB（10-23 测试站实测，见记忆 sidem_portal_perf_1022）。

**已核实的事实**
- 卡面 URL 由 `src/utils/CardAssetResolver.js` 生成：
  - `getCardLandscapeUrl` → `/assets/card-art/landscape/image_card_landscape_<id>[p].png`
  - `getCardPortraitUrl(id, awakened, framed)` → `/assets/card-art/portrait/image_card_portrait_{hide|show}_<id>[p].png`
- 原图在 `E:/BaiduNetdiskDownload/SideM/GS_Res/ALL_PHOTOS/assets/resources/image/image_card/`，由 `scripts/lib/archive-assets.mjs` 的 `cardArtPath` 解析，可用环境变量 `SIDEM_CARD_ART_ROOT` 覆盖。
  - 横版：只有 **248 张**（基本是 SSR），**1800×960（15:8）**，RGBA PNG 约 1.8–2.5 MB。
  - 竖版：2722 张，**640×800（4:5）**，RGBA PNG 约 280–760 KB。
- 部署转换规则在 `shared/deploy/PreviewAssetTransform.js`，导出脚本 `scripts/export-preview-assets.mjs` 和 Pages Function `functions/_shared/r2-resource.js` 都 import 它。浏览器请求的 URL 仍是 `.png`，R2 里实际存 `.webp`。
  - 卡面属于「运行时合成、保持无损」那一类（见文件里 `PREVIEW_LOSSY_WEBP_PREFIXES` 上方的注释），**不要把 `assets/card-art/` 加进有损前缀**：详情页需要原图。
  - 文件里已有 `LOSSY_WEBP_TRANSFORM = 'webp-q90-alpha-lossless-exact'`，可以参考它的编码参数。编码器必须用 Pillow 并带 `exact=True`，不能用 Sharp（见记忆 sidem_webp_exact_flag）。
- 已有类似做法可参考：`scripts/terminal/build_terminal_media.py --derivatives`（生成 720 宽竖版 / 1600 宽横版 WebP，原图不动）。

**要做的**
1. 新增一个**逻辑 URL 前缀**，例如 `/assets/card-art/thumb/{landscape|portrait}/…`，在 `CardAssetResolver.js` 里加 `getCardThumbUrl(...)`。缩略图尺寸按门户实际显示宽度定，建议横版 960 宽、竖版 400 宽，有损、q≈80。**先用浏览器量门户里卡面的实际显示尺寸（乘以 DPR 2）再定**。
2. 缩略图的生成放进导出流程。本地 dev 也要能出图：可以参考 `scripts/lib/public-corpus-plugin.mjs` 的回退方式，或者先生成到一个本地派生目录。
3. 只让门户（`PortalCardBento.vue`、`ArchivePortalPresentation.js` 里的 `cardImage`）使用缩略图；卡片详情页继续用原图。
4. 保留 `useNearViewport` 的现有策略：桌面端立即加载（卡面可能是 LCP），手机端到视口附近才加载。
5. 回归测试：`scripts/verify-portal-image-budget-browser.mjs`（门户图片预算）、`verify-portal-bento.mjs`、`verify-archive-portal-presentation.mjs`。
6. **R2 上传和部署要先停下来问用户**，并走 `release/` 分支。

## 3. 批次 C：卡面区「1 横 + 3 竖」等高画廊（依赖 B）

**现状**：`src/components/archive/PortalCardBento.vue`，选卡逻辑在 `src/presentation/PortalBento.js`（`portalDailyCard` 按日期做种子）。全站视图是 1 张 15:8 主卡 + 两张竖卡 + 右下角的属性/稀有度筛选；担当视图是主卡 + 竖卡 + 文字行（`bento-note`、`bento-directory`）。三种比例混在一起，只有某个特定宽度下能对齐。

**定案**
- 一排放 1 张 15:8 横卡（从有 `landscape` 的池里抽；全站用 `portalDailyCard`，担当视图用第一张有横图的卡）+ 3 张 4:5 竖卡（竖版覆盖全部卡片）。
- **等高的写法**：每张图写 `flex: <宽高比> 1 0` 加上 `aspect-ratio`，横卡 `flex: 1.875 1 0; aspect-ratio: 15/8`，竖卡 `flex: .8 1 0; aspect-ratio: 4/5`。flex 会先扣掉间距、再按比例分剩下的宽度，所以任何宽度下都精确等高。**不要写死 44% / 18.6%**：那两个数没算间距。
- **窄宽度降级**：卡面区内容宽度小于约 900px 时改成「1 横 + 2 竖」（同样写法，一般用容器查询）。桌面侧栏 188px，所以 1024 宽的屏幕上内容区只有约 800px。手机端保持现有布局（`<picture>` 在 ≤760 宽时换竖图）。
- **属性和稀有度胶囊移到标题栏右侧**（`.overview-card-heading` 里），做法和「歌曲与舞台」标题栏的分类胶囊一致。现有 `emit('filter', {attribute|rarity})` 的跳转保留。属性数量来自 `counts.attribute`（门户生成器写入的 facets）。
- 担当视图去掉 `bento-note`、`bento-directory` 两行文字，卡片总数挪到标题后的 `<small>` 里，和其他区块一致。
- 「换一组」（`shuffleCards` → `offset`）要让 4 张一起换。
- 图片用批次 B 的缩略图。如果 B 还没合，至少不要让首屏图片体积比现在更大（现在 3 张，改后 4 张）。
- 更新 `scripts/verify-portal-bento.mjs`，并按记忆 sidem_verifier_must_be_mutation_tested 做变异测试：把修复改回坏版本，确认 verifier 真的会失败。
- 浏览器验收要在 1024、1366、1920 宽和手机 390 宽下截图，量四张图的 `getBoundingClientRect().height` 是否相等（误差 ≤1px）。

## 4. 批次 D：「315 岁时记」替换「运营轨迹」

**现状**：`ArchivePortalOverview.vue` 底部的 `.overview-events`，全站视图用 `timeline`（来自 `portalTimeline`，在 `src/presentation/PortalBento.js`）：取第一场、每年中间一场、最后一场，去重后约 7 张。**数据是在生成期算好的**：`readmodels/lib/portal_projection.mjs` 第 55 行附近，`events: preferredIdol ? full.events : portalTimeline(full.events)`。全站 scope（`portal/scopes/all.json`）里只有 5 个活动。

**定案（用户已确认：复刻活动计入）**
- 标题「315 岁时记 · N 月」，标题栏放 1–12 月的胶囊，默认选中当前月（按日本时间，`Asia/Tokyo`）。
- 左栏「N 月生日偶像」：头像、名字、日期，加一个跳到该偶像生日剧情的按钮。右栏「历年 N 月活动」：banner、开始日期、标题，点击进活动详情。
- 担当视图里这个区块仍然是「活动足迹」，不改。

**数据（不能叫「零新数据」，要在生成器里补）**
- 活动：活动目录共 59 场，日期字段是 `release_at`（Unix 秒），有 `isReprint` 字段（复刻**计入**）。按日本时间分月：1 月 7、2 月 7、3 月 7、4 月 5、5–9 月各 3、10 月 5、11 月 7、12 月 6。
- 生日：**只存在于偶像详情**（`idols/detail/*.json` 的 `birthday` 字段，是文字，例如 `"6月2日"`；阿斯兰是 `"マヤ歴5174年\n10月9日"`，要取最后一个「M月D日」）。生成期可以从 `product.extraDomains.idols.records[].view` 拿到，`portal_projection.mjs` 里已经在用 `product.extraDomains.idols`。49 人，每月 3–5 人。
- 做法：在 `portal_projection.mjs` 给全站 scope 新增一份 12 个月的小数据（例如 `almanac: {months: {1: {birthdays:[{idolCode,name,month,day}], events:[{id,title,releaseAt,image,isReprint,target}]}, …}}`），预计几 KB。**不要让浏览器去拉 37 KB 的活动目录**。
- **兼容性**：`src/data/PortalRepository.js` 会校验 `projectionVersion === 2` 和 `footprints.length === 4`。如果要提升版本号，旧读模型就会被拒绝，所以最好新字段可选：缺了就回退到旧时间轴，或者不显示这个区块。改读模型需要重新生成候选（`readmodels/tools/build_readmodels.mjs`），生成之后的 release 绑定和部署走 `release/`，**先问用户**。
- 生日剧情的跳转：现在门户里没有「某偶像的生日剧情」的入口。生日剧情目录是 `openStoryCatalog({domain:'birthday'})`（`App.vue` 的 `openPortalResult`）；按偶像定位的方式要去 `ArchiveStoryCatalog.vue` 或生日相关的 composable 里查。实在没有就先跳到偶像详情页。
- 相关 verifier：`verify-archive-portal-presentation.mjs`、`verify-portal-loading-layout.mjs`、读模型的 portal 相关检查（用 `grep -rl portal_projection scripts readmodels` 找）。

## 5. 批次 E：门户补齐

1. **补「活动剧情」「组合前传」两个入口**：
   - 在 `src/presentation/StoryGateways.js` 的 `storyGateways` 里加两项。名字用 `STORY_KINDS.unit_story.label`（组合前传，别名「第零话」），活动剧情没有 STORY_KINDS 条目，文案用「活动剧情」。
   - **必须**在 `App.vue` 的 `openPortalResult` 里给 `target.view === 'story_gateway'` 补上分支。现在只处理 `idol_story` / `work` / `seasonal_campaign` / `birthday` / `extra`。落地页的路由形状是 `{view:'story_catalog', storyType:'event'|'unit_story'}`（见 `archiveRoute.js` 的 `retiredDirectoryRoute`）。很可能直接 `openStoryCatalog({domain:'event'|'unit_story'})` 就行，要在浏览器里确认。
   - 数量：`storyGatewayCount` 和生成器里的 `gatewayCountsByAction` 要能算出这两个入口的数量，必要时在 `portal_projection.mjs` 的 `gatewayCounts` 里补。
   - 主线章节已经由 `readableMainCollections` 展示，**不要再加一个主线入口**。
2. **故事档案和歌曲与舞台在桌面并成两栏**：`ArchivePortalOverview.vue` 的 `.overview-content-grid.is-global-grid`。在宽屏上让 `.overview-stories` 和 `.overview-music` 各占一半；手机不变。
3. **「通信 / 图鉴」入口块**：在歌曲和岁时记之间。**只放数量和链接，不抽随机聊天**（那样要额外加载通信数据，抵消 #84 省下的流量）。
   - 通信：个人聊天 / 组合聊天 / 电话通信，跳 `interactions`。
   - 图鉴：道具 / 称号 / 货币 / 服装 / 摄影资源 / 其他语音，跳对应栏目。名字一律取自 `archiveSections.js`。
   - 数量如果 scope 里没有，就在生成器里补；没有数量的项就不显示数字。
4. **担当视图右侧数据面板**：`ArchivePortalOverview.vue` 的 `.overview-personal` 旁边（审阅截图说右上角有大块空白）。做成 2×2 小块：
   - 卡片：总数 + SSR/SR/R 分布，用 `desktopOverview.cardCounts` 或 scope 数据；
   - 出场剧情：按分类，用 `storyTabs`；
   - 参与歌曲：用 `songCounts`；
   - 通信或活动足迹：先查 scope 里的 `preferredStats` 和 `counts` 有没有通信数量，没有就用活动足迹代替。
   每块点击跳到对应列表（沿用现有的 `openDirectory`、`emit('open-preferred')`）。
5. 回归测试：`verify-portal-directory-navigation.mjs`、`verify-portal-navigation.mjs`、`verify-archive-portal-presentation.mjs`、`verify-portal-loading-layout.mjs`、`verify-portal-bento.mjs`，再加旅程测试。

## 6. 已否决（审阅里提过，不做）

| 提议 | 原因 |
|---|---|
| 首屏 KPI 数据磁贴 | `ArchivePortalOverview.vue` 有注释「Scale of the archive as one line of links, not a row of number tiles」，是之前定下的方案 |
| 运营轨迹加年份锚点 | 时间轴只有约 7 张，没必要；而且这个区块会被 D 替换 |
| 手机底栏第 3 格改胶囊 | #61 视觉轮次已否决（最后选了三格等宽 + 小箭头） |
| 抽屉去掉分组小标题 | #61 已改成分层结构，审阅描述的是旧版 |
| 「其他语音」改名「语音」、服装移进核心 | 10-20 已否决 |
| 通信区抽随机对话气泡 | 流量预算 |

## 7. 截图和证据位置

- 侧栏截图：`C:/Users/windm/AppData/Local/Temp/claude/E--Web-build-SideM-Archived/c7b50210-3556-4649-9fc8-8f5b5dc776d3/scratchpad/`
  - `a1/`：第一版（一行两项）；
  - `b1/`–`b3/`：单列最终版，`b3/items-1366.png` 是 1366×768、图鉴展开的样子；
  - `measure.js`：量侧栏是否需要滚动、格子是否溢出的脚本。
- 本地读模型候选（数据核对用）：`E:/Web_build/GS_Archive_Domain_Work/rm-release-20261022/pages/_catalog/v/1accd9d0…/`。其中 `portal/scopes/all.json` 的结构是 `{id, overview:{…}}`，`events/catalog/page-0000.json` 是 59 场活动。

## 8. 收尾

- 每批合并后更新 [CURRENT_STATE.md](CURRENT_STATE.md) 的「门户 portal」行（经下一条线的 PR 进入 master）。
- 本文的批次顺序：A（已合并，#86）→ B → C → D → E。B 和 E 互不依赖：如果 B 卡在 R2 授权上，可以先做 E（纯前端，读模型改动最少），再回来做 B/C/D。
