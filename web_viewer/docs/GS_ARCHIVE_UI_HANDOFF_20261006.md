# GS Archive UI 交接（2026-10-06）

接替 `GS_ARCHIVE_UI_HANDOFF_20261005.md`（旧文件保留作历史）。新窗口先读本文件，再读 `docs/GS_UI_CONSTITUTION.md` 的「视觉语言」一节（含 2026-10-06 新增的角色令牌与担当舞台光）。设计方向（「节目册」）、令牌、导航都已由用户确认，**不要重新讨论方向**。

---

## 0. 当前状态

- 分支 `codex/portal-architecture-cleanup-20261004`，HEAD `e9ab659d`，**领先远端 2 个提交**（`51cbc5e0`、`e9ab659d` 未推送；用户没要求推送就不推）。
- 工作区：`public/translations/zh-CN/archive-general/skills.json` 显示已修改，只是换行符差异。**不要 `git checkout` 它**（会写成 CRLF，`build:check` 失败）；不管它即可。
- 全量检查基线：**293 个脚本，39 个失败**，名单见 §6，全是环境依赖。新增的才算回归。
- **正在等用户决定**：故事目录「分类入口」的节奏重排（§3 第 7 步）。用户选方案之前不要实现。

### 主线进度（全部已提交，不要重做）

| 步骤 | 提交 | 内容 |
|---|---|---|
| 0 | `d49d19cd` | 三档断点 760 / 1100；组件内部用 `@container`；截图集 |
| 1 | `cb54c983` | 故事系列页；共用 `src/styles/archive-story.css` |
| 2 | `10c32be2` | 删除 `archive-terminal.css`；设置页、偶像选择页成为资料馆页面 |
| 3 | `36c48526` | 其余目录页手机扫尾；新组件 `ArchiveFilterSheet`（手机底部抽屉筛选） |
| 4 | `594b13d1` | 歌曲播放器贴纸面；谱面工具内选曲（`ArchiveChartSongPicker`，`chart_lab` 无需歌曲参数） |
| 5 | `558db52e` | 小人舞台 / 小人动作 / 摄影工作台共用沉浸式外壳 |
| 插入 | `5c12656c` | **配色降噪**：用户嫌墨色实心块刺眼。组件按角色取色（见 §2），`verify-design-tokens` 禁止 `--gs-ink` 做底色 / 边框 / 阴影 |
| 插入 | `51cbc5e0` | **担当舞台光**：设置「跟随担当配色」（默认关）；`ArchiveErrorNote` 错误带图标；`verify-idol-stage-light` |
| 6 | `e9ab659d` | 偶像主页外围令牌化（`archive-home-day.css`），身份元素（立绘、台词、语音、绿色名牌）不动 |

预览画布（用户看过、已定稿的留作参照）：
- 沉浸式工具外壳：https://claude.ai/artifact/SbNM7A24EYn4Seow8AKeog
- 配色降噪 + 担当色压力测试：https://claude.ai/artifact/5NWakKgBbgVeXbJdKrxiNZ
- **故事页节奏（待选）**：https://claude.ai/artifact/BTCULSVpLAYU7S8oaauXfB

---

## 1. 工作方式（踩过的坑）

- **用户偏好**：大的视觉改动先出 Design 画布预览（现在 vs 方案，用真实资源），用户点头再实现。工具类功能（谱面、小人舞台）在工具内部选曲，不跳去歌曲页。
- **App.vue** 只能用 Read / Grep 读、Edit 改；禁止 sed / awk / node 脚本碰它。
- **`verify-archive-home` 会把 App.vue 里 `const archiveStats = computed(` 到 `const idolPickerLabel = computed(` 之间的代码放进 vm 沙盒执行**（沙盒里没有 `watch`）。新代码别插在这一段里。
- App 有「资料归属」监听（view → owners 名单），会释放不在名单里的页面数据。新增使用歌曲 / 卡片数据的页面必须加进名单。
- 仓库文件是 CRLF；node 做字符串替换先归一化 `\r\n`，或者直接用 Edit。
- 新检查脚本**必须变异测试**：把修复改回坏版本确认失败，再用 Edit 还原。
- 设计令牌棘轮只减不增：`node scripts/verify-design-tokens.mjs`，改善后 `--update` 锁定。字号最小 12px，圆角只用 `var(--gs-radius-*)`，`--gs-ink` 只能当文字色。
- 全量检查会改写 `public/data/archive_verification.json`，跑完 `git checkout -- public/data/archive_verification.json`。**全量检查运行中绝不能 `git stash`**（污染结果，并把 skills.json 写成 CRLF）。
- `verify:entry` 绑定 HEAD：每次提交后再跑一次 `npm run build:check`。
- 提交信息结尾加 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。不推送，除非用户要求。

### 本地预览环境

```bash
# 开发服务器（read-model 候选目录已在上个窗口的 scratchpad 里；不在就按旧交接 §1 重建）
SIDEM_READMODEL_CANDIDATE=<scratch>/rm-candidate npx vite --configLoader native --port 5175 --strictPort
# 截图集：桌面 1280 / 中屏 768 / 手机 390，共 81 张，每张 60s 超时
npm run gallery:capture -- <label> > <log> 2>&1     # 输出 .analysis/gallery/<label>/；别接 | grep，会被缓冲
```

- 截图集**不含偶像主页**；主页要用单页探针截：`/?view=home&home_idol=001tom`，在 localStorage 偏好里设 `homeMode: 'spine' | 'card'`。
- 单页探针：本机缓存的 chromium（`~/AppData/Local/ms-playwright/chromium-1234`），用 Node 自带的 WebSocket 走 CDP，加 `--use-angle=swiftshader`。用 `Page.addScriptToEvaluateOnNewDocument` 预置 `localStorage['sidem:archive-user-preferences']`，测担当色时加 `preferredIdol` 和 `stageLight: 'idol'`。
- 故事目录在 `.archive-content` 内部滚动，整页截图会在「组合前传」处截断；量高度用 `.story-portal > section` 的 `getBoundingClientRect()`。
- 本地 release 和已发布的不同，`verify-portal-*` 等在本地拿不到数据，不是回归。

---

## 2. 设计规则速查

- 令牌：`src/styles/GS_UI_TOKENS.css`。
  - 基础色：`--gs-ink/-2/-3`（只做文字）、`--gs-line`、`--gs-paper`、`--gs-surface`、`--gs-mint` / `-ink` / `-wash`、`--gs-attr-*`、`--gs-critical`。
  - **角色令牌（组件只用这些上色）**：
    - `--gs-selected-bg/-ink/-line`：选中的标签 / 分段 / 行，即薄荷浅底 + 薄荷字 + 薄荷边；下划线式标签只用 `-line`，字仍是墨色。
    - `--gs-action-bg/-ink`：柔和藏青 #2E4166，每屏唯一主按钮和数量角标。
    - `--gs-play-bg/-ink`：薄荷底墨色图标的播放钮。
    - `--gs-rule`：#C9CED8，分节标题下的线。
  - 字号阶梯 12 / 13 / 14 / 16 / 20 / 28 / 40；圆角 media 4、control/field 8、panel 12、pill。
- **担当舞台光**：`src/presentation/idolStageLight.js` 只取担当色的色相，按角色固定亮度和彩度生成三档，写在**根元素**的 `--gs-mint*` 上（角色令牌在 `:root` 求值，挂在子元素上无效）。无色相的担当（近黑、灰）用银色。侧栏只出现实色：顶部 3px 灯条 + 担当头像环；**不要在藏青上叠半透明光晕**（用户否决：显脏）。
- 错误提示一律用 `ArchiveErrorNote`（图标 + 文字），不能只靠红色。
- 版式：东西直接放纸面上，细线分隔，不加盒子；统计改成句内「足迹」；不要英文眉标；维护者信息进 `?maintainer=1`。
- 浮层只有一种：白色 surface + `--gs-radius-panel` + `--gs-shadow-float`；遮罩 `rgb(11 20 36 / 70%)`。

---

## 3. 下一步

### 第 7 步：故事目录「分类入口」的节奏（等用户选方案）

用户反馈：活动剧情的大图数量多、占比大，视觉动线被拉长；组合剧情被压成很扁的一条。要求结合实际资源重新编排。

**实测**（1280 宽，`ArchiveStoryCatalog.vue` 的 `.story-portal`）：

| 区块 | 高度 | 内容 |
|---|---|---|
| 主线 | 276px | 2 张 |
| 更多故事 | 208px | |
| 活动剧情 | 770px | 6 张 KV |
| 组合前传 | 204px | 16 张横幅，横向轮播，只露 4 张，每张约 80px 高 |

**可用资源**：
- 活动（`public/data/editorial/event-resource-graph.json`，有剧情 38 部，原创 36，其余为复刻）：
  - `storyCover`：KV，1800×960
  - `hero`：首页公告图，940×510
  - `thumbnail`：活动条图，300×150
  - `storyCast`：2–5 人
- 组合前传：`public/assets/stories/units/image_unit_story_button_*.png`，446×150，16 张，每组 3–4 篇。
- 主线：`image_story_main_button_0{1,2}.png`，1456×553，**两侧是透明的**，美术实际只占 1138×553。现在主线图两侧的藏青色条就是这片透明区，应按美术区域裁切（`aspect-ratio: 1138/553; object-fit: cover`）。

**两个方案**（画布里有现在的桌面和手机截图对照）：
- **方案 A（建议）**：顺序改为 主线 → 组合前传 → 活动剧情 → 更多故事。
  - 组合前传 4×4 全部展开，取消轮播。
  - 活动剧情只留最新一部大 KV（约 1.5fr），旁边 4 条紧凑行（300×150 条图 + 标题 + 类型 + 登场头像），底部「查看全部 36 部」。
  - 手机：组合前传改两行横滑，活动一大三小。
- **方案 B**：顺序不变，活动剧情只留一排 3 张卡（去掉每张卡底部的操作行），组合前传 4×4 全部展开。

**还需用户回答**：用 A 还是 B；A 里主推活动的「开始阅读」是否作为本页唯一的藏青主按钮。

**实现提示**：
- 活动卡组件是 `EventStoryCard.vue`；紧凑行要新写，或者参考 `StoryDiscovery.vue` 里的封面取法。
- 组合前传的横幅映射在 `unitVisual()`。
- 有检查脚本断言故事目录（`verify-story-*`、`verify-*landing*`），改之前先读它们的断言。

### 长尾

- 设计令牌剩余：299 处写死字号（72 处小于 12px）、1011 处十六进制颜色、233 处写死圆角、56 处非三档断点。播放器、小人舞台占大头，随手减少。
- 歌曲播放器的进度条在 Chromium 里是原生的深灰粗轨道，可以统一成细轨道加舞台光进度（用户没提，属于配色降噪的余项）。
- 门户顶部背景图在手机上复查是否太抢眼。
- 引导第 3 步的措辞是「他」，以后有需要再改。

---

## 4. 待用户决定（不要擅自做）

1. 故事目录方案 A / B（见上）。
2. 活动剧情立绘的「待核对候选图」功能：`rawCandidateUrl` 一直没传，实际未接通。建议删掉死代码，或者接回并只在维护者模式下生效。
3. 服装名里属性词不统一（「精神阳光黄 / 理智耀眼蓝 / 激情闪烁红」）：是否改成 `Mental阳光黄` 这种写法。

---

## 5. 每一步的验收

1. 截图验收：1280 / 768 / 390 三档（截图集，或单页探针）。不能有截断、横向滚动、堆叠的表单。改了担当色相关的部分，要用黄、红、近黑、浅粉四位担当各截一张。
2. 跑相关检查脚本，再跑 `verify-design-tokens`（有改善就 `--update`）。
3. 全量检查：没有新增失败，跑完还原 `archive_verification.json`。
4. `npm run build:check`：提交前跑一次，提交后再跑一次。
5. 新增的检查脚本做变异测试。

## 6. 基线失败名单（39 个）

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
