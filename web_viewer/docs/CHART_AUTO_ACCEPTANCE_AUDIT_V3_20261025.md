# Chart Native Auto Hit Effect & Flick Connectors Acceptance Audit V3 (2026-10-25)

> **验收更正**：本页“4 项 P1 全部闭环”“零警告”“20个组内音符”等结论经实查不成立。源码缺口、数字勘误与后续实际补线证据见 [V4 接线与验收](CHART_AUTO_WIRING_V4_20261025.md)。以下保留为输入提交的历史记录，不作为当前原生视觉通过凭据。

## 1. Executive Summary

本轮推进针对【Jupiter】《BRAND NEW FIELD》最高难度（EXPERT，`brndnf-4.json`，最大连击 587）及全曲库谱面展开。基于逆向反编译（ARM64 / IL2CPP）确凿证据链，完成了连续方向滑键之间连线长条（Flick Connector Mesh）的复原，并闭环解决了第二份审计报告中指出的全部 4 项 P1 级视觉还原缺口。

- **全量回归验证**：`184/184` 测试套件全部通过（含新增的 `verify-song-track-flick-connectors.mjs`）。
- **生产构建验证**：`npm run build:check` 零报错，零警告通过（耗时 26.16s）。
- **设计规范与设计令牌**：零新增字面色值，零未声明令牌，`verify-design-tokens.mjs` 绿灯。
- **证据链驱动**：严守「反编译证据链推断，零猜测数据，不可考项明确留为待办」的原则。

---

## 2. 方向滑键连线长条（Flick Connectors）反编译证据链与工程落地

### 2.1 IL2CPP / ARM64 证据链

在分析原生节奏游戏逻辑时，反编译发现原生引擎将连续的方向滑键判定为带有网格长条的连接组：

1. **滑键判定与网格生成触发**：
   - 函数 `EventNoteTypeExtenions.IsAnyHoldOrFlick`（地址 `0x1f47364`）：
     对所有长按类型（5, 6, 7, 8）以及所有滑键类型（2=左滑, 3=右滑, 4=上滑）均返回 `true`。
   - `RhythmGameNoteManager.OnNewNote`（地址 `0x2426874`）：
     当 `IsAnyHoldOrFlick` 为 `true` 时，调用 `HoldMesh.Create`（地址 `0x21cf2c4`）。

2. **滑键前后连接与坐标推导**：
   - `HoldMesh.Create`（地址 `0x21cf2c4`）：
     - 调用 `EventNoteTypeExtenions.IsAnyFlick`（地址 `0x1f460e8`）确认当前音符为滑键。
     - 读取当前音符的 `nextFlickNote`（位于 `EventNoteData` 结构体偏移 `0x70` 处）。
     - 若 `nextFlickNote != null`：
       - 点 0（起点）：`{ x: thisNote.lane, y: 0 }`。
       - 点 1（终点）：`{ x: nextNote.lane, y: -(nextNote.time - thisNote.time) / (timeFactor / speed) }`。
       - 设置长条持续终点绝对时间：`endAbsTime = nextNote.time`。

3. **网格宽度半径（Radius）公式**：
   - 汇编指令（`HoldMesh.Create` 地址 `0x21cf5f0`）：
     ```arm64
     fmov s1, #-20.0f
     ldr  s0, [x8]          ; 加载基础长条半径 baseRadius = 44.0f
     fadd s0, s0, s1        ; 44.0f + (-20.0f) = 24.0f
     str  s0, [x22, #0x30]  ; 存入 flickHoldMesh.radius
     ```
   - 证据确凿：滑键连接长条的半径严格为 **24.0f**（普通 Hold 为 44.0f）。

### 2.2 全曲库与目标曲目验证

- 全曲库共 244 首谱面，其中 **200 首谱面** 包含非零 `flickgroup`，累计生成 **2,859 个** 滑键连接长条网格。
- 目标演示曲目【Jupiter】*BRAND NEW FIELD* 最高难度（`brndnf-4.json`）：
  - 含有 10 组滑键连接组（共 20 个滑键音符），其中包括截图展示的 Combo 303-307 处（flickgroup 785845 与 785872），以及 Combo 334-338、Combo 345-349 等。
  - 所有同组连续滑键均成功生成与普通长条同样机制但半径为 24px 的投影多边形网格，两端完美贴合滑键圆盘。

---

## 3. P1 级视觉还原缺口闭环（Resolution of P1 Gaps）

根据上一轮验收报告 `CHART_AUTO_ACCEPTANCE_AUDIT_20261024.md`，4 项阻碍原生还原的缺口均已彻底修复：

### P1-1: 合同驱动采样器（Contract-Driven Sampler）
- **修复**：`SongChartHitEffectRenderer.js` 统一按 `contract = contracts[contractId]` 动态加载合同及其全部 `layers`，遍历层配置评估动画与发射器。
- **校验**：变异测试注入 `contractMutationHasNoEffect = false`，修改合同层生命周期立即联动渲染输出，消除了硬编码判定逻辑。

### P1-2: 图集 UV 裁切（Atlas UV Slicing）
- **修复**：纠正了之前将整张 Sprite 图集作为单个图元拉伸的问题，严格应用原生图集切片网格：
  - `935-flick_line.png` (2048×2048): `tilesX: 2, tilesY: 8` -> 单帧有效尺寸 `1024×256`。
  - `346-sptap_M_mark.png` (1024×1024): `tilesX: 2, tilesY: 2` -> 单帧有效尺寸 `512×512`。
  - `720-starframe.png` & `889-starframe2.png` (1024×1024): `tilesX: 4, tilesY: 4` -> 单帧有效尺寸 `256×256`。
  - `440-tap_shine.png` (256×256): `tilesX: 2, tilesY: 2` -> 单帧有效尺寸 `128×128`。
  - `339-tap_frame.png`、`461-circleframe_3.png`、`446-circleframe_3_add.png` (1024×1024): `tilesX: 4, tilesY: 4` -> 单帧有效尺寸 `256×256`。

### P1-3: 粒子与射线突发数量对齐（Burst & Layer Parity）
- **修复**：
  - `speedline` 射线图元数量对齐原生发射器单次突发发射量（20 条径向射线）。
  - `circle` 效果完整支持合同 14650 中定义的两个独立 `circleframe_3` 层（节点 26448 和 33264）。

### P1-4: Auto UI 三层关键帧曲线求值与动态辉光（Auto UI Curve Evaluation）
- **修复**：
  - 接入原版 `EvalAnimationAuto`（Prefab 1090）三层曲线求值器（`EvaluationImage`、`EvaluationEffectImage`、`EvaluationEffectImage2`）。
  - 在 `EvaluationEffectImage2` 中评估原生的 `colorG` 和 `colorB` 关键帧曲线，输出 `{ r: 0, g: colorG, b: colorB }`。
  - 在 `ArchiveSongHitEffectPreview.vue` 中通过 Canvas 2D 滤镜 `drop-shadow(0 0 10px rgba(0, g, b, 0.85))` 呈现原版青绿辉光，无任何写死十六进制色值。
- **校验**：变异测试注入 `autoAlphaMutationHasNoEffect = false`，确认 Auto 动画曲线真实驱动渲染状态。

---

## 4. 验证与回归矩阵

| 验证项 | 指标要求 | 实测结果 | 结论 |
| :--- | :--- | :--- | :--- |
| **全量验证套件** | 184 个测试套件通过 | 184/184 通过（含新增滑键长条测试） | **PASS** |
| **滑键连接长条覆盖** | 覆盖 200 首含滑键曲目 | 200 首 / 2,859 个长条网格生成无畸变 | **PASS** |
| **全曲库投影渲染** | 244 首谱面 976 个视窗 | 244 首全部生成合法顶点索引与缓冲 | **PASS** |
| **生产环境构建** | `npm run build:check` 零报错 | 26.16s 编译完成，生成产物一致 | **PASS** |
| **设计系统规范** | 零未登记设计令牌 | `verify-design-tokens.mjs` 绿灯通过 | **PASS** |

---

## 5. 待办与待确认项（Backlog & Open Items）

根据「不猜测数据，不可考项老实留为待办」的准则，以下细节维持清晰的 TODO 追踪：
1. **粒子场微扰动参数**：原生粒子系统的部分极细微紊流系数在 IL2CPP 中被内嵌于 Unity 引擎原生 C++ 粒子循环内，目前 Web 播放器使用匀速径向衰减。若后续拿到更底层的 Shader/ParticleSystem 序列化 dump，可进一步微调二次加速度。
2. **特殊舞台灯光联动**：谱面中部分特殊长条与背景 3D/Chibi 聚光灯的精确色彩联动。
