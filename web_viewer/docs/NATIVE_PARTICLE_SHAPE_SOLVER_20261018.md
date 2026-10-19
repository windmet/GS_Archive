# 对象粒子 Shape：厚度、方向和 Arc 的原生反查

输入 HEAD `632e5db1`，工作树 `stage-native-fidelity-20261014`。本批修正已有通用采样器中的参考算法，没有增加曲目或资源特例。

## 本地证据

反查当前 `libunity.so`，SHA-256 为 `acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0`。Ghidra image base 为 `0x100000`；以下均为 Ghidra VA，换算 ELF RVA/本文件偏移时减去该基址。

- Shape 序列化函数 `0x867010`：type `+0xc`，angle `+0x48`，radiusThickness `+0x50`。
- 发射分派 `0x855d64`：按 type 分派，再按 Arc mode `+0x6c` 选择具体生成器。Random mode 对应下表函数。
- 最后调用 `0x8611d8`，对初始方向向量归一化，再处理变换与粒子输出。

| 类型 | Random 生成器 | 确认的语义 |
| --- | --- | --- |
| Sphere 0 | `0x8590a8` | 内半径的三次方参与体积采样；方向从中心向外 |
| Hemisphere 2 | `0x85a818` | 半球朝局部 +Z；bounds 函数 `0x8639d8` 同样把 Z 最小值置 0 |
| Cone 4 | `0x85bfac` | 底面在 XY；初速方向消费 angle 和采样径向比例 |
| Circle 10 | `0x85f500` | 内半径平方参与面积采样；方向位于 XY 径向 |

Sphere 在 `0x8590d0` 读取 `+0x50`，`0x8590e4` 计算 `1-thickness`，随后调用 log2、乘 3、exp2。循环内把这个内半径立方与随机值插值，再做 1/3 次幂。旧代码把 thickness=1 当成球面，方向也统一取 +Z，均与此不符。

Cone 的 `1-thickness` 直接作为面积项，并夹到至少 `0.001`；该常量在 ELF `0xd416b0`。它与 Circle 的平方内半径不同，不能用同一套环形采样替代。Cone 的方向 XY 分量是底面径向比例乘 sin(angle)，Z 是 cos(angle)，最后归一化。

证据清单及 Sphere 关键指令原始字节保存在 `scripts/fixtures/chibi-shape-native.json`。可通过以下命令复核本地二进制身份与指令字节：

```text
node scripts/verify-chibi-object-emitters.mjs --published-assets --native-engine .analysis/native-engine/libunity.so
```

完整反编译小型文本保留在 `.analysis/native-engine/shape-{initial,generate,callers,sphere-instructions}.c`；Ghidra 全程 readOnly，没有改原工程。Unity 的 [Shape 模块说明](https://docs.unity3d.com/ja/2022.3/Manual/PartSysShapeModule.html) 只作为字段含义的辅助对照，以上公式来自本地二进制。

## 实现

`sampleEmitterShape` 分别返回 position 与 direction，再各自应用 Shape 的旋转。形状缩放用于出生位置，初速不再统一沿 +Z。

令 thickness 为 T，U 为 [0,1) 的确定性随机数，R 为半径：

- Sphere：`inner=(1-T)^3`；`r=R*cbrt(inner+(1-inner)*U)`。
- Circle：`inner=(1-T)^2`；`r=R*sqrt(inner+(1-inner)*U)`。
- Cone：`inner=max(0.001,1-T)`；`q=sqrt(inner+(1-inner)*U)`；底面半径 `R*q`，方向为 `normalize(q*cos(phi)*sin(angle), q*sin(phi)*sin(angle), cos(angle))`。
- Arc：Random 模式按 RAW arc.value 限定方位角，不再固定 360°。
- Hemisphere：限制局部 Z 为非负；Edge 的固定方向为 +Y（正式目录的 Edge 仍要求初速为零）。

提取合同新增检查：这几类形状只接受恒定 radius、Random arc、spread=0。未知模式继续拒绝，不借用上述公式。

当前 74 资源 / 549 系统中，有 62 个系统使用 Sphere/Cone/Circle：38 / 20 / 4。系统数、纹理、生命周期、原曲参数与 28 个 Noise/Stretch preview 标记均不变。地面旧消费者、Whole_screen 和 Bloom 没有在本批改写。

## 验证

- 原生二进制 SHA 与关键指令片段校验通过。
- 几何回归：厚度 0 的球面、厚度 1 的球体积、中间厚度内壳、+Z 半球、圆形径向、180° Arc、锥形 0.001 夹值/方向归一化与角度关系，通过。
- 74 资源全目录采样、容量、确定性回拖与 Stop 后退场回归通过。
- 提取器无 --write 复核：74 / 549 / 0 deferred / 88 原图，逐像素与 RAW fixture 一致。
- `npm run build:check`：2956 模块，16.12 秒；固定 `.analysis/build-check`，不复制 public。
- `node scripts/run-verifier-batch.mjs`：147/147，通过。后增加的可选 --native-engine 分支也已单独实跑通过。
- 5212 Browser 插件冷启动 Beyond 12s：34 个对象粒子，wing 激活，无 unsupported、lightingIncompleteFrames=0。经曲目面板切到 はるかぜバトン 12s：气泡实际可见，70 粒子；连续播放到至少 1:27，再回拖 12s 仍为 70；console error 0。无 Vite 遮罩。
- 390×844 手机尺寸：同一 12s 气泡画面正常，70 粒子，scrollWidth=390；临时 viewport 已恢复，临时标签已关闭。截图为 `.analysis/native-shape-{byndtd,hrkzbn}-12s.png` 和 `.analysis/native-shape-hrkzbn-mobile.png`。

## 边界与下一步

本批得到的是 Random Arc 下的几何语义。Web 随机序列、JS 三角/根函数与原生 SIMD 多项式不是逐位一致；非均匀父缩放、完整 3D 投影和其它 Arc 模式仍需继续核对。不能把这批修正等同于原片逐像素验收。

37 个无消费者资源、80 个起始曲线采样拒绝系统、Noise damping/remap、stretch 顶点求解器及独立未接指令仍未解决。下一步继续从 InitialModule 的实际出生时刻采样入口追踪，不用曲线起点替代出生时间。
