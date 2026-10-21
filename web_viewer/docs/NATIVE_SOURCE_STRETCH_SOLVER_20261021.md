# 来源相机矩阵接入原生粒子context与空间求解

输入`8834faf0`，`stage/20261020-native-followup`。本批把[真实相机getter](NATIVE_STAGE_SPATIAL_FRAMES_20261021.md)输出接入原生renderer context与两条vertex writer，并新增空间求解函数；函数尚未接入舞台renderer调用，也未晋升火焰或改变public资源。

## 联合输入

绑定三个上游fixture的字节SHA：空间父链/编舞、153相机矩阵、八组火焰的source模型。`pfofos`200条对象事件中有104条Show；逐条保留x/y/scale，配对不晚于Show的最近一条相机指令**目标姿势**。这不是Show时刻Tween中间帧的捕获。

重组时保留完整源父矩阵和深度，加入Base初始父帧、Object_layer外层位置/统一scale及Stage(S,S,1)。只在XY乘宽屏Stage scale；没有把排序字段当根Z，也没有把Camera挂到Stage下面。源prefab根必须为identity，避免重复应用原始根变换。

相机使用原生getter生成的包含−Z轴的真实矩阵，不再使用旧合成+Z/−10。将它同时传入cameraInfo的两矩阵输入，符合此前反查的getter调用关系；height取相机指令目标zoom对应的正交高度。辅助camera字段保留旧受控值；这些来源尺寸上限均不生效，生成器逐项断言。

每Show组合取四个锥边界射线、两个粒龄和两条writer，共**104组合 / 1664例**。原生context/顶点/UV均执行真实指令，仅free(NULL)清理适配。脚本`prepare-chibi-source-stretch-fixture.py`先重验旧92例/8来源，再生成或不写入复核新fixture。

仍未执行projection getter、完整Camera对象生命周期、原生出生RNG/帧时钟、实际Tween中间轨迹或最终场景遮挡。不得将目标组合称为104个原片帧。

## 新空间函数

`chibiParticleStretch.js`新增`transformSpatialStretchVelocity`和`sampleSpatialStretch`：

- 保留XYZ速度和先camera×emitter再速度乘法的float32顺序，使用原生FRSQRTE近似及修正因子。
- 从传入world-to-camera矩阵反解相机位置，以相对位置/速度叉积得到侧边；根据相机矩阵手性处理Z轴反射，按同一UV顺序生成四角。
- 只接受正交XY相机view、正尺度和不触发屏幕尺寸钳制的已证范围；透视/非平面相机、尺寸钳制和退化侧边明确拒绝，未用默默降级代替。
- 旧`samplePlanarStretch`及当前renderer调用不变。新增函数有源码实现和原生数值验证，**尚未接线消费**，不是已经修复了公开舞台火焰。

## 结果与校验

| 同一来源组合 | 匹配数 | 最大误差，世界单位 |
|---|---:|---:|
| 实际新空间函数 | 1664/1664 | 2.1267353e−6 |
| 现有平面函数 | 832/1664 | 0.0088190925 |

无Z速度的射线可以吻合；含Z速度的其余射线需要空间项。不能沿用前批合成相机下0/2304的数字来描述这批真实相机矩阵结果，也不能重排UV角点掩盖差异。

`audit-chibi-source-stretch.mjs`直接调用实际新函数报告误差；exit0不算通过，emitter门禁断言1664例、八来源各208例、104个事件绑定、上游fixture SHA和UV顺序。相机类型/尺寸钳制负例必须抛错。旧同向view矩阵的三维证据亦直接经过新函数校验，包含Z-only和velocityScale非零样例。

`npm run verify:source-batch`167/167通过，日志`.analysis/source-stretch-source-20261021.log`。其后追加旧三维样例对新函数的直接校验，针对最新版本的published-assets门禁补跑通过。新来源fixture不带`--write`原生重放一致性通过。

`npm run build:check`2,972modules / 15.81秒，入口gzip203,549 / 215,040 bytes，固定`.analysis/build-check`，不复制public；生成审计元数据已还原。新函数未被任何页面/renderer调用，本批无渲染变化，未将旧Browser记录当作新空间函数的画面验收。

下一步给实际播放/seek传入相机姿态和Object_layer placement，锁定支持的相机分支与Web参考时钟后接线；同时补来源晋升、RAW纹理、完整闭包及实际Browser。当前公开94组/774系统/110纹理不变，缺口18种，八组火焰仍未晋升。未部署。
