# 音频与原生舞台时钟映射

输入 `stage/20261014-native-fidelity` / `46624091`。接续 [动作BPM批次](NATIVE_MOTION_CLOCK_20261016.md) 已查明的25ms缺口；本批统一音频传输接线，不修改曲谱conductor、CSV时间或共享媒体。

## 依据与时钟边界

上一批的同一ELF、方法哈希fixture及本地只读反编译仍为输入。`LiveSoundDirector.Init` 0x1f26d0c把fumen的BGM_offset按float读取后转double；`UpdateCurrentTime` 0x1f27cb4计算 `liveSeconds = bgmOffset + (audioMilliseconds-deviceSoundDelay)/1000`。`SequencePlayer.UpdateCurrentTime` 0x1e01b7c把这个时间提供给舞台与NoteManager。不能反过来把offset加到conductor积分上。

60首当前RAW曲谱只有smlegg的offset非零，JSON值.025、原生float转double后的毫秒值 `25.00000037252903`。Web没有旧设备的soundDelay校准，使用0；这不是推断原机的设备延迟也为0。

`chibiMotionClock.js`提供共同换算：音频秒→native舞台毫秒，加offset；native舞台毫秒→音频秒，减offset。音频不支持负采样位置，seek下限为0。归零暂停仍显示舞台0；开始播放时规范到最早可播放的native时刻，smlegg对应25ms。这是现有资料播放器从音频开始的入口，不新增原作游戏的负时间准备流程。其他59首offset=0，保持原入口。

## 消费者闭环

- 官方HTMLAudio与分声部AudioContext的frame、暂停取样、seek和恢复均使用共同换算；无音频时保留舞台自身时钟，不制造一个假音频时钟。
- 分声部session消费音频时间，配置前将CSV演唱切换时间减去offset；保留负切换点，确保音频开头的先前演唱状态可被正确选中。共享session本身无需改语义。
- 只有媒体duration换算为native终点；CSV/lipSync原有native终点不再加一次offset。暂停采样夹在舞台范围内，不在曲末越界。
- 播放中seek先保存用户目标，再暂停。旧分声部暂停会刷新其currentTime，过去会因此覆盖刚拖出的stageTime；现在恢复目标后再换算与重建pose。官方音频暂停也保存最新media时钟，而非上一帧的旧舞台时间。
- Browser实际播放DRIVE到曲末时发现另一个旧边界：解码音频终点略早于索引中的舞台终点，AudioContext时钟在终点冻结，舞台永远到不了最大时间。现在根据音源实际ended状态进入无声尾段，用帧间时间推进剩余CSV；尾段暂停保留舞台时间，恢复时不重播音频开头。没有人为毫秒容差。官方Audio也用实际ended状态；原生负时间准备、浏览器音频输出延迟不在此修正内。

## 验证

`verify-chibi-motion-clock.mjs --published-assets`直接执行实际SFC的 `syncStagePlaybackTime`、`updateStage`、`stopStage`和 `seekStage`。独立证据：native1秒对应media约.975秒；media1秒对应native约1.025秒。覆盖官方/分声部、播放中拖动目标不被覆盖、复位、曲末夹限、演唱切换时间、媒体与CSV终点边界。保留原有RAW绑定、21,860条动作速度、错误输入/身份/hash/abort回归。

`verify-stage-intent.mjs`的68个时序/取消场景通过，新增官方/分声部尾段恢复不重播音频。实际SFC时钟回归还覆盖音频冻结后的尾段推进、变速、暂停保留和自动停止。旧 `verify-song-experimental-audio.mjs` 曾因硬编码 `currentTime*1000`报失败；已改为要求原生换算与演唱门控接线，定向复验通过，未删除该门禁。

`npm run build:check`通过，固定 `.analysis/build-check`，copyPublicDir:false，有既有大chunk提示；恢复此次生成的无关翻译/资源审计元数据。没有完整媒体包构建、部署或端口重启。首次14.41s构建之后，因Browser发现曲末冻结而新增上述修正并重新编译；不是将首次编译结果当成修复后的验收。

最终源码批次 `npm run verify:source-batch` 144/144通过；最终构建14.08s通过。修复中途的一次时钟测试预期计算错误已纠正（先前速度已设为.5，16ms应推进8ms），最终测试独立验证该倍率下的官方/分声部尾段，不放宽误差。

## 5212 Browser

复用PID61564、stage工作树Vite、`rm-native-relations-20261013`；使用cua_repl的In-app Browser，未改用独立Playwright。构建元数据恢复后新标签页冷加载smlegg舞台。桌面1440×900、手机模拟390×844。

| 旅程 | 实际观察 |
| --- | --- |
| smlegg初始、拖至1秒、播放、暂停 | 3/3就绪；offset诊断25.00000037252903；从1秒实际推进至21.9秒后暂停 |
| smlegg暂停拖回7秒、手机尺寸、复位 | 目标7000ms、tempo90；人物/舞台/控制有渲染；scrollWidth=390；复位归0 |
| 切DRIVE、开启按编成偶像演唱 | 5/5就绪、5个已解码声部、vocalReady=true、offset0；实际播放 |
| DRIVE分声部播放中从约30.9秒拖至90秒 | 正确暂停在90000ms，没有被旧音频时钟覆盖；从90秒恢复后时间推进 |
| 最终冷页DRIVE分声部从129秒播放 | 5个声部就绪；越过实际音频终点后自动暂停在舞台曲末，未再卡在“播放中”；随后复位归0 |
| 返回歌曲 | `/songs/drvalv/?maintainer=1`，title为DRIVE A LIVE · GS Archive；试听、制作信息、难度表实际加载，无残留song/stage查询 |

截图保存在当前任务visualizations目录的 `native-audio-*`。这些截图与交互证明运行流程、接线与布局；精确25ms数值关系由实际SFC受控回归证明，不用肉眼截图声称25ms同步精度。smlegg没有当前五人分声部资源；非零offset的分声部映射由实际函数回归覆盖，Browser只对可用DRIVE资源做零offset实播。

最终曲末截图 `native-audio-drive-ended.png`为1280×720冷页，前面的smlegg桌面与手机截图分别为1440×900、390×844。最终冷页无应用error、两条既有Spine tint/update warning，console保存在 `native-audio-final-console.json`；返回歌曲后仍无error。修复期间HMR重载的页面不作为最终停止结果。曾手输错误的DRIVE版本后收到预期的不可用提示，随后从歌曲详情入口取得真实 `drvalv_live_effect` URL，最终使用该URL冷加载验收。临时viewport已恢复。

普通动作的随机0..50ms回调、持续随机调度仍未还原。下一步沿该状态机排查，旧悬灯、祝彩排序、Logo与缺家族仍保留审计边界。
