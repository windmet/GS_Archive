# 门户整体改造交接：节目册 2.0（2026-10-27，v6 更新；v8 验收 1）

> **v8 验收 1（10-27 晚）**：#106、#107 已验收，结论、量出的数和下一步规格见 [PORTAL_REDESIGN_ACCEPTANCE_20261027.md](PORTAL_REDESIGN_ACCEPTANCE_20261027.md)。新增两批 P1.5「外壳校正」、P1.6「旧控件替换」，插在 P6、P7 剩下的部分之前。它们改写了本文三处：标题行一行、侧栏 208 / 58 可收起、图鉴在侧栏只留一个入口。三处冲突时以验收文档为准。

这份交接给接手「整体门户改造」的新窗口。设计方向已经和用户逐轮定下来，新窗口的任务是按批次落地，不需要重新提方案。规格以本文为准，方向稿是参照：构想图按真实条目和资源画，但不是像素稿，最终以组件、令牌和 Browser 实测为准。

开始前先读 [CURRENT_STATE.md](CURRENT_STATE.md)、[GIT_WORKFLOW.md](GIT_WORKFLOW.md) 和 [BUILD_ACCEPTANCE_POLICY.md](BUILD_ACCEPTANCE_POLICY.md)。

## 0. 方向稿在哪

| 项 | 位置 |
|---|---|
| 在线方向稿（私有，用户账号可开） | https://claude.ai/artifact/LuPQW8porEGccPrnADFFbW （version 8；v8 新增「外壳校正与工具入口」一节） |
| 本地副本，浏览器直接打开 | 主 checkout `web_viewer/.analysis/design-booklet-20261027/gs-booklet-2.html` |
| 源文件与生成脚本 | 同目录：`booklet.src.html` → `build.py`（把 `images.json` 内嵌成 `im-*` 背景和 `ms-*` 遮罩）→ `gs-booklet-2.html`；`update2–6.py`、`update6b.py` 是各版改动 |
| 全部文字，方便检索 | 同目录 `booklet_text.md` |
| 令牌增量原文 | 同目录 `tokens-v2.css` |
| 样例数据 | 同目录 `songs.json`（60 首 + 1 个特殊版本的编制、组合、特性）、`colors.json`（49 人代表色）、`names.json`、`units.json` |

`.analysis/` 被 Git 忽略。方向稿内嵌约 2 MB 图片，按 [仓库数据治理](REPO_DATA_GOVERNANCE_20261022.md) 不进 Git。

## 1. 前置 PR 的状态

门户改造从这几条都合入之后的 master 开分支，否则会和衣装筛选、审计修复撞在同一批文件上。

| PR | 分支 | 内容 | 状态 |
|---|---|---|---|
| #100 | `chart/20261024-autoplay-timeline` | 谱面自动演示、命中特效、Combo/315、打击音 | 已合入（`75755179`）。15 个 OGG 打击音（511,331 B）按用户决定作为例外留在 Git，登记在 [仓库数据治理](REPO_DATA_GOVERNANCE_20261022.md) |
| #101 | `portal/20261024-ui-audit-convergence` | F01–F18 八批修复 + R1–R5 + Escape 收起修复 | 已合入（`ec6f9fcd`）。R2 的 Escape 修复只做了源码和构建，**Browser 复验待补**。被它取代的 8 条 `portal/20261024-*` 分支，`git cherry` 已确认补丁全在 master，可打 `archive/` tag 后删，由用户执行 |
| #102 | `portal/20261025-costume-filters` | 首页 / 摄影按原生派生类别筛选衣装 | 已合入（`6a4651a6`），文档 [COSTUME_CATEGORY_FILTERS_20261025.md](COSTUME_CATEGORY_FILTERS_20261025.md) |
| #103 | `stage/20261025-costume-groups` | 舞台衣装五层归族、套服搭配 | 已同步 master（`76d97978`），`verifier-coverage.json` 与 CURRENT_STATE 的冲突已解，LF 检出 116/116，**待合**。文档 [STAGE_COSTUME_FAMILIES_20261025.md](STAGE_COSTUME_FAMILIES_20261025.md) |
| #104 | `docs/20261027-portal-redesign-handoff` | 本交接第一版 | 已合入（`4ea7d284`） |

本文 v6 更新与 CURRENT_STATE 刷新在 #103 之后合入。

## 2. 已定的决定

1. **薄荷只给「现在」**：播放、进度、开关打开、标签下划线、选中的筛选片、焦点与链接。模式开关、返回、「查看全部」、文字按钮、引文竖线、衣装矩阵单元格、侧栏 / 目录当前项都撤掉薄荷。剧情播放器名牌绿 `#10D583` 是游戏原生采样色，不算薄荷，不改。
2. **站名 GROWING STARS**：
   - 锁定写法：M 标 + GROWING STARS（舞台字斜体 700）+ 第二行「SideM 资料馆」。侧栏宽 188 时字号 15.5、M 标 26、第二行 11.5。
   - 欢迎页和关于页可用带「THE IDOLM@STER SideM」的长版。
   - 浏览器标签：子页 `{页面} · GROWING STARS 资料馆`；首页 `GROWING STARS 资料馆 · 偶像大师 SideM`。
   - GS Archive 只留在域名、仓库、`og:site_name`。
3. **中/日分三级**：
   - A 资料语言：只在外壳顶栏，固定「中 | 日」，深色工具用深色版。
   - B 正文语言：跟着正文走，统一叫「原文 / 译文 / 双语」，空间紧时缩成「原 / 译 / 双」。播放器的「日文 / 中文」改名；事务所台词框改切这句台词的原文 / 译文。
   - C 状态标记：不是按钮，例如「仅原文」「校对中」。
4. **活动剧情 A + B**：目录页最新 4 部等宽一排；「按年份浏览全部 38 部」进入年份书架（300×150 小横幅）。活动剧情是 38 部，不是 59。
5. **舞台光默认薄荷**：担当色前两层默认就有；第三层「舞台光：薄荷 | 担当色」默认关。
6. **谱面默认**：透视 + 自动演示 + 打击音 SE1 + Combo 全开，音效 70%。
7. **纸面侧栏（方案 A）**：
   - 侧栏去掉整块藏青，换成纸面加一条细线。藏青退到工具顶栏和深色舞台。
   - 品牌行与右侧标题行同高 60px，两边底线连成一条。
   - 资料馆首页的标题行也统一到这一高度：现在首页自己画，其他页走 `ArchivePageChrome`。
8. **我的担当：纸面上的一行切换器**（v6 改，替换上一版「wash 浅底名牌」）：
   - 用户反馈上一版名牌「层级陷下去」：浅底在纸面侧栏里比纸深一级，读成凹槽。侧栏只有三种高度：凹槽 paper-2（轨道、底槽、占位）、纸面（静止）、白片（当前项）。担当不是当前页，不能用白片；也不该进凹槽，所以静止时直接放在纸面上，不铺底。
   - 结构：头像 28px，身份环用 `outline: 2px solid <代表色>; outline-offset: 2px` 画，间隙透明；右边两行字，名字 13 / 600 ink、「我的担当」11.5 ink-3；右端上下箭头（lucide `ChevronsUpDown` 14px，ink-3），替换现在的 `ChevronDown`。
   - 尺寸：行高 52，左内边距 7，头像中心与下方导航图标中心对齐（距侧栏内容左缘 21px）；下接导航留 12px，不加分隔线；圆角 10。
   - 状态：悬停 `--gs-hover`（ink 5%）；点开时抬成白片（`--gs-current-bg` + `--gs-current-shadow`），弹层贴在下方，内容就是现在对话框的两项：「舞台光跟随担当色」开关、「更换担当 ›」进入选择器。手机仍用底部抽屉。收起侧栏时只剩头像。
   - 未设担当：同一行，虚线圆 + 「设置担当」。
   - 顶部 3px 灯条和左侧竖条都不用：用户说灯条让左右像没对齐。
9. **立绘色影 + 签名落款**：
   - 色影：立绘向右下投平影，`filter: drop-shadow(14px 8px 0 color-mix(in oklab, <偶像 ink> 24%, transparent))`。
   - 落款：签名用这位偶像的 ink 写在名字旁或名字下，在纸面一侧，不叠在立绘前后。
   - 签名原图是白笔画加深色描边，作遮罩前只保留白笔画。可选首次进入视口时由上往下写一遍（`clip-path`，约 1.8s），减少动态时直接显示。
10. **头像只用两种环**：
    - 身份环：单人，`0 0 0 2px #fff, 0 0 0 4px <代表色>`。用在详情归属、说话人、我的担当、事务所、偶像选择器。
    - 群像：多人，`0 0 0 1.5px #fff, 0 0 0 2.5px rgb(19 33 58 / 12%)`，叠放 −6px。用在组合成员、活动出演、剧情出场、通信嘉宾、其他语音。
    - 当前项：身份环外再加白间隙和一圈薄荷。
    - 深色工具里，白间隙改成舞台底色。
    - 浅蓝仿框退役：`ArchiveIdolAvatar` 的 `ringWidth: 0` 分支换成群像环，删掉 `--gs-avatar-frame`。保留放大 1.12 倍的裁切，它已经盖住原图方框。
    - 底色会变的地方（侧栏担当行的悬停 / 展开）身份环改用 outline + offset，间隙透明，不露白边。
11. **选中态 A 白片**（用户 10-27 确认）：规则见第 3 节。
12. **舞台曲目页**（v6 新排，用户交给 Claude 定，不另说就按此实现）：规格见第 6 节「2D 舞台」。

## 3. 选中态（已定 A）

用户不喜欢现在的当前项：左侧 3px 竖条 + 浅底 + 加粗，读起来像半个括号，还和名字前的身份竖条撞在一起。10-27 确认用 A：

- **一条规则**：选中 = 比所在底面高一级的一块面。纸面上是白片（`--gs-current-bg` + `--gs-current-shadow`），它和分段开关的白滑块是同一片；白底面板里是凹一级的 `--gs-current-bg-inset`（paper-2）。
- **不加粗、不加线**：字重保持 500，只把文字从 ink-2 换成 ink、图标从 ink-3 换成 ink。
- **一块面滑过去**：同一组只有一个指示块，换选中时 `transform` 滑到新位置（`--gs-current-motion`，180ms）；减少动态时直接出现。
- **用在**：侧栏当前项、阅读器目录当前 EP、手机导航抽屉、事务所人物 / 衣装列表、歌曲版本格。分段开关、标签页下划线、筛选片不变。
- 偶像详情和事务所名字前的 3px 原色竖条是身份，不是选中态，保留。用户若也想去掉，换成名字下方一条 24px 短色线。

方向稿「选中态」一节仍保留 A / B / C 整页对照开关，只作比较；实现只做 A。

## 4. 令牌增量（v2）

追加到 `src/styles/GS_UI_TOKENS.css` 末尾，只增不改，原文见 `tokens-v2.css`：

- **表面层级**：纸面 → 凹槽 `--gs-paper-2: #eceff3` → 控台 `--gs-console` → 浮层。另有 `--gs-shadow-1`（滑块）和 `--gs-shadow-console`（比浮层轻一档）。
- **节奏**：
  - 间距：`--gs-gap-inline 8`、`--gs-gap-stack 12`、`--gs-gap-group 24`、`--gs-gap-section 48 / 手机 32`。
  - 内边距与行高：`--gs-pad-panel 20 / 16`、`--gs-row 44`（桌面也用）。
  - 页面左右留白：`--gs-gutter 32 / 16`。
- **宽度**：`--gs-reading-width 680`、`--gs-rail-width 168`、`--gs-tool-panel 360`、`--gs-tool-panel-compact 292`、`--gs-tool-bar 56`。
- **字**：`--gs-text-figure 32 / 手机 26`、`--gs-leading-body 1.75`、`--gs-leading-ui 1.45`、`--gs-track-label .04em`。分组小标题统一 12 / 600 / .04em。12px 是全站下限。
- **控件族**：`--gs-mode-track / -thumb / -ink`、`--gs-radius-segment 6`、`--gs-switch-on / -off`。
- **当前项**：`--gs-current-bg / -shadow / -bg-inset / -motion`（见第 3 节）。
- **悬停**：`--gs-hover: rgb(19 33 58 / 5%)`，纸面和白底通用，替代现在 `--gs-mint-wash` 的「hover on paper」用途（薄荷只给「现在」）。
- **担当色**：`--gs-idol / -light / -ink / -wash`，运行时由 `idolStageLight(担当原色)` 写入；未设担当时取中性色。
  - 原色只画环和 3px 色条，不做文字。
  - ink 保证 4.5:1；例如悠介 `#FFE200` 的文字用 `#716400`。
- **工具深色舞台**：`--gs-stage-bg #0b1424`、`--gs-stage-raise`、`--gs-stage-line`、`--gs-stage-ink / -2`、`--gs-stage-track / -thumb`。

## 5. 全站规则

- **选中只有三种长相**，按用途分：
  - 模式开关：改变整块画面怎么看。凹槽 + 白滑块 + 墨色字，最多 3 段，放在它影响的区域的标题行。
  - 筛选片：缩小范围，可多选，数量写在片内，选中用薄荷浅底。
  - 下划线标签：同级页面 / 面板分页，页面 44、面板 40。
  - 导航当前项用模式开关的同一块白片。
- **盒子预算**：一个区域最多一张控台（白底 + 控台阴影）。内容靠标题、细线和留白分组，不在白底里再套白底或浅色格。`verify-design-tokens` 加一项「白底套白底」计数，只减不增。
- **数字是文字**：统计写成「17 / 826 卡片」加一行灰色分解，用舞台字排在细线行里，整行可点，不做方块。
- **模式外置，偏好内收**：
  - 外置：立绘 / 卡面、全站 / 担当、轻量 / 完整、透视 / 长轨、正文语言这类会改变画面的开关，放在外层标题行。
  - 内收：音量、帧率、贴图、P 名字这类设一次就不动的偏好，才进设置。
- **对齐交给网格，不交给框**：
  - 列表和目录用固定列宽、固定 20px 图标列、44px 行加 1px 细线。
  - 条目数不齐时补空行，细线照画。
  - 分组靠 12px 灰色小标题，不靠底色；工具入口用「↗」和一行说明，不用描边卡。
- **说明分三层**：读者可见的说明一行以内；「怎么用」进 ⓘ（悬停或点按，两行以内）；「依据是什么」进维护者模式（`?maintainer=1`）或关于页；控件已说清的删掉。具体条目见方向稿「说明文字分三层」表。
- **担当色三层**：
  1. 身份：始终开。
  2. 担当主题：侧栏担当行、担当视角人物幕 wash、相关条目前的原色小圆点、事务所默认显示担当。
  3. 舞台光跟随：默认关，只换状态色，不动藏青主操作、难度色、属性色。
  - 不染整页：只有担当视角人物幕和偶像自己的详情页人物幕铺 wash。
  - 多人同时出现时只用圆环。

## 6. 分模块规格

以下只写结论，完整的现状 / 改法 / 手机版见方向稿对应模块。

- **外壳**（`ArchiveShell.vue`、`ArchiveNavigationDrawer.vue`、`archiveSections.js`、`ArchiveDocumentTitle.js`）：
  - 纸面侧栏、担当切换器（第 2 节第 8 条，组件 `ArchiveStageIdolSwitch.vue`）、白片当前项、60px 品牌行。
  - `ARCHIVE_BRAND` 增加 `mark: 'GROWING STARS'`、`sub: 'SideM 资料馆'`；手机外壳显示 mark + sub，不显示 english。
- **事务所首页**（`ArchiveImmersiveHome.vue`）：
  - 右上控台收成三件：「人物与衣装」胶囊（头像 + 当前衣装名）、「立绘 | 卡面」、场景设置。现在 4 个下拉导致偶像名和衣装名被截断。
  - 点胶囊展开 640 宽面板：左列按组合列出全部偶像，全名、可搜索；右列衣装，原生类别做筛选片（数量在片内），图标 + 名称三列。卡面模式下右列换成卡面。
  - 手机：底部面板，分偶像 / 衣装两个标签。
  - 首次引导气泡；台词框用 B 级「原文 | 译文」。
- **资料馆首页**（`ArchivePortalLauncher.vue`、`ArchivePortalOverview.vue`、`PortalAlmanac.js`、`PortalCardBento.vue`）：
  - 标题行：「全站 | 担当头像 + 名字」视角开关。
  - 担当视角：拆掉磁贴，改成数字行；人物幕用色影立绘 + 落款。
  - 全站整页从上到下：
    1. 组合：8 × 2 细线格，logo + 群像头像，去掉 16 种底色。
    2. 卡面探索：不动。
    3. 歌曲 | 剧情：主线两章 + 7 个入口两列文字行，数量右对齐，奇数时补空格。
    4. 315 岁时记：「‹ 10 月 ›」步进代替 12 个月份片；生日用身份环，活动用 300×150 小横幅行。
    5. 目录：通信与图鉴合成一张三列表格，标签列在左，细线贯通。
  - 手机：同顺序，组合 4 × 4。
- **手机导航抽屉**：目录式的行（见第 5 节）；当前项浅底；工具行用「↗」加一行说明。
- **详情骨架**（卡面、歌曲、偶像、活动、组合、卡池、图鉴共用）：
  - 顶栏：返回、面包屑、同类上一条 / 下一条图标钮、A 级语言。
  - 幕：一张图，不加框。
  - 身份区：最多一张控台；下面是 4–8 项的事实条。
  - 分节：宽屏左侧 150–168 放节名，手机节名回到上方。
  - 维护者尾：依据、ID、推定说明，读者默认看不到。
- **卡面详情**：
  - 分节标题栏 168 + 内容列 660。
  - 衣装用途矩阵：行是款式，列是 Live / 剧情 / 主页，单元格写「普通 / 特训 / 突破 / 默认」，空格画「—」。
  - 突破素材独立成节。
  - 上一张 / 下一张移到顶栏；技能演出收成一行「6.9 秒 · 约 1.3 MB」加播放钮。
- **歌曲总览**（`ArchiveSongCatalog.vue`）：60 首分三层上架，编制是分区，不是筛选。
  - 代表曲 5 首：一排大封面。
  - 组合曲 47 首：细线表，左列组合 logo，右边三列正好放这组的 3 首（C.FIRST 2 首，补空格）。
  - 特别编成 8 首：两列，群像头像写出谁唱。
  - 视图：按组合 / 按实装时间（按年份，带首发活动）/ 按曲名。
  - 特性（3DMV 11、MV LIVE 1、分轨演唱 3、Center 台词 2、特殊版本 1）留作筛选片；条目里改成中性细框小标签，不用薄荷。
  - 作词作曲进详情。
- **歌曲详情**（`ArchiveSongDetail.vue`）：
  - 头部三栏：封面 176、身份、播放控台。控台是这页唯一的白底，底部一行「2D 舞台 · 谱面」。
  - 难度：一张细线表，圆点 + 难度名 + 等级 + Combo，整列可点；解锁写在表下。
  - 实装历史、wiki 核对状态进维护者尾。
  - **多版本**（DRIVE A LIVE 等 5 首代表曲）：
    - 「演唱版本」是这页的第一层选择：标签分全员合唱 / 组合版 16 / 自由编成 5 槽 / Solo 49 / 伴奏。
    - 组合版下面是 8 × 2 组合 logo 格，当前项白片。选组合版时 2D 舞台编舞跟着换（16 组各一套）；Solo 与自由编成用 Solo 编舞。
    - 手机：自由编成是 5 个圆位，人按组合排在下面。
    - 特殊版本单独一行：DRIVE A LIVE（パッションMAX Ver.）是 2022 年愚人节限定、2023-04-01 复刻，由齋藤孝司（CV 立木文彦）演唱，PASSION 难度显示「?」。这一行链到它自己的页面和「社长特别演出」。
  - **Center 台词**（precious love、FLASH LIGHT）：
    - precious love 的原曲在 1:00 留白一句，约 3.6 秒，游戏里由编成 Center 补上，共收录 49 人。
    - 进度条上标出这个时刻；控台一行「Center 台词 · 当前人 ▾」。
    - 49 人选择器按组合排，当前人用「当前」环；带「原曲 Center · 伊濑谷四季」和「关闭 · 保留留白」两项。
    - 手机：点控台里的 Center 台词，打开底部面板。
- **偶像详情**：
  - 人物幕铺本人 wash，名字前 3px 原色竖条，立绘色影，签名落款。
  - 顶栏右侧放同组合头像，点了直接切换。
  - 事实条 8 项 4 列；关联资料用两列数字行；称号显示牌面。
- **活动详情**：
  - 头部 KV | 身份，期间写成日期表。
  - 活动剧情是主角：「从第一话阅读」+ 话目两列直接列出。
  - 报酬卡三列。
- **图鉴**：
  - 类别用下划线标签，范围用筛选片。「类别」指道具、称号、货币、服装、摄影资源、其他语音六类，共用一页；类别内部的分类是范围，用筛选片（v8 验收 1 澄清）。
  - 图标直接放在纸面上，不做磁贴；属性写成名字前的小圆点。
  - 详情从右侧拉出 380 抽屉，手机是底部半屏，网格留在原位。
  - 推定关联挂 C 级「推定关联」+ ⓘ。
- **剧情目录**：
  - 主线章节带约 140 高。
  - 活动按上面的 A + B。
  - 组合前传 8 列 logo。
  - 「更多故事」三列文字行。
- **谱面**（等谱面 PR 合入后再做）：
  - 头部一行：曲目 · 难度模式开关 · 透视 / 长轨 · 沉浸。
  - 右侧 292 常驻面板，分观看、声音、演示三组；说明进 ⓘ。
  - Tick、演示事件计数、原生依据进维护者模式。
  - 手机设置是画布下的三个标签页。
- **2D 舞台**（`ChibiStageViewer.vue`、`ChibiSongPicker.vue`）：
  - 编队页依次是站位条 → 当前位置（偶像、衣装）→ 演唱组 → 套服组，组间 24。
  - **曲目页**（v6）：从上到下三块。
    1. 正在演出：封面 56 + 曲名 + 「代表曲 · 20 种编排」，右端声部钮（打开声部与伴奏）。
    2. 编排：多种编排时，先是种类分段（只列有的种类：自由编成 / 组合版 16 / 单人中心 3，Growing Smiles！多一段「教学」），组合版下面是 4 × 4 组合 logo 格，单人中心是 Solo / Solo Multi / Solo Single 三行。下面一行说明：组合名 · 人数 · 槽位 · 编舞来源，「人数未确认」照实写。只有一种编排时这一块收成一行「编排 · Jupiter · 3 人」，没有控件。替换现在 20 项的 optgroup 下拉。
    3. 换一首：搜索 + 一组分段（全部 60 / 代表曲 5 / 组合曲 47 / 特别 8），去掉重复的分类下拉。分类名、组合顺序与歌曲总览同一份：「全部」按三层分组，组合曲按组合加小标题。点一首直接切换，并保留当前编排种类；预载期间整块禁用。
  - 曲目页的选中：当前曲目行、当前组合格都用白底面板里的 `--gs-current-bg-inset`；正在演出的曲目右端是薄荷音柱，替换「当前曲目」文字徽标。
  - 手机：编排收成一行「编排 · 组合版 · Jupiter ›」，点开底部抽屉，内容与桌面同一块；只有一种编排时这一行没有箭头。
  - 加载方式两步：单选卡片，说明一直可见，「记住选择」+「开始加载」。
  - 与舞台衣装分组 PR 合入后做。
- **摄影 / 播放器 / 阅读器**：
  - 摄影：合并成一种布局，素材 | 画布 | 检查器。
  - 播放器：右上「原 | 译 | 双」，缺译文时文字框里显示「仅原文」。
  - 阅读器：左侧 236 目录，当前 EP 用白片；细工具条放 B 级开关；手机浮动条加原 / 译。

## 7. 落地批次

每批一个 `portal/`（舞台模板那批用 `stage/`）分支，从最新 master 开。前后各跑一次 `gallery:capture` 对照；`verify-design-tokens` 只减不增。

| 批 | 内容 | 主要文件 |
|---|---|---|
| P0 | 令牌增量；抽出模式开关、设置行、开关、ⓘ 四个基础件；「白底套白底」计数 | `GS_UI_TOKENS.css`，新组件 GsSegmented / GsRow / GsSwitch / GsInfo |
| P1 | 中/日三级 | `ArchiveLanguageSwitch.vue`、`PlayerLanguageStatus.js`、`ReaderControlBar.vue` |
| P1+ | 站名、纸面侧栏与担当切换器、60px 标题行、选中态白片、头像两种环、色影与落款、`--gs-idol*`、「舞台光」改名 | `archiveSections.js`、`ArchiveDocumentTitle.js`、`ArchiveShell.vue`、`ArchiveNavigationDrawer.vue`、`ArchiveStageIdolSwitch.vue`、`ArchiveIdolAvatar.vue`、`ArchivePortalOverview.vue`、`idolStageLight.js` |
| P1.5（v8） | 外壳校正：标题行一行 60px、面包屑只列上级、返回改墨色；侧栏 208 / 58 可收起、行高三档、图鉴一个入口、组合进侧栏；图鉴六类一页；LIVE 与摄影工作台进入页；浏览器几何验证。在 #106、#107 合入后、P6/P7 剩余之前做 | `ArchiveShell.vue`、`ArchiveBreadcrumb.vue`、`ArchiveBackAction.vue`、`ArchiveStageIdolSwitch.vue`、`archiveRoute.js`、`ArchiveToolLanding.vue`、`ArchiveCollectionCatalog.vue`；规格见验收文档第 2 节 |
| P1.6（v8） | 旧控件替换：原生下拉、复选框、自绘分段换成基础件、人物选择器、筛选菜单；`verify-design-tokens` 加 `select`、`checkbox` 计数 | 验收文档第 4 节 |
| P2 | 模式外置：事务所三件控台 + 人物与衣装面板 + 首次引导；资料馆视角开关；舞台加载两步确认 | `ArchiveImmersiveHome.vue`、`ArchivePortalLauncher.vue`、`ChibiStageViewer.vue` |
| P3 | 谱面功能区（谱面 PR 合入后） | `ArchiveSongChartPreview.vue`、`ArchiveChartLab.vue` |
| P4 | 舞台面板节奏：曲目页、编队页、画面页（#103 合入后，只动模板与样式） | `ChibiStageViewer.vue`、`ChibiSongPicker.vue` |
| P5 | 资料馆首页整页、剧情目录、手机抽屉 | `ArchivePortalOverview.vue`、`ArchiveStoryCatalog.vue`、`verify-portal-bento.mjs` |
| P6 | 详情骨架：卡面 → 歌曲（总览、多版本、Center 台词）→ 偶像 → 活动 → 组合 / 卡池 / 图鉴 | `ArchiveCardDetail`、`ArchiveSongCatalog`、`ArchiveSongDetail`、`ArchiveIdolDetail`、`ArchiveEventDetail`、`ArchiveCollectionCatalog`、`CollectionDetailPanel` |
| P7 | 摄影、播放器、阅读器 | `PictureStudio.vue`、`PlayerTopBar.vue`、`ReaderWorkspaceControls.vue` |

## 8. 做样例时核过的数据

- **偶像中文名规范**：天濑冬马（不是「天瀬」）。49 人中文名见 `src/presentation/ChibiIdolSearch.js` 注释；代表色见 `public/data/masterdata/idol_unit_dictionary.json`。
- **冬马的衣装**共 15 套：个人服装 6、常服 / 剧情服 4、全员套服 2、组合套服 2、属性套服 1（`src/data/costumeCategories.json`）。グローイングブライティ归全员套服。
- **歌曲编制**（`public/data/song_catalog.json` 的 `performance_mapping.performer_scope`）：
  - `configurable_formation` 5 首。
  - `fixed_unit` 47 首。
  - `fixed_special_lineup` 7 首 + `unspecified_special` 2 首。后者是 Reason!! 和特殊版本 drv999；drv999 不计入 60 首作品。
- **分轨歌曲**：分轨演唱 3 首（`audio_form: layered`）：DRIVE A LIVE、Beyond The Dream、Growing Smiles！。
  - DRIVE A LIVE 的分轨在 `public/data/song_experimental_audio.json`：16 条组合轨、49 条 Solo、伴奏、全员混音，`special_tracks` 是 drv999。
  - 编舞变体 19 套，在 `choreography.live_effect_variants`。
- **舞台曲库**（`buildStageSongLibrary`，输入 `public/data/stage-choreography-shards.json` + `song_catalog.json`）：60 首，分类 collective 5 / unit 47 / special 8。
  - 多种编排的只有 3 首：DRIVE A LIVE、Beyond The Dream 各 20 种（自由编成 1 + 组合版 16 + 单人中心 3），Growing Smiles！21 种（多一套教学编排）。Take a StuMp! 01 / 02 虽归 collective，各只有 1 种。
  - DRIVE A LIVE 的舞台时长 125.1 秒（`duration` 125100，`startTime` −2000），和音频 2:10.3 不是一回事。
- **Center 台词**：`public/data/song_oneshot_voices.json`。
  - precious love 的 `triggers` 是 60000 ms、`deck_slot` 1，49 条 clip 各约 3.6 秒。
  - 原曲站位：四季、涟、直央、克里斯。
  - 时长：precious love 2:03.6；DRIVE A LIVE 2:10.3。
- **现状截图**：
  - 首页：主 checkout `.analysis/story_hub_tier_1366.png`。
  - 歌曲页与其他页：`web_viewer/.analysis/gallery/audit-20261024-readonly/`。

## 9. 验收与边界

- 代码检查只用 `npm run build:check`，不要直接 vite build（会拷 8 GB 语料进 dist）。`build:check` 会改写 `config/resource-audit.json`，不要提交。
- 合并前在 LF 干净检出跑 `npm run gate:source`：
  - 建检出：`git -c core.autocrlf=false -c core.eol=lf worktree add --detach <目录>`，`node_modules` 用联接。
  - 主 checkout 带语料又是 CRLF，会把 CI 红项跑绿。
  - 可复用的 LF 检出：`E:/Web_build/GS_Archive_Domain_Work/gate-retire-lf`，游离 HEAD，`node_modules` 已联接到主 checkout。
- 新增 PNG 要在 `scripts/lib/tracked-binary-inventory.mjs` 有分类，然后跑 `npm run generate:tracked-binary-inventory`；`public/data/archive_baseline_report.json` 的 `tracked_binaries` 也要同步。音频、视频、大图不进 Git。
- 改到画面的批次必须做 Browser 实测，桌面加 390px 手机。Claude 会话的沙盒里 Chrome 起不来；放行到沙盒外后，Playwright 缓存里的 `chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe` 可以起（CDP 截图可用，节目册 v6 就是这样核的），完整版 `chrome.exe` 仍起不来。也可以在 Codex 窗口验收。
- 不 push master，不 rebase / force push 已推送分支；只暂存自己 commit 的具体路径（另一会话共用暂存区）。合并 master 不等于部署，部署要用户明确授权。
