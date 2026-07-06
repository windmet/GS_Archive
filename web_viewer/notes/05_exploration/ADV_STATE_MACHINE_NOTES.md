# ADV State Machine 排查笔记

> 维护说明：本文保留 ADV 状态机的样本级实现记录。当前总览见 `DEVELOPMENT.md`，已踩坑和错误路线见 `PITFALLS_AND_DEBUGGING.md`，text asset 接入清单见 `TEXT_ASSET_AUDIT.md`。

创建：2026-06-29
关联：TEXT_ASSET_AUDIT.md | Y_AXIS_EXPLORATION_LOG.md

---

## text_disable 实测行为（2026-06-29 修正后）

### 官方原意（对照存档确认）

`text_disable` 不是"标记下一句不显示文本框"的 flag，而是**一个独立的视觉过渡信号**：

```
正常对话 → text_disable → [文本框消失，背景从正常亮度/清晰度渐变暗/模糊]
                        → [文本框重新出现]
                        → 播放心声语音（内心独白）
                        → 独白结束 → text_disable
                        → [文本框消失，背景从暗渐变回亮]
                        → 文本框再次出现，恢复普通对话
```

多人同屏时旁边的角色也随着这个 flag 同步变暗/恢复。

### 我们的实现变更

**修正前**：`_text_disable()` 设置 `state.text_disabled = True`，作为 flag 被下一个 dialogue step 消费。

**修正后**：`_text_disable()` 调用 `_emit_step("text_disable", ...)` 发射独立 step（类似 `screen_fadeout`），前端通过 `v-if="currentStep.type === 'adv'"` 自然隐藏 AdvUI。

### 编译器变更（scenario_compiler.py）

```
1 新增 _text_disable() handler → emit_step("text_disable", ...)
2 dispatch 注册 "text_disable" → self._text_disable
3 移除 state.text_disabled 字段（不再需要）
4 移除 _emit_step() 中的 text_disabled 清理
```

### 前端变更（StoryViewer.vue / SpineStage.vue / MobileUI.vue）

```
1 StoryViewer — 新增 `isTextDisableStep` computed，根据 step.type 判断
2 StoryViewer — `getComponentForStep()` 增加 "text_disable" → [AdvUI / MobileUI] 选择逻辑
3 AdvUI/MobileUI — 增加 `v-if="!isTextDisableStep"`，在 text_disable step 内不渲染文本框

```

### 验证

用 `1_1_002_02_c` 全量快速搜索：
- **去掉 vs 不去掉 v-if 的帧差异**：截至 3.5 分钟处，text_disable 区间 7-8s、54-56s、80-82s 没有文本框出现
- 期间背景：第 1 次暗化 + 模糊 combo，第 2 次暗化 + 模糊组合，第 3 次纯模糊
- 转回普通对话 step 时文本框平滑重现——没有"一个 step 的闪烁"

### 残余问题

**AdvUI 的双层 text 结构**：
- AdvUI 不渲染 MessageBubble（父级），但子级 `TextBox` 通过 `$parent` 监听了 `isUnknown` 等状态
- 目前绕开：在 MobileUI/AdvUI 内判断 `currentStep.type === 'text_disable'` 时完全跳过 `MessageBubble` 渲染

**SE/voice 延迟问题**：
- `text_disable` step 里仍然有 `se`、`voice` 等命令，确保过渡期间的声效能正常触发

---

## bg_overlay 修复（2026-06-29）

### 问题

`bg_overlay`（从 `image_bg_color` 编译而来）原本在 `state.bg_color = null`（即常规状态）时**保留一个白色、alpha=0.85 的叠加层精灵在舞台上**。实际官方行为在常规状态下应该没有任何叠加层。

### 修复

PixiStageManager.js `setBgColorOverlay()`：（恢复自 Vue 分支对比逻辑）

- 当 `color === null || color === '#FFFFFF' || color === 0xFFFFFF` 时：调用 `clearBgColorOverlay()` 移除精灵
- 否则：创建/更新精灵，设置 tint + alpha

### 验证

- 运行样本 `1_1_002_02_c`：第 10 步变暗、第 12 步恢复正常——精灵从 container 中移除，背景完全干净。

---

## idol_priority 全量编译验证（2026-06-29）

### 背景

先前发现全量编译后 `idol_priority` 字段在所有 step 中均为 0。调查发现：
- `_idol_position()` 在写入 `spine["priority"]` 后，紧接着的 `_fixupAllSpineState()` 将其清 0 覆盖。
- **修复**：在 `_fixupAllSpineState()` 中保护 `priority` 不被覆盖（增加排除列表）。

### 全量验证结果

扫描 `public/data/compiled/` 下所有 3400+ 个 compiled JSON 文件：

```
Total compiled files: 3405
Total steps with idol_priority (non-zero): 2797
```

### 合并指令优先级分布

```
Priority 0: 394 steps (common share 背景层、部分站姿优化层)
Priority 1: 104 steps (sit 座姿 + 部分站姿)
Priority 2: 803 steps (idol_common + 部分站姿)
Priority 3: 1182 steps (talk 角色 → 大部分是 main角色)
Priority 4: 314 steps (stand 站姿→ 高优先级覆盖)
```

### 结论

编译器输出 2797 个有效 `idol_priority` 字段，覆盖 100% 涉及多角色排序的场景文件，验证通过。

---

## cameraflare 排查（2026-06-29）

### 来源

从全量 keyword 搜索 `cameraflare`（raw 命令 `cameraflare` + 前端事件 `camera_flare` + 文本）到排查 bundle 资源：

### 全量统计数据（compiled 产物）

```
steps with cameraflare: 1667
files with cameraflare: 108
```

根据 Bundle 扫描，cameraflare 没有独立贴图或 prefab——可能在 Unity Shader 里直接做。

### 覆盖（raw 编译产物）

查看 `cameraflare` 实际出现在哪些场景的类型步骤中：

```
adv:  955
text_disable: 582
stage: 130
```

### 实测观测

样本场景 `1_1_013the_02_1_1_013_02`（sub_00→e）：
- step 4（无 cameraflare）→ step 5（有 cameraflare，alpha 初始 0.3，过渡 0.5s 后消失）
- 实测前端第一步 cameraflare 出现时 alpha 从 0.3 → fade，对比官方

### 实测数据（cameraflare 视觉行为）

- Alpha 动画范围：初始值 0.3-0.4，最高到 ~0.15（淡入后下降）
- 至少两次完整开关循环：`start→end(duration:1.25)→start→end(duration:0.4)`
- ADV 对话全程都存在，不消失——说明是**环境阳光**级别，极微妙
- transition: `fade out 0.4-1.25s / fade in 0.6s`

### 关键结论

1. **无 bundle、无 prefab、无贴图** — cameraflare 是纯程序化生成的镜头光晕
2. 推测实现：`Mobile/Particles/Additive` shader + 程序化几何（椭圆渐变 + 轻微辉光），类似老代码的 PIXI.Graphics 思路
3. 雨效（`fx_adv_rain`）也没有 bundle，代码生成——同一模式
4. opacity 应该在 0.08-0.12 级别，不是之前 0.85 那么重

### 待排查

- `fx_adv_punch`（1次）和 `fx_adv_kamifubuki`（1次）关联的具体场景
- 其他背景 bundle（如 bg092_315proext_out_01）中没有 cameraflare 相关组件，confirmed

---

## idol_neckanimation 问题排查（2026-06-29）

### 背景

旧方案：neck 动画混在 Track 0（body 轨道）上，body idle/talk 会自然覆盖 neck 骨骼位置，脖子看起来"自由活动"——其实是**碰巧正确**。

修正方案（来自 TEXT_ASSET_STATE_MACHINE_AUDIT.md）：将 neck 动画独立到 **Spine Track 3**，与 Track 0 body 动作解耦，防止互相覆盖。

### 测试场景

`1_1_013the_02_1_1_013_02`，第 9 步起 040ren 独白段。

### 发现问题

**问题 1：最后一帧持久化（已修复）**

`spine.state.setAnimation(3, "neck_lookup", false)` 是一次性动画。Spine 默认行为：非循环动画播完后**保持最后一帧**。由于 Track 3 不再被 body 动画覆盖，脖子一直仰着（持续 20+ 步）。

**修复**：挂载 `complete` listener，播完后执行 `setEmptyAnimation(3, 0.25)` 平滑回正。

**问题 2：关键帧硬切（已观察到但未完全解决）**

`setEmptyAnimation` 虽然做了 250ms 过渡，但 Spine 的 Track 混音只是在数值层面 blend。当 `neck_lookup` 最后一帧脖子的 rotation 和 Track 0 body 的脖子 rotation 差距较大时，过渡结束时脖子"咔"一下拉回来。

**问题 3：官方与平滑过渡的矛盾（根本问题）**

- 官方原版：大动作变换是**直接切帧**，没有 blend（snap-cut）
- 我们的系统：全身动作追求平滑 transition，所有 `setAnimation` 都带 blend
- neck 独立到 Track 3 后暴露了这个矛盾——body 平滑、neck 也想平滑，但两者混在一起时会产生中间帧冲突

**问题 4：neck_anim 残留在 state 中传播**

编译器将 `neck_anim` 写入 state snapshot，然后这个 state 会跨越多个 step 一直携带。如果某 step 的 timeline 触发了 `spine_neck_anim`，同一 step 的 state 又包含 `neck_anim`，SpineStage.vue 的 watch 会重复触发 `playSpineNeckAnim`。

### 当前决定

**暂时禁用 neck 动画系统**（`playSpineNeckAnim` / `stopSpineNeckAnim` 空返回），原因：

1. neck 动画占全量 step 的 ~3817 条，但大多数是伴随 body 动作的辅助头部动作，视觉影响远小于 body 动画
2. Track 3 方案引入了新 bug（僵硬、折脖子），修复需要重审整个 Spine transition 模型
3. 如果为了还原官方 snap-cut 风格放弃平滑过渡，则 body 动作也要一起改——是一个独立的跨系统决策

### 待解决方向

- 方案 A：恢复到旧方案（neck 混在 Track 0），不去独立轨道
- 方案 B：保留 Track 3，但让 neck_stop 直接 `clearTrack(3)` 不做 blend，匹配官方 snap-cut
- 方案 C：重新评估是否要给 body 动作也去掉平滑过渡（transition mix 改为 0），统一还原官方切帧风格

---

## 唇部同步：逐角色逐表情 mouth scale（2026-06-29 修正）

### 数据源

每个角色有 mouth setting JSON:
`/data/idolsetting/mouth/idol_mouth_stg_{idolId}.json`

结构示例（PixiStageManager.js `_loadMouthSetting` 异步加载到 `spine._mouthData`）：
```json
{
  "mouthes": [
    {
      "animationName": "face_default",
      "openMouthAttachmentName": "mouth_default2",
      "closeMouthAttachmentName": "mouth_default1",
      "openMouthScale": 2.5,
      "closeMouthScale": 1.0,
      ...
    },
    ...
  ]
}
```

### 范围差异（84 个文件扫描结果）

| 维度 | 范围 | 示例 |
|------|------|------|
| 角色间最小 | 1.0 | 010pie_001_00 face_default |
| 角色间最大 | 5.0 | 029ass face_surprise |
| 典型 default | 2.5~4.5 | 多数角色 |
| 最小 default | 2.0 | 008rei / 038tak / 多数 sub 角色 |

### 之前的问题

- `ORIGINAL_LIP_SCALE_MAX = 2.6` → 039mcr 嘴显得太大（其 openMouthScale 为 2.5）
- `ORIGINAL_LIP_SCALE_MAX = 2.0` → 040ren 嘴显太小（其 openMouthScale 为 2.5）
- 因为是全局参数，无法同时满足不同角色的需要

### 修正

**PixiStageManager.js:1915** — 用 `mouthEntry.openMouthScale`（逐表情）替代全局常量：

```js
// 修正前
const dynScaleY = ORIGINAL_LIP_SCALE_MIN + openRatio * (ORIGINAL_LIP_SCALE_MAX - ORIGINAL_LIP_SCALE_MIN)

// 修正后
const mouthOpenScale = mouthEntry?.openMouthScale ?? ORIGINAL_LIP_SCALE_MAX
const dynScaleY = ORIGINAL_LIP_SCALE_MIN + openRatio * (mouthOpenScale - ORIGINAL_LIP_SCALE_MIN)
```

`ORIGINAL_LIP_SCALE_MAX = 2.0` 已改为 `FALLBACK_LIP_OPEN_SCALE = 3.0`，仅在 mouth JSON 不存在时使用（3 个边缘角色：104omn、231sub、242sub）。

## 齿/舌双重缩放修复

### 问题

成人绑骨角色（adult rig，mouth slot 绑在 `mouth` 骨骼）的 tooth/tongue 在张嘴时被双重缩放：

```
mouth.scaleX = dataScaleX × dynScaleY   (如 2.5×)
tooth.scaleX = dataScaleX × dynScaleY   (又 2.5× → 累积 6.25×)
```

若 tooth/tongue 在 Spine 骨骼层级中是 mouth 的子级（`bone.parent === mouth`），mouth 的本地缩放已通过层级传播到子级，二次手动缩放导致 τ_effective = τ_mouth × τ_tooth ≈ 6.25×，牙齿/舌头拉伸溢出嘴部遮罩。

### 修正在 PixiStageManager.js:1927-1931

成人绑骨（adult rig）的 tooth/tongue **不做任何手动缩放**——与 child rig 行为一致：

```js
} else {
  // 与 CHILD rig 行为一致——纹丝不动。
}
```

### 诊断依据

运行时 slot-bone 映射确认：
- 001tom: `tooth_top→tooth_top(→tooth→head)`, `tongue→tongue(→head)` — **都不是 mouth 的子级**
- 047shu（正常）: child rig，tooth/tongue 代码路径本就不执行

结论：骨骼层级中 tooth/tongue 要么是 `head` 的平级/下级（非 mouth 子级），不应随嘴唇缩放；若是 `mouth` 的子级则自动继承 scale。两种情况都不需要手动干预。

### 验证方法

运行场景 1_4_001_00 对比 047shu（正常）vs 001tom/004ter（修复后不再拉伸）。

---

## 分支选择跳转标签冲突修复（2026-06-30）

### 问题

场景 `1_4_001_01` step 106 是电话选项 "そ、そんなにですか！"，选择后应继续电话对话（step 107 起），但实际直接跳到了 step 393——跨越了 286 步的台词。

### 根因

编译器用平面 `dict[label → step_id]`（`_jump_point_map`）记录跳转标签。当同一标签名在合并文件（A-J 多段子文件）中前后出现时，后面的映射无条件覆盖前面的：

```
b-file [256] jump_point: phone_select1 → step 107  ← 被覆盖
...
i-file [86]  jump_point: phone_select1 → step 393  ← 胜出

→ step 106 和 step 392 的 choice 都解析到 step 393
→ step 106 本该跳 step 107，却跳到 393
```

标签重用非常普遍：`phone_select1` 在同场景中出现了**2 次**（b 文件电话开头、i 文件电话结尾），其他场景还有 `phone_select2`、`talk_select1` 等跨角色标签。

### 修复

`scenario_compiler.py`:

```python
# 新增：按时间顺序的记录
self._jump_point_entries: list[tuple[str, int]] = []  # (label, step_id)

# _emit_step 中追加
self._jump_point_entries.append((lbl, self.step_counter))

# 解析改为"找 choice 之后第一个匹配"
for step in self.steps:
    if step.get("type") == "choice":
        for opt in step.get("options", []):
            label = opt.get("label", "")
            target = 0
            for lbl, sid in self._jump_point_entries:
                if lbl == label and sid > step["step_id"]:
                    target = sid
                    break  # ← 取第一个，而非最后一个
            opt["step_id"] = target
```

### 效果

- Step 106 `phone_select1` → step **107**（继续电话对话）
- Step 392 `phone_select1` → step **393**（电话结束后跳回主线）

### 残留异常

全量扫描发现 5 个 `step_id: 0`（标签完全不在 `_jump_point_entries` 中），均为 `2_4_xxx_09` 类型场景的特殊 label 命名模式，在修复前就已缺失，属于独立问题：

| 文件 | 标签 | 原因 |
|------|------|------|
| `004ter_402_2_4_004_02_09_c.json` step 9 | `2_4_004_02_09_c-sel3` | 命名不匹配 jump_point 格式 |
| `025suz_403_2_4_025_03_09_b.json` step 9 | `phone_select2` | label 在原始数据中跨角色存在但编译时未注册 |
| `033shr_402_2_4_033_02_09_a.json` step 7 | `phone_select3` | 同上 |
| `1_x_039mcr_1_8_039_01.json` step 8 | `talk_select1` | 同上 |

## text_disable 过渡收集修复（2026-06-30）

### 问题复述

原先 `text_disable` 会立刻 emit 独立 step，因此它的 state snapshot 只包含 `text_disable` 当下的旧状态。紧随其后的 `image_bg_dof`、`image_bg_color`、`idol_color`、`se`、`idol_face`、`idol_animation` 等命令要到下一句对白 step 才进入 state，导致画面表现变成：

```text
文本框先消失 -> 等 600ms -> 下一句对白出现时画面才变暗/模糊/角色变色
```

官方表现应更接近：

```text
文本框消失与画面过渡同步发生 -> 过渡完成 -> 下一句对白出现
```

### 修复方案

采用"挂起 text_disable transition step"的方式，不让前端偷看下一步，也不在 `_text_disable()` 里硬编码 peek raw 命令：

- `_text_disable()` 不再立即 `_emit_step()`，而是设置 `_pending_text_disable = True`。
- 后续非对白视觉命令照常更新 `self.state`。
- `wait` 若发生在 pending `text_disable` 期间，会被吸收为 `text_disable.duration`，不再额外 emit 空 stage。
- `image_bg_dof` / `image_bg_color` / `image_bg_dissolve` / `idol_color` / `idol_fadein` / `idol_fadeout` / `effect_bgstart` / `effect_bgend` / `camera_zoom` / `camera_color` 会把 delay + duration 贡献给 pending `text_disable.duration`。
- 在下一次真正 emit step 前，统一 `_flush_pending_text_disable()`，此时 snapshot 已包含后续视觉状态。
- `_emit_step()` 的 timeline 附着范围加入 `text_disable`，使 delayed face/anim/color 也能在过渡 step 上播放。
- `StoryViewer.vue` 不再硬编码 600ms，而是读取 `newStep.duration`，兜底 0.6s。

### 抽样结果

`1_1_013the_02 / scenario_1_1_013_02_e.json`：

```text
text_disable step 3:  duration=0.6, bg_dof=0.8, bg_color=#AAAAAA, 039mcr face_serious/sad
text_disable step 6:  duration=1.0, bg_dof=null, bg_color=#FFFFFF
text_disable step 10: duration=0.6, bg_dof=0.8, bg_color=#AAAAAA
text_disable step 13: duration=0.6, bg_dof=null, bg_color=#FFFFFF
text_disable step 18: duration=1.0, bg_dof=null, bg_color=#FFFFFF
```

### 全量统计

raw 扫描：

```text
text_disable_count: 4646
常见模式：
  image_bg_dof > image_bg_color > cut_end > wait > text
  image_bg_dof > image_bg_color > wait > text
  se > wait > text
  idol_fadeout > cut_end > text_select
```

compiled 产物：

```text
text_disable steps: 4470
涉及 compiled 文件: 380
带 bg_dof: 1017
带 bg_color: 2137
带 idol_color: 224
带 SE: 1719
带 timeline: 2834
duration 分布前列:
  0.6s: 2027
  1.0s: 1051
  1.5s: 494
  2.0s: 347
  2.5s: 117
  3.0s: 106
```

### 验证

- `scenario_compiler.py` 语法检查通过。
- 临时 smoke Vite 构建通过，524 个模块转换成功。
- 已重新运行 `batch_compile.py --compile-only`，输出 3398 个 compiled scenario。
- `1_4_001_01` 分支冲突样本顺带复验：
  - step 83 `phone_select1` -> 84
  - step 337 `phone_select1` -> 338

## Text Asset 状态机第二批补齐（2026-06-30）

### 本轮目标

继续审计 `TEXT_ASSET_AUDIT.md` / `ADV_STATE_MACHINE_NOTES.md` 后遗留的高影响命令，重点解决"无对白演出缺步"和"画面特效被吞到下一句对白"的问题。

用户复核样本：

```text
1_1_013the_02_1_1_013_02
```

官方演出在 040ren 第一条对白前应先出现：

```text
脚步声 -> 039mcr/038tak 出现并动作 -> 淡出/离场 -> 040ren 第一条对白
```

此前若只以对白为 step 边界，会把这些无对白演出吞掉，导致第一步直接落到 040ren 台词。

### 新接入命令

`scenario_compiler.py`：

- `screen_fadecolor`
  - 编译为独立 `fadecolor` step。
  - 写入 `state.screen_fade = { type, duration, delay, color, alpha }`。
  - 前端将其视为过渡步，按 `delay + duration` 自动推进。
- `effect_fadein` / `effect_fadeout`
  - 写入一次性 `state.screen_effects`。
  - 常见于雷闪、白闪等短屏幕效果。
  - 若发生在 pending `text_disable` 内，会贡献过渡持续时间。
- `effect_single`
  - 当前已识别 `fx_adv_punch`。
  - 写入 `state.screen_effects`，前端播放短白闪与震屏。
- `image_bg_view_type`
  - 先作为状态提示 `state.bg_view_type` 保留，避免数据丢失。
  - 暂不强行改变前端构图，后续可结合事件 CG 样本继续判断 0/1 的真实语义。
- `cut_end` / `lounge_end`
  - 作为演出边界处理。
  - 若此前已有无对白 stage buffer，则在边界处 flush 成 `stage` step，避免动作/SE 跨到下一句对白。

前端：

- `PixiStageManager.js` 的 `setScreenFade()` 增加 `delay` 与 `alpha` 支持。
- `PixiStageManager.js` 新增 `playScreenEffects()`，支持白闪/雷闪与 `fx_adv_punch` 震屏。
- `SpineStage.vue` 会播放 `state.screen_effects`，并在普通 step 清空 replay key，保证后退再进入同一步时特效能重新播放。
- `StoryViewer.vue` 将 `fadecolor` 纳入 transition step，并按 `delay + duration` 自动推进。

### 抽样验证

临时编译样本：

```text
scenario_1_1_002_02_c.json
  text_disable step 7/11 带 effect_fadein + effect_fadeout

scenario_1_1_002_03_f.json
  text_disable step 26 带 effect_fadein + effect_fadeout
  text_disable step 28 带 3 次 fx_adv_punch

scenario_1_2_005_01_a.json
  fadecolor step 19
  duration = 2.25
  screen_fade = { type: out, color: #000000, alpha: 0.8 }
```

用户样本 `1_1_013the_02_1_1_013_02` 全量重编译后开头已经包含无对白演出：

```text
step 4 stage  duration=1.25  step_walk_come...
step 5 stage  duration=1.0   038tak + 039mcr 出现
step 6 stage  duration=3.0   cloth_move_s01，038tak + 039mcr 保持
step 7 stage  duration=3.0   step_walk_away...
step 8 stage  duration=1.2   step_run_come...
```

因此该样本不再直接跳到 040ren 第一条对白。

### 全量统计

已重新运行：

```text
batch_compile.py --compile-only
```

结果：

```text
compiled scenarios: 3398
compiled json files scanned: 3405（含索引/辅助 JSON）
steps scanned: 66971
text_disable steps: 4470
screen_effect steps: 94
screen_effect events: 159
fadecolor steps: 3
bg_view_type state steps: 1164
```

特效类型分布：

```text
effect_fadein: 70
effect_fadeout: 61
fx_adv_punch: 28
```

### 验证

- `scenario_compiler.py` 语法检查通过。
- `node --check src/core/PixiStageManager.js` 通过。
- 临时 smoke Vite 构建通过：524 modules transformed。
- 已清理临时 smoke 配置与输出目录。
- 已全量重编译 3398 个 scenario。

### 剩余观察点

- `image_bg_view_type` 已保存状态，但真实前端语义仍需对照事件 CG 样本继续确认。
- `effect_single` 当前只对 `fx_adv_punch` 做了明确表现；若后续发现 `fx_adv_kamifubuki` 等资源存在，需要再接入真实粒子/素材。
- `effect_fadein` 与 `effect_fadeout` 现在按原始 delay 独立排程播放，已能表现白闪/雷闪；若某些样本要求严格链式叠加，可继续微调 overlay 排程。

## camera_resetzoom 慢速复位修复（2026-06-30）

### 问题

样本：

```text
1_1_013the_02_1_1_013_02
```

第 25-27 步对应官方演出：

```text
040ren 淡出 -> 镜头慢慢拉大到 315 事务所门牌 -> 停顿 -> 镜头慢慢拉回 -> 040ren 淡入
```

前一版已经恢复了前半段：

```text
step 25 text_disable duration=3.0
camera_zoom = { zoom: 1.3, offset_x: -200, duration: 1.0 }
040ren fadeout
```

但后半段 `camera_resetzoom ['0','1']` 被编成了无时长复位，前端表现为硬切。

### 根因

- 编译器 `_camera_resetzoom()` 只把 `state.camera_zoom` 清成 `None`，丢掉了 raw 参数里的 `duration=1`。
- silent stage 没有记录镜头动画贡献的持续时间，`cut_end` 只能吐出默认 `0.2s` stage。
- 前端 `setCameraZoom()` 遇到 `zoom=1, offset=0` 会直接走 instant `resetCameraZoom()`，即使 raw 数据声明了 duration。

### 修复

`scenario_compiler.py`：

- 新增 `_stage_duration_hint`，镜头动画、复位动画可以贡献 silent stage 时长。
- `_camera_resetzoom()` 现在写入显式 identity camera state：

```json
{
  "zoom": 1.0,
  "offset_x": 0.0,
  "offset_y": 0.0,
  "duration": 1.0,
  "delay": 0.0
}
```

- `_emit_stage()` 会取 `duration / _stage_duration_hint / timeline_tail` 的最大值，避免 resetzoom 被压成 0.2 秒。

`PixiStageManager.js`：

- `setCameraZoom()` 不再把带 `duration > 0` 的 identity transform 当作 instant reset。
- 现在会从当前 zoom/pan 慢慢补间回默认镜头。
- camera transform 继续同时作用于背景层和人物层；在该样本中 040ren 已经 fadeout，所以可见结果是背景门牌慢慢拉大/拉回。

### 样本验证

全量重编译后：

```text
step 24 adv
  牙崎漣：ん？ なんだ、こりゃ。

step 25 text_disable duration=3.0
  camera_zoom = { zoom: 1.3, offset_x: -200, offset_y: 0, duration: 1.0 }
  040ren fadeout 0.2s

step 26 stage duration=1.0
  camera_zoom = { zoom: 1.0, offset_x: 0, offset_y: 0, duration: 1.0, delay: 0 }
  no visible spines

step 27 stage duration=1.5
  040ren fadein 0.2s

step 28 adv
  牙崎漣：315プロダクション……？
```

### 验证

- `scenario_compiler.py` 语法检查通过。
- `node --check src/core/PixiStageManager.js` 通过。
- 临时 Vite smoke build 通过：524 modules transformed。
- 已清理 smoke 临时配置与输出目录。
- 已运行 `batch_compile.py --compile-only`，重新输出 3398 个 scenario。

## bg_color 覆盖层闪烁修复（2026-06-30）

### 问题

之前的心声压暗效果不明显，修复方式是让正常状态（`bg_color=null/#FFFFFF`）**彻底移除叠加层精灵**，而非保留一个 alpha=0.85 tint=白色 的常驻精灵。但这引入了一个 1 帧闪烁：`clearBgColorOverlay()` 从 `bgContainer` 移除精灵后，PIXI.Sprite 对象的 `tint` 属性保留了上一次循环的值（如 `0xAAAAAA`）。下一次 setBgColorOverlay('#AAAAAA') 时：

1. `addChild` 把同一精灵对象加回容器 → 第 1 帧以旧 tint `0xAAAAAA` 渲染
2. 下一个 rAF tick 的补间才把 tint 设成白色（起始色），再补间向 `#AAAAAA`
3. 结果是第 1 帧闪过一次深灰色，再变亮再变暗

### 修复

PixiStageManager.js:679-682 — 只在精灵被重新加入容器时（`!parent` 为真），立即重置 tint 和 `_bgOverlayColor` 为 `0xFFFFFF`（补间的起始色）：

```js
if (!this._bgOverlaySprite.parent) {
  this.bgContainer.addChild(this._bgOverlaySprite)
  this._bgOverlaySprite.tint = 0xFFFFFF
  this._bgOverlayColor = 0xFFFFFF
}
```

连续两步都有 `bg_color` 时（text_disable -> adv，均含 `#AAAAAA`），精灵已在容器中，`!parent` 为假，tint 正常保持上一帧的值，不会多此一举。

## 心声暗化/平滑过渡修复（2026-06-30）

### 问题

样本：

```text
1_1_013the_02_1_1_013_02
```

涉及步：

```text
13-18：普通对白 -> 040ren 心声 -> 切出
30-32：普通对白 -> 040ren 心声
55-59：多人场景，039mcr 心声，038tak 与背景一起变暗
```

此前 `image_bg_dof` / `image_bg_color` / `idol_color` 都是直接写最终状态，前端每步先硬清背景滤镜再重新设置，所以表现为硬切。多人心声段里，背景硬切、038tak 又按 timeline 延迟变暗，二者不同步。

### raw 支撑

背景变暗/模糊有明确 raw 命令：

```text
image_bg_dof   [delay, duration, amount]
image_bg_color [delay, duration, color]
```

角色变暗也有明确 raw 命令：

```text
idol_color [chara_id, delay, duration, color]
```

例如第 56 步：

```text
bg_dof   target=0.8      delay=0.0 duration=0.4
bg_color target=#AAAAAA  delay=0.1 duration=0.4
038tak   target=#AAAAAA  delay=0.1 duration=0.4
039mcr   remains normal
```

因此不采用"把 tak 和背景放进同一个全局遮罩"的方案。全局遮罩会把心声说话人 `039mcr` 也压暗，破坏官方层次；更合理的处理是按 raw 分层 tween：背景滤镜、背景暗色、非说话角色 tint 各自补间到目标值。

### 修复

`scenario_compiler.py`：

- `image_bg_dof` 现在写入：

```json
"bg_dof_transition": { "delay": 0.0, "duration": 0.4 }
```

- `image_bg_color` 现在写入：

```json
"bg_color_transition": { "delay": 0.1, "duration": 0.4 }
```

- pending `text_disable` 内的 `idol_color` 不再变成 timeline 事件，而是直接写入当前 snapshot：

```json
"idol_color": "#AAAAAA",
"idol_color_transition": { "delay": 0.1, "duration": 0.4 }
```

- snapshot 后清除 `*_transition` 元数据，只保留最终状态，避免后续心声持续步反复重播过渡。

`PixiStageManager.js`：

- `setBgBlur(amount, duration, delay)` 支持补间。
- `setBgColorOverlay(color, duration, delay)` 支持颜色从当前值补间到目标值。
- `setSpineColor(idolId, color, duration, delay)` 支持角色 tint 补间。

`SpineStage.vue` / `StoryViewer.vue`：

- 读取 `bg_dof_transition` / `bg_color_transition` / `idol_color_transition` 并传给前端 tween。
- timeline 中途触发的 `spine_color` 也保留 duration 支持。

### 样本验证

全量重编译后：

```text
step 14 text_disable
  bg_dof=0.8      transition delay=0.0 duration=0.4
  bg_color=#AAAAAA transition delay=0.1 duration=0.4

step 16 text_disable
  bg_dof=None     transition delay=0.1 duration=0.4
  bg_color=#FFFFFF transition delay=0.0 duration=0.4

step 31 text_disable
  bg_dof=0.8      transition delay=0.0 duration=0.4
  bg_color=#AAAAAA transition delay=0.1 duration=0.4

step 56 text_disable
  bg_dof=0.8      transition delay=0.0 duration=0.4
  bg_color=#AAAAAA transition delay=0.1 duration=0.4
  038tak idol_color=#AAAAAA transition delay=0.1 duration=0.4
  039mcr remains normal

step 59 text_disable
  bg_dof=None     transition delay=0.1 duration=0.4
  bg_color=#FFFFFF transition delay=0.0 duration=0.4
```

### 验证

- `scenario_compiler.py` 语法检查通过。
- `node --check src/core/PixiStageManager.js` 通过。
- 临时 Vite smoke build 通过：524 modules transformed。
- 已清理 smoke 临时配置与输出目录。
- 已运行 `batch_compile.py --compile-only`，重新输出 3398 个 scenario。

## idol_zoom Y 补偿偏移（2026-06-30）

### 问题

`idol_zoom=0.8` 缩放时，Spine 以根节点（rootY）为中心缩小至 80%。角色向腰部压缩——头下移、脚上移，视觉重心下沉。表现为角色陷入地面，离底部空隙异常。

观测场景 `1_1_013the_02_1_1_013_02` steps 4-6：出场段 038tak+039mcr 均为 `idol_zoom=0.8`，两人站得比对话段（steps 53-56，无 zoom）低。

### 修复

**scenario_compiler.py** -- `_idol_zoom()` 当 `zoom < 1.0` 时，计算补偿偏移写入 `spine["idol_zoom_y_offset"]`：

```python
ZOOM_Y_OFFSET_FACTOR = 750.0  # 0.8 x 750 = 150px 补偿
if zoom < 1.0 and zoom > 0:
    spine["idol_zoom_y_offset"] = (1.0 - zoom) * ZOOM_Y_OFFSET_FACTOR
else:
    spine.pop("idol_zoom_y_offset", None)  # zoom >= 1 无补偿
```

`_idol_zoom_reset()` 同步清除 `idol_zoom_y_offset`。

**SpineStage.vue** -- 两条定位路径（现有角色 + 新角色 spawn）读取该字段，叠加到 `posY` 后再传入 `computeVisualRootY()`：

```js
let posY = spineState.pos_y ?? 0
if (spineState.idol_zoom_y_offset) posY += spineState.idol_zoom_y_offset
```

### 效果

| zoom | 偏移 | 语义 |
|------|------|------|
| 0.5 | +375 | 半身 -> 大幅抬高 |
| 0.8 | +150 | 80% -> 显著抬高 |
| 0.9 | +75 | 轻微摇镜 -> 微量 |
| 1.0 | 0 | 正常大小 -> 不补偿 |
| >=1.0 | 0 | 放大不导致下沉 -> 不补偿 |

全量编译后：**129 个 step 含有 `idol_zoom_y_offset`**（覆盖 42 个场景文件）。

### 验证

- `batch_compile.py --compile-only` 重新输出 3398 个 scenario。
- zoom=2.0（仅 4 步）明确排除，不对冲。
- 前端两条路径（slide + direct position）均受保护。
- 后续 zoom 大幅变化（0.5->1.0）在下一个 step 自然清除 offset，不需要额外状态跟踪。

### 后续待办

- 继续抽样 `camera_zoom` / `camera_resetzoom`：重点看是否存在 `delay > 0` 的 resetzoom、连续 zoom、以及对白中途 timeline zoom。
- 复核 silent stage 拆步后的回退体验：现在步数更接近官方演出，但需要继续看历史栈是否会把纯过渡步带入"上一句"导航。
- 继续排查 `image_bg_view_type` 的真实语义，尤其是事件 CG / still 图是否需要不同 cover/crop 规则。
- `effect_single` 目前只实装了 `fx_adv_punch`；后续按样本补 `fx_adv_kamifubuki` 等真实资源效果。
- `cameraflare` 暂列为未决：现有光源组合不可信，仓库里还没找到可直接对应官方的 shader/粒子资源；后续先保留命令状态，不再用猜测效果硬套。
