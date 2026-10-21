# pfofos 1°锥形拉伸的原生探测

输入`62e7cf2f`，仍在舞台分支。本批只做受控原生对照，没有修改运行时、提取器准入或public资源。

此前八组火焰各有一个shape4、angle1°、shape rotationX−90°的拉伸系统；不能简单把angle改成0或把`stretch_omitted`改名来登记完成。但“有Z速度”是否必然需要另一套屏幕公式，也需要验证，不能仅凭门槛反推原生差异。

本机`.analysis/probe-pfofos-nonplanar-20261021.py`先运行既有stretch工具的92例/8来源一致性，再重新安装同一`free(NULL)`适配，调用原生`0x80b8a4`、`0x817658`两套顶点writer。试验绑定`pfofos_fire_1`的粒子来源、bundle SHA及真实父链平面：XY缩放约0.45、Z缩放1、Z旋转约−5.5°；renderer使用velocityScale0、lengthScale3、maxSize1。角度1°、初速35来自RAW，size1.5为受控固定值。

取锥边界方位0/90/180/270°，粒龄0.05/0.125/0.2秒，两套writer共24例。Z速度含±0.6108342253，位置沿对应速度推进；使用真实context参数构造、单位正交相机及native同向view矩阵条件。将返回顶点XY与现有`samplePlanarStretch`强制对照，最大差约**2.759e−7世界单位**，所有24例在1e−6以内，UV顺序不变。

这是受控输入下的正向证据：当前0/1°门槛可能比该相机分支实际需要更严格，并非已经证明需要新投影公式。不能据此宣称任意三维位置/速度、透视或场景等价；没有执行原生出生RNG、实际粒龄下的尺寸曲线、动态相机、完整八组世界位置，也没有检查材质/遮挡或原片。未将受控锥边界角冒充真实随机序列。

结果`.analysis/pfofos-nonplanar-native-20261021.json`保留原生顶点、来源和binary SHA；`.analysis/pfofos-nonplanar-comparison-20261021.json`保留每例误差。下一步扩大RAW尺寸曲线、父链/位置及相机条件覆盖，冻结可复验fixture，再决定是否将这些受限锥形来源接入现有拉伸消费者。当前八组火焰仍未晋升，缺口仍18种。

后续[完整来源上下文2304例](NATIVE_PFOFOS_STRETCH_SOURCE_CONTEXT_20261021.md)已确认：这八个拉伸系统没有尺寸曲线；完整平移/深度与右侧翻转父链下，平面公式全部不匹配，三维参考全部匹配。以上24例仍仅代表局部受控输入，不能作为放宽准入依据。
