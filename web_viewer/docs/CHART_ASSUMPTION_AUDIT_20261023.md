# 谱面假设审计与原生链路核对

日期：2026-10-23。输入 `origin/master` / `2bdd3de44582ef3ce79cad1ec8c014f38118a6d9`；分支 `chart/20261023-native-projection`，LF worktree `E:/Web_build/GS_Archive_Domain_Work/chart-native-projection-20261023`。先建立台账，未修改运行时代码。范围仅谱面预览及其来源核查；无舞台修改、R2 上传或部署。

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

## 投影续查（尚未接入）

原生`RhythmGameNoteManager.GetPosFromLane`实际为Vector4的HFA返回：s0=x、s1=y、s2=z、s3=scale。普通Ghidra伪签名只显示float并遗漏其余分量，不能照伪C签名直接改Web。已补ARM64指令导出`instructions.txt`及受控执行`native-projection-cases.json`（90例，Math.Min/Mathf.Lerp与settings读取用明确的标量stub，主体使用原生指令）。

它的纵向曲线不是当前depthRatio=2：t=min(1+noteTime,1.2)，两条有理函数混合，含21/(-400t+420)-.05及5/(-16t+20)-.25；scale使用float32(21/880)。z则是200→100、t/1.5的夹取插值。以上仍需连同真实绘制矩阵及目标点坐标消费，不能只靠这90例宣称原机投影完成。

UnityPy直接读取IPA序列化场景level4：PreCamera为orthographic，FOV60并非其有效透视控制量。LanePanel1/2/3与TimingAdjust的Base anchoredY均为-212，Target1/5 anchoredX为-352/+352；LanePanel1另有Mask -4与Target约+4的抵消。Canvas序列化localScale为0，由运行时Canvas布局恢复，不能按静态transform直接乘成零。证据在`serialized-scene-level4.json`、`serialized-target-chains.json`、`serialized-resource-lane-panels.json`。当前相机/位置曲线/尺寸/hold/flick估计值仍未升级为原生。
