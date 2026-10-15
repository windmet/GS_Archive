# ADV 舞台原生定位、缩放、镜头与口型：2026-10-15

分支：`portal/20261015-native-adv-placement`。依据客户端 2.6.10 反编译（StoryCamera、AdventureCharacterParent、IdolCharacter、IdolFigureSkeleton / IdolFigureTexture、AdventureBackgroundPanel、UpdateLip）与 RAW `costume_*.unity3d` / `silhouettes.unity3d` prefab。旧的手调常数与按角色、模型的特例全部删除。

## 坐标系（`shared/story/AdvStageLayout.js`）

- 单位是 StoryIdolCanvas 画布单位：x 向右，y 向上，原点在画面中心。StoryCamera 的 orthographicSize 为 4.347826 世界单位，画布 1/72，所以视野高 626.087 单位。画面宽高比 ≥ 16:9 时按高度适配，更窄时保持 16:9 的宽度（1113.04 单位）。
- 竖屏：客户端只有横屏，没有原生规则。宽高比从 1（方屏）到 1:2，可视舞台宽度从 16:9 宽度（1113 单位）连续收窄到 620 单位，人物大小随之变大，不会缩成一条；同时偶像槽位与镜头平移的横向偏移按“可视宽度 / 1113”压缩，三人同框（x = ±350）也留在手机屏内，相邻人物可能略有重叠。横屏与方屏不变。人物大小只取决于整块舞台容器，顶部的 step、返回、菜单是叠层，不参与计算。
- 偶像槽位 = (idol_position + idol_zoom 位置)，再加上 NotChangedPriority 的 (0, −50)。localScale 等于 idol_zoom 的 size。
- 骨骼立绘：根节点 y = 槽位 y + prefab 根 y × zoom；Pixi 缩放 = 单位像素 × zoom / 3（SkeletonDataAsset scale 1/300，referencePixelsPerUnit 100）。
- 贴图立绘（社长等 3 个剪影与 2 个童年剪影）：用 sprite rect 原尺寸，底边中点在 idolothersetting 的 positionY（没有则 −640）。站内 PNG 是打包后的 texture rect，按 textureRectOffset 放回 rect 内。
- 背景：1800×960 的 BackgroundPanel 缩放 orthographicSize / 5，居中，覆盖 4/3 视野高。只有比面板更宽（约 2.5:1）的屏幕才额外放大补满。
- 镜头 MoveCamera：(x, y, zoom) 线性插值。角色层绕中心缩放 zoom 并跟随镜头；背景只在视野变宽时随之放大，屏幕上的倍率为 max(1, zoom)，平移与角色相同。
- IdolCharacter 的位置与缩放各自线性插值；idol_zoom 参数为 [chara, startTime, playTime, posX, posY, size(默认 1)]。

## 数据

- `scripts/build-idol-figure-placement.py` 读 RAW prefab，生成 `public/data/idolsetting/idol_figure_placement.json`，包含 725 个骨骼模型的根 y（−765 至 −485）和 5 个贴图立绘的 rect。脚本会断言每个 prefab 根锚点居中、x = 0、scale 1、骨骼 scale 1/300，有偏差就直接失败。
- 删除 `costume_prefab_meta.json`、`CostumePrefabMetaStore`、`YPositionResolver`、`SpinePositionLayout`、`spinePrefabFit`。删除 SpineStage 的 URL 调参（pixelScale / baseAnchor / anchorUnityY / SUB_* / fitMode / bodyScale / visualRefHeight / x_、y_、s_ 覆盖与“复制参数”），以及 PixiStageManager 的 ADULT/SUB 基础缩放、按角色和模型的缩放倍率，还有 portrait 1.25 放大。
- 原生 ADV 的骨骼立绘不读 idolothersetting 与 body type；资源计划去掉 `idol-placement`、`idol-body-types`、`costume-prefab-metadata`，改为一份 `costume-figure-placement`。
- 编译器 `_idol_zoom` 改为输出 `idol_zoom`、`idol_zoom_x`、`idol_zoom_y` 与 `idol_zoom_transition`，不再输出按 (1 − zoom) × 750 估算的 `idol_zoom_y_offset`；客户端也忽略旧字段。

## 口型（`LipSyncController`）

- 按原生 UpdateLip：用当前 face 轨道动画名查 MouthInfo（找不到再用 body 轨道），找不到就不改动。
- 闭嘴时：mouth 骨 scaleY = 1、scaleX = closeMouthScale，换闭嘴贴图，清掉 clip、上下牙、舌头。
- 张嘴时：scaleY = 采样 x，scaleX = 采样 y × openMouthScale，换上张嘴各槽位贴图（名称为空即不显示）。
- 曲线从语音 0.1 s 开始，按 60 fps 取整帧，不插值。
- 删除猜测的开口倍率、037jir 用 mouth 骨的特例、子 rig 与 mouth_clip 补偿、chin_beard 提升。

## 验证

- 口型（2026-10-15 复核）：剧情里 `004ter` 播放时嘴骨 scaleX 在 1–3.5 间随曲线开合、scaleY 约 1，张/闭嘴贴图（`mouth_default2` / `mouth_default1`、`mouth_swet2`）按采样切换，嘴型与游戏截图一致；编译场景中 6217 次 face 动画有 6151 次能在 MouthInfo 中找到（其余是 102sha 剪影与 3 个 `joy`）。新增 `verify-lip-sync-native.mjs` 固定原生语义（开口、闭口、turnOffLipSync、缺 MouthInfo、body 轨道回退、曲线 60 fps 从 0.1 s 起）。
- 缩放复核：用游戏截图（舞田 lesson、天道辉教室）按同尺寸渲染对比，头宽与背景板位置相差 2–4%，没有整体偏大，所以未加全局缩放倍数。

- 新增 `verify-native-adv-placement.mjs`（已加入 verifier batch），覆盖几何公式、prefab 数据，以及编译场景中 360 个模型的覆盖。其中 358 个有定位；`020hay_002_00`、`049eis_002_00` 在客户端与站内都没有资源。
- `verify-scenario-commands.py` 新增 idol_zoom 编译回归。
- 按原生公式改写的 verifier：
  - stage-resize、position-clock：线性 tween、resize、暂停。
  - camera-clock、projector：线性镜头；背景面板与投影器对比 45 次 shadow。
  - stage-loading、silhouette-fallback、config-preload、`repair/stage-config.test`。
- `voice-backends.test` 覆盖原生采样。
- `npm run build:check` 通过（生成器改写的翻译与资源审计已恢复）。verifier batch 133/133 通过。
- Browser（5177，Edge headless）：
  - 舞田类 lesson（bg032）与游戏截图对比：头顶在视野高度 0.141（游戏中 0.146），头宽与横向位置一致，背景裁切一致。
  - 皮埃尔青蛙装（剧情 0.8 镜头、首页）整只连同王冠都在画面内，与保镖同比例。
  - 社长剪影与冬马、輝同台，高度与比例协调；两位童年剪影按各自 positionY 呈孩子身高。
  - 山村贤与桜庭薰同框、0.9 镜头三人同框均无偏移。
  - 首页语音口型：mouth 骨 scaleX 最高 3.03，开/闭贴图正常切换；控制台无错误。

## 边界与后续

- 已发布的编译场景仍是旧编译结果：没有 `idol_zoom_x/y` 与 `idol_zoom_transition`，所以带位移的 idol_zoom（例如 `1_1_003_01` 中 007kei 1.2 倍、y −50）暂时只有缩放正确，位置要等候选流程重新编译、晋升后才对。原生 135 处 idol_zoom 中不少带 y 偏移。
- idol_position 滑动的等待时间（startTime）尚未编进 `slide_duration` 的数据，目前按立即开始处理。
- 发布时需要包含 `idol_figure_placement.json`；`costume_prefab_meta.json` 已不再被引用。
