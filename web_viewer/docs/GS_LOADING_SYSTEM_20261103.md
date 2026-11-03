# 加载系统定版（2026-11-03）

设计页：https://claude.ai/artifact/NRRchBHvk9NBAfNAAG8bNw（现状复刻、清单、改前改后）。
分支：`portal/20261103-loading-unify`，基于 master `e9449c5e`。

## 首屏

- 首次进入要经过两个画面：`index.html` 的无脚本首屏 → 应用挂载后的资料馆幕布（`LoadingScreen` `surface="archive"`，只在 `view === '__boot__'` 时出现）。
- 两者是同一张画面，改一个必须同时改另一个：
  - 纸色底 `--gs-paper`。
  - 正中偏上 4%（`inset: 0 0 8vh`）是品牌锁定写法：M 标 52×40（`brightness(0)`）、GROWING STARS 舞台字斜体 700 28px（`--gs-text-title`）、第二行「SideM 资料馆」14px、ink-3、字距 .08em。手机同尺寸。
  - 品牌下方是站点说明「《偶像大师 SideM GROWING STARS》非官方资料馆」（13px ink-3）、28px 细线、游戏服务期「2021.10.06 — 2023.07.31」（舞台字 600、字距 .12em）。文字来源是 `content/siteLine.js` 的 `SITE_LINE` / `SERVICE_PERIOD`（11-04 从 aboutContent.js 拆出，首屏不再带关于页全文），关于本站页头用同一份；`index.html` 无脚本，里面是静态副本。
  - 右下角是 Now Loading 徽章，边距 `--gs-curtain-edge`。
- 首屏用 `<link rel="preload">` 加内联 `@font-face` 载入 `barlow-semi-condensed-700-italic-latin.woff2`。Vite 会把它改写成和应用 CSS 相同的哈希地址，所以挂载前后是同一个字体文件。

## 三档

挑哪一档只看在等的东西有多大。新代码不要自己画转圈。

| 档 | `variant` | 圈 | 用于 | 位置 |
|---|---|---|---|---|
| 幕布 | `badge` | 48 | 整屏或整个舞台还不能用 | 所盖区域右下角，边距 `--gs-curtain-edge`（clamp(16px, 3vw, 44px)）加安全区 |
| 换页卡 | `inline` | 22 | 整页正在换 | 要填的内容区正中，140ms 后淡入 |
| 就地 | `text` | 16 | 页面里的一块还在读 | 那块内容将要出现的位置，替换原来那行状态文字 |

- **幕布**：徽章钉在角上。说明文字只占一行，超长省略，读屏仍读全文。资源计数、慢提示、取消按钮右对齐，堆在徽章上方，所以后出现的内容不会推动徽章。窄屏不再缩到 40。
- **换页卡**：只有一张卡，白底、圆角 12、`--gs-shadow-float`、内边距 12/16。外壳挂起层不再给它套第二张卡。`ArchiveLoadNotice` 用同一个盒子，失败时在原位替换。
- **就地**：没有卡，文字 13px ink-3。默认保留段落间距（`:where` 零优先级），调用方的 class 可以覆盖。计数格、按钮里本身就是内容的「正在读取…」保留纯文字，不加圈。
- **例外**：播放中缓冲（`StoryViewer` `.local-buffering`）用换页卡，但放在左上，不挡对话框。

## 调用点（本分支之后）

| 场景 | 文件 | 档 |
|---|---|---|
| 首屏 | `index.html` | 幕布（静态复刻） |
| 资料馆 / 播放 / 舞台幕布 | `LoadingScreen.vue`（`App.vue` 两处） | 幕布 |
| 剧情数据读取 | `core/StoryViewer.vue` `.story-data-loading` | 幕布，右下 |
| 多人舞台启动 | `ChibiStageViewer.vue` `.stage-state--loading` | 幕布，舞台右下 |
| 舞台小人 | `SpineViewer.vue` `.stage-state--loading` | 幕布，区域右下 |
| 换页（外壳内 / 外） | `App.vue` → `ArchiveShell` 挂起层 / `.archive-route-pending-fallback` | 换页卡 |
| 播放中缓冲 | `core/StoryViewer.vue` `.local-buffering` | 换页卡，左上 |
| 活动、LIVE 曲目、歌词、谱面、场景、壁纸、人物名单、摄影 ×3、藏品 ×3 | 13 处 | 就地 |
