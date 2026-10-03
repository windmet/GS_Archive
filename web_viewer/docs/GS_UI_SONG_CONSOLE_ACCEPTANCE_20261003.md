# GS 歌曲控制台验收（2026-10-03）

本批承接用户选择的 Compact，以及歌曲内部的头部去重、横向模式选择和音乐控制排列建议。范围为五个既有消费者 / 组件与两项必要回归；沿用[UI 宪章](GS_UI_CONSTITUTION.md)和[前一批 Compact 列表验收](GS_UI_COMPACT_LIST_ACCEPTANCE_20261003.md)。

**状态：本批源码 / SFC回归、code-only构建与代表样本的实际Browser验收已完成；两个代码批已分别提交 / push。原生音频与WebAudio进度、资源HTTP、布局证据分别记录，不扩展为听觉一致性或长稳结论。**

## Before / After / Why

| 消费者 / 样本 | Before：实际 Browser 或明确来源 | After：实际 Browser结果 / 明确源码边界 | Why / 保留的职责 |
| --- | --- | --- | --- |
| `ArchiveSongDetail.vue`；DRIVE A LIVE，320 / 780px | 320px头部272.00px，统计grid129.83px；“分轨演唱”出现在badge和grid，“试听：可试听”另占区域。DRIVE A LIVE标题22px、宽169.31px，实际单行，不能把外部折行截图记成本地已复现。780px头部426.26px，封面与标题纵向堆叠。 | 320px头部134.59px，标题20px单行；统计grid删除，形态一次，日期2021-10-06并入12px metadata。780 / 820 / 1280px头部237.86px，封面与标题并排；badge横跨内容宽度，无页面溢出。 | 减少重复说明，保留完整曲名和真实日期。源码优先历史日期；缺日期与缺播放投影仍有明确fallback，相关缺项仅SFC覆盖。 |
| `ArchiveSongDetail.vue`；The 1st Movement，320 / 780px | 320px长标题169.31×123.16px，头部383.57px，完整混音重复；780px标题单行，头部426.26px。两尺寸均无页面横向溢出。 | 320px头部209.78px，20px标题173.30×83.99px、3行完整；780px头部237.86px、标题2行，与封面并排。属性Intelligent、完整混音各一次。`drv999`真实特殊badge、2022-04-01日期及parent返回通过。 | 以完整身份与自然换行适应窄屏，不强制所有长曲名单行。属性使用原值，Intelli仅本消费者显示为Intelligent；Physical / Mental及未知边界仍只SFC / 源码覆盖。 |
| `ArchiveSongExperimentalPlayer.vue`；DRIVE A LIVE四模式 | 320px各按钮57.12×70.24px、white-space:normal，已有挤压换字；780px各125.06×43.99px正常。 | 四按钮均43.99px高、nowrap、自然宽度；320px实际点击第四项并自动横滚，四模式可切换。组合选Altessimo、五槽选029ass及第五槽空位、收录特殊轨均通过。 | 横向阅读与点击保留原四模式语义；原模式 / 加载保护、选择处理与音轨身份不改。 |
| `ArchiveMediaTransport.vue`；共享控制 | Before音乐采用文字播放按钮与归零按钮；DRIVE 320px控件区93.31px，长名单轨98.83px；VoiceRow也消费原共享组件。 | 音乐进度在上、播放圆按钮56×56px、归零44×44px；控件区150.24px，为进度与图形操作留出空间。默认false的`music`保留原分支；次郎卡9个default transport均无music类、原“播放”按钮44px。 | 只排列已有能力，头部 / 模式的高度减少与操作区增高分别记录。default的label、loading、slot、ready、duration与emit保留，不新增循环 / 随机按钮。 |
| `ArchiveSongSinglePlayer.vue` / `ArchiveSongLineupPlayer.vue` | 单轨长名Before见上述测量；Lineup本轮无独立Before布局测量，五槽及混音职责来自现有源码。 | 两者仅启用`music`。长名单轨原生audio播放到89.73 / 121.739s、暂停 / seek / 归零通过；音量slot可展开、range键盘值0.99。五槽实际进度30.76s、UI暂停态，029ass与空槽状态可见且无横向溢出。 | 音轨、clock / session、音量、五槽静音、歌唱事件与handoff源码合同不改；音量UI值不证明实际audio.volume读数。Single的seek(0)与Experimental / Lineup原归零语义分别保留。 |

Before为旧预览`5202` / PID53252，已保留[旧构建输入](../.analysis/ui-song-console-20261003/before-build-input.json)与[旧RAM pin](../.analysis/ui-song-console-20261003/before-pinned-code.json)；main `index-_6Qok3fM.js` SHA `d3d14357f9ac1c417a3ba08ce9476b809dc2d5ffadeeb4147b796a369f916113`。真实测量：[DRIVE 320](../.analysis/ui-song-console-20261003/drive-before-320.json)、[780](../.analysis/ui-song-console-20261003/drive-before-780.json)、[长名单轨320](../.analysis/ui-song-console-20261003/long-before-320.json)、[780](../.analysis/ui-song-console-20261003/long-before-780.json)。同目录jpg为实际截图；旧页面身份与新构建SHA分开记录。

## 已完成的回归

| 命令 / 证据 | 已通过的范围 | 不能证明 |
| --- | --- | --- |
| `node --experimental-vm-modules scripts/verify-song-detail-presentation.mjs` | 真实SFC内存渲染：四种已知属性、实际full-mix / experiment / unavailable投影，形态一次、原日期与特殊版parent；既有语言 / 身份、不可变来源、声部延迟挂载及mount-before-restore。缺属性 / 日期为明确标注的真实投影衍生fixture。 | 不解码音频、不检验像素、原生disclosure或Browser焦点可见性。当前目录所有属性与gameplay history均已解析，不能把fallback fixture算成实际缺失语料。 |
| `node --experimental-vm-modules scripts/verify-song-music-transport.mjs` | 真实SFC内存渲染：default / music的label、ARIA、ready / playing / loading、已知与六种未知 / 非法duration、toggle / restart / numeric seek、时间与slot；真实VoiceRow默认及响应式label保留。 | 手动调用handler只证明emit合同，不能证明原生禁用阻止点击、range键盘操作或播放媒体。 |
| `node scripts/verify-song-archive-view-restoration.mjs` | 歌曲异步owner、共享恢复与过期 / 取消守卫通过。 | 返回旅程、实际scroll / focus需Browser单独检验。 |
| `node scripts/verify-song-experimental-audio.mjs` / `node scripts/verify-song-stage-handoff.mjs` | 实验音频与五槽handoff合同通过，保留空槽、重复偶像、gain、归零及身份不匹配拒绝。 | 合同命令没有`--mounted`；不能替代后述实际HTTP / 音频进度，也不证明Chibi视觉旅程。 |
| `node --experimental-vm-modules scripts/verify-terminal-idol-localization.mjs` | 42个真实SFC render场景通过，保留终端 / 卡片 / 歌手 / Solo / Lineup等身份、双语、来源与回退合同。 | SSR不证明新音乐控制DOM排列、pin的read-model字节或播放。 |

六项命令均exit0，见[回归与完整性收据](../.analysis/ui-song-console-20261003/verification-receipt.json)；两个新增 / 扩展脚本的`node --check`与`git diff --check`通过。运行结果与实际媒体验收分开记录。

## 构建、冻结与资源

[构建输入](../.analysis/ui-song-console-20261003/build-input.json)记录2026-10-03 14:35:21 +08:00、HEAD `6ad0ab0d8904f45bab8138f2dede688a31bb57f5`、分支`codex/chibi-stage-reconstruction-20261002`；包含上述五个消费者 / 组件及两个脚本的冻结SHA，并单列App SHA。App与并行Chibi源码不属于本批修改范围。

[构建日志](../.analysis/ui-song-console-20261003/build-check.log)与[收据](../.analysis/ui-song-console-20261003/verification-receipt.json)记录`npm run build:check` exit0、2785模块、15.82s；七文件SHA稳定。沿用固定`.analysis/build-check`、copyPublicDir:false、public素材原位保留，有已有大chunk提示。遵循[构建验收政策](BUILD_ACCEPTANCE_POLICY.md)，没有复制public corpus或创建全媒体发布包。

[新预览5203](http://127.0.0.1:5203/?view=song_detail&song=drvalv) / PID16988，见[服务收据](../.analysis/ui-song-console-20261003/server-receipt.json)与[RAM pin](../.analysis/ui-song-console-20261003/pinned-code.json)。190个编译代码文件固定在RAM；main `index-Dl-IaVCT.js`，534681bytes，SHA `7be1c665c5f5961476afb7f088caf1bea2477ed7b36509134a219dabf7eb5c22`。沿用原位public及`E:/Web_build/GS_Archive_Domain_Work/song-discovery-readmodels-20261002`映射，release `d30e1e94cc6a1089a9e7ecbf6111ff63be0bfdc714293c2ebca319976fde364a`。

06:51:05Z[完整性收据](../.analysis/ui-song-console-20261003/verification-receipt.json)：96个实际代码请求SHA匹配、32个媒体请求无HTTP>=400，failures为空；[Browser warn / error](../.analysis/ui-song-console-20261003/browser-warn-error.json)为空。媒体请求含重复与206 range，不等同32个不同资源或全库可用。资源HTTP、原生audio / WebAudio进度与听觉质量保持不同边界。

## 实际 After Browser

- DRIVE布局：[320测量](../.analysis/ui-song-console-20261003/drive-after-320.json) / [截图](../.analysis/ui-song-console-20261003/drive-after-320.jpg)，[780](../.analysis/ui-song-console-20261003/drive-after-780.json)、[820](../.analysis/ui-song-console-20261003/drive-after-820.json)、[1280](../.analysis/ui-song-console-20261003/drive-after-1280.json)。测量记录无页面横向溢出；820 / 1280保留当时scroll位置，不将负top误记为头部裁切。
- 全员原生音频：[播放 / 暂停 / 键盘seek / 归零](../.analysis/ui-song-console-20261003/drive-native-controls.json)，readyState4、22.16 / 130.285s；暂停后ArrowRight推进，归零0且paused=true。组合[Altessimo](../.analysis/ui-song-console-20261003/unit-native-controls.json)实际进度12.16s；[收录特殊轨](../.analysis/ui-song-console-20261003/recorded-track-mode.json)选中`drv999`，mode横滚left110.34、无页面溢出。
- 五槽[实际记录](../.analysis/ui-song-console-20261003/lineup-native-controls.json) / [截图](../.analysis/ui-song-console-20261003/lineup-after-320.jpg)：029ass在槽1、槽5空 / 静音，WebAudio进度30.76s、暂停按钮。Solo[实际记录](../.analysis/ui-song-console-20261003/solo-native-controls.json)：搜索 / 选择029ass后窗口关闭并回到原trigger，进度35.65s。时钟推进不作为听觉一致性或长稳证明。
- 长名单轨：[320](../.analysis/ui-song-console-20261003/long-after-320.json) / [截图](../.analysis/ui-song-console-20261003/long-after-320.jpg)、[780](../.analysis/ui-song-console-20261003/long-after-780.json)。[原生控制记录](../.analysis/ui-song-console-20261003/long-native-controls.json)为89.73 / 121.739s、暂停seek与归零；音量details展开并ArrowLeft至0.99，仅证明UI入口 / range值，audio.volume读数未纳入收据。
- 特殊版本：[日期 / badge](../.analysis/ui-song-console-20261003/special-after-320.json)与[parent返回](../.analysis/ui-song-console-20261003/special-parent-return.json)，真实按钮回到DRIVE A LIVE及全员模式。默认语音：[次郎卡9项](../.analysis/ui-song-console-20261003/card-default-transport.json) / [截图](../.analysis/ui-song-console-20261003/card-default-320.jpg)，均为原文字播放与语音group label，musicCount0；没有以此声称卡片语音播放已验收。

两个代码批均已push至`codex/chibi-stage-reconstruction-20261002`：`1128e9a536b356a27f9276a311e62cfc672d1993`为歌曲头部 / Detail回归；`78f8aa1970c93f2de1f0a1d60357952c5305244a`为四个播放器 / Transport消费者及新增回归。仅显式提交本批文件，并行Chibi与其他工作保留；本验收文档另作文档批。

## 保留与未覆盖

只复用播放、暂停、seek和归零。`continuous:true`是Solo持续声部，不能解释为单曲循环；没有为建议示意图制造循环、随机、Game Ver.或未投影的属性 / BPM。可播放投影与已收录音频不是同一状态。

模式 / 音轨ID、URL、加载保护、五槽、音量、语言 / 身份、原始资料与来源、舞台handoff沿既有合同；默认VoiceRow、Mobile内部播放器、Portal、目录列表与共享App源码保持本批范围外。Browser只访问ALL与Intelli属性，Physical / Mental、未知属性、缺日期与缺播放仅SFC / 源码覆盖。实际Chibi舞台handoff、听觉混音一致性、音量DOM读数、真机、软键盘、实际touch / wheel、浏览器zoom、安全区硬件、长音频 / 长稳、冷加载失败重试、远端资源全量与发布部署均未由当前证据覆盖。

用户在此版本上继续反馈，拒绝横滚模式，要求整合Solo、简化歌词并改善宽屏Hero与顶栏；后续歌曲批优先实现单一模式入口、自然歌词流及宽屏修复。本文件保留已经实测并提交的本轮版本记录，不代表该追加反馈已处理。正式Compact Dialog M、轻量剧情行 / 简介折叠 / 主线话级Tabs、Mobile标题P宏及Panel来源映射仍是后续独立批。
