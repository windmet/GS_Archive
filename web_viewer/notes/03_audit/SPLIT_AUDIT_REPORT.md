# 拆分审计报告

> 最后更新：2026-07-01 | 基于 git commit `ca3a28e`
> 用途：记录当前拆分进度、各文件连通状态、可安心删除的部分

---

## 2026-07-01 追加：LipSyncController 已拆出

本次已将唇部运行时从 `PixiStageManager.js` 封装迁移到 `src/core/LipSyncController.js`。

当前边界：
- `PixiStageManager.setSpineTalking()` 只保留对外兼容转发。
- `PixiStageManager._loadMouthSetting()` 只保留兼容委托。
- `_pendingTalking` 的实际所有权在 `LipSyncController.pendingTalking`，`PixiStageManager._pendingTalking` 只是同一对象引用，用于继续兼容 `finalizeSpawnedSpine()`。
- `LIP_OPEN_SCALE_OVERRIDE` 已移动到 `LipSyncController.js`，即使为空也必须保留。

后续拆分注意：
- 不要把唇部逻辑搬回 `PixiStageManager.js`。
- 下一轮 `PixiStageManager.js` 瘦身应避开 `LipSyncController.js`，除非是专门修唇部。
- 若继续拆 Spine 子系统，`setSpineTalking` 仍应作为 public facade 存在，调用方不应直接依赖 controller 内部方法。
- `044ame` 修复依赖 child-style rig 中 `mouth_close` 与 `mouth` 的同步缩放，不要重新引入 `resetBoneScale(mouthBone)` 覆盖该值。

## 一、总览

### 初始状态（ca3a28e）

| 文件 | 行数 |
|---|---|
| `src/core/PixiStageManager.js` | ~2758 |
| `src/core/StoryViewer.vue` | ~968 |
| `src/components/SpineStage.vue` | ~1187 |
| `src/App.vue` | ~776 |
| **合计** | **~5689** |

### 当前状态（2026-07-01 working tree）

| 文件 | 行数 | 变化 |
|---|---|---|
| `src/core/PixiStageManager.js` | 2563 | **-195** |
| `src/core/StoryViewer.vue` | 608 | **-360** |
| `src/components/SpineStage.vue` | 1065 | **-122** |
| `src/App.vue` | 656 | **-120** |
| **合计** | **4892** | **-797** |

### 新拆分文件（7 个）

| 文件 | 行数 | 来源 | 状态 |
|---|---|---|---|
| `src/utils/IndexNormalizer.js` | 23 | App.vue — 文件列表工具函数 | ✅ 已接通 |
| `src/utils/IndexStats.js` | 45 | App.vue — 统计数据计算 | ✅ 已接通 |
| `src/utils/YPositionResolver.js` | 70 | SpineStage.vue — Y 轴定位算法 | ✅ 已接通 |
| `src/utils/LipSyncHelpers.js` | 38 | StoryViewer.vue — 口型纯函数 | ✅ 已接通 |
| `src/utils/StoryStepFlow.js` | 49 | StoryViewer.vue — 步类型判断 / 自动推进时间 | ✅ 已接通 |
| `src/core/useVoicePlayer.js` | 185 | StoryViewer.vue — 语音播放 composable | ✅ 已接通 |
| `src/core/rafTween.js` | 48 | PixiStageManager — rAF 补间引擎 | ✅ 已接通 |

### Phase 3 拆分文件（已拆出，已接通）

| 文件 | 行数 | 内容 | 状态 |
|---|---|---|---|
| `src/core/transitionTweens.js` | 85 | 屏幕过渡补间（fade / slide / punch） | ✅ 已接通 |
| `src/core/spineSpawnPipeline.js` | 87 | Spine 加载管线（atlas→skel→png→texture） | ✅ 已接通 |
| `src/core/spineSpawnFinalize.js` | 84 | Spine spawn 后初始化（位置 / 动画 / 淡入） | ✅ 已接通 |
| `src/components/SpineStageDiagnostics.js` | 192 | SpineStage 调试面板逻辑 | ✅ 已接通 |

---

## 二、PixiStageManager.js 详细侦查

### 2.1 已安全的内部替换（旧手写代码被抽走）

下面的方法仍然存在于 PixiStageManager 中作为**转发壳**，但内部的补间/加载逻辑已经被新文件替代：

#### `transitionTweens.js` 接管的部分

| PixiStageManager 方法 | 行号 | 实际逻辑来源 | 说明 |
|---|---|---|---|
| `setScreenFade()` | 797 | → `tweenOverlayFade()` | 补间动画已抽出 |
| `_playFadeScreenEffect()` | 860 | → `tweenOverlayFade()` | 补间已抽出 |
| `_playPunchEffect()` | 897 | → `tweenOverlayPunch()` | 震屏补间已抽出 |
| `setScreenSlide()` | 915 | → `tweenOverlaySlide()` | 滑动补间已抽出 |
| `_playSingleScreenEffect()` | 887 | → `tweenOverlayPunch()` + `tweenOverlayFade()` | 转发调用 |

#### `rafTween.js` 接管的部分（8 处 `runRafTween()` 调用）

| 方法 | 内容 |
|---|---|
| `setBgBlur()` | 背景模糊补间 |
| `setBgColorOverlay()` | x2（淡入 + 淡出） |
| `setCameraZoom()` | 镜头缩放补间 |
| `setSpineColor()` | 角色 tint 补间 |
| `animateSpineAlpha()` | 角色淡入淡出 |
| `_tweenX()` | 角色 X 位移补间 |

#### `spineSpawnPipeline.js` 接管的部分

`spawnSpine()`（1317行）中的以下代码已被一句 `loadAndCreateSpine({...})` 替代：
- `fetch(atlasUrl)` / `fetch(skelUrl)`
- `_decodeAtlasText(atlasBuf)` 调用
- `_extractTextureFilename(atlasText)` 调用
- `_resolveTextureUrl(modelId, textureFile)` 调用
- `_loadTextureFromUrl(textureUrl)` 调用
- `new TextureAtlas(atlasText, ...)` 构造
- `AtlasAttachmentLoader(atlas)` + `SkeletonBinary(attachmentLoader)` 构造
- `readSkeletonData(new Uint8Array(cleanSkel))` 调用
- `new Spine(skeletonData)` 构造
- 骨架几何验证循环

#### `spineSpawnFinalize.js` 接管的部分

`spawnSpine()` 中的以下代码被 `finalizeSpawnedSpine({...})` 替代：
- `_applyDefaultPosition()` 调用
- 默认动画设置（Track 0 body + Track 1 face）
- `captureBaselineBounds()` 调用
- `setSpineTalking()` 恢复
- `_fadeIn()` 调用

### 2.2 仍需保留的底层工具函数（被回调传入新文件）

以下函数仍作为回调被传入 `loadAndCreateSpine()`，目前不能删除，但可以继续搬入 `spineSpawnPipeline.js`：

| 方法 | 行号 | 用途 |
|---|---|---|
| `_decodeSkelBuffer(buf)` | 1741 | 去除 Unity skel 头部 |
| `_decodeAtlasText(buf)` | 1764 | 去除 Unity atlas 头部 |
| `_extractTextureFilename(atlasText)` | 1776 | 找贴图文件名 |
| `_resolveTextureUrl(modelId, textureFile)` | 1843 | 贴图 URL + 回退 comu.png |
| `_isImageUrl(url)` | 1858 | HEAD 请求检查是不是图片 |
| `_loadTextureFromUrl(url)` | 1869 | PIXI 贴图加载 |
| `_getFallbackTexture()` | 1897 | 品红色占位贴图 |
| `getDefaultBodyAnim(animNames)` | 1551 | 选择默认 body 动画 |
| `captureBaselineBounds(idolId)` | 1570 | 基线帧快照 |
| `_fadeIn(spine, duration)` | 2163 | 淡入 |
| `_emitSpineState(idolId)` | 1537 | 拖拽事件广播 |

> 这些函数除了 `_emitSpineState` 和 `captureBaselineBounds` 之外几乎都可以直接移入 `spineSpawnPipeline.js`，因为它们在当前 PixiStageManager 中**只被 `spawnSpine()` 这一个入口调用**。

### 2.3 仍需保留的方法（无拆分，仍在使用）

#### 背景系统（~200 行，与 CameraController 共享 bgContainer）

| 方法 | 行号 |
|---|---|
| `setBackground(bgId, transition)` | 468 |
| `clearBackground()` | 504 |
| `setCameraFilter(filter)` | 518 |
| `setBgBlur(amount, duration, delay)` | 552 |
| `_ensureBgBlurFilter()` | 581 |
| `setBgBlurInstant(amount)` | 596 |
| `clearBgBlur()` | 618 |
| `setBgColorOverlay(hexColor, duration, delay)` | 630 |
| `clearBgColorOverlay()` | 702 |
| `_hexToRgb(color)` / `_rgbToHex({r,g,b})` | 709 / 713 |
| `applyBgEffects(effects)` | 965 |
| `_createBgEffect(id)` / `_drawRain()` / `_resizeBgEffects()` | 990+ |
| `_bgEffectTargetAlpha(id)` / `_animateBgEffectAlpha()` | 1039+ |
| `_removeBgEffect(id)` | 1083 |

#### 镜头系统（~80 行，与 BackgroundManager 共享 bgContainer）

| 方法 | 行号 |
|---|---|
| `setCameraZoom(zoomData)` | 724 |
| `resetCameraZoom()` | 778 |

#### Spine 渲染系统（~400 行，仍在活动使用）

| 方法 | 行号 |
|---|---|
| `setSpineColor(idolId, hexColor, duration, delay)` | 1155 |
| `setSpineZoom(idolId, zoomMultiplier)` | 1193 |
| `setSpineScale(idolId, scale)` | 1204 |
| `flushSpinePose(idolId, dt)` | 1212 |
| `getPrefabRectMetrics(spine, prefabMeta)` | 1227 |
| `fitSpineToPrefabRect(spine, prefabMeta, options)` | 1328 |
| `setSpinePosition(idolId, positionIdx)` | 1683 |
| `setSpinePositionByGameCoord(idolId, posX, posY, baseY)` | 1704 |
| `bringToFront(idolId)` | 1719 |
| `applySpineOrder(idolIds)` | 1728 |
| `_detectBlinkSlots(spine)` | 1791 |
| `_detectEffectSlots(spine)` | 1823 |
| `setSpineTalking(idolId, isTalking, volumeCallback)` | 1921 |
| `_loadMouthSetting(idolId, spine)` | 2071 |
| `setSpinePartsVisible(idolId, visible)` | 2105 |
| `_detectOptionalPartsSlots(spine, idolId, modelId)` | 2112 |
| `_applyOptionalPartsSlots(spine)` | 2146 |
| `animateSpineAlpha(idolId, targetAlpha, duration, delay)` | 2174 |
| `_fadeOutWrapper(wrapper)` | 2211 |
| `_destroyWrapperNow(wrapper)` | 2239 |
| `_fadeOutAndDestroy(idolId, immediate)` | 2246 |
| `playSpineAnim(idolId, animName, skipChain, noBack, motionSetting)` | 2388 |
| `switchSpineAnim(idolId, animName)` | 2449 |
| `playSpineNeckAnim(idolId, animName)` | 2475 |
| `stopSpineNeckAnim(idolId)` | 2495 |
| `removeSpine(idolId, immediate)` | 2511 |
| `clearAllSpines()` | 2515 |

### 2.4 与旧版相比已消失的重复代码

旧版 PixiStageManager（ca3a28e，~2758 行）中以下代码在当前版中已**不再存在**：

| 已消失的内容 | 去向了 |
|---|---|
| 每个补间方法中的 `performance.now() - t0` → `easeOutCubic` → `rAF` 递归 | `runRafTween()` |
| `setScreenFade` 中的逐帧 alpha 补间 | `tweenOverlayFade()` |
| `_playPunchEffect` 中的 `shake = sin(t*PI*8)` 震屏 | `tweenOverlayPunch()` |
| `setScreenSlide` 中的 `start.x + (end.x - start.x) * ease` | `tweenOverlaySlide()` |
| `spawnSpine` 中的 atlas/skel 加载 + TextureAtlas 构造循环 | `loadAndCreateSpine()` |
| `spawnSpine` 中的默认动画设置 + 基线捕获 | `finalizeSpawnedSpine()` |

---

## 三、StoryViewer.vue 拆分详情

### 已拆出

| 旧代码 | 新文件 | 状态 |
|---|---|---|
| `sampleLipCurve()` | `LipSyncHelpers.js` | ✅ 已接通 |
| `deriveMainLipPathFromVoice()` | `LipSyncHelpers.js` | ✅ 已接通 |
| `isTransitionStep()` | `StoryStepFlow.js` | ✅ 已接通 |
| `getAutoAdvanceTiming()` | `StoryStepFlow.js` | ✅ 已接通 |
| 全部语音播放逻辑（AudioContext / fetch / decode / lip curve 等） | `useVoicePlayer.js` | ✅ 已接通 |

### 仍留在 StoryViewer.vue（608 行）

| 逻辑块 | 行数估计 | 计划去向 |
|---|---|---|
| Timeline 引擎（`_startTimeline` / `_tickTimeline` / `_fireTimelineEvent` 等） | ~80 行 | `useTimelineRunner.js` |
| 导航系统（`goNext` / `goPrev` / `onChoice` / `historyStack`） | ~100 行 | `useStoryNavigation.js` |
| Step watch 中的音频处理（SE / BGM / 环境音 / 过渡自动推进） | ~120 行 | `useStepAudio.js` |
| 模板 + UI 编排 | ~150 行 | 保留 |

---

## 四、SpineStage.vue 拆分详情

### 已拆出

| 旧代码 | 新文件 | 状态 |
|---|---|---|
| `getSelectedReferenceY()` / `resolveBaseY()` / `computeVisualRootY()` | `YPositionResolver.js` | ✅ 已接通 |
| `pickBoundsTargetId()` / `buildBoundsSnapshot()` / `buildSpineDebugState()` / `buildYDiagnosticRow()` / `logYDiagnostics()` | `SpineStageDiagnostics.js` | ✅ 已接通 |

### 仍留在 SpineStage.vue（1065 行）

| 逻辑块 | 行数估计 | 计划去向 |
|---|---|---|
| `applyState()` — state diff / 角色增删改 | ~220 行 | `useSpineSync.js` |
| 调试 UI 渲染（debug panel / bounds overlay） | ~250 行 | 保留（Vue 模板） |
| 生命周期 / props 绑定 / watch | ~150 行 | 保留 |

---

## 五、App.vue 拆分详情

### 已拆出

| 旧代码 | 新文件 | 状态 |
|---|---|---|
| `normalizeFileList()` / `groupFileList()` / `groupFileCount()` | `IndexNormalizer.js` | ✅ 已接通 |
| `totalFiles` computed / `getCategoryCountText()` / `countScenarioFiles()` | `IndexStats.js` | ✅ 已接通 |

### 仍留在 App.vue（656 行）

| 逻辑块 | 行数估计 | 计划去向 |
|---|---|---|
| 全部导航逻辑（`openCategory` / `openIdol` / `openGroup` / 回退等） | ~200 行 | `useAppNavigation.js` |
| 模板（7 个 `v-if` 视图 + 样式） | ~300 行 | 保留 |
| 生命周期（`onMounted` 中的索引加载 + `showAnims` 调试） | ~80 行 | 保留 |

---

## 六、可安心删除的部分（下一轮清理）

以下代码在旧版中存在，当前版中已被完全替代或注销：

| 位置 | 内容 | 依据 |
|---|---|---|
| PixiStageManager `setBgBlur` | 手写 `cancelAnimationFrame → performance.now() → easeOutCubic → rAF` | 已被 `runRafTween()` 替代 |
| PixiStageManager `setBgColorOverlay` | 同上 | 已被替代 |
| PixiStageManager `setCameraZoom` | 同上 | 已被替代 |
| PixiStageManager `setSpineColor` | 同上 | 已被替代 |
| PixiStageManager `animateSpineAlpha` | 同上 | 已被替代 |
| PixiStageManager `_tweenX` | 同上 | 已被替代 |
| PixiStageManager `setScreenFade` 内部补间 | `t0 → elapsed → ease → rAF` | 已去 `tweenOverlayFade()` |
| PixiStageManager `_playFadeScreenEffect` 内部补间 | 同上 | 已去 `tweenOverlayFade()` |
| PixiStageManager `_playPunchEffect` 内部补间 | `shake = (1-t) * sin(t*PI*8)` | 已去 `tweenOverlayPunch()` |
| PixiStageManager `setScreenSlide` 内部补间 | `start.x + (end.x-start.x) * ease` | 已去 `tweenOverlaySlide()` |
| PixiStageManager `spawnSpine` 中的加载/构造循环 | atlas/skel fetch + TextureAtlas 构造等 | 已去 `loadAndCreateSpine()` |
| PixiStageManager `spawnSpine` 后处理 | 默认动画 / baseline / fadeIn | 已去 `finalizeSpawnedSpine()` |
| SpineStage.vue 中行内 `getSelectedReferenceY()` / `resolveBaseY()` / `computeVisualRootY()` | Y 轴定位公式 | 已去 `YPositionResolver.js` |
| StoryViewer.vue 中行内 `sampleLipCurve()` / `deriveMainLipPathFromVoice()` | 口型纯函数 | 已去 `LipSyncHelpers.js` |
| StoryViewer.vue 中行内 `isTransitionStep()` / `getAutoAdvanceTiming()` | 步类型判断 | 已去 `StoryStepFlow.js` |
| StoryViewer.vue 中所有 voice 相关变量 + 方法 | 语音播放状态机 | 已去 `useVoicePlayer.js` |

> 注意：上面列的"可安心删除"是指该代码**不会再被任何路径执行**，旧版中对应功能已经完全由新文件替代。不是指在文件里直接删掉对应的行——删之前需要先确认转发壳已经正常工作。

---

## 七、下一轮可继续搬入新文件的代码

### PixiStageManager → `spineSpawnPipeline.js`

以下函数只被 `spawnSpine()` 通过回调使用，可以直接移入 `spineSpawnPipeline.js`：

```js
_decodeSkelBuffer(buf)        // 1741
_decodeAtlasText(buf)          // 1764
_extractTextureFilename(text)  // 1776
_resolveTextureUrl(mid, file)  // 1843
_isImageUrl(url)               // 1858
_loadTextureFromUrl(url)       // 1869
_getFallbackTexture()          // 1897
getDefaultBodyAnim(anims)      // 1551
captureBaselineBounds(id)      // 1570
_fadeIn(spine, duration)       // 2163
```

移动后 PixiStageManager 减少约 **150 行**。

### PixiStageManager → `BackgroundManager.js`

```js
setBackground(bgId, transition)
clearBackground()
_applyBgCover(sprite)
setCameraFilter(filter)
setBgBlur()          // 仍有转发壳
_ensureBgBlurFilter()
setBgBlurInstant()
clearBgBlur()
setBgColorOverlay()  // 仍有转发壳
clearBgColorOverlay()
_hexToRgb() / _rgbToHex()
applyBgEffects() / _createBgEffect() / _drawRain() / _resizeBgEffects()
_bgEffectTargetAlpha() / _animateBgEffectAlpha() / _removeBgEffect()
```

移动后 PixiStageManager 减少约 **250 行**。

### PixiStageManager → `CameraController.js`

```js
setCameraZoom(zoomData)  // 仍有转发壳
resetCameraZoom()
```

移动后 PixiStageManager 减少约 **80 行**。

### PixiStageManager → `SpineManager.js`

`setSpineColor` / `setSpineZoom` / `flushSpinePose` / `fitSpineToPrefabRect` / `setSpinePosition*` / `bringToFront` / `applySpineOrder` / `playSpineAnim` / `switchSpineAnim` / `removeSpine` / `clearAllSpines` / `getSpineRuntimeSnapshot` / `getSkeletonLocalBounds` 等约 **400 行**。

---

## 八、当前各新文件头部导入确认

### PixiStageManager.js 头部 import

```js
import { getBgUrl, getMouthSettingUrl, getSpineAtlasUrl, getSpineSkelUrl } from '../utils/AssetResolver.js'
import { easeOutCubic, runRafTween } from './rafTween.js'
import { tweenOverlayFade, tweenOverlayPunch, tweenOverlaySlide } from './transitionTweens.js'
import { loadAndCreateSpine } from './spineSpawnPipeline.js'
import { finalizeSpawnedSpine } from './spineSpawnFinalize.js'
```

### SpineStage.vue 头部 import

```js
import { pickBoundsTargetId, buildBoundsSnapshot, buildSpineDebugState, buildYDiagnosticRow, logYDiagnostics } from './SpineStageDiagnostics.js'
import { getSelectedReferenceY, resolveBaseY, computeVisualRootY as computeVisualRootYUtil } from '../utils/YPositionResolver.js'
```

### StoryViewer.vue 头部 import

```js
import { sampleLipCurve, deriveMainLipPathFromVoice } from '../utils/LipSyncHelpers.js'
import { isTransitionStep, getAutoAdvanceTiming } from '../utils/StoryStepFlow.js'
import { useVoicePlayer } from './useVoicePlayer.js'
```

### App.vue 头部 import

```js
import { normalizeFileList, groupFileList, groupFileCount } from './utils/IndexNormalizer.js'
```
## 2026-07-01 续审：当前拆分基准

> 本段是后续拆分的最新指导，优先级高于下方旧审计表格。当前基准为 `474cc1e fix: restore child lip rig detection`，其前置拆分包括 `5439aeb refactor: extract prefab rect fit helpers`。

### 当前状态

| 文件 | 当前行数 | 状态 |
|---|---:|---|
| `src/core/PixiStageManager.js` | 2459 | 仍为主控类，继续拆分时必须保留运行时行为 |
| `src/core/spinePrefabFit.js` | 97 | 已拆出 prefab rect fit 纯计算逻辑，已接通 |

### 已确认不能再回退的修复

1. Lip-sync 必须保留 `mouthsetting` 的逐角色、逐表情参数。
   - `openMouthScale` 来自 `spine._mouthData.mouthes.find(m => m.animationName === "face_${exp}")`。
   - 不允许把开口强度退化为全局常量；`FALLBACK_LIP_OPEN_SCALE` 只能用于缺失 mouth JSON 的兜底角色。
   - `openMouthAttachmentName`、`closeMouthAttachmentName`、`tongueAttachmentName`、`upperTeethAttachmentName`、`lowerTeethAttachmentName`、`openMouthClipAttachmentName` 也必须继续按当前表情 entry 读取。

2. Lip rig 分型必须保留。
   - 运行时通过 `mouthSlot.bone?.data?.name` 得到 `mouthSlotBone`。
   - `isChildRig = mouthSlotBone === "mouth_close"` 是必要逻辑，不是可删变量。
   - ADULT rig 缩 `mouth` 骨；CHILD rig 缩 `mouth_close` 骨。
   - `tooth` / `tongue` 骨不做手动缩放，只允许按 mouthsetting 切换附件；否则会出现内部件随嘴部拉伸或跑出口腔的问题。

3. Camera zoom 背景必须同时满足“位移、缩放、不露黑边”。
   - `spineContainer` 使用完整 camera transform，负责角色聚焦。
   - `bgContainer` 可以跟随缩放和位移，但位移必须按 cover 后背景边界 clamp，不能把左/右/上下边拖出画布。
   - 不允许简单改成“背景固定不动”，也不允许简单套用角色同款位移导致黑边。

### 下一轮拆分红线

| 目标模块 | 可拆 | 不可破坏的状态 |
|---|---|---|
| `LipSyncController.js` | 可以从 `setSpineTalking()` / `_loadMouthSetting()` 拆出 | 必须传入 `idolId`、`spine`、`getMouthSettingUrl`、逐帧 `getVoiceVolume`；必须保留逐角色逐表情 `mouthEntry` 查询、`isChildRig` 分型、只缩 active mouth bone |
| `CameraController.js` | 可以拆 `setCameraZoom()` / `resetCameraZoom()` | 必须持有 `width`、`height`、`bgSprite`、`bgContainer`、`spineContainer`，并保留背景 clamp |
| `BackgroundManager.js` | 可以拆背景加载、cover、滤镜、叠色、特效 | `_applyBgCover()` 的结果会被 camera clamp 使用；拆分时要保留 `bgSprite.x/y/width/height` 的可读性 |

### 拆分前后必须验证

1. `node --check src/core/PixiStageManager.js`
2. `npm run build`
3. 手动验证 `1_1_013the_02_1_1_013_02` 第 25-27 步：镜头能推向 315 事务所门牌，背景缩放和位移存在，但不露左侧黑边。
4. 手动验证至少一个 ADULT rig 和一个 CHILD rig 的 lip-sync：嘴能张开，内部牙齿/舌头不被横向拉伸，开口强度随角色和表情变化。

---

## 2026-07-01 追加：BackgroundManager 已拆出
本轮已将 `PixiStageManager.js` 的背景生命周期与背景特效迁出到 `src/core/BackgroundManager.js`。

### 当前边界
- `PixiStageManager.js` 现在只保留背景相关 public facade、`setCameraFilter()`、以及仍需和 `bgSprite` 联动的镜头缩放逻辑。
- `BackgroundManager.js` 负责：`setBackground`、`clearBackground`、背景模糊、背景色遮罩、背景特效、resize 适配。
- `setCameraZoom()` 仍在 `PixiStageManager.js`，但通过 `bgSprite` getter 读取背景状态，后续可以在不改背景实现的前提下继续拆镜头控制。

### 当前尺寸
| 文件 | 当前行数 | 状态 |
|---|---:|---|
| `src/core/PixiStageManager.js` | 约 1320+ | 继续瘦身中，背景实现已迁出 |
| `src/core/BackgroundManager.js` | 约 320+ | 已接管背景与背景特效 |

### 这一刀后要记住
1. 不要把背景逻辑再写回 `PixiStageManager.js`。
2. 镜头缩放仍然可以保留在主类，先别急着把 `bgContainer` 的 clamp 再拆散。
3. 下一个高性价比目标是 `CameraController`，但必须先确认背景平铺和 clamp 行为完全稳定。