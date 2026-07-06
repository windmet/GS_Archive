# 244sub 幼年模型嘴部内部件拉伸排查与修复

> 2026-07-01 — 全文配合 `LIPSYNC_DEBUG_BUGFIX.md` 和 `LIPSYNC_INTEGRATION.md` 阅读。

---

## 一、现象

040ren 的幼年模型 `244sub_001_00` 说话时：

- ❌ 嘴部挖开一个大孔，外轮廓（嘴唇曲线）存在
- ❌ 旁边没有 clip 遮罩
- ❌ 一个椭圆形的口腔内部件暴露在外
- ❌ 牙齿跟着 `mouth_close` 骨骼旋转/缩放

成人模型 `040ren_001_00` 同样全部内部件（牙齿、舌头、口盖）消失。

---

## 二、排查路线图

```
用户报 244sub 内部件跑出遮罩
  │
  ├─ 第 1 层：RigDump slots/bones 诊断
  │   发现 mouth_close 下有 tooth 子骨
  │   tooth_top/tooth_bottom slot 带 bone=tooth（非 head）
  │   → 尝试 tooth bone local 反补偿
  │
  ├─ 第 2 层：MESH 顶点权重无法骨补偿
  │   tooth mesh 有 mouth_close 权重 → local scale 补偿无效
  │   → 尝试 mouth_clip 骨同步缩放遮住形变
  │
  ├─ 第 3 层：clip 附件的 attachmentName 为空
  │   mouth_clip slot 存在但附件不显示
  │   → 检查 mouth JSON：040ren 的 openMouthClipAttachmentName=""
  │
  └─ 第 4 层 ★ 根因：_loadMouthSetting 用错了 JSON
      模型是 244sub_001_00，但代码写死 idolId="040ren"
      → 加载了 idol_mouth_stg_040ren.json（无 clip、无 244sub 专属附件名）
      → 且正则 /_\d{5}_\d{2}$/ 匹配失败，所有模型多跑一次 404
      → 延迟窗口内 mouthEntry=null → 内部件附件全设 null → 消失
```

---

## 三、逐层诊断记录

### 3.1 RigDump：骨骼结构确认（引导因素）

`[RigDump]` 日志（新增于本次排查）：

```
tooth(sX=1,sY=1,parent=mouth_close,len=0)    ← tooth 是 mouth_close 的子级
mouth_clip(sX=1,sY=1,parent=head,len=0)       ← clip 是 head 的子级（平级）
tooth_top(bone=tooth), tooth_bottom(bone=tooth)  ← slot 绑在 tooth 骨上
```

不同于标准 CHILD rig（047shu）的 `tooth → head`，244sub 的 `tooth → mouth_close`。

### 3.2 骨骼补偿无效（已回滚尝试）

初始尝试：当 `mouth_close.scaleX` 放大时，反补偿 tooth 子骨的 `bone.scaleX /= parentSX`、`bone.x /= parentSX`。

**无效原因**：tooth **mesh 顶点权重**包含 `mouth_close`（Spine AttachmentType.Mesh 的独立骨骼权重数组）。骨骼 local 变换无法抵消 skinning 层形变。

### 3.3 mouth_clip 骨缩放（保留，但单独不足）

将 `mouth_clip` 骨骼的 scaleX 与 `mouth_close` 同步缩放（`mouth_clip.scaleX = data.scaleX * dynScaleY`），使 clip 遮罩区域随嘴部张开扩大。

但 040ren 的 JSON 中 `openMouthClipAttachmentName: ""`，clip 附件实际未设置 → clip slot 为空 → 缩了也白缩。

### 3.4 ★ 根因：MouthSetting 加载用了错误 ID（行 247-279）

问题正则：

```javascript
const modelPrefix = modelId.replace(/_\d{5}_\d{2}$/, '')
// "244sub_001_00" → 不匹配！_001 只有 3 位数字
// 正则要求 5 位数 (\d{5})，永远匹配失败
// → primaryId 回退到 idolId = "040ren"
// → 加载 idol_mouth_stg_040ren.json（错误配置）
```

040ren JSON 的 `face_angry` 条目：
```json
{ "openMouthClipAttachmentName": "",
  "upperTeethAttachmentName": "tooth_angry", ... }
```

244sub JSON 的正确条目：
```json
{ "openMouthClipAttachmentName": "mouth_clip_angry",
  "upperTeethAttachmentName": "tooth_angry",
  "tongueAttachmentName": "tongue_angry",
  "lowerTeethAttachmentName": "tooth_bottom_angry", ... }
```

**连锁效应**：
1. 正则不匹配 → `primaryId = "040ren"` → 请求 `idol_mouth_stg_040ren.json` OK
2. `_mouthData` = 040ren 的数据
3. 040ren 的 face_angry 无 `openMouthClipAttachmentName`、无 `tongueAttachmentName`
4. → `mouthEntry?.openMouthClipAttachmentName || null` → `null` → clip 不显示
5. → `mouthEntry?.tongueAttachmentName || null` → `null` → tongue 附件清除
6. **成人模型**虽然正则匹配走同一路径，但在延迟窗口内 `mouthEntry === null`，内部件也被设成 null

---

## 四、修复方案

### 修改 1：Slot 查找 fallback

```javascript
const toothTopSlot = spine.skeleton.slots.find(s => /^tooth_top$/i.test(s.data.name))
  || spine.skeleton.slots.find(s => /^tooth$/i.test(s.data.name))
```

244sub 只有 `tooth` slot（其他模型用 `tooth_top`）。

### 修改 2：mouth_clip 骨缩放（child rig 路径）

在 open 分支中同步缩放 `mouth_clip.scaleX = data.scaleX * dynScaleY`，close 路径中重置。

`mouth_clip` slot 的 attachment 由 JSON 的 `openMouthClipAttachmentName` 控制，clip 遮罩区域随骨扩大，遮盖 tooth mesh 在 mouth_close 权重下的变形。

### 修改 3（核心）：_loadMouthSetting 按模型加载

```javascript
const modelPrefix = modelId.replace(/_\d{3}_\d{2}$/, '')
// "244sub_001_00" → "244sub"
const primaryId = modelPrefix !== idolId ? modelPrefix : idolId
```

- **有子模型 JSON**（如 244sub）：直接加载专用配置，获得正确的 clip/tooth/tongue 附件名
- **无子模型 JSON**：fallback 到 idolId 配置

同时修正正则 `\d{5}` → `\d{3}`，避免所有模型多跑一次 404 请求。

### 修改 4：Fallback 路径补 updateWorldTransform

fallback 路径原先不触发骨架更新，数据加载后不生效。

---

## 五、最终代码改动清单

| 文件 | 行 | 改动 |
|------|----|------|
| `LipSyncController.js` | 69 | `toothTopSlot` 新增 fallback 到 `tooth` slot |
| `LipSyncController.js` | 75 | 新增 `mouthClipBone` 查找 |
| `LipSyncController.js` | 130 | `resetMouthBones` 中重置 `mouthClipBone.scaleX` |
| `LipSyncController.js` | 190-194 | open 分支中 child rig 下缩放 `mouthClipBone.scaleX` |
| `LipSyncController.js` | 251 | 正则 `\d{5}` → `\d{3}`，修复模型前缀提取 |
| `LipSyncController.js` | 252 | `primaryId` 逻辑——子模型用模型前缀的 mouth JSON |
| `LipSyncController.js` | 255-267 | Fallback 路径补数据检查和 `updateWorldTransform()` |

---

## 六、踩坑点总结

| # | 坑 | 教训 |
|---|-----|------|
| 1 | **骨骼补偿不能解决 mesh skinning** | tooth 是 mouth_close 的子骨，但 tooth mesh 顶点权重包含 mouth_close。改子骨 local 变换影响不了被 skinning 直接拉扯的顶点。 |
| 2 | **正则永远不匹配** | 视觉上 2 位数后缀（`_00`）没问题，但前缀 `_001` 只有 3 位数而 `\d{5}` 要 5 位。一眼以为是倍数之类的问题，实际只是 `{5}` 换成 `{3}`。 |
| 3 | **040ren 和 244sub 共用 mouth JSON key** | 代码用 `idolId` 加载嘴部配置，但 040ren 幼年形态用 244sub 模型。数据完全不匹配。其他 sub 角色也可能有同样问题。 |
| 4 | **成人 modelId 也是 _xxx_00 模式** | `040ren_001_00` 的正则匹配也失败，导致成人模型也走双请求延迟 → 内部件临时消失。子模型问题伪装成了全模型问题。 |
| 5 | **嘴部配置的字段差异跨角色不可见** | 两个 JSON 都有 `face_angry` entry，字段结构相似，不看附件名看不出差异。单纯加日志看不出字段缺失，要结合 RigDump slots 观察 clip slot 是否有 attachment。 |

---

## 七、其他 sub 角色

所有 sub 模型（`244sub_001_00`、`245sub_001_00` 等）的 `modelId.replace(/_\d{3}_\d{2}$/)` 都能正确提取前缀。如果有 sub 模型拥有自己的 `idol_mouth_stg_{prefix}.json` 文件，会自动使用；没有的 fallback 到 `idolId` 配置。

sub 模型的 mouth JSON 存在情况（已知）：

| 模型 | 有独立 mouth JSON |
|------|-------------------|
| 244sub | ✅ |
| 231sub | ❌（文档记录） |
| 242sub | ❌（文档记录） |
| 104omn | ❌（文档记录） |

---

## 八、关键诊断日志

```
[LipMouth] ${idolId} using model-specific mouth setting: ${primaryId}  ← 子模型命中专用配置
[LipMouth] ${idolId} model "${modelId}" has no own mouth setting, using idolId  ← 无专用配置走 fallback
```
