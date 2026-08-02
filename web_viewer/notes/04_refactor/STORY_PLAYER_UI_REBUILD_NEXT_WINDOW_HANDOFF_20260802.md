# 剧情阅读器 UI 完整重构：新窗口交接（2026-08-02）

## 0. 本文定位

本文是下一窗口开展 Story Player 前端升级的唯一执行入口。它合并两份已经确认的设计指导：

1. 播放器主框架、ADV 对话、安全区、调试态和展示组件拆分；
2. Talk、Call、Choice 的手机剧情呈现系统，包括通信上下文、个人/组合主题、屏外回复选择和响应式布局。

这不是 Story Runtime 第二次架构重写，也不是只替换 CSS 皮肤。目标是在保留现有播放行为和 Runtime owner 的前提下，重建一套完整、可公开展示、可响应桌面与移动端的剧情阅读界面。

一句话定义：

> 先把播放器壳层、ADV 和调试入口升级为统一展示系统，再把手机剧情从居中的通用手机弹窗升级为具有组合色顶栏、个人/组合背景、Talk 与 Call 独立场景、屏外回复选择和连续 choice 上下文的原作风格通信系统；运行时分支、音频和 publication 不在本轮重构范围内。

本文中的“UI PR 1 / UI PR 2 / UI PR 3”是本次前端重构的提交阶段名称，不等同于项目优先级中的 P2-A strict-v2 promotion 或 P2-B 2–4 小时长稳。

## 1. 新窗口首先只读核验

不要复用本文记录的 branch、HEAD、worktree 或 PID 作为长期事实。先执行：

```powershell
Set-Location E:\Web_build\SideM_Archived
git status -sb
git branch --show-current
git rev-parse HEAD
git rev-parse origin/master
git log --oneline --decorate -8
git worktree list --porcelain
Get-NetTCPConnection -State Listen -LocalPort 5174 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

然后完整阅读：

1. `web_viewer/docs/AGENT_START_HERE.md`
2. `web_viewer/docs/PROJECT_MAP.md`
3. 本文
4. `web_viewer/notes/03_audit/GS_ARCHIVE_P0_ARCHITECTURE_CLOSEOUT_20260730.md`
5. `web_viewer/notes/03_audit/GS_ARCHIVE_PRODUCT_HISTORY_RECONCILIATION_20260730.md`
6. `web_viewer/notes/04_refactor/STORY_VIEWER_RUNTIME_REFACTOR_DESIGN_20260718.md`
7. `web_viewer/notes/04_refactor/STORY_POST_MERGE_HANDOFF_20260723.md`
8. `web_viewer/notes/03_audit/STORY_STRUCTURED_BILINGUAL_UI_20260722.md`
9. `web_viewer/notes/03_audit/STORY_RUNTIME_REAL_AUDIO_ACCEPTANCE_20260729.md`

2026-08-02 写本文时的事实快照仅供定位：

- checkout：`codex/archive-breadcrumb-spa-p1`
- HEAD：`8db60f2a98e37b83c5ce9e0f74ffd80fab46b817`
- upstream 与本地 HEAD 一致，worktree 干净；
- `5174` 当时由 Node PID `16000` 监听；
- P0 已完成；P2-B 2–4 小时长稳仍为 **NOT EXECUTED**。

下一窗口必须以实时 Git 和 listener 事实覆盖这组快照。功能基线至少应包含 `8db60f2` 或其后继合并提交；若该分支已经进入 master，从最新 master 建独立 `codex/` 分支；若尚未进入 master，不要悄悄从旧 master 开工，应先明确以哪个已验证提交作为 UI 分支基线。

建议分支名：

```text
codex/story-player-ui-pr1
codex/story-player-mobile-ui-pr2
codex/story-player-ui-pr3
```

每个 PR 独立、可回滚，不把三个阶段压成一个大提交。

## 2. 当前代码事实与问题定义

### 2.1 Runtime ownership 不变

当前 owner 边界是：

- `src/core/StoryViewer.vue`：播放协调、导航、Auto/Skip、菜单、Backlog、完成态与展示路由；
- `src/core/story-runtime/useStoryRuntimeCues.js`：cue 调度入口；
- `src/core/story-runtime/StoryClock.js`：逻辑时间；
- `src/core/story-runtime/StoryAudioSession.js`：Voice/SE/BGM/Ambient 生命周期；
- `src/components/SpineStage.vue` 与 Pixi adapter：舞台渲染适配，不拥有第二条时间线。

UI 重构不得改变这些 owner，也不得重新引入并行 timer、并行音频 owner 或退役 runtime 路径。

### 2.2 当前展示层的已核事实

`src/core/StoryViewer.vue` 当前直接挂载：

```text
AdvUI
MobileUI
CallUI
ChoiceUI
TitleUI
SynopsisUI
TextTimeUI
StoryBacklog
SpineStage
```

同时直接负责顶栏、底栏、菜单、完成页、UI 隐藏与 debug 输出，展示职责过重。

当前明确缺陷：

- 底栏仍直接显示 `currentStep.type`，正常页面会看到 `ADV` 等内部类型；
- `SpineStage.debugControls` 默认值为 `true`；`StoryViewer` 挂载时没有传入关闭值，因此 `DBG` 会进入正式展示；
- `StoryViewer` 已有 `runtimeDebug=1` 的显式开关，可作为唯一 debug opt-in；
- `AdvUI` 与底部导航各自固定定位，没有共享安全区，容易重叠；
- ADV、Choice、Talk、Call、Backlog、设置和完成页没有统一 token；
- 多处固定宽高对 1366×768、平板、390px、浏览器缩放和双语长文本不稳定。

### 2.3 手机剧情的已核事实

当前模板逻辑是：

```vue
<MobileUI v-show="currentStep.type === 'talk' || currentStep.type === 'talk_stamp'" />
<CallUI v-if="currentStep.type === 'call'" />
<ChoiceUI v-if="currentStep.type === 'choice'" />
```

因此进入 `choice` 时手机场景会消失，通用 Choice 取代通信画面。

`MobileUI.vue` 已同时导入：

```js
getMobileBgUrl(charaId)
getUnitMobileBgUrl(unitId)
```

当前 `bgUrl` 只要解析到 unit，最终始终选择 unit background。经 committed PNG 与截图描述交叉核对，这一默认行为与 FRAME 绿条、THE 虎牙道虎纹、C.FIRST 三角背景一致；真正缺少的是 Talk/Call/显式 presentation 对两类背景的消费者契约，而不是“个人 Talk 没用个人背景”。

现有基础可以保留：

- `chara_id -> unit_code` 与 16 组合映射；
- `MobileUI` 的消息历史、stamp、emoji 与 `choiceTexts` 注入；
- `CallUI` 的角色头像和 mobile background fallback；
- 现有结构化双语 text view；
- History、Backlog restore 和直接 step 打开能力。

## 3. 总体设计决定

### 3.1 视觉方向

采用 **70% 原游戏辨识度 + 30% GS Archive 档案品牌**：

- 保留全屏舞台、姓名牌、大对白框、EP 编号、AUTO/SKIP 与 SideM 青蓝强调；
- 使用更轻的玻璃表面、统一圆角/阴影/间距和悬浮控制坞；
- 不把原作截图直接作为 UI 背景；
- 不做普通视频网站播放器；
- 手机剧情保留倾斜设备、角色/组合背景和屏外回复选项的辨识度。

### 3.2 共享播放器设计系统

建议新增：

```text
src/components/player/
  PlayerTopBar.vue
  PlayerProgress.vue
  PlayerControlDock.vue
  PlayerSettingsDrawer.vue
  PlayerCompletionPanel.vue
  PlayerIconButton.vue
  PlayerSurface.vue

src/styles/
  player-tokens.css
  player-motion.css
```

最先定义共享安全区，而不是继续分别调 `bottom`：

```css
:root {
  --player-top-safe: 68px;
  --player-dock-height: 52px;
  --player-dock-bottom: 14px;
  --player-dialogue-gap: 14px;
  --player-dialogue-bottom: calc(
    var(--player-dock-bottom)
    + var(--player-dock-height)
    + var(--player-dialogue-gap)
    + env(safe-area-inset-bottom)
  );
}
```

ADV、Choice、Talk、Call、Spine 人物安全区域和移动端底部控件都引用同一组 token。

#### 3.2.1 参数的证据等级

本文后续给出的数值按以下等级使用：

| 等级 | 含义 | 是否可直接当最终值 |
| --- | --- | --- |
| `S` | 原游戏截图中可以直接确认的构图、相对尺寸或颜色职责 | 构图可；精确色号仍需取样 |
| `A` | 从仓库 committed PNG / 现有产品色板取样得到 | 可作为色彩证据，但不等于官方色票 |
| `I` | 为第一版实现指定的工程初值 | 可以开工，必须经四视口截图回调 |

禁止把 `I` 写成“原作精确参数”。如果后续获得无压缩截图或原始 UI 纹理，应把色号、取样文件、像素区域和日期写回主题目录。

#### 3.2.2 Player 基础色板初值

以下色板综合现有 Archive 青绿色、当前 Story UI 和截图所示青蓝强调，作为 UI PR 1 的实现初值：

```css
:root {
  --player-ink-950: #061521;
  --player-ink-900: #18242b;
  --player-ink-700: #526174;
  --player-ink-500: #7b8993;
  --player-paper: #fafcfc;
  --player-paper-glass: rgba(250, 252, 252, 0.96);
  --player-stage-scrim: rgba(3, 12, 20, 0.28);
  --player-panel-dark: rgba(6, 21, 33, 0.72);
  --player-panel-dark-hover: rgba(6, 21, 33, 0.84);
  --player-accent: #38b8a7;
  --player-accent-strong: #0f6f68;
  --player-accent-soft: #bff8ef;
  --player-accent-line: rgba(56, 184, 167, 0.48);
  --player-border-light: rgba(255, 255, 255, 0.62);
  --player-border-dark: rgba(255, 255, 255, 0.28);
  --player-focus-inner: #ffffff;
  --player-focus-outer: #38b8a7;
  --player-shadow-dialogue:
    0 18px 48px rgba(3, 12, 20, 0.22),
    0 2px 10px rgba(3, 12, 20, 0.10);
  --player-shadow-control: 0 10px 28px rgba(3, 12, 20, 0.30);
}
```

对比度基线：`#FAFCFC / #18242B` 约 `15.38:1`；白字放在 `#0F6F68` 上约 `6.01:1`。`#159087` 可以继续用于浅底文字/边框，但不作为小号白字的实心按钮底色，因为白字对比约 `3.91:1`。

#### 3.2.3 尺寸、圆角和间距初值

```css
:root {
  --player-space-1: 4px;
  --player-space-2: 8px;
  --player-space-3: 12px;
  --player-space-4: 16px;
  --player-space-5: 20px;
  --player-space-6: 24px;
  --player-space-8: 32px;
  --player-space-10: 40px;
  --player-radius-control: 14px;
  --player-radius-surface: 22px;
  --player-radius-dialogue: 28px;
  --player-radius-pill: 999px;
  --player-control-sm: 40px;
  --player-control-md: 48px;
  --player-control-lg: 52px;
  --player-hit-min: 44px;
  --player-font-ui-xs: 11px;
  --player-font-ui-sm: 13px;
  --player-font-ui-md: 15px;
  --player-font-dialogue: clamp(18px, 1.35vw, 22px);
  --player-font-dialogue-mobile: clamp(16px, 4.2vw, 19px);
  --player-font-secondary: 0.82em;
  --player-line-dialogue: 1.7;
  --player-line-secondary: 1.6;
}
```

统一规则：图标控制的可见尺寸可以是 40px，但 hit target 不得小于 44×44px；正文不小于 16px；次级中文默认 `0.82em`，不得低于 13px。

#### 3.2.4 动效初值

```css
:root {
  --player-motion-fast: 120ms;
  --player-motion-base: 180ms;
  --player-motion-panel: 240ms;
  --player-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --player-ease-emphasized: cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

- Hover 位移最大 `-2px`；
- Active 缩放不低于 `0.98`；
- 面板进入不超过 `240ms`；
- 选择确认整段视觉停留建议 `220–320ms`，但不得阻塞既有 Runtime action；
- `prefers-reduced-motion: reduce` 下取消位移、旋转过渡和缩放，只保留 `80–120ms` opacity。

### 3.3 只拆展示，不迁移行为

`StoryViewer.vue` 在本轮继续持有状态和 action，只把展示拆给子组件：

```vue
<PlayerTopBar
  :episode-label="currentEpisodeLabel"
  :current="playableStepNumber"
  :total="playableStepTotal"
  :language="langLabel"
  @back="emit('back')"
  @language="cycleLanguage"
  @menu="menuOpen = true"
/>

<PlayerControlDock
  :auto-enabled="autoEnabled"
  :skip-enabled="skipEnabled"
  :previous-disabled="isFirstStep"
  @previous="goPrev"
  @next="goNext"
  @auto="toggleAuto"
  @skip="toggleSkip"
  @backlog="openBacklog"
/>
```

子组件不得自行推进 step、持有第二份历史、创建 timer 或直接控制 AudioContext。

## 4. UI PR 1：展示态清理与主界面升级

建议标题：

```text
feat(player): rebuild the story player shell and dialogue surfaces
```

### 4.1 范围

1. 删除正式 UI 中的 `currentStep.type` 标签；
2. 将 `SpineStage.debugControls` 默认关闭；
3. `StoryViewer` 只在 `runtimeDebug=1` 时显式传入 debug controls；
4. 新增 player tokens、motion 和安全区；
5. 拆出并重做顶部浮动栏；
6. 拆出居中的悬浮控制坞；
7. 将 `AdvUI` 改为自适应高度，不再靠固定 144/190px；
8. 解决对白、控制坞与 safe area 重叠；
9. 保持所有播放行为、键盘动作、Auto/Skip、Backlog、语言和完成态不变。

### 4.2 视觉契约

顶部不再是横跨全屏的黑条：

- 左上：半透明返回按钮；
- 顶部中央：EP、可播放进度与细进度条；
- 右上：语言与菜单；
- 背景只存在于控件自身范围。

桌面 ADV 建议：

```css
width: min(1040px, calc(100vw - 72px));
min-height: 142px;
max-height: 34vh;
padding: 34px 44px 26px;
border-radius: 28px;
```

固定高度改为内容自然撑开。姓名牌约 42px 高，正文日文约 20–22px；实际值应通过 1366×768、四行文本和双语截图回调，不得只凭单张桌面图定稿。

底部控制坞顺序：

```text
上一句 | AUTO | 回看 | SKIP | 下一句
```

移动端可以图标化，但必须保留 `aria-label`、title、键盘焦点和明确的 AUTO/SKIP 开启态。

UI PR 1 的组件参数初值：

| 元素 | 桌面初值 | 390px 初值 |
| --- | --- | --- |
| TopBar 距边 | `16–20px` | `8px + safe-area` |
| 顶部按钮 | `44×44px`, radius `14px` | `44×44px`, radius `12px` |
| 进度胶囊 | 高 `44px`, 横向 padding `16px` | 高 `40px`, padding `12px` |
| Dialogue 宽 | `min(1040px, 100vw - 72px)` | `calc(100vw - 20px)` |
| Dialogue padding | `34px 44px 26px` | `28px 18px 18px` |
| Dialogue radius | `28px` | `20px` |
| 姓名牌 | 高 `42px`, radius `14px` | 高 `36px`, radius `12px` |
| 控制坞 | 高 `52px`, gap `6–8px` | 高 `48px`, gap `4px` |
| Dialogue 最大高度 | `34vh` | `42vh`，内部滚动仅作长文 fallback |

控制坞背景使用 `--player-panel-dark`，边框 `--player-border-dark`，阴影 `--player-shadow-control`；对话框使用 `--player-paper-glass`、`--player-ink-900` 和 `--player-shadow-dialogue`。不要在对白框外再叠第二圈强发光。

### 4.3 UI PR 1 明确非目标

- 不改 StoryClock、StoryAudioSession 或 cue 调度；
- 不改分支选择语义；
- 不重做 MobileUI/CallUI 内部结构；
- 不改 compiler、schema、translation overlay 或 publication；
- 不宣称 P2-B 长稳完成。

## 5. UI PR 2：手机剧情呈现与上下文选择

建议标题：

```text
feat(player): rebuild mobile story presentation and contextual choices
```

UI PR 2 不是“把 Talk、Call、Choice 换成统一皮肤”，而是建立完整通信呈现系统。

### 5.1 四项核心责任

1. 重做短信/聊天页面；
2. 重做电话/手机对话页面；
3. 将 Stage Choice 与 Mobile Choice 按剧情语境拆开；
4. 在通信 `choice` 期间保持手机场景连续。

### 5.2 主题与背景解析

新增集中管理、保留证据来源的主题目录：

```text
src/data/mobileVisualThemes.js
```

建议结构：

```js
export const MOBILE_UNIT_THEMES = {
  '06fra': {
    primary: '#...',
    onPrimary: '#ffffff',
    darkPrimary: '#...',
    source: 'original-mobile-ui-reference',
  },
}
```

颜色职责必须分开：

| 用途 | 来源 |
| --- | --- |
| 手机顶栏 | 所属组合代表色 |
| 制作人气泡与 typing | 固定系统绿色 |
| 手机外部选择 | 固定青绿/荧光绿 |

不得用组合色覆盖所有交互元素。具体色值必须从可追溯截图或 UI 纹理取样，不凭印象写死。

#### 5.2.1 2026-08-02 committed 资产取样

对三张示例组合背景和组合 logo 进行只读 Median Cut 主色取样，得到：

| Unit | committed 资产证据 | 背景主色 | Logo 强调色 |
| --- | --- | --- | --- |
| FRAME `06fra` | `image_unit_mobile_background_06fra.png` | `#F0F0F0`, `#96B48B`, `#626160`, `#F9BF60` | `#00C814` |
| THE 虎牙道 `13the` | `image_unit_mobile_background_13the.png` | `#454545`, `#2E2E2E`, `#585858` | `#242843` |
| C.FIRST `16cfi` | `image_unit_mobile_background_16cfi.png` | `#DDDFE6`, `#65CBCA`, `#AFBBBE` | `#00C7B7`, gold `#CAA954` |

这些是 PNG 像素聚类结果，不是官方色票。Logo 原色中的 FRAME `#00C814` 与 C.FIRST `#00C7B7` 不适合作为小号白字背景，因此第一版顶栏使用保留色相、压低明度的无障碍版本：

```js
export const MOBILE_UNIT_THEMES = {
  '06fra': {
    primary: '#087A2C',
    sourcePrimary: '#00C814',
    onPrimary: '#FFFFFF',
    backgroundKey: '06fra',
    evidence: 'unit-logo + unit-mobile-background',
  },
  '13the': {
    primary: '#242843',
    sourcePrimary: '#242843',
    onPrimary: '#FFFFFF',
    backgroundKey: '13the',
    evidence: 'unit-logo + unit-mobile-background',
  },
  '16cfi': {
    primary: '#007C73',
    sourcePrimary: '#00C7B7',
    onPrimary: '#FFFFFF',
    accent: '#CAA954',
    backgroundKey: '16cfi',
    evidence: 'unit-logo + unit-mobile-background',
  },
}
```

白字对比度约为：FRAME `5.48:1`、THE 虎牙道 `14.39:1`、C.FIRST `5.08:1`。如果实际截图证明顶栏使用更亮原色，应保留亮色识别条/图标，把标题文字放在独立深色层上，而不是牺牲文本对比。

#### 5.2.2 组合背景勘误

截图分析中描述的：

- 信玄“绿色竖条和徽记”；
- タケル“深灰虎纹”；
- 百々人“青黄三角几何”；

与 committed 的 `06fra / 13the / 16cfi` **组合背景**逐项吻合，不是三人的个人背景。对应个人 PNG 实际为：

- `016sei`：健身房照片 + 灰色内容底板；
- `038tak`：拉面碗照片 + 灰粉内容底板；
- `048mom`：金色圆点 + 米白内容底板。

因此不得在 PR2 中直接把当前 unit background 全量替换为 character background。修订后的解析顺序是：

```text
显式 presentation/background 字段
-> 经 fixture 证明的场景类型规则
-> Talk 默认 unit mobile background
-> Call/personal-photo 场景默认 character mobile background
-> 中性 fallback
```

UI PR 2 的 fixture 必须记录每个截图属于 Talk 还是 Call、个人还是群聊，并确认背景消费者。只有证据确认后，才能继续细分某类个人 Talk 是否使用 character background。

实现前的候选背景契约：

```text
Talk -> getUnitMobileBgUrl(unitCode)，除非显式 presentation 证明个人背景
Call/personal-photo -> getMobileBgUrl(primaryCharaId)
组合群聊 -> getUnitMobileBgUrl(unitCode)
NPC/无法解析 -> 中性 fallback
```

当前 `scenarioId.startsWith('8_2_')` 可作为已知 group-talk 信号，但实现前必须用 corpus fixture 验证，不能把“出现多个偶像”直接当作群聊。同步核对 `UnitNameMap` 的两位 unit code 与 `AssetResolver` 注释中的旧三位示例，补充路径 verifier。

### 5.3 通信表现上下文

新增纯表现投影：

```text
src/core/story-runtime/CommunicationPresentationContext.js
```

建议输出：

```js
{
  mode: 'talk' | 'call' | null,
  phase: 'dialogue' | 'choice' | 'reply',
  unitCode: null,
  primaryCharaId: null,
  isGroup: false,
}
```

它可以读取当前 step、已选择的真实 history path、线性前驱和未来显式 `presentation_context`，但它只决定“展示哪种场景”，不拥有剧情状态。

解析优先级：

1. 当前 step 明确为 `talk`、`talk_stamp` 或 `call`；
2. 当前为 `choice` 时，从实际历史路径寻找最近通信 step；
3. 遇到 `adv`、`title`、`synopsis`、`text_time` 或明确场景边界时停止继承；
4. 直接深链到 choice 时，以线性前驱为 fallback；
5. 未来若存在显式 `presentation_context`，优先显式字段。

必须覆盖正常前进、goPrev、Backlog restore、直接深链 choice 和普通 ADV choice，防止错误继承。

### 5.4 组件结构

```text
src/components/mobile/
  MobileSceneLayout.vue
  MobileDeviceFrame.vue
  MobileChatScene.vue
  MobileChatHeader.vue
  MobileMessageList.vue
  MobileMessageBubble.vue
  MobileTypingIndicator.vue
  MobileCallScene.vue
  MobileCallProfile.vue
  MobileChoiceRail.vue
  MobileExternalReply.vue

src/components/choices/
  StageChoiceUI.vue
```

`MobileChoiceRail` 只保留一份实现，推荐位于 `components/mobile/`；不要同时在 `components/mobile/` 与 `components/choices/` 各建同名组件。

职责：

- `MobileSceneLayout`：整体构图、背景降对比、桌面/平板/移动端布局；
- `MobileDeviceFrame`：边框、圆角、阴影、倾斜、裁切；
- `MobileChatScene`：顶栏、消息、stamp、emoji、typing、制作人回复注入；
- `MobileCallScene`：主题视觉、头像姓名、对白卡、外部回复；
- `MobileChoiceRail`：1/2/3/4+ 选项排布与选中动画，不自行判断场景；
- `StageChoiceUI`：普通 ADV/场景内选择。

建议挂载：

```vue
<MobileChatScene
  v-if="communicationContext.mode === 'talk'"
  :phase="communicationContext.phase"
  :options="mobileChoiceOptions"
/>

<MobileCallScene
  v-else-if="communicationContext.mode === 'call'"
  :phase="communicationContext.phase"
  :options="mobileChoiceOptions"
/>

<StageChoiceUI
  v-else-if="currentStep.type === 'choice'"
/>
```

### 5.5 Talk 视觉与行为

桌面横屏：手机在左、轻微逆时针倾斜、可轻度超出上下边界，选择在右；背景仍可辨认但降低对比。

```css
.mobile-device {
  width: clamp(390px, 52vw, 720px);
  height: min(92vh, 900px);
  transform: translate(-4%, 1%) rotate(-3.5deg);
}
```

不得为了复刻截图写死单一分辨率。重点：

- 组合色顶栏只承担身份识别；
- 偶像消息左侧头像、姓名和白色气泡；
- 制作人消息右侧系统绿色，不显示制作人头像/名称；
- stamp 保持透明，不塞进白色气泡；
- emoji 不撑大整行；
- typing indicator 只表示视觉等待，不驱动状态机；
- 选择后，现有 `choiceTexts` 继续注入制作人消息，补充连续过渡与滚动到底部。

Talk 参数初值：

| 元素 | `>=1100px` | `700–1099px` | `<700px` |
| --- | --- | --- | --- |
| Device 宽 | `clamp(390px, 52vw, 720px)` | `min(60vw, 560px)` | `100%` |
| Device 高 | `min(92vh, 900px)` | `min(88vh, 760px)` | `100dvh` |
| 倾斜 | `-3.5deg` | `-1.5deg` | `0` |
| 外框 radius | `34px` | `28px` | `0–18px` |
| 外框厚度 | `8px` | `6px` | `0–2px` |
| 顶栏高度 | `64px` | `58px` | `56px + safe-area-top` |
| 消息区 padding | `20px 22px 28px` | `16px 18px 24px` | `14px 12px 96px` |
| 偶像头像 | `42px` | `38px` | `36px` |
| 气泡最大宽 | `70%` | `74%` | `82%` |
| 气泡 padding | `11px 14px` | `10px 13px` | `9px 12px` |
| 气泡 radius | `16px` | `15px` | `14px` |
| Stamp 最大宽 | `180px` | `156px` | `42vw`, 最大 `148px` |

Talk 表面色：偶像气泡 `#FFFFFF` / 正文 `#18242B`；制作人气泡 `#167A43` / 白字（约 `5.39:1`）；消息姓名在浅背景用 `#526174`，在深色 THE 虎牙道背景上必须增加半透明浅色 label 或使用 `#F4F7F7`，不能只靠 text-shadow。

### 5.6 Mobile Choice

`StageChoiceUI` 与 `MobileChoiceRail` 必须分离。手机回复项在设备外右侧，尾巴朝向手机；颜色固定为 teal/lime，不随组合变化。

| 数量 | 布局 |
| ---: | --- |
| 1 | 单个大气泡，偏下居中 |
| 2 | 上下双气泡 |
| 3 | 三个紧凑气泡 |
| 4+ | 限高滚动，不得溢出 |

交互必须覆盖 hover、focus、active、selected、防重复点击和 `prefers-reduced-motion`。双语在同一气泡上下排布，不拆成两份选项。

第一版 choice token：

```css
:root {
  --mobile-choice-teal: #007a72;
  --mobile-choice-teal-text: #ffffff;
  --mobile-choice-lime: #b7db3b;
  --mobile-choice-lime-text: #17331f;
  --mobile-choice-glow: rgba(105, 217, 199, 0.28);
}
```

teal/白字约 `5.22:1`；lime/深绿字约 `8.63:1`。截图若显示 lime 使用白字，可在视觉复刻模式保留白色大字，但默认无障碍实现应使用深绿文字，或把 lime 仅作为外圈高亮、内部使用更深底色。

选项参数初值：

- 宽：`clamp(220px, 26vw, 360px)`；
- 最小高度：单语 `64px`，双语 `78px`；
- padding：`14px 22px 14px 20px`；
- radius：`18px`，尾巴宽 `18px` / 高 `24px`；
- 双项 gap：`18px`；三项 gap：`10px`；
- focus：`0 0 0 2px #fff, 0 0 0 5px #38b8a7`；
- hover：`translateY(-2px)`；active：`scale(0.98)`；
- 4+ 列表最大高度：`min(62vh, 520px)`。

### 5.7 Call 视觉与资源审计

Call 不与 Talk 强行合并内部结构，但共享 device frame、choice rail 与 token。

手机内部：

1. 顶部 42%–50% 主题视觉区；
2. 圆形头像与姓名胶囊；
3. 低饱和内容底板；
4. 自适应白色对白卡；
5. 手机外部选择；
6. 支持 `externalReplyText` 表示制作人屏外回复。

在写 UI 前先审计 call step/compiled presentation 是否已有：

```text
image id
still/photo id
scene icon
background override
compiled presentation resource
```

资源回退顺序：

```text
call 专用图片
-> 当前 step presentation image
-> scene icon/background
-> 角色 mobile background
-> 中性占位底图
```

没有证据时不得硬编码无关图片，也不得顺带发布新资源。

Call 参数初值：

| 元素 | 桌面 | 390px |
| --- | --- | --- |
| Device 宽 | `clamp(380px, 48vw, 650px)` | `100%` |
| Device 高 | `min(90vh, 860px)` | `100dvh` |
| 主题视觉区 | `46%`，允许 `42–50%` 回调 | `42%` |
| 头像 | `96px` | `76px` |
| 姓名胶囊 | 高 `34px`, padding `0 16px` | 高 `30px`, padding `0 13px` |
| 内容底板 | `#C4BABD` 初值 | 同色，按图片对比度微调 |
| 对白卡宽 | `88%` | `calc(100% - 24px)` |
| 对白卡 padding | `18px 20px` | `15px 14px` |
| 对白卡 radius | `16px` | `14px` |

`#C4BABD` 来自 `038tak` committed personal mobile background 的主要内容底板取样，只是 Call 灰粉底板的第一版候选；最终应针对各角色图片验证是否需要主题化或统一中性底板。

### 5.8 响应式

- `>=1100px`：原作式倾斜手机在左，选择在右；
- `700–1099px`：缩小设备、减小倾斜、选择贴近设备；
- `<700px`：取消套娃手机，聊天近似全屏，选择转为底部气泡区，Call 图片铺上半屏；
- 所有模式遵守 `safe-area-inset-*`；
- 390px 下不得横向溢出。

统一断点与容器规则：

```css
@media (min-width: 1100px) { /* original-style wide composition */ }
@media (min-width: 700px) and (max-width: 1099px) { /* compact landscape/tablet */ }
@media (max-width: 699px) { /* full-screen mobile presentation */ }
```

不要再增加只为单张截图服务的断点。高度补充规则使用 `@media (max-height: 760px)`：顶部/底部间距各缩减 `4–8px`、dialogue 最大高度提高到 `38vh`，但正文不低于 16px、hit target 不低于 44px。

## 6. UI PR 3：菜单、Backlog、完成页与动效

建议标题：

```text
feat(player): unify story player panels, backlog, and motion
```

范围：

- 设置抽屉；
- Backlog 剧本记录页；
- 完成页；
- 统一标题、关闭按钮、列表行、选中态、圆角与间距；
- 进入/退出/选中动效；
- 键盘焦点与 focus trap；
- `prefers-reduced-motion`；
- 移动端面板交互。

Backlog 仍使用现有 restore/replay action，不重写历史模型。菜单和 Backlog 可以一深一浅，但共享相同设计系统。

## 7. 推荐提交顺序

### UI PR 1

```text
chore(player): gate story debug UI behind runtimeDebug
feat(player): add shared player layout tokens and surfaces
feat(player): rebuild the player top bar and control dock
feat(player): make ADV dialogue responsive to shared safe areas
fix(player): harden shell layout across target viewports
```

### UI PR 2

```text
feat(player): add mobile theme and communication context resolvers
feat(player): rebuild mobile chat presentation
feat(player): add contextual mobile reply choices
feat(player): rebuild mobile call presentation
fix(player): harden responsive mobile story layouts
```

### UI PR 3

```text
feat(player): unify settings and backlog surfaces
feat(player): rebuild story completion presentation
fix(player): add accessible and reduced-motion panel transitions
```

每个 commit 必须能独立通过相关 verifier，不允许最后一次性补测试。

## 8. 验收矩阵

### 8.1 UI PR 1 必测

| 状态 | 验收点 |
| --- | --- |
| 单语 ADV | 姓名牌、正文、控制坞不重叠 |
| 双语 ADV | 主次文本层级、自然增高 |
| 2 行/4 行长文本 | 不截断、不压住人物/控制坞 |
| 普通 2–4 项 Choice | 行为不变，布局不溢出 |
| Title/Synopsis/TextTime | 壳层一致、推进行为不变 |
| 默认 URL | 不出现 ADV/DBG/runtime diagnostics |
| `runtimeDebug=1` | debug controls 可显式恢复 |
| 菜单/Backlog/完成态 | 原行为保留 |
| `stageOnly=1`/`hideUI=1` | 舞台纯净，无残余 dock |
| `noAudio=1` | 启动、推进、返回正常 |

### 8.2 UI PR 2 必测

| 状态 | 验收点 |
| --- | --- |
| FRAME 个人短信 | 组合色顶栏、FRAME 组合背景 |
| THE 虎牙道个人短信 | 深色顶栏、THE 虎牙道组合背景 |
| C.FIRST 个人短信 | 青色顶栏、C.FIRST 组合背景 |
| 组合群聊 | 组合名与组合背景 |
| 偶像连续发言 | 头像、姓名、白气泡 |
| 制作人回复 | 右侧系统绿色 |
| Stamp/Emoji | 透明 stamp、行内 emoji |
| Talk 两选项 | 手机保留、双气泡在右 |
| Call 两选项 | Call 场景保留、选择在右 |
| 选择后回复 | 防重入并形成正确回复表现 |
| 1/3/4+ 选项 | 不溢出，可滚动 |
| Backlog restore/goPrev | 通信上下文一致 |
| 直接打开 choice | 能推断模式，或安全回退 Stage Choice |
| NPC/缺图 | 中性 fallback，无破图 |
| 双语 | 消息与选项自适应 |

### 8.3 视口与输入

至少真实浏览器检查：

```text
1650x900
1366x768
1024x768
390x844
```

同时检查：

- 鼠标、键盘、触控；
- 100% 与常用浏览器缩放；
- safe area；
- `prefers-reduced-motion`；
- console error/warning；
- 深链、刷新、浏览器 Back、播放器返回按钮。

## 9. 固定锚点与 fixture 建档

继续保留历史综合锚点：

```text
http://127.0.0.1:5174/?view=player&category=cards&idol=001tom&story_type=main&story_section=101&scenario=episodes%2F1_4_001_01_a.json&start_step=2&end_step=42&return=story_collection

http://127.0.0.1:5174/?view=player&story_type=main&story_section=101&scenario=episodes%2F1_4_001_01_d.json&start_step=1&end_step=48&return=story_collection
```

其中 `1_4_001_01_d` 是既有 Mobile/Phone/Choice 综合锚点。但 UI PR 2 开工前仍需建立一张新的 fixture 清单，至少精确记录：

- FRAME 个人 Talk；
- THE 虎牙道个人 Talk；
- C.FIRST 个人 Talk；
- unit group Talk；
- Talk -> Choice -> reply；
- Call -> Choice -> external reply；
- stamp/emoji；
- 1/2/3/4+ choice；
- 直接 choice deep link；
- NPC 和缺资源。

每项记录 scenario、step ID/range、自然入口、完整 URL、预期视觉来源与当前结果。不要只按文件名猜分类。

当前 corpus 中可用作发现起点的 committed 示例包括：

```text
public/data/compiled/001tom_301_2_3_001_01_09_a.json  # talk + choice
public/data/compiled/001tom_301_2_3_001_01_09_b.json  # talk + choice + talk_stamp
public/data/compiled/001tom_307_2_3_001_07_09_a.json  # call
```

它们只是 fixture 候选，不自动证明所需角色/组合语义。

## 10. 自动验证与浏览器顺序

每个小提交至少执行：

```powershell
npm run verify:story-presentation
npm run verify:story-playback-range
npm run verify:story-runtime-foundation
npm run verify:story-localization
npm run verify:routes
npm run build
git diff --check
```

涉及音频调用边界时追加：

```powershell
npm run verify:story-audio
```

涉及 schema/compiled shape 时才追加：

```powershell
npm run verify:story-schema
npm run verify:story-runtime-shapes
```

但本 UI 批次原则上不应触碰 schema。

浏览器验收顺序：

1. 重新核对 5174 listener，不复用旧 PID；
2. 从剧情集合自然进入 player；
3. 记录完整 URL 与 fixture；
4. 默认 URL 确认无 debug；
5. `runtimeDebug=1` 确认显式 debug；
6. 单语、双语、长文本、Choice、Talk、Call；
7. goPrev、Backlog restore、刷新、浏览器 Back、返回目录；
8. 四个目标视口与键盘焦点；
9. 检查 console；
10. 明确本次证据只覆盖哪些 scenario/step/viewport。

## 11. 严格禁止顺带改动

本轮不得：

- 重写 StoryClock、StoryAudioSession、cue owner 或剧情状态机；
- 改写剧情分支、choice destination 或 history 语义；
- 把所有 Choice 都变成手机气泡；
- Talk/Call 强行合并为同一内部结构；
- 把 screenshot 当整张静态 UI；
- 为缺失 Call 图片硬编码无关资源；
- 修改搜索、关系数据、歌曲/Chibi 播放器；
- 新建 publication transaction 或批量迁移资源；
- 把 source-only、`noAudio=1`、短时浏览器测试写成真实音频长稳；
- 把 UI PR 编号误写成 P2-A/P2-B 已执行。

P2-A strict-v2 promotion 与 P2-B 2–4 小时长稳继续遵守既有独立轨道；P2-B 仍为 **NOT EXECUTED**。

## 12. PR 完成定义

### UI PR 1 完成

- 默认播放器没有内部 step type 与 DBG；
- debug 只能通过 `runtimeDebug=1` 打开；
- 顶栏、ADV 和控制坞共享安全区；
- 原有 Auto/Skip/Backlog/语言/完成态行为无回归；
- 目标 viewport、双语和长文本通过；
- 自动验证与 build 通过；
- 没有 Runtime owner 变化。

### UI PR 2 完成

- 个人/组合主题与背景解析有 fixture 和 source；
- Talk/Call/Stage Choice/Mobile Choice 语境分离；
- 通信 choice 时设备场景连续；
- goPrev、Backlog restore、直接 choice deep link 行为稳定；
- Call 资源 fallback 有审计依据，无硬编码无关图片；
- 双语、1/2/3/4+ 选项、NPC、缺图与 390px 通过；
- 没有分支、音频或 publication 语义变化。

### UI PR 3 完成

- 菜单、Backlog、完成页共享 token 与交互语言；
- 焦点、键盘与 reduced motion 通过；
- restore/replay/return 行为保持现状；
- 三阶段最终回归矩阵通过。

## 13. 给新窗口的开场提示词

```text
请先只读核验 E:\Web_build\SideM_Archived 当前 branch、HEAD、upstream、
origin/master、worktree 与 5174 listener，不复用旧 PID。功能基线应至少
包含 8db60f2 或其已合并后继；若尚未进入 master，先报告实际基线，不要
从旧 master 静默开工。worktree 必须干净，并新建独立 codex/ 分支。

完整阅读：
1. web_viewer/docs/AGENT_START_HERE.md
2. web_viewer/docs/PROJECT_MAP.md
3. web_viewer/notes/04_refactor/STORY_PLAYER_UI_REBUILD_NEXT_WINDOW_HANDOFF_20260802.md
4. web_viewer/notes/03_audit/GS_ARCHIVE_P0_ARCHITECTURE_CLOSEOUT_20260730.md
5. web_viewer/notes/04_refactor/STORY_VIEWER_RUNTIME_REFACTOR_DESIGN_20260718.md
6. web_viewer/notes/04_refactor/STORY_POST_MERGE_HANDOFF_20260723.md
7. web_viewer/notes/03_audit/STORY_STRUCTURED_BILINGUAL_UI_20260722.md
8. web_viewer/notes/03_audit/STORY_RUNTIME_REAL_AUDIO_ACCEPTANCE_20260729.md

先只执行 UI PR 1：清理正式 debug/step type、建立 player tokens 与统一安全区、
拆出顶栏和控制坞、让 ADV 自适应。只拆展示，不迁移状态、历史、timer、音频
或 Runtime owner。默认 URL 不显示 DBG；仅 runtimeDebug=1 显式打开。

验收单语/双语 ADV、2/4 行长文本、Choice、Title/Synopsis/TextTime、菜单、
Backlog、完成态、stageOnly/hideUI/noAudio，以及 1650x900、1366x768、
1024x768、390x844。执行 story presentation/playback range/runtime
foundation/localization/routes/build 与 git diff --check，并在 5174 从自然入口、
深链、刷新、Back、返回按钮和 console 做真实浏览器检查。

不要提前混入 UI PR 2 手机剧情、UI PR 3 面板动效、搜索/关系/歌曲/Chibi、
publication、strict-v2 或 2–4 小时长稳。P2-B 仍为 NOT EXECUTED。
```
