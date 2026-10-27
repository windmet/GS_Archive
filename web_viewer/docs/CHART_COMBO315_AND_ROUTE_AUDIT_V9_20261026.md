# Combo 边界、315 特效及现有线路交接 V9

输入分支 `chart/20261024-autoplay-timeline` / `58304615`。工作目录 `E:/Web_build/GS_Archive_Domain_Work/chart-native-projection-20261023/web_viewer`；继续同端口5231、同 `rm-release-20261022` candidate，未部署。用户要求先修 Combo 裁切并接315，再盘清现有线路，而非把评分/技能模拟扩成新的游戏系统。

## 本批来源和实现

来源仍是固定IPA data SHA `fb28e28793e4f9d21e76dd96be2c776a71382cb607d98acd24f65f20bed8018a`、Android ELF SHA `9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e`。

- ComboPanel93940 → UIBackPanel99224 → UIBackCanvas104753；CanvasScaler127212的referenceResolution为1280×720。`DisplayAdjuster.Update` 0x235aecc在尺寸变化时调用 `ScreenUtil.AdjustCanvasScaler` 0x1eab880；后者结合比例与 `CalculateUILayoutScale` 0x1eab924调整参考分辨率，原生另有 `SetSafeArea` 0x1eab9d4。不能只复制根锚点(480,-116)，就声称已还原完整屏幕适配。
- 原生 `ComboPanel.Disp` 0x1e26114按有效数字数加一个字样槽，设置Content宽度；数字/字样只对Base做1→1.2→1弹跳，426×4下划线为独立兄弟节点。此前字样最大弹跳范围可越过1280右边界，下划线本身也延伸到画布外。
- Web适配明确采用16逻辑单位右边距，为最多4位数字和字样的1.2倍峰值预留空间，固定根X约1051.6避免每帧跳位；保留来源子布局。下划线保留原图并适配可用宽度，不把容器overflow设为visible而向控制台外溢。这是有意的有界SVG适配，不称为复现所有设备的原生SafeArea算法。
- 原生 `ComboPanel.Set` 0x1e26004在值等于0x13b（315）时调用Show315Effect；状态机 `MoveNext` 0x1b9b990启用序列化对象、Delay(1000)、关闭对象。producer保存这两个方法窗口的SHA。
- 来源 `fx_in_315combo` GO23386 / Transform40734，位置(-5,0,0)、缩放80；六个系统为flash(47890)、glitter(48598)、speedline2(47915)、ring(48667)、logo_315_2(47490)、logo_315(49444)。提取三个原Texture：355-logo_315_2、483-logo_315、425-315combo，共40880字节。每个保存来源/输出SHA、UV、burst、颜色/尺寸/速度与限制模块、renderer排序、material shader blend；未制作替代logo。
- 315复用既有确定性粒子采样器，新增显式UI正交投影分支，不套音符轨道透视。SVG消费者按来源排序分别使用普通透明或加色混合，正文计数照常继续增长。继续使用“Combo 提示动画”开关，与Auto特效和声音套装独立。
- 315时刻取共享事件表第315个事件，避免同刻314→316跳过里程碑；一秒窗口使用调整后的谱面媒体时间，暂停冻结。seek到窗口内恢复对应年龄，离开即消失；不补播声音。seek恢复属于预览适配，不等同于原生真实触摸计数回放。原生UniTask的墙钟等待在Web中按媒体时间处理，以服从既有暂停/seek合同。

## 现有线路清单

“命中特效”“技能演出”“特殊演出后控制”不是同一个枚举或资源池。下表是当前源码与本地来源核对结果，不是线上发布状态。

| 线路 | 当前消费者 / 来源 | 当前闭合程度 | 后续缺口 |
| --- | --- | --- | --- |
| 谱面解析、BPM、配速、head/middle/tail、透视/长轨 | SongChartTiming、SongNotePresentation、SongTrackPresentation；native timing/geometry fixtures | 已接入；既有244档数据和ARM64几何回归 | 不等于原机GPU逐帧画面 |
| 三方向flick盘、箭头运动、blur、长条连接 | SongFlickMotion、SongTrackNativeEffects、HoldMesh；[V8](CHART_FLICK_ALPHA_V8_20261025.md) | 已接入三方向UV/曲线/排序/混合 | Unity池相位、随机序列、billboard与设备色彩空间仍需同帧录屏 |
| 普通/flick/hold/P技能/Special命中反馈 | SongChartHitEffectSelection → HitEffectRenderer → HitEffectPreview；hitType独立于Evaluation | 默认资源已接；不是通用“SP文字”占位 | 完整原机粒子/GPU等价未验收；其他外观套装不能由默认集推定已接 |
| Auto字样与闪光 | sampleAutoEvaluationFrame → AutoEvaluationPreview | 原生三层曲线/混合已接 | 无Perfect/Great/Good/Bad触摸评价模拟，非本次必补项 |
| Combo普通/315 | ComboPresentation → ComboPreview；本批来源与窗口 | 本批补齐边界与315来源资源 | 不模拟断Combo判定或分数；315粒子随机仍为Web确定种子 |
| 普通打击音SE1/2/3/社长 | SongChartSoundPlayer；[音效审计](CHART_SOUND_RESOURCE_AUDIT_20261025.md)、[V6](CHART_LIFECYCLE_SOUND_V6_20261025.md) | 任意歌曲可选、独立音量、暂停/seek取消排程 | 仍缺共享hold循环、Special/loop和技能/观众/结果等cue；不能把15份Ogg说成全部声音 |
| 音符时机 | SongComboTiming → 轨道、效果、声音统一调整时间 | 原生±30刻度已接，媒体音频不偏移 | 未套未知MachineUtility设备校准值；需实机听感校准 |
| 舞台灯光/人物/布景等编舞 | src/core/stageCommandCoverage.js及各chibi消费者 | 是独立舞台线路，多数为partial/guarded，有来源与专项 | 当前chart_lab没有组合该舞台、编队和镜头；不能把舞台页局部支持写成谱面背景已还原 |
| 特殊演出后控制 After_Spappeal(1101) | 原生After_SpappealLiveEffectTypeExecuter / LiveObjectAfterSpAppeal；coverage明确missing | **未接**；RAW118条、涉及118编成，均为有时刻行 | 追value1→prefab列表选择，value2速度、value3等待毫秒、value4排序，以及simpleSpAppeal/skip分支和停止/恢复；不能用Special命中粒子代替 |
| SpecialNoteAppear/Disappear(1201/1202) | 原生各自PlayEffect 0x1da11d4 / 0x1da1258 | 本批反编译这两个Play方法均为return；当前RAW inventory没有对应指令 | 不能仅凭类名宣布漏画两套效果。Appear Preload与共同基类链仍待追；保留未闭合项 |
| SSR技能视频与白屏/语音 | SSRSkillMovieManager.Play 0x24375ac；已有卡片详情skillMovie视频入口 | 卡片详情可手动播放；**未接入谱面/技能时序** | 原生按UserCardData.id查预载字典、阻止重入、可选语音、WhiteInOut；先确定编队/卡片绑定、触发来源和暂停恢复，再连接已有视频资源 |
| Livechara_skill(107)与技能UI | 原生执行器、ProducerSkillPanel/SkillPanel/LiveCardSkillIcon；stage coverage明确missing | RAW7条、仅1编成；不能当常规谱面每曲必有 | 命名字段/触发语义/编队资源/声音/图标与收尾尚未闭合；先查线路，不启用随机技能模拟 |
| 全屏演出 Whole_screen(501) | stage Whole_screen注册partial，Type6 deferred | 舞台线路已部分接入 | 不能再把全族写成missing；查Type6及特殊演出与全屏/镜头的层级合成 |
| Finish(1001)、Unit_serif(903) | stage coverage明确missing | RAW分别114条/114编成、3条/2编成 | 结束控制/组合台词与声音、时钟、重播的衔接未接；播放器ended清场不代表原生Finish演出完成 |
| life/score/rank、触摸评分与完整结果 | ScorePanel等原生模块 | 预览不提供此游戏状态 | 非本批默认扩展范围；若将来增加，需先有判定/编队/计分合同，不能从演示计数推导 |

舞台数量来自本checkout `public/data/stage-command-inventory.json`（118编成），并与 `src/core/stageCommandCoverage.js` 注册核对。Native enum中存在类或方法，不代表RAW中一定出现。卡片视频与舞台能力是其他已存在入口，均未冒充chart_lab已消费。

## 下一批建议顺序

1. **先闭合After_Spappeal全链**：来源CSV行→value字段→prefab→开始/停止/skip→时间恢复，连同共用Special声音调用点。覆盖118编成的公共路径收益最大。
2. **补现有hold共享声音**：先查app_hold/app_hold_up的loop和取消语义；普通尾、滑尾与seek分别验证，复用现有WebAudio生命周期。
3. **梳理技能视频/人物技能指令**：复用卡片已有视频入口，但先补真实卡片与事件绑定；将“资源已在库”“单独能播”“谱面时序已接”分别登记。
4. **整理舞台合成与结束链**：After_Spappeal、Whole_screen Type6、Finish、Unit_serif一起核对层级和时钟；没有完成前不把背景还原率写成全部完成。
5. 最后用同曲、同配速、同帧年龄原录屏收束粒子/GPU与实机延迟。随机池相位等保留为证据缺口，不用新的手写动画填满。

以上第1～4项本批完成的是来源/消费者盘点和具体缺口，不声称已实施。审计反编译与小型回执在 `.analysis/chart-native/decompiled-display-v9`、`decompiled-special-v9`、`combo-ancestors-v9.json`；这些不是发布媒体包。

## 验收记录

- 专项：Combo verifier覆盖2/76/315/999/9999最大弹跳与横线边界、315同刻跨越/seek/一秒窗口、六系统/三贴图SHA与混合方式；hit-effect renderer、selection、flick、native effects回归通过，原有普通/hold几何与效果未改。
- 最终 `build:check`：3024 modules / 17.85秒，`combo315-v9-build-final.log`，不复制public，保留既有大chunk警告。其后仅验证页和审计内容调整。
- 宽窄边界：`combo315-v9-wide-bounds.json`、`combo315-v9-narrow-bounds.json`；9999、1.2倍峰值，SVG内数字字样和横线实际DOM边界通过；315预览默认宽与390×844均可见六个来源系统，无控制台error/warn。
- 最终两首组件整曲：cfprde816 / remasq695事件通过，`combo315-v9-browser.json`。315时刻分别47.25 / 64.5510204秒，seek到窗口内可见两个logo系统、暂停冻结、离开一秒窗口清场；原Auto、Combo开关、±时机、缓冲/seek/切难度/ended仍通过，暂停恢复粒子Canvas最大通道差≤1/255。
- 正式App：knwonl EX第315事件为tick66840、64.2692308秒；tick67048实测媒体64.469229秒、readyState4、计数已到316、315年龄约0.2秒，六系统均在SVG，开关关闭后Combo与315节点均为0。`combo315-v9-product.json/png`；数字字样与下划线实际边界均在正式App SVG内。计数继续增长时315效果短暂保留符合来源调用，不将图案出现时的316误写成计数错误。
- 真音频315窗口：首次采样 `combo315-v9-performance.json` 跨过时刻却捕获0个315观察帧，且5次rAF间隔>250ms，不能作为315实播通过回执。清除后台暂停的315画面并重载独立验证页后复测，`combo315-v9-performance-repeat.json`：46.25→66.197627秒，20.0272秒、1105次轨道更新、23个315可见观察帧，CPU median/P95 **9.2/15.5ms**、max113.6ms，5次rAF间隔>50ms、0次>250ms，无缓冲/焦点警告。首次异常成因未充分定位，不能只凭复测断定已解释或性能提升；rAF81.69Hz也不是GPU呈现帧率。仍需长帧/设备性能跟进。
- 验证页重复挂载时曾发生按钮未就绪的采样页错误，重载后执行有效复测；这是测试页失败，未算作产品或性能通过。最终正式App另冷刷新并实播64.47→70.329696秒，readyState4、Combo345，刷新后无新增error/warn，`combo315-v9-cold.json`。

服务已核对当前PID45716的5231绑定；本批新增3张小PNG时由原PID35204同配置重启至45716。原有 `config/resource-audit.json` 改动保留，不纳入本批提交。无master推送、PR合并或部署。
