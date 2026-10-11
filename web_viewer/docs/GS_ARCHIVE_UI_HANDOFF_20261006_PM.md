# GS Archive UI 交接（2026-10-06 下午）

接替 `GS_ARCHIVE_UI_HANDOFF_20261006.md`（上午那份留作历史）。新窗口先读本文件，再读 `docs/GS_UI_CONSTITUTION.md` 的「视觉语言」和 `docs/GS_GAME_UI_REFERENCE.md`（游戏界面的信息构成规律）。设计方向（「节目册」）已定，不要重新讨论。

---

## 0. 当前状态

- 分支 `codex/portal-architecture-cleanup-20261004`。远端已被推到 `29c95953`（不是本窗口推的：用户或另一个会话），之后的提交都**未推送**；用户没要求就不推。
- 工作区 `public/translations/zh-CN/archive-general/skills.json` 显示已修改，只是换行符差异。**不要 `git checkout` 它**，不管它。
- 全量检查基线：**38 个失败**（`verify-story-player-ui-pr2` 本窗口修好了，从 39 降到 38），名单见 §6。新增的才算回归。
- 有另一个会话也连着本窗口建的两块画布；在画布留评论会被两个会话各回一次。

### 本窗口完成并提交的（不要重做）

| 提交 | 内容 |
|---|---|
| `9d6241f8` | 故事目录方案 A（组合前传前置、活动一主四行、主线图按不透明区裁切） |
| `351c1cc3` | 称号底板按宽度缩放（画布高度 46–60 不一） |
| `02db1cc6` | 桌面故事筛选可收起 |
| `56802ce9` | 侧栏去掉担当灯条，担当头像变成快捷切换（`ArchiveStageIdolSwitch`） |
| `2660ef8f` | 摄影资料「场景」并入「地点」+ 时段筛选；`scenes:<id>` 深链打开所属地点 |
| `49c90f2d` | 「卡片剧情」= 通信里的 342 通电话，改叫「电话」归通信 |
| `29c95953` | 通信页电话标题用正式标题；页头去掉英文 |
| `c98eafe2` `f3b5afc6` `39270f1c` | 主页设置面板矮窗口不再压扁；道具属性浅底色；歌曲目录去掉平假名 |
| `b8b73523` | 通话画面固定属于主人（涟那通有春名、雨彦插话的电话） |
| `266cf152` | `docs/GS_GAME_UI_REFERENCE.md` |
| `45967532` | 通信页方案 B：通话卡（信物照片 + 主人头像名牌）在左/在上；通话的「也在通话中」 |
| `986f99fc` | 阅读器只留一个语言开关（原文 / 译文 / 双语） |
| `b860c0e0` | 组合聊天的第二种编号 `1_x_<idol>_8_2_…` 也算群聊（Jupiter 主题断言）；修 pr2 里 4 条过期断言 |
| `67903090` | 全站滚动区固定预留滚动条位置（`scrollbar-gutter: stable`），专注模式的摄影台除外 |
| 本批（见 §0.1） | 聊天背景与标题、看完后的面板、头像框、摄影资料贴纸分类 |

### 0.1 本窗口最后一批（若未提交，按此提交）

- **聊天背景**：一对一聊天按房间主人的组合铺背景；故事内两位以上同组合偶像的聊天算该组合的群聊。逻辑在 `CommunicationPresentationContext.js`（`talkParticipants`）。2026-09-30 的 `35e62f27` 曾让一对一聊天没有背景，这是那次的回归。全语料：510 个一对一聊天、67 个组合聊天、故事内 45 个群聊 + 105 个一对一，只有山村賢（无组合）没有背景。
- **聊天窗标题**：群聊写组合名，一对一写主人名（取聊天里的显示名，保留译名），不再出现「A、B」「A 他」。
- **看完后的面板**（`StoryViewer.vue` `.complete-panel`）：改成唯一浮层样式，标题 / 一行状态 / 按钮；主操作藏青。「返回通讯目录」改「返回通信」。
- **头像框**：`ArchiveIdolAvatar` 不画色环时（`ring-width="0"`）用 SSR Portraits 的三层内阴影框（令牌 `--gs-avatar-frame`）。四处裸 `<img>` 头像已换成组件；`grep "getCharaIconUrl(" src --include=*.vue | grep "<img"` 应为 0。
- **贴纸分类**：`src/presentation/photoStickerGroups.js`（组合 16 / SideMini 49 / 图案 41 / 活动与限定 71 / 标志与属性 7），摄影资料贴纸页已接入；检查 `verify-photo-sticker-groups`。

---

## 1. 下一步

### 1.1 摄影台素材选择改版（用户已认可，直接做）

设计稿：https://claude.ai/artifact/5aQWd8Htrprt7XEN34dNhb （第二行三张：地点、人物、贴纸）。组件 `src/components/archive/PictureStudio.vue`，样式 `src/styles/picture-studio.css`。

1. **一级分类**：抽屉现在是「素材 / 图层 / 编辑 / 保存」下面再套「背景 / 人物 / 贴纸 / 画面效果」。改成左侧竖向一列：地点 · 人物 · 贴纸 · 相框 · 滤镜 ｜ 图层 · 保存。「编辑」是选中图层后的状态，从图层进入。
2. **地点**：133 项下拉框换成缩略图网格 + 时段筛选（白天/夜晚/傍晚/下雨…）。直接复用摄影资料页已有的地点-场景结构：`ArchivePhotoCatalog.vue` 里的 `spotScenes` / `variantKey` / `spotVariantKeys`，建议抽到 `src/presentation/` 共用，不要复制。选中地点后在下面展开它的场景。背景缩放从数字输入改滑杆。
3. **人物**：49 人下拉框 + 「添加」按钮，换成按组合分组的头像网格，点一下加入；已在画面中的显示「×1」，侧栏显示「1/6」。现在旁边那 3 个表情头像看着能点其实不能点，去掉。头像用 `ArchiveIdolAvatar`（带色环或 plain 框）。可参考 `terminal/ArchiveIdolPickerPanel.vue`（「唯一的偶像选择器」），能复用就复用。
4. **贴纸**：去掉 12 页翻页，按 `photoStickerGroups.js` 分组滚动浏览；加「最近用过」一行；侧栏「2/32」。
5. **相框 / 滤镜**：文字下拉换预览图。相框数据有重名（两个「上下窄边框」），要区分。

### 1.2 工具页重画（方案没定，先出画布）

用户对第一版（同一画布第一行）的意见：
- 布局喜欢，但**三个工具不是同一类，没有主次**，不该一主两辅；
- **图片太多**，不知道选哪个，动线乱；
- 担心**加载慢**（部署时遇到过），考虑注明「建议在网络流量充足时使用」。

方向建议：三个等宽、同结构的入口（标题、一句话、一个操作），图片最多一张小预览或用图标，按需加载；在需要大量下载的工具入口上标注资源体量（谱面 / 小人舞台 / 摄影台各自首次加载的大概量级，要实测，不要估）。先在画布上出 1–2 版给用户选。

### 1.3 长尾

- 卡片详情的语音列表还是旧式实心绿「播放」按钮。
- 设计令牌剩余：约 299 处写死字号、1007 处十六进制颜色（`verify-design-tokens`，改善后 `--update`）。
- read-model 本地已重建验证；线上要重新发布 read-model，「电话」标签、通话「也在通话中」才会出现在线上。

---

## 2. 工作方式（本窗口踩过的坑）

- 用户偏好：大视觉改动先出 Design 画布（现在 vs 方案，真实素材），点头再做；信息构成参考 `GS_GAME_UI_REFERENCE.md`，不照搬游戏的框。
- **App.vue** 只能 Read / Grep / Edit，不用脚本改。新代码别插进 `archiveStats`…`idolPickerLabel` 那段（`verify-archive-home` 会沙盒执行）。
- **检查脚本先做变异测试**：把修复改回去确认会失败。改文件做变异时：
  - Node 里 `/tmp` 会被解析成 `E:\tmp`，用 scratchpad 的 `C:/Users/...` 绝对路径；
  - 开发服务器的文件监听偶尔锁文件，写入后用 `cmp` 确认真的写进去了。
- **heredoc 里的反斜杠会丢**（正则、`\n`），改含正则的文件用 Edit 工具，或写成字符串包含判断。
- **read-model 构建器要求输入文件已提交**才肯构建：
  `node readmodels/tools/build_readmodels.mjs --repo /e/Web_build/SideM_Archived --out <scratch>/rm-candidate --data-revision c5ab806ee57778bc387322acfcf5211ecdf0521721a6df279dbe52a6e006e5b9 --media-epoch local-dev`
  然后另起 `SIDEM_READMODEL_CANDIDATE=<scratch>/rm-candidate npx vite --configLoader native --port 5176 --strictPort` 验证，用完关掉。5175 上一直有一个别处起的服务器，别动它。
- **浏览器探针**（Node 内置 WebSocket 走 CDP）：chromium-1234 现在**必须加 `--no-sandbox`** 才能启动（沙盒启动返回码 3）。探针脚本放单独 .js 文件再 `JSON.stringify` 进任务文件，不要内联在 shell 里（转义会坏）。摄影台打开时菜单已是展开状态，再点菜单按钮会把它关上。
- 全量检查会改写 `public/data/archive_verification.json`，跑完 `git checkout --` 它。跑的时候不要 `git stash`。
- 提交后再跑一次 `npm run build:check`（`verify:entry` 绑定 HEAD）。

---

## 3. 本窗口确立的规则（写进代码和检查了）

- **通信的房间归属**：一段通话/聊天属于谁，由场景编号决定（`communicationOwnerId`）；说话人只决定这一句的标签。背景、主题、头像名牌、标题都跟房间走。
- **组合聊天的两种编号**：`8_2_…` 和 `1_x_<idol>_8_2_…` 都是群聊。
- **滚动区固定预留滚动条**；不滚动的根元素（专注模式摄影台）要显式 `scrollbar-gutter: auto`。
- **头像**：任何地方显示偶像图标都用 `ArchiveIdolAvatar`，不要裸 `<img>` + 圆角。

---

## 6. 基线失败名单（38 个）

```
verify-archive-build-audit verify-archive-loading-copy verify-archive-startup-route verify-card-costume-presentation
verify-chibi-foot-lighting verify-chibi-song-picker verify-current-archive-baseline verify-engineering-lifecycle
verify-episode-artifacts verify-event-catalog-navigation verify-event-view-consumer verify-external-story-resource-ui
verify-extra-story-visuals verify-home-lipsync-http verify-idol-communication-readiness verify-idol-navigation-ux
verify-ipad-collection-repair verify-local-story-strict-schema verify-photo-catalog-navigation verify-portal-bento
verify-portal-directory-navigation verify-portal-projections verify-preview-data-http verify-preview-http
verify-preview-incremental-http verify-song-chart-png-browser verify-song-detail-presentation verify-song-domain-landing
verify-song-experimental-http verify-song-lyrics-presentation verify-song-music-transport verify-song-playback-audio
verify-song-timelines verify-structured-gzip-http verify-studio-work verify-terminal-idol-localization
verify-translation-strict-v2 verify-voice64-http
```

`verify-photo-catalog-navigation` 需要 `--experimental-vm-modules`，且它给组件打的桩早已过时（缺 `loadArchivePhotoNames`），修它是另一件事。
