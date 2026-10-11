# GS Archive 交互连续性与动效（2026-10-10）

输入 HEAD `d1610bab`，分支 `codex/portal-architecture-cleanup-20261004`。规则写进 `GS_UI_CONSTITUTION.md`「动效」一节；本文只记这一批改了什么、怎么验的、边界在哪。

## 改了什么

| 问题 | 处理 | 位置 |
| --- | --- | --- |
| 换页是硬切 | 新页 160ms 从纸面淡入，只用透明度；旧页立即离开，不拖住操作 | `ArchiveShell.vue` |
| 图片一条条画出来 | 加载完成（或失败）才显示并 180ms 淡入，加载中露出格子底色 | `presentation/imageReveal.js`、`styles/gs-motion.css` |
| 弹层直接出现、直接消失 | 通用对话框、筛选底部抽屉、阅读设置、新手引导：进场上浮或从底边升起，关闭淡出且内容保留到淡出结束；季节企划抽屉、灯箱：进场 + 淡出；藏品快捷查看、藏品详情、门户搜索结果：只有进场 | `ArchiveTerminalDialog.vue`、`ArchiveFilterSheet.vue`、`ReaderWorkspaceControls.vue`、`ArchiveOnboarding.vue`、`ArchiveSeasonalCampaign.vue`、`ArchiveImageLightbox.vue`、`CollectionQuickView.vue`、`CollectionDetailPanel.vue`、`ArchivePortalOverview.vue` |
| 触屏按下没有反馈、有系统灰色高亮 | 触屏按下立即变淡 .64，松开 120ms 恢复；去掉点击高亮和双击缩放延迟；控件颜色变化 120ms 过渡 | `gs-motion.css`（`:where()`，特异性 0） |
| 卡片详情底部点「下一张」，新卡停在半页、看不到卡面 | 同一页面新增的历史记录从顶部开始 | `App.vue` `adoptArchiveViewContext` |
| 返回卡片详情只回到 187px（原位置 3552px） | 恢复时如果页面还没长到原深度，继续跟随最多 180 帧；读者自己滚动立即停止 | `core/archiveViewRestoration.js` |

刻意没做：页面之间的位移/推入动画（会让固定栏错位，也拖慢返回）、列表项逐个入场、标签下划线滑动、骨架屏（现有延迟 140ms 的加载提示已够）。

## 验证

- `node scripts/verify-archive-motion.mjs`（新增，已加入 source batch）：7 个变异（对话框内容立即卸载、去掉 reduced-motion、换页加 transform、组件直接写 `--gs-*-from`、图片失败不标记、阅读面板回到 `panel`、抽屉 320ms）全部被拦下，还原后通过。
- `verify-archive-view-restoration` 增加两例：数据晚到时跟到原深度；读者滚动后停止跟随。`verify-song-archive-view-restoration`、`verify-event-catalog-navigation`、`verify-photo-catalog-navigation` 的 App 夹具补上新状态（`adoptedArchiveView`、`readArchiveViewRestoration`、计时器），后两者需 `--experimental-vm-modules`。
- `npm run verify:source-batch`：123 项中 122 通过。失败的 `verify-character-line-text` 断言台词换行，属于工作区里另一窗口尚未提交的 `ArchiveText.js` 改动，与本批无关。
- `verify-archive-presentation` 在 HEAD 上同样失败（季节企划模板 `<col>` 的解析问题），不是本批引入。
- `npm run verify:design-tokens`：没有新增。`npm run build:check` 通过（代码编译，不含 public 资源）。
- Browser（本工程 dev 服务 5175，`SIDEM_READMODEL_CANDIDATE=E:/Web_build/GS_Archive_engineering_20261007/rm-seasonal-ledger`；`rm-seasonal-reading` 缺季节企划账本，季节页会加载失败）：
  - 手机 390：卡片详情滚到底点「下一张」后 scrollTop 0；返回后恢复原位置。筛选底部抽屉第 2 帧 opacity .84、仍有 50px 位移，240ms 后到位；点「完成」后第 1 帧仍显示内容，400ms 后 `display:none` 且内容卸载。阅读设置从底边升起。新访客引导从底边升起。季节企划在手机上是底部抽屉。
  - 桌面 1280：灯箱淡入，Esc 后带 `gs-overlay-leave` 淡出再移除；季节企划抽屉从右侧移入 32px、关闭淡出。换页时新页根元素带 `gs-fade-in` 动画。
  - 限速（300ms 延迟、200KB/s、禁用缓存）的歌曲目录：封面位先显示底色格子，未出现条带式绘制。
  - 画廊 `.analysis/gallery/ux-motion-20261010/`：7 个场景 × 3 宽度，18/21 干净；`seasonal` 画廊场景失败是因为画廊夹具没跟上今天的 `page.ledger`（5b685f40），真实页面正常。
  - 控制台无报错。

## 边界

- 触屏按压态：无头 Chromium 的触摸模拟读不到 `:active`，按压变淡只有样式与合同检查，**需要真机确认手感**。
- 原生 `<dialog>` 的淡出依赖 `@starting-style` / `transition-behavior: allow-discrete`（Chrome 117+、Safari 17.5+）；更旧的浏览器直接出现、直接关闭。
- 慢网络下，大图要等整张下完才显示，比以前逐行出现更晚看到第一笔；换来的是不再有半张图。
- 工作区另有其他窗口未提交的改动（`ArchiveImmersiveHome.vue`、`ArchiveCardDetail.vue`、`ArchiveEventDetail.vue`、`GS_UI_TOKENS.css` 等），本批没有碰这些文件，所以首页场景设置 / 台词目录这两个对话框还没接入动效；动效令牌放在新文件 `gs-motion.css`，没有写进 `GS_UI_TOKENS.css`。
- 未推送、未部署。

## 第二轮：切页频闪与按压手感（2026-10-10）

外部评审指出：快速连续切页时，旧页立即消失、新页从 opacity 0 起，纸面底色夹在两页之间，像闪烁。

| 采纳 | 处理 |
| --- | --- |
| 切页频闪 | 新页改用 `gs-page-in`，从 `--gs-page-from: .3` 起（不再从 0），时长 160 → 110ms；外壳（侧栏、顶栏）本来就在动画范围之外，保持不动 |
| 按压像「禁用」 | 触屏按下由 opacity .64 改为 `scale(.97)` + `brightness(.92)`，过渡补上 transform / filter |
| 缓动 | 动效专用 `--gs-ease-out` 改为 `cubic-bezier(.16, 1, .3, 1)`（快进、轻刹）；悬停反馈沿用 `--gs-motion-ease`，没动 `GS_UI_TOKENS.css` |

没采纳：页面根 `translateY(4px)`（页内固定栏会在动画期间错位，宪法里已明确禁止；用 .3 起始透明度解决同一问题）；View Transitions API（页面切换由应用状态驱动，截图交叉淡入会与滚动恢复、固定栏重新锚定相互牵制，需要单独评估，不在本轮）；主色占位与 blur-up（需要数据层提供主色/缩略图，属另一批工作）。

验证：`verify-archive-motion.mjs` 更新阶梯（页 ≤ 退场 < 进场）、按压规则与页面起始透明度并通过。触屏手感仍需真机确认。
