# ADV 人物逐帧姿态与面部效果：按原生收敛（2026-10-20）

分支 `portal/20261020-adv-native-pose`（基于 origin/master 5aab5644）。

## 原生依据（client 2.6.10）

- `SkeletonGraphic.Update(float)`（RVA 0x13a36e8）每帧先 `Skeleton.SetToSetupPose()`，再 `AnimationState.Apply`，
  然后跑 UpdateLocal 委托（UpdateLip / UpdateCheek / UpdateSweat），最后 `UpdateWorldTransform`。
- `PlayNeckInternal`：neck 放在轨道 1，`TrackEntry.mixBlend = Add`，back 动画的 mix 为 0.25。
- `IdolFigureSkeleton.SetCheekHidden` / `SetSweatHidden`：按 `StartsWith("cheek")` / `StartsWith("swet")` 选槽位。
  这两个字面量由 ELF 的 metadata usage 加 global-metadata.dat 解出；同法解出的 `eye_close` 用作对照。
  隐藏期间每帧把这些槽位的 attachment 置空。
- `IdolCommandData`：idol_face 的 [3] / [4] / [5] 若为 `"off"`，分别对应 isEyeOff / isSweatOff / isCheekOff。
  编译产物中的字段是 `anim_flag` / `sweat_flag` / `blush_flag`，值为 UTF-8 的 目 / 汗 / チーク 或 off。

## 039mcr 眼白问题的机制

眼白网格绑在 eyelash_L/R 骨骼上，而只有加性 neck 动画会给这两根骨骼打缩放关键帧。
如果每帧不先回到 setup pose，加性缩放就会逐帧累积，眼白随之翻转或胀大。
旧实现靠「neck 目标复位 + 眨眼遮盖」来补这个问题，属于逻辑叠逻辑。

## 改动

- 新增 `src/core/spineFramePose.js`：`installNativeFramePose(spine, afterApply)` 包住 `state.apply`，
  每帧先 `setToSetupPose()`；`afterApply` 的位置对应原生 UpdateLocal。
- 新增 `src/core/spineFaceEffects.js`：按 cheek / swet 前缀收集槽位；flag 为 `"off"` 时，每帧在 Apply 之后清空这些槽位的 attachment。
- 删除以下旧逻辑：
  - `spineBlinkCover.js`、`spineBlinkSlots.js` 及其两个 verifier；
  - PixiStageManager 里旧的 `state.apply` 包装，包括 neck 目标复位、眨眼遮盖，以及 blush/sweat 判断（它比较的是乱码字面量，所以腮红和汗一直被隐藏）；
  - 无效的 `state.update` alpha 包装；
  - SpineManager 的 `_neckAdditiveTargets` / 清理标记。
- 保留：track 4 上的 `eye_close`（`_applyCloseEye`）；LipSyncController 的挂载点不变（在 Apply 之后、`updateWorldTransform` 时）。

## 验证

- `scripts/verify-spine-native-frame-pose.mjs`（`npm run verify:spine-frame-pose`，登记在 localOnly.corpus）用的是真实的 039mcr_001_00 骨骼：
  - neck_lookup 保持 4 秒，eyelash 缩放始终为 0.95，停止后姿态回到参考值；
  - cheek / swet 的前缀边界；
  - 显示 / 隐藏 / 恢复。
- 变异测试，三项都会让 verifier 失败：
  - 去掉 `setToSetupPose`：eyelash 缩放跑到 -9.79；
  - 把前缀改成 `sweat`；
  - 把 blush 判断反过来。
- 回归：close-eye、motion-state、client-motion、neck-back、track-time、story-stage-loading、neck-contract、atomic-fade、lip-sync-native、verifier-coverage 全部通过；`npm run build:check` 通过。
- 模拟器 fuzz（原生管线对比 web）：39 个模型、全部槽位，attachment 差异为 0。
  换 body clip 不会留下残余骨骼（039mcr_001/101、045sor_002 各 0 例）。
- 浏览器（swiftshader + CDP，dev 带 read model）：
  - 偶像主页选 039mcr，连续点触 10 次以上，眼睫缩放在 1–1.04 之间。
  - 在 neck_question 期间放大截脸，眼白正常。
  - 剧情 1_1_013the_01 中 `blush_flag=チーク` 时，cheek_L/R 正常显示。

## 后续

- `src/core/StudioCompositionStage.js` 还保留着一套自己的 neck 复位、`neckOverlayAnimation` 和 `/cheek/i` 启发式，应改用这两个模块。
  `spineNeckOverlay.js` 暂时为 Studio 保留。
- 场景整体的重编译尚未执行，见交接说明。
