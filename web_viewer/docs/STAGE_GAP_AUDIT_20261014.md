# 舞台小人：缺口与未确认项（2026-10-14，合并后审计）

输入：master 合并点之前的整合分支。包含 codex 舞台线 15 个提交（`5d73443c`…`b32d152b`）和 10-13 的 [接线审计](NATIVE_CHIBI_WIRING_AUDIT_20261013.md)。本文只对照源码、文档和消费者，没有改舞台代码，也没有做原片对照。

合并后跑了 24 个舞台 verifier（`verify-chibi-*`、`verify-stage-*`、`verify-live-chibi-*`），全部通过。它们证明的是源码和数据链路，**不是**原版视觉验收。

## 一、10-13 审计的六个 P1，现在的状态

| 项 | 状态 | 剩余 |
|---|---|---|
| 站位 value4 = 排序 | 已改（`5d73443c`）| 118 份编排仍用旧字段名 `scale`，消费者当作 `sortingOrder` 的别名读取；导出器改了，但全量没有重导 |
| 动作模式 2/3 | 已改，并纠正过一次（FLASH LIGHT 主动作被跳过）| 见第三节「动作」 |
| 脚光 Foot_Color | 已接入（`7fe927f5`）| Unity mesh 单位换算只在五种 body type 上核过 |
| 新悬灯 NormalShow / 控制 | 已接入 rotate/scale/fade（6,340 行）| 色相/HSV 循环 2,350 行和 BeatShow 331 行还没接，遇到这些命令的灯整盏不显示 |
| 背屏 value7/8/9 | 排序、alpha 已接 | Logo 素材选择在覆盖统计里仍是 `unimplemented_runtime_sprite_selection_pending`；Passion Logo override 和 syksai 第四层模板还没做 |
| 身体染色 | 改为原版 RGBA 替色（`c1c51c79`）| — |

## 二、完全没有消费者的指令（不是近似，是没接）

1. **Penlight 全家族**：6,697 行，118 份编排都有。`public/assets/live-chibi/penlight` 已导出，Viewer 和 `stageVfxCoverage` 都没有消费者。pass3 有 `LiveObjectPenlight` 方法体。
2. **Searchlight**：10,583 行，23 份编排。没有消费者。
3. **Underlight / Smoke**：Drive 一首就有 Underlight 19 行。没有消费者，也没有全量统计。
4. **固定嘴型、单人脚光、动作 Offset**（`Livechara_mouth_shape_fix` / `foot_color_solo` / `Livechara_Offset`）：反编译有，导出器没有对应分支，也没有 RAW 行数统计。Offset 是时间条件，不是空间偏移。

这些指令没导出，覆盖面板也就不显示它们是缺口。第五节第 1 条是同一个问题。

## 三、已接但仍是近似或受限的部分

- **旧悬灯白名单**：`prepare-live-chibi-stage-effects.py` 的 `previewEnabled` 只放行 Moon、Growing Smile、Drive 三首。共有 105 份编排带旧悬灯，这三首以外的都不显示（Drive 一首就有 20 份编排）。执行通道已换成原版语义，但白名单没动。
- **动作**：
  - 原版正常路径有 Unity Random 小延迟，Web 是确定性时间轴。
  - 原版 baseTimeScale 读 `noteManager.curTempo` 再乘 CSV speed，Web 只用 CSV speed。变速曲目会偏。
  - Web 默认 mix 0.12 s，不是从原版 SkeletonDataAsset 读来的。
- **镜头**：灯和人物已共享原版镜头（`307355dd`、`fd19eeba`）。背景、粒子和其他灯具是否都走同一镜头、同一尺度，文档没有逐层确认。10-14 光投影批次写的是「其他层仍用旧参考镜头」，后续 shared camera 批次只说了人物。
- **粒子**：
  - ObjectLayer 生命周期：原版 Play 直接开始；Erase 先 StopEmitting，延迟后 SetActive(false)。Web 是父容器淡入淡出。
  - 未蒙版 UV 粒子的 alpha、其他特效材质、mip 层数据都没核过。
- **后处理**：StageCamera 是 HDR=true，Stage volume 带 DepthOfField。HDR 中间缓冲、景深、透明目标的 alpha 累积都没有复原。只验证过不透明背景上的 GPU 输出。
- **背屏几何**：RectTransform 和视频有效画面的几何还没核。

## 四、没有确认过的东西（需要你在那边决定怎么验）

1. **原片对时**：没有一首做过全曲逐帧对照。你说的「说不清的灯光差异」还挂在待办里。
2. **性能**：这一批加了逐渲染器排序、粒子材质蒙版、逐部件染色/脚光，绘制数量和帧耗都没测。手机实机也没测。
3. **测试站上的首次表现**：本次部署是这些舞台改动第一次上测试站，132 个 live-chibi 新素材随 R2 批次上传。线上舞台没有跑过 Browser 旅程，需要实际打开看。
4. **导出器和 public 语料不同步**：多批记录写着「修正未来导出器，现有 sidecar 直接消费」。Python 导出器只做过 AST 检查，没有全量重导，所以重导后会不会和现在的消费者兼容，没有验证。
5. **verifier 用的数据**：多数用 `--published-assets` 读本地 public 语料。线上 R2 的版本和本地一致，是靠这次上传清单的 hash 保证的，没有单独回读核对。

## 五、建议的下一步顺序（stage 线）

1. 先建 10-13 审计就提过的矩阵：原始指令 → 命名字段 → 导出事件 → runtime 消费者 → 资源绑定 → 验证方式，并让缺消费者的指令在覆盖面板里显式报出。这样第二节的缺口才能被看到，不会继续漏。
2. Penlight（资源已在、影响 118 份编排）→ 新悬灯色相/BeatShow（解除整盏不显示）→ 旧悬灯白名单逐首放开。
3. tempo 基准（变速曲目）和粒子生命周期。
4. 选两三首有原片的歌做对时验收，再处理 HDR/景深。
