# 谱面效果音资源与套装审计

输入 `chart/20261024-autoplay-timeline` / `cdc0cc84`，工作目录 `E:/Web_build/GS_Archive_Domain_Work/chart-native-projection-20261023/web_viewer`。本批只查来源与接线条件，不修改播放器，不部署或发布媒体。

## 结论

绑定的2.6.10客户端有 **3套常规可选打击音（SE1/SE2/SE3）＋1套愚人节歌曲覆盖音**，不是只有普通和社长两套。常规套装只替换部分打击音，不是每套都复制全部Live音效。没有在这条选择链或本IPA的SE目录中发现第4套常规打击音。

`LiveTapSeData..cctor 0x1f2d674` 创建3条记录：id1/name SE1、id2/name SE2、id3/name SE3；名称通过绑定Android metadata的StringLiteral usage反解，不是人为命名。`LiveSettingsData..ctor 0x1c1b6e0` 将 `liveTapSeId (+0x54)` 默认置1。声音设置的 TapSeListContainer 可试播所选id的 TapPerfect(2) 和 Flick(4)。这里的id独立于命中特效四套、静态flick提示两套与音符皮肤。

## 原生文件映射

`NativeSoundManager..cctor 0x1f82170` 按NativeSE枚举顺序构建3×7列表，`GetFileName 0x1f814d4` 使用 `seType-1` 取套装。映射如下；均为 `Payload/BNEI0395.app/Data/Raw/SE/` 中的WAV，省略扩展名。

| NativeSE | SE1 | SE2 | SE3 | 愚人节实际使用 |
| --- | --- | --- | --- | --- |
| 0 Tap / 3 AirTap | air_tap_t01 | 同SE1 | 同SE1 | air_tap_t01 |
| 1 TapGoodOrGreat | rhy_tap_great_good_t01 | rhy_tap_great_good_t02 | rhy_tap_great_good_t03 | _om2fby |
| 2 TapPerfect | rhy_tap_t01 | rhy_tap_t02 | rhy_tap_t03 | _8wtdoh |
| 4 Flick / 5 FlickPerfect | app_flick_t01 | app_flick_t02 | app_flick_t03 | _sidrgf |
| 6 PSkillTap | rhy_pskill | 同SE1 | 同SE1 | _8bbk33 |

所以三套常规各有3种独立音色（Perfect、Great/Good、flick）；空击和P技能打击音共用。Flick和FlickPerfect是两个触发枚举，但指向同一文件，不应当计成两种资源。

`get_afSeFileNameList 0x1f812dc` 构建愚人节7项覆盖表。IPA另含4个可读别名，逐字节SHA256一致：

| 运行名 | 同内容的可读文件名 | SHA256 |
| --- | --- | --- |
| _8wtdoh.wav | af_rhy_tap_01.wav | 30e301a2bad3c936be04c986c75dccb354d5fa39efbcfdf1f7129e5b658ff07c |
| _om2fby.wav | af_rhy_tap_great_good_01.wav | a56db80119bd02818e27bdff52b4cc4c620b686744dbc439d6441285ad23e647 |
| _sidrgf.wav | af_app_flick_01.wav | 5f619d70f83d85e487ac019e54b6a2e78266ef40e4b0724ac4b1bfe3afd6108e |
| _8bbk33.wav | af_rhy_pskill_01.wav | 139b4a042002558846ec87a723a90356227337946628d62fe1377ab2f690eca4 |

19个WAV文件去除4组别名后是 **15份独立内容**：常规9份、共用2份、愚人节4份。本批全部读取并用Python wave解析通过，都是48kHz、双声道、16bit PCM。SE2 Perfect约1.213秒/flick约1.228秒，SE1 Perfect约2秒/flick约1.915秒，SE3 Perfect约2秒/flick约2.333秒；文件时长含尾音，不能拿它当判定间隔。

## 触发条件与其他效果音

- `LiveSoundDirector.Init 0x1f26d0c` 把保存的liveTapSeId与 `songData.isAprilFoolsSong` 交给 NativeSoundManager.Init。`SongData.get_isAprilFoolsSong 0x25cb278` 比较歌曲id与 `BasicMasterData.aprilfoolsSongId`。这是歌曲身份覆盖，不是根据设备日期是否4月1日，也不是独立的第4个用户设置选项。当前审计未继续重提取BasicMasterData的值，不把此getter单独说成已执行验证的drv999字符串绑定。
- `PlaySE 0x1f28918` 将Perfect、Great/Good、空击、滑键、P技能打击分派到 NativeSE；`PlayTouchSeCriOrNative 0x1f28808` 调用 NativeSoundManager.Play，非Editor即返回。Editor另走 `se_rhythm` ACB。**因此不能只抽 se_rhythm.acb，就认为拿到了设备运行时的三套打击音。**
- `EvaluationExtensions.GetTapSE 0x1fadc04` 对愚人节LARGE类型返回PSkillTap，对Special类型返回None；之后才处理Auto/评价分支。普通Auto选Perfect，滑键Auto选FlickPerfect。尚未执行整套调用链/同刻抑制/AudioPlayer native plugin，不把这些反编译分支写成端到端发声验收。
- hold/可变hold走 `app_hold` / `app_hold_up`（PlayHoldSE 0x1f286dc）；Special及loop、技能、评价快慢、断combo、暂停、结果与观众呼喊属于其他共享音效，不随上述三套WAV列表整体更换。
- RAW `audio/se_rhythm.acb` 的UTF CueNameTable有21个cue，已有vgmstream inventory列出23个音频stream，二者不可混作套装数。除基础cue外还含 `app_special_999`、`app_skill_sr`、`app_skill_ssr`、`app_skill_cutin_end`、`restart_count01/02`。这些是附加cue，不是新增常规打击音套装；尤其 `app_special_999` 的准确调用点本批未闭合，不能仅按名字推定其触发或等同于4份愚人节WAV。

## 接线交接

当前谱面预览消费歌曲音频与视觉事件，尚无这15份原生WAV的打击音消费者。本次不擅自加播放行为。后续接线应先做：

1. 为3套常规＋愚人节覆盖建立有来源的manifest；共用资源只存一份。保留设置选择与歌曲覆盖的区别。
2. 沿既有媒体时间事件表调度短音效，暂停/seek/回退时取消旧调度；另外核查同tick打击抑制（SupressSameTimingTapSE）、音量开关和hold循环启停。不要每帧new Audio。
3. 明确自动演示是否播放打击音的产品约定，并验证原生输入模式、Auto与歌曲分支，不用视觉效果数量直接驱动声音次数。
4. 区分WAV打击与ACB多声部/loop cue；为 `app_special_999` 继续追调用点。需实际听感和Browser播放验收后，才能称音效接线通过。

## 本地证据及验证边界

- ELF SHA256 `9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e`；Android metadata SHA256 `dc257cb9aaa706915fad7635acce8f0977c0416372b985e763825f5990461184`，与前批原生证据一致。
- Ghidra只读项目重反编译到 `.analysis/chart-native/decompiled-sound/`，另有 `decompiled-sound-song/`；`sound-targets.tsv` / `sound-decompile.log` 记录目标；`sound-source-inventory.json` 保存StringLiteral反解、IPA路径/大小/逐文件hash。
- `.analysis/chart-native/sound-preview/` 保存19个小型来源WAV及 `wave-info.json`，只用于本地检查，未拷贝到public、未上传R2。此处不是全量SideM媒体包。
- 21个cue直接重新解析现有RAW ACB的UTF表；23个stream来自既有cue-index，未本批重新解码。没有进行人耳听感描述、真机播放、浏览器效果音验收或Unicorn音频链执行；不据文件命名猜“木鱼/电子/拍手”等音色。
- 本批仅文档，核对映射/来源/链接及git diff；不跑应用构建。原有 `config/resource-audit.json` 差异保留，不提交。
