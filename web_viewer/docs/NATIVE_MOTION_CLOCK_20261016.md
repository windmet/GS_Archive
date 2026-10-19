# 动作 BPM 时钟与原生混合配置

输入 `stage/20261014-native-fidelity` / `11e786c3`；工作树沿用 stage-native-fidelity-20261014，5212/PID61564。接续人物尺度批次，本批移除动作基础速度为1和队列默认混合.12秒两项旧假设。不是随机动作调度或全舞台复刻完成。

后续：[音频时钟批次](NATIVE_STAGE_AUDIO_CLOCK_20261016.md) 已接入本文最后一节记录的25ms映射缺口，并修复分声部播放中seek目标被暂停覆盖的问题。下方“本批保留”描述的是本BPM批次的历史边界。

## 原生链路与数据来源

本地已解密ELF `E:/Tools/ghidra_work/sidem/libil2cpp.decrypted.so` 的SHA256为 `9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e`。本批用既有Ghidra项目只读补反编译；方法窗口哈希、常量RVA和导出摘要保存在 `scripts/fixtures/chibi-native-motion-clock.json`。完整原始方法体留在 `.analysis/native-engine/motion-clock-chain` 和 `motion-clock-audio`，未提交反编译全库。

- `NoteScrObj.TicksToSec` 0x20bb600：每拍480 ticks，分段积分 `(tick-previous.tick)*60/(previous.tempo*480)`。ELF的double常量0x32d48d8=480，0x32d48d0=60。conductor的absTime从0开始，不加BGM_offset。
- `NoteManager.SetNoteObj` 0x20ba968在预备阶段设置首段tempo；`ConductorStep` 0x20bae50以 `currentTime >= absTime`切换。`SequencePlayer.Job`先更新NoteManager，再更新LiveEffectPlayer。
- `LiveObjectIdol.get_baseTimeScale` 0x221b270：单精度 `1.5 / ((60/curTempo)*4)`。`PlayMotionInner` 0x221c094及普通回调0x1bbe040将它乘CSV speed/1000，执行时赋值一次。tempo改变不持续修改已开始动作。
- `LiveIdolFactory.PrepareAsset` 0x1bb9780新建SkeletonDataAsset，只拷贝scale、文本与atlas；`CreateRuntimeInstance` 0x139c714、构造函数0x13a164c、`FillStateData` 0x139d204共同确认运行实例defaultMix为0、没有pair mix。普通回调给首段显式.15动画秒；队列后继为默认0，立即命令为0。

`prepare-live-chibi-motion-clock.py`直接读取当前60个RAW song bundle中精确命名的 `{songCode}_fumen`，保留conductor源顺序，拒绝不递增tick或非正BPM。小型 `public/data/stage-motion-clock.json`绑定118份编排的id、songCode、source、choreography全文SHA256以及每个RAW bundle/TextAsset哈希。没有重导或复制媒体。加载缺失或绑定不一致时启动失败，不回退成BPM160或倍率1。

当前21,860条显式动作指令中21,825条与旧speed-only结果不同。例如DRIVE A LIVE的140 BPM对应基础倍率.875；Reversed Masquerade在27秒由160变196，此前开始的动作仍保持旧倍率，之后执行的指令采用新倍率。

## 消费者修正

播放与seek共用相同的指令时间、单精度速度计算；暂停保存倍率，恢复与用户播放速度相乘，显式speed=0不再被 `|| 1`改写。恢复混合中的pose时，按 `.15/动作倍率`回溯所需前驱链，避免低BPM下只回看150歌曲毫秒。

默认mix改为0后，独立原生队列回归发现seek结尾额外调用 `Spine.update(0)`仍会执行AnimationState.update，并在队列边界提前消费下一段。修正为只刷新Pixi attachment，不在结尾再推进状态机；没有改oracle来容忍错误。独立单人预览的可选混合参数仍与原生命令入口分开。

## 验证

- RAW/ELF生成器 `--native-elf E:/Tools/ghidra_work/sidem/libil2cpp.decrypted.so --check`：60首/118份绑定及常量、方法、数据哈希一致。
- `verify-chibi-motion-clock.mjs --published-assets`：真实21,860条指令；tempo边界/负预备时间/锁存/0速度、缩放后的mix窗口、缺失/错hash/错身份/abort均通过。
- `verify-stage-intent.mjs`：66个受控协议/时序场景，含低BPM及切换tempo后play/seek一致性。
- `verify-chibi-native-motion-chain.mjs`：五种body、420个命令计划、35个pose样本，通过独立RAW队列oracle；不是原机视频逐帧验收。
- `npm run verify:source-batch`：144/144通过。`npm run build:check`：13.36s通过，仅固定 `.analysis/build-check`，copyPublicDir:false；既有大chunk提示。已恢复此次构建生成的无关审计/翻译元数据。

使用Browser控制入口cua_repl，`http://127.0.0.1:5212/?maintainer=1&view=chibi_stage`冷加载，1440×900与390×844。没有用独立Playwright进程替代。5212继续消费 `rm-native-relations-20261013`；未部署或重启端口。

| 交互 | 观察 |
| --- | --- |
| DRIVE初始五人 | BPM140；五个活动位倍率.875，5/5就绪 |
| 切Reversed Masquerade、拖至27秒 | BPM196；此前动作仍为1，符合一次锁存 |
| 从27秒实际播放、暂停 | 时间推进到40.1秒并暂停；新指令倍率含196 BPM与CSV倍率，五人仍就绪 |
| 回开头、切FLASH LIGHT、拖至15秒 | 4/4就绪，BPM108，活动位动作倍率约.945、dance→loop队列；切歌后第五位不在当前编排，不能将其保留的诊断当成活动人物 |
| FLASH手机尺寸 | canvas381×214，document.scrollWidth=390；舞台、四人、时间轴与歌曲控制可见，无横向溢出 |
| 切スマイル・エンゲージ、拖至2秒、复位、返回 | BPM90，初始wait仍使用156 BPM时锁存的倍率；返回实际加载Beit歌曲详情/试听/谱面表，非loading壳 |

页面身份、非空、无框架错误覆盖层、交互与截图通过；控制台无应用error，保留两条既有Spine tint/update warning。截图 `native-motion-remasq.png`、`native-motion-flash-mobile.png`及console JSON在当前任务visualizations目录。Browser服务本身另报Statsig 403，未作为localhost错误，也没有绕过该服务限制。临时viewport已恢复。

## 已查明但本批保留的缺口

`LiveSoundDirector.Init` 0x1f26d0c将fumen的BGM_offset写入+0x78，设备soundDelay写入+0x70；`UpdateCurrentTime` 0x1f27cb4计算 `liveSeconds = bgmOffset + (audioMilliseconds-soundDelay)/1000`，`SequencePlayer.UpdateCurrentTime` 0x1e01b7c使用此共同时间。当前60首只有smlegg的offset非零，为+.025秒。

Web现有音频→stageTime仍直接相等，故smlegg仍有25ms映射缺口。新数据记录该offset但本批没有接入transport；不能说音频/舞台全链已原生对齐。下一批需统一官方音频、分声部、seek、暂停、结束边界；Web无旧设备校准，不应臆造soundDelay。不要把BGM_offset加到conductor积分中补偿。

普通动作随机延迟0..50ms及持续随机调度仍未还原。本批按CSV命令时间锁存BPM，未宣称随机回调跨tempo边界时与原机逐帧相同。旧悬灯曲名守卫、syksai第四层排序、Logo选择及缺消费者仍见审计表。
