# 对象粒子 Shape 扩展与 ROUTE77 partial 消费

后续校正：本页是旧参考实现记录。球体厚度判定、半球轴向、锥形/圆形初速方向与 Arc 已由本地 libunity 反查修正，当前公式与证据见 [Shape 原生反查](NATIVE_PARTICLE_SHAPE_SOLVER_20261018.md)。下文旧算法不可作为当前语义依据。

输入 HEAD `68ff17a4`；工作树 `stage-native-fidelity-20261014`；9334 端口无 BFCache 的无头 Edge 验收。

## 一、Shape 采样扩展

对象发射器原先只接受 box(5) 与 edge(12)。ROUTE77 的火焰/尾焰大量使用 **cone(4)**，另有 sphere(0)/hemisphere(2)/circle(10)。现按 RAW `ShapeModule` 字段接线：

| type | 语义 | 采样 |
| --- | --- | --- |
| 0 Sphere | 球 | 均匀方向；`radiusThickness≥1` 取表面，否则 `cbrt(u)` 体积；乘 `m_Scale` |
| 2 Hemisphere | 半球 | 同上，Y 取绝对值 |
| 4 Cone | 锥 | 底面圆盘 `radius·sqrt(u)`，YZ 面 |
| 5 Box | 盒 | 现有均匀盒采样 |
| 10 Circle | 圆 | 圆盘 `radius·sqrt(u)`，XY 面 |
| 12 Edge | 单边 | 现有 ±radius 边 |

方向仍取本地 +Z（经 `m_Rotation` 旋转）。cone 的 `radius` 在 ROUTE77 为 0.05，半径/方向展角对视觉影响有限；该点作为 partial 边界记录，不宣称锥体方向逐粒子等价。

## 二、显式 partial 消费

新增 opt-in `--consume-deferred`：仍保留 Noise/Stretched Billboard 的系统不再整系统丢弃，而是进入目录并写入 `partial` 标记：

- `noise_omitted`（18 个系统）：发射、尺寸、颜色、UV、生命周期按 RAW 消费，Noise 位移省略。
- `stretch_omitted`（7 个系统）：billboard 渲染，速度拉伸省略。

目录从 44/365/29 变为 **44 个资源 / 391 个系统 / 3 个 deferred / 30 张原图**；25 个系统带 partial 标记。未标记的 366 个系统仍是完整消费。

这不是把 deferred 改写成完成：数据里 `partial` 字段保留，验证器断言 25 条 partial，文档与覆盖面板都按 partial 记录。

## 三、ROUTE77 结果

49s 现场（9334、完整加载）：

- 对象粒子 **14 → 160**；6 个对象层全部可见（fire_1/2/3、meter、turbo_1/2）；`unsupported` 为空。
- 火焰区在画面右侧实际出现（此前只有背景渐变）。
- 仍剩 2 个 deferred：`fx_in_swyrlv_leaf` 的 3D rotation 与 gravity，两个系统整层不可见——这是下一批的第一项。

## 四、验证

- `prepare --mode current --consume-deferred --report`：44 / 391 / 3 / 30；逐资产复核 fire_1/2/3、turbo_1/2 各 6 系统全部进入。
- `verify-chibi-object-emitters.mjs`（两种模式）：通过；新增 partial 计数（25 / 18 / 7）、star_1 的 4 系统与 2 个 stretch partial 断言。
- `npm run build:check` 与 `node scripts/run-verifier-batch.mjs`：见提交说明。
- Browser ROUTE77 49s：160 粒子、0 unsupported、0 console error。

## 五、边界与下一步

- Noise 位移与 Stretched Billboard 仍是省略状态；`partial` 系统不计为原生完成。
- `fx_in_swyrlv_leaf` 的 3D rotation / gravity 未支持。
- 下一步顺序：leaf 的 3D rotation + gravity → stretch 求解器 → noise worker（已反编译到驱动/调度器/5KB worker）。
