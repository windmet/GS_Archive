# Architecture Split Plan

> 目标：在不破坏现有功能的前提下，逐步把超大单体拆成边界清晰、可独立验证的模块。

## 原则

1. 先拆纯函数和纯状态整理逻辑，再拆有副作用的渲染与播放逻辑。
2. 每一步只做一类职责迁移，避免一次改动碰到多个运行时边界。
3. 旧接口尽量保留一段时间，先让调用方零或少改动，再逐步收紧。
4. 每次拆分后都要做构建验证，并用现有样本场景回归。
5. 优先抽“可以单独测试、不会依赖 DOM / PIXI / AudioContext”的代码。

## 当前优先级

| Priority | Target | Reason | Recommended first cut |
|---|---|---|---|
| P0 | `src/core/PixiStageManager.js` | 体量最大，且已经混合了 stage、背景、相机、特效、spine、lip-sync | 先抽纯渲染/特效边界，再处理 spine 子系统 |
| P1 | `src/core/StoryViewer.vue` | 音频、timeline、导航、清理逻辑耦合在同一运行时 | 先收拢运行时控制，再拆 composables |
| P1 | `src/components/SpineStage.vue` | 主要是适配层，但还夹着 Y 轴计算和 state sync | 先抽纯计算，再抽同步流程 |
| P2 | `src/App.vue` | 风险最低，适合做收尾和清理型拆分 | 先抽列表/导航工具函数 |

## 执行顺序

### Phase 1: 低风险抽离

- 抽出 `src/utils/IndexNormalizer.js`
- 抽出 `src/utils/YPositionResolver.js`
- 目标：把纯函数先搬走，减少主文件长度，同时不改变行为

### Phase 2: SpineStage 边界收敛

- 把 `SpineStage.vue` 中的 Y 轴计算、reference 选择、debug 计算抽为工具函数
- 再把 state diff 和 manager 调用收为 `useSpineSync`
- 目标：让组件只负责生命周期、props 传递和调试 UI

### Phase 3: PixiStageManager 内部拆分

- 先拆 `StageRenderer` 和 `ScreenEffectsManager`
- 再拆 `BackgroundManager` 和 `CameraController`
- 最后处理 `SpineManager` 和 `LipSyncEngine`
- 目标：保留 `PixiStageManager` 作为宿主协调层，但把内部职责切开

### Phase 4: StoryViewer 运行时拆分

- 先收拢 voice/timeline/audio 的共享状态
- 再拆 navigation
- 目标：避免多个 composable 互相直接依赖对方的私有清理逻辑

### Phase 5: App.vue 收尾

- 抽 `IndexNormalizer`
- 抽导航辅助逻辑
- 目标：把首页路由和列表计算整理成更薄的入口层

## 需要特别小心的耦合点

- `BackgroundManager` 和 `CameraController` 共享同一个 `bgContainer`
- `SpineStage.vue` 的 Y 轴逻辑和 `PixiStageManager.fitSpineToPrefabRect()` 有交叉影响
- `StoryViewer.vue` 的 `freezeScene()` 会触发多个子模块清理
- 任何新模块都不要直接改别的模块的私有状态，优先通过显式方法暴露

## 验收标准

1. `npm run build` 通过。
2. 主要故事样本可正常打开、播放、切换。
3. Spine 实验页可正常打开，调试面板与拖拽仍可用。
4. 每次拆分都只引入一个新边界，不同时重构多个运行时路径。
5. 旧调用路径在过渡期保持兼容，避免一次性连锁改动。

## 推荐落地节奏

1. 先做纯工具函数抽离。
2. 再做组件内部纯计算抽离。
3. 然后做 manager 内部子系统拆分。
4. 最后再考虑更深的运行时重组。
