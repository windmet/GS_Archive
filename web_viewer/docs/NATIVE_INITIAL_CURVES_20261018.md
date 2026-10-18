# InitialModule 双曲线与水晶伴随闪光接线

输入 HEAD `ae202afc`；舞台工作树 `stage-native-fidelity-20261014`，5212 原 Vite PID 61564。

## 原生反查

继续使用 `libunity.so`，SHA-256 `acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0`，Ghidra base `0x100000`。

- InitialModule 序列化 `0x70facc`：startLifetime 位于 `+0x10`，startSpeed `+0x30`，startSize `+0x90`。
- 出生初始化 `0x70c12c`：读系统状态 `+0x1b0`，除以主模块 duration `+0x28`，把归一化时间送入起始曲线；寿命结果至少夹到 `1e-5`。
- 曲线求值 `0x6e1838`：上、下曲线都乘同一个 `+0xc` multiplier，mode=2 时按传入的逐粒子随机因子插值。下曲线不能再乘 constantMin。
- RAW 全量 992 系统中，之前被“Initial curve requires birth-time sampling”挡住的 80 个系统，全部使用 startLifetime mode=2，分属四个 crystal 资源。它们 multiplier=1、constantMin≈0.2，而 minCurve 的实际值约 0.2024288；应读曲线，不能偷用 constantMin。

局部反编译保存在 `.analysis/native-engine/initial-{generate,minmax}.c`。`scripts/fixtures/chibi-shape-native.json` 已加入函数地址、字段偏移及 MinMaxCurve 原始指令片段，可用已有 `--native-engine` 校验入口复核完整二进制 SHA 和字节。

[Unity 官方 MinMaxCurve 源码](https://raw.githubusercontent.com/Unity-Technologies/UnityCsReference/2020.3/Modules/ParticleSystem/Managed/ParticleSystemStructs.cs) 也说明双曲线共用 multiplier；本地二进制是本批主要证据。

## 已实现的共同语义

1. 提取起始参数的 mode 0/1/2/3；mode=2 同时保留上下两套未加权 Hermite keys，拒绝空曲线、非有限切线和无序 key。
2. 起始寿命、速度、尺寸、旋转和重力按计划出生点在系统周期内的相位采样；同一粒子在后续帧固定使用该出生值，不再取 t=0，也不随粒子年龄重采样。
3. 寿命窗口计算包含 Hermite 切线可能造成的过冲：用等价 Bezier 控制点包围曲线，避免寿命大于 scalar 时提前漏掉旧出生粒子。
4. 保留原有确定性 Web 随机流；没有假装复现 Unity 随机序列。

原生按出生批次的系统时间求值，Web 按可回放的计划出生点重建相位，尚不宣称批次时间/固定步长逐帧一致。本次 RAW 的 80 对寿命曲线在时间维度上为常值，随机插值仍有意义。

## 四个资源的真实消费边界

放开寿命解析后，出现下一个被旧首错遮住的问题：每个资源内还有 crystal 本体系统，rateOverDistance=1。不能把这条非零速率忽略成 0。

| 资源 | 本批接入 glitter | 保留 deferred crystal |
| --- | ---: | ---: |
| fx_in_pavetl_crystal_1 | 15 | 15 |
| fx_in_pavetl_crystal_2 | 10 | 10 |
| fx_in_smlegg_crystal_1 | 21 | 21 |
| fx_in_smlegg_crystal_2 | 34 | 34 |
| 合计 | 80 | 80 |

**本批实际显示的是伴随闪光，不是双曲线寿命的晶体本体。** 双曲线解析与采样已实现并经原生/几何合同验证；80 个晶体仍被距离发射合同拒绝，正式数据明确记录 `Rate-over-distance requires emitter motion history`。未把这四个资源列为完整复刻。

目录变为 78 资源 / 629 消费系统 / 80 deferred / 89 纹理；28 个既有 Noise/Stretch preview 不变。新增一张 8,201-byte 原图，未改共享素材。

实际合并四条消费者后，无消费者资源 37→33，事件 433→428，受影响编排 20→18；明确 partial 的资源由 11→15。四个 tibeti 源缺失资源不变。无消费者减少不代表效果完整。

## 验证

- 提取器不带 --write：78 / 629 / 80 / 89，逐像素、哈希及 RAW fixture 一致。
- 原生二进制身份及 Shape/Initial MinMaxCurve 两段指令校验通过。
- 回归新增双曲线共同 multiplier、出生值冻结、Hermite 过冲不丢旧粒子；同时按 RAW 逐系统确认上述 deferred 恰为 mode=2 + distanceRate=1，避免错误标成已消费。
- `npm run build:check`：2956 模块，14.26 秒，通过；`.analysis/build-check`，不复制 public。
- 源码门禁 147/147，通过。二进制策略 385 PNG / 70,607,737 bytes，通过。
- 5212 Browser 插件冷启动 Pavé Étoiles，完整加载、12.2s：新闪光可见，18 个对象粒子，25 个距离发射 deferred；原有 `fx_in_pavetl_panel` 仍 unsupported。连续播放至至少 1:04，再回拖 12.2s 恢复 18 粒子。
- 同一播放器经曲目面板切到 スマイル・エンゲージ 12.2s：185 个对象粒子（含原有 panel 等层），55 个距离发射 deferred，unsupported 为空，lightingIncompleteFrames=0。console error 0，无 Vite 遮罩。
- 390×844：185 粒子，scrollWidth=390，无横向溢出。临时 viewport 已恢复，临时标签已关闭。截图为 `.analysis/initial-curves-{pavetl,smlegg}-12s.png` 及 `.analysis/initial-curves-smlegg-mobile.png`。

## 下一步

优先反查距离发射如何取得发射器世界位移、Play/Stop 时如何重置距离余量，再把这 80 个晶体系统接通；不能仅凭当前 Object_layer 的静态位置推定距离发射无效。同时继续剩余 33 个资源、Noise/Stretch、独立指令族和源资源缺口。本批未部署、未合并主线。
