# SideM Story Viewer 唇部同步系统文档

> 维护说明：本文是唇形系统专项文档。当前项目入口见 `DEVELOPMENT.md`，嘴部结构和错误路线的排坑索引见 `PITFALLS_AND_DEBUGGING.md`。

最后更新：2026-06-30

本文档记录唇部同步系统的完整架构，包括：
1. **数据源** — adxlip 逐帧曲线 + mouthsetting JSON
2. **编译器路径匹配** — voice cue → adxlip JSON 的映射规则
3. **前端运行期** — 曲线采样 → 附件切换 → 骨骼缩放
4. **口腔骨骼模型** — 逐个角色的绑骨差异与处理策略
5. **修复历程** — 从全局常量到逐角色逐表情的完整修正路径

---

## 一、数据源

### 1.1 adxlip 逐帧曲线

原始 `lipsyncdata/adxlip/` 目录下存放原厂逐帧嘴部开合数据：

```json
{
  "scales": [
    { "x": 1.0, "y": 0.0 },
    { "x": 1.0, "y": 0.48 }
  ]
}
```

- `scales[].y` — 嘴部开合强度，范围 0.0~1.0
- `scales[].x` — 有细微变化但当前不使用，仅透传
- 语音 cue 名（如 `1_1_013_02_a1001`）与 JSON 文件名对应

### 1.2 mouthsetting JSON（逐角色逐表情）

每个角色有独立的嘴部配置 JSON：

```
/public/data/idolsetting/mouth/idol_mouth_stg_{idolId}.json
```

结构：

```json
{
  "mouthes": [
    {
      "animationName": "face_default",
      "openMouthAttachmentName": "mouth_default2",
      "closeMouthAttachmentName": "mouth_default1",
      "openMouthClipAttachmentName": "",
      "upperTeethAttachmentName": "tooth_default",
      "lowerTeethAttachmentName": "",
      "tongueAttachmentName": "tongue_default",
      "openMouthScale": 2.5,
      "closeMouthScale": 1.0,
      "turnOffLipSync": false,
      "attachmentsWhenOpenMouth": [],
      "attachmentsWhenCloseMouth": []
    },
    // 每个表情对应一个 entry
  ]
}
```

**关键字段：`openMouthScale`** — 每个角色、每个表情有独立的嘴部最大缩放值。

**覆盖范围**：84 个文件覆盖所有 49+ 名角色（含 sub 角色），仅 3 个边缘角色无对应 JSON：104omn、231sub、242sub。

### 1.3 openMouthScale 数据范围

| 维度 | 范围 | 示例 |
|------|------|------|
| 角色间最小 | 1.0 | 010pie_001_00 face_default（幼年版） |
| 角色间最大 | 5.0 | 029ass face_surprise |
| 非 sub 角色 default 表情 | 2.0~4.5 | 多数在 2.5~3.5 |
| sub 角色 default 表情 | 2.0~3.5 | 多数在 2.0~3.0 |

---

## 二、编译器接入

### `_resolve_lip_sync()` 多路径匹配

`scenario_compiler.py` 中的 `_resolve_lip_sync()` 为每个 `voice_file` 生成候选路径并检查 `os.path.exists`。

**输入**：
- `voice_file` — scenario 中配置的语音前缀（如 `1_1_013_02`）
- `voice_suffix` — text step 中的后缀（如 `a1001`），拼成完整 cue `{voice_file}_{voice_suffix}`
- `chara_id` / `owner` — 角色 ID
- `scenario_id` — 完整 scenario ID

**计算中间变量**：
- `prefix = voice_file`（如 `1_1_013_02`）
- `suffix = voice_suffix`（如 `a1001`）
- `base = file_stem`（scenario_id 去掉末尾字母段后的主体，如 `1_1_013_02`）
- `letter = ` 末尾字母段（如从 `1_1_013_02_a` 提取 `a`）

#### 候选路径生成规则（按优先级）

| 优先级 | 目录 | 路径模式 | 适用场景 | 示例 |
|--------|------|----------|----------|------|
| 1 | owner | `{chara}/{prefix}/{prefix}_{suffix}.json` | 基础角色剧情 | `001tom/2_2_001_01/2_2_001_01_00_09.json` |
| 2 | epi | `epi/{owner}/{base}/{base}_{letter}/{base}_{suffix}.json` | 第零话 1_1 | `epi/013the/1_1_013_02/1_1_013_02_a/1_1_013_02_a1001.json` |
| 3 | main | `main/{main_id}/{base}/{prefix}/{prefix}_{suffix}.json` | 主线 1_4/1_7/1_8 | `main/1_4_001_01/.../1_4_001_01_a1001.json` |
| 4 | event | `event/{base}/{base}_{letter}/{base}_{suffix}.json` | 活动 1_3 | `event/1_3_001_01/1_3_001_01_a/1_3_001_01_a1001.json` |
| 5 | season | `season/{season_group}/{base}/{base}_{suffix}.json` | 季节 5_xx | `season/5_01_22/5_01_999_22/5_01_999_22_22.json` |

#### 特殊回退规则

**短数字后缀回退**：当 `voice_suffix` 是纯数字（如 `22`）时，路径可能比预期少一层目录。

**Season 999 shared_base 回退**：当 `5_01_999` 等特殊 prefix 使用 `999` 作为共享 base 时，在 season 目录下额外尝试。

**Suffix 已是完整 cue 名**：部分 scenario 的 `voice_suffix` 实际上已经包含完整 cue。

### 编译产物

每个 voice step 写入可选的 `dialogue.lip` 字段：

```json
{
  "dialogue": {
    "voice": "1_1_013_02_a1001.m4a",
    "lip": {
      "source": "adxlip",
      "path": "adxlip/epi/013the/1_1_013_02/1_1_013_02_a/1_1_013_02_a1001.json",
      "frames": 152
    }
  }
}
```

---

## 三、前端运行期

### 3.1 资源 URL

`AssetResolver.js` 提供：
- `getLipSyncUrl(path)` — 映射 lipsyncdata 路径
- `getMouthSettingUrl(idolId)` — 映射 mouthsetting JSON：`/data/idolsetting/mouth/idol_mouth_stg_{idolId}.json`

### 3.2 播放流程

```text
StoryViewer 播放 voice:
  1. 读取 step.dialogue.lip.path
  2. 存在 → fetch JSON → sampleLipCurve 解析 scales[] 到 _currentLipCurve
  3. 不存在 → _currentLipCurve = null
  4. AudioManager.decodeAudio() → source.start(0)
  5. setSpineTalking(idolId, true, getVoiceVolume)
  6. → PixiStageManager 标记 idolId 为说话状态
  7. 每帧 updateWorldTransform hook:
     → getVoiceVolume() 采样 _currentLipCurve(elapsed)
     → 开合阈值判断 → mouthsetting 查询 → 附件 swap → mouth bone scale
  8. 语音结束 → setSpineTalking(idolId, false)
```

### 3.3 每帧注入逻辑（核心）

在 `setSpineTalking()` 中劫持 `spine.skeleton.updateWorldTransform`：

```javascript
const origUpdateWT = spine.skeleton.updateWorldTransform
spine.skeleton.updateWorldTransform = function () {
  // 1. 提取当前表情
  const currentAtt = mouthSlot.attachment
  const match = currentAtt.name.match(/^(mouth_(.+?))(\d)$/i)
  if (!match) return
  const exp = match[2]

  // 2. 从 adxlip 曲线采样
  const lipValue = getVoiceVolume()  // 0~1
  const isOpen = lipValue > ORIGINAL_LIP_OPEN_THRESHOLD

  if (isOpen) {
    // 3. 查询 mouthsetting
    const mouthEntry = spine._mouthData?.mouthes
      ?.find(m => m.animationName === `face_${exp}`)

    // 4. 附件切换: mouth_default1 → mouth_default2（开）
    spine.skeleton.setAttachment('mouth', openName)

    // 5. 骨骼缩放
    const mouthOpenScale = mouthEntry?.openMouthScale ?? FALLBACK_LIP_OPEN_SCALE
    const dynScaleY = ORIGINAL_LIP_SCALE_MIN + lipValue * (mouthOpenScale - ORIGINAL_LIP_SCALE_MIN)
    mouthBone.scaleX = mouthDataScaleX * dynScaleY

    // 6. 齿/舌/口盖附件
    setAttachment('tongue', mouthEntry?.tongueAttachmentName)
    setAttachment('tooth_top', mouthEntry?.upperTeethAttachmentName)
    setAttachment('tooth_bottom', mouthEntry?.lowerTeethAttachmentName)
    setAttachment('mouth_clip', mouthEntry?.openMouthClipAttachmentName)
  } else {
    // 闭嘴: 附件 mouth_default1，bone scale 复位
  }
  origUpdateWT.call(this)
}
```

---

## 四、口腔骨骼模型与绑骨差异

### 4.1 诊断方法

运行时 `setSpineTalking()` 通过 slot-bone 映射判断绑骨类型：

```javascript
const mouthSlot = spine.skeleton.slots.find(s => /^mouth$/i.test(s.data.name))
const mouthSlotBone = mouthSlot.bone?.data?.name || 'mouth'
const isChildRig = mouthSlotBone === 'mouth_close'
```

### 4.2 两种绑骨类型

| 类型 | 检测条件 | mouth slot 绑 | tooth/tongue slot 绑 | 适用角色 |
|------|----------|---------------|----------------------|----------|
| **ADULT rig** | `mouthSlotBone === 'mouth'` | `mouth` 骨 | `tooth_top`/`tooth_bottom` → `tooth` 骨，`tongue` → `tongue` 骨 | 多数主要角色（001tom、004ter 等） |
| **CHILD rig** | `mouthSlotBone === 'mouth_close'` | `mouth_close` 骨 | 同上 | 幼年角色（047shu 等） |

### 4.3 骨骼层级（运行时确认）

通过 Spine 运行时 `bone.parent` 链确认：

```
001tom（ADULT rig）:
  mouth  -> head -> neck -> body -> waist -> hip -> character_X -> chara_MIX -> root
  tooth  -> head -> neck -> ...                                         ← mouth 的平级兄弟
  tongue -> head -> neck -> ...                                         ← mouth 的平级兄弟
  tooth_top -> tooth -> head -> ...                                     ← tooth 的子级

047shu（CHILD rig）:
  mouth_close -> head -> neck -> ...
  tooth  -> head -> neck -> ...
  tongue -> head -> neck -> ...
```

关键结论：在两种 rig 中，`tooth` 和 `tongue` 骨骼都是 `head` 的直接子级，与 `mouth` 骨骼**平级**。

### 4.4 缩放策略

**只缩放 `mouth` 骨骼**，tooth/tongue 不做任何手动缩放：

- ADULT rig：`mouth.scaleX = dataScaleX × dynScaleY`，tooth/tongue 不碰
- CHILD rig：相同策略，tooth/tongue 不碰

**为什么不缩 tooth/tongue？**

1. **它们跟 mouth 是平级**（都在 head 下），不是子级
2. **官方数据** `openMouthScale` 只描述嘴部开合，不影响齿/舌
3. **正常的 047shu（CHILD rig）**本就不缩 tooth/tongue——ADULT rig 也应一致
4. **尝试缩的后果**：tooth 独立横向拉伸，不受 mouth 遮罩控制 → 牙齿/舌头跑出嘴部

---

## 五、常量与参数

| 常量 | 值 | 说明 |
|------|----|------|
| `ORIGINAL_LIP_OPEN_THRESHOLD` | 0.04 | 开合阈值，高于此值闭嘴→张嘴 |
| `ORIGINAL_LIP_SCALE_MIN` | 1.0 | 闭嘴时 mouth bone scaleX（data 值） |
| `FALLBACK_LIP_OPEN_SCALE` | 3.0 | mouth JSON 不存在时的兜底 openScale（仅 104omn/231sub/242sub） |

**`openMouthScale` 来自 mouthsetting JSON**，逐角色逐表情，不依赖全局常量。

---

## 六、修复历程

### Phase 1：全局常量（初始实现）

```javascript
const ORIGINAL_LIP_SCALE_MAX = 2.6
```

- 对 039mcr 嘴偏大（其 face_default openMouthScale = 2.5，但 2.6 已接近上限）
- 对 040ren 正常
- ——用户反馈 039 嘴太大，全局调低——

### Phase 2：全局降低（2026-06-29）

```javascript
const ORIGINAL_LIP_SCALE_MAX = 2.0  // 从 2.6 降低
```

- 039mcr 正常
- 040ren 嘴偏小
- ——用户怀疑逐角色参数存在——

### Phase 3：逐角色逐表情缩放（2026-06-29）

发现 `public/data/idolsetting/mouth/idol_mouth_stg_{idolId}.json`，每个表情含独立 `openMouthScale`。

修改 PixiStageManager.js：
```javascript
const mouthOpenScale = mouthEntry?.openMouthScale ?? FALLBACK_LIP_OPEN_SCALE
const dynScaleY = ORIGINAL_LIP_SCALE_MIN + openRatio * (mouthOpenScale - ORIGINAL_LIP_SCALE_MIN)
```

同时将全局常量改名并设为 3.0（仅作为 3 个无 JSON 角色的兜底）。

### Phase 4：齿/舌双重缩放修复（2026-06-30）

**现象**：001tom、004ter 等 ADULT rig 角色张嘴时牙齿/舌头横向拉伸跑出嘴部遮罩，047shu（CHILD rig）正常。

**错误假设**：tooth/tongue 是 mouth 的子级，层级继承导致双重缩放。

**实际真相**：tooth/tongue 与 mouth 是平级骨骼（都挂在 head 下）。手动缩 tooth 导致它们独立拉伸，不受 mouth 遮罩控制。

**修复**：ADULT rig 的 tooth/tongue 不做任何手动缩放，与 CHILD rig 行为一致。

```javascript
if (isChildRig) {
  // mouth_close 复位
} else {
  // ADULT rig: tooth/tongue 不手动缩放
  // （与 CHILD rig 行为一致——纹丝不动）
}
```

---

## 七、命中统计

### 全量统计（合并文件，2026-06-28）

```text
总语音 step:      26908
命中 lip:         25170
lipSync=false:     1728
未命中:               10

有效命中率: 99.96% (25170 / (26908 - 1728))
```

### 按前缀概览

| 前缀 | 修复方式 | 状态 |
|------|----------|------|
| 1_3 活动剧情 | `event/` 路径规则 | ✅ 近 100% |
| 1_4 主线剧情 | `main/` 路径规则 | ✅ 100% |
| 1_7/1_8 | `main/` 路径规则 | ✅ 100% |
| 3_1 主线 | `main/` 路径规则 | ✅ 近 100%（仅 1 条未命中） |
| 5_xx 季节 | `season/` + 999 shared_base 回退 | ✅ 合并文件 100% |
| 9_2 | `main/` 路径规则 | ✅ 近 100%（仅 1 条未命中） |

### 10 条未命中的具体分布

| 来源 | 数量 | 说明 |
|------|------|------|
| `013kys_302` phone_text scenario | 9 | 特殊 phone 剧情，voice suffix 交叉引用其他角色 cue |
| `1_5_037jir` phone_text 条目 | 1 | 同上 |

**根本原因**：`phone_text` 类型剧情的 `voice_file` 和 `voice_suffix` 对应关系不符合常规模式，adxlip 无法通过常规路径匹配。

---

## 八、控制台日志

```
[LipSync] using original adxlip curve: adxlip/.../xxx.json 115 frames gain=1  ← 正常命中
[LipSync] failed to load original curve: adxlip/.../xxx.json                   ← fetch 失败
[LipSync] lip file not found, skip lip-sync for this voice                     ← path 为空
[PixiStageManager] Lip-sync for "001tom": mouthSlot→mouth ... [ADULT rig]      ← 绑骨诊断
[PixiStageManager] Queued lip-sync for "040ren" until spine load               ← 脊柱未就绪排队
[PixiStageManager] Applied queued lip-sync for "040ren" after spine load       ← 脊柱就绪后应用
```

---

## 九、快速跳转时嘴型不打开

**问题**：快速跳转剧情时语音先开始但角色 Spine 尚未加载 → 不张嘴。

**方案**：`_pendingTalking` 暂存机制
- 语音先开始，Spine 未就绪 → 暂存 pending talking
- Spine 加载完成，语音仍在播放 → 立刻应用 pending lip-sync
- 语音在 Spine 加载前已结束 → 清掉 pending，不再误开口

---

## 十、开发服务器代理

`server.js` 路由 `/assets/lipsync/adxlip/*` → 映射到外部 `lipsyncdata/adxlip/`。环境变量 `SIDEM_LIPSYNC_ROOT` 可覆盖默认路径。
