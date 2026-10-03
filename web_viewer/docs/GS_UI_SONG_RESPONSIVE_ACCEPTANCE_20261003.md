# GS 歌曲模式、自然歌词与响应式验收（2026-10-03）

本批承接用户追加反馈：用户拒绝 C，允许在 A / B 中判断；本批选择 B 的单一原生 select，整合 Solo，移除歌词内部滚动，并改善宽屏 Hero 与共享顶栏。B 是本批实现选择，不写成用户指定 B。沿用 [UI 宪章](GS_UI_CONSTITUTION.md)。[原歌曲控制验收](GS_UI_SONG_CONSOLE_ACCEPTANCE_20261003.md)及其 `5203` 证据独立保留，原四按钮横滚是历史版本。

**状态：模式、自然歌词、桌面 / 顶栏与 fit-only sticky、手机 / 桌面新视觉四批代码均已提交并 push。首个 `5204` / PID26256 的失败保留；PID68152完成fit-only验收，随后PID61256完成新视觉及最终完整性核对。`5205` 因 EACCES 从未提供服务。本文随独立文档批提交。**

## Before / After / Why

| 样本 / 职责 | Before / 源码事实 | After — 首个5204候选实测 | Why / 边界 |
| --- | --- | --- | --- |
| DRIVE A LIVE 模式，320 / 360px | 原 `5203` 是四按钮横滚模式，Solo 另有入口；用户拒绝 C，允许 A / B，由本批选择 B。 | 单原生 select 按实际能力显示五模式：全员合唱、组合预设、自由编成 · 5 槽、Solo 试听、收录音轨。320 / 360px select 高约44px、字体16px，无页面横向溢出。选择 Solo 后取消保持旧模式并 focus select；确认 `029ass` 后进入 Solo；换人取消保持当前 Solo 并 focus Solo 按钮。 | 整合已有模式及声部选择，不增加循环 / 随机播放能力，不用虚构选项补齐缺能力歌曲。 |
| DRIVE A LIVE 歌词，390px | 旧页歌词 clientHeight180 / scrollHeight1044，内部 overflow:auto；原组件默认 follow watcher 会写 list.scrollTop，并显示工程说明及跟随 checkbox。 | 预览6条真实事件，clientHeight264 / scrollHeight264，overflow:visible；展开21条为924 / 924。active 为16px / 600、`rgb(7,91,74)`，其余14px；句级灰卡移除。真实点击 early seek 到10.7s，全文 late seek 到67.9s。 | 当前附近预览及用户展开全文都在页面自然流中；保留 authored 时间轴、准备 / 音源身份守卫、44px句级点击范围、focus与disabled语义。 |
| 歌词滚动与连续播放 | 原内部滚动区会截留阅读滚动；本批移除 scrollTop watcher，不再自动移动页面。 | PageDown 时 main scroll 约668→1054、歌词 listScrollTop0；另一段实际播放68.136→94.756s，两端页面 scroll0、listScroll0。 | 这些是键盘与播放期间的实际位置证据，不能扩大为真机 touch / wheel 或所有布局场景通过。 |
| 共享顶栏，780 / 820px；活动 `410012` | 780px旧列约72 / 24 / 460px，标题仅获24px；820px旧标题列约64px。 | 780px列约72 / 354 / 130px；820px标题列约394px。活动长标题两行，header约100.17px，mainTop同为100.17px。 | 为实体标题与面包屑保留实际宽度，操作按内容占宽；共享修正也需跨域样本核对。 |
| 歌曲宽屏，1280px；长名 `tfmvmt` | 宽屏 Hero 与播放器需要不同内容职责；原歌曲控制布局验收仍见独立 `5203` 记录。 | 左 Hero约599px / 右试听约443px，封面宽160px；真实作词 / 作曲 / 编曲可见，ambient背景作为装饰。长名单轨真实原生audio使用 `/assets/live-chibi/music/tfmvmt.m4a`，0.17474→25.687654s，duration121.739002、readyState4、paused=false；随后暂停 / reset 并退出。 | 排列真实资料与既有播放能力，不以封面、背景或资源请求代替音频进度证据；不把这段播放扩展为听觉质量或全时长稳定性。 |

## 首个候选的失败与最终修正

[宽屏全文可达性收据](../.analysis/ui-song-responsive-20261003/wide-full-lyrics-reachability.json)包含两种状态：普通左栏下可到达21条全文末尾；左栏展开49声部及 Raw 后，右试听内容高约1595.72px并保持 sticky，`收起全文` 焦点 top约1514.13px，超过900px视口。**这是 `5204` first candidate 的失败状态，不能因为歌词本身已无内滚而写成全文可达性通过。**

最终通过局部 ResizeObserver 判断可用高度：可容纳时 sticky，内容高于可用视口时自然流，不恢复歌词内部滚动，也不为歌词 time update 增加页面滚动 watcher。见[全文 / 高左栏](../.analysis/ui-song-responsive-final-20261003/sticky-full-tall-left.json)：1280×900、左栏 Raw使页面 scrollHeight40441，右栏完整21条高1595.72px，fit=false / position=static，`收起全文` 焦点 top518.23 / bottom562.22px可见，listScroll0；1280×720同样自然流，焦点428.11..472.10px可见。

[600 / 900px视口切换](../.analysis/ui-song-responsive-final-20261003/sticky-viewport-resize.json)使用同一约607.85px播放器：1280×600可用524px，fit=false / static；1280×900可用824px，fit=true / sticky。手机[320px实际播放](../.analysis/ui-song-responsive-final-20261003/playback-scroll-320.json)从10.932843→42.094311s，paused=false，页面scroll两次均88.735626px，歌词listScroll0；[320布局](../.analysis/ui-song-responsive-final-20261003/mobile-320.json)保留自然歌词。

## 手机 / 桌面新视觉

这一轮实际结果来自 `.analysis/ui-song-mobile-glow-20261003`，没有沿用上一轮手机测量冒充新视觉验收。实际封面作为ambient装饰背景；半透明胶囊与日期移至右侧info，标题 / 标签自然换行，不锁内容高度。

| 真实样本 | 实际 Browser 结果 | 保留 / 证据 |
| --- | --- | --- |
| DRIVE A LIVE，320px | ambient display:block、blur32px / opacity.16，背景URL与真实封面一致；hero116.36px（旧134.59px），封面80×80、info89.60px；日期 / 胶囊在右info分两行，无页面横向溢出。 | [320测量](../.analysis/ui-song-mobile-glow-20261003/mobile-320.json)及[头部截图](../.analysis/ui-song-mobile-glow-20261003/mobile-320.jpg)。 |
| DRIVE A LIVE，390px | blur32px / opacity.16；hero106.75px，info与封面均80px高；日期 / 胶囊右侧同排，无页面横向溢出。 | [390测量](../.analysis/ui-song-mobile-glow-20261003/mobile-390.json)及[重拍头部](../.analysis/ui-song-mobile-glow-20261003/mobile-390.jpg)，mainScroll0；从特殊版返回后URL保留from参数，当前实体仍是`drvalv`。旧滚到歌词的截图不作header证据。 |
| DRIVE A LIVE，1280px | 左hero约599 / 右试听443px，封面宽160px、info高160px，标题28px、真实credits；日期 / 胶囊右侧同排，blur44px / opacity.22；6条歌词264 / 264、overflow:visible。 | [1280测量](../.analysis/ui-song-mobile-glow-20261003/desktop-1280.json)及[mainScroll0截图](../.analysis/ui-song-mobile-glow-20261003/desktop-1280.jpg)；160px是普通样本的实际info高度，不是锁定所有内容的高度。 |
| DRIVE A LIVE，780px | 顶栏列约72 / 354.44 / 129.81px，title / breadcrumb的client=scroll=354，无横向溢出；封面宽160px、info高160px，标题24px，日期 / 胶囊同排。 | [780测量](../.analysis/ui-song-mobile-glow-20261003/desktop-780.json)，保留侧栏可见时的实际内容宽度。 |
| 特殊版 `drv999`，320 / 1280px | 长标题及3个胶囊自然换行，完整内容无页面横向溢出；320 info195.11 / hero221.87px、1280 info226.30 / hero261.06px。parent返回`drvalv`实际点击通过。 | [特殊版320](../.analysis/ui-song-mobile-glow-20261003/special-mobile-320.json) / [1280](../.analysis/ui-song-mobile-glow-20261003/special-desktop-1280.json)。长内容自然增高，不能以普通样本高度作为固定上限。 |

新视觉pin的[歌词fit复核](../.analysis/ui-song-mobile-glow-20261003/desktop-lyrics-fit.json)在1280×900、pane824px下，收起时column607.85px、fit=true / sticky；21条全文时column1595.72px、fit=false / static、listScroll0。`收起全文`按钮682.82..726.82px可见，实际末句获得焦点后bottom674.83px可见。

## 证据、回归与提交

`5204` first candidate 的[服务收据](../.analysis/ui-song-responsive-20261003/server-receipt.json)为 PID26256、input HEAD `a07981d14f529edbf7ddf0338788eb07abeaa490`、codeOnly=true、sourcesStable=true；[RAM pin](../.analysis/ui-song-responsive-20261003/pinned-code.json)与[构建输入](../.analysis/ui-song-responsive-20261003/build-input.json)保留。其[构建日志](../.analysis/ui-song-responsive-20261003/build-check.log)记录 code-only编译19.48s，输出复用 `.analysis/build-check`，public / media原位使用；这些不是最终 fit-only修正的构建证据。

修正后的[构建输入](../.analysis/ui-song-responsive-final-20261003/build-input.json)为 HEAD `50e581ccc202d65312364fe9cd7732bc3ac0c634`；当时未提交的响应式源码按冻结SHA编译，随后收入 `1608eb10`。[构建日志](../.analysis/ui-song-responsive-final-20261003/build-check.log)及[完整性收据](../.analysis/ui-song-responsive-final-20261003/verification-receipt.json)记录 `npm run build:check` exit0 / 22.45s、copyPublicDir=false、sourcesStable=true、App unchanged；190代码文件固定在RAM，16个实际代码请求SHA匹配、failures为空。main `index-BtJpJixs.js`，534681bytes，SHA `d07b2683da9d25a29ef0749526e65ea954844970ffecbcb733f4260af745e408`。4条媒体请求都是同一DRIVE文件的206 range，不等同4个独立资源。

[最终响应式服务收据](../.analysis/ui-song-responsive-final-20261003/server-receipt.json)为 `5204` / PID68152，明确替换旧候选PID26256；[RAM pin](../.analysis/ui-song-responsive-final-20261003/pinned-code.json)独立保存。`5205` 只有[尝试收据](../.analysis/ui-song-responsive-final-20261003/port-5205-attempt.json)和[EACCES错误](../.analysis/ui-song-responsive-final-20261003/port-5205-error.log)，从未提供验收页面，不能将该尝试pin写成已服务版本。两个响应式构建均为code-only，媒体 / read-model原位映射；后续磁盘rebuild与已冻结RAM分开记录。

手机 / 桌面新视觉[构建输入](../.analysis/ui-song-mobile-glow-20261003/build-input.json)为 HEAD `1608eb10fafa79633249fe11561d0e2992bbe179`，[构建日志](../.analysis/ui-song-mobile-glow-20261003/build-check.log)为exit0 / 25.51s；PID61256替换68152，仅code固定在RAM、资源原位使用。[最终服务收据](../.analysis/ui-song-mobile-glow-20261003/server-receipt.json)绑定`db101d2d`源码与截图SHA。[新RAM pin](../.analysis/ui-song-mobile-glow-20261003/pinned-code.json)共190代码文件；main `/_app/index-rpNPqthw.js`，534681bytes，SHA `20b803fb7fd8061bed28d2e900d9e8799175ce5437b603a30b92a9d99f4db5f3`。

[最终完整性收据](../.analysis/ui-song-mobile-glow-20261003/verification-receipt.json)记录sourcesStable / App unchanged=true，16个实际代码请求SHA匹配、failures为空；Detail源码SHA为 `db7781fbbf250f9af587427dc1ce29cf6c4a5fedcb1d9fa31c84d7d5549f0a4e`。[Browser warn / error](../.analysis/ui-song-mobile-glow-20261003/browser-warnings-errors.json)为空。4条206媒体请求为`drvalv`×3与`drv999`×1，即两个资源；这轮没有因请求证据新增实际播放结论。前两阶段的真实audio进度仍按各自pin记录，不混用main SHA。

代表收据：[旧歌词390](../.analysis/ui-song-responsive-20261003/before-lyrics-390.json) / [候选歌词390](../.analysis/ui-song-responsive-20261003/after-lyrics-390.json)、[seek与PageDown](../.analysis/ui-song-responsive-20261003/lyrics-interaction.json)、[播放期间滚动](../.analysis/ui-song-responsive-20261003/lyrics-playing-scroll.json)、[Solo确认 / 取消焦点](../.analysis/ui-song-responsive-20261003/solo-select-focus.json)、[长名单轨播放](../.analysis/ui-song-responsive-20261003/single-lyrics-playback.json)、[780顶栏](../.analysis/ui-song-responsive-20261003/after-header-780.json)、[活动顶栏](../.analysis/ui-song-responsive-20261003/shared-event-header-780.json)、[1280歌曲](../.analysis/ui-song-responsive-20261003/after-desktop-1280.json)。同目录jpg为实际截图，所有这些 After仍属于first candidate。

| 已实际执行的歌词回归 | 覆盖 | 证据边界 |
| --- | --- | --- |
| `node --experimental-vm-modules scripts/verify-song-lyrics-presentation.mjs` | 真实SFC＋21事件DRIVE时间轴：后段当前句、gap无错误aria-current、全文节点稳定、focus行保留、双语换行fixture、ready / audio identity / seek守卫、真实media clock钳制、懒载 / 过期 / 错误重试 / 卸载、零自动滚动调用。 | 内存host及原生audio替身；不证明Browser几何、原生焦点、真实双语译文映射或媒体解码。 |
| `node scripts/verify-song-lyrics.mjs` | 60条 authored timeline / 1353条歌词，interval / seek / gap / audio identity。 | 保留来源时间与原text，不能证明每句演唱者。 |
| `node scripts/verify-media-element-clock.mjs` | load / play / waiting / seek / rate / end / error / replacement / dispose。 | 时钟与监听合同，不代表实际音频输出。 |
| `node --experimental-vm-modules scripts/verify-song-detail-presentation.mjs` | 新胶囊布局后实际exit0；真实SFC、来源日期、形态唯一性、四属性、特殊版父入口、恢复合同及RO生命周期。 | 内存host，不是Browser几何；缺属性 / 来源等fixture不当实际语料缺陷。 |

表中四项均exit0。模式 B / Solo已独立commit / push `eaf693ec`；自然歌词及真实SFC新回归为 `50e581cc`；桌面 / 顶栏与fit-only sticky为 `1608eb10`；手机 / 桌面新视觉为 `db101d2d72482eb692bfe82b44775f0026b08241`。各代码批仅提交显式文件，保留并行其他窗口改动；本文随独立文档批提交。

## 保留与未知

真实目录没有本批可用的BPM或逐行歌手字段，不补造数值 / 标签。歌词事件只含time / text / duration / rawText；独立singerEvents表示舞台位 / performerSlot切换，歌词组件没有当前编成成员映射，一句内部也可能跨切换。保留原文及换行，不拿整曲出演名单或角色颜色填每句演唱者；双语fixture仅检验文字不被丢弃。

预览 / 全文保留原生details主入口；歌曲时钟、音轨身份、seek守卫、既有音量与播放能力继续使用原合同。共享默认语音transport、Story / Phone内部播放器没有因歌词消费者的改造而迁移。code-only RAM及原位媒体 / read-model映射不等同完整资产包装或远端全库验收。

真机、软键盘、实际touch / wheel、zoom、安全区硬件、实际Chibi视觉、听觉混音一致性、长稳 / 全时长、冷加载失败重试、全量外部资源与发布部署未覆盖。正式Compact Dialog M、Story主次阅读入口 / 简介折叠 / 主线话级Tabs、Mobile P宏和Panel来源映射仍为独立后续批。
