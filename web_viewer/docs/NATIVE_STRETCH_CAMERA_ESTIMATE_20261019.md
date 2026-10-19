# Stretch 相机准备链与 FRSQRTE 取证

输入HEAD `cfdf5b20`，工作树 `stage-native-fidelity-20261014`。本批继续 [顶点重放](NATIVE_STRETCH_VERTEX_REPLAY_20261019.md)，没有更改应用画面或解除省略标记。

## 把真正的上下文准备串进求解

之前16组用直接填写的单位context和z=1平面，不能推广到任意相机/缩放。本批新增packedContext输入：

`0x6c505c renderer/context准备 → 0x6c5580 相机矩阵与逆矩阵 → 0x80b8a4 / 0x817658 → 0x813660 stream写入`

输入仍为合成的正交camera数据：+4 与 +0x44 填写互逆矩阵，粒子位于z=0；给定的屏幕高度参数10、相机标志、renderer/主模块状态可在工具中逐字段检查。不是从完整Unity Camera对象或游戏录屏重放取得相机状态。两条路径各新增单位、非均匀缩放、非均匀缩放加60度旋转、屏幕尺寸上限四组，共计**24组顶点/UV**。后续[实际调用与三维输入反查](NATIVE_STRETCH_SPATIAL_CAMERA_20261019.md)证实本调用路径应填写相同矩阵；本页早期 cameraToWorld/VP 命名已纠正，旧数字仅保留为合成测试。

原生camera准备从传入矩阵构建逆矩阵。此前将相机位移与独立的单位逆矩阵混用会得到退化侧边，因此不能把早期人工context理解成通用相机模型。

在模块UV偏移缓存处填回原生默认(0,0)，避免触发与本实验无关的资源脏标记路径；该值从原ELF relocated pointer `0x11d1178` 取得。实际矩阵准备、参数拷贝、顶点求解和stream输出均执行原始指令。仍只跳过空指针清理0x306258，不跳过求解。

## 新结果约束接线

- v=(3,4)、size=2、velocityScale=1、lengthScale=2时，非均匀缩放(2,3)后的四角不是把单位四角直接乘缩放矩阵。叠加旋转后也不能据单位样例猜测。完整数值保存于fixture。
- 0x6c505c明确把min/maxParticleSize结合相机数据和粒子缩放，生成context+0x12c/+0x130/+0x134/+0x138等边界。它们不是可忽略的renderer装饰字段。
- 对packed单位案例，把maxParticleSize改为.01，侧边从约(.8,-.6)变成(.04,-.03)，即总宽从2变为.1；尾迹主体仍沿速度后退。普通Sprite整体等比缩小无法代替这条消费顺序。
- 因此，不能现在就把 `length=size*lengthScale+speed*velocityScale` 和一次末端矩阵作为完整solver接入。还需逐段翻译矩阵、归一化、尺寸边界及四角组合。

## FRSQRTE 不再靠误差容忍

从原ELF VA `0x80bb70` 取出 `frsqrte v0.4S,v0.4S` 原指令，后接ret，单独在同一AArch64模拟器执行。仅验证**正的正规float32**；零、负数、NaN、Infinity和subnormal没有据此宣称覆盖。

输入按float32指数和尾数分组：尾数高7位决定桶，使用桶中点、指数奇偶和整数舍入求估计，再按指数缩放。工具中estimate_model和原指令对照：

- 两个归一化指数 ×128桶，检查每桶低/高边界，共512个边界样例；256个归一化输出保存在fixture。
- 固定LCG seed `0x12345678`，4096个跨全部正规指数范围的输入逐个与原指令完全相等。
- 例如输入1，估计为.998046875；输入25，估计为.19970703125。它不是精确倒平方根。Unity还在solver不同步骤使用1.0019569修正及后续归一化，不能只给最终长度添加一个经验误差项。

这证明指令重放和所列输入下模型相符；不冒充ARM设备实测或完整renderer浮点等价。尚未把该模型放进Web运行时。

## 验证和边界

- prepare-chibi-stretch-kernel-fixture.py --write 后无--write重新执行，24组顶点/UV、512桶边界、4096随机样本、8个RAW renderer来源一致；此前Noise/重力/层级缩放fixture也同时通过。
- 修改仅限重放工具、fixture与文档，不涉及运行时代码、public素材、部署或新的Browser验收，不重复应用构建。
- 8个stretch_omitted保持。下一步应以packedContext案例为金标准翻译Web solver，保留RAW参数和UV方向，再进行5212真实播放验收；不能跳过相机上下文继续只接单位样例。
