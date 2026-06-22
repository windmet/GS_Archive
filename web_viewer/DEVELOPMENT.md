# SideM Story Viewer — 开发进度

## 项目概述

THE IDOLM@STER SideM 游戏内剧情的 Web 浏览器阅读器。
通过数据管道将原始数据（raw JSON）编译后，使用 Vue 3 + PixiJS 前端渲染显示。

## 目录结构

```
SideM_Archived/
├── data_pipeline/                 # 数据处理管道
│   ├── build_index.py             # 生成层级索引(index.json)
│   ├── scenario_compiler.py       # raw JSON → 整合 Step JSON 编译
│   ├── merge_scenarios.py         # 合并多个 scenario
│   ├── batch_compile.py           # 批量编译
│   ├── extract_voice.py           # 语音文件提取
│   └── asset_migrator.py          # 素材迁移工具
├── web_viewer/                    # 前端 (Vite + Vue 3)
│   ├── public/
│   │   ├── assets/               # 图片/音频/Spine 素材（构建时复制）
│   │   ├── data/compiled/        # 编译后的 JSON（index.json + 各 scenario）
│   │   ├── bg-list.json          # 399 个背景文件名索引
│   │   └── spines-index.json     # 728 个 Spine 模型目录名索引
│   ├── src/
│   │   ├── main.js               # Vue 入口
│   │   ├── App.vue               # 主应用 — 分类/网格/导航 + 预加载集成
│   │   ├── core/
│   │   │   ├── StoryViewer.vue   # 剧情播放引擎 — 核心逻辑
│   │   │   └── PixiStageManager.js # PixiJS 渲染器管理 (背景/Spine)
│   │   ├── components/
│   │   │   ├── SpineViewer.vue   # Spine 实验室 — 独立模型预览模块
│   │   │   ├── SpineStage.vue    # Vue 封装的 Pixi 渲染舞台（背景+Spine 角色）
│   │   │   ├── LoadingScreen.vue # 全屏预加载进度界面
│   │   │   ├── AdvUI.vue         # ADV 模式（传统视觉小说风格）
│   │   │   ├── MobileUI.vue      # 短信聊天 UI（仿 LINE/WeChat）
│   │   │   ├── CallUI.vue        # 电话 UI（模拟手机屏幕）
│   │   │   └── ChoiceUI.vue      # 选择肢 UI（毛玻璃效果）
│   │   └── utils/
│   │       ├── AssetResolver.js   # 全素材 URL 统一管理
│   │       ├── IdolNameMap.js     # 偶像名 ↔ chara_id 映射
│   │       ├── UnitNameMap.js     # 队伍编码 ↔ 队伍名映射
│   │       ├── LanguageStore.js   # 语言模式全局状态 (JP/CN/BILINGUAL)
│   │       ├── TextHelper.js      # 双语文本解析/渲染辅助
│   │       └── Preloader.js       # 全局资源预加载器（bg/voice/spine）
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── data_pipeline/
│   └── spine_parser.py           # (WIP) Spine 3.8 二进制 .skel 解析器
```

---

## 1. 数据管道 (Data Pipeline)

### 1.1 剧情编译器 (`scenario_compiler.py`)

- **输入**: raw JSON（命令数组格式: `Type` + `Values`）
- **输出**: 整合 Step JSON（`steps[]` 数组，每个 step 自我完备）
- **原理**: 状态机方式
  - `ScenarioState` 累积 `bg`, `bgm`, `spines`, `talk_mode`, `phone_mode`
  - 遇到对话命令（text/talk_text）时截取当前状态快照
  - 每个 step 包含 `type`, `state`, `chara_id`, `dialogue`
- **双语数据模型**:
  ```json
  {
    "speaker": "円城寺 道流",
    "text": "元の日本語...",      // 旧版向后兼容
    "text_jp": "元の日本語...",    // 日语原文
    "text_cn": "",                // 中文翻译（待填入）
    "voice": "a1000.m4a"
  }
  ```
  - `text` 保留作为向后兼容的降级字段
  - 前端 `TextHelper.resolveText()` 优先读 `text_jp` / `text_cn`，无则降级到 `text`
  - 新编译的文件自动包含 `text_jp` / `text_cn` 字段

### 1.2 批量编译器 (`batch_compile.py`)

- 将 `data_pipeline/` 下所有 raw JSON 批量编译
- 输出到 `web_viewer/public/data/compiled/`

### 1.3 索引构建器 (`build_index.py`)

- 从编译好的 JSON 生成 `index.json`
- **分类规则**:
  | 分类 | ID | 匹配条件 | 显示名 |
  |---|---|---|---|
  | 主线剧情 | `main_story` | `^1_4_` | 主线剧情 |
  | 活动剧情 | `event` | `^1_3_` | 活动剧情 |
  | 偶像个人 | `idol` | `^\d{3}[a-z]{3}_` / `^1_2_` / `^1_5_` / `^1_x_` / `^3_x_` | 偶像个人 |
  | 短信聊天 | `idol_chat` | `^8_1_` (个人) / `^8_2_` (群组) | 短信聊天 |
  | 电话聊天 | `idol_phone` | `^1_x_\d{3}[a-z0-9]{3}_(1_8_\|2_1_8_\|2_1_2_\d+_22_t01)` | 电话聊天 |
  | 第零话 | `episode_zero` | `^1_1_` (提取队伍编码) | 第零话 |
  | 额外剧情 | `extra` | 以上之外 (应用 extra rules) | 额外剧情 |
- **idol_chat 结构**:
  ```json
  {
    "id": "idol_chat",
    "individual": {
      "031sak": { "name": "水嶋 咲", "groups": [...] }
    },
    "groups": [
      { "unit_code": "10caf", "unit_name": "Café Parade", "groups": [...] }
    ]
  }
  ```
- **idol_phone 结构**（电话聊天，与 idol_chat 的 individual 结构相同）:
  ```json
  {
    "id": "idol_phone",
    "individual": {
      "031sak": { "name": "水嶋 咲", "groups": [...] }
    }
  }
  ```
  - 电话检测模式: `1_x_{chara_id}_1_8_` / `_2_1_8_` / `_2_1_2_*_22_t01`
  - 放置在 CATEGORY_MAP 中 `^1_x_` 之前以优先匹配
- Extra 分组规则: 新年/情人节/白色情人节/FES/周年纪念等

### 1.4 低使用频率脚本

- `merge_scenarios.py` — 剧情合并用（目前基本未使用）
- `extract_voice.py` — 语音提取
- `asset_migrator.py` — R2/外部存储迁移用

---

## 2. 前端架构

### 2.1 视图跳转

```
home → idols (idol/idol_chat/idol_phone 偶像网格)
     → groups (分类分组列表)
     → files (文件列表)
     → player (StoryViewer 剧情播放)
     → spine_lab (SpineViewer 独立脊柱预览)
```

由 `App.vue` 的 `view` ref 控制。返回按钮会跳转到上一级合适的页面。

Spine 实验室的入口是首页的「Spine 实验室」猫形按钮 (`cat-btn`)。

### 2.2 StoryViewer.vue — 播放引擎

**Props**: `scenarioJson` | `scenarioUrl`

**核心状态**:
- `compiledData` — 加载的 scenario JSON
- `currentStepIndex` — 当前 step 位置
- `historyStack` — 历史索引栈（用于分支跳转后正确返回）
- `selectedChoices` — stepIndex → 选择文本 的 Map（响应式）

**渲染层级** (从下往上):
1. **SpineStage** — PixiJS canvas (背景 + Spine 角色模型)
2. **UI 叠加层** — 根据 `type` 切换显示

| step.type | 组件 |
|---|---|
| `adv` | AdvUI — 传统 ADV 对话框 |
| `talk` | MobileUI — 聊天画面 (v-show) |
| `call` | CallUI — 电话画面 |
| `choice` | ChoiceUI — 选择肢（选择结果由 StoryViewer 处理） |
| `synopsis` / `title` | 内联 — 标题/梗概显示 |

3. **导航栏** — 底部 ◀/▶ 按钮 + 顶部返回/语言切换

**语言切换**:
- 顶部栏右侧 `JP` / `中文` / `JP+CN` 按钮循环切换
- 通过 `LanguageStore.js` 全局 ref 控制
- 所有 UI 组件通过 `TextHelper.resolveText()` 读取当前模式的文本

**导航**:
- `goNext()`: 当前 index 入栈 → index++
- `goPrev()`: 从栈中 pop → 跳转到该 index
- `onChoice(opt)`: 选择文本保存到 `selectedChoices` → 若有 `opt.step_id` 则跳转

### 2.3 MobileUI.vue — 短信聊天 (LINE/WeChat 风格)

**Props**: `step`, `stepIndex`, `scenarioId`, `historyStack`, `choiceTexts`

**消息构建**:
1. `watch(stepIndex/step)` 首次出现时存入 `talkByIndex`（仅一次）
2. `historyMessages` computed 沿 `historyStack + currentIndex` 路径合并
3. 选择肢（P 发言）以绿色气泡注入

**名字解析**:
- `step.dialogue.speaker` 匹配 `^\d{3}[a-z0-9]{3}$` → 用 `IDOL_ID_TO_NAME` 转显示名
- `cleanSpeaker()` 清除特殊空格

**表情/图章**:
- 正则 `<emoji>(.+?)<\/emoji>` 通过 `v-html` 转成 `<img>`
- 文本整体匹配 `<emoji>(image_mobile_stamp_.+?)<\/emoji>` → 大图章 (160px)
- 其他 → 内联表情 (22px)

**标题**:
- `8_2_` 开头 → 群组名（队伍名）
- 其他 → 参与者名称（去重，最多2人 + "他"）

**背景**:
- 始终使用 `getUnitMobileBgUrl(unitCode)` — 个人聊天也用队伍背景

### 2.4 CallUI.vue — 电话界面

- 模拟手机屏幕（来电→通话 UI）
- 使用个人背景 (`getMobileBgUrl`) + 头像 (`getMobileIconUrl`)
- 屏幕内选择按钮 + 底部对话框气泡

### 2.5 ChoiceUI.vue — 选择肢

- 毛玻璃效果（`backdrop-filter: blur`）
- 选择肢靠底部排列
- 选择时通过 `@select` 通知 StoryViewer

### 2.6 AdvUI.vue — ADV 模式

- 简单对话框（说话者名 + 文字）
- 播放中音频指示器

### 2.7 SpineStage.vue — Vue 封装的 Pixi 渲染舞台

`SpineStage.vue` 是对 `PixiStageManager.js` 的 Vue 组件封装：

- **Props**: `step` — 当前 step 对象，自动响应 state 变化
- **背景管理**: `position: absolute` 填满父容器，canvas 全屏渲染
- **Spine 角色渲染**: watch `props.step` → 自动切换 bg + 增删/更新 Spine

**核心渲染逻辑** (`applyState()`):

```
applyState(step):
  1. 设置/清除背景 (bg/clearBackground)
  2. 检查 charaId + NON_VISUAL_IDS + state.spines 条目的综合有效判断
     - 无效 → clearAllSpines() + return
  3. 从 state.spines 中找当前角色的 spine 条目 (id = charaId)
  4. 状态差分：
     a. 已有相同 modelId → 只更新 face + anim + 居中位置，不重载
     b. 模型不一致 / 无 → clearAllSpines() → spawnSpine() → 设置位置/face/anim
```

**non-visual / 无立绘清理增强**：
- 合并 `NON_VISUAL_IDS`、`chara_id` 空值、`state.spines` 无匹配条目的统一判断
- 任何无有效立绘的情况都保证 `clearAllSpines()` 执行
- watch 中增加 `!step?.state` 分支的清理（回退到 synopsis/title 等无 state 步骤时清空舞台）

**调试功能**:
- 右下角 `⚙` 按钮切换
- 实时显示每个 Spine 的 X/Y/Scale
- 输入框直接修改坐标
- ±0.1/±1 步进缩放按钮
- 拖拽移动角色
- 居中按钮复位

**位置策略** (单角色居中):
```javascript
x = width × 0.5  // 始终居中，不采用多角色分区
y = getCharaY(charaId) → DEFAULT_Y(895) + Y_CLASS_OFFSET[tall/short] || 0
```

### 2.8 PixiStageManager.js

- PIXI.Application 的封装，由 `SpineStage.vue` 内部使用
- `setBackground(bgId)` — 背景精灵切换（带 30 帧淡入淡出动画）
- `spawnSpine(idolId, modelId)` — 手动加载流程：fetch atlas/skel → 剥离 Unity 头 → 加载纹理(Image) → TextureAtlas → AtlasAttachmentLoader → SkeletonBinary → new Spine
- `_applyDefaultPosition(spine)` — 智能自适应缩放：
  ```javascript
  const REF_HEIGHT = 3060
  const scale = 0.26 * (REF_HEIGHT / originalHeight)
  ```
- `playSpineAnim(idolId, animName)` — 非 wait_loop 动作播放一次后队列 wait_loop 循环
- `clearAllSpines()` — 批量销毁所有 Spine 实例
- `updateSpineFace(idolId, faceName, faceFlags?)` — 通过 Track 1 播放 face_xxx 动画，支持原版 `anim_flag`（`目`=blink cover / `off`=瞬切）+ `blush_flag`/`sweat_flag` 特效覆盖
- 所有新 Spine 自动设 `spine.stateData.defaultMix = 0.2`（丝滑过渡）
- 拖拽交互（`pointerdown` → `globalpointermove` 全局跟踪）
- `ResizeObserver` 监听容器尺寸变化
- 调试用红色原点标记 (`Graphics` circle) + drag emit (`spine-dragged` 自定义事件)
- 所有 spine 被包裹在 `fadeWrapper` (PIXI.Container) 中，统一控制淡入/淡出

**Spine 动画系统**：

```
Track 0 — Body animation (e.g. wait_loop, angry → angry_loop)
Track 1 — Face expression (e.g. face_default, face_happy)
```
不再使用纹理替换做换脸，全部通过 Track 动画实现。

**渐变过渡**：
- `_fadeIn(spine)` — alpha 0→1 via wrapper Container
- `_fadeOutAndDestroy(idolId)` — alpha 1→0 via wrapper，完成后自动销毁 Spine 和 wrapper

### 2.9 Preloader.js — 全局资源预加载器

在 `App.vue` 的 `loadScenario()` 流程中集成：

1. 用户点击文件 → fetch JSON
2. `Preloader.preloadScenario(steps, onProgress)` 启动
3. 扫描所有 steps 提取 `bgIds`, `voiceFiles`, `spineModels`
4. 分批并发加载（每批 6 个），`onProgress` 汇报 0-100%
5. 加载完成 → 切换到播放器
6. 播放器中 `PIXI.Assets.load()` 命中缓存，零延迟渲染

**细节**:
- 背景/Spine 使用 `PIXI.Assets.load()` 写入全局缓存
- 语音使用 `new Audio().preload='auto'` 触发浏览器预加载
- 每批 `Promise.allSettled` 保证单个失败不影响整批

### 2.10 语音系统 — Web Audio API

当前采用 Web Audio API 方案，完全绕过浏览器 `<audio>` 元素和 IDM 嗅探。

**获取语音 URL** (`AssetResolver.getVoiceUrl(voiceFile, scenarioId)`)：
```javascript
// 短文件名 → 自动添加 scenario 前缀
// a1001.m4a → 1_1_001_03_a1001.m4a (scenario_id 的最后 4 段)
getVoiceUrl(voiceFile, scenarioId) {
  if (/^[a-zA-Z]/.test(voiceFile) && scenarioId) {
    const prefix = scenarioId.split('_').slice(-4).join('_')
    return `/assets/voice/${prefix}_${voiceFile}`
  }
  return `/assets/voice/${voiceFile}`
}
```

**播放流程**：
```javascript
fetch(`/assets/voice/${voice}`)
  .then(r => r.arrayBuffer())
  .then(buf => audioCtx.decodeAudioData(buf))
  .then(audioBuffer => {
    const source = audioCtx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(audioCtx.destination)
    source.start(0)
  })
```

**流程增强**：
- `_ensureAudioCtx()` — 在用户手势中同步激活 AudioContext（满足 autoplay 策略）
- `_resetVoiceDedup()` — 同一 step 的同一段语音不去重复触发
- 响应头检测：检查 `content-type` 和 `byteLength`，过滤非音频响应（Vite SPA fallback 返回 HTML）
- 缓存破坏：URL 追加 `?_=Date.now()`
- 语音开始/结束时控制 `setSpineTalking()` 开关

**历史尝试（均失败）**:
1. `<audio>` + 直接设置 src 和 play() — 不播放
2. `canplay` 事件监听 — 不播放
3. `requestAnimationFrame` 包装 — 不播放
4. fetch + Blob + ObjectURL + `<audio>` — IDM 能嗅探但不播放

### 2.11 SpineViewer.vue — 独立预览模块 (Spine 实验室)

独立于 StoryViewer 的 Spine 模型预览工具，入口在首页「Spine 实验室」按钮。

**控制面板**:

| 控制项 | 数据源 | 实现 |
|--------|--------|------|
| Background | `bg-list.json` (399 个) | `Texture.fromURL()` 异步加载 |
| Idol Model | `spines-index.json` (728 个) | 同 PixiStageManager 手动加载流程 |
| Animation | 动态从 skeletonData 读取 | `clearTracks()` + `setEmptyAnimation(0,0)` 清除残留 → 播新动画 |
| Face | 自动查找 `faces/` 下纹理 | 同 updateSpineFace |
| Scale | ±0.05 步进 | `spine.scale.set()` |

**动画切换防残影方案**（关键）:
```javascript
function onAnimChange() {
  spine.state.clearTracks()
  spine.state.setEmptyAnimation(0, 0)
  // 再设置新动画 ...
}
```
每次切换动画前必须 `clearTracks()` + `setEmptyAnimation(0, 0)`，否则旧动画的 attachment 残留会叠加渲染。

**自动缩放** 同 PixiStageManager REF_HEIGHT 公式。

**纹理加载**: 手动 `new Image()` → `PIXI.BaseTexture` (alphaMode=PMA) → `PIXI.Texture`，避免 PIXI.Assets 缓存干扰。

---

## 3. 已实现功能

### 3.1 导航与分支

- [x] 分类层级导航（home → idols/groups → files → player）
- [x] 返回按钮智能适配层级
- [x] `historyStack` 分支跳转（选择肢跳转后正确返回）
- [x] 返回不显示假分支（不会显示另一条路线的文本）
- [x] 选择肢结果 → 以 P 的发言注入聊天（绿色气泡）

### 3.2 短信聊天 (MobileUI)

- [x] 左对齐（偶像）/ 右对齐（P）的气泡
- [x] 偶像头像显示 (`getMobileIconUrl`)
- [x] 名字解析（原始 chara_id → 显示名）
- [x] 表情内联显示
- [x] 大图章显示 (160px)
- [x] P 发言完整显示（使用 `detail` 完整文本）
- [x] 消息累积（历史路径上的所有消息）
- [x] 自动滚动到底部
- [x] 队伍背景（所有聊天通用）
- [x] 群聊标题 = 队伍名
- [x] 私聊标题 = 偶像名

### 3.3 分类结构

- [x] 短信聊天分类（`idol_chat`）— 个人 (8_1_x) + 群组 (8_2_x)
- [x] 网格显示（49 个人 + 16 群组）
- [x] 群组入口直接进入文件视图
- [x] 动态标题（根据分类显示「短信聊天」/「偶像个人」）
- [x] 名字解析（网格/群组标题不显示原始 chara_id）
- [x] 队伍编码正规化（3 位 → 2 位）保证素材 URL 正确

### 3.4 选择肢 UI

- [x] 毛玻璃效果（`backdrop-filter: blur`）
- [x] 带编号的选择按钮
- [x] Hover 时变青绿色 + 上浮效果
- [x] `pointer-events: none/auto` 层级正确

### 3.5 电话聊天

- [x] 电话聊天主界面分类按钮
- [x] 电话聊天独立分类（`idol_phone`），与普通个人剧情分离
- [x] 50 位角色的电话条目（含非偶像角色如 山村贤）
- [x] CallUI 组件渲染手机模拟界面
- [x] 名字解析、grid 显示与偶像个人风格统一

### 3.6 双语支持

- [x] 数据模型支持 `text_jp` / `text_cn` 字段
- [x] 编译器自动输出双语文档结构（`text_cn` 为空占位）
- [x] 语言模式全局状态（`LanguageStore.js`）
- [x] `TextHelper.resolveText()` 处理三种模式：JP / CN / BILINGUAL
- [x] AdvUI：说话者+文本双语渲染
- [x] MobileUI：聊天气泡双语渲染
- [x] CallUI：电话对话框双语渲染
- [x] StoryViewer 顶部栏语言切换按钮（JP→中文→JP+CN 循环）
- [x] Synopsis/Title 步骤双语支持

### 3.7 资源预加载

- [x] `Preloader.preloadScenario()` 扫描 steps 提取 bg/voice/spine
- [x] 分批并发加载（每批 6 个），`Promise.allSettled` 容错
- [x] 加载进度回调 0-100%
- [x] `LoadingScreen.vue` 全屏进度条
- [x] PIXI.Assets 全局缓存预热，播放器零延迟渲染
- [x] HTML Audio 预加载（`preload='auto'`）

### 3.8 SpineStage 渲染舞台

- [x] `SpineStage.vue` Pixi 渲染舞台 vs 组件封装
- [x] 背景精灵切换（淡入淡出）
- [x] 多角色 Spine 管理（增删更新）
- [x] **状态差分渲染** — 同一模型不清除重载，消除闪烁
- [x] **智能自适应缩放** — REF_HEIGHT=3060 校准公式
- [x] **丝滑动作过渡** — defaultMix=0.2
- [x] **Y 轴微调体系** — DEFAULT_Y=895 + CHARA_Y_CLASS 分类偏移
- [x] **非可视角色过滤** — mob/group/*sub 等 ID 跳过渲染
- [x] 动画控制 (`playAnim`) — 非 loop 动画播放一次后回退 wait_loop
- [x] 换脸接口 (`updateFace` / `updateFaceTexture`)
- [x] 调试面板（实时坐标/缩放/拖拽）
- [x] ResizeObserver 窗口自适应

### 3.9 Spine 实验室 (SpineViewer)

- [x] 独立 PIXI 预览画布 + 侧边控制面板
- [x] 背景选择（399 个）、模型选择（728 个）
- [x] 动画动态列表 + 切换防残影（clearTracks + setEmptyAnimation）
- [x] 表情切换（face slot 纹理替换）
- [x] 手动缩放调节（±0.05）

### 3.10 语音播放 (Web Audio API)

- [x] 绕过浏览器 `<audio>` 元素，避免 IDM 嗅探干扰
- [x] `AudioContext.decodeAudioData` 二进制解码
- [x] 支持 autoplay 策略（`audioCtx.resume()`）
- [x] 语音切换时停止前一个播放

### 3.11 Spine 加载管线

- [x] Unity 二进制头剥离（.skel / .atlas）
- [x] 手动纹理加载（Image → BaseTexture → PMA 模式）
- [x] `TextureAtlas` 自定义回调映射纹理名称
- [x] `bg-list.json` / `spines-index.json` 静态索引
- [x] 自动缩放归一化（REF_HEIGHT 校准法）

### 3.12 数据管道

- [x] raw JSON → Step JSON 编译
- [x] index.json 层级结构生成
- [x] idol_chat 的个人/群组分割
- [x] Event 元数据注入（GROWING SIGN@L / SELECTION）
- [x] Episode Zero 队伍分组
- [x] Extra 分组规则

### 3.13 Spine 多轨动画系统

- [x] **Track 0 — Body**: wait_loop/angry/joy 等全身动画
- [x] **Track 1 — Face**: face_default/face_happy 等表情动画（替换之前纹理换脸方案）
- [x] **自动 loop 链式**: angry → angry_loop → wait_loop 自动回退
- [x] `defaultMix = 0.2` 丝滑过渡

### 3.14 唇形同步 — 音频驱动 Attachment Swap + 骨骼操控（v4 最终方案）

- [x] **方案确认**: SideM 模型使用 `mouth_{expression}{1|2}` 附件切换（闭嘴线/张嘴洞）
- [x] **音频驱动**: 使用 Web Audio API AnalyserNode (fftSize=256) 实时获取音量振幅 (0.0~1.0)
- [x] **smoothVol 平滑**: 指数移动平均 `smoothVol = smoothVol * 0.55 + rawVol * 0.45`，防闪烁
- [x] **音量阈值**: 0.08 触发张嘴（低于则闭嘴）
- [x] **Attachment Swap**: `mouth_{exp}1` ↔ `mouth_{exp}2` 在 `updateWorldTransform` 劫持中执行
- [x] **表情匹配**: 舌头`tongue_{exp}` / 上牙`tooth_{exp}` / 下牙`tooth_bottom_{exp}`（仅部分表情有下牙附件）
- [x] **骨骼操控 — 核心驱动** (mouth bone scaleX):
  - `mouth.scaleX = dataScaleX * (1.0 + openRatio * 4.5)` — 纵向开口（max 5.5x data scale）
  - `mouth.scaleY = dataScaleY` — **锁死横向**，消除 shear 变形
  - 坐标系：mouth 骨骼有 -0.7° 旋转，局部坐标系的 scaleX 恰为垂直方向
- [x] **成人模型**: tooth/tongue 独立同步缩放（独立子级挂在 head 下）
  - `tooth.scaleX = dataScaleX * dynScaleY`，`tooth.scaleY = dataScaleY`
  - `tongue.scaleX = dataScaleX * dynScaleY`，`tongue.scaleY = dataScaleY`
- [x] **幼年模型 (isChildRig)**: tooth/tongue 不独立缩放（继承 mouth_close 父级变换）
  - `mouth_close` 仅复位到 data 值，不参与缩放
- [x] **mouth_clip 遮罩**: 幼年模型特有，张嘴设 `mouth_clip_{exp}` / 闭嘴设 null
- [x] **try-catch 防御**: `updateWorldTransform` 钩子被 try-catch 包裹，防止模型特定错误卡崩渲染循环
- [x] 语音开始 → `setSpineTalking(idolId, true, getVoiceVolume)`, 结束 → `setSpineTalking(false)`
- [x] **全局调试引用**: `window._s[idolId]` = spine object（控制台直接探查）

### 3.15 多通道渲染渐变过渡 (AlphaFilter)

- [x] **淡入**: wrapper Container alpha 0→1 via ticker (0.085/帧, ~12帧)
- [x] **淡出（多通道）**: `PIXI.AlphaFilter` 挂载到 wrapper，Spine 整体预渲染成一张位图再统一调透明度
- [x] **解决** PMA "X光透视"穿帮（身体配件在半透明时互相可见的问题）
- [x] **安全检测**: 每帧检查 `wrapper.destroyed`，防止 Ticker 操作已被销毁的对象
- [x] 淡出完成 → `parent.removeChild(wrapper)` + `wrapper.destroy({ children: true, textures: true })`

### 3.16 语音文件路径自适应

- [x] `getVoiceUrl()` 自动检测短文件名 + scenario_id 前缀
- [x] 非音频响应过滤（content-type/size 检查）
- [x] URL 缓存破坏时间戳
- [x] 去重逻辑防止同一 voice 重复触发

### 3.17 showAnims() 调试工具

- [x] 全局函数 `window.showAnims(charaId, modelIdx?)` 在 Console 调用
- [x] 列出指定角色的所有骨骼动画名
- [x] 内置 KNOWN_MODELS 映射 charaId → modelIds
- [x] styled console 分组显示

### 3.18 预加载优化

- [x] 语音文件完全跳过预加载（改用 AudioContext + fetch 运行时播放）
- [x] Spine 模型改用 `fetch()` + `blob()` 替代 `new Audio()` 预加载
- [x] `_preloadAudio()` 被移除

### 3.19 安全 Spine 清理（防残影/Ghost）

- [x] **`clearAllSpines()`** — 先遍历收集所有 wrapper，从 Map 中删除记录，再逐一淡出
- [x] **防止竞态**: 快速跳过（快进）时，旧模型的 Ticker 不会误伤新加载的同 idolId Spine
- [x] **`_fadeOutAndDestroy(idolId)`** — 先从 `spineInstances` Map 中删除条目，再启动淡出
  ```javascript
  delete this.spineInstances[idolId]  // 先删记录
  this._fadeOutWrapper(wrapper)       // 再淡出旧模型
  ```
- [x] **`removeSpine(idolId)`** — 统一入口，委托给 `_fadeOutAndDestroy`

### 3.20 音频驱动唇形同步 (AnalyserNode)

- [x] **Web Audio API 路由**: `source → globalAnalyser → audioCtx.destination`
- [x] **AnalyserNode**: 全局唯一实例，fftSize=256，getByteFrequencyData()
- [x] **getVoiceVolume()**: 计算频域数据的平均值并归一化到 0.0~1.0
- [x] **一处创建，持续复用**: AnalyserNode 持久连接 destination，不断开
- [x] **StoryViewer.vue 集成**: 在 `_playVoice()` 中传入 `getVoiceVolume` 回调给 `setSpineTalking`

### 3.16 语音文件路径自适应

- [x] `getVoiceUrl()` 自动检测短文件名 + scenario_id 前缀
- [x] 非音频响应过滤（content-type/size 检查）
- [x] URL 缓存破坏时间戳
- [x] 去重逻辑防止同一 voice 重复触发

### 3.17 showAnims() 调试工具

- [x] 全局函数 `window.showAnims(charaId, modelIdx?)` 在 Console 调用
- [x] 列出指定角色的所有骨骼动画名
- [x] 内置 KNOWN_MODELS 映射 charaId → modelIds
- [x] styled console 分组显示

### 3.18 预加载优化

- [x] 语音文件完全跳过预加载（改用 AudioContext + fetch 运行时播放）
- [x] Spine 模型改用 `fetch()` + `blob()` 替代 `new Audio()` 预加载
- [x] `_preloadAudio()` 被移除

---

## 4. 已知问题 & 待办事项

### 4.1 前端

- [ ] **CHARA_Y_CLASS 未填充** — 240+ 角色骨骼高度不同，需要逐一观察归类 (tall/short/medium)
- [ ] **Spine 实验室残影** — 早期版本切换动画会叠加渲染，已通过 `clearTracks()` + `setEmptyAnimation()` 修复
- [ ] **Spine 动作列表不全** — 部分模型(如 001tom)应有更多动画未确认
- [ ] **spine_parser.py** — Spine 3.8 二进制 .skel 解析器在字符串/varint 格式上解析失败，待修正
- [ ] **Node.js @pixi-spine 运行时测试** — mock PIXI 缺少 `setSize`/`once` 等方法，无法在 Node 中解析动画列表
- [ ] **表情素材缺失**: `public/assets/emojis/` 没有实际的表情 PNG（或文件名不一致）。需要通过管道提取/部署。
- [ ] **图章素材缺失**: `public/assets/stamps/` 没有图章 PNG。同上。
- [ ] **头像/背景素材缺失**: `public/assets/idols/` 下的 mobile_icon / mobile_bg / unit_mobile_bg 可能不足。
- [ ] **CallUI 选择肢事件**: `@select` 会触发，但选择后 P 的发言是否会注入聊天未确认。
- [ ] **historyStack 边界问题**: `choiceTexts` 以 Object 传递，通过 historyStack 回溯时已存在的选择肢是否会重复显示需要确认。
- [ ] **搜索过滤**: 日语 IME 未确定前过滤已触发（即时过滤）。
- [ ] **移动端适配**: 目前仅限桌面。手机上可能出现布局错乱。
- [ ] **深色模式**: 应用整体白背景，但剧情播放中是黑背景，未做统一处理。
- [ ] **预加载失败降级**: Preloader 的动态 import('pixi.js') 在低端设备上可能加载慢，需 fallback。
- [ ] **Spine 位置精确映射**: `_idol_position` 命令在编译器中未处理（`pass`），所有 `position` 默认为 0。
- [ ] **multi-track face animation before voice reset**: 当角色有 `eye_close` 等脸部动画时，说话时嘴部 `_2` 附件和闭眼动画的附件可能不同步。
- [ ] **某些模型无 mouth 插槽**: 部分模型可能使用不同的插槽命名规范或没有独立 mouth slot，需要 fallback 方案。
- [ ] **纵向开口严重不足**: 口型适配的最终形态——闭口线(25px)→洞口(81px) 的附件瞬间切换 + mouth.scaleX 5.5x 纵向外扩。成人/幼年/少年模型的骨骼树不同，需要每个模型单独确认。
  - ✅ **成人 (040ren)**: `mouth` bone scaleX 纵向开口，scaleY 锁死；tooth/tongue 同步缩放。**已验证 OK**
  - ✅ **幼年 (040ren_child)**: isChildRig 分支；tooth/tongue 不手动缩放；mouth_clip 遮罩。**已验证 OK**
  - ❓ **少年 (038tak)**: 骨骼结构与成人类似，但曾在故事系统中引发卡死（已添加 try-catch 防御）。待确认 lip-sync 是否正常。

### 4.2 数据管道

- [ ] **`7)` 开头的文件名**: `batch_compile.py` 能否正确处理含 `7)` 的文件名未确认（`7) talk_chat_01.json` 直接存在于 compiled/）。
- [x] **merge_scenarios 更新**: 新增 Pattern B —— 检测合并格式（无 `_scenario_` 分隔符）的基文件+缀字母变体，直接删除冗余变体文件。已在全部 29 组生日剧情（`1_x_*_2_1_2_*_12`）上验证。
- [ ] **extract_voice 未整合**: 语音文件提取后的部署路径与 web_viewer 是否匹配未确认。
- [ ] **索引更新未自动化**: 添加 raw JSON 后需手动运行 `build_index.py`。
- [ ] **`_scenario_` 分隔符文件**: 部分文件是 `{parent}_scenario_{sid}` 格式，新旧格式间的兼容性未完全确认。

### 4.3 未实现功能

- [ ] **存档/读档**: 无法中途保存。保存 `selectedChoices` + `historyStack` 即可实现。
- [ ] **快进/自动播放**: 没有自动播放和已读跳过功能。
- [ ] **文字速度调节**: ADV 模式文字一次性显示。没有逐字显示动画。
- [ ] **历史记录 (Backlog)**: 无法查看之前对话内容。
- [ ] **收藏/书签**: 没有标记特定 Scenario 的功能。
- [ ] **各分类文件总数不准确**: `totalFiles` 计算可能未能完全适配分类的个人/群组结构。
- [ ] **`idol` 分类中的电话 (8_x 系列)**: idol 分类包含电话文件但未与普通剧情区分。
- [ ] **index.json 差分更新**: 每次扫描全量文件，大数据量下效率低。

---

## 5. 要点记录 (Tips & Notes)

### 5.1 队伍编码正规化

Scenario ID 内的队伍编码是 3 位补零 (`008hig`)，但素材文件名是 2 位 (`08hig`)。使用 `normalizeUnitCode()` 转换:

```
"008hig" → parseInt("008") = 8 → padStart(2, "0") = "08" → "08hig"
```

### 5.2 名字解析优先级

1. `step.dialogue.speaker` 是 3 位字母数字 → 用 `IDOL_ID_TO_NAME` 转换
2. 其他 → `cleanSpeaker()` 后直接使用
3. 网格上通过 `resolveChatName()` 检查 `ch.name` 是否为 chara_id 格式后转换

### 5.3 pointer-events 层级

```
StoryViewer .ui-overlay (pointer-events: auto, 点击整体进入下一步)
  └─ MobileUI .mobile-ui-overlay (pointer-events: none)
       └─ .mockup-phone (pointer-events: auto)
            └─ 内部操作正常响应点击
  └─ ChoiceUI .choice-ui (pointer-events: none)
       └─ .choice-options (pointer-events: auto)
```

设计上保证上层点击（下一步）不被阻挡，同时必要的交互区域可点击。

### 5.4 历史栈逻辑

```
goNext(): 前进前将当前位置保存到栈 → index++
goPrev(): 从栈中取出返回（pop）
onChoice(): 记录选择 → 如有必要 push 到栈 → 跳转到 step_id
```

使用 `historyStack.pop()` 返回，因此从选择肢分支返回时不会显示假分支（其他路线的文本）。

### 5.5 网格中的群聊

在 idol_chat 网格中，群聊（8_2_x）和个人条目一起显示。通过 `_isGroup` 标记区分，点击时直接跳转到文件视图（群聊每个队伍通常只有一个文件）。

### 5.6 生日剧情分支合并

`1_x_*_2_1_2_*_12` 系列的生日剧情存在两种格式：

- **基文件** (`1_x_038tak_2_1_2_038_12.json`) — compilation 阶段已经将所有分支剧情按顺序合并，内含 `jump_points` 指向每个分支的起点。
- **变体文件** (`_a.json`, `_b.json`, `_c.json`) — 与基文件中对应分支内容完全重复，只是背景图不同（同一场景从不同视角观看）。

基文件已包含全部分支内容，变体文件冗余且会增加索引条目数。`merge_scenarios.py` 的 Pattern B 会检测并删除这些冗余变体。

### 5.7 内容检测分类优先级

在 `build_index.py` 的 `idol` 分类中，三步路由按以下顺序执行：

1. **电话检测**: `any(step.get("type") == "call" for step in steps)` → `phone_chars`
2. **短信检测**: `is_chat_file()`（所有 step 仅 talk/choice）→ `chat_chars`
3. **普通 ADV**: 以上都不是 → `idol_chars`

优先级保证电话不被误归为短信，短信不被误归为普通个人剧情。

### 5.8 语言模式架构

```
LanguageStore.js (singleton ref)
  └─ languageMode: 'JP' | 'CN' | 'BILINGUAL'

TextHelper.resolveText(dialogue, mode?)
  ├─ mode='JP':          text_jp || text (backward compat)
  ├─ mode='CN':          text_cn || text_jp || text
  └─ mode='BILINGUAL':   text_jp + '\n' + text_cn (or just jp if no cn)
```

数据层向后兼容：旧文件只有 `text` 时显示原始日文，新文件有 `text_jp`/`text_cn` 时按模式渲染。

### 5.9 预加载流程

```
App.loadScenario(name)
  ├─ fetch JSON
  ├─ Preloader.preloadScenario(steps, onProgress)
  │   ├─ scanStepAssets → { bgIds[], voiceFiles[], spineModels[] }
  │   ├─ batch(6) PIXI.Assets.load (bg + spine)
  │   ├─ batch(6) HTMLAudio preload (voice)
  │   ├─ onProgress(0-100%)
  │   └─ Promise.allSettled
  ├─ 设置 currentScenario = data
  ├─ 切换到 player view
  └─ StoryViewer 渲染时 PIXI.Assets 已经是 cache hit
```

### 5.10 SpineStage 渲染架构

```
StoryViewer.viewer-stage
  └─ SpineStage (:step="currentStep")  [层0: Pixi canvas]
     ├─ PixiStageManager.setBackground(bgId)  → PIXI.Sprite (淡入淡出)
     └─ applyState(step):
        ├─ NON_VISUAL_IDS 匹配 → clearAllSpines + return
        ├─ state.spines.find(id=charaId)
        ├─ 已有相同 modelId → 仅更新 face + anim + 居中
        └─ 不同/无 → clearAllSpines → spawnSpine → 设位置 → 设 face + anim

  位置策略:
    x = width × 0.5 (居中)
    y = getCharaY(charaId) → DEFAULT_Y(895) + Y_CLASS_OFFSET[tall/short] || 0
  缩放策略:
    scale = 0.26 × (REF_HEIGHT(3060) / skeleton.data.height)
```

### 5.11 Spine 加载注意事项

1. **Unity 二进制头剥离**:
   ```javascript
   // .skel 和 .atlas 都有 Unity 头
   uint32(nameLen) + ASCII(name) + padding(0-3 bytes) + uint32(metadata)
   // 总共约 20 字节
   ```

2. **纹理为 PMA (Premultiplied Alpha)**:
   ```javascript
   const base = new PIXI.BaseTexture(img)
   base.alphaMode = PIXI.ALPHA_MODES.PMA
   // atlas pages 也要设
   for (const page of atlas.pages) page.pma = true
   ```

3. **不能使用 @pixi-spine/loader-3.8** — PIXI 标准加载器不处理 Unity 头，TextureAtlas `size:` 前缀解析也会失败。

4. **atlas 文本可能以 `\nsize:` 开头** — `_decodeAtlasText()` 检测并裁剪到第一行有效内容。

### 5.12 语音系统演进

```
初始: <audio src="/assets/voice/xxx.m4a"> → el.play()
  → IDM 嗅探到，但实际不播放
  → Phone 模式正常、ADV 模式异常（相同代码）
  → 排查方向: el.currentTime=0 后 play()
  
Blob 方案: fetch → res.blob() → URL.createObjectURL(blob) → el.src
  → IDM 仍然嗅探到，不播放
  → ObjectURL 生命周期管理复杂
  
Web Audio: fetch → arrayBuffer → audioCtx.decodeAudioData → source.start(0)
  → 完全绕过 <audio> 和 IDM
  → 极低延迟
  → 需处理 AudioContext autoplay 策略
```

关键教训：不要用 `<audio>` 元素做有版权保护的音频播放。Web Audio API 跳过了所有浏览器媒体元素管道，直接操作音频缓冲区。ADV 模式中音频不工作的问题根源在于 `AudioContext` 在用户交互之前处于 `suspended` 状态，Web Audio API 可以通过 `resume()` 显式激活。

### 5.13 Auto-Scale 校准原理

```
问题: skeleton.data.height 是骨骼框高度（含空白 padding），
      不是角色实际像素高度。直接用 targetScreenHeight / skeletonHeight
      会让所有角色偏小 (~0.20)。

解法: 校准法。
  1. 找一个视觉大小合适的角色作为基准
  2. 记录其 skeleton.data.height = REF_HEIGHT
  3. 对所有其他角色: scale = baseScale × (REF_HEIGHT / theirHeight)
  
  001tom (基准): scale=0.26, skeletonHeight=3060
  较低的角色: skeletonHeight > 3060 → 自动缩小
  较高的角色: skeletonHeight < 3060 → 自动放大
```

### 5.14 Spine 差分渲染

```
问题: 每次 step 变化清空所有 Spine 重新生成 → 画面闪烁

解法: 状态差分
  - 同一 charaId 同一 modelId → 不销毁重建
  - 只更新 face 纹理 + 播放动画
  - 确保 x/y 居中（给用户拖拽后仍会复位）

好处:
  - 消除闪烁
  - 避免纹理重复加载
  - 保留 Spine 内部的动画状态，过渡更平滑

配合 defaultMix=0.2 → 动作切换 200ms 淡入淡出，视觉流畅

### 5.15 唇形同步架构（实时音频驱动版 v4 — 最终方案）

SideM 模型没有预制的 talk/mouth 动画。实现口型同步经过了三轮演进，最终通过 **Spine 编辑器分析 mesh 结构** 确定了正确方案。

**演进历程:**

```
方案 1: Track 2 动画播放 (已废弃)
  → 骨骼中没有 talk/mouth 动画，只有 body/face 动画

方案 2: 骨骼驱动 + 正弦波 (已废弃)
  → chin_control/chin 骨骼被动画覆盖，即使修改也不影响渲染
  → 正弦波模拟音量，与真实语音不匹配

方案 3: Attachment Swap + mouth_close 压扁 (Spine 截图分析后, 已验证 but superseded)
  → 分析 mesh 后发现 mouth_{exp}1=闭口线(25px), mouth_{exp}2=洞口(81px)
  → 但 mouth_close.scaleY 压扁无法提供足够开口幅度

方案 4 (当前): 实时音频驱动 + Attachment Swap + mouth bone scaleX 纵向开口
  ├─ 核心发现: mouth 骨骼在局部坐标系中 scaleX=垂直方向（-0.7° 旋转）
  ├─ 闭口线(25px)→洞口(81px) 用附件瞬间切换
  ├─ 音量增大 → mouth.scaleX *= (1.0 + ratio*4.5) 纵向外扩至 5.5x
  ├─ scaleY 锁死 data 值 → 水平无变形，消除 shear
  ├─ 成人: tooth/tongue 独立同步缩放
  ├─ 幼年: tooth/tongue 继承 mouth_close，不独立缩放
  └─ 幼年特有: mouth_clip 遮罩防圆形空洞
```

**为什么 updateWorldTransform 劫持是必要的:**
```
Spine 渲染管线:
  1. state.apply(skeleton) ← 动画覆盖所有 slot attachment
  2. skeleton.updateWorldTransform() ← 计算顶点坐标 ← 我们在此注入
  3. WebGL 渲染
```
在 `updateWorldTransform()` 内部修改 slot attachment 是唯一不被动画覆盖的时机。

**核心操控逻辑 (PixiStageManager.js 546-688):**
```javascript
const openRatio = Math.min(1, Math.max(0, (spine.smoothVol - 0.08) / 0.92))
const dynScaleY = 1.0 + openRatio * 4.5  // max 5.5x

// mouth 是核心纵向驱动（所有模型通用）
if (mouthBone) {
  mouthBone.scaleX = mouthDataScaleX * dynScaleY  // scaleX = 纵向开口
  mouthBone.scaleY = mouthDataScaleY               // scaleY = 横向锁死
}
if (isChildRig) {
  // 幼年: tooth/tongue 是 mouth_close 的子级，继承父级变换
  if (mouthCloseBone) {
    mouthCloseBone.scaleX = mouthCloseDataScaleX
    mouthCloseBone.scaleY = mouthCloseDataScaleY
  }
} else {
  // 成人: tooth/tongue 独立挂在 head 下，必须单独缩放
  if (toothBone)  toothBone.scaleX = toothDataScaleX * dynScaleY
  if (tongueBone) tongueBone.scaleX = tongueDataScaleX * dynScaleY
}
```

**幼年模型检测 (isChildRig):**
```javascript
const mouthSlotBone = mouthSlot.bone?.data?.name || 'mouth'
const isChildRig = mouthSlotBone === 'mouth_close'
```
成人: mouth slot → mouth bone。幼年: mouth slot → mouth_close bone。

**音频路由架构 (StoryViewer.vue):**
```javascript
// 全局 AnalyserNode (一次创建, 持续复用)
this.globalAnalyser = this._audioCtx.createAnalyser()
this.globalAnalyser.fftSize = 256
// 路由: source → analyser → destination
source.connect(this.globalAnalyser)
this.globalAnalyser.connect(this._audioCtx.destination)

// 音量回调 (传入 setSpineTalking)
getVoiceVolume() {
  this.globalAnalyser.getByteFrequencyData(this.frequencyData)
  const sum = this.frequencyData.reduce((a, b) => a + b, 0)
  return sum / this.frequencyData.length / 255  // 0.0~1.0
}
```

**防御机制:**
- `updateWorldTransform` 钩子由 `try-catch` 包裹，任何模型特定错误不会卡崩渲染循环
- `origUpdateWT.call(this)` 在 `try-catch` 后无条件执行，保证渲染不被中断
- 控制台输出 `[LipSync] updateWorldTransform error for "{idolId}"` 用于调试

**调试工具:**
- `window._s[idolId]` — 直接访问 spine 对象
- `window._probe[idolId]()` — 交互式骨骼/插槽诊断
- `_probeWeight()` — mesh 顶点权重探查
- `_probeAll()` — 自动轮询骨骼测试
- 张嘴后第 5 帧自动 dump 全部口腔状态+骨骼树+插槽表

### 5.16 ShowAnims 调试工具

全局函数 `window.showAnims(charaId, modelIdx?)` 在 Console 调用：

1. 从 KNOWN_MODELS 匹配模型列表
2. 使用独立 Spine 加载管线 (skip Unity header + skin scan)
3. 输出格式: `console.group` + styled message
4. 用于快速确认角色有哪些可用动画 (body + face + 任何特殊动画)

### 5.17 lip-sync 诊断系统

`setSpineTalking()` 内置了综合诊断 dump，在张嘴后第 5 帧自动输出到控制台。

**触发方式**: 角色开始说话 → `smoothVol > 0.08` → 第 5 次 `updateWorldTransform` 时输出。

**诊断输出格式**:
```
═══ POST-SWAP DIAGNOSTIC for "{idolId}" ═══
Expression: {exp}, smoothVol: {vol}
  mouth       → mouth_{exp}2
  tongue      → tongue_{exp}
  tooth_top   → tooth_{exp}
  tooth_bottom → (null) 或 tooth_bottom_{exp}

SLOT → BONE MAPPING (face area):
  {slot_name} bone={bone_name} y={y} sY={scaleY}

BONE TREE (face area):
  {bone_name} parent={parent} y={y} scaleX={sX} scaleY={sY}

MULTI-ATTACHMENT SLOTS:
  {slot_name} → {current} variants=[{att1}, {att2}, ...]

ALL BONES:
  {bone_name} x={x} y={y} sX={sX} sY={sY} r={rot}

ALL SLOT ATTACHMENTS:
  [{idx}] {slot_name} → {attachment_name}
```

**全局调试引用**: 安装 lip-sync 后，在 Console 直接敲 `_s['{idolId}']` 获取 spine 对象探索。
可用命令示例:
```js
// 查看口腔附件列表
_s['040ren'].skeleton.slots.filter(s => /mouth|tongue|tooth/i.test(s.data.name)).forEach(s => {
  const idx = _s['040ren'].skeleton.data.findSlotIndex(s.data.name)
  const atts = _s['040ren'].skeleton.data.defaultSkin?.attachments?.[idx]
  console.log(s.data.name, '→', s.attachment?.name, '可用:', Object.keys(atts || {}))
})
// 查看面部骨骼
_s['040ren'].skeleton.bones.filter(b => /mouth|head|face|chin|tooth|tongue/i.test(b.data.name))
  .forEach(b => console.log(b.data.name, 'y:', b.y, 'sX:', b.scaleX, 'sY:', b.scaleY))
```

---

## 6. 启动与构建

```bash
# 启动开发服务器
cd web_viewer
npm run dev

# 生产构建
npm run build

# 重新生成索引（添加新数据后）
cd data_pipeline
python build_index.py --dir ../web_viewer/public/data/compiled --output ../web_viewer/public/data/compiled/index.json
```

---

## 7. 附录：Spine 骨骼/插槽/附件参考表

以下数据基于 **040ren (Ren Kurosawa / 連 来翔)** 模型的诊断输出，在 `mouth_serious2` 张嘴状态（smoothVol≈0.4）下采集。

### 7.1 面部骨骼树 (Face Bone Tree)

| 骨骼名 | 父级 | y(px) | scaleX | scaleY | 说明 |
|--------|------|-------|--------|--------|------|
| `head` | `neck` | -4.3 | 1.000 | 1.000 | 头部根骨，所有面部骨骼的父级 |
| `eyelash_control` | `head` | -50.7 | 1.000 | 1.000 | 睫毛控制器 |
| `eye_blink` | `head` | -61.1 | 1.000 | 1.000 | 眨眼骨骼 |
| `eyebrow` | `head` | -52.1 | 1.000 | 1.000 | 眉毛根骨 |
| `eye_control` | `head` | -48.5 | 1.000 | 1.000 | 眼睛控制器 |
| `face_control` | `head` | -58.9 | 1.000 | 1.000 | **下半脸网格变形控制器**（潜在关键） |
| `face_control_reverse` | `head` | -55.8 | 1.000 | 1.000 | 下半脸反向控制器 |
| `mouth` | `head` | -39.1 | **1.245** | **1.163** | 嘴部骨骼（有 -0.7° 旋转，scaleX/Y 产生 shear） |
| `mouth_close` | `head` | **-14.2** *(base: -30.5)* | 1.000 | **0.388** | 闭嘴拉力器（vol 驱动释放) |
| `tongue` | `head` | -14.4 | 1.000 | 1.000 | 舌头骨骼 |
| `tooth` | `head` | -43.3 | 1.000 | 1.000 | 牙齿骨骼 |
| `chin_control` | **`mouth`** | 1.6 | 1.000 | 1.000 | 下巴控制器（parent=mouth 不是 head！) |
| `chin` | `head` | -46.1 | 1.000 | 1.000 | 下巴骨骼（官方不动，动则畸变) |

> **关键发现**: `chin_control` 的父级是 `mouth` 而不是 `head`。这意味着 `mouth.scaleY` 的变化会通过层级传递影响 `chin_control` 的世界坐标。

### 7.2 面部插槽 → 骨骼映射 (Slot→Bone Mapping)

| 插槽名 | 绑定骨骼 | 骨骼 y | 骨骼 sY | 当前附件 |
|--------|----------|--------|---------|----------|
| `tail_clip` | `body` | -2.2 | 1.000 | tail_clip |
| `head2` | `head` | -4.3 | 1.000 | head |
| `head_shadow_clip` | `head` | -4.3 | 1.000 | head_shadow_clip |
| `head_shadow` | `head` | -4.3 | 1.000 | head_shadow |
| `head` | `head` | -4.3 | 1.000 | head |
| `eyebrow_shadow_R` | `eyebrow_R` | 77.3 | 1.000 | eye_R_shadow |
| `eyebrow_shadow_L` | `eyebrow_L` | -51.7 | 1.000 | eyebrow_shadow_L |
| `clip_R` | `eyelash_R` | 88.8 | 1.000 | clip_R |
| `eye_pupil_R` | `eyeball_R` | 86.5 | 1.000 | eyeball_R |
| `eyeball_R_skin` | `eyeball_R` | 86.5 | 1.000 | eyeball_R_skin |
| `eye_shadow_close_R` | `eye_blink` | -61.1 | 1.000 | (null) |
| `eyebrow_shadow_R2` | `eyebrow_R` | 77.3 | 1.000 | (null) |
| `eyelash_R2` | `eyelash_R` | 88.8 | 1.000 | eyelash_R2 |
| `eyelash_R` | `eyelash_R` | 88.8 | 1.000 | eyelash_R |
| `eyelash_close_R` | `eye_blink` | -61.1 | 1.000 | (null) |
| `clip_L` | `eyelash_L` | -54.0 | 1.000 | clip_L |
| `eye_pupil_L` | `eyeball_L` | -51.1 | 1.000 | eyeball_L |
| `eyeball_L_skin` | `eyeball_L` | -51.1 | 1.000 | eyeball_L_skin |
| `eyebrow_shadow_close_L` | `eye_blink` | -61.1 | 1.000 | (null) |
| `eyebrow_shadow_L2` | `eyebrow_L` | -51.7 | 1.000 | eyebrow_shadow_L |
| `eyelash_L2` | `eyelash_L` | -54.0 | 1.000 | eyelash_L2 |
| `eyelash_L` | `eyelash_L` | -54.0 | 1.000 | eyelash_L |
| `eyelash_close_L` | `eye_blink` | -61.1 | 1.000 | (null) |
| **`tongue`** | **`tongue`** | **-14.4** | **1.000** | **tongue_serious** |
| **`tooth_top`** | **`tooth`** | **-43.3** | **1.000** | **tooth_serious** |
| **`tooth_bottom`** | **`tooth`** | **-43.3** | **1.000** | **(null)** |
| **`mouth`** | **`mouth`** | **-39.1** | **1.163** | **mouth_serious2** |
| `nose` | `head` | -4.3 | 1.000 | nose |
| `cheek_dye_R` | `head` | -4.3 | 1.000 | cheek_dye_R |
| `cheek_dye_L` | `head` | -4.3 | 1.000 | cheek_dye_L |
| `swet_shadow` | `swet` | -124.3 | 1.000 | swet_2_shadow2 |
| `swet` | `swet` | -124.3 | 1.000 | swet_3 |
| `swet_2_shadow` | `swet_2` | 50.0 | 1.000 | swet_2_shadow |
| `swet_2` | `swet_2` | 50.0 | 1.000 | swet_2 |
| `eyebrow_L` | `eyebrow_L` | -51.7 | 1.000 | eyebrow_L |
| `eyebrow_R` | `eyebrow_R` | 77.3 | 1.000 | eyebrow_R |
| `swet_line_1` | `head` | -4.3 | 1.000 | swet_line_1 |
| `swet_line_2` | `head` | -4.3 | 1.000 | (null) |

> **口腔区域（加粗）**: 四个口腔插槽全部已覆盖。`tooth_bottom` 为空是合理的—serious 表情没有下牙附件。

### 7.3 多附件插槽 (Multi-Attachment Slots)

以下插槽在 default skin 中有超过 1 个附件变体：

| 插槽名 | 当前附件 | 可用附件变体 |
|--------|----------|-------------|
| `eyelash_close_R` | (null) | eyelash_close_R, eyelash_smile_R |
| `eyelash_close_L` | (null) | eyelash_close_L, eyelash_smile_L |
| **`tongue`** | **tongue_serious** | tongue_angry, tongue_default, tongue_happy, tongue_joy, tongue_sad, **tongue_serious**, tongue_shy, tongue_surprise, tongue_swet, tongue_think, tongue_trouble |
| **`tooth_top`** | **tooth_serious** | tooth_angry, tooth_default, tooth_happy, tooth_joy, tooth_sad, **tooth_serious**, tooth_shy, tooth_surprise, tooth_swet, tooth_think, tooth_trouble |
| **`tooth_bottom`** | **(null)** | tooth_bottom_angry, tooth_bottom_shy, tooth_bottom_surprise **(仅3个表情有下牙!)** |
| **`mouth`** | **mouth_serious2** | 见 7.4 节 |
| `swet_shadow` | swet_2_shadow2 | swet_2_shadow2, swet_shadow |
| `swet` | swet_3 | swet, swet_3 |

### 7.4 Mouth 附件变体全集 (22 variants)

`mouth` 插槽的 11 个表情 × 2 种状态：

| 表情 | 闭嘴 (1) | 张嘴 (2) |
|------|----------|----------|
| angry | mouth_angry1 | mouth_angry2 |
| default | mouth_default1 | mouth_default2 |
| happy | mouth_happy1 | mouth_happy2 |
| joy | mouth_joy1 | mouth_joy2 |
| sad | mouth_sad1 | mouth_sad2 |
| **serious** | mouth_serious1 | **mouth_serious2** (当前) |
| shy | mouth_shy1 | mouth_shy2 |
| surprise | mouth_surprise1 | mouth_surprise2 |
| swet | mouth_swet1 | mouth_swet2 |
| think | mouth_think1 | mouth_think2 |
| trouble | mouth_trouble1 | mouth_trouble2 |

### 7.5 Mouth 附件匹配规则

口腔附件使用与当前 mouth 附件相同的 `{expression}` 后缀：

| 口腔部位 | 附件命名模式 | 当前状态 (serious) | 模型差异 |
|----------|-------------|-------------------|----------|
| **mouth** (嘴) | `mouth_{exp}{1\|2}` | mouth_serious2 ✓ | 通用 |
| **mouth_clip** (嘴周遮罩) | `mouth_clip_{exp}` | mouth_clip_serious ✓ | **仅幼年建模有此槽** |
| **tongue** (舌头) | `tongue_{exp}` | tongue_serious ✓ | 通用（幼年仅 default/angry） |
| **tooth_top** (上牙) | `tooth_{exp}` | tooth_serious ✓ | 通用（幼年仅 default/angry） |
| **tooth_bottom** (下牙) | `tooth_bottom_{exp}` | (null) ← 仅 3 表情有下牙 | 通用 |

> **下牙缺失**: `tooth_bottom` 只有 angry/shy/surprise 三个表情有附件。其他 8 个表情（含 serious）均无下牙，这是 SideM 模型的原生设计。
> **幼年模型附件数少**: 040ren_child 的 mouth 仅 4 个变体（angry×2 + default×2），tongue/tooth 仅 default/angry。

### 7.6 完整骨骼一览 (All 82 Bones)

模型 **040ren** 的全部非 axis/非 guide 骨骼（smoothVol≈0.4 张嘴状态):

**躯干/根骨:**
| 骨骼名 | x | y | sX | sY | r |
|--------|---|----|----|----|---|
| chara_MIX | 124.3 | 1225.5 | 1.000 | 1.000 | 0.0 |
| character_X | -9.7 | -46.9 | 1.000 | 1.000 | 0.0 |
| hip | 0.4 | 78.7 | 1.000 | 1.000 | 0.0 |
| waist | -1.7 | 8.0 | 1.000 | 1.000 | 96.6 |
| body | 452.7 | -2.2 | 1.000 | 1.000 | -3.2 |
| neck | 543.4 | 52.1 | 1.000 | 1.000 | -16.7 |
| body_control | 311.5 | -13.0 | 1.000 | 1.000 | 0.4 |
| body_control_reverse | 331.3 | -12.8 | 1.000 | 1.000 | 0.4 |
| z_adjust | -1000.0 | 3354.0 | 1.000 | 1.000 | 0.0 |

**头部/面部:**
| 骨骼名 | x | y | sX | sY | r |
|--------|---|----|----|----|---|
| head | 177.6 | -4.3 | 1.000 | 1.000 | -5.2 |
| eyelash_control | 107.9 | -50.7 | 1.000 | 1.000 | -0.7 |
| eye_blink | 107.6 | -61.1 | 1.000 | 1.000 | -0.7 |
| eyebrow | 146.4 | -52.1 | 1.000 | 1.000 | -0.7 |
| eye_control | 119.5 | -48.5 | 1.000 | 1.000 | -0.7 |
| **face_control** | **67.7** | **-58.9** | **1.000** | **1.000** | **-0.7** |
| **face_control_reverse** | **95.6** | **-55.8** | **1.000** | **1.000** | **-0.7** |
| **mouth** | **-19.8** | **-39.1** | **1.245** | **1.163** | **-0.7** |
| **mouth_close** | **-18.8** | **-30.5** | **1.000** | **0.686** | **-2.6** |
| **tongue** | **-18.2** | **-14.4** | **1.000** | **1.000** | **-2.6** |
| **tooth** | **0.4** | **-43.3** | **1.000** | **1.000** | **-2.6** |
| **chin_control** | **-24.0** | **1.6** | **1.000** | **1.000** | **2.3** |
| **chin** | **-84.3** | **-46.1** | **1.000** | **1.000** | **-2.6** |
| eyelash_R | 4.9 | 88.8 | 1.000 | 1.000 | 0.0 |
| eyelash_L | 5.5 | -54.0 | 1.000 | 1.000 | 0.0 |
| eyeball_R | 7.1 | 86.5 | 1.000 | 1.000 | 0.0 |
| eyeball_L | 4.1 | -51.1 | 1.000 | 1.000 | 0.0 |
| eyebrow_R | 16.1 | 77.3 | 1.000 | 1.000 | 0.0 |
| eyebrow_L | 16.7 | -51.7 | 1.000 | 1.000 | 0.0 |

**手臂（左侧):**
| 骨骼名 | x | y | sX | sY | r |
|--------|---|----|----|----|---|
| clavicle_L | 432.0 | -50.5 | 1.000 | 1.000 | -110.4 |
| arm_L1_down | 137.2 | -0.5 | 1.000 | 1.000 | -64.0 |
| elbow_L_down | 468.0 | -0.6 | 1.000 | 1.000 | -87.1 |
| arm_L_con | 0.0 | 0.0 | 1.000 | 1.000 | 177.9 |
| arm_L2_IK | 0.0 | 0.0 | 1.000 | 1.000 | -86.6 |
| arm_L_IK | 24.4 | -411.3 | 1.000 | 1.000 | -9.6 |
| arm_bottom_down_L2 | 0.0 | 0.0 | 1.000 | 1.000 | 91.3 |
| wrist_L_IK | 412.0 | -0.4 | 1.000 | 1.000 | -2.7 |
| hand_L | 0.0 | 0.0 | 1.000 | 1.000 | -6.5 |
| wrist_L_down | 412.0 | 0.0 | 1.000 | 1.000 | -5.3 |

**手臂（右侧):**
| 骨骼名 | x | y | sX | sY | r |
|--------|---|----|----|----|---|
| clavicle_R | 466.6 | 61.6 | 1.000 | 1.000 | 78.8 |
| arm_R1_down | 241.7 | 1.4 | 1.000 | 1.000 | 63.0 |
| elbow_R_down | 513.9 | 1.5 | 1.000 | 1.000 | 172.4 |
| arm_R_top_con | -0.0 | 0.0 | 1.000 | 1.000 | 178.4 |
| arm_R2_IK | -0.0 | 0.0 | 1.000 | 1.000 | 95.9 |
| arm_R_IK | -46.6 | 417.3 | 1.000 | 1.000 | 134.1 |
| wrist_R_down | 419.8 | 3.3 | 1.000 | 1.000 | -0.2 |
| arm_bottom_down_R2 | -0.0 | 0.0 | 1.000 | 1.000 | -85.6 |
| wrist_R_IK | 419.8 | 2.5 | 1.000 | 1.000 | -3.3 |
| hand_R | -0.0 | -0.0 | 1.000 | 1.000 | -13.9 |

**腿部:**
| 骨骼名 | x | y | sX | sY | r |
|--------|---|----|----|----|---|
| leg_R | -169.1 | -189.0 | 1.000 | 1.000 | -107.2 |
| leg_L | 127.6 | -150.2 | 1.000 | 1.000 | -95.5 |

**头发:**
| 骨骼名 | x | y | sX | sY | r |
|--------|---|----|----|----|---|
| hair | 361.2 | -25.7 | 1.000 | 1.000 | -0.7 |
| hair_F | -12.3 | -4.1 | 1.000 | 1.000 | -167.5 |
| hair_F2 | 69.4 | 1.9 | 1.000 | 1.000 | -3.1 |
| hair_F3 | 87.6 | 0.8 | 1.000 | 1.000 | -7.5 |
| hair_F_L | 33.6 | -77.2 | 1.000 | 1.000 | -151.1 |
| hair_F_L2 | 124.4 | -0.7 | 1.000 | 1.000 | -10.5 |
| hair_F_L3 | 115.3 | -0.5 | 1.000 | 1.000 | -40.0 |
| hair_F_R | 33.0 | 85.1 | 1.000 | 1.000 | 155.5 |
| hair_F_R2 | 128.7 | -0.1 | 1.000 | 1.000 | 8.9 |
| hair_F_R3 | 132.2 | -0.7 | 1.000 | 1.000 | 43.4 |
| hair_B_2 | -103.4 | 178.6 | 1.000 | 1.000 | 161.4 |
| hair_B_3 | 120.0 | -0.1 | 1.000 | 1.000 | -5.8 |
| hair_B_R | -267.7 | 186.1 | 1.000 | 1.000 | -166.3 |
| hair_B_L | -223.4 | -98.5 | 1.000 | 1.000 | -159.0 |
| hair_B_L_2 | -130.1 | -97.6 | 1.000 | 1.000 | -150.0 |

**尾巴/装饰:**
| 骨骼名 | x | y | sX | sY | r |
|--------|---|----|----|----|---|
| tail_B | -362.0 | 40.7 | 1.000 | 1.000 | -53.2 |
| tail_B2 | -417.9 | -43.2 | 1.000 | 1.000 | -66.1 |
| tail_B3 | 99.8 | 1.1 | 1.000 | 1.000 | -45.5 |
| tail_B4 | 119.4 | -0.2 | 1.000 | 1.000 | -32.3 |
| tail_B5 | 120.1 | -0.8 | 1.000 | 1.000 | -22.3 |

**绑带/绳子:**
| 骨骼名 | x | y | sX | sY | r |
|--------|---|----|----|----|---|
| string | 36.2 | -62.5 | 1.000 | 1.000 | 0.0 |
| string_R | -23.4 | -9.5 | 1.000 | 1.000 | -95.0 |
| string_R2 | 86.3 | -0.8 | 1.000 | 1.000 | 0.4 |
| string_R3 | 91.1 | -0.4 | 1.000 | 1.000 | 0.3 |
| string_L | 33.7 | 1.0 | 1.000 | 1.000 | -88.3 |
| string_L2 | 93.7 | 0.3 | 1.000 | 1.000 | -0.5 |
| string_L3 | 91.0 | 0.5 | 1.000 | 1.000 | 0.3 |

**手臂子层级（R_1 / L_1 等):** arm_top_R_1, ellbow_R_1, arm_bottom_R_1, wrist_R_1, hand_R_1, finger5_R_1, finger5_R_1_2, finger4_R_1, finger4_R_1_2, finger3_R_1, finger3_R_1_2, finger2_R_1, finger2_R_1_2, arm_top_L_1, ellbow_L_1, arm_bottom_L_1, wrist_L_1, hand_L_1, finger1_L_1, finger3_L_1, finger5_L_1

**手臂子层级（R_5 / L_4 / L_5):** arm_top_R_5, ellbow_R_5, arm_bottom_R_5, wrist_R_5, hand_R_5, hand_L_5, finger3_L_2, finger1_L_2, finger5_L_2, hand_L_4, finger1_L_4_1, finger1_L_4_2, finger5_L_5_1, finger5_L_5_2, finger4_L_4_1, finger4_L_4_2, finger3_L_4_1, finger3_L_4_2, finger2_L_4_1, finger2_L_4_2

**手部（R_0):** hand_R_0, finger1_R, finger1_R_5

**汗水:** swet_2, swet

### 7.7 完整插槽附件表 (136 Slots)

模型 040ren 在 `mouth_serious2` 张嘴状态下的所有 slot/attachment（已过滤 axis/guide/_bg 空槽):

| # | 插槽 | 附件 | # | 插槽 | 附件 |
|---|------|------|---|------|------|
| 1 | tail_B | ponytail1 | 69 | swet_2 | swet_2 |
| 2 | hair_B | hair_B | 70 | eyebrow_L | eyebrow_L |
| 3 | elbow_L | elbow_L | 71 | eyebrow_R | eyebrow_R |
| 4 | arm1_L | arm1_L | 72 | tail | ponytail2 |
| 5 | arm1_L2 | arm1_L | 73 | hair_F | hair_F |
| 6 | arm1_L3 | arm1_L | 74 | hair_F_R | hair_R |
| 7 | arm1_L4 | arm1_L | 75 | hair_F_L | hair_L |
| 8 | wristband_L_B | wristband_L_B | 76 | wristband_L_B_4 | wristband_L_B_4 |
| 9 | arm2_L | arm2_L | 77 | wrist_L_4 | wrist_L_4 |
| 10 | wrist_L | wrist_L | 78 | arm2_L_4 | arm2_L_4 |
| 11 | hand_L_2 | hand_R_1 | 79 | wristband_L_4 | wristband_L_4 |
| 12 | hand_L_0 | hand_R | 80 | hand_L_1 | hand_L_1 |
| 13 | hand_L | hand_L | 81 | hand_L_4 | hand_L_4 |
| 14 | hand_L_5 | hand_L_5 | 82 | finger1_L_4 | finger1_L_4 |
| 15 | wristband_L | wristband_L | 83 | finger2_L_4 | finger2_L_4 |
| 16 | sleeve_L | sleeve_L | 84 | finger3_L_4 | finger3_L_4 |
| 17 | sleeve_L_B_4 | sleeve_L_B_4 | 85 | finger4_L_4 | finger4_L_4 |
| 18 | elbow_L_4 | elbow_L_4 | 86 | finger5_L_4 | finger5_L_4 |
| 19 | arm1_L_4 | arm1_L_4 | 87 | elbow_R | elbow_R |
| 20 | arm1_L_5 | arm1_L_4 | 88 | sleeve_R_B | sleeve_R_B |
| 21 | sleeve_L_4 | sleeve_L_4 | 89 | arm1_R | arm1_R |
| 22 | leg_L | leg_L | 90 | sleeve_R | sleeve_R |
| 23 | leg_R | leg_R | 91 | wrist_R | wrist_R |
| 24 | string_shadow_R | cord_R_shadow | 92 | wristband_R_B | wristband_R_B |
| 25 | string_shadow_L | cord_L_shadow | 93 | arm2_R | arm2_R |
| 26 | string_R | cord_R | 94 | finger1_R | finger1_R |
| 27 | string_L | cord_L | 95 | hand_R | hand_R |
| 28 | body | body | 96 | wristband_R_B_0 | wristband_R_B_0 |
| 29 | tail_clip | tail_clip | 97 | wristband_R | wristband_R |
| 30 | ponytail_shadow | ponytail_shadow | 98 | wrist_R_0 | wrist_R_0 |
| 31 | neck | neck | 99 | arm2_R_0 | arm2_R_0 |
| 32 | head2 | head | 100 | arm2_R_1 | arm2_R_0 |
| 33 | ear_R | ear_R | 101 | hand_R_0 | hand_R_0 |
| 34 | head_shadow_clip | head_shadow_clip | 102 | hand_R_1 | hand_R_1 |
| 35 | head_shadow | head_shadow | 103 | wristband_R_0 | wristband_R_0 |
| 36 | head | head | 104 | elbow_R2 | elbow_R2 |
| 37 | eyebrow_shadow_R | eye_R_shadow | 105 | sleeve_R_B_5 | sleeve_R_B_5 |
| 38 | eyebrow_shadow_L | eyebrow_shadow_L | 106 | arm2_R2 | arm2_R |
| 39 | clip_R | clip_R | 107 | arm2_R3 | arm2_R |
| 40 | eyewhite_R | eyewhite_R | 108 | wristband_R_B_5 | wristband_R_B_5 |
| 41 | eye_pupil_R | eyeball_R | 109 | elbow_R_5 | elbow_R_5 |
| 42 | eyelight_R | eyelight_R | 110 | arm1_R_5 | arm1_R_5 |
| 43 | eyeball_R_skin | eyeball_R_skin | 111 | finger1_R_5 | finger1_R_5 |
| 44 | eyeline_R | eyeline_R | 112 | wrist_R_5 | wrist_R_5 |
| 45 | eye_shadow_close_R | (null) | 113 | hand_R_5 | hand_R_5 |
| 46 | eyebrow_shadow_R2 | (null) | 114 | arm2_R_5 | arm2_R_5 |
| 47 | eyelash_R2 | eyelash_R2 | 115 | arm2_R_line_5 | arm2_R_line_5 |
| 48 | eyelash_R | eyelash_R | 116 | sleeve_R_5 | sleeve_R_5 |
| 49 | eyelash_close_R | (null) | 117 | wristband_R_5 | wristband_R_5 |
| 50 | clip_L | clip_L | 118 | swet_line_1 | swet_line_1 |
| 51 | eyewhite_L | eyewhite_L | 119 | swet_line_2 | (null) |
| 52 | eye_pupil_L | eyeball_L | | | |
| 53 | eyelight_L | eyelight_L | | | |
| 54 | eyeball_L_skin | eyeball_L_skin | | | |
| 55 | eyeline_L | eyeline_L | | | |
| 56 | eyebrow_shadow_close_L | (null) | | | |
| 57 | eyebrow_shadow_L2 | eyebrow_shadow_L | | | |
| 58 | eyelash_L2 | eyelash_L2 | | | |
| 59 | eyelash_L | eyelash_L | | | |
| 60 | eyelash_close_L | (null) | | | |
| **61** | **tongue** | **tongue_serious** | | | |
| **62** | **tooth_top** | **tooth_serious** | | | |
| **63** | **tooth_bottom** | **(null)** | | | |
| **64** | **mouth** | **mouth_serious2** | | | |
| 65 | nose | nose | | | |
| 66 | cheek_dye_R | cheek_dye_R | | | |
| 67 | cheek_dye_L | cheek_dye_L | | | |
| 68 | swet_shadow | swet_2_shadow2 | | | |

### 7.8 骨骼操控对照表 — v4 最终方案（mouth bone scaleX 纵向开口）

**核心突破**: 通过 Spine 编辑器查看模型后确认——`mouth_{exp}1` 是闭口线（Mesh, ~25px），`mouth_{exp}2` 是镂空洞（Mesh, ~81px）。
丝滑过渡原理：**附件瞬间切换（闭口线↔洞口） + mouth bone scaleX 纵向开口**。

关键发现：mouth 骨骼在局部坐标系中有 -0.7° 旋转，导致 **scaleX 方向 = 垂直方向（嘴张开方向）**，而 scaleY = 水平方向（嘴宽度）。
因此 `mouth.scaleX * dynScaleY` 恰好能纵向推开口腔，而 `mouth.scaleY = dataScaleY` 锁死水平方向消除所有 shear。

| 骨骼 | 操控方式 | 效果 | 说明 |
|------|---------|------|------|
| `mouth.scaleX` | `dataScaleX × (1.0 + openRatio×4.5)` | 纵向开口驱动（max 5.5x） | ✅ v4: **核心驱动** |
| `mouth.scaleY` | `= dataScaleY` (**锁死**) | 横向宽度不变 | ✅ v4: 消除 shear |
| `tooth.scaleX` (成人) | `dataScaleX × dynScaleY` | 牙齿纵向同步 | ✅ v4: 防牙遮挡 |
| `tooth.scaleY` (成人) | `= dataScaleY` (**锁死**) | 牙齿宽度不变 | ✅ v4: 消除 shear |
| `tongue.scaleX` (成人) | `dataScaleX × dynScaleY` | 舌头纵向同步 | ✅ v4: 防舌遮挡 |
| `tongue.scaleY` (成人) | `= dataScaleY` (**锁死**) | 舌头宽度不变 | ✅ v4: 消除 shear |
| `mouth_close.scaleX/Y` (成人) | **不操作** | — | ✅ |
| `chin_control` (成人) | **不操作** | — | ✅ |
| `tooth/tongue` (幼年) | **不操作** | 继承 mouth_close 父级 | ✅ 子骨自动跟随 |
| `mouth_close` (幼年) | 复位到 data 值 | 不主动缩放 | ✅ 仅复位 |

**方案演进:**
| 维度 | v1 | v2 | v3 | **v4（当前）** |
|------|----|----|----|----------|
| 核心思路 | mouth non-uniform scale | 三兄弟 uniform scale | mouth_close 压扁/释放 | **mouth.scaleX 纵向开口** |
| mouth scale | sX×1.6 sY×1.4 | 统一 ×1.15 | **不操作** | **sX×dyn-sY(≤5.5x) sY锁死** |
| tooth/tongue | 不处理 | 同步缩放 | **不操作** | **成人同步, 幼年继承** |
| 纵向驱动 | mouth.scaleX 推开 | chin_control.y+10 | mouth_close.sY squeeze | **mouth.scaleX × 5.5x** |
| shear | 严重 | 无（uniform） | 无（不动 mouth） | **无（scaleY 锁死）** |
| 牙齿露出 | 不明显 | 不明显 | 洞口露出 | ✅ **开口充分 5.5x** |
| 幼年适配 | — | — | — | ✅ **isChildRig + mouth_clip** |
| 防御机制 | — | — | — | ✅ **try-catch 包裹 hook** |

### 7.9 纵向开口排查指南

当前方案通过 `mouth.scaleX` 驱动纵向开口，dynScaleY = 1.0 + ratio × 4.5（max 5.5x）。若仍有问题：

1. **确认 mouth 骨骼存在**: 用 `window._s[idolId].skeleton.findBone('mouth')` 检查
2. **确认 mouth slot 附件命名符合 `mouth_{exp}{1|2}` 模式**: 部分模型命名可能不同
3. **确认 tooth/tongue 骨骼树**: 成人模型 tooth/tongue 应是 head 的子级（独立缩放），幼年应是 mouth_close 的子级（不缩放）
4. **isChildRig 检测是否正确**: 检查 `mouthSlot.bone.data.name` 是否为 `mouth_close`
5. **mouth_clip 插槽**: 仅幼年模型有，检查是否导致空洞
6. **Spine 约束 (Constraints)**: 检查 transform constraint / IK constraint 是否限制了 mouth 骨骼
7. **测试不同表情**: tooth_bottom 只存在于 angry/surprise/shy 表情，测试优先用这些

**在 Console 中快速验证:**
```js
const s = _s['040ren']
const mouthB = s.skeleton.findBone('mouth')
console.log('mouth:', mouthB ? `sX=${mouthB.scaleX} sY=${mouthB.scaleY} rot=${mouthB.rotation}` : 'NOT FOUND')
const mouthSlot = s.skeleton.slots.find(sl => /^mouth$/i.test(sl.data.name))
console.log('slot bone:', mouthSlot?.bone?.data?.name, 'isChildRig:', mouthSlot?.bone?.data?.name === 'mouth_close')
// 列出 mouth 附件
const idx = s.skeleton.data.findSlotIndex('mouth')
const atts = s.skeleton.data.defaultSkin?.attachments?.[idx]
console.log('mouth attachments:', Object.keys(atts || {}).join(', '))
```

### 7.10 幼年建模与成人建模的差异 (040ren_child vs 040ren)

牙崎涟的幼年模型与成人模型在口腔结构上有显著差异：

| 特征 | 成人 (040ren) | 幼年 (040ren_child) |
|------|--------------|-------------------|
| **mouth_clip 插槽** | ❌ 不存在 | ✅ 有, `variants=[mouth_clip_angry, mouth_clip_default]` |
| **mouth 插槽绑定骨骼** | `mouth` bone | **`mouth_close` bone** |
| **tooth bone 父级** | `head` | **`mouth_close`** |
| **mouth 附件数** | 22 (11表情×2) | 4 (default×2 + angry×2) |
| **tongue/tooth 附件数** | 11 表情变体 | 2 (default + angry) |
| **mouth 骨骼旋转** | -0.7° | **-6.5°** |
| **face slot** | ❌ (head / head2) | ✅ (`face` 独立插槽) |
| **faceshadow slot** | ❌ | ✅ |

> **关键**: 幼年模型的 `mouth` slot 绑在 `mouth_close` 骨架上，`tooth` 的父级也是 `mouth_close`，说明整个口腔区域是跟随 `mouth_close` 运动的独立子骨架。而成人模型的口腔部件分散挂在 `head` 和 `mouth` 下。
>
> **唇形同步影响**:
> - `isChildRig = (mouthSlot.bone.data.name === 'mouth_close')` 自动检测
> - 成人: `tooth.scaleX *= dynScaleY`, `tongue.scaleX *= dynScaleY`（独立子级，必须手动缩放）
> - 幼年: tooth/tongue **不**手动缩放（它们从 mouth_close 继承变换），仅 `mouth_close` 复位到 data 值
> - `mouth.scaleX *= dynScaleY` 对所有模型统一执行（mesh 顶点绑定 mouth bone，不关心 slot→bone 映射）
> - 幼年特有 `mouth_clip` 遮罩，张嘴时设置 `mouth_clip_{exp}`，闭嘴时设为 null

---

---

## 8. 🌟 里程碑突破：原版引擎命令逆向 — 模块化渲染覆盖系统 (2026-06-22)

### 8.1 突破性发现

通过逆向 `idol_face` 命令的完整 8 字段结构，发现了原版游戏引擎（Unity + 自研 AVG 框架）的核心调度逻辑——**基础表情与附加特效完全解耦的模块化渲染覆盖系统**。

#### `idol_face` 命令完整结构

```
[chara_id, delay, face_name, anim_flag, sweat_flag, blush_flag, '', '']
```

| 索引 | 字段名 | 值 | 含义 |
|------|--------|----|------|
| 0 | chara_id | `038tak` | 角色 ID |
| 1 | delay | `0` / `2.3` | 延迟（0=立即, >0=句中触发） |
| 2 | face_name | `face_joy` | 表情动画名 |
| 3 | **anim_flag** | `目` / `off` | 眨眼掩护控制 |
| 4 | **sweat_flag** | `汗` / `off` | 汗滴效果覆盖 |
| 5 | **blush_flag** | `チーク` / `off` | 脸红效果覆盖 |

#### 核心调度模式 — 成对眨眼命令

每个表情变化由**一对命令**组成，间隔 0.1s：

```
T=0:      face_shy,  anim_flag=off  ← 先瞬切表情（不闭眼）
T+0.1:    face_shy,  anim_flag=目   ← 再闭眼 150ms，掩盖切换痕迹
```

数据统计（1_1_013the_02）：
- `目`（blink cover）= **245 次**（~76%）
- `off`（瞬切）= **79 次**（~24%）

`delay>0`（句中情绪突变）几乎总是 `off`——角色正在说话，表情必须瞬切，没有时间做闭眼-睁眼。

### 8.2 表情组合爆炸 — 特效解耦

`face_shy` 不是硬编码脸红的！原版引擎通过 flag 动态覆盖渲染层：

| 组合 | 效果 |
|------|------|
| `face_shy` + blush_flag=`off` | 害羞表情但不脸红（傲娇） |
| `face_happy` + sweat_flag=`汗` | 开心表情但流汗（苦笑） |
| `face_angry` + sweat_flag=`汗` | 生气但流汗（气急败坏） |

每个 `.skel` 动画会无脑设 `cheek_dye_L/R alpha=1`，但每帧 `state.apply` 后根据 flag 强制覆盖 alpha=0。

### 8.3 架构实现

#### 数据管道 (`scenario_compiler.py`)

```python
_idol_face(vals):
    face_flags = {
        "anim_flag": vals[3],   # '目'/'off'
        "sweat_flag": vals[4],  # '汗'/'off'
        "blush_flag": vals[5],  # 'チーク'/'off'
    }
    if delay > 0:
        timeline_event.append({..., **face_flags})
    else:
        state.update_spine_face(id, face_name, face_flags)
```

- `update_spine_face()` 将 flags 写入 state 的 `anim_flag`/`blush_flag`/`sweat_flag`
- `_process_timeline()` 去重时保留最新 flag（处理成对命令）
- `_apply_timeline()` 传递 flags 到 state

#### 智能眨眼控制 (`PixiStageManager.updateSpineFace`)

```javascript
if (faceFlags.anim_flag === 'off') {
    // 瞬切，不做眨眼（句中情绪突变）
    spine._blinkCoverEndTime = 0
    trackEntry.mixDuration = 0.05
} else if (faceFlags.anim_flag === '目') {
    // 眨眼掩护 150ms（句子开头自然过渡）
    spine._blinkCoverEndTime = now + 150
    trackEntry.mixDuration = 0
}
// 无 flags → 安全默认，做眨眼掩护
```

#### 特效插槽动态覆盖 (`state.apply hook`)

```javascript
// 每帧检查并覆盖 cheek_dye / swet 插槽
const eFlags = spine._faceFlags || {}
if (eFlags.blush_flag !== 'チーク') {
    for (const name of effectCfg.blush) {
        skeleton.findSlot(name).color.a = 0
    }
}
if (eFlags.sweat_flag !== '汗') {
    for (const name of effectCfg.sweat) {
        skeleton.findSlot(name).color.a = 0
    }
}
```

- `_detectEffectSlots(spine)` — 动态扫描所有模型的 `cheek`/`swet` 插槽，完全自动适配
- `state.apply` 后立即覆盖，不受动画 Timeline 影响

### 8.4 数据流总览

```
scenario.json                     StoryViewer / SpineStage         PixiStageManager
idol_face [ren, 0, shy, 目, off, off]
         ↓ compiler 
state: { face: shy, anim_flag: 目, blush_flag: off, sweat_flag: off }
         → → → → → → → → → → → → → → → → → → → → → → → → → → → 
                                updateSpineFace(ren, shy, {
                                  anim_flag: '目',     → blink cover 150ms
                                  blush_flag: 'off',   → cheek_dye alpha=0
                                  sweat_flag: 'off',   → swet alpha=0
                                })
```

### 8.5 改动清单

| 文件 | 改动 |
|------|------|
| `data_pipeline/scenario_compiler.py` | `_idol_face` 解析 vals[3..5] flags；`update_spine_face` 写入 state；`_apply_timeline` 传递 flags；`_process_timeline` 去重保留最新 flag |
| `web_viewer/src/core/StoryViewer.vue` | `_fireTimelineEvent` 传入 `{anim_flag, blush_flag, sweat_flag}` 对象 |
| `web_viewer/src/components/SpineStage.vue` | `applyState` 传递 `spineState`（含 flags）给 `updateSpineFace` |
| `web_viewer/src/core/PixiStageManager.js` | `updateSpineFace` 接受 flag 对象做智能眨眼控制；`_detectEffectSlots` 动态检测 blush/swet 插槽；`state.apply` hook 每帧覆盖特效插槽 alpha |

*最后更新: 2026-06-22 (原版引擎命令逆向 — 模块化渲染覆盖系统完成)*
