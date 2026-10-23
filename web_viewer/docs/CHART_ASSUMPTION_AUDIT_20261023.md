# 谱面假设审计与原生链路核对

日期：2026-10-23。输入 `origin/master` / `2bdd3de44582ef3ce79cad1ec8c014f38118a6d9`；分支 `chart/20261023-native-projection`，LF worktree `E:/Web_build/GS_Archive_Domain_Work/chart-native-projection-20261023`。先建立台账，未修改运行时代码。范围仅谱面预览及其来源核查；无舞台修改、R2 上传或部署。

当前进展：第一批已接基础读取时长，第二批已接原生坐标曲线与默认面板目标点，第三批已接普通音符的逐音符speed归一化与可见窗口，第四批已接原生音符四角与三皮肤贴图裁切，第五批已接给定绘图平面点的原生长条网格。首表保留输入提交的审计状态；窗口/按压/已判定节点调度、节点判定、Special固定速度和flick仍开放，不把坐标合同通过写成原机渲染完成。

## 审计时的消费者与证据等级

行号对应上述输入提交。原生数据、原生常量、截图标定与运行时规则须分别举证；原生 Sprite 不证明音符类型映射或摆放正确。

| 项 | 当前消费者 | 画面影响 | 当前证据 / 待核实 |
| --- | --- | --- | --- |
| RAW `_fumen` 的 tick / tempo / poly，PB 47 的等级 / Combo | `SongChartPresentation.js`、`SongChartTiming.js`、歌曲数据消费链 | 全谱时刻、折点、难度与计数 | 已有来源提取；本轮尚未重读全库，不将既有 61首/244档计数当成本轮验收 |
| LaneCount=5、TopLaneWidth=21、TargetLaneWidth=880 | `SongTrackPresentation.js:6-8,21-22,112-114` | 五轨宽度、远近端 | metadata 原生常量；把宽度直接用于 Web 插值仍未证明原生投影 |
| NotePosZBaxk=200、NotePosZFront=100、NoteSizeAdjust=312 | `config/song-track-reference.v1.json:23-62` | 深度、尺寸 | 原生常量；当前轨道函数未使用这三个字段，需恢复消费者 |
| `centerX=640` | `config/song-track-reference.v1.json:394` → `SongTrackPresentation.js:22,113-114` | 轨道、音符水平锚点 | 仍为截图估计 |
| `judgeY=570` | 同配置395 → 同模块23,104 | 判定线与轨道延伸 | 仍为截图估计 |
| `topY=8` | 同配置396 → 同模块23,104 | 出现端和纵向压缩 | 仍为截图估计 |
| `depthRatio=2` | 同配置399 → 同模块20 | 时间到屏幕位置的非线性变化 | 仍为截图估计；不能仅替换相机常量后称原生 |
| `normalVisibleWidth=148` | 同配置397 → 同模块68,91,108 | 音符、中间节点、长条宽度 | 仍为截图估计 |
| `holdWidthRatio=.72` | 同配置398 → 同模块91 | 长条带宽 | 仍为截图估计 |
| `round(24000/speed)`，speed范围1–30 | `SongTrackPresentation.js:11-14` | 音符出现到判定时长、可见范围 | Web视觉配速；注释明确未恢复游戏公式 |
| poly线性插值、`span/32`细分、UV按全长映射0–200 | `SongTrackPresentation.js:27-33,75-100` | 滑条拐弯、网格与贴图拉伸 | poly为原生输入；插值、细分、UV不是已证明的原生规则 |
| 中间节点取所有内部poly点 | `SongNotePresentation.js:17-24` → `SongTrackPresentation.js:106-108`、`SongChartPresentation.js:60` | 滑条中间节点的位置与数量 | 仅来源折点展示，不等于原生生成/合并/判定规则 |
| flick提示宽度`.65/.28`、横偏`.57`、上偏`1.12` | `ArchiveSongNoteGlyph.vue:31-34` | flick箭头大小和静态位置 | 仍为估计；素材原生不证明位置原生 |
| 音符外观映射、SPECIAL、默认皮肤 | `SongNotePresentation.js:3-9`、`config/song-note-rendering.v1.json` | 紫星/绿315等选择 | Sprite原生，语义映射仍有截图依据；SPECIAL与默认皮肤未核实 |
| conductor / BGM_offset | `SongChartTiming.js` 与舞台既有独立证据 | 谱面与音频时间关系 | 不能把舞台已核实的时钟自动推广为谱面完整同步验收 |
| 判定窗口 | 当前资料预览无游戏判定消费者 | 若未来展示会影响判定说明 | 待核实；本批不凭空添加展示 |

## 版本核查与下一步

配置绑定 iOS 2.6.10，metadata SHA256 `658f966af11aef965b541e093889056cafa61a7f7fcd4bbf38e1ca2eab6d6e00`，本轮重读本地文件一致。Android 解密 ELF SHA256 `9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e`。Android 加密 metadata 与解密 metadata 的 hash 不同是预期现象，不能据此判版本不同或相同；需核包内版本、来源配对及 RAW 绑定。

方法体依次核查：`NoteInfo.GetCurrentEvalPosY`、`NoteDrawManager.get_liveSettings/Initialize`、`LiveSettingsData`、`FixSpNoteSpeedButton`；其后 `HoldMesh` 坐标转换、`SetTargetPosList`、`LoadLanePanel`、序列化相机/面板；其后尺寸、长条与中间节点；最后 flick / TimeMargin。反编译输出与源摘要保存在本 worktree `.analysis/chart-native/`。未闭合前不替换估计值。

## 本轮已核实：版本与来源

- 直接读取 IPA `Info.plist` 与 XAPK `manifest.json`，两者版本均为 `2.6.10`，Android versionCode 为143。IPA包内 data/metadata 与上述配置哈希一致。
- XAPK包内原始 ELF SHA256 `425c6122033279b244747bf167d5e97ae7db0ebfba40fe62651a879a541351d2`；原始及解密 ELF 的 GNU build ID 同为 `557a46c49e7a0bcf3c0275b63fbcda0f7c53be91`，解密输出与舞台 Ghidra 输入逐字节相同。Android metadata 加密输入 SHA256 `65158ad9bcc30cb29c549819492d0835c9d526f36de0b188197c6f50a7794484`，本地解密输出 `dc257cb9aaa706915fad7635acce8f0977c0416372b985e763825f5990461184`，不要求跨平台 metadata 字节相同。
- 重读61个 RAW song bundle 的 `_fumen`，61份文本哈希均与公开谱面来源记录一致；当前目录有248份带source的JSON，catalog实际消费244档，两者不能混称。RAW authoring `ver1.0.0` 不是客户端 build ID，未据此宣称每份下载资源均由2.6.10打包。来源核对存 `version-receipt.json`、`raw-fumen-receipt.json`。
- 本轮只读反编译4批共132个方法，输出为 `decompiled{,2,3,4}/`；未修改 Ghidra 项目。旧文档“iOS UnityFramework 加密，无法读方法体”只描述当时平台，不再作为没有原生方法的理由。

## 第一批：基础读取时长与时间单位修正

`LiveSettingsData.GetReadTime` 0x1c1b160：`float32((120 - noteSpeed) * float32(0.05))` 秒。常量位于0x32cc844 / 0x317a310。`LiveRhythmIconSpeedSettingPanel.Init` 0x1c16334设置整数范围10–110；标签回调0x1caa284显示`setting/10`；`LiveSettingsData..ctor` 0x1c1b6e0默认50。所以显示刻度1.0–11.0，默认5.0；默认基础读取时长3.5秒，端点5.5秒/0.5秒。

`FixSpNoteSpeedButton` 0x2059f64起仅是PlayerPrefs调试开关，不能拿它定义普通配速或推断Special规则。`EventNoteData.GetNoteTime` 0x1f471cc与`NoteManager`出场检查使用逐音符speed；`NoteInfo.GetCurrentEvalPosY`又除该字段，说明输入判定与绘制链路必须分开。RAW存在非1的普通音符speed，当前预览仍未恢复逐音符速度、Special固定速度和长条完整出场调度。

本批移除24000/speed。运行时与verifier共同import `SongTrackNativeTiming.js`，把已核实的基础秒数通过同一个`SongChartTiming`转换为当前tick窗口；几何内时间比例也按分段BPM的秒数计算。**这证明基础读取时长接线，不等于完整原机下落行为。**

- `config/song-track-native-speed.v1.json`记录ELF、方法36字节SHA256、常量原始字节及101档Unicorn ARM64执行输出；不是用JS公式生成期望值。
- `python scripts/audit-song-track-native-speed.py --native-elf E:/Tools/ghidra_work/sidem/libil2cpp.decrypted.so --unicorn-runtime E:/Web_build/SideM_Archived/web_viewer/.analysis/native-python-runtime`重执行101档，结果一致。
- `node scripts/verify-song-track-native-timing.mjs`通过；恢复旧24000/speed公式的实际模块变异被拒绝。含60/120/220 BPM及窗口跨120→240 BPM的消费方坐标检查。
- 既有track/note-rendering/chart-timing/chart-presentation回归通过：catalog244档，732窗口，66,666个原始音符；既有几何回归不证明原生投影。
- `npm run build:check`通过，输出仅`.analysis/build-check`，未复制public。保留既有大chunk与舞蹈室背景在build时未解析的warning，不能写成零warning。

实际应用验收：本worktree Vite `127.0.0.1:5231`，候选`rm-release-20261022`，public corpus fallback为主checkout。Café Parade歌曲页→打开谱面预览→EXPERT透视轨道→速度设置；桌面1440×900观察5.0默认值、11.0与1.0切换，同一tick39899附近可见端点由1个变为39个；实际播放推进到曲末自动暂停。手机尺寸390×844，tick30000，速度8.3，5个可见端点，scrollWidth=390。截图`desktop-speed11.png`、`desktop-speed1.png`、`mobile-speed1.png`（文件名保留，实际控件8.3）；控制台无error/warn。此为桌面Browser模拟手机尺寸，不是真机，也没有原机逐帧对照。

## 投影续查（接入前记录，已由第二批更新）

原生`RhythmGameNoteManager.GetPosFromLane`实际为Vector4的HFA返回：s0=x、s1=y、s2=z、s3=scale。普通Ghidra伪签名只显示float并遗漏其余分量，不能照伪C签名直接改Web。已补ARM64指令导出`instructions.txt`及受控执行`native-projection-cases.json`（90例，Math.Min/Mathf.Lerp与settings读取用明确的标量stub，主体使用原生指令）。

它的纵向曲线不是当前depthRatio=2：t=min(1+noteTime,1.2)，两条有理函数混合，含21/(-400t+420)-.05及5/(-16t+20)-.25；scale使用float32(21/880)。z则是200→100、t/1.5的夹取插值。以上仍需连同真实绘制矩阵及目标点坐标消费，不能只靠这90例宣称原机投影完成。

UnityPy直接读取IPA序列化场景level4：PreCamera为orthographic，FOV60并非其有效透视控制量。LanePanel1/2/3与TimingAdjust的Base anchoredY均为-212，Target1/5 anchoredX为-352/+352；LanePanel1另有Mask -4与Target约+4的抵消。Canvas序列化localScale为0，由运行时Canvas布局恢复，不能按静态transform直接乘成零。证据在`serialized-scene-level4.json`、`serialized-target-chains.json`、`serialized-resource-lane-panels.json`。当前相机/位置曲线/尺寸/hold/flick估计值仍未升级为原生。

## 第二批：原生坐标与默认面板接线

输入 `3d7ed9e3`。`SongTrackNativeProjection.js`实现0x242404c的相同浮点操作；runtime的`projectTrackPoint`和verifier共同import它，没有第二份JS镜像。位置曲线由native指令产生的180例验证，覆盖5个lane（含2.35）、9个时间比例、2个目标Y和2个宽度倍率，x/y/z/scale四分量最大差为0。Min/Lerp和settings读取为明确标注的受控stub，**没有模拟原生Unity场景、mesh或GPU**。

默认目标点由IPA `resources.assets` / `LanePanel1`（GameObject33705）向上读取RectTransform得到。`UtilOhashi.GetPositionInCanvas`原生只累积localScale/localPosition，并不乘rotation；面板里的两层180度旋转不能成为擅自换成通用世界矩阵的理由。其根Canvas停止条件也避免把序列化Canvas零scale乘进结果。5个目标x为-352/-176/0/176/352，y均为float32的-211.99993896484375。

默认宽度字段在`LiveSettingsData..ctor`为type1。原生normal getter的0x4325aa8间接usage解出Android metadata literal16504 `live_lane_width_rate_normal`，对应已绑定PB的BasicMasters表3 / id163 / offset587444 / value1000；`GetParameterByNameAsRate` 0x2327bf0读取0x3168e68的double1000为除数，得到1.0。没有把narrow/broad的默认回退800/1200冒充当前PB值（当前PB为900/1300）。预览仍只用normal宽度，不新增UI设置。

Native坐标通过明确的Web适配转换到现有1280×720画布：x=width/2+nativeX，y=height/2-nativeY。**1280×720是Web画布选择；中心640不是从相机反推出的原生常量。** 出现端为0，判定线为571.99993896484375；源码和SFC不再读取截图的centerX/judgeY/topY/depthRatio，也移除了SFC硬编码顶部8和旧判定线锚点。148和.72仍保留给后续尺寸/长条批次。

原生Z须单独看：它是clamped `lerp(200,100,min(1+noteTime,1.2)/1.5)`；判定时为133.3333282470703，不能把常量100直接当作判定线深度。当前SVG保留z用于证据/未来网格接线，不据此宣称已有完整深度合成。

可重放来源：`scripts/audit-song-track-native-projection.py`，输入`--native-elf`、`--ipa`、`--metadata`（Android解密metadata）、`--masterdata`（decoded PB）、`--unicorn-runtime`；默认只校验，`--write`只写小型geometry/fixture。`config/song-track-native-geometry.v1.json`存5个方法窗口hash、IPA面板/相机hash、PB字段绑定；`scripts/fixtures/song-track-native-projection.json`另存180组输出，不进入runtime bundle。

验证通过：来源重读；`verify-song-track-native-projection.mjs`（旧depthRatio/topY/judgeY实际模块变异全部被拒绝）；`verify-song-track-native-timing.mjs`；244档track/note-rendering/chart-timing/chart-presentation回归；`build:check`（源码包，无public复制）。

真实Browser：5231/PID67724仍为本worktree，HTTP实际模块含原生曲线；bootstrap release `1accd9d0aa698ec03ec6d0b80211939f914940abac105d51021b36a8fb321081`，候选`rm-release-20261022`。桌面1440×900 Café Parade EXPERT / tick30000，19个可见端点，DOM顶部0、五个判定点Y均571.9999389648438；截图`projection-desktop.png`。手机尺寸390×844 / tick4000，23个端点、3条长条/6个贴图三角形，scrollWidth=390；截图`projection-mobile-holds.png`。返回来源页得到`/songs/cfprde/`，标题、难度表、歌手等内容实际加载，URL无chart_lab残留。控制台无error/warn；已恢复viewport。截图证明真实应用有渲染和交互，不证明原机画面等价。

## 第三批：逐音符speed与独立出现窗口

输入 `5a3fcd5c`。`NoteMesh.GetNoteTime` 0x20bcebc明确执行double `(liveTime - absTime) / (leadTime / (double)floatSpeed)`，不是把用户速度刻度再乘一次。已把原生float32读取和double除法顺序接进`SongTrackNativeTiming.js`，渲染与verifier共同import；没有用`GetCurrentEvalPosY`里的判定除速反推显示位置。

`config/song-track-native-speed.v1.json`现包含原有101档设置结果及另外132组原生归一化输出，覆盖lead=.5/3.5/5.5秒、speed=.1/.2/.3/.5/.8/1/1.5/2/2.5/3/5和判定前/后时刻。两个方法均直接执行ARM64，无数学替身。恢复24000/speed或把逐音符speed强制写回1的实际模块变异均失败。

可见端点、长条裁切范围、用于当前poly折点展示的中间节点分别按该音符`leadTime/speed`计算；慢音符不再被基础tick窗口提前丢弃，快音符也不会提前出现。长条的完整几何/节点生成/判定仍待第四批，不因这次窗口修正而晋升为原生已完成。

当前catalog244档共有109个非1速度音符，全部在`drv999` type1，即页面显示的PASSION。审计见`.analysis/chart-native/active-note-speed-census.json`；不能把目录中248份JSON的额外档位混进这次消费方计数。普通长轨图仍保留按源tick的示意排布，不强行变成游戏速度排布。

透视视图的同时线按float32相同speed分组；来源`OnNewNote` 0x2426874除时间比较外还检查speed的`NearlyEqual(float,float)` 0x237d52c。该比较读取Mathf.Epsilon：0x430f008的TypeInfo usage解析到Android metadata的UnityEngine.Mathf（typeIndex32264 / TypeDef3891）；Mathf与MathfInternal的cctor给出float位型0x1或0x800000，均远小于当前RAW离散speed间隔。因此对本批数据，按float32同值分组不合并不同速度。相关方法hash已存speed fixture；不声称复刻所有任意输入/时间容差下的原生链接状态机。

回归：native-speed来源重读；native-timing的233个原生输出、双变异、跨BPM窗口、快/慢端点、慢长条/poly窗口及真实drv999出现边界均通过。既有244档track/note-rendering/chart-timing/chart-presentation及180组坐标回归通过；`build:check`通过，输出仍为`.analysis/build-check`且无public复制。

实际Browser：同一5231服务，`/songs/drv999/`→打开谱面→PASSION透视。桌面1440×900、默认速度5.0：sourceIndex10 / tick7680 / speed1.5在cursor5000时不显示，cursor5100时显示（fraction=.9872448979591834），截图`speed-drv999-desktop.png`。手机尺寸390×844、cursor57000时，sourceIndex546 / tick68160 / speed.2显示（fraction=.5693877635865796），24个端点、4条长条，scrollWidth390；截图`speed-drv999-mobile-slow.png`。实际播放观察时间从约50.9秒推进到64.06秒，未把它记成整曲长稳验收。返回`/songs/drv999/`后标题与歌曲页内容正常，已恢复viewport，控制台无error/warn。此为桌面Browser模拟手机尺寸，非原机。

## 尺寸续查（尚未接入）

已只读执行`NoteMesh.UpdateFromGameCreateMesh` 0x20bd010，原生主体和Vector3归一化产生9组四顶点结果，临时harness与结果在`.analysis/chart-native/emulate-note-quad.py`、`native-note-quad-cases.json`。Unity Sprite/Texture与Mesh提交、settings读取为明确受控stub；顶点数学和原生坐标函数实际执行。不能直接拿这9例宣称所有皮肤/长条的native mesh已完成。

重要差异：Note1普通音符的完整256×256贴图在判定线约宽144.4103、高154.0377，外轨四边形还沿轨道倾斜；这不是当前148宽和固定宽高比。0x32d4814的312、0x32d4818的192、0x317a32c的.8及`GetNoteScaleRateByNoteTime` 0x1afc78c共同参与尺寸；后者从1.8到1插值。必须连同四顶点/贴图一起接，不能仅把148换成另一个宽度常数。

另外从IPA读出21个native Sprite/Atlas rect，见`native-sprite-rects.json`。Note3横条normal的原Sprite rect为300×300，packed texture rect却是267.94647216796875×95.89712524414062，PNG导出为268×96；其他横条也有小数rect。后续必须使用实际packed rect生成几何，不能把PNG整数像素或透明裁边尺寸冒充原生尺寸。148与长条.72目前仍为估计。

## 第四批：原生音符四角与三皮肤裁切

输入 `7bd23715`。`NoteMesh.UpdateFromGameCreateMesh` 0x20bd010、`GetNoteScaleRateByNoteTime` 0x1afc78c和实际Vector3归一化方法均执行ARM64。21个Sprite的9组不同packed尺寸 × 普通/Special × .8/1/1.2尺寸设置 × 4个lane × 5个时间比例，共1080组四角；`SongTrackNativeNoteGeometry.js`与verifier共用，四角最大误差0。`NoteSizeAdjust=312`与192、.8、1.8全部按原生浮点操作接线，不能简化成换一个固定宽度。

IPA实际Sprite/Atlas的packed rect小数参与几何；导出PNG的整数裁切与Unity UV对应关系另作Web适配。21个Sprite/3个lane/3个时间比例的四角映射最大残差0.000030517578125画布单位，单张仿射image避免两三角形半透明接缝，裁切到四个原生顶点。没有恢复原机shader、Z遮挡、粒子或完整GPU流水线。Special四角在受控时间比例下已核实，Special固定速度调度仍开放。

语义映射从原生`ConvertNoteTypeToDrawType` 0x20b85c0的表和`GetSpriteInfos` 0x20b69fc的metadata literal解出，不再只靠截图：SMALL→normal、LARGE→p_skill、三方向FLICK→swipe、SPECIAL→sp、HOLD_MIDDLE→middle。`HoldMesh.Create` 0x21cf2c4调用原生head/end转换；head HOLD/VARIABLE→SMALL，LARGE_HOLD/LARGE_VARIABLE→LARGE；tail普通→SMALL、三划向→对应FLICK。皮肤默认来自构造器noteDesign=1/noteSize=100，除数100；不把默认值当作每个玩家实际设置。

可重放producer `scripts/audit-song-track-native-note-geometry.py`读取已绑定ELF、IPA、Android metadata，核对Android/iOS音符enum并重新执行1080组；config存21个Sprite、9个方法hash和边界，fixture另存原生输出，不进入bundle。资源/Sprite/Texture读取、settings、标量helper和Mesh提交是显式stub，顶点/位置/归一化主体不是JS期望值镜像。反编译/指令在`.analysis/chart-native/decompiled{9,10,11,12}/`和`mesh-instructions.txt`。

验证：来源重读一致；native-note-geometry的旧148宽、PNG整数尺寸、平直矩形实际模块变异全部拒绝；233组native-timing、180组projection、244档track/note-rendering/chart-timing/chart-presentation回归通过；`build:check`通过（21.77秒，无public复制），保留既有背景未解析与大chunk warning。148现在只供待核实的长条148×.72使用，普通头尾和poly展示节点不再读取它。长轨图仍保留其示意布局。

实际Browser仍为本worktree5231/PID67724：桌面1440×900 Café Parade EXPERT tick30000，19个端点，圆形与横条分别截图`note-quad-desktop.png`、`note-quad-skin3-desktop.png`，可见外轨倾斜、紫星、flick贴图。HMR刷新后重新选EXPERT/透视/tick4000，手机尺寸390×844有23端点/3长条，scrollWidth390，截图`note-quad-mobile.png`。`note-quad-skin3-mobile.png`实际在刷新后的长轨页面，不作为横条透视证据。控制台无error/warn。以上仍是桌面Browser手机尺寸模拟，无原机对照。

## 第五批（2026-10-24）：长条绘图平面、网格与UV

输入 `4f68027c`。原生`RhythmGameManager.Init` 0x1afe6c4的初始化片段并不是拿出现端360计算纵横比：它取`GetPosFromLaneScaled(0,-.1)`与`(0,0)`的Y差，float32乘10再除相邻目标点X差176，`SetMetrics`把结果转成double存储，默认`coordinateModifyFactor=12.721426963806152`。临时探针曾以整个画布高度估计此系数，已纠正；那个探针不作验收依据。当前producer直接执行原生Init片段和SetMetrics，target锚点由已绑定的IPA合同提供。

`HoldMesh.GetLaneModifytimePosFromLane`返回`(float32(lane),float32(factor*normalizedTime))`；`GetV3PosFromLaneModifytimePos`再除factor调用原生坐标函数，Z加500并按受控屏幕尺寸夹取。长条radius来自`NoteDrawManager..cctor`的BaseHalfSizeSmall=64，在`HoldMesh.Create`减20得到44；parts中的半宽为float32(radius/laneWidth×1.5×noteDrawScale)，默认半轨宽.375。它不是音符贴图宽的.72。此处是默认设置绑定，不宣称玩家调试设置均为默认值。

新证据`decompiled15/HoldMesh.Continuation.c`补出了旧Ghidra方法体遗漏的0x21d1004续体：CreatePoints循环递减节点索引，先远端再近端，并包含按压、lastTouch及已判定middle的分支。受控探针最初按RAW顺序提供点时会使ClampY上下界颠倒；已改用原生逆序，旧`native-hold-parts-cases.json`仅为失败调查，不能作为期望fixture。

`UpdateFromGameHoldCreatePartsList` 0x21d1610及`UpdateFromGameHoldCreateMesh` 0x21d255c均受控执行，资源/settings/List容器/标量helper/Mesh提交为显式stub，parts、长度归一化、Vector2归一化/长度、位置和mesh主体执行ARM64。36组覆盖直线、斜线、多折点、短条、重复点、分数轨道、正时间过线、三个尺寸设置，共22,650个顶点；`SongTrackNativeHoldGeometry.js`与verifier共用，顶点、UV、三角形索引全部一致，顶点最大误差0。fixture以明确命名的Float32LE/Uint32LE base64存完整数组，不是JS生成的镜像期望值。原生同点判别使用各轴严格小于2的阈值，细分使用变换平面距离和.1，不再用span/32。

主体V为`float32(.25+.5*路径累计长度比例)`，不是tick比例；端帽采用边界V。三皮肤hold_line的200×200 packed rect、Atlas实际尺寸及PNG hash由IPA重读。`CreateMaterial` 0x20b6e88→`UtilOhashi.SetSourceRect` 0x237d1b8把Sprite rect转换成材质texture offset/scale，所以裁切后的PNG可使用局部0–1 UV；不是把整个Atlas当成200像素贴图。相关反编译保存在`decompiled16/17`。

运行时移除最后两个截图几何消费者148和.72。图形消费同一个native mesh：正常使用`ArchiveSongHoldMeshPreview.vue`的轻量WebGL层传入原生x/y、UV、indices，避免密集SVG clip边缘叠色横纹；SVG适配仅在WebGL不可用时作为退路，按需生成。这个Web层没有恢复Unity原shader、GPU深度合成、matForDraw、按压粒子，也没有把当前Web canvas尺寸当成原机分辨率。

**裁切边界仍开放**：预览继续显示当前cursor至各音符读取窗口内的未来部分，再逆序提供给已核实的网格函数；这是Web预览规则，未宣称重建原生按压/lastTouch/已删除middle状态机。边界lane改按分段BPM秒数插值，不能在跨BPM片段继续按tick线性算lane。中间poly节点目前仍由旧展示函数提供；下面的生成与判定只读续查还没有升级它的证据等级。

Producer `scripts/audit-song-track-native-hold-geometry.py`重读绑定ELF/IPA；小型runtime配置含方法窗口hash、默认metrics、Sprite绑定与边界，完整原生数组只进fixture。`verify-song-track-native-hold-geometry.mjs`拒绝旧148×.72宽、32次细分、按节点序号分配UV的实际模块变异；验证共享消费函数及跨BPM裁切lane。244档/732窗口覆盖233,066个fallback贴图三角形，有限性及Uint16索引范围通过。其余native timing/projection/note geometry、note rendering、chart timing/presentation回归通过。

## 中间节点与flick只读续查（尚未接入）

`EventNoteData.GetChildHoldMiddleNotes` 0x1f46e3c确有Skip(1)/Take(polyCount-2)链，`NoteScrObj`先筛VariableHold再调用它。lambda0x1c33724复制父对象，tick加subtick，type=HOLD_MIDDLE(10)、endtype=-1、duration=0、start/end=poly.posx，并设置parentId；后续CalcAbsoluteTime还会按子对象tick计算时刻。此为索引排除端点，不能未经全库核查便等同于当前`0<subtick<duration`过滤。

`CheckHoldMiddle` 0x2429350需要激活/未删除的middle对象、IsOnTarget与IsLaneHolded，成功后以maxEvaluation经技能修正更新分数/生命、删除音符并触发效果。仅知道poly位置不等于恢复了判定、容差或状态。`GetEffectPointInfoByNoteSerialNo` 0x2423f08及`NoteEffectManager` lambda0x20b967c证明flick效果另走效果时钟、lane、PointInfo和scale链；当前静态提示仍未按这条链复现。

第五批验收补记：`build:check`17.44秒通过，仍仅`.analysis/build-check`且无public复制，保留既有背景未解析/大chunk warning。producer再次不带--write重读ELF/IPA/36组结果一致。当前5231/PID67724仍为本worktreeVite。真实应用桌面1440×900：Café Parade EXPERT tick4000有23端点、3条长条、510个canvas顶点，截图`hold-native-desktop.png`；实际播放从2.40推进到14.98秒，主动暂停，未记成全曲长稳。K.now O.nly EXPERT tick123406可见多折点，桌面截图`hold-native-bends-desktop.png`；手机尺寸390×844切横条皮肤后有3长条/1144顶点/4个旧展示middle，scrollWidth390，截图`hold-native-bends-mobile.png`。首次resize截图尚为旧帧，已按实际新viewport重新截图覆盖。冷刷新后长轨图加载，重新选EXPERT/透视及同tick后canvas重新创建并仍为3/1144；返回URL为`/songs/knwonl/`，控制台无error/warn，已恢复viewport。此为桌面Browser模拟手机尺寸，不是真机，也未做原机GPU逐帧对照。WebGL不可用时的SVG退路未做浏览器故障注入验收。
