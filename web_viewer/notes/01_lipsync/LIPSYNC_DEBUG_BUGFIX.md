# 044ame 唇形异常小 · 排查与修复记录

> 2026-07-01 — 独立排查文档，与 `LIPSYNC_INTEGRATION.md` 配合阅读。
> 问题：044ame 角色嘴唇开合明显小于其他角色，mouth JSON 参数 `openMouthScale=2.5` 与其他角色 face_default 一致。

---

## 一、排查路线图

```text
用户报 044ame 嘴异常小
  │
  ├─ 检查 mouth JSON ────────── 参数正确（所有表情 openMouthScale=2.5）
  ├─ 检查 adxlip 曲线 ───────── 曲线正常，lipValue ≈ 0.65 与正常角色一致
  ├─ 检查 bone data.scaleX ──── mouth/mouth_close 均为 1.0（无骨骼基础缩放异常）
  │
  ├─ 【第 1 层发现】绑骨差异
  │   040ren: slotBone="mouth"      childRig=false   ← 正常 ADULT rig
  │   044ame: slotBone="mouth_close" childRig=true    ← 被判定为 CHILD rig
  │
  ├─ 【第 2 层发现】骨骼位置差异
  │   040ren mouth:  pos=(-19.8, -39.1)  ← head 下方 39px
  │   044ame mouth_close: pos=(-0.7, 84.4)  ← head 上方 84px!!
  │
  ├─ 【第 3 层发现】骨骼默认旋转
  │   040ren mouth: rot=-0.73°  mouth_close: rot=-2.60°
  │   044ame mouth: rot=0°      mouth_close: rot=0°
  │
  ├─ 【第 4 层发现】动画预置（关键）
  │   040ren face_shy: mouth.scaleX=1.497 (动画自带微开口)
  │   044ame face_trouble: mouth_close.scaleX=1.000 (动画无预置)
  │
  ├─ 【第 5 层发现】MESH 权重绑定
  │   040ren: meshBones=[character_X, mouth_close, face_control_reverse, ...]
  │   044ame: meshBones=[character_X, mouth_close, face_control_reverse, chara_MIX, ...]
  │   → 两个角色的 mesh 顶点都绑定 mouth_close + character_X 等
  │   → 044ame 额外有 chara_MIX 权重
  │
  └─ 【第 6 层发现 ★ 根因】骨骼被意外重置
      `resetBoneScale(mouthBone)` 在 child rig 路径中无条件执行
      → 把我们设置的 mouth.scaleX 从 2.8 重置回 1.0
      → 044ame 虽然 slot 在 mouth_close，mesh 权重在 mouth_close，
        但动画系统的骨骼计算涉及 mouth 骨，重置它的 scaleX 破坏了形变
```

---

## 二、逐层诊断记录

### 2.1 mouth JSON 参数确认（❌ 非根因）

`public/data/idolsetting/mouth/idol_mouth_stg_044ame.json`：
- 所有表情 `openMouthScale: 2.5`
- 对比 001tom face_default 也是 2.5，参数本身没问题

### 2.2 骨骼基础缩放确认（❌ 非根因）

```
[LipRig] 040ren: mouth(data.scaleX=1) mouth_close(data.scaleX=1)
[LipRig] 044ame: mouth(data.scaleX=1) mouth_close(data.scaleX=1)
```

两个角色均为 1.0，排除骨骼基础缩放异常。

### 2.3 绑骨类型差异（⚠️ 误导因素）

```
[LipRig] 040ren: slotBone="mouth" childRig=false activeBone="mouth"
[LipRig] 044ame: slotBone="mouth_close" childRig=true activeBone="mouth_close"
```

044ame 的 `mouth` slot 绑在 `mouth_close` 骨上（和幼年角色 047shu 同款绑骨）。代码将它判定为 CHILD rig，走 `mouth_close` 缩放路径。

诊断代码（1887-1913 行）：
```javascript
const slotBoneName = mouthSlot.bone?.data?.name || '(no-bone)'
const isChildRig = slotBoneName === 'mouth_close'
const activeMouthBone = isChildRig ? (mouthCloseBone || mouthSlot.bone) : (mouthBone || mouthSlot.bone)
```

### 2.4 骨骼位置差异（⚠️ 误导因素）

```
040ren: mouth(pos=(-19.84, -39.15), rot=-0.73°)
044ame: mouth(pos=(-7.85, 72.31), rot=0°) mouth_close(pos=(-0.73, 84.40), rot=0°)
```

044ame 的 `mouth` 和 `mouth_close` 骨都在 head 上方 72~84px（胡须型角色），而正常角色在 head 下方 30~40px。最初误以为支点位置高导致同样 scaleX 的视觉开口小，实际不是根因。

### 2.5 adxlip 曲线对比（❌ 非根因）

```
[LipCalc] 040ren exp=shy openRatio=0.572 mouthOpenScale=3 dynScaleY=2.145
[LipCalc] 044ame exp=trouble openRatio=0.654 mouthOpenScale=2.5 dynScaleY=1.981
```

两个角色的 lipValue（adxlip 曲线采样值）都在正常范围 0.57~0.65。dynScaleY 在 1.98~2.14 之间，数值接近。

### 2.6 动画预置对比（⚠️ 非根因但辅助判断）

```
[LipBonePre] 040ren exp=shy mouth.scaleX=1.563 mouth_close.scaleX=1.000
[LipBonePre] 044ame exp=trouble mouth.scaleX=1.000 mouth_close.scaleX=1.000
```

040ren 的 `face_shy` 动画在 lip-sync 介入前已经将 `mouth.scaleX` 设为 1.563（表情自带微开口），而 044ame 的 `face_trouble` 没有预置任何缩放。

### 2.7 MESH 顶点权重确认（关键线索）

```javascript
// 诊断代码（1984-1995 行）
const att = currentAtt
const isMesh = att.type === 2  // Spine AttachmentType.Mesh
const isRegion = att.type === 0
if (isMesh && att.bones) {
  meshBones = Array.from(att.bones).map(bi => {
    const b = spine.skeleton.bones[bi]
    return b ? b.data.name : `idx${bi}`
  }).join(',')
}
```

输出：
```
[LipAttach] 040ren att="mouth_shy1" type=MESH meshBones=[character_X, mouth_close, face_control_reverse, ...]
[LipAttach] 044ame att="mouth_trouble1" type=MESH meshBones=[character_X, mouth_close, face_control_reverse, chara_MIX, ...]
```

两个角色的 mouth mesh 都包含 `mouth_close` 和 `character_X` 权重。044ame 额外有 `chara_MIX`。

### 2.8 ★ 根因：骨骼被意外重置

**问题代码** — `PixiStageManager.js` 中 `updateWorldTransform` hook 的 open 分支末尾：

```javascript
// 旧代码（导致 bug）
if (mouthBone && mouthBone !== activeMouthBone) resetBoneScale(mouthBone)  // ← 第2048行
if (mouthCloseBone && mouthCloseBone !== activeMouthBone) resetBoneScale(mouthCloseBone)
```

执行流程：
1. `activeMouthBone.scaleX = 1.0 × 1.981 ≈ 1.981` ✓ （设了 mouth_close 骨）
2. `if (mouthBone && mouthBone !== activeMouthBone) ...` → 条件成立（mouth ≠ mouth_close）
3. → `mouthBone.scaleX = mouthBone.data.scaleX = 1.0` ✗（**刚设的 2.8 被覆盖为 1.0**）

对于 040ren（ADULT rig），`activeMouthBone === mouthBone`，条件不满足，跳过了重置，所以正常。

对于 044ame（CHILD rig），`activeMouthBone === mouth_closeBone`，条件满足，`mouthBone` 被重置。

---

## 三、修复方案

### 修改 1：阻止 child rig 中重置 mouth 骨（核心）

```javascript
// 旧
if (mouthBone && mouthBone !== activeMouthBone) resetBoneScale(mouthBone)

// 新 — child rig 下不重置 mouth，因为我们需要它保持缩放
if (mouthBone && mouthBone !== activeMouthBone && !isChildRig) resetBoneScale(mouthBone)
```

### 修改 2：闭口路径也保持双骨一致性

`resetMouthBones` 中：
```javascript
// 旧 — child rig 中把 mouth 骨 reset 到 data.scaleX
if (mouthBone && mouthBone !== activeMouthBone) resetBoneScale(mouthBone)

// 新 — 闭口时也同步缩放 mouth 骨（closeScale=1.0，所以和 reset 效果相同）
if (mouthBone && mouthBone !== activeMouthBone) {
  mouthBone.scaleX = mouthBone.data.scaleX * closeScale
  mouthBone.scaleY = mouthBone.data.scaleY
}
```

`closeScale=1.0` 时 `data.scaleX × 1.0 = data.scaleX`，行为一致。

### 修改 3：可选 scale 补偿（当前未启用）

`LIP_OPEN_SCALE_OVERRIDE` 常量用于未来遇到真正需要差值补偿的角色时直接添加，不用改逻辑。

---

## 四、为什么最初尝试的 LIP_OPEN_SCALE_OVERRIDE 修复无效

第一轮尝试加入 `LIP_OPEN_SCALE_OVERRIDE = { '044ame': 1.5 }`，但**视觉完全无变化**，因为：

1. 虽然 `dynScaleY` 从 1.98 → 2.80（提高 41%）
2. `activeMouthBone.scaleX`（mouth_close）正确设为 2.80
3. 但随后 `resetBoneScale(mouthBone)` 把 `mouth.scaleX` 从 1.0 → 2.8 → 1.0

数值翻倍了也没用 → 说明**根本不是倍数不够大的问题**，是**骨骼设置被覆盖了**。

---

## 五、踩坑点总结

| # | 坑 | 教训 |
|---|-----|------|
| 1 | **CHILD rig 检测不准确** | `mouth_close` 骨名不等于"幼年角色"——044ame（成年胡子角色）也用此绑骨。应改为只检测 `mouth` 骨是否存在 |
| 2 | **骨骼位置误导** | y=84 vs y=-39 的支点差异看起来很有道理，但实际不是根因。不要被"显而易见"的结论迷惑 |
| 3 | **重置代码的副作用** | `resetBoneScale` 设计为"保持未使用的骨骼干净"，但在 child rig 条件下意外覆盖了已设的值。条件判断不够精确 |
| 4 | **倍数测试失败** | 第一次加 1.5× 倍数完全没效果。如果 50% 增量都没变化 → 一定是其他地方覆盖了修改，不是倍数不够大 |
| 5 | **MESH 权重不是 slot bone** | slot 绑在 mouth_close ≠ mesh 顶点只受 mouth_close 影响。Spine 的 Mesh 有独立骨骼权重数组，和 slot 绑骨无关 |

---

## 六、关键调试工具

本次排查中有效的诊断日志：

```javascript
// 1. 绑骨诊断
console.log(`[LipRig] ${idolId}: slotBone="..." childRig=... parent=... pos=(...) rot=... len=...`)

// 2. MESH 顶点权重诊断
console.log(`[LipAttach] att="..." type=MESH meshBones=[bone1, bone2, ...]`)

// 3. 动画预置值（override 前）
console.log(`[LipBonePre] mouth.scaleX=... mouth_close.scaleX=... chin_control.y=...`)

// 4. 缩放计算结果（override 后）
console.log(`[LipCalc] openRatio=... mouthOpenScale=... dynScaleY=... finalScaleX=...`)
```

---

## 七、预防与后续

- 如果遇到其他角色嘴部异常，先加 `[LipRig]` 诊断看 slot 绑骨
- `slotsOn_mouth` vs `slotsOn_mouth_close` 的差异是决定性线索
- 最终修复只涉及条件判断的收紧，没有增加运行期计算开销

### ⚠️ 警戒：LIP_OPEN_SCALE_OVERRIDE 常量块切勿删除

`PixiStageManager.js` 中有一个当前**内容为空**的常量块：

```javascript
const LIP_OPEN_SCALE_OVERRIDE = {
  // 044ame: mouth slot on mouth_close, mouth bone was incorrectly reset to 1.0
  // Fixed by not resetting mouth in child rig path — no scale override needed.
}
```

**这个块虽然为空，但绝不能删除。** 原因：

1. **代码引用** — 第 2002 行 `mouthOpenScale` 计算中 `(LIP_OPEN_SCALE_OVERRIDE[idolId] || 1)` 直接引用此常量，删除会导致 `ReferenceError`
2. **备用基础设施** — 如果未来遇到真正需要 per-character 倍数补偿的角色（如骨骼位置极端、mesh 权重特殊），只需在此添加条目，**不修改核心逻辑**
3. **已踩过坑** — 该常量在调试过程中被误删过，导致第 2002 行 `ReferenceError`，唇部功能完全崩溃。**不要因为"看起来没用"就删掉被引用的常量**

判断准则：一个被代码引用的常量（即使是空对象），属于接口契约的一部分，不是 dead code。
