# 粒子层级缩放与 Stretch 顶点入口反查

输入 HEAD `0ac50593`，工作树 `stage-native-fidelity-20261014`。沿用 [模拟空间取证](NATIVE_PARTICLE_SIMULATION_SPACE_20261018.md) 的同一 libunity SHA 和 `0x100000` Ghidra base，以下地址均为 VA。本批保持应用代码与素材不变。

## 已取得的来源链

1. `0x6cf028` 从主模块 `+0x48` 读取 scalingMode，并从 Transform hierarchy 的 TRS/parent 索引生成状态矩阵。状态 `+0x3c` 为主矩阵，`+0xcc` 为对应逆矩阵，`+0x148` 与 `+0x154` 保存不同的缩放向量。模式0、1、2不是同一末端倍率。
2. `0x6cfd84` 被模式0等路径用于构建粒子缩放。旋转叠加非均匀父缩放后，它的结果不等于主矩阵的列长；负缩放还会保留符号。
3. renderer 参数准备 `0x6c505c` 将状态 `+0x154` 复制到绘制上下文 `+0x120`。这证实缩放有独立的 renderer 输入，但还不能用中间向量代替完整顶点输出。
4. 同一函数把 renderer 的 cameraVelocityScale `+0x1d4`、velocityScale `+0x1d8`、lengthScale `+0x1dc` 复制到紧凑参数块 `+0x0c/+0x10/+0x14`。此前只追原字段偏移没有抵达这个转换边界。
5. 绘制入口 `0x809088` 从 `context+0x450` 取得该参数块；renderMode=1 两条分支分别调用 **`0x80b8a4` / `0x817658`**。两者均读取紧凑块的速度/长度倍率，已取得反编译及指令。原先未证明的 `0x5a79e8` 不再作为唯一候选；尚不据此宣称 Stretch 顶点已复原。

取证文件：`.analysis/native-engine/scaling-runtime.c`、`lossy-scale-native.c`、`renderer-pack-callers.c`、`particle-vertex-dispatch.c`、`stretch-native-vertices.c`。这些小型分析输出不进入发布素材。

## 18组真实指令重放

[重放工具](../scripts/prepare-chibi-noise-kernel-fixture.py) 新增 scalingProof，直接执行 `0x6cf028` 及其被调用的缩放/矩阵函数，不替换计算函数。六组 Transform hierarchy × 三种 scalingMode，覆盖非均匀缩放、45度旋转、两层旋转/父缩放、负缩放、负父缩放及Y轴180度镜像。输出保存到 [原生 fixture](../scripts/fixtures/chibi-noise-kernel-native.json)，合成输入与执行边界也在 fixture 中。

两层样例：child 45度、scale(2,3)，parent 30度、scale(4,5)，mode0：

- 主矩阵二维线性部分约 `[1.363446,-12.651770;8.952151,4.942946]`，Web emitterMatrix 与原生误差小于2e-5。
- 原生独立粒子缩放约 `(9,13.5)`；直接取矩阵列长约 `(9.055385,13.583078)`，两者存在差异。
- 将 parent X scale 改为-4后，原生粒子缩放约 `(-9,13.5)`。单层负X scale也输出负值。
- mode1 只保留自身尺寸缩放，mode2把尺寸缩放设为1并另存形状缩放；完整矩阵与向量以fixture为准，未开放这些模式。

当前709系统只接受mode0。对当前 View billboard、非rotation3D路径按这个平面缩放差异筛查，**没有发现超过1e-4的现用系统**；不能把合成边界写成已经复现用户截图中的尺寸错误，也不能因此推广完整等价结论。当前不会仅为让合成例子通过而替换最终渲染公式；应先在已找到的顶点路径完成尺寸/符号消费重放。

## 验证与下一步

- 原生fixture --write后无--write重放一致：原有所有样例加18组缩放案例。
- 对象消费者 published-assets 回归通过；新增mode0的完整层级矩阵与原生对照。目录仍78资源 /709系统 /28 preview /0 deferred。
- 本批只有分析工具、fixture、验证器和记录，没有运行时视觉改动，不重复Vite编译和Browser验收；未部署。
- 下一步围绕 `0x80b8a4` / `0x817658` 构造最小原生顶点重放，分离相机速度、粒子速度、长度、尺寸与pivot的贡献，再实现Stretch通用消费者。最终顶点公式、动态变换、帧批次、Whole_screen及剩余消费者缺口继续保留。
- 源码门禁147/147通过，日志 .analysis/particle-scale-source-batch.log。
