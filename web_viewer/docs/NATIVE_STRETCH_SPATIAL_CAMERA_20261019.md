# Stretch 三维输入与实际舞台相机绑定

输入 HEAD `323a5c57`，舞台工作树 `stage-native-fidelity-20261014`。本批扩展原生重放和来源证据，未开放七个非平面系统，也未改变应用画面。

## 相机矩阵输入纠正

`libunity.so` SHA 仍为 `acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0`。

- `0x6c5c44` 调用 `0x5e5440(camera)`，随后 `0x6c5c48` 将返回地址放入 X2，再于 `0x6c5c54` 调用 `0x603d8c`。
- `0x603d8c` 自己也调用同一个 getter，将矩阵复制至 cameraInfo+0x44；第三个参数的矩阵复制至 cameraInfo+4。因此这条实际调用路径的两个矩阵相同。
- 早期 packedContext 合成测试在 +4 与 +0x44 填了互逆矩阵；文档把其中一个直接称作 cameraToWorld，超出了当时的证据。保留旧输入作为合成测试，新增 `sameViewMatrices` 输入覆盖实际调用关系。不能把任意合成矩阵配对当作完整 Camera 状态。
- getter `0x5e5440` 在对应标志开启时，先生成 (1,1,-1) 的轴矩阵，再与 Transform 取得的矩阵组合。最终符号、完整父链和运行时更新仍须一起跟踪，不能只取一个默认 z=-10。

三个原生窗口的地址、指令 bytes、哈希进入 Stretch fixture；完整 ELF 哈希与无写入重放共同约束来源。

## 三维顶点证据

重放允许输入 position.xyz 与独立深度变换，新增四类：XYZ 速度、非均匀缩放及 Z 平移、相机 Z 旋转、纯 Z 速度。与历史案例组合后共 92 组顶点/UV，其中 38 组使用相同相机矩阵，16 组三维案例；两条真实 solver 均执行。

在本批给定的合成轴向相机中，证据支持：

- 尾迹反向长度使用完整 XYZ 速度平方，经原生 FRSQRTE 和修正系数；不能丢掉 Z 后再归一化。
- 侧边 XY 方向使用相对相机位置与速度的叉积，再归一化和独立应用 XY 粒子尺寸缩放。
- 例如 p=(2,3,1)、v=(3,4,2)、相机输入 Z 平移 -10，侧边约 (0.804574,-0.593852)。纯 Z 速度仍能得到非零侧边，虽然其尾迹在 XY 投影中重合。
- 两条 solver 在相机旋转的三维案例中最大位置差为 2.384185791015625e-7。fixture 保留两份原始结果；仅三维案例允许 1e-6 的变体互检，原有平面案例仍要求两 solver 完全相等。UV 始终精确一致。

JS 验证器单独检查这些三维证据，不将其交给只接受平面的运行时函数。原有及新增相同矩阵的平面案例仍与实际平面消费者对照通过。

## 从 LiveStage 引用找到真实相机

重新读取 APK unity data，SHA `d35231c0b00a09f6941f47f7ffedde9e9b35701f5b66d6f432517da860e1a500`：

`resources.assets:114160 LiveStage` raw+136 → `111805 LiveObjectCamera` raw+32 → `45565 Camera`。

该 Camera 为 orthographic，序列化 size=5。Transform 父链 `40921 → 39065 → 38270` 的初始局部 Z 分别为 0、1、1，旋转单位、缩放为 1。这里的初始世界 Z 合计为 2。引用、对象哈希及完整初始 Transform 链已进入 fixture，生成器直接从 APK 复核，未凭 StageCamera 名字选择。

**这不是最终舞台深度常量。** LiveObjectContainer 实例化后的父链、相机命令的 DOLocalMove、场景加载/重置仍须串联；不能只拿角色 Base 初始 Z=10 与相机初始 Z=2 相减就宣称全部渲染深度已解。

## 检查和继续范围

- fixture `--write` 后不带 `--write` 原生重放通过：92 组顶点/UV、8 个 RAW renderer、APK 相机引用、原有 Noise/重力/缩放证明。
- `node scripts/verify-chibi-object-emitters.mjs --published-assets` 通过：78 资源 /709 系统 /28 preview /0 deferred；含新增三维证据检查和相同矩阵的平面回归。
- 源码门禁 147/147 通过，日志 `.analysis/stretch-spatial-source-batch.log`；`git diff --check` 通过。
- 仅工具、fixture、验证器和记录变化；没有运行时/公开素材变化，不重复应用构建和 Browser。既有 5212 验收不能当成本批新的画面证据。

下一步继续 Camera/Container 实际生命周期、对象粒子 Z 位置和速度消费，再接三维四角。ROUTE77 五个 Cone Stretch、trhorz 两个球体 Stretch 仍省略；全库 33 无消费者资源、Whole_screen 和其它独立指令缺口继续保留，未部署、未合并主线。
