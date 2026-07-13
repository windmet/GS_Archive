# PROJECT_MAP

SideM 剧情浏览器 — 前端基于 Vue 3 + Vite + PixiJS 7 + Spine 3.8。

## 入口

```
src/main.js                     → mount App.vue
src/App.vue                     → home / list / card / player 导航
src/core/StoryViewer.vue        → 剧情播放器容器（连接 SpineStage + 各 UI 组件）
```

## 工程分层

### `src/components/` — Vue 组件层

| 文件 | 职责 |
|------|------|
| `SpineStage.vue` | 舞台容器 + step 编排入口 (~1200行, 含 debug 面板) |
| `SpineStageDiagnostics.js` | debug 面板的诊断数据函数 |
| `SpineViewer.vue` | Spine 自由预览实验室 |
| `SynopsisUI.vue` / `AdvUI.vue` | 剧情 UI 类型渲染 |
| `CallUI.vue` / `ChoiceUI.vue` / `TextTimeUI.vue` | 电话/选项/时间轴 UI |
| `LoadingScreen.vue` / `MobileUI.vue` / `TitleUI.vue` | 通用 UI |

### `src/core/` — 运行时核心层

| 文件 | 职责 |
|------|------|
| `PixiStageManager.js` | PixiJS canvas + 舞台图管理 |
| `SpineManager.js` | Spine 角色定位/排序/清理 |
| `BackgroundManager.js` | 背景渲染/切换/特效 |
| `CameraController.js` | 镜头/缩放/滤镜 |
| `LipSyncController.js` | 口型同步 |
| `applyStepSceneState.js` | step → 舞台状态应用 |
| `spineSpawnPipeline.js` / `spineSpawnFinalize.js` | Spine 加载/生成管线 |
| `spinePrefabFit.js` | Spine Prefab 适配 |
| `transitionTweens.js` / `rafTween.js` | 动画过渡工具 |
| `useStepSceneEffects.js` | step 场景特效 |
| `useStoryNavigation.js` | 剧情导航状态 |
| `useTimelineRunner.js` | 时间轴执行 |
| `useVoicePlayer.js` | 语音播放 |

### `src/utils/` — 工具层

| 文件 | 职责 |
|------|------|
| `AssetResolver.js` | 资源 URL 解析 (spine/bg/voice/silhouette) |
| `CostumeDictionaryStore.js` | 服装字典 store |
| `CostumePrefabMetaStore.js` | Prefab 元数据 store |
| `IdolMotionSettingStore.js` | 动作设置 store |
| `IdolNameMap.js` | 角色 ID → 名字映射 |
| `IndexNormalizer.js` / `IndexStats.js` | 索引标准化/统计 |
| `LanguageStore.js` | 语言切换 |
| `Preloader.js` | 资源预加载 |
| `StoryStepFlow.js` | 剧情 step 流程 |
| `TextHelper.js` | 文本处理 |
| `UnitNameMap.js` | 组合名映射 |
| `YPositionResolver.js` | Y 轴定位解析 |

### `tools/` — 离线脚本 (Python/Node)

资源抽取、审计、索引生成等。不进入前端运行时。

### `notes/` — 开发笔记

分类存储：lipsync / debug / audit / refactor / exploration / archived

## 关键数据流

```
User click → App.vue fetch compiled JSON
  → StoryViewer.vue 逐 step 推进
    → SpineStage.vue (props.step)
      → applyStepSceneState()
        → PixiStageManager.setBackground / setSpine / etc.
```

## 禁止默认扫描目录

- `node_modules/`, `dist/`
- `_archive/`, `_migration_backup*/`, `_encoding_review/`
- `_archived_volume_lipsync/`
- `external_raw/`, `raw/`, `public/raw/`
- 大体积 `.unity3d`, `.acb`, `.awb`, `.usm`
- 未索引 scenario 原始目录
