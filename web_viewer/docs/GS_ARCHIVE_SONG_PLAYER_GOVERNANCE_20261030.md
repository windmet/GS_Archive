# 歌曲页播放控件治理方案（2026-10-30）

## 0. 开发基线

- 基线：`origin/master` **e02e6bd3**（#143 合入后）。主检出所在的 `portal/20261025-costume-filters` 已落后 20+ 个提交，不能作为基线。
- 工作区：`E:/Web_build/GS_Archive_Domain_Work/song-player-20261030`（LF worktree，分支 `portal/20261030-song-player`）。dev：`npx vite --configLoader native --port 5191`。
- 未合并 PR 交叉检查：#140–#148（减法册 L1–L7）都没有改歌曲详情页的三个播放组件。相邻文件只有 #147 `ChibiStageViewer.vue`（舞台接收端，本方案不改）和 #148 `ArchiveSongChartPreview.vue`（谱面，不改）。#147 的“用值行和列表层代替原生下拉框”正好是本方案选择器的写法，按它对齐。
- 涉及歌曲：分轨播放器只有 5 首。

| 歌曲 | 模式 | 组合版 | 个人声部 | 收录音轨 |
|---|---|---|---|---|
| byndtd / grwsml | 全员 · 组合 · 编成 · Solo | 16 | 49 | 伴奏 |
| drvalv | 同上 | 16 | 49 | 伴奏 + 1 首特殊版 |
| tkstp1 / tkstp2 | 只有编成 | 0 | 49 | 完整混音 + 伴奏 |

其余歌曲走 `ArchiveSongSinglePlayer`，只受第 4 节横版走带的影响。

基线截图（1440 / 390）：`scratchpad/shots-base/`，场景是 drvalv 的全员 / 组合 / 编成 / 收录音轨，加 DRIVE A LIVE（パッションMAX）。

## 1. 问题根因

### 1.1 遗留的「进入 Chibi 舞台」框：舞台入口有两个主人

- `ArchiveSongLineupPlayer.vue:75–78`：编成模式里有自己的舞台按钮，会带上五人编成（`createSongStageHandoff`）。它来自 0e14af02（「Productize song listening」），用的还是旧的 `action-bg` 实心按钮样式。
- `ArchiveSongDetail.vue:49–56`：901e0229（P6 三栏头部）把「2D 舞台 / 社长特别演出」从播放器标题栏统一移到控台底部，但**只迁走了 Detail 里的三处**，编成播放器内部那一个没有迁。
- 结果：编成模式下同时出现两个舞台入口，一个是旧样式，选满五人且载入完成前一直是禁用的灰色；底部那个「2D 舞台」不带编成。旁边两个 `<slot name="header-action" />` 也已经没有调用方，是死代码。

### 1.2 「选版本」有三个主人，而且呼出方式有五种

同一件事“现在听哪个版本”，页面上有三个入口：

1. 控台里的「演唱版本」标签；
2. 下方记录区的「版本试听」胶囊条（`ArchiveSongDetail.vue:59–85`），全员 / 伴奏 / 16 个组合；
3. 「音源收录」列表里的「组合版 / Solo / ＋编成」按钮。

所以才需要 `revealPlayer()` 这个补丁：在下方点了胶囊，再把页面滚回播放器。

控台内部各模式的呼出方式各不相同：

| 模式 | 现在点标签后发生什么 | 怎么选 |
|---|---|---|
| 全员合唱 | 直接切换 | 无需选择 |
| 组合预设 | 切换后，**整行标签消失**，变成「当前：组合预设 · Jupiter［更换］」 | 「更换」打开原生 `<select>` 和「收起」；或者去下方胶囊条 |
| 自由编成 | 切换 | 点槽位，打开侧抽屉 |
| Solo 试听 | **不切换模式**，直接弹抽屉；选完才切换 | 抽屉，或「当前 Solo · X →」按钮 |
| 收录音轨 | 切换 | 原生 `<select>` |

背后的状态有 `mode`、`unitSelectorOpen`、`soloOpen`、`pickerTarget`，彼此交叉。组合模式那条“标签消失”的路径是最乱的：读者离开组合模式的唯一办法是先点「更换」。

### 1.3 左右失衡：控台既是配置台又是走带

控台同时承载「选版本 + 选五人 + 走带 + 音轨平衡 + 歌词 + 工具入口」。编成模式下高度约 820px，左侧头部只有约 180px，左下方整片空白。另外，901e0229 改成三栏头部时删掉了 `.is-sticky-fit { position: sticky }`。现在类名照样计算，但没有任何样式，控台其实早就不吸顶了。

## 2. 治理原则

1. **一个主人。** 舞台入口只在控台底部；选版本只在「演唱版本」面板；试听状态只有一个 composable 持有。
2. **配置在内容栏，控台只管走带。** 采用外部意见的方案一，同时吸收方案三的横版走带。
3. **一种呼出规则：**
   - 标签 = 模式，切换后标签行永远在；
   - 选组合、选音轨这类 ≤16 项的选择，就地用胶囊；
   - 选偶像（49 人）一律用同一个偶像抽屉（宽屏侧抽屉，手机底部抽屉）；
   - 页面上不再有原生 `<select>`。

## 3. 结构设计

### 3.1 状态：`useSongAudition(song)`（新 composable，Detail 里实例化一次）

外部意见问编成和播放器的状态是否耦合：现在是耦合的，而且分散在两个组件里。`ExperimentalPlayer` 持有模式、选择和单轨走带；`LineupPlayer` 持有五人编成、多轨 session 和舞台交接。

把这些状态上提成一个 composable，对外暴露：

- `mode`、`modes`
- `selection`：`unitKey`、`idolCode`、`trackKey`、`lineup[5]`
- `transport`：`ready`、`playing`、`currentTime`、`duration`、`toggle`、`seek`、`restart`
- `gains`：`vocal`、`backing`，单轨时只有 `master`
- `nowPlaying`：一句话，例如「组合预设 · Jupiter」「自由编成 · 已选 3/5」「Solo · 天道輝」
- `stageTarget`：编成就绪时返回带 `stageHandoff` 的目标，否则为 `null`
- `lyricsSource`

内部继续复用现有的 `useSongPerformanceSession`、`createSongStageHandoff`、`fetchSongPerformanceArrangements` 和 localStorage 编成记忆，**不新造时钟或 session**。

两个视图读写同一份状态：

- `ArchiveSongVersionPanel.vue`（新，由 `ExperimentalPlayer` 和 `LineupPlayer` 的选择部分拆出）：标签、就地胶囊、五个槽位、偶像抽屉。
- 控台（`ArchiveSongDetail` 里的 `.song-listen-column`）：正在播放、走带、平衡浮层、歌词、底部工具。

`ArchiveSongExperimentalPlayer.vue` 和 `ArchiveSongLineupPlayer.vue` 拆完后删除。`ArchiveSongSinglePlayer.vue` 保留自己的媒体时钟和 Center 台词，只换成新走带。

### 3.2 演唱版本面板：各模式的选择面

| 模式 | 选择面 | 默认值 |
|---|---|---|
| 全员合唱 | 无（一行说明：分轨试听与原游戏混音可能不同） | — |
| 组合预设 | 16 个组合胶囊就地换行，就是原「版本试听」条搬进来 | 第一个组合 |
| 自由编成 | 5 个槽位横排（头像 64px，宽屏带名字与状态），点槽位打开偶像抽屉；「编成规则」改成标题旁的 `?` 浮层；有多张演唱切换表时出胶囊（不超过 16 项，按规则就地选） | 上次的编成（不自动下载） |
| Solo 试听 | 一个值行「Solo · 天道輝 ›」，点它打开偶像抽屉 | 上次选过的偶像，否则第一位 |
| 收录音轨 | 胶囊：伴奏 / 完整混音 / 特殊版 | 第一项 |

偶像抽屉沿用现在的 `ArchiveTerminalDialog`：搜索框；组合筛选从 `<select>` 改成胶囊横滚；**按组合分组列出**，顺带完成 P6 进度表里“按组合排的 49 人选择器”这一项。编成时标题写“位置 N”，选完自动跳到下一个空位（现有逻辑）。

### 3.3 控台（固定高度）

```
┌ 歌曲播放 ───────────────────────┐
│ 正在播放  组合预设 · Jupiter      │
│ (▶)  ━━━━━━●────────  ↺  🔊    │  ← 一行：播放 48 | 进度 | 重来 | 平衡
│      0:42             2:10      │
├─────────────────────────────────┤
│ ▸ 歌词  同步歌词                  │
├─────────────────────────────────┤
│ [🎬 2D 舞台 · 带编成] [♪ 谱面]   │  ← 舞台唯一入口，stageTarget 决定行为与文案
└─────────────────────────────────┘
```

- 🔊 是一个浮层：单轨时一个音量滑块；分轨时「演唱 / 伴奏」两个滑块。这项替换掉两处「音轨平衡」details。
- 舞台按钮：编成就绪时是「2D 舞台 · 带编成」，交接五人；其他时候是「2D 舞台」或「社长特别演出」，打开默认编舞。不再有禁用的灰按钮。
- 编成未选满时，「正在播放」写「自由编成 · 已选 3/5」，播放键禁用。缺几人的说明只在面板里写一次。

### 3.4 布局

宽屏（容器 ≥900）：

```
┌ 封面 | 歌名 / 制作 / 属性 ─────┐ ┌ 控台（sticky）┐
├ 演唱版本 ─────────────────────┤ │              │
│ 全员合唱 组合预设 [自由编成] Solo 收录音轨 │              │
│ ①  ②  ③中心  ④  ⑤            │ │              │
│ 已选 3/5 · 点空位继续选择         │ └──────────────┘
└──────────────────────────────┘
── 演唱者 / 音源收录 / 难度与谱面 …（通栏）
```

- 网格：头部第 1 列第 1 行，面板第 1 列第 2 行，控台第 2 列跨 1–2 行，记录区第 3 行通栏。
- 控台高度约 290px，五种模式下基本恒定。**不恢复吸顶**：901e0229 让记录区通栏，吸顶控台会盖住通栏的记录区。平衡靠控台变矮和面板填满左栏来实现。
- 非分轨歌曲没有面板。控台因横版走带变矮，与头部（176px 封面）的高度差缩小到约 120px。

手机（<900，单列）：头部 → 演唱版本面板 → 控台 → 记录区。

- 面板和控台紧挨着，选完就能播，不再需要 `revealPlayer()`，删掉。
- 标签行横滚（现状）。组合胶囊在窄容器（<520）里改成**两行横滚**：16 组全部就地可选，不另开抽屉。
- 五个槽位在 390 宽每格约 66px：头像 44 + 位置号，名字省略到 4 字。
- 偶像抽屉是 85dvh 底部抽屉（现状）。

### 3.5 记录区去重

- 删除「版本试听」区块，已并入面板。
- 「音源收录」回到纯记录：保留数量摘要和按组合的偶像列表（链接到偶像 / 组合档案），**删掉「组合版 / Solo / ＋编成」三个播放按钮**，播放统一走面板。`sourceStatus`、`addToLineup`、`playSolo` 这些桥接随之删除。

## 4. 分批

| 批 | 内容 | 文件 |
|---|---|---|
| S1 舞台单一主人 | 删除编成播放器里的舞台按钮和旧样式；播放器暴露 `stageTarget`；底部按钮按它交接，文案为「· 带编成」；删除两个死 slot | `ArchiveSongLineupPlayer.vue`、`ArchiveSongExperimentalPlayer.vue`、`ArchiveSongDetail.vue` |
| S2 状态上提 + 面板 | `useSongAudition`、`ArchiveSongVersionPanel`；去掉 `unitSelectorOpen`、原生 select、「版本试听」区块和「音源收录」的按钮；偶像抽屉按组合分组 | composable、面板（新）、Detail；删除两个旧播放器 |
| S3 横版走带 | `ArchiveMediaTransport` music 变体改成一行，加平衡浮层；单轨播放器同步换上 | `ArchiveMediaTransport.vue`、`ArchiveSongSinglePlayer.vue` |
| S4 布局与验收 | 宽屏网格和手机顺序；守卫脚本 | Detail、`scripts/verify-song-console-ownership*.mjs` |

S1 可以单独先合，它就是“遗留框”的根治。S2 依赖 S1。S3 可以和 S2 并行。

守卫（S4，需要先做变异测试）：

1. 源码层：歌曲组件里 `emit('open-stage'` 只允许出现在 Detail 的控台底部；歌曲页组件里不能有 `<select`。
2. 浏览器层：drvalv 五种模式 × 1440 / 980 / 390，断言舞台按钮恰好 1 个、标签行始终可见、宽屏控台吸顶状态在五种模式下一致。

变异测试：把遗留按钮加回去，或把组合模式的标签隐藏改回去，两项检查都必须 FAIL。

每批都跑 `npm run build:check` 和 LF worktree 里的 `npm run gate:source`。验收页：`/songs/drvalv/`、`/songs/grwsml/`、`/songs/tkstp1/`（只有编成）、`/songs/drvalv_pmax/`（单轨、社长特别演出）、一首有 Center 台词的歌。

## 5. 决定（2026-10-30，均按推荐）

1. 「音源收录」去掉全部播放按钮，回到纯记录。
2. 手机顺序：面板在控台之上。
3. 点「Solo 试听」标签直接切换：用上次选过的偶像（`sidem:song-solo:<code>`），没有就用第一位。

## 6. 实现记录

- S1 `e1bc9dbf`：舞台入口只剩一个。
- S2/S3：`useSongAudition.js`、`ArchiveSongVersionPanel.vue`、`ArchiveSongAuditionConsole.vue`、`ArchiveSongBalance.vue`；删除 `ArchiveSongExperimentalPlayer.vue` 和 `ArchiveSongLineupPlayer.vue`。
- S4：`verify-song-console-ownership.mjs`（进入 batch）；同步更新 `verify-song-experimental-audio`、`verify-song-detail-presentation`、`verify-archive-presentation`、`verify-idol-stage-light`、`verify-song-playback-audio`、`verify-terminal-idol-localization`（localOnly），以及 `design-token-baseline.json`。
- `verify-terminal-idol-localization` 在 master `e02e6bd3` 上本来就在偶像页 h2 断言处失败。跳过偶像段后，歌曲段在 zh-CN 和 ja-JP 下都通过。
- 头像框（用户 10-30 指定）：已选的槽位用 `ArchiveIdolAvatar` 的身份环（偶像代表色）。选人抽屉复用全站唯一的 `ArchiveIdolPickerPanel`，并新增 `group-ring` 开关：候选人统一用组合环（白间隙 + 淡藏青边，`is-plain`），选定后才用代表色。「×N」表示这位偶像已占几个位置。组件里本来就只有这两种环，没有再加新颜色。
- 播放中不撑开页面（用户 10-30 报告）：控台的「当前演唱」名单随人数增加会换行，把走带和歌词往下推。现在名单只给读屏器（仍为 aria-live），「谁在唱」由五个槽位的亮边和「正在演唱」表示；「正在播放」行固定单行省略。宽屏网格改为 `grid-template-rows: auto 1fr auto`，控台变高时多出来的空间落在面板下方，不再均摊到头部行。实测展开歌词全文（控台 290 → 1266px）时槽位纹丝不动；去掉这条规则后，槽位从 400 移到 771px。
- 守卫变异测试：把旧舞台按钮放回去、隐藏标签行、加回版本试听条、加 `<select>`、去掉 `1fr` 行、让名单重新可见、让「正在播放」换行、新增第二个 `useSongAudition`，8 项都会 FAIL。
- 基线更新（10-30）：合入 master `26bec121`（L1–L7 线框减法），没有冲突。新的 `verify-box-on-line-browser` 在 m-song、d-song 各报 1 处：关闭状态的音量层 `.song-balance-panel` 仍被算作压在歌词分割线上（Chrome 里关闭的 `<details>` 内容依然参与布局）。现改为只在打开时渲染该层，歌曲与曲目页 4 个状态都不新增框线。
