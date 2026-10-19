# Not Alone 开头五秒：当前消费链复核

核对 HEAD `2e00c115`，舞台工作树 `stage-native-fidelity-20261014`，5212 原服务。用户询问开头灯光是否仍按截图近似；本轮只读复核，没有改灯光代码或参数。

结论：当前是原生资源和字段驱动的公共消费链，不是按截图描画，也没有保留旧1.8倍修补；仍不能声称Unity粒子逐帧等价。

## 0–5秒来源与消费者

| 时间 | 来源行为 | 当前消费者 |
| --- | --- | --- |
| 初始化-2s至1.4s前 | 场景/人物染暗；Spotlight1自由位置Y=10000、scale1、环境alpha0.5，灯本身移到画外 | 来源绑定Spotlight通用时间轴、原生Sprite与公共染色层。运行时计数1不等于画面中有一盏可见灯 |
| 1.4s | Laserlight ID1/style8与ID2/style9，颜色#00ccbb，周期参数1800ms，位置(0,230)，整体scale1，颜色alpha0.5，排序1750/1650 | 按style映射真实prefab，进入通用Laserlight分发器与spotbeam粒子消费者 |
| 3.7s | Hide ID1/2；Show ID3–6/style8，左右X=-480/+480、Y380、scale0.6、alpha0.5、排序1500；Spotlight2绑定中间站位3；人物染暗强度调整 | 同一消费者按ID退役/重建；Spotlight与人物排序/染色由各自公共链处理 |

`live_chibi_spotbeam.py` 的style8/9名称映射来自LiveObjectLaserlight序列化指针数组，分别绑定`fx_in_ntalon_spotlight_front/back`。这属于原版资源身份，不是按当前歌曲名放行。前/后prefab分别含22/18个系统；材质184、Shader950、Texture629图集1024×512，左右两个512帧分别为光束与地面池。burst、寿命、RGBA曲线、renderer pivot、父层级均读取来源。

`sampleSpotbeamParticles`共用`laserSimulationClock`、`laserBillboardPlane`、`nativeLaserScale`、`nativeLaserAlpha`；Viewer按kind/style选消费者，不检查歌曲ntalon。value6是整体缩放，value10是颜色alpha；原Not Alone额外1.8倍率与独立横纵字段误读已在早期批次移除。

## 当前验证

- 重新执行`verify-chibi-laser-parser.py --native-elf E:/Tools/ghidra_work/sidem/libil2cpp.decrypted.so`：APK全部60个粒子平面、父链/模拟空间/对齐、Shader950与118份RAW的1089条Show、977条Erase逐项对照通过。
- `verify-chibi-spotbeam-particles.mjs --published-assets`通过：原图集绑定、成对光束/地面池、burst交错、寿命空档、独立系统时钟、整体缩放和回拖等。
- 5212 Browser插件同页切Not Alone，1280×720：1.5s为10个粒子、ID1/2；3.8s为24个、ID3/4/5/6；Spotlight使用native-sprites，未绑定ID空，缺灯帧0。
- 从0实际播放至109.5s后暂停（覆盖开头五秒）；缺灯帧仍0。回拖3.8s、390×844为24粒子，scrollWidth=innerWidth=390；console error空。
- 截图`.analysis/not-alone-opening-1500.png`、`not-alone-opening-3800.png`、`not-alone-opening-mobile-3800.png`。临时视口已恢复、临时标签关闭。

当前旧字段名width/length及部分历史status文字不代表运行时仍按旧含义消费；以实际nativeLaserScale/Alpha与来源绑定为准。剩余边界包括Unity出生帧批次、实际时间步长、Color32量化、设备色彩空间/后处理及完整粒子求解器；二维平面与数值回归不替代原片/真机逐帧等价。另有面板对象层与染色层，不把激光链验收推广成整首MV完成。

本记录为纯文档，没有新增应用构建或修改公共素材；Logo接线批次的构建/147项门禁记录见`NATIVE_BACKMONITOR_LOGO_SELECTION_20261019.md`，不是本次新增灯光修复的证据。未部署、未合主线。
