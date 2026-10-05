# GS Archive UI 交接（2026-10-05）

接手这份工作的新窗口先读本文件，再读 `docs/GS_UI_CONSTITUTION.md` 的「视觉语言（2026-10-05 起生效）」一节。设计方向（「节目册」）、令牌、导航结构都已由用户确认，**不要重新讨论方向，直接按页面推进**。

---

## 0. 当前状态

- 分支 `codex/portal-architecture-cleanup-20261004`，HEAD `b3e17754`，与远端一致。
- 工作区唯一的改动：`public/translations/zh-CN/archive-general/skills.json` 显示为已修改，**内容和已提交版本相同，只是换行符不同**（`git diff --ignore-cr-at-eol` 为空）。要么跑一次 `node scripts/generate-archive-general-translations.mjs` 让它回到 LF，要么不管它。**不要**用 `git checkout` 还原这个文件：git 会把它写成 CRLF，译文发布清单的哈希随之变化，`build:check` 会失败。
- 全量检查脚本基线：**39 个失败**，都需要额外参数、Node 实验特性、playwright 或已发布的 release，跟 UI 无关。名单见 §6。每次全量跑完都要比对这份名单，新增的才算回归。

### 本轮已完成（不要重做）

| 提交 | 内容 |
|---|---|
| `1a2c10a7` `453ddfa9` | 阅读器默认主题、播放器强调色改为资料馆令牌；播放菜单改为细线行 |
| `8aff092c` | 属性统一为 Physical / Intelli / Mental（中心技能名 `Physical Groove Ⅱ`；技能描述按用户提供的参考译法生成）；收藏页的中文属性别名已删除 |
| `153d8a1c` | 收藏拆为 道具 / 称号 / 摄影 三个入口；两种目录重做排版；不再显示「来源摘要暂不可用」 |
| `9ff21afc` | 卡面内页改为「展台」：竖图普通、特训后两张并排；只有一张图的卡片图在左、标题在右；SSR 显示横图，可切到竖图；手机上左右滑动 |
| `a40e78ef` | Vite 重新监视 `public/translations` 和 `public/data/editorial`（被当作模块导入的 JSON），其余 `public/` 仍忽略 |
| `b3e17754` | 新访客直接进资料馆，弹出三步引导（P 名字 → 担当 → 去见担当 / 先逛资料馆）；旧的「下次打开哪里？」页面退役，`?view=welcome` 改为打开设置页 |

更早的批次（死代码清理、开发者口吻文案、加载状态、令牌、设计系统第 1–5 阶段）都已提交。

---

## 1. 工作方式（踩过的坑）

- **App.vue** 只能用 Read / Grep 读取，用 Edit 修改。用户明确禁止用 sed、awk、node 脚本读它。
- 仓库文件是 **CRLF**。用 node 写字符串替换时，锚点里的 `\n` 会匹配失败：先 `replace(/\r\n/g,'\n')`，改完再还原；或者直接用 Edit 工具。
- 新写的检查脚本**必须做变异测试**：把修复改回坏版本，确认脚本真的失败，再还原（用 Edit 还原；在 Windows 上 `cp` 回去会报权限错误）。
- 设计令牌是**只减不增**的棘轮：`node scripts/verify-design-tokens.mjs`。改善后用 `--update` 锁定。不允许新增写死的字号（最小 12px）、十六进制颜色、圆角。圆角只能用 `var(--gs-radius-*)`，`0`、`50%`、`inherit` 除外；多值写法不在白名单里，要拆成单角写法。
- 全量跑检查脚本会改写 `public/data/archive_verification.json`，跑完要 `git checkout -- public/data/archive_verification.json`。
- `verify:entry` 绑定当前 HEAD：每次提交后要先跑一次 `npm run build:check`。
- 提交信息结尾加 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。**不要推送**，除非用户要求。

### 本地预览环境

```bash
# 1. 本地 read-model（已存在就跳过）
node readmodels/tools/build_readmodels.mjs --repo /e/Web_build/SideM_Archived --out <scratch>/rm-candidate \
  --data-revision c5ab806ee57778bc387322acfcf5211ecdf0521721a6df279dbe52a6e006e5b9 --media-epoch local-dev
# 2. 开发服务器（冷启动约 1 秒）
SIDEM_READMODEL_CANDIDATE=<scratch>/rm-candidate npx vite --configLoader native --port 5175 --strictPort
# 3. 页面截图集（桌面 1280 + 手机 390，52 张）
npm run gallery:capture -- <label>     # 输出 .analysis/gallery/<label>/
```

- 截图集用的是全新浏览器配置，现在 `app-portal` 会被**新手引导盖住**。修法：截图前预置 `localStorage['sidem:archive-user-preferences'] = {"version":3,"startupPage":"portal","onboardingComplete":true,...}`。另加一张专门截引导的场景。见 §3 第 0 步。
- 单页截图和交互探针：在本机缓存的 chromium（`~/AppData/Local/ms-playwright/chromium-1234`）上，用 Node 自带的 WebSocket 走 CDP，需要 `--use-angle=swiftshader`。
- 本地数据的 release 和已发布的不同。因此 `verify-portal-bento`、`verify-portal-directory-navigation`、`verify-portal-projections`，以及称号来源摘要在本地都拿不到，这**不是回归**。

---

## 2. 设计规则速查

- 令牌：`src/styles/GS_UI_TOKENS.css`。
  - 颜色：`--gs-ink/-2/-3`、`--gs-line`、`--gs-paper`、`--gs-surface`、`--gs-mint`、`--gs-mint-ink`、`--gs-mint-wash`、`--gs-attr-physical/intelli/mental`。
  - 字号阶梯：12 / 13 / 14 / 16 / 20 / 28 / 40。
  - 圆角角色：media 4、control/field 8、panel/surface 12、pill。
  - 间距：`--gs-space-section` 48。字体：舞台字 `--gs-font-stage`。
- 版式原则：
  - 东西直接放在纸面上，用细线分隔，**不加盒子**。
  - 统计数字不用格子，改成句内的「足迹」链接。
  - 页面不要英文眉标（`SONG ARCHIVE` 这类）。
  - 筛选标签：选中时填墨色；数字用小号灰字。
  - 维护者才需要的信息放进 `?maintainer=1`。
- 已完成的样板页可以照抄：`ArchiveCardDetail.vue`、`ArchiveSongCatalog.vue`、`ArchiveCardList.vue`、`ArchiveCollectionCatalog.vue` 加 `src/styles/archive-collection.css`、`ArchivePortalOverview.vue`。

---

## 3. 下一步（按顺序）

外部审阅给了 5 项，用户又补了一大块：**资料馆在手机上文字挤压、水土不服**。手机问题横跨所有页面，所以先立规则（第 0 步），之后每一页都按桌面和手机两种宽度一起验收。

### 第 0 步：手机端基础规则与断点统一 ✅ 已完成

- 三档断点、`@container` 分工、五条手机通用模式已写进 `GS_UI_CONSTITUTION.md`「断点」「手机端通用模式」两节。
- `verify-design-tokens.mjs` 新增 `breakpoint` 指标（三档以外的 `@media` 宽度，只减不增），已做变异测试。
- 只向上收拢了 46 处（699/700/680/720→760、min 700→761、1050/1099→1100、min 1100→1101），`StoryViewer.vue` 的 JS 判断同步改为 760。剩余 86 处（780/800/900/560/620……以及 Chibi、摄影、终端样式）在各页改造时改写为 `@container`，见下面各步。
- 截图集：预置「已完成引导」偏好；新增 `app-onboarding`；宽度改为 1280 / 768 / 390 三档（81 张）。

原始要求（留作对照）：

1. **断点收为三档**。现状是 178 处断点，分散在 30 种数值上（760×47、700×25、900/699/560/620 各约 15……）。
   - 手机 ≤760（侧栏变底部导航的位置）、中屏 761–1100、宽屏 >1100。
   - 组件内部排布改用 `@container`。
   - 在 `verify-design-tokens.mjs` 里加一个只减不增的「写死断点」指标。
2. **手机端通用模式**写进 `GS_UI_CONSTITUTION.md`：
   - **工具栏**：一行搜索框，加一个「筛选」按钮打开底部弹层，放全部筛选。不要在首屏堆 3 个下拉框，也不要堆带标签的表单块。
   - **统计数字**：不做格子，最多一行灰字「59 个活动 · 38 段关联剧情」，或者干脆不显示。
   - **标签条**：横向滚动、单行、最小高度 44px；选中项滚入可视区。
   - **列表行**：缩略图 56–64px，标题两行截断，元信息一行。
   - **页面首屏**：返回加标题的顶栏之后，第一屏应该看到内容，不应该先是统计或说明文字。
3. **修好截图集**：预置引导完成的偏好，并新增 `app-onboarding` 场景；再加一档 768 宽度。

### 第 1 步：故事系列 ✅ 已完成

- 新增共用样式 `src/styles/archive-story.css`（`.story-page` 容器 + 页头 / 足迹句 / 图块 / 细线行 / 筛选标签 / 操作按钮），排布全部走 `@container story-page`。目录、合集、工作剧情、季节活动都已接入；后续页面可以照用。
- 分类首页：统计格子改为足迹句，内容区不再重复顶栏标题（h2 仅供读屏）；章节是「图 + 下方标题」，额外 / 生日 / 更多故事都是细线行；生日偶像名走译名（`idolName`）。
- 合集页：收起的话只是一行，展开后才有「阅读本话 / 连播演出」；操作说明删除；简介去掉底色盒子，只留 2px 舞台光引线；「正文未生成」改为「暂无文字版，可观看演出」；生日合集标题走译名（App 新传 `:idol-name`）。
- 工作剧情：偶像下拉框在真实应用里正常，空白只是画廊没传 `idols`（已补）；「场景名称未收录」不再显示；盒子卡改细线行；「收录概况」四格改为足迹句；名字走译名。
- 季节活动：四格统计改为足迹句（背景音乐收录状态删除）；「共通导入」改为列表首行；年份 / 季节 / 角色类别用统一筛选标签。
- 检索：结果行去掉盒子和左侧彩条，手机保留 56px 缩略图；`StoryDiscovery` 的说明行改用 `presentIdolEpisodeLabel`（原先目录里唯一的调用是死代码，检查脚本名单随之改为 `StoryDiscovery.vue`）。
- 遗留：剧情详情（`ArchiveStoryDetail.vue`）只删了 `CAST` 眉标，简介带与信息表还是旧样式；季节活动的参与者名单没有偶像代码，仍显示原名；工作剧情顶栏标题来自路由，仍是原名；生日合集里「个人故事共享入口」等话目标签来自数据层。

原始问题清单（留作对照）：

文件：`ArchiveStoryCatalog.vue`（536 行，包含主线、额外、生日各分类首页）、`ArchiveStoryCollection.vue`、`ArchiveStoryDetail.vue`、`StoryDiscovery.vue`、`EventStoryCard.vue`、`ArchiveWorkStory.vue`，以及 seasonal 场景。

截图看到的问题（手机，`.analysis/gallery/handoff-0105/`）：

- **统计格子**：主线「章节 3 / 正式话目 22 / 剧情分段 204」、生日「档案组 51 / 剧情记录 181 / 关联个人故事 29」、额外「官方作品 7 / 剧情章节 47 / 收录分段 44」、季节活动的 4 格。全部改为足迹句子或删掉。
- **故事首页「更多故事」**是带底色的 2 列卡片矩阵（卡片剧情 342、个人故事 49……）：改成细线目录行。
- **章节卡**：大图加白框，再加「主线」眉标、「查看章节」页脚，层级重复。改成图带标题的简洁卡，或图在左的行。
- **合集页**（`story-collection`）：
  - 「正式话目 11/11 · 剧情分段 102/102」，开发者口吻。
  - 每话都有两个大按钮「阅读本话 / 连播本话」，再加一个带底色的「简介」盒子。
  - 「点击 EP 阅读并定位剧情，▶ 播放演出。……剧情播放器为实验功能。」操作说明。
  - 「EPISODE 01 · 正文未生成」直接暴露技术状态。
  - `PROLOGUE` / `EPISODE` 是照搬游戏的写法，保留；但「正文未生成」这类文字要换成读者能懂的说法，或者干脆不显示。
- **生日首页**：每位偶像一张盒子卡，外加「1 篇关联个人故事」紫色徽章；偶像名显示日文原名（`天ヶ瀬 冬馬`），应和其他页一致走译名。
- **工作剧情**（`work-story`）：
  - 顶部偶像下拉框**显示为空**（疑似 bug，先查清楚）。
  - 图上叠着「场景名称未收录」：改成不显示。
  - 图在左的盒子卡，配红色播放圆钮：改成细线行。
- **季节活动**（seasonal）：4 格统计；「共通导入」底色块；角色剧情列表本身还行。

### 第 2 步：清理 `archive-terminal.css`，迁移设置页与偶像选择页 ✅ 已完成

- `src/styles/archive-terminal.css` 已删除。其中约一半规则（模式卡、应用图标、眉标、签名等）早已无人使用；其余搬回各自组件：
  - 共用对话框 `ArchiveTerminalDialog.vue` 自带样式（浮层：表面底色、面板圆角、`--gs-shadow-float`，类名 `.terminal-dialog*` / `.terminal-icon-button` 作为合同保留，小人舞台、摄影、歌曲 Solo、壁纸各自的 `:deep` 覆盖照旧生效）。此前门户的「切换视角」对话框从未自己导入样式，全靠别的页面先加载过终端样式表。
  - 壁纸背景 `ArchiveTerminalBackdrop.vue` 自带样式，未选壁纸时不渲染（「315」中性底图退役）。
  - 壁纸选择器重写为一套令牌化样式（原先两套规则叠加）。
- 偶像选择器 `ArchiveIdolPickerPanel.vue` 统一为「搜索 + 组合标签 + 按组合分组的头像」一种形态，令牌化；`compact` 属性与列表形态删除，引导里的 `:deep` 覆盖删除。新增 `npm run verify:idol-picker`（已做变异测试）。
- 偶像选择页（`ArchiveWelcome` 选择部分）：纸面页面，底部固定确认栏；不再有壁纸与「SideM ARCHIVE」品牌头，壁纸入口只在门户。
- 设置页：标题「制作人设置」，分组标题 + 细线设置行；通行证卡、渐变、`315 PRODUCTION / LOCAL ARCHIVE` 删除；导出 / 导入 / 重置移到最后的「本地备份」分组，手机首屏就是设置内容。
- `ArchivePreferredIdolSlot.vue` 是死组件，已删除（`verify-terminal-idol-localization` 中对应的几行一并删除；该检查仍因偶像详情 h2 的色点 span 与仅维护者可见的证据块而失败，属基线）。

原始要求（留作对照）：

现在引导已经替掉旧启动页，是清理「终端」旧样式的最佳时机。

- 179 行的 `src/styles/archive-terminal.css` 还被这些文件用到：`ArchiveWelcome.vue`（只剩偶像选择）、`ArchiveProducerSettings.vue`、`ArchivePhotoDetailDialog.vue`、`ArchiveSongExperimentalPlayer.vue`、`ArchiveOnboarding.vue`（为了复用选择面板）、`terminal/*`（IdolPickerPanel、PreferredIdolSlot、TerminalBackdrop、TerminalDialog、WallpaperPicker）、`ChibiIdolPicker.vue`、`ChibiStageViewer.vue`、`data/terminal/terminalMedia.js`。
- **设置页**（`ArchiveProducerSettings.vue`，`?view=welcome`）：
  - 现在是渐变背景，加「315 PRODUCTION / PRODUCER PASS」通行证卡、虚线、`LOCAL ARCHIVE · 315` 这类装饰性英文。
  - 改成资料馆的普通页面：分组标题，加细线隔开的设置行。
  - 手机上目前「返回来源页 / 导出 / 导入」三个按钮占掉首屏。
- **偶像选择页**（`ArchiveWelcome` 的选择部分，以及 `terminal/ArchiveIdolPickerPanel.vue`）：给主页、通信、个人故事挑偶像时出现，仍是终端加壁纸的风格，要改成资料馆风格。
  - 选择面板的紧凑模式（按组合分组的头像）在引导里表现不错，可以作为统一的选择器。
  - 它的样式写死在组件里（`#d9e5e8`、11px 等），要令牌化。引导里对它的 `:deep` 覆盖到时可以删掉。
- 先确认终端样式里哪些规则已经没有任何组件用到，删掉；剩下的迁进各组件自己的样式。

### 第 3 步：其余目录页的手机扫尾 ✅ 已完成

- 新组件 `ArchiveFilterSheet.vue`：宽屏时筛选控件照常内联；手机（≤760）收成「筛选」按钮（显示已生效条件数），点开是贴底弹层（复用共用对话框）。控件只写一份。卡片列表、活动目录已接入，其余目录页照用。
- 卡片列表：属性 / 资源 / 关联进弹层；稀有度标签单行横滑；行内 🎙/📖 图标改为「N 段语音 · N 篇剧情」，0 不显示。
- 卡池目录：四格统计改为足迹句「82 个卡池 · 61 条公告」（新卡关联、道具补录不再显示）；「82/82」仅在筛选后显示结果数；类型徽章改为灰字；手机为 96px 横幅缩略图的细线行。
- 活动目录：三格统计改为足迹句（保留「—历史活动」「N 条结果」「结果暂不可用」等文案合同）；搜索一行 + 弹层（活动形式、排序）。
- 偶像目录：组合不再是带彩色顶边与阴影的盒子，改为「标题 + 墨线 + 细线成员行」；手机成员名 14px；「全部组合（16）」改为统一小标签。
- 通信：头图保留（`verify-story-player-ui-pr2` 守护其结构）但去掉深色遮罩，身份与选择器移到图下纸面；类型标签中文化；去掉「已收录 · N 项解锁记录」；开放条件不再逐条装盒（可跳转的是链接，其余为灰字）；播放钮无边框；计数为 0 的标签页隐藏；随机话题说明与统计改为引线说明一行。
- 卡池详情：公告阶段移入技术详情；「站外原始记录」小字删除（`ArchiveSourceLink` 共用，活动详情同时受益）；「推定关联 · 4」改为灰字「4 张 · 推定关联」；每行的「卡池 Pickup 已建档」删除（`ArchiveRelationList` 的标签行改为有内容才渲染）。
- 歌曲详情：「当前主数据：已开放」由数据生成脚本写入 58 首歌，展示层改为「无需解锁」（有真实解锁条件的 3 首照旧显示条件）；日期降为 13px 灰字。
- 活动详情：故事简介去掉底色块，改为 2px 舞台光引线；外壳手机顶栏标题改为最多两行，不再省略截断。
- 遗留：通信页顶栏标题「Mobile 通信」来自路由命名；歌曲播放器卡片属第 4 步。

原始问题清单（留作对照）：

| 页面 | 问题 | 文件 |
|---|---|---|
| 卡片列表 | 偶像切换器下面一行挤了 3 个下拉框（全部属性 / 全部卡片 / 全部关联），字被截；行内 `🎙1 📖0` 图标含义不明 | `ArchiveCardList.vue` |
| 卡池目录 | 4 格统计（卡池记录 / 公告记录 / 新卡关联 / 道具补录，后两个是开发者词汇）；标签条右侧「82/82」挤压 | `ArchiveGashaCatalog.vue` |
| 活动目录 | 3 格统计；搜索、活动形式、排序做成 3 个带标签的表单块，占掉首屏三分之一 | `ArchiveEventCatalog.vue` |
| 偶像目录 | 组合卡是带彩色顶边的盒子，成员 2 列，名字很小；「全部组合（16）」大胶囊 | `ArchiveIdolGrid.vue` |
| 通信 | 深色头图；`IDOL TALK / PHONE CALL / UNIT TALK` 英文标签（`kindLabel()`，第 262 行）；带底色的卡名徽章；「已收录 1项解锁记录」；锁定条件逐条装盒；红色播放圆钮；「组合聊天 0」空标签页 | `ArchiveMobileArchive.vue` |
| 卡池详情 | 「公告阶段 主公告」「站外原始记录」「推定关联 · 4」，以及「卡池 Pickup 已建档」每行重复 | `ArchiveGashaDetail.vue` |
| 歌曲详情 | 播放器是带阴影的卡片；「当前主数据：已开放」开发者口吻；「2021-10-06 实装」挤在属性行 | `ArchiveSongDetail.vue`，播放器见第 4 步 |
| 活动详情 | 顶栏标题被截断；故事简介是底色块 | `ArchiveEventDetail.vue` |

### 第 4 步：歌曲谱面与播放器系列

把「工程工具」升级为统一的音乐工具 UI。

- 文件：`ArchiveSongSinglePlayer.vue`、`ArchiveSongLineupPlayer.vue`、`ArchiveSongExperimentalPlayer.vue`（仍在用终端样式）、`ArchiveSongChartPreview.vue`、`ArchiveSongChartSlice.vue`、`ArchiveSongLongPreview.vue`、`ArchiveSongTrackPreview.vue`、`ArchiveSongLyrics.vue`、`ArchiveChartLab.vue`。
- 统一一套播放条：
  - 播放 / 进度 / 时间 / 音量作为一个组件，嵌在纸面上，不做浮起的卡片。
  - 「实验」「解码」「AudioContext」这类说明移进维护者模式。
- 相关检查脚本在基线里本来就失败（song-* 若干，需要浏览器或 HTTP 环境）。改动前先读这些脚本的断言，避免破坏它们真正守护的东西。

### 第 5 步：小人舞台、Spine、摄影工作台

为沉浸式工具单独定一套界面规则，**不要直接套节目册版式**。

- 文件：`ChibiStageViewer.vue`（3996 行）、`ChibiIdolPicker.vue`、`ChibiSongPicker.vue`、`SpineViewer.vue`、`SpineStage.vue`、`PictureStudio.vue`（705 行）。
- 先写规则再动手：
  - 深色画布。
  - 浮层面板统一用 `--gs-shadow-float`，圆角用 surface 角色。
  - 工具条统一用图标按钮加提示，热区 44px。
  - 侧栏 / 底部抽屉的切换和播放器菜单保持一致（播放菜单已改为细线行，可作参考）。
- 只对齐外壳和浮层，不改交互。

### 第 6 步：偶像主页

保留游戏主页的身份（立绘、台词、语音），只收拾外围的界面元素：顶部按钮、语音字幕、切换器的令牌化。文件：`ArchiveImmersiveHome.vue`（698 行）、`ArchiveCardHomeStage.vue`。

### 长尾

- 设计令牌剩余：545 处写死字号（171 处小于 12px）、2025 处十六进制颜色、405 处写死圆角。随各页改造顺手减少，播放器和小人舞台占大头。
- 门户顶部背景图（`.archive-portal-backdrop`）在手机上复查是否太抢眼。
- 引导的第 3 步写的是「他」：如果以后有女性制作人或非偶像角色，再改措辞。

---

## 4. 待用户决定（不要擅自做）

1. **活动剧情立绘的「待核对候选图」功能**：`rawCandidateUrl` 参数一直没传，功能实际未接通。建议删掉死代码；如果用户还要用，就接回，并只在维护者模式下生效。
2. **服装名混用**：「精神阳光黄 / 理智耀眼蓝 / 激情闪烁红」是审校过的译文，属性词不统一。是否改为 `Mental阳光黄` 这种写法，由用户决定。

---

## 5. 每一步的验收

1. 桌面 1280、中屏 768、手机 390 都截图（`npm run gallery:capture`，或单页探针），首屏不能有截断、横向滚动或堆叠的表单。
2. 跑相关检查脚本，加 `node scripts/verify-design-tokens.mjs`（再加 `--update` 锁定改善）。
3. 全量检查脚本对照 §6 的名单，没有新增失败；跑完还原 `archive_verification.json`。
4. 跑 `npm run build:check`；提交后再跑一次，满足 `verify:entry`。
5. 新加的检查脚本做变异测试。

## 6. 基线失败名单（39 个，均为环境依赖）

```
verify-archive-build-audit verify-archive-loading-copy verify-archive-startup-route verify-card-costume-presentation
verify-chibi-foot-lighting verify-chibi-song-picker verify-current-archive-baseline verify-engineering-lifecycle
verify-episode-artifacts verify-event-catalog-navigation verify-event-view-consumer verify-external-story-resource-ui
verify-extra-story-visuals verify-home-lipsync-http verify-idol-communication-readiness verify-idol-navigation-ux
verify-ipad-collection-repair verify-local-story-strict-schema verify-photo-catalog-navigation verify-portal-bento
verify-portal-directory-navigation verify-portal-projections verify-preview-data-http verify-preview-http
verify-preview-incremental-http verify-song-chart-png-browser verify-song-detail-presentation verify-song-domain-landing
verify-song-experimental-http verify-song-lyrics-presentation verify-song-music-transport verify-song-playback-audio
verify-song-timelines verify-story-player-ui-pr2 verify-structured-gzip-http verify-studio-work
verify-terminal-idol-localization verify-translation-strict-v2 verify-voice64-http
```

其中有些只要加 `--experimental-vm-modules` 就能通过（例如 `verify-song-detail-presentation`），有些需要 `vm.SourceTextModule` 或真实浏览器，有些需要已发布的 read-model 根目录。
