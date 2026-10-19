# 对象粒子 3D 旋转、重力与 leaf 收口

输入 HEAD `7b563fb9`；工作树 `stage-native-fidelity-20261014`；9334 端口无 BFCache 的无头 Edge 验收。

## 一、leaf 剩下的三个阻塞

`fx_in_swyrlv_leaf` 两个系统（`fx_in_ksktfg_sakura`、`glitter`）此前逐个卡在：

1. `InitialModule.rotation3D=true`：原版允许三轴起始旋转；
2. `RotationModule.separateAxes=true`：X/Y/Z 三轴角速度分别积分；
3. `gravityModifier=0.05`：世界重力；
   另外 sakura 的 `startColor.minMaxState=2`（双色随机），也不在旧剖面里。

## 二、实现

- **3D 旋转**：按 Unity Euler 顺序 Z→X→Y 组矩阵，把局部 X/Y 轴投影到屏幕平面，得到 billboard 的 2D 基底（`a/b/c/d`），不再只取 Z 轴滚转。
- **分轴角速度**：`RotationModule.x`、`.y`、`.curve` 分别按粒子寿命积分（与已有 60 Hz 边界一致），叠加到起始 X/Y/Z 角。
- **重力**：发射器矩阵变换后按 `0.5·g·age²` 加到世界 Y，`g = -9.81 × gravityModifier`；屏幕 Y 取反。
- **双色起始色**：`minMaxState=2` 时按逐粒子随机因子在 `minColor..maxColor` 之间取色。

## 三、目录结果

- **44 个资源 / 394 个已消费系统 / 0 deferred / 28 个 partial / 33 张原图**。
- 所有被编排引用的对象层 particle 资源现在都有消费者；28 个 partial（20 noise + 8 stretch）仍是“省略位移/拉伸”的显式边界，不计为原生完成。
- `fx_in_swyrlv_leaf`：2 个系统全部进入，deferred 清零。

## 四、验证

- `prepare --mode current --consume-deferred --report`：44 / 394 / 0 / 33。
- `verify-chibi-object-emitters.mjs`（两种模式）：通过；新增 leaf 0 deferred / 2 系统 / 含 3D+gravity 断言。
- `npm run build:check` 13.99 s；`node scripts/run-verifier-batch.mjs` 147/147。
- Browser ROUTE77 37.5s：4 个对象层（meter、turbo_1/2、leaf）可见，85 个对象粒子，`deferred` 为 0，`unsupported` 为空。

## 五、剩余边界

- 28 个 partial 系统仍省略 Noise 位移与 Stretched Billboard；视觉上是“有火星/叶片、无扰动与拖尾”。
- Noise worker 已反编译到驱动、500 段调度器和 5KB SIMD 本体；Stretched Billboard 的顶点求解器尚未定位。
- 随机种子仍是 Web 确定性种子；本批不宣称逐像素等价。
