# 舞台空间父链与相机矩阵getter

输入`a39a017e`，仍在`stage/20261020-native-followup`。继续[pfofos拉伸完整上下文](NATIVE_PFOFOS_STRETCH_SOURCE_CONTEXT_20261021.md)，本批只建立真实引用/坐标帧和引擎矩阵证据，未改运行时或public资源，未晋升火焰。

## RAW引用闭合

APK unity data SHA仍为`d35231c0b00a09f6941f47f7ffedde9e9b35701f5b66d6f432517da860e1a500`。直接读取MonoBehaviour序列化引用，不凭对象名猜测：

| 来源 | 序列化偏移 | 指向 |
|---|---:|---|
| LiveStage 114160 | 32 | Base GameObject10178 |
| LiveStage 114160 | 136 | LiveObjectCamera111805 |
| LiveStage 114160 | 148 | LiveObjectContainer123890 |
| LiveObjectContainer123890 | 32 | 同一个Base10178 |
| LiveObjectCamera111805 | 32 | Camera45565 |

Camera组件和LiveObjectCamera脚本同在GameObject22250。Stage组件在GameObject28603。引用、每个对象原始bytes SHA与完整Transform链进入`chibi-spatial-context-native.json`。

| 帧 | 初始Transform链，叶→根 | 初始世界Z |
|---|---|---:|
| Camera | 40921(0)→39065(1)→38270(1) | 2 |
| Stage | 42015(2)→39065(1)→38270(1) | 4 |
| Base/对象容器父节点 | 45385(10)→42015(2)→39065(1)→38270(1) | 14 |

Camera与Stage是兄弟节点，Camera不在Stage缩放之下。括号是各节点局部Z。它们是序列化初始帧，不是任意运行时世界坐标常量。

## 托管原生链路

`libil2cpp.decrypted.so` SHA `9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e`；指令窗口及常量bytes进入fixture。这里是指令/反编译关联证据，不宣称执行了完整托管场景或DOTween。

- `Container.Create 0x221a470`实例化后SetParent到`_container`，再调用`TransformExtensions.Identify`。本批未单独执行Identify；Show自己的显式变换写入见下一项。
- `ObjectLayer.PlayEffect 0x2220db8`以(x,y,0)调用ScriptPosToStagePos，写根localPosition、identity localRotation和统一localScale；value6存入排序回调状态，不作为该根Z位置。
- `Stage.Prepare`在`0x1cb0a34`取得stageScale，`0x1cb0a4c`显式s2=1，`0x1cb0a5c`写Stage的localScale=(S,S,1)。宽屏常量S≈1.3888888359，不能把它也乘到Z。
- ScriptPosToStagePos使用BasePos=(0,360,0)，比例float32(.01)。ScriptPosToCameraPos使用相同原点，但比例为stageScale/100；两者先进入各自父帧后才可比较。
- `Camera.PlayAnimation 0x2219960`在自由相机分支转换scriptPos，并对实际Camera Transform做DOLocalMove；Update把currentAngle经Euler(0,0,angle)写localRotation。

绑定的`pfofos_live_effect`有152条相机事件，全部focusSlot为空/0，及200条八组火焰Object_layer事件。fixture冻结两条轨道与编舞索引SHA；本批限定这条自由相机链路，不外推偶像追踪分支。

## 引擎getter原生重放

新工具`prepare-chibi-camera-matrix-fixture.py`在同一Unity ELF执行`0x5e5440`。它在自动计算分支先构造(1,1,−1)轴矩阵，再通过Transform世界到局部矩阵和真实矩阵乘法生成Camera存储矩阵；缓存返回分支也逐例重验。

两处明确ABI适配：`0x3170d8`解析到受控Transform，`0x3fcbcc`提供RAW TRS数组/索引访问。**未替换`0x3ff014`世界到局部数学、Z翻转或矩阵乘法**。先重验既有Noise/层级证据，再执行初始帧和152个目标姿势，共153例。目标XYZ换算和Z-roll四元数是显式输入，不冒充原生Tween或Quaternion.Euler回放。

初始矩阵（列主序）为`[1,0,0,0, 0,1,0,0, 0,0,-1,0, 0,0,2,1]`，即Z翻转且平移+2；不能继续把早期合成的+Z/−10作为舞台输入。自由相机目标姿势保持源父链，并用宽屏比例转换各条指令目标。153例均与独立world-to-local/Z翻转参考在2e−5以内一致；自动计算结果与缓存分支一致。

这仍未执行完整cameraInfo构造、projection getter、Object_layer外层变换及粒子writer联合链路，也不是152段Tween的每帧历史。下一步应把这份真实矩阵接到原生粒子context重放，再决定运行时相机XYZ/placement消费合同。不能仅因参考公式通过便登记火焰完成。

## 验证

`prepare-chibi-spatial-context-fixture.py --native-il2cpp <libil2cpp.decrypted.so>`核对RAW引用、托管指令/常量与轨道；`prepare-chibi-camera-matrix-fixture.py --native-engine <libunity.so> --unicorn-path <runtime>`重放getter。两个工具不带`--write`均可复核，只有显式`--write`才更新独立fixture，不写public。

emitter门禁新增同一Base引用、兄弟父链、初始深度、常量/窗口SHA、152自由相机/200火焰事件和153原生矩阵检查。第一阶段`npm run verify:source-batch`167/167通过，日志`.analysis/spatial-context-source-20261021.log`；随后补矩阵getter及窗口绑定，相关published-assets门禁针对最终版本补跑通过。

本批独立工具/数据证据不影响前端依赖，未重复Vite/Browser，最近应用验收仍为master #74同步。当前94组/774系统公开模型不变，粒子缺口18种，火焰仍未晋升。未部署。
