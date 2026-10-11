# Not Alone 宽光带与地面光池接线

分支 `codex/chibi-stage-reconstruction-20261002`。输入舞台代码 HEAD `ba0ccd6b`；验收时其他窗口已提交歌曲控制台至 `cbb77489`。本批仅改变舞台粒子消费者、对应资源提取及回归。

## 原生证据

`resources.assets` 的 LiveObjectLaserlight / MonoBehaviour106566 九项 PPtr 数组中，类型8、9分别绑定 `fx_in_ntalon_spotlight_front`、`fx_in_ntalon_spotlight_back`。前景22、后景18个 ParticleSystem，共20束光及20个光池。原生脚本数组决定采样顺序，不能用层级遍历顺序替代。

Material184 / Shader950 `Mobile/Particles/Additive` / Texture629 `fx_in_ntalon_spotlight` 构成同一条原生绑定。1024×512 atlas 的左右512×512区域分别是柔边光束和椭圆光池。UVModule使用常量0、0.5选择区域；beam pivotY=-0.5，pool pivotY=0.4。此前只画两根 Graphics 直线，遗漏了整个 atlas、出生组和地面光池。

原生粒子寿命0.4秒、循环1.84秒；出生时刻为0、0.46、0.92、1.38秒。五个 alpha key 形成短淡入、保持、淡出，不是所有灯同时亮暗。新采样器依据歌曲时间和事件出生时刻重算，倒退不依赖上一帧状态。光束与光池使用各自原生偏移、size、rotation、pivot，并整体接受CSV宽长及角度变换。

证据与回归固定在 [原生参数 fixture](../scripts/fixtures/chibi-spotbeam-native.json)、[提取模型](../scripts/fixtures/chibi-spotbeam-model.json)、[提取器](../scripts/live_chibi_spotbeam.py)、[时间采样器](../src/core/chibiSpotbeamParticles.js)。fixture保留脚本原始字节/哈希和粒子参数哈希；提取器拒绝不支持的UV、随机出生、延时、变换及贴图绑定。

## 已验证

- `python scripts/verify-chibi-spotbeam-parser.py` 与 `node scripts/verify-chibi-spotbeam-particles.mjs --published-assets` 通过：原生数组、atlas双区域、四组错相、alpha淡出/空档、倒退、源颜色、导演时间拉伸、缩放和本地生成索引一致。
- 原有 laser parser / particles 与共享 texture store 生命周期回归通过；CI加入新回归。
- 原生提取生成63种小纹理（新增上述atlas），未复制完整媒体。`npm run build:check` 2785 modules / 16.09s，输出固定 `.analysis/build-check`。
- 既有5198预览Browser，1280×720：Not Alone 1.6s和2.5s光束成组换位并落到各自椭圆光池；11s宽光带与已有聚光同时存在。关闭光束图层可见粒子10→0，开启恢复10。倒退恢复相同组；连续播放从1.6s推进到43.7s。
- ANYWHERE 25.7s复用相同原生类型8/9，橙色光束及光池出现（20个可见粒子）。切回Not Alone没有沿用其颜色或旧出生状态。
- 390×844：画布约357×201，宽光带与地面光池同比缩放；document scrollWidth=390，没有横向溢出；Browser console无error。此项是窄屏Browser验收，未冒充实体手机。

截图位于 `.analysis/engineering-validation-20261002/`：`not-alone-native-spotbeams-1-6s.png`、`not-alone-native-spotbeams-2-5s.png`、`not-alone-native-spotbeams-11s.png`、`not-alone-native-spotbeams-mobile.png`、`anywhere-native-spotbeams-25-7s.png`。

## 验收边界与后续

源参数和用户提供的Not Alone青色光带/地面光池参考已对照。CSV颜色覆盖原生初始金色、sweepDuration到脚本defaultDuration的时间换算、根变换覆盖和2D投影仍为录屏指导的消费者解释；尚未恢复原生导演函数体，不能声称逐帧Unity等效。录屏精确时间码未知，不以本地11s等同截图时刻。

此批通用于当前调用类型8/9的Not Alone与ANYWHERE，不把所有灯效硬套为宽光带。后续[横向投影复核](GS_CHIBI_SPOTBEAM_REFERENCE_ACCEPTANCE_20261003.md)记录新参考图、标定及用户该部分验收；类型5/6已另见[转动激光审计](GS_CHIBI_TURN_LASER_AUDIT_20261003.md)。类型1仍需Sprite/Animator接线，类型2无当前曲目调用；Take旋转315 Logo、观众荧光棒、其他未支持对象仍独立待办。背屏镂空与定位见[背屏审计](GS_CHIBI_BACKMONITOR_APERTURE_AUDIT_20261003.md)。
