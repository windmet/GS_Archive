# 舞台遗留假设审计：当前消费者与原生证据

日期：2026-10-15。输入 `stage/20261014-native-fidelity` / `1f87fc77`，工作树 `E:/Web_build/GS_Archive_Domain_Work/stage-native-fidelity-20261014/web_viewer`。本批只审计、复验与更新记录，没有修改 runtime、导出器或 public 语料。

后续：[人物原生尺度批次](NATIVE_CHARACTER_GEOMETRY_20261016.md) 已沿实际六槽位绑定替换人物经验尺度；并证明旧地面公式与原生360原点等价，保留位置、校正来源说明。下表对应两项是本审计时的历史状态。动作mix也须区分已有的普通命令显式.15s与默认.12s/队列配置；其余动作时基缺口保留。

2026-10-16续批：[动作BPM与mix](NATIVE_MOTION_CLOCK_20261016.md) 已从60首RAW曲谱和本地ELF接入baseTimeScale、命令执行时锁存、默认/首段mix及低速seek恢复。下表动作速度项保留审计时的历史实现；持续随机调度仍未完成。新发现smlegg音频/舞台时钟尚差25ms，详见续批证据与后续范围。

2026-10-16音频续批：[原生音频映射](NATIVE_STAGE_AUDIO_CLOCK_20261016.md) 已接官方音频/分声部的播放、暂停、seek、演唱切换和终点换算。保持资料播放器从音频开始的入口，不新增原作游戏负时间准备流程。

2026-10-16随机续查：[隐藏样本与共享动作链](NATIVE_RANDOM_MOTION_CHAIN_20261016.md) 已重读真实999样本绑定、全部RAW动作目标、两种RNG和85份池动画时长，并在5212复现DRIVE 37.3秒的分位独立补位错误。持续调度尚未替换，仍是明确未修正项；不能沿旧hash补一个循环。

结论：上一轮切歌清退和背屏 RectTransform 已有独立原生依据；人物经验尺度、动作基础倍率、默认mix和音频时钟映射已在续批替换。仍优先处理持续随机调度、旧悬灯曲目守卫和静态层排序回退。缺消费者是另一类问题，不能混称为“已复刻但略有误差”。

## 来源和当前绑定

- 本地 IL2CPP：`E:/Web_build/SideM_Archived/web_viewer/.analysis/ghidra-il2cpp/decompiled_pass1_annotated`、`decompiled_pass3_annotated`；本轮直接读取下列方法体。Ghidra 浮点形参不完整，不能从反编译伪签名推断完整矩阵。
- 复用本工作树 `.analysis/stage-command-inventory/raw-census.json`，重新校验其 60 个 RAW song bundle 的大小/SHA256，全部一致；choreography hash 一致。没有重新执行全库 UnityPy census。
- 当前 choreography 有 118 份编排；公开 RAW 清单与消费者矩阵回归确认 58 类、261,812 行（含一条非时序来源行）。行数不是视觉完成率。
- 5212/PID61564 的 Vite 实际服务上述工作树：HTTP 模块含 `native-backmonitor-plane-v1` 和 `baselineY: 540`，与当前消费者相符；服务日志绑定 `rm-native-relations-20261013`。HTTP bootstrap release 为 `1443ba17bda823fab56fdf04bea0aa527c4a0d0fe19486c202520e00c00636c5`。它不是 `CURRENT_STATE.md` 中测试站的更新 release，不能混写。

## 已修正，不能再按旧结论重复补丁

| 项 | 本轮核对结果 | 原生依据 / 当前验证 |
| --- | --- | --- |
| 切歌留旧背景 | 无静态条目时 release；切歌异步准备前退场。OUR SONG → JF、HIGH JUMP → JF 的背景归属均清空 | `LiveStage.Clear` 0x1f2a710 → `LiveObjectContainer.Clear` 0x221a72c；现有资源归属回归15项通过 |
| 背屏位置与大小 | 已移除250/231/242/逐歌偏移和电影编码尺寸乘2，改为脚本root → Base anchoredY=1.35 → 520×270显示面 | `PlayEffect` 0x22186e0、`ScriptPosToStagePos` 0x2218894；APK绑定/源哈希重读通过，14,520组布局回归通过 |
| Object_layer 粒子退场 | 当前已独立于Sprite alpha：直接Play、停止发射、到eraseDuration隐藏 | callback 0x1c9e17c、0x1c9de04；`chibiObjectParticleLifecycle.js` 和实际SFC回归通过；不代表所有粒子模块等价 |
| Penlight、新悬灯颜色/Beat、固定嘴型、Offset字段 | 已有消费者，不再是10-14文档里的“全未接” | 当前 `stageCommandCoverage.js`；各自仍为partial，Offset不等于随机调度完成 |

详见 [切歌清退](NATIVE_STAGE_SCENE_RETIREMENT_20261015.md)、[背屏布局](NATIVE_BACKMONITOR_RECTTRANSFORM_20261015.md)、[脚灯/粒子批次](NATIVE_STAGE_FLOOR_LIGHT_BATCH_20261015.md)。

## 仍然存在的经验值、兼容逻辑和不完整语义

| 优先级 | 当前实现与影响 | 原版证据 / 未完成边界 | 应收束的公共链路 |
| --- | --- | --- | --- |
| P1 | **人物尺寸仍来自可见像素标定**：导出器 `BODY_PREVIEW_BASE_SCALES={1:.3053,2:.2904,3:.3176,4:.3712,5:.3144}`，乘身高/175，body5封顶.28；Viewer再乘 `CHARACTER_STAGE_SCALE=.58`、`min(1,height/620)` | 源码注释明确为wait pose可见像素测量；这些不是已核实的原生SkeletonDataAsset/root缩放。背景使用 `min(width/1280,height/720)`，人物使用另一缩放基准；共享camera父节点不能消除该差异 | 先核对五种body的原生scale、人物prefab/root及投影，再统一响应式换算；不另加逐偶像系数 |
| P1 | **人物地面原点仍为Study画面对齐**：`chibiGroundRegistration()`固定baselineY=540，注释明确reference-calibrated | `LiveObjectIdol.SetPosition` 0x221bea0走公共 `ScriptPosToStagePos` 后直接设置localPosition；当前地面标定不是完整原生人物层级复原。不能据此直接删180像素偏移，尚需核完人物root/pivot | 连同人物尺度一起串root→stage→camera→viewport；保留现状作为对照，避免换一个猜测常数 |
| P1 | **动作速度漏baseTimeScale**：`playSlotEvent`和seek只用CSV speed/1000；Spine `defaultMix=.12s`亦为Web固定值 | `get_baseTimeScale` 0x221b270计算 `1.5/((60/curTempo)*4)`；`PlayMotionInner` 0x221c094明确乘该值与命令speed。即使恒定BPM，亦不应默认该因子为1；尚未读取原生mix配置 | 先核曲谱tempo时间单位及当前速度来源，统一播放/seek/暂停/变速时钟；另核mix，不能拿现有回归当原生节拍验收 |
| P1 | **随机动作只做一次确定性补事件**：每条脚本至多补一次group动作，hash选取；Offset不确定时 `nativeDueTime ?? authoredDueTime` 仍播放 | `UpdateMotionIfNeeded` 0x221af68、`MotionManager.UpdateMotionIfNeeded` 0x1bbeb24及 `GetMotionRandomDelay` 0x221b3c0有持续更新时间条件、manager取下一动作与Unity Random。当前只标pending，不等于已经按原版调度 | 还原持续调度状态机与中断/重播规则；未知tempo区间不能被误报为原生已解 |
| P1 | **旧悬灯守卫按歌名**：105份有数据，42份放行、63份禁用；被禁用59,865行，总88,647行 | `prepare-live-chibi-stage-effects.py`仅放行Moon/Growing Smiles/Drive；Viewer用 `descriptor.previewEnabled` 决定是否加载。是预览验收守卫，不是原版某些歌没有灯 | 按prefab/指令模式/tempo等能力条件逐项验证后放开；不要直接全开或继续扩歌名名单 |
| P1 | **祝彩第四层未知让整组排序回退**：`stage_syksai_04.sortingOrder=null`；SFC `loaded.every(...)`失败后四层全为 `-20000+index`，已知01/02/03的1100/1300/1500亦未使用 | `LiveStageNormalBackground.<Init>.MoveNext` 0x22565fc及现有APK绑定证明普通三层；第四层的模板绑定仍未串完。本轮Browser确认syksai四组件加载，未将其画面判成原生排序正确 | 查清第四层属于哪个renderer/template，再恢复完整全局排序；不能直接猜成1700 |
| P2 | **Logo选择仍是录屏白名单**：`previewSongs=[tkstp1,tkstp2,drvalv]`且限定movie，绑定固定`logo_m`；`state.logo`不能驱动换素材 | `LoadLogoSpriteIfNeeded` 0x2218530、`SetLogoSpriteIfNeeded` 0x2218a74有按命名资源字典加载、换Sprite；当前已有原生mesh/curve/500ms→.8 alpha，不等于完整value9选择。Passion override仍待查 | 接资源选择与RotateSprite生命周期，移除以歌曲/movie名代替运行规则的部分；coverage现在仍报sprite selection pending |
| P2 | **粒子随机和积分是Web实现**：bloom通道hash RNG、60Hz位移积分，其他粒子也有受限profile | 已恢复原生阻尼指数，不代表Unity随机种子、帧内更新顺序、曲线积分、所有shader/UV alpha等价；floor coverage明确保留partial | 用原生参数/模块支持矩阵及原片时间点定位，避免凭扩散截图再乘倍率 |
| P2 | **HDR/景深/透明深度与合成兼容平面未闭合** | 既有源资源中HDR/后处理链不等于当前Pixi输出；legacy composite仍是后置兼容平面。当前代码构建和不透明背景GPU对照均不足以证明原机合成 | 拆出可确认的renderer/material/depth契约，保留未完成边界 |

源码入口：[Viewer](../src/components/ChibiStageViewer.vue)、[人物尺度导出](../scripts/prepare-live-chibi-assets.py)、[人物地面](../src/core/chibiStageCoordinates.js)、[Spine动作](../src/utils/liveChibiSpine.js)、[Offset](../src/core/chibiMotionOffset.js)、[静态组件导出](../scripts/prepare-live-chibi-image-components.py)、[Logo激活](../src/core/chibiBackmonitorLogo.js)、[bloom](../src/core/chibiBloomParticles.js)。

### 字段旧名是数据债，不再是当前缩放错误

1,178条站位仍用`scale`保存value4；当前 `resolveChibiPlacement` 明确将其作为`sortingOrder`别名，不再缩放人物。Backmonitor旧`rotation/opacity`也按value6/7控制读取。后续应在受控重导中正名并校验消费者，但不能根据旧字段名声称当前仍把排序当缩放。

## 真正缺消费者的部分

当前注册表按实际118份编排重新聚合，**13,648行**没有消费者，另有前述59,865行旧悬灯被禁用。两者分开计数。

| 家族 | RAW行数 | 当前边界 |
| --- | ---: | --- |
| Searchlight七类 | 10,583 | 无消费者；本地已有show等executer方法体，show.PlayEffect 0x1eac350，不能继续泛称没有反编译依据 |
| Underlight四类 | 2,116 | 无消费者；本地有executer和LiveObjectUnderlight方法体，资源/字段/完整状态仍需串联 |
| 单人脚光 | 241 | 无消费者，集中一份编排；不要与已接的全员Foot_Color混同 |
| Smoke | 5 | 无消费者；本地已有LiveObjectSmoke及回调 |
| Whole_screen / After_Spappeal / Finish / Unit_serif / Livechara_skill | 703 | 无消费者；须分别确认是舞台可见效果、结束状态还是Web范围外的游戏行为，不能一概补渲染 |

原RAW还有一条含异常字符的非时序说明行，由矩阵保留为来源说明；没有计成时序缺口。新悬灯、应援棒等注册状态为partial，注册本身不证明字段全量或视觉等价。

## 5212 Browser复验与检查

使用当前可用的Codex In-app Browser控制入口（`cua_repl`），没有用独立Playwright进程替代。桌面1440×900、手机尺寸390×844；临时viewport最终恢复。手机尺寸是桌面Browser模拟，不是真机。

| 旅程 | 本轮观察 |
| --- | --- |
| OUR SONG拖到28s → JF拖到4s | URL/song/stage和标题同步；静态背景归属从`ossshd`变为空，JF画面无旧静态舞台；背屏ready异步转true |
| HIGH JUMP拖到曲末118.6s → JF 4s | 背景归属从`hgjmnl`变为空；无旧布景留存。此路径是seek后切歌，不冒称从头播放至曲末 |
| Take 01 / Possibilities / Change to Chance各5s | 实际查看背屏与布景；Take屏框、Chance三屏在当前布局中注册正常；未做原机逐帧差分 |
| 祝彩 | 静态背景ready=true、组件数4；结合磁盘组件元数据/SFC确认排序回退，不用截图推断GPU排序值 |
| JF 4s，390×844 | 内容有渲染、无框架错误覆盖层；document.scrollWidth=390，无页面横向溢出 |
| JF从4s实际播放 | 时间轴推进至110700ms曲末并自动暂停，背景归属仍为空；不同于前述HIGH JUMP曲末seek。保存结束状态JSON；未逐帧监听整个播放过程 |
| 返回歌曲 | URL为`/songs/jfhtmk/`，无残留song/stage查询参数；歌曲标题、High×Joker成员、试听与谱面表均实际加载，未停留在loading壳 |

页面身份与非空内容、切歌交互、截图通过；控制台无应用error，保留两条既有pixi-spine tint/update warning栈，不能称零warning。截图与console JSON在 `C:/Users/windm/.codex/visualizations/2026/10/15/01a13fa7-14e2-7682-9c89-a485261616a6/stage-audit-*`。

本轮执行并通过：`verify-stage-resource-ownership.mjs`、`verify-chibi-backmonitor-registration.mjs --published-assets`、`verify-chibi-object-particle-lifecycle.mjs`、`verify-stage-command-coverage.mjs --published-assets`、`verify-chibi-backmonitor-layers.py`。后者重读本地APK绑定/布局/源哈希及三个PNG。纯文档批次只做内容、链接和diff检查，不构建或打包。

## 后续顺序

1. 人物root/scale/地面/viewport一起核实，形成与已修背屏一致的矩阵证据；在证据完整前保留经验参数的明确标签。
2. 核对tempo时间单位，再修动作baseTimeScale、随机持续调度与mix来源；使用相同时间点对比play和seek。
3. 解决syksai第四层模板，并将旧悬灯守卫改为可证明的能力边界；每项独立验收，避免开全量后凭肉眼调灯。
4. 接Logo资源选择，再处理Searchlight/Underlight等缺家族；粒子/HDR保留原片与设备验收边界。

本次未部署、未改master、未通过增加新常数“修好”尚未查清的问题。10-13/10-14历史文档保留其当时证据，本页作为这次排查的当前入口。


## 10-16 灯光反查补充

[Pinspotlight原生接线批次](NATIVE_PINSPOTLIGHT_CHAIN_20261016.md)确认并移除了旧`.62/.7`灯圈缩放、135偏移、蒙版与flash同时换图及线性移动/淡出。影响20首歌40份编排7,146条指令，Study 6秒为本批视觉验收入口。旧悬灯守卫、hndmkh 26.55秒Laserlight style1的六条Graphics近似、Spotlight自由目标与缺消费者继续保留为未收束项。


## 10-16 激光 Sprite 接线补充

[style1原生链路](NATIVE_SPRITE_LASER_CHAIN_20261016.md)接回hndmkh六组18束原生Sprite/Animator，删除Graphics猜测回退，按原生语义恢复速度、颜色alpha、整体缩放与即时Erase。进一步确认粒子style3..9仍有width/alpha误读、非整体缩放、统一粒子时钟及Not Alone额外1.8倍率；该公共链路应作为下一项优先反查，不能将“已有native texture”视为完整原生接线。


## 10-16 粒子激光公共链路补充

[粒子激光原生链路](NATIVE_LASER_PARTICLE_CHAIN_20261016.md)收束60个系统的父平面/Local对齐、逐系统duration时钟、整体缩放、value10透明度与Shader950真实clamp/混合，删除Not Alone 1.8和反向X等旧修补；全库1,083条粒子指令按同一来源合同验收。Shader导出反证了上一批“命令alpha1.2应直接增亮”的推论，代码和记录一并纠正。尚未完成的旧悬灯守卫、Spotlight自由目标和缺家族继续保留，不将本批宣称为所有灯光完成。


## 10-16 Spotlight 字段与自由位置补充

[Spotlight 原生链路](NATIVE_SPOTLIGHT_CHAIN_20261016.md)确认value4是自由Y、value6是根缩放，删除旧duration/characterDepth误读；补齐0.5秒OutQuad、离屏移动、追随、Hide冻结/重显以及材质950混合。118编排以RAW生成并绑定原index摘要的新数据接入；本页此前“Spotlight自由目标未收束”的状态由本批取代。旧悬灯守卫和缺家族仍待处理。


## 10-16 旧悬灯第四类与能力守卫补充

[旧悬灯能力批次](NATIVE_OLD_SUSPENSION_CAPABILITY_20261016.md)补回原生_4两色RGBA Yoyo灯、Shader950混合及RAW BPM时钟，按105份RAW/资源绑定替换歌名白名单。96份/77,485行满足当前能力条件；9份/11,162行因空Show导致原生零周期等问题明确受限（Moon从旧名单移出）。这取代此前42/105按歌名放行的状态，但尚未完成9份原生非有限Animator速度行为，不能将“解除歌名判断”写成全部旧悬灯复原。


## 10-16 零周期引擎取证补充

[Unity原生setter与状态时间](NATIVE_OLD_SUSPENSION_NONFINITE_20261016.md)证实+Infinity速度不会被忽略，而会进入controller并产生非有限状态时间；118条空Show中78条后有同key Show，均没有中间完成Erase。9份边界继续保留，下一步是非有限clip曲线采样/Transform输出，不能以默认周期或自动恢复相位代替。
