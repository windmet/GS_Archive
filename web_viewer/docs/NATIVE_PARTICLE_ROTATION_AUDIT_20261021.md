# 舞台粒子旋转方向复核：确认问题，尚未修正运行时

2026-10-21；舞台分支 `stage/20261020-native-followup`，运行时代码 HEAD `f3cab367`。核查时保留了另一个尚未提交的 ossshd 云雾晋升批次；本审计没有修改共用采样器、旋转数据或 ADV 分支。

## 结论

ADV 提交的问题在舞台普通 billboard 路径上成立。Unity 粒子角度的正号与 Transform 的正 Z 欧拉角不是同一个渲染约定；不能因为 Unity→屏幕都要翻转 Y，就把二者作相同处理。

单位相机/发射器、尺寸 2 的原生顶点重放：

| 粒子 Z 角 | 原生投影后的纹理右轴 | 当前 sampleObjectEmitter |
|---|---|---|
| 0 | 0° | 0° |
| +0.5 rad | +28.64789°，屏幕顺时针 | −28.64789°，逆时针 |
| −0.5 rad | −28.64789°，逆时针 | +28.64789°，顺时针 |

原生 +0.5 rad 的同一纹理上边沿，世界坐标由 `(-0.398157, 1.357008)` 到 `(1.357008, 0.398157)`；只在投影时反转 Y 后，右轴向右下方，明确为顺时针。当前采样器返回的右轴 `(a,b)=(175.516512,-95.885108)`，明确为逆时针。

这不是“所有粒子都镜像”的证明。二维零角相符；对称发光纹理、随机全周角度、纹理自身对称轴等会掩盖问题。发射器 Transform 的位置/速度、舞台相机和角色旋转不能随粒子角度一并反号。

## 原生证据及边界

同一实际 Unity ELF SHA-256 `acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0`，image base `0x100000`：

- `0x809088` 为顶点分派；本次沿普通零 pivot 分支执行 `0x81e2e0`（2D）和 `0x81beac`（3D）。
- 直接执行顶点与 UV writer，输入旋转缓冲 X/Y/Z 为 `+0x1e0/+0x200/+0x220`，3D 标志为 `+0x7b3`；仅适配 `free(NULL)`，没有替换顶点数学。
- 4 个 2D 与 5 个 3D 样例保存在 `scripts/fixtures/chibi-billboard-rotation-native.json`；绑定函数指令窗口、精确顶点和 UV。生成器不带 `--write` 重放检查通过。
- 这是单位上下文的 CPU 顶点证据，没有执行 InitialModule 的 RAW→运行时转换、角速度更新、原游戏帧调度或场景回放。ADV 的 RAW 雨丝 93°=90°+3°、100°=90°+10°是独立的来源/下落方向证据，与本次顶点结果吻合。

`node scripts/audit-chibi-billboard-rotation.mjs` 是诊断，执行成功不等于渲染通过：当前 **1/9** 角点样例相符，普通二维零角通过，其余明确报告 mismatch。它按同一 PNG/native UV 角点顺序比较，+0.5 rad 的角点最大差约 95.885 px（粒子单位100px）。

3D 支路还存在额外的纹理 Y 基方向不一致：单位上下文、XYZ 全零时，原生角点与当前输出也不符，不能只把 Z 角取负就宣称 3D 完成。混合 XYZ 样例继续明确失败，需连同纹理坐标转换一起修复。

## 路径范围

| 路径 | 当前证据与后续处理 |
|---|---|
| 对象普通 billboard，`chibiObjectEmitters.js` | 方向反已经由 native 2D 样例和实际函数输出对照确认；初始 Z 和角速度积分都进入同一 rz，均需覆盖 |
| 对象 3D billboard | XYZ 投影及纹理 Y 基需一起核对；本次 5 个 native 样例均未相符 |
| Floor，`chibiFloorParticles.js` | 对初始角+角速度取负后直接交 Pixi；同样是反向约定，需独立接入同一顶点基准并做显示验收 |
| Whole_screen，`chibiWholeScreen.js` | 初始角及角速度也是负号；需同上验证，不能只修对象路径 |
| Bloom，`chibiBloomParticles.js` | 出生角取负后交 Pixi；需同上验证 |
| Laser / Spotbeam | `chibiLaserGeometry.js` 已明确使用 `rotation(-particleRotation)` 并处理两次 Y 反射；单位基下得到正屏幕角，不能跟着统一反号。仍须保留父链/镜像/Animator 的既有回归 |
| Classic Stretch | 不按普通 billboard 的角度生成四角。用正确 +0x220 槽重新执行后，改变角度仍不改变这两条 stretch 分支的顶点，不能跟着改 |

当前工作树（含未提交云雾）的保守库存：普通 2D 对象有非零 Z/角速度参数的 224 系统 / 37 资源；全部 3D 对象为 16 系统 / 10 资源。这是参数范围，不是逐个视觉缺陷数量，也不包含 Floor/Whole_screen/Bloom 的全部范围。具体可见程度不能由数量或“之前看上去没问题”代替验收。

## ADV 补偿与旧证据修订

只读核实 `portal/20261021-adv-native-weather` 工作树：`advParticleEffects.js` 直接调用 `sampleObjectEmitter`；`prepare-adv-particle-effects.py` 在输出模型时把 rotation/angularVelocity 两个常量字段取负，并记录 `rotation-negated-to-clockwise`。它没有修改共享采样器。共享修复并入 ADV 时，必须移除该补偿并重生成模型，否则会再翻一次；本审计未修改另一工作树。

另发现旧 Stretch 旋转反例写的是 `+0x3c0`，该槽实际是寿命百分比，不是旋转。这是旧证据的缺陷，已仅修正 `prepare-chibi-stretch-kernel-fixture.py` 的测试输入到 `+0x220`；重新执行 **92 个顶点/UV 样例、8 个来源 renderer** 全部与已有期望一致。结果支持“这两条 classic Stretch 忽略粒子角”的原结论，但现在输入证据才正确；没有改渲染器或 fixture 期望值。

## 下一步与验证状态

后续修复应保留 RAW 角度原值，在渲染坐标转换处统一粒子角约定；分别覆盖初始角、角速度、二维/三维、父节点旋转/镜像、相机、UV 与纹理基。再对 leaf/樱花、固定角矩形光片、Floor/Whole_screen/Bloom 做实际 Browser 对照，并在 ADV 合并时取消其数据补偿。不能把所有 rotation、Transform 或纹理一律镜像。

本审计仅提交诊断工具、原生证据和记录；已运行 native fixture 重放、诊断输出、修订后的 Stretch 重放及 diff 检查。没有运行应用构建，没有新增运行时修复或声称问题已解决，没有部署。

重放：

```powershell
python scripts/prepare-chibi-billboard-rotation-fixture.py --native-engine E:/Web_build/GS_Archive_Domain_Work/stage-native-fidelity-20261014/web_viewer/.analysis/native-engine/libunity.so --unicorn-path E:/Web_build/GS_Archive_Domain_Work/stage-native-fidelity-20261014/web_viewer/.analysis/native-engine/python-runtime
node scripts/audit-chibi-billboard-rotation.mjs
```
