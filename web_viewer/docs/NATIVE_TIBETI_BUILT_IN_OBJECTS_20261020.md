# Time Before Time：APK 内置 Object_layer 接线

输入 `d1a18e06`，分支 `stage/20261020-native-followup`，主checkout `E:/Web_build/SideM_Archived/web_viewer`。承接 [10-19来源定位](NATIVE_STAGE_FORMULA_CLOSEOUT_20261019.md) 与 [10-20路线](STAGE_FOLLOWUP_20261020.md)。本批补来源和实际消费者，不用“找到资源”代替“已经显示”。

## 来源与原生行为

歌曲RAW的四个对象在原始object-layers索引中为missing；它们实际位于APK `resources.assets`。保留原索引和所有依赖它的hash绑定，通过独立 [sidecar](../public/data/stage-built-in-objects.json) 补入运行时；不改RAW、不重写公共索引或放松现有来源守卫。

| 对象 | keeper PathID | 原生部件 / 消费者 |
| --- | --- | --- |
| fx_in_tibeti_overlight_1 | 128792 | 9 SpriteRenderer → 原生加色网格 |
| fx_in_tibeti_overlight_2 | 122706 | 1 SpriteRenderer → 原生加色网格 |
| fx_in_tibeti_water_1 | 123923 | 3 ParticleSystem → 既有native emitter，其中2个使用AlphaTex |
| fx_in_tibeti_water_2 | 108763 | 1 ParticleSystem → 既有native emitter，使用另一AlphaTex |

APK统一数据SHA `d35231c0b00a09f6941f47f7ffedde9e9b35701f5b66d6f432517da860e1a500`；object索引SHA `977e361db873efb535a620bb5a17a18c7a12d87fabc83b1244f217c70466959e`。提取器逐次重读真实APK并核对原 [keeper fixture](../scripts/fixtures/chibi-built-in-object-sources.json)，拒绝索引、来源或keeper变化。

四个对象均在-2000ms出现，命令duration=1000ms、位置(0,360)、scale=1000、depth=1600。Sprite保留命令淡入；粒子沿既有Play/StopEmitting/延迟停用语义，不把父容器Sprite淡入套给粒子。Sprite原始排序偏移均为0；仍经过公共逐renderer排序链。

两个overlight层级没有Animator。`LiveObjectLightSpriteEffect`只提供SetSpeed/SetColor/SetSortOrder等调用方法，没有本对象的独立Update动画；`LiveObjectObjectLayer.PlayEffect`（`0x2220db8`）与Sprite回调（`0x1c9e288`）激活renderer、DOFade到1并应用排序。因此本批消费静态Sprite及Object_layer淡入，没有编造循环动画。

## Sprite、材质和蒙版

- Sprite沿实际PPtr提取裁切PNG，按原生tight mesh bounds/rect与PPU注册枢轴，保留相对root的完整四元数投影、signed scale、skew及RGBA。不能从材质名含“add”判断混合。
- 十个SpriteRenderer均引用 `underlight_add` → APK Shader950 `Mobile/Particles/Additive`。逐次核对原始Shader SHA `7251f5c686e43bf50d0b4f470c83cc84af5774f867802d249388331ccbc4e4f5` 和已有GLES/混合fixture；使用现有NativeLightQuad的straight颜色程序，并明确注册RGBA均为SrcAlpha/One的混合模式。不是普通PMA ADD。
- 两个 `ToJ.Mask` 在APK中是剥离typetree的84字节布局。新增解析以真正typed RAW Mask为字段顺序见证，校验空名称、类、长度、bool与空storage；保留enabled、clamp、alpha channel、Texture PPtr和ST字段。未知布局拒绝，不猜默认贴图。
- 蒙版642、752分别绑定到本对象root的真实Transform链；材质_AlphaTex必须与对应Mask.mainTex一一匹配，且启用alpha通道、identity ST、无水平/垂直clamp。保留各自的mask尺寸、位置与来源，未共用猜测遮罩。
- 四个粒子系统通过既有模型能力检查，无deferred/preview模块。source、参数、Mask原始bytes与typed见证保存在 [运行时fixture](../scripts/fixtures/chibi-built-in-object-runtime.json)；原始APK/RAW或模型验收不代表Unity RNG、帧内调度或最终设备画面等价。

新增6张PNG，共608,897 bytes；来源批次 `2026-10-20-apk-built-in-objects-001`，全库清单400 PNG / 72,090,892 bytes。两张Sprite裁切图与四张粒子/蒙版图均有原始identity和PNG SHA，未增加完整媒体包副本。

## 公共材质与清退修正

当前Pixi的 `ADD_NPM` 实际配置为 `[SRC_ALPHA,ONE,ONE,ONE]`：RGB正确，但alpha不等于原生的SrcAlpha/One。无蒙版native object emitter现通过既有独立批渲染器使用白色alpha=1的恒等蒙版，采用原生RGBA混合；有蒙版系统保留原路径。恒等蒙版不改变RGB或透明通道采样，仅消除错误的独立alpha混合因子。该修正共用于native object emitter，不按歌曲判断。

新增Sprite网格也明确使用原生RGBA因子，并按renderer注册contextChange恢复。材质先于renderer planes销毁释放，否则Pixi销毁Mesh时会清空shader引用。实际SFC清退顺序、重复销毁、加载失败和晚到可选索引均有回归；纹理仍由本runtime独立拥有。

另一个公共边界保留：`createNativeLightQuad`的其他旧调用方仍直接使用ADD_NPM，旧文档关于这些调用方alpha混合完全等价的说法过度。本批未修改SpriteLaser/Searchlight/Whole_screen的构造接线，应作为后续公共材质检查，不把本批的object消费者修正推广为全舞台合成完成。

Sprite的命令fade仍使用既有Object_layer线性采样，须另查DOFade默认Ease与中断；本曲四个对象在-2000ms出现、1000ms淡入，进入播放器0秒前已完成，不将本批消费者接线当成所有Sprite淡入语义已核完。

## 验证

- `python scripts/prepare-chibi-built-in-objects.py`：真实APK不写入重放，4对象/4系统/6PNG的JSON与字节一致；没有全量重导。
- `python scripts/audit-chibi-built-in-objects.py`、`python scripts/verify-chibi-built-in-masks.py`：原keeper来源一致，两个真实Mask bytes、typed RAW字段见证及坏布局/类守卫通过。
- `node scripts/verify-chibi-built-in-objects.mjs --published-assets` 与无语料参数模式通过：10个网格、4个实际发射系统、资源/hash、未知来源/材质拒绝、蒙版绑定、回拖/Stop、真实SFC加载与清退、context恢复；还执行真实索引loader，验证late optional refinement保留APK对象、取消与HTTP错误不变成成功。
- `node scripts/verify-chibi-material-tint.mjs`：公式HDR乘色、batch切换默认复位、无蒙版恒等alpha坐标/white绑定与RGBA混合通过，未将这些断言称为真实GPU像素oracle。
- `node scripts/verify-chibi-object-emitters.mjs --published-assets`、`verify-chibi-object-renderer-planes.mjs`、`verify-chibi-object-light-runtime.mjs`、`verify-chibi-object-particle-lifecycle.mjs`与`verify-stage-resource-ownership.mjs`通过。
- `npm run verify:source-batch`：152/152通过；最后的loader/清退回归另运行两种模式。`npm run build:check`最终通过，2,961 modules / 17.11秒，固定`.analysis/build-check`、不复制public；仍有既有大chunk提示。
- 六张源图真实HTTP均为image/png，字节数/SHA与sidecar一致。二进制清单和verifier登记检查通过。

对象普查使用与运行时相同的attach链：137种被引用particle（加入两个water）、native emitter82、floor18、bloom3、旧particle2、无consumer32；后者仍涉及427条事件/18份编排，11种partial保留。effective runtime索引的源缺失为0。原公共索引仍保留当时的missing4，不能混写成已经全量重导。

## 本地服务与边界

复用5213；核验新建public文件在原PID59528返回HTML后，仅重启本轮进程，新PID67480，候选仍为 `E:/Web_build/GS_Archive_Domain_Work/rm-release-20261015`。5177、5212保持。日志`.analysis/tibeti-built-in-*`只含小日志与一次可重用代码构建目录，无全库包、无部署。

本批不证明原片逐帧、HDR/景深、Unity mip/RNG/帧内调度或真机等价；未把32种剩余粒子和未接家族标为完成。

## Browser 验收

使用Codex In-app Browser / cua_repl，完整模式，最终源码与PID67480；实际bootstrap release仍为 `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`。图像与控制台证据保存于本聊天visualizations目录，没有以旧5212服务代验。

| 旅程 | 本轮结果 |
| --- | --- |
| 桌面1280×800 / 5秒 | Time Before Time标题、3/3就绪、四个对象归属均加载；unsupported/deferred为空，实际粒子161，画面可见水面粒子和overlight；无框架错误覆盖层 |
| 冷刷新、5→0→5秒 | 四个对象再次进入消费者，回拖后画面和粒子恢复；异步首次加载中的瞬时计数不拿来作确定性求解器断言 |
| 从0实际播放 | 动作预载完成后实际推进到63.6秒，再自然到125.4秒曲末自动暂停；不是seek到终点。保留曲末当前画面，不宣称逐帧监听或性能验收 |
| 手机尺寸390×844 / 5秒 | 四个对象、161粒子、unsupported为空；页面scrollWidth=innerWidth=390。是桌面Browser尺寸模拟，不是真机 |
| 切到JF / 4秒 | URL/song绑定切换，旧对象归属为空、native粒子0，无材质销毁错误；并非只隐藏截图中的层 |
| 返回歌曲 | `/songs/jfhtmk/?maintainer=1`，song/stage/view参数清理；标题、High×Joker、试听和难度表实际加载 |
| 控制台 | 最终冷页与实播/换曲无应用error；保留既有Spine tint/update弃用warning |

截图 `tibeti-built-in-desktop-5s.png`、`tibeti-built-in-mobile-5s.png`，控制台 `tibeti-built-in-console.json`，位于 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/`。临时viewport已恢复。未合并master、未部署；原有未提交删除和无关未跟踪资料保持。
