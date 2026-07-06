# Text Asset 接入审计

最后更新：2026-06-30

本文保留 text asset 的资源梳理、当前接入状态和后续实现顺序。状态机细节见 `TEXT_ASSET_STATE_MACHINE_AUDIT.md` 和 `ADV_STATE_MACHINE_NOTES.md`，踩坑见 `PITFALLS_AND_DEBUGGING.md`。

## 目标

把 raw scenario 中只给出命令名或资源名的演出，尽量接回官方 text asset 数据：

- 背景默认 BGM、环境音、颜色参数。
- 动作名到 loop/back animation 的映射。
- 颜色滤镜 preset。
- prefab 中的 transform、pivot、mask、scale。
- 特效资源和 shader/粒子配置。

## 已接入或正在使用

### `scenariodata`

核心 ADV 状态机数据源，已用于：

- 背景、BGM、语音、SE、环境音。
- 角色模型、位置、表情、动作、出入场、层级、颜色。
- 镜头缩放、镜头重置、屏幕 fade、slide。
- `text_disable`、`stage`、`choice`、`text_time` 等 step。

### `lipsyncdata/adxlip`

详见 `LIPSYNC_INTEGRATION.md`。当前作为唇形权威数据源。

### 编译结果

```text
E:\Web_build\SideM_Archived\web_viewer\public\data\compiled
```

前端只应依赖编译后的 state，不应在渲染时重新猜 raw 命令含义。

### `advbackground/json`

状态：2026-06-30 已接入编译期。

当前实现：

- `_image_bg()` 会读取 `E:\BaiduNetdiskDownload\SideM\scripts\advbackground\json\advbg_data_{bg}.json`。
- 编译结果输出 `state.bg_profile`，包含 `lightPosition`、`lightCoordinate`、`lightAlpha`、`colorOffSet`、`colorScale`、`colorSaturation`。
- 当剧情脚本没有显式控制 BGM/环境音时，会从背景 metadata 补默认 `bgmCueName` / `ambienceCueName`。
- 若后续 raw 命令显式指定或停止 BGM/环境音，以 raw 为准。
- 默认音频会先检查本地 `GS_Res/Audio` 是否存在，过滤占位值和错栏 cue。

全量编译验证：

```text
compiled files: 3404
steps: 69305
bg_profile steps: 63361
environmental steps: 62794
bgm steps: 43658
voice steps: 26912
lip steps: 25170
```

### `idolmotionsetting`

状态：2026-06-30 已接入前端播放链路。

当前实现：

- 源数据：`E:\BaiduNetdiskDownload\SideM\scripts\idolfigure\idolmotionsetting`。
- 生成索引：`public/data/idolsetting/motion/idol_motion_index.json`。
- 前端加载：`src/utils/IdolMotionSettingStore.js`。
- 播放消费：`SpineStage.vue` 按 `modelId` 优先、`idolId` 兜底查映射，传给 `PixiStageManager.playSpineAnim()`。
- 渲染器优先使用官方 `poseAnimationName` 作为 single-shot 后续循环姿势；没有官方映射时保留旧的 `anim + "_loop"` / `wait_loop` 降级。

资源统计：

```text
motion setting files: 84
indexed entries: 84
indexed motions: 400
```

当前边界：

- `backAnimationName` 已保留在索引中，但暂未主动播放。是否需要在离开某些 pose 时先播放 back，需要后续用官方视频和 raw 命令样本确认。

## 高优先级待接入

### `advbackground/json`

已接入，保留本节作为历史记录。后续若要让 `colorOffSet/colorScale/colorSaturation` 直接影响画面，需要先在前端实现独立的背景 color profile filter，并和 `image_bg_color` 的叠加层分开。

### `idolmotionsetting`

已接入基础链路，保留本节作为历史记录。下一步重点是验证 `backAnimationName` 是否需要显式状态机，而不是简单把它接在每个动作后面。

### `colorfilterpreset`

用途：

- 灰度、棕褐、单色等滤镜矩阵。
- 替代当前硬编码滤镜。

优先级：

- 中等。当前主要剧情已经可用，但接入后可减少猜测。

### `prefab`

用途：

- Unity 侧 localScale、localPosition、RectTransform、pivot、mask。
- 可能解释嘴部、口腔、牙齿、舌头穿模，以及部分角色默认坐标差异。

优先样本：

```text
001tom
004ter
047shu
004ter_105_00
016sei_002_00
024shk_001_00
011min_002_00
```

风险：

- prefab 是 Unity YAML/序列化数据，不能只用字符串搜索做最终结论。
- 需要先抽样确认字段意义，再做批量转换。

## 特效类待接入

### `cameraflare`

当前状态：

- 暂未找到可信 shader/粒子组合。
- 不建议用猜测的光源叠加替代官方效果。

后续方向：

- 从 effect 相关 text asset、shader 名、particle/prefab 引用继续追。
- 找到最小可验证样本后再接前端。

### `effect_single` / `effect_bgstart` / `effect_bgend`

当前状态：

- 部分命令已经能保留到 step，但视觉资源映射不足。

后续方向：

- 先统计出现频率和资源名。
- 选高频样本做资源追踪。
- 明确资源类型后再进入 Pixi 实现。

## 状态机相关命令

重点命令：

- `text_disable`
- `image_bg_color`
- `image_bg_dof`
- `image_bg_view_type`
- `camera_zoom`
- `camera_resetzoom`
- `idol_color`
- `idol_fadein`
- `idol_fadeout`
- `idol_delete`
- `cut_end`

这些命令不能只看是否出现，还要看它们在 raw 命令序列中的位置。很多问题不是“命令没处理”，而是“命令被合并到错误 step”或“过早清除/过晚清除”。

## 推荐审计流程

1. 选择一个官方视频可对照的 scenario。
2. 查看 raw 命令序列。
3. 查看 compiled step 是否缺 step。
4. 查看 state 是否在正确 step 出现、持续、清除。
5. 前端核对视觉是否按 duration 过渡。
6. 最后再判断是否需要新增 text asset 资源映射。

## 当前重点样本

```text
1_1_013the_02_1_1_013_02
1_1_015leg_04_1_1_015_04
1_4_001_00
1_4_001_01
```
