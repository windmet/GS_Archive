# 244sub 牙齿/舌/口盖附件按表情切换修复

> 2026-07-01 — 继承 `LIPSYNC_SUBMODEL_BUGFIX.md` 的修复基础。

---

## 一、问题

244sub 模型说话时：

- 牙齿角度僵硬歪掉，不同表情下牙齿不随表情角度变化
- 口腔内部件（齿、舌、口盖）不按表情切换
- 补偿逻辑引入 Y 轴错误，牙齿上下方向也被压缩

**关键差异**：成人模型 `040ren_001_00` 的 `tooth` 骨是 `head` 的子级（独立于 `mouth_close`），而 244sub 的 `tooth → mouth_close`。缩放 `mouth_close` 时 tooth 继承父级 scale，子骨 world transform 变形。

---

## 二、排查

### 2.1 X 轴缩放补偿已正确，但引入 Y 轴错误

之前的补偿代码：

```javascript
// ❌ 错误：scaleY 和 y 也应被除
bone.scaleX /= dynScaleY
bone.scaleY /= dynScaleY    // mouth_close 不缩 Y，这里多除
bone.x /= dynScaleY
```

`mouth_close.scaleY` 一直保持为 `1`，不随 lip-sync 变化。子骨的 `scaleY` 和 `y` 不应被除，否则 Y 向被错误压缩。

### 2.2 附件按表情切换验证

通过 `[LipTooth]` 诊断日志确认 mouth JSON 中的附件名是否正确被设置到 slot：

```
244sub mouth JSON 中每个表情有独立的：
  - upperTeethAttachmentName: tooth_angry / tooth_default
  - lowerTeethAttachmentName: tooth_bottom_angry / (空)
  - tongueAttachmentName: tongue_angry / tongue_default
  - openMouthClipAttachmentName: mouth_clip_angry / mouth_clip_default
```

---

## 三、修复

### 修改 1：补偿仅限 X 轴（核心修复）

```javascript
// open 路径
bone.scaleX /= dynScaleY
bone.x /= dynScaleY
// ❌ 不再除 scaleY, y

// close 路径
bone.scaleX = bone.data.scaleX
bone.x = bone.data.x
// ❌ 不再改 scaleY, y
```

`mouth_close` 的变换矩阵是 `[scaleX, 0; 0, 1]`，子骨的 world X 受父级 `scaleX` 影响，world Y 不受影响。只反补 `scaleX` 和 `x`。

### 修改 2：新增 `[LipTooth]` 诊断（仅用于验证）

每个 child rig 模型每表情首次命中时打印一次附件设置：

```
[LipTooth] 040ren exp=angry tooth_top=tooth_angry tooth_bottom=tooth_bottom_angry tongue=tongue_angry clip=mouth_clip_angry
[LipTooth] 040ren exp=default tooth_top=tooth_default tooth_bottom=none tongue=tongue_default clip=mouth_clip_default
```

### 修改 3：日志频率降低

| 日志标签 | 改动前 | 改动后 |
|----------|--------|--------|
| `[LipBonePre]` | 前 2 帧 | 仅第 1 帧 |
| `[LipCalc]` | 前 5 帧执行 | 前 3 帧执行 |
| `[LipSync]` | 第 5 帧触发停止标记 | 第 3 帧触发停止标记 |
| `[LipClip]` | 无条件每帧 | 移除（冗余） |

---

## 四、最终代码状态

`LipSyncController.js` 中 child rig 的完整处理管线：

```
每帧 state.apply() → 骨骼重设到动画值
  ↓
activeMouthBone.scaleX = data.scaleX * dynScaleY    ← mouth_close 按 adxlip 缩放
mouth_clip.scaleX = data.scaleX * dynScaleY           ← clip 遮罩同步扩大
  ↓
子骨补偿：tooth.scaleX /= dynScaleY, tooth.x /= dynScaleY  ← 抵消父级继承
  ↓
附件切换：tooth_top=tooth_angry, tongue=tongue_angry, clip=mouth_clip_angry
  ↓
origUpdateWorldTransform()                            ← Spine 计算 world transform
```

口合时 `resetMouthBones` 重置：
```
activeMouthBone.scaleX = data.scaleX × 1.0           ← mouth_close 复原
mouth_clip.scaleX = data.scaleX                        ← clip 复原
子骨：tooth.scaleX = data.scaleX, tooth.x = data.x    ← 子骨复原
附件：tooth_top=null, tongue=null, clip=null           ← 内部件清除
```

---

## 五、踩坑点

| # | 坑 | 教训 |
|---|-----|------|
| 1 | **父级只缩 X，子骨 Y 不应补偿** | `mouth_close` 的 `scaleY` 一直为 1，继承矩阵是 `[sX, 0; 0, 1]`。子骨 Y 不受影响。盲目全除把牙齿压扁了。 |
| 2 | **每项的归属** | clip 遮罩是 slot attachment via JSON `openMouthClipAttachmentName`，bone 缩放只是扩大区域。不要试图通过 scale 补偿解决 mesh skinning——移 clip slot 的 attachment name 让它显示。 |
