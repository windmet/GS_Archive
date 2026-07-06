# 037jir 面部 MESH 拉伸排查与修复

> 2026-07-01

---

## 一、问题

037jir 说话时面部整体向外拉伸（"正正方方"溢出），胡子 + 下巴皮肤跟着 mouth 一起变形。之前用 `LIP_OPEN_SCALE_OVERRIDE['037jir']=0.75` 减少缩放幅度但无法根本解决。

## 二、排查过程

### 2.1 初始假设

根据之前的 RigDump 数据假设 ADULT rig 用 `mouth` 骨 + REGION 贴图（独立），而 CHILD rig 用 `mouth_close` 骨 + MESH 贴图（含面部纹理）。037jir 被识别为 CHILD rig，所以缩 `mouth_close` 导致了面部拉扯。

### 2.2 _compareRigs() 诊断推翻假设

新增 `window._compareRigs()` 函数一次性对比所有屏幕上角色的绑骨和附件类型，输出：

```
001tom: ADULT slotBone=mouth attType=MESH meshWt=[character_X,mouth_close,face_control_reverse,chara_MIX]
035mco: ADULT slotBone=mouth attType=MESH meshWt=[chara_MIX,mouth_close]
036rui: ADULT slotBone=mouth attType=MESH meshWt=[chara_MIX,mouth_close,character_X,face_control_reverse]
037jir: CHILD  slotBone=mouth_close attType=MESH meshWt=[character_X,mouth_close,face_control_reverse]
047shu: CHILD  slotBone=mouth_close attType=MESH meshWt=[character_X,mouth_close,face_control_reverse,chara_MIX]
004ter: ADULT slotBone=mouth attType=MESH meshWt=[z_adjust,mouth_close,chara_MIX,face_control]
```

### 2.3 关键发现

1. **所有人都是 MESH 附件**，没有 REGION——我和之前对 ADULT/CHILD rig 贴图类型的假设完全错误。
2. **所有人的 mesh 权重都含 `mouth_close`**，ADULT 和 CHILD 在这方面没有区别。
3. **真正的区别**是 ADULT 角色缩放 `mouth` 骨，CHILD 角色缩放 `mouth_close` 骨。
4. **`mouth` 骨不在任何角色的 mesh 权重里**——缩放 `mouth` 只影响 slot attachment 的局部变换，不影响顶点位置。
5. 缩放 `mouth_close` 才真正拉扯 mesh 顶点 → 面部变形。

### 2.4 隐藏面部附件验证

通过 `window._hideFaceParts()` 隐藏所有非嘴部面部分件（脸颊、鼻子、耳朵等）后：

- 面部拉伸**依旧存在**
- 确认是**纯 mesh 顶点拉伸**，不是多挂了其他零件

## 三、根因

```
037jir 被识别为 CHILD rig (mouthSlot → mouth_close)
  → 缩放 mouth_close 骨
  → mouth mesh 权重含 mouth_close
  → mouth_close 缩放 → mesh 顶点偏移 → 整张脸拉伸
```

所有 ADULT rig 角色（001tom 等）的 mouth 骨不在 mesh 权重里，缩 mouth 只有 slot transform 变化，不拉脸。

## 四、修复：USE_MOUTH_BONE_FOR_SCALE

### 新增角色名单

```javascript
const USE_MOUTH_BONE_FOR_SCALE = new Set([
  '037jir',
])
```

### 逻辑变更

```javascript
const useMouthBone = isChildRig && USE_MOUTH_BONE_FOR_SCALE.has(idolId)
const activeMouthBone = useMouthBone ? (mouthBone || mouthSlot.bone)
  : isChildRig ? (mouthCloseBone || mouthSlot.bone)
  : (mouthBone || mouthSlot.bone)
```

| 场景 | 改动前 | 改动后 |
|------|--------|--------|
| 037jir 开嘴缩放 | `mouth_close.scaleX = 1.0 → 1.875` → 拉脸 | `mouth.scaleX = 1.0 → 1.875` → 安全 |
| 037jir `mouth_close` 开嘴时 | 在缩放 | `resetBoneScale(mouth_close)` → 保持在 data 值 |
| 037jir `mouth_close` 闭嘴时 | 重置到 data | 同上（不变） |
| 其他 CHILD rig (047shu) | 不变 | 不变 |

### 移除

不再需要 `LIP_OPEN_SCALE_OVERRIDE['037jir']`，因为不再缩 `mouth_close`。

## 五、现有主要参数总览

| 常量/名单 | 说明 |
|-----------|------|
| `LIP_OPEN_SCALE_OVERRIDE` | 逐角色 openMouthScale 全局系数（仅 044ame 用） |
| `USE_MOUTH_BONE_FOR_SCALE` | 本应缩 mouth_close 但 mesh 含其权重的角色，改缩 mouth |
| `LIP_OPEN_SCALE_OVERRIDE['044ame']` | 044ame mouth slot 挂在 mouth_close 上，mouth bone 原始动画值异常，mouth_close 缩放时 mouth 需同步 |

## 六、诊断工具

```javascript
window._compareRigs()           // 对比所有角色的绑骨/附件类型/mesh权重
window._listFaceSlots()         // 列出面部 slot → bone → attachment
window._hideFaceParts()         // 隐藏非嘴部面部分件（隔离验证）
window._showFaceParts()         // 恢复 setup pose
```

## 七、后续排查

其他 CHILD rig 角色（如 047shu、244sub 等）如果出现类似面部拉伸，应按以下步骤排查：

1. `_compareRigs()` 确认 `attType=MESH` 且 `meshWt` 含 `mouth_close`
2. 如果张嘴时面部有明显横向拉伸 → 加入 `USE_MOUTH_BONE_FOR_SCALE`
3. 注意 mouth_clip 骨骼的 parent 检查（037jir 的 parent=neck，不能缩放）
