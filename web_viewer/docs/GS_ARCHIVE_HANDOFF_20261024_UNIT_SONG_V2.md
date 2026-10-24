# 歌曲同步歌词 / 组合页 / 组合前传 v2 方案交接（2026-10-24）

上一份交接：`GS_ARCHIVE_HANDOFF_20261023_UNIT_SONG_PAGES.md`（H 批）。H1、H2、H3、H4 的第 1–3 点、H6 已经提交在 `docs/20261023-unit-song-handoff` 分支上（3d3575bc…16919580，领先 master 6 个提交，**还没有推送，也还没有开 PR**）。

v2 方案的截图里，有几处和这个分支的现状对不上（例如成员副标题仍显示「彩」）。截图应该是旧部署上拍的。下面每一条都按分支 HEAD 16919580 的代码核对过。⚠ 标出的是不能照着方案直接做的地方。

方案里的尺寸（16.5px、260px、200×110、"+80px"、"+110px"）和颜色（`#94a3b8`、`#0f172a`、`rgba(16,185,129,.1)`）都不是实测值，**不要照抄**。一律用 `GS_UI_TOKENS.css` 里的 token。

## 0. 先处理

1. 把这个分支推上去，开 PR。门禁：`npm run build:check` 和 `npm run gate:source`。合并后再开 I 批分支，避免在没合并的 6 个提交上继续叠。
2. **H5（歌词搬到左栏）取消。** v2 方案也同意歌词留在右侧 sticky 栏，所以三个播放器时钟统一那项工作不用做了。把上一份交接第 4.4 点标成「已取消」。

## I1. 同步歌词视觉（`ArchiveSongLyrics.vue`，只改这一个文件）

现状：`<details>` 折叠，摘要行是 `▸ 歌词 同步歌词`。预览窗口固定显示 `previewCount = 6` 行，会跟着当前句移动（`visibleLines`）。它**不是滚动容器**。当前句用 `inset 2px` 薄荷色竖条、`--gs-text-subtitle` 字号、semibold 字重。点击歌词跳转已经有了（`seek` → `@seek`），不需要新做。

1. **当前句**——采纳，有改动：去掉竖条，改成 `background: var(--gs-mint-wash); border-radius: var(--gs-radius-…)`，左右加 `var(--gs-space-3)` 内边距。其他行也要加同样的左右内边距，否则高亮切换时文字会左右跳。非当前行用 `--gs-ink-3`。
   - ⚠ **字号放大要谨慎。** 右栏只有在能完整放进视口时才 sticky（`ArchiveSongDetail` 的 `listeningColumnFits`）。当前句放大后，如果一行歌词换行变成两行，6 行窗口的总高度会随播放变化，sticky 可能在播放过程中反复开关。做法：要么字号保持 `--gs-text-subtitle` 不变，只改底色和字重；要么给 `.song-lyrics-list` 设 `min-height`，按 6 行 × 触控高度算。不要用 `transform: scale`，它会让点击区域和文字对不上。
   - `transition` 只放在 `background-color` / `color` 上，并且在 `prefers-reduced-motion` 下关掉（文件末尾已经有这个 media query，加进去就行）。
2. **上下渐隐遮罩**——采纳，有限制：只在**预览模式**（`!fullLyrics && lines.length > previewCount`）下，给 `.song-lyrics-list` 加 `mask-image: linear-gradient(to bottom, transparent, #000 14%, #000 86%, transparent)`。展开全文时不加，否则第一句和最后一句会一直是半透明的。
   - ⚠ 窗口计算是 `start = anchor - 2`，当前句固定在第 3 行，不在遮罩范围内。歌曲开头 `start = 0` 时，当前句会落在第 1 行，正好在渐隐区里。修法：开头阶段遮罩顶部改成 0。可以给列表加一个 class（例如 `at-start`），条件是 `visibleLines[0] === lines[0]`。
   - 不要另加 `max-height + overflow-y:auto`。现在是窗口切片，不是滚动容器，再加滚动会出现两套定位逻辑。
3. **顶栏**——采纳：摘要行右侧放一个胶囊按钮「展开全文 / 收起全文」，删掉列表底部的 `.lyrics-expand`。
   - ⚠ 这个按钮放在 `<summary>` 里时，点击会冒泡触发 `<details>` 折叠。要 `@click.stop.prevent`，并且只在 `expanded` 为 true 时显示（折叠状态下点「展开全文」会让人困惑）。
   - `▸` 三角保留。它是折叠状态唯一的提示。方案说要去掉，但这块默认是折叠的，去掉以后读者看不出可以点。
   - 方案里的 📜 和 🔊 不用 emoji，用 lucide 图标（`ScrollText`、`Volume2`），和全站一致。

验收：在 `grwsml`（16 组合版）、一首五槽编成歌、一首普通歌上播放 30 秒，确认三件事：sticky 状态不来回切换；当前句高亮不跑出窗口；点击任意一行都能跳转。宽度 1440 / 980 / 390。

## I2. 右栏控件精简（`ArchiveSongExperimentalPlayer.vue`、`ArchiveSongSinglePlayer.vue`）

1. **试听模式 + 组合两层 `<select>`**（`ArchiveSongExperimentalPlayer.vue:10–27`）——部分采纳。16919580 已经把组合版做成了左栏胶囊，所以右栏的「组合」下拉是重复的。
   - ⚠ 下拉不能直接删：Solo 模式（`selectedSingleKey`，49 人）和 Solo 里的组合筛选（`:93`）只能从这里选。做法：**「组合预设」模式下**把这两层下拉折成一行只读指示「当前：组合预设 · W」，旁边放一个「更换」按钮，点了才展开原来的下拉。Solo 模式保持现状。
   - 只有 3 首歌（`byndtd`/`drvalv`/`grwsml`）用这个播放器，改动不影响其他 57 首。
2. **`音量` 文字折叠**（`ArchiveSongSinglePlayer.vue:16`）——采纳：`<summary>` 换成 `Volume2` 图标按钮，加 `aria-label="音量"`，滑块保持不变。五槽 / 实验播放器里的「Solo 音量 / 伴奏音量」是两个并排的滑块，带文字标签是必要的，**不要改**。

## I3. 组合详情 hero（`ArchiveUnitDetail.vue`）

现状：`.unit-hero-copy` 从上到下依次是 Logo（220×74，左对齐）、`h2` 名称、假名、简介、卡片胶囊。`.unit-swatch` 是一个 14px 的色点，单独固定在右上角。方案说的「Logo 和名字上下重复」「右侧空」「孤立的紫点」都和现状吻合。

1. **左文右徽**——采纳。hero 改成两列 grid：左 `minmax(0, 1fr)` 放文字，右 `auto` 放 Logo（`max-width: 200px; max-height: 110px; width/height: auto; object-fit: contain`，`align-self: center`）。从左栏删掉 Logo。
   - 遮罩现在是从左往右变淡（右侧 28%），右侧本来就是亮的，Logo 放上去不用改遮罩。只需要保留 `drop-shadow`。
   - 色点移到 `h2` 前面，作为行内元素（8–10px）。删掉 `.unit-swatch` 的绝对定位。
   - ≤760（现在的移动端断点）：Logo 回到文字上方，放小，单列显示。这一档简介本来就隐藏，改由 `.unit-description` 显示，这个现状不变。
2. **成员副标题**——已经完成（732e6894，`subtitle: 'cv'`）。⚠ 方案又提了一次「属性色点 + 属性」，但偶像字典里没有偶像级的属性字段，**仍然不做**（原因见上一份交接 2.2）。
3. **组合剧情区顶部加前传横幅**——采纳。资源是现成的：`/assets/stories/units/image_unit_story_button_${unit_code}.png`，16 个组合都有，尺寸 446×150，路径规则在 `src/data/storyCollections.js:57`。
   - 不要在组合页再写一遍这个路径。从 `storyCollections` 导出一个 `unitStoryBannerUrl(assetCode)`，`storyCollections.js` 自己和组合页都调用它（参见 memory「Single source of truth」）。
   - 横幅本身就是按钮，点击跳到该组合的前传合集，跳转用现有 `stories` 的打开事件，不要新加路由。这张图自带游戏边框，**外面不要再套 `--gs-line` 边框**。
   - 文件在 git 里是 ignored 的，靠 R2 / 部署产物提供。图片加载失败时要整块隐藏（`@error` 设一个标志），不能露出破图标。

## I4. 组合前传合集页（`ArchiveStoryCollection.vue`，只看 `domain === 'unit_story'` 的分支）

现状：`.collection-hero` 是 `1.2fr : 1fr` 两列，左边是横幅，右边是标题和简介。下面单独一节「成员」（`collection-members`，`auto-fill minmax(200px)`）。

1. **成员收进 hero 右栏底部**——采纳，**只限 `unit_story`**。这个组件也渲染主线和 extra 的合集，这两类不要动。条件就是现有的 `['extra','unit_story'].includes(...)` 这一类判断，只是单独判断 `unit_story`。
   - 成员继续用 `ArchiveIdolReference`。hero 里放不下完整的卡片时，用它的紧凑形态（头像 + 名字）。如果组件还没有紧凑形态，就加一个 prop，不要另写一个胶囊组件。
   - 删掉下面的「成员」节。屏幕阅读器的标题层级要保留：hero 里的成员组用 `aria-label="成员"`。
2. **去掉横幅外层多余的白框**——采纳。在现有 `.collection-visual` 的样式上，对 `unit_story` 去掉 padding、背景和边框。横幅自带边框。
3. **右上加「组合资料 ›」**——采纳。跳到 `/units/<unit_code>/`，使用现有的路由 helper（参见 memory「Nav naming lane」里的静态路径）。
4. 方案写的「4 章 · 30 段剧情（其中 1 章暂未收录）」：章数和段数要从 `chapterCount` / `episodes` 现有字段取。「暂未收录」要看有没有对应的字段，没有就不写。
5. ≤760：单列显示，横幅在上；成员换行，不允许横向滚动。

## I5. 组合列表 `/units/`——不改

方案给了两条路径。路径 B（168×94 场景框 + Logo 居中 + 128×54 双上限）就是 3d3575bc 已经做完的版本。路径 A 是改用前传横幅，不采纳：横幅是 446×150 的游戏按钮图，自带边框和文字，缩到列表卡片的尺寸后小字看不清，而且和 I3 的横幅重复用了同一张图。列表维持现状。

## 建议顺序 / 文件集

| 批 | 文件 | 备注 |
|---|---|---|
| 0 | — | 推送并合并当前分支 |
| I1 | `ArchiveSongLyrics.vue` | 单独提交，验收 sticky |
| I2 | `ArchiveSongExperimentalPlayer.vue`、`ArchiveSongSinglePlayer.vue` | |
| I3 | `ArchiveUnitDetail.vue`、`src/data/storyCollections.js`（导出 helper） | |
| I4 | `ArchiveStoryCollection.vue`（可能加上 `ArchiveIdolReference.vue` 的紧凑 prop） | |

每批都跑 `npm run build:check`（不要直接跑 `vite build`）和 `npm run gate:source`。截图验收按 memory「Browser acceptance recipe」，宽度 1440 / 980 / 390。验收页面：`/songs/grwsml/`、`/songs/<五槽歌>/`、`/units/07sai/`、`/units/05w00/`（扁 Logo）、07sai 的前传合集页。
