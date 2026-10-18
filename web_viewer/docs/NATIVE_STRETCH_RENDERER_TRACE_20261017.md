# Stretched Billboard：renderer 结构偏移反查记录

输入 HEAD `1f63a2eb`；libunity 工程 `E:\Tools\ghidra_work\stage-unity-particles-20261015\project\unity-particles`；工作树 `stage-native-fidelity-20261014`。

## 一、已确认的结构偏移

从序列化函数 `FUN_006c87ac`（Ghidra VA，对应 ELF RVA `0x5c87ac`）反编译得到 `ParticleSystemRenderer` 字段写入位置：

| 字段 | renderer 偏移 | 反编译证据 |
| --- | --- | --- |
| m_RenderMode | +0x1c8（16 位） | `FUN_004a7114(...,param_1+0x1c8,0)` |
| m_SortMode | +0x1ca | 同上 |
| m_MinParticleSize | +0x1cc | 4 字节 |
| m_MaxParticleSize | +0x1d0 | 4 字节 |
| **m_CameraVelocityScale** | **+0x1d4** | 引用字符串 `m_CameraVelocityScale`（`.rodata` RVA `0xddc9de`） |
| **m_VelocityScale** | **+0x1d8** | 引用 `m_VelocityScale`（`0xddc9f4`） |
| **m_LengthScale** | **+0x1dc** | 引用 `m_LengthScale`（`0xddca04`） |
| m_SortingFudge | +0x1e0 | |
| m_NormalDirection | +0x1e4 | |
| m_ShadowBias | +0x1e8 | |
| m_RenderAlignment | +0x1ec | 带 0x800000 标记 |
| m_Pivot | +0x1f0 | |

这些偏移已经可以和 RAW 的 `renderer` 字段一一对应（我们的提取器目前只存了 renderMode/alignment/pivot/material）。

## 二、顶点求解器的追踪状态

- 排除栈帧基址（sp/fp）后，扫描同时读取 `+0x1d4/+0x1d8/+0x1dc` 的代码，未出现三字段同簇的清晰候选。
- 候选函数 `FUN_005a79e8`（Ghidra VA，8836 字节，`sub sp,sp,#0x1780`）内部出现 `sp+0x1d4/0x1d8/0x1dc` 的栈槽；怀疑它先把 renderer 设置拷到栈帧同一偏移，再做顶点生成，但尚未证明。
- 结论：**顶点公式仍未取得**；stretch 的 8 个系统继续保持 `stretch_omitted`，没有用速度猜测冒充。

## 三、下一步

2026-10-18 复查：旧 `find-stretch-loads*.py` 仅匹配 `LDR W` 的 `0xB9400000`，没有匹配 `LDR S` 的 `0xBD400000`，因此“不存在同簇”不能排除浮点读取。新扫描找到 91 个非 SP/FP 的标量浮点候选；其中 `0xb054b0`、`0xb08f80`、`0xb09aa4` 等已反编译，属于其它处理路径，不能因偏移相同便认作粒子 renderer。完整结果位于 `.analysis/native-engine/stretch-float-readers.c`。`0x5a79e8` 仍未证明；后续还须扫描 SIMD/pair load 或参数块拷贝，stretch 标记继续保留。

1. 在 `FUN_005a79e8` 内定位对 `sp+0x1d8`（velocityScale）的读取，向上追到参数来源，确认是否来自 renderer 拷贝。
2. 若确认，提取同一段中的 velocity 向量、length 计算与四个顶点写入，按 2D 投影实现。
3. 在此之前不修改数据语义；`stretch_omitted` 仍是显式边界。

## 四、当前目录状态

- 44 资源 / 394 系统 / 0 deferred / 28 preview（20 noise_preview + 8 stretch_omitted）/ 33 纹理。
- 本轮没有源码或数据改动，仅记录反查结果。
