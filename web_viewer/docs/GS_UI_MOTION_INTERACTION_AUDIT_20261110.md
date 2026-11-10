# 全站动效审计与交互指引（2026-11-10）

输入：master `c1b9f916`（#202 之后，代码同 `7123e47a`）。只读审计，本文不改任何源码。方法参考 [emilkowalski/skills](https://github.com/emilkowalski/skills)（18 个 skill，2026-11-10 已装到 `~/.claude/skills`，主 checkout 的 `.claude/skills` 同版本、未进 Git），但判断以本仓库已有规则为准：[GS_UI_CONSTITUTION.md](GS_UI_CONSTITUTION.md)「动效」「Surface 合同」、[GS_ARCHIVE_UX_MOTION_20261010.md](GS_ARCHIVE_UX_MOTION_20261010.md)、[GS_LOADING_SYSTEM_20261103.md](GS_LOADING_SYSTEM_20261103.md)、[RESPONSIVE_RELIABILITY_AUDIT_20261030.md](RESPONSIVE_RELIABILITY_AUDIT_20261030.md)。

本文分三部分：**一、审计结论**（已核对到行号的问题）；**二、交互指引草案**（用户批准后并入宪法，成为新的「交互」一节）；**三、执行批次**（每批自带文件、目标值、步骤和验证，交给任何 Agent 都能直接做）。

## 一、审计结论

### 1.1 总体判断

动效面很小，方向是对的。`web_viewer/src` 下 177 个 `.vue` / `.css` 里约 120 条 transition / animation 声明，大部分走 `gs-motion.css` 的阶梯（退场 120 / 换页 110 / 进场 180 / 底部抽屉 240，上限 240ms）。以下几项已经合格，不需要改：

- 没有 `transition: all`，没有 `scale(0)`，入场没用 `ease-in`。
- 换页只做透明度（从 .3 起）；浮层关闭时内容保留到淡出结束；原生 `<dialog>` 用 `@starting-style`；reduced-motion 只去位移、保留淡入淡出。
- 4 个无限循环都在表达状态，而且都有 reduced-motion 下的静态样子：加载圈 `GsLoadingIndicator.vue:87`、首页台词目录的「播放中」三条柱 `ArchiveImmersiveHome.vue:867`、通信「对方输入中」`MobileTypingIndicator.vue:31`、剧情「下一句」提示 `AdvUI.vue:142`（`#story-viewer` 由 `player-motion.css` 统一降级）。
- 谱面「长按解锁」：按住时填充线性走满，松手立即回弹（`ArchiveSongChartPreview.vue:574` 的过渡只写在 `.is-holding` 上），快慢不对称是对的。

所以这次不是「动画太多」，问题集中在四处：**触屏细节**、**令牌漂移**、**10-10 那批没接完的两个对话框**，以及**交互规则没有写成条文**（每个组件各写各的焦点环和悬停）。

### 1.2 发现（已逐条核对行号）

级别：**中** = 真机上能感觉到，或违反已有合同；**低** = 一致性 / 维护成本。「需真机」表示代码推理成立，但手感或浏览器行为要在 K60 / iPad 上确认。

| # | 级别 | 类别 | 位置 | 问题 | 处理（批次） |
|---|---|---|---|---|---|
| MX-01 | 中 · 需真机 | 触屏 | `src/components/gs/GsInfo.vue:2-3`、`:58` | ⓘ 用 `@mouseenter` / `@mouseleave` 管悬停。手机浏览器点按时会补发 mouseenter，所以第一次点按同时设了 `hover=true` 和 `pinned=true`；再点同一个 ⓘ 只把 `pinned` 清掉，`hover` 还是 true，气泡关不掉，只能点别处（iOS 还可能因为 mouseenter 改了内容而吞掉第一次 click）。按钮 24×24，低于全站 44px 命中区 | M2-a |
| MX-02 | 中 | 触屏 | 全站 110 条 `:hover` 不在 `@media (hover: hover)` 内（已包住的有 93 条）；高频例子 `ArchiveImmersiveHome.vue:823`、`:833` | 触屏点按后悬停样式会一直留着，直到点别处。首页台词「下一句 / 播放」点完一直是 `--gs-selected-bg` 薄荷底，看起来像「选中」，和「薄荷只标现在」冲突。同类：季节企划行、谱面存档行、摄影工具钮、播放器图标钮 | M0 棘轮 + M2-b |
| MX-03 | 中 · 需真机 | 触屏输入 | `picture-studio.css:27`、`:190`（即 RR-03）；疑似：`ArchiveLiveChartTable.vue:181`、`ArchiveScoreArchive.vue:123`、`ArchiveStoryReader.vue:150`（继承 14px）、`ArchiveHomeConsole.vue:140`、`StoryDiscovery.vue:122` / `:144` 先后顺序 | 输入框基础字号 13px，手机上有的组件提到 16px，有的没提，写法也不统一（`max-width: 760px` 和 `pointer: coarse` 都有）。iOS 聚焦小于 16px 的输入框会放大页面。iPad 宽度大于 760，按宽度写的提升覆盖不到它 | M3 |
| MX-04 | 低 | 令牌 | `ArchiveSongChartPreview.vue:558`、`:571`、`:574`；`ArchiveLiveChartTable.vue:252` | `--gs-duration-base` 全仓库没有定义，实际一直走回退值 200ms，缓动是裸 `ease`，脱离了阶梯，验证器也查不到 | M1-a |
| MX-05 | 低 | 单一来源 | `ArchiveSongChartPreview.vue:132`（`UNLOCK_PRESS_MS = 800`）与 `:574`（`800ms`） | 长按时长在 JS 和 CSS 各写一份，改一边进度条就和实际解锁时刻对不上 | M1-b |
| MX-06 | 低 | 令牌 | `GS_UI_TOKENS.css:115`、`:195`，`gs-motion.css:10`，`player-motion.css`；字面量：`ArchiveSongLyrics.vue:128,133,149`、`ArchiveSongCatalog.vue:372`、`ArchiveUnitCatalog.vue:70`、`LoadingScreen.vue:142`、`ArchiveImmersiveHome.vue:827`、`ChibiStageViewer.vue:4646` | 同一个「快进轻刹」有三套曲线：`--gs-ease-out`（.16,1,.3,1）、`--gs-motion-ease` / `--gs-current-motion`（.2,.7,.2,1）、`--player-ease-*`；另有 8 处手写时长 / 裸 `ease`（.12s / .15s / 160ms / .24s） | M1-c |
| MX-07 | 低 | 浮层合同 | `ArchiveImmersiveHome.vue:107`、`:149`、`:841-848`、`:872`；`archive-home-day.css:35-39` | 首页「场景设置」直接出现、直接消失；「台词目录」自写了 `cue-drawer-in` / `cue-sheet-in` / `cue-fade-in` 三个 keyframes，只有进场没有退场，也绕过了 verify-archive-motion 的 `--gs-*-travel` 规则。这就是 10-10 文档「边界」里写明没接的两个对话框 | M4 |
| MX-08 | 低 | 减法 | `src/core/StoryViewer.vue:1716-1717` | `.menu-slide-*` 没有任何 `<Transition name="menu-slide">` 在用，是死样式 | M1-d |
| MX-09 | 低 | 无障碍 | 全站 226 处 `:focus-visible` | 没有默认焦点环，每个组件各写一份：宽度有 `--gs-focus-ring` / 3px / 2px 三种，颜色有 `--gs-mint` / `--gs-mint-ink` / `#20cbb1`（`LoadingScreen.vue:141`）。漏写的组件就只剩浏览器默认环 | M5 |
| MX-10 | 低 | 令牌 | `App.vue:2793`（140ms）、`ArchiveShell.vue:558`（140ms）、`StoryViewer.vue:1567`（160ms）、`ArchiveStoryReader.vue:174`（180ms） | 「快的加载不闪提示」这个延迟在四处各写一遍，值也不同。加载系统定的是 140ms | M1-e |
| MX-11 | 维持 | 用途 | `ArchiveIdolDetail.vue:326-328` | 偶像落款 1.1s + .2s 延迟，用 `clip-path` 从上往下揭开，但签名是从左往右写的；元素没有按偶像加 key，所以组件第一次创建时播，同一实例里切换偶像不播，前后不一致。宪法写的是「不装饰」 | D2：用户决定维持现状 |
| MX-12 | 低 | 播放器 | `StoryViewer.vue:1623-1640`、`PlayerTopBar.vue:138` | 对白框进出各 280ms `ease` 加 `blur(2px)`，进退对称；进度条每次更新都有 180ms 过渡，会落后于实际进度。播放器以原生为准，门户阶梯不直接套用 | D3（执行） |

### 1.3 有意不采纳的通用建议

这些是 Emil skill 的默认建议，但本仓库已经定过，**不重开**：

| 通用建议 | 本仓库的决定 | 出处 |
|---|---|---|
| 列表、网格入场加 30–80ms stagger | 不做。内容从第一帧起就能点 | 10-10「刻意没做」 |
| 换页做位移或推入 | 只用透明度；页面根上的 transform 会让页内固定栏错位 | 宪法「动效」、10-10 第二轮 |
| 退场也用 ease-out | 退场 120ms 用 `--gs-ease-in`；时长短，曲线差别感觉不到，不为这个改阶梯 | `gs-motion.css` |
| 鼠标按下也 `scale(.97)` | 有悬停的设备靠悬停反馈；只有触屏做按压微缩 | 宪法「动效」按压一行 |
| 骨架屏、主色占位、blur-up | 延迟 140ms 的等待提示已够；主色占位要数据层支持，另立批次 | 10-10、加载系统 |
| View Transitions API | 换页由应用状态驱动，和滚动恢复、固定栏互相牵制；要单独评估 | 10-10 第二轮 |
| Bottom sheet 用 Vaul | Vaul 是 React 组件；本站是 Vue 加原生 `<dialog>`，默认不加依赖 | `package.json` 只有 4 个运行时依赖 |

## 二、交互指引（草案，待用户批准后并入宪法）

宪法的「动效」管怎么动，「Surface 合同」管浮层开关。下面补的是**输入方式和反馈**。每条写明为什么、怎么查。批准后作为「交互」一节放在「动效」之后，`verify:*` 列里写「（计划）」的检查由第三部分的批次补上。

### 2.1 输入方式

| 规则 | 为什么 | 怎么查 |
|---|---|---|
| 只是视觉变化的 `:hover` 一律写在 `@media (hover: hover) and (pointer: fine)` 里 | 触屏点按会触发 `:hover` 并一直留着，看起来像选中 | verify-design-tokens `hoverUngated` 棘轮（计划） |
| JS 里的悬停逻辑用 `pointerenter` / `pointerleave`，并且只认 `event.pointerType === 'mouse'`；不用 `mouseenter` / `mouseover` | 手机浏览器点按后会补发鼠标事件，组件会误以为在悬停 | verify-gs-primitives 禁止 `@mouseenter`（计划） |
| 触屏按压反馈只由 `gs-motion.css` 的全局规则负责；组件不另写 `:active` 缩放，除非要覆盖 | 一处定义，特异性为 0，组件写了就以组件为准 | 已有 verify-archive-motion |
| 命中区至少 44px。图标本身小于 44 时（ⓘ、行内关闭），在 `@media (pointer: coarse)` 里用 `::before` 向外扩，不改布局尺寸 | 宪法控件尺寸只保证了标准控件 | layout-integrity 采集（计划加阈值） |
| 触屏输入框（text、search、number、select、textarea）字号至少 16px，写在 `@media (pointer: coarse)` 里 | iOS 聚焦小于 16px 会放大页面。这是输入法问题，不是布局问题，所以按指针类型判断，不违反「布局只看宽度」；iPad 宽度大于 760 也要覆盖 | layout-integrity 严格断言（计划，M3） |

### 2.2 反馈与等待

| 规则 | 值 |
|---|---|
| 控件的颜色、底色变化 | `--gs-motion-feedback`（120ms）+ `--gs-ease-out` |
| 位置在屏幕上移动的指示物（分段滑块、开关钮、侧栏当前项） | `--gs-current-motion`（180ms）；不按 reduced-motion 关掉，位移短、能说明「选中挪到哪了」 |
| 等待提示（换页卡、播放缓冲、阅读骨架） | 延迟 `--gs-pending-delay`（140ms，计划新增）后淡入；比这快的加载不出现提示。档位只用加载系统的三档，不自己画转圈 |
| 进度类数值（播放进度、长按填充、倒计时） | 线性或不过渡；进度条不能落后于真实进度 |
| 长按确认 | 时长只在 JS 定义，经 CSS 变量传给样式；按住时线性填满，松手立即复位 |
| 循环动画 | 只允许表达持续状态：加载中、播放中、对方输入中、等待点按。每个都要有 reduced-motion 下的静态样子。新增循环要在 verify-archive-motion 的白名单里登记 |

### 2.3 焦点与浮层

- **默认焦点环**：`gs-motion.css` 按压规则旁边加一条零特异性的 `:where(...):focus-visible`，取 `--gs-focus-ring` + `--gs-mint` + `--gs-focus-offset`。组件只在需要内缩（横滚轨道、贴边列表）时覆盖 offset；不再整条重写。
- **浮层**：开关、焦点进出、Escape、背景点击继续按宪法「Surface 合同」。进出场只用 `gs-enter-*` / `gs-dialog-motion`，组件只改 `--gs-*-travel` 和 `--gs-*-duration`；不写私有 keyframes。
- **ⓘ 气泡**：只用 `GsInfo`。鼠标悬停立即打开，不加延迟；点按切换开关；点别处关闭；键盘聚焦打开，Escape 关闭。
- **底部抽屉手势**：手机底部抽屉支持下滑关闭（D1，用户 11-10 批准），同时保留按钮、背景、Escape。拖动期间 1:1 跟手、不加缓动；松手速度超过约 0.11 px/ms 或拖过高度 1/3 就关闭并顺着当前位置继续落下，否则弹回；向上拖越界时阻力递增；抽屉内滚动内容不在顶部时不接管手势。所有底部抽屉共用一个实现，不各写一份。

### 2.4 极端数据

新的列表、卡片、标题组件在合入前要过 `scripts/fixtures/responsive-real-extremes.json` 的最长样本，并在 `scripts/qa/responsive.html` 的 Worst case / Empty / One / Dense 状态下看一遍（那是 break-ui 的做法，本仓库已经有，不另建切换器）。标题最多两行、元信息一行截断，按宪法「手机端通用模式」。

### 2.5 本仓库怎么用这些 skill

| 场合 | 用哪个 | 在本仓库的调整 |
|---|---|---|
| 改了动效的 PR 自查 | `review-animations` | 规则冲突时以宪法为准；结论写进 PR 描述的 Before / After / Why |
| 新加一个动效 | `animate`，多元素一起动时 `choreograph` | 先查 `gs-motion.css` 有没有现成的类和令牌；不新建令牌族 |
| 动画掉帧 | `animation-performance` | 谱面 WebGL、舞台 Pixi 不适用，按各自的渲染审计 |
| 手机上感觉不对 | `mobile-native` | 必须真机：K60 Ultra（Edge + adb reverse + CDP）、iPad；Nox 模拟器只用于功能，不判手感 |
| 拖拽、抽屉、长按 | `gestures` | 不引入 Vaul；原生 `<dialog>` + Pointer Events |
| 比较几种界面方案 | `prototype` | 原型放 `docs/prototypes/` 或 Artifact，不进 App 运行时（宪法已有此条） |
| 极端数据 | `break-ui` | 用已有的 fixtures 和 responsive.html |
| 整站复查 | `improve-animations` | 计划写进 `docs/`，不新建 `plans/` 目录 |
| 删多余动效 | `remove-animations` | 本次没发现要整块删的，只有 MX-08 死样式 |
| 选库 | `pick-ui-library` | 默认不加依赖；要加时启动预算（`startup-policy.json`）先过 |

## 三、执行批次

拆成三个 PR，按顺序做；每个 PR 都从当时最新的 master 开 `portal/<日期>-<主题>` 分支。

| PR | 批次 | 依赖 | 预计改动 | 视觉变化 | 状态 |
|---|---|---|---|---|---|
| A | M0 守卫 + M1 令牌收口 | — | 2 个验证脚本、约 10 个组件 | 无或 ≤40ms | 未开始 |
| B | M2 触屏细节 + M3 输入字号 | A（棘轮基线） | GsInfo、约 10 个高频组件、layout-integrity | 只在触屏 | 未开始 |
| C | M4 首页对话框 + M5 焦点环 | A | ArchiveImmersiveHome、gs-motion.css | 首页两个对话框有进出场 | 未开始 |
| D | D1 底部抽屉下滑关闭 | C（台词目录先接入共享动效） | 一个共用组合式函数，接入各底部抽屉 | 只在手机底部抽屉 | 未开始 |
| E | D3 播放器进度条与对白框 | — | 、 | 播放器 | 未开始 |

通用验证（每个 PR 都跑）：`npm run build:check`（**不要直接跑 `vite build`**，会把语料拷进 dist）、`npm run verify:archive-motion`、`npm run verify:design-tokens`、`npm run verify:source-batch`；合并前在 LF worktree 里跑 `npm run gate:source`（`git -c core.autocrlf=false -c core.eol=lf worktree add --detach <目录> <分支>`）。新加或改动的断言要做变异测试：把修复改回坏版本，确认验证器失败，再还原。

### M0 守卫先行

目标：先把漂移挡住，后面的批次只需要把计数往下降。

1. `scripts/verify-design-tokens.mjs` 加两个逐文件棘轮（写法同现有的 `breakpoint` 指标：只减不增，迁移后 `--update` 下调）：
   - `hoverUngated`：`<style>` 和 `.css` 里含 `:hover` 的选择器，祖先 at-rule 中没有 `@media (hover: hover)` / `(any-hover: hover)` 的条数。基线约 110（93 条已包住）。
   - `motionLiteral`：`transition` / `animation` 值里出现数字时长（`\d+m?s`），或者出现裸 `ease` / `linear` / `ease-in` 的条数。豁免：`src/styles/gs-motion.css`（阶梯本身）、`src/components/TitleUI.vue`（原生标题演出，时长由 `--duration` 驱动）、`steps()`、`0s`。
2. `scripts/verify-archive-motion.mjs` 加：
   - **令牌必须有定义**：`src/**/*.{vue,css}` 中所有 `var(--gs-motion-*)`、`var(--gs-ease-*)`、`var(--gs-duration-*)` 都要在 `gs-motion.css` 或 `GS_UI_TOKENS.css` 里有声明（MX-04 这类会直接失败）。
   - **循环白名单**：`animation` 里带 `infinite` 的文件只能是 `GsLoadingIndicator.vue`、`ArchiveImmersiveHome.vue`、`MobileTypingIndicator.vue`、`AdvUI.vue`；除 `AdvUI.vue`（由 `player-motion.css` 覆盖）外，每个文件里都要有 `prefers-reduced-motion`。
3. 变异测试：临时把 `--gs-duration-base` 留在一处、加一个 `infinite`、加一条不包 media 的 `:hover`，三个都要失败。

### M1 令牌收口（PR A，零或极小视觉变化）

- **M1-a（MX-04）** `ArchiveSongChartPreview.vue:558`、`:571`、`:574` 的 `var(--gs-duration-base, 200ms) ease` 改成 `var(--gs-motion-enter) var(--gs-ease-out)`；`ArchiveLiveChartTable.vue:252` 的 `grid-template-rows var(--gs-duration-base, 200ms) ease` 改成 `grid-template-rows var(--gs-motion-enter) var(--gs-ease-out)`。200 → 180ms。
- **M1-b（MX-05）** 在 `ArchiveSongChartPreview.vue` 的 `.chart-unlock` 按钮上绑 `:style="{ '--unlock-press': `${UNLOCK_PRESS_MS}ms` }"`；`:574` 的 `background-size 800ms linear` 改成 `background-size var(--unlock-press) linear`。时长仍只在 `:132` 定义。
- **M1-c（MX-06）** 逐条替换，时长差都不超过 40ms：

  | 位置 | 现在 | 改成 |
  |---|---|---|
  | `ArchiveSongLyrics.vue:128` | `transform .15s ease` | `transform var(--gs-motion-feedback) var(--gs-ease-out)` |
  | `ArchiveSongLyrics.vue:133`、`:149` | `… .15s ease` | 同上，每个属性都换 |
  | `ArchiveSongCatalog.vue:372` | `background .15s ease` | `background-color var(--gs-motion-feedback) var(--gs-ease-out)` |
  | `ArchiveUnitCatalog.vue:70` | `transform .24s ease` | `transform var(--gs-motion-enter) var(--gs-ease-out)` |
  | `ArchiveImmersiveHome.vue:827` | `opacity .12s ease` | `opacity var(--gs-motion-feedback) var(--gs-ease-out)` |
  | `LoadingScreen.vue:142` | `opacity 160ms ease` | `opacity var(--gs-motion-enter) var(--gs-ease-out)` |
  | `ChibiStageViewer.vue:4646` | `opacity 160ms ease-out` | `opacity var(--gs-motion-enter) var(--gs-ease-out)` |

  曲线：把 `GS_UI_TOKENS.css:115` 的 `--gs-motion-ease` 改成 `var(--gs-ease-out)`，门户只留一条 ease-out。120ms 内两条曲线看不出差别，但要做一次逐帧对比（DevTools Animations 面板调到 10%）。`--gs-current-motion` 和 `--player-*` 不动：前者是「移动」角色，后者属于播放器那条线。
- **M1-d（MX-08）** 删除 `StoryViewer.vue:1716-1717` 两行 `.menu-slide-*`。删之前再 grep 一次 `menu-slide`，确认没有动态拼出来的 name。
- **M1-e（MX-10）** `gs-motion.css` 的 `:root` 加 `--gs-pending-delay: 140ms;`；`App.vue:2793` 和 `ArchiveShell.vue:558` 的 `140ms` 改用它（值不变）。`StoryViewer.vue:1567`（160ms）和 `ArchiveStoryReader.vue:174`（180ms）先保留，在文件里注释原因；要统一的话单独做手感确认。
- 不在范围：`TitleUI.vue`、谱面 WebGL、舞台 Pixi、`player-motion.css` 的令牌。

验证：通用验证；`npm run gallery:capture -- motion-m1`，与 master 的画廊截图对比，应该没有差异。

### M2 触屏细节（PR B）

- **M2-a（MX-01）** `src/components/gs/GsInfo.vue`：
  - `:2` 的 `@mouseenter="hover = true" @mouseleave="hover = false"` 改成 `@pointerenter="e => { if (e.pointerType === 'mouse') hover = true }" @pointerleave="e => { if (e.pointerType === 'mouse') hover = false }"`。
  - `:3` 的点按切换不变；补一条：触屏点按切换时，若 `pinned` 从 true 变 false，同时把 `hover` 置 false（防止 pointerType 判断失灵时关不掉）。
  - 命中区：`.gs-info-button` 加 `position: relative`；新增 `@media (pointer: coarse) { .gs-info-button::before { content: ''; position: absolute; inset: -10px; } }`。24 + 20 = 44px，不改布局。上线前检查 GsRow 等 ⓘ 和相邻控件之间至少隔 10px，否则扩出的区域会抢相邻控件的点按。
  - 验证：CDP `Emulation.setTouchEmulationEnabled` + `Input.dispatchTouchEvent` 点同一个 ⓘ 两次，第二次后 `[role=tooltip]` 消失；鼠标悬停仍立即出现。脚本里的 `click()` 没有用户激活，一定要用 CDP 真输入。真机：K60 Edge、iPad Safari 各点阅读器设置和谱面设置里的 ⓘ。
- **M2-b（MX-02）** 先迁这些高频触屏面，全部包进 `@media (hover: hover) and (pointer: fine) { … }`（写法同 `ArchiveUnitCatalog.vue` 里已有的那段）：
  - `ArchiveImmersiveHome.vue:823`、`:833`、`:863`
  - `ArchiveSeasonalCampaign.vue`（4 条）、`ArchiveScoreArchive.vue`（4 条）
  - `src/styles/picture-studio.css`（11 条；`:37` 里的 `[aria-expanded=true]` 是状态，要拆出来留在 media 外面）
  - `MobileChoiceRail.vue:131`、`:245`、`StageChoiceUI.vue:94`
  - `PlayerIconButton.vue:42`；`:58` 是 `:hover` 和 `:active` 合写，拆成两条，只把 `:hover` 放进 media
  - 每迁一个文件，就 `verify:design-tokens --update` 下调 `hoverUngated`。其余文件留给以后碰到时顺手迁，靠棘轮保证不再增加。

### M3 触屏输入字号（PR B）

1. 门禁：`scripts/verify-layout-integrity-browser.mjs` 已经会采集输入框字号，把它升级成严格断言：用 `Emulation.setTouchEmulationEnabled({ enabled: true, maxTouchPoints: 5 })` 模拟触屏（不够时再加 `Emulation.setEmulatedMedia` 的 pointer / hover 特性）。**先断言页面里 `matchMedia('(pointer: coarse)').matches === true`**，否则模拟没生效时 `pointer: coarse` 规则全不命中，门禁会对着桌面字号空跑。然后在 390 和 1024 两个宽度下，对 `scripts/qa/layout-routes.json` 的每条路由，检查所有可见的 `input:not([type=range],[type=checkbox],[type=radio],[type=color],[type=file]), select, textarea`，计算后的 `font-size` 都要 ≥ 16px。要看到的状态（筛选弹层、阅读搜索、摄影搜索）按需要补打开动作。
2. 修复：先跑门禁拿到真实名单，再逐个加 `@media (pointer: coarse) { <选择器> { font-size: var(--gs-text-subtitle); } }`。已知：`picture-studio.css:27` / `:190`（RR-03）；疑似：表 1.2 MX-03 那一行列出的几处。已经用 `max-width: 760px` 提升的不用改写，门禁过了就行。
3. 变异测试：把一处改回 13px，门禁必须失败。真机：iPad Safari 聚焦 `/live/` 搜索、摄影搜索、阅读器篇内查找，页面不放大。

### M4 首页两个对话框接入共享动效（PR C）

`src/components/archive/ArchiveImmersiveHome.vue`：

- 「场景设置」`:149` 和「台词目录」`:107` 的 `<dialog>` 都加 `gs-dialog-motion` 类。
- 台词目录在宽屏是右侧抽屉：在 `.scene-settings.cue-index` 上写 `--gs-dialog-travel: translateX(32px)`；手机（`@media (max-width: 760px)`，`:848` 那段）写 `--gs-dialog-travel: translateY(100%); --gs-dialog-duration: var(--gs-motion-sheet);`。
- 删掉 `:841` 里的 `animation: cue-drawer-in …`、`:848` 里的 `animation-name` / `animation-duration`、`:844-846` 的三个 keyframes，以及 `:872` 那条 reduced-motion（全局规则已处理）。
- 退场：两个对话框现在都是 `v-if`，关闭当帧就卸载，淡出没机会播。照 `ArchiveTerminalDialog.vue` 的做法（`contentOpen` + `EXIT_MS` 大于 `--gs-motion-exit`，先 `close()`，等淡出结束再卸载内容）。如果 `ArchiveTerminalDialog` 的头尾结构能直接套用，就直接复用它，不要再写一份。
- `scripts/verify-archive-motion.mjs` 照现有写法给这两个对话框加接线断言。
- 验证：Browser 逐帧采样（参照 10-10 文档：第 2 帧仍有位移、到时长后到位；关闭第 1 帧内容仍在）。手机 390 下台词目录从底边升起。

### M5 默认焦点环（PR C）

- `src/styles/gs-motion.css` 按压规则后面加：
  ```css
  :where(button, a[href], summary, input, select, textarea, [role="button"], [role="tab"], [role="option"], [tabindex]:not([tabindex="-1"])):focus-visible {
    outline: var(--gs-focus-ring) solid var(--gs-mint);
    outline-offset: var(--gs-focus-offset);
  }
  ```
  `:where()` 特异性为 0，现有 226 处组件规则照样生效，所以本批没有视觉变化，只补上漏写的组件。
- `LoadingScreen.vue:141` 的 `3px solid #20cbb1` 改成令牌（它还被 design-tokens 的十六进制颜色棘轮记着）。
- 其余组件里的焦点环不批量删；以后碰到哪个文件，就顺手删掉和默认值完全相同的那条。
- 验证：键盘 Tab 走一遍首页、目录、详情、阅读器，每个可聚焦元素都有环；深色侧栏和舞台上薄荷环可见。

### 用户决定（2026-11-10）

用户答复：D1 支持，D2 不改，D3 可以。D1、D3 分别作为 PR D、E 执行；D2 维持现状，MX-11 不再跟进。

- **D1 底部抽屉下滑关闭**：筛选、阅读设置、舞台编排、台词目录这几个手机底部抽屉，**支持**。做法：用 `gestures` skill，拖动期间 1:1 跟手、不加缓动；松手速度超过约 0.11 px/ms 或拖过高度 1/3 就关闭，否则弹回；向上拖越界时阻力递增；在 `<dialog>` 上用 Pointer Events，滚动内容在顶部时才接管手势。抽屉范围在开工时按实际代码清点（宽屏的右侧抽屉、居中对话框、新手引导不接）。拖动阈值、回弹曲线最终以 K60 / iPad 手感为准，合入前在 PR 描述里写明真机是否已测。
- **D2 偶像落款动画（MX-11）**：**维持现状**（用户决定）。原备选：①保留，改成从左往右揭开（`clip-path: inset(0 100% 0 0)` → `inset(0)`）、≤600ms、去掉 .2s 延迟，按偶像加 key，每次换偶像都播；②去掉动画，直接显示；③维持现状。
- **D3 播放器演出（MX-12）**：对白框 280ms 对称加 blur、进度条 180ms 过渡，**执行**。进度条是本站自己的界面，按 2.2「进度类数值线性或不过渡」改；对白框淡入淡出先找原生证据（Ghidra 反编译输出里 ADV 对白框的显示 / 隐藏时长），找到再对齐，找不到就不改，并记录查过哪里。单独一个 PR，不和门户批次混在一起。

## 附：普查方法

- 动效声明：逐行抓 `.vue` / `.css` 里的 `transition*` / `animation*`，记下时长、缓动和引用的令牌（约 120 条，keyframes 25 个）。
- 悬停：解析 `<style>` 的花括号栈，判断每个 `:hover` 选择器的祖先 at-rule 里有没有 `(hover: hover)`。是启发式统计，M0 的棘轮要按同一算法实现，计数才对得上。
- 其余都是 grep 后逐条打开源码核对。没有启动 Browser，也没有上真机；表中标「需真机」的结论来自代码推理。
