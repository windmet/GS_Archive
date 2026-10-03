# GS Archive 活动详情 Foundation 与返回验收

2026-10-03，接续[人物 / 组合详情批次](GS_UI_IDOL_UNIT_ACCEPTANCE_20261003.md)与[UI Foundation](GS_UI_CONSTITUTION.md)。本批输入 HEAD 为 `029360515fe6efd9669d3970a17622f566e29042`，只迁移 `ArchiveEventDetail.vue` 的展示姓名、文字与普通间距角色、局部共享消费者样式和稳定返回入口，并扩展既有 `verify-terminal-idol-localization.mjs`。App 已有姓名回调继续复用；没有修改路由、共享恢复器、QuickView、Solo、Reader / Player 或 Chibi。

源码与回归已独立提交并推送为 `6341e6ea430cc1bfceb23e7a5f14dbfb3c553b3a`，提交只含上述两个文件。下面的构建输入 HEAD `5bc2c4e1...` 是提交前冻结源码所在的共享分支状态；最终提交不是另一次构建，不能把两个 SHA 混作同一事实。其他窗口提交与无关 dirty / untracked 文件均保留。

## Before / After / Why

Before 使用5199原有生产代码映射服务 PID64680，RAM pin 来自 `b3295fb40bcd23e657ba3d266758d66c8f3ed253` 构建。输入 HEAD 与旧代码 pin 是不同事实；具体文件 SHA、进程与 pin 记录在 [before-state.json](../.analysis/ui-event-20261003/before-state.json) 和 [before-pinned-code.json](../.analysis/ui-event-20261003/before-pinned-code.json)。

| Browser 实际 Before | After | Why |
| --- | --- | --- |
| `410012`，1280px：实体18.88、章节13.76、阅读 / 播放文字10.88px；320px实体16px | 实体22、章节18、正文14、meta12、操作13；普通 spacing / radius / focus 接入现有 tokens | 活动详情按内容角色决定层级，保留活动页现有颜色与信息分类 |
| `410012`，780 / 820px：详情没有横溢出，但简介与操作仍双列，章节每列约280 / 300px | 内容宽度≤800px时简介 / 操作上下排列、章节单列；人物与组合区域也上下排列，人物子网格保留自适应列数。≤520px才隐藏章节对白 / 语音统计；820px实测11章统计均保留 | 断点跟随 Shell 留出的真实内容宽度；单列有空间时继续呈现有效统计 |
| `410012`，320px：阅读 / 播放40px；视觉资料 summary 约18.85px；RewardTable select44px但文字12px | 阅读 / 播放及 summary 约44px、操作13；select16px / 44px，详情305 / 305无横溢出 | 直接操作与表单分别采用触摸命中和输入文字尺度 |
| `430013`中文资料：报酬姓名已中文，出演五人和同期派生卡 metadata 仍日文 | 出演姓名 / accessible name 与派生 metadata 使用既有姓名回调，随中文 / 日文切换；原文 fallback 保留 | 展示一致性不改 canonical cast、卡片 payload、资源或证据性质 |
| `430013`阿斯兰日文姓名：320px client153 / scroll178，820px成员文字列约78 / scroll178，省略不可完整读取 | 本页人物消费者14px、正常换行；320px中文五人均149 / 149。日文全名在320截图完整，820出演布局折列 | 详情提供完整实体身份；保留64px头像，不缩字号或改共享人物组件 |
| `430013`手机报酬卡文字原本紧凑；迁移后主名增至14px有新增截断风险 | 卡名解除 nowrap / ellipsis；320px四个真实标题均 client / scroll137，最长“追寻未曾谋面的逸品”完整 | `106px`卡片与 `84px`入口均为 min-height，允许内容自然增长；媒体重试样式仅命中预览 wrapper |
| `410012`阅读返回焦点为 BODY；`430013`报酬卡 / 组合返回停在 Shell“返回”，marker为空 | 概览阅读、章节阅读、确认报酬、Wiki兑换、组合、季节入口采用稳定 typed focus ID；派生关系使用含活动身份的 relation ID | 复用已有导航与返回恢复，不新建返回算法；相同目标的不同入口有各自身份 |
| `event:20001`，320px：Wiki summary约37.47px，两个 source link约37.72 / 17.47px，文字12px | summary / 来源操作约44px，来源操作13px；table wrapper273 / scroll380继续有界横滚，详情305 / 305 | 可点来源需要触摸尺度；表格保留合法最小列宽，不为避免内部横滚而压缩内容 |

桌面普通操作使用 compact32 / normal36 的局部角色，手机 / coarse pointer 使用44px；卡片、章节、组合等由内容决定的更高入口不压缩到普通控件高度。本页保留 banner `940 / 510`、报酬图72px、组合 logo `70 × 38px`、头像64px及视觉角色170px画面 / 230px画架。资料来源、确认报酬、同期推导与 Wiki 补录仍分别呈现；零值和未知来源没有补造内容。

## 源码回归与构建映射

以下命令已由 root 或本批 agent 运行通过；整理本文档没有重跑测试或构建：

```text
node scripts/verify-event-view-consumer.mjs
node scripts/verify-event-readmodel-navigation.mjs
node scripts/verify-event-story-navigation.mjs
node scripts/verify-event-resource-graph.mjs --source-only
node scripts/verify-archive-relation-navigation.mjs
node scripts/verify-archive-presentation.mjs
node scripts/verify-reward-presentation.mjs
node scripts/verify-terminal-idol-localization.mjs
```

`verify-terminal-idol-localization`通过33个真实 SFC render 场景，总数包含既有 Terminal / 卡片 / 歌曲 / 人物 / 组合等场景，不能写成33个活动 Browser 场景。活动扩展读取真实 offline producer 的 `430013`，运行生产 App 姓名回调及真实 Event / IdolReference / Relation 等消费者，检查中日姓名、无回调 / 缺翻译 fallback、canonical cast 顺序与 payload、图片第一候选、确认报酬与派生证据、原始来源不变。首章 guard 为真实活动副本上的受控场景：将首章阅读改为 unsupported，后续 ready 章节不得冒充概览首章，后章自身入口仍可用；不是新增真实语料或 Browser 故障注入。

`verify-event-story-navigation`覆盖旧 manifest 的36活动 / 396章节；`verify-event-resource-graph --source-only`覆盖59来源身份；关系导航覆盖16条实际 App 边。它们分别证明来源 / 解析 / 接线合同，不证明59详情均渲染、真实媒体播放或所有返回路径。当前 readmodel 的59详情及相关 SHA 曾做只读来源核对，来源记录见[上一批样本计划](GS_UI_IDOL_UNIT_ACCEPTANCE_20261003.md)。

真实 `ArchiveEventDetail.vue` 的 script / inline-template / scoped CSS 编译与 `git diff --check`通过。唯一一次 `npm run build:check` 输入 HEAD 为 `5bc2c4e1cc40dc45fcb5194d143d43cf0313ccc7`，12.61s通过，2779 modules；保留 Vite 既有大 chunk 提示。输出仍是本 checkout 的 `.analysis/build-check`，`copyPublicDir:false`，未复制 public / 媒体语料，不能当作完整发布包。

构建时冻结的 Event 文件 SHA256 为 `e247a72ba7f3b65002a2b933ad9e88d78aefa63b91ffe143518ac62f460f6424`。证据为 [source-before-build.json](../.analysis/ui-event-20261003/source-before-build.json)、[build-check.log](../.analysis/ui-event-20261003/build-check.log)、[compiled-build.json](../.analysis/ui-event-20261003/compiled-build.json)、[pinned-code.json](../.analysis/ui-event-20261003/pinned-code.json)与[after-server.json](../.analysis/ui-event-20261003/after-server.json)。5199生产代码映射服务 PID19980 的191个 RAM pin 文件与本次构建清单逐项 URL / bytes / SHA一致；静态语料映射当前 public 与 `E:/Web_build/GS_Archive_Domain_Work/song-discovery-readmodels-20261002`，release 为 `d30e1e94cc6a1089a9e7ecbf6111ff63be0bfdc714293c2ebca319976fde364a`。

实际 Browser 请求 `/_app/index-Cwx9BGd7.js`，HTTP200，534610 bytes，SHA256 `0c1d3cc081ab4b498ffe8e699c46eff770b9bb462906ae6d36bd2f84e5259c42`。最终[acceptance-integrity.json](../.analysis/ui-event-20261003/acceptance-integrity.json)确认源码 SHA 未漂移、191 pin匹配、PID19980共400条请求、console记录0条、stderr0 bytes；faults规则为空。HTTP日志存在两条中文剧情 overlay 404：`1_3_10012_01_a.json`和`1_3_10012_01_b.json`；Reader正文已实际显示日文 fallback。它们是缺译文边界，不是活动图片404，也不能把该日志写成HTTP全绿。

## Browser 实际旅程与证据

| 样本 / viewport / 操作 | 实际 After 与证据 |
| --- | --- |
| 目录搜索 `410012`进入，320px | 最长45字符标题22px完整换行，章节18、阅读 / 播放13px / 约43.994px，select16px / 约43.994px，视觉 summary约43.994px；详情305 / 305、章节单列。[JSON](../.analysis/ui-event-20261003/410012-after-320.json)、[截图](../.analysis/ui-event-20261003/410012-after-320.jpg) |
| `410012`，780 / 820 / 1280px | 已实际查看三个宽度。780 / 820章节单列；820详情649 / 649，story direction为column、宽601.07，11章统计均为flex。1280查看完整头部与层级。[820 JSON](../.analysis/ui-event-20261003/410012-after-820.json)、[780截图](../.analysis/ui-event-20261003/410012-after-780-chapters.jpg)、[820截图](../.analysis/ui-event-20261003/410012-after-820-story-chapters.jpg)、[1280截图](../.analysis/ui-event-20261003/410012-after-1280.jpg) |
| `410012`概览 → Reader → “返回来源目录”；EP1 → Reader → “返回来源目录” | 概览焦点 `event-read:410012:overview:1_3_10012_01_a`，scroll456.09；EP1焦点 `event-read:410012:episode:4100120101`，scroll726.90，aria为“阅读 エピソード1”。同一活动 / query / parent回到各自入口。[概览 JSON](../.analysis/ui-event-20261003/410012-after-overview-return.json)、[章节 JSON](../.analysis/ui-event-20261003/410012-after-chapter-return.json) |
| `430013`中文 / 日文320px，820px出演布局 | Café Parade五人姓名跟随语言；阿斯兰完整换行、中文各姓名14px / normal / client=scroll149；中文派生 metadata为“神谷幸广 · R”，来源仍标记同期推导。Cast→人物返回 `idol-reference:029ass`；820px组合→详情→返回 `event-unit:430013:10`，详情649 / 649。[中文 JSON](../.analysis/ui-event-20261003/430013-after-320-chinese.json)、[日文320截图](../.analysis/ui-event-20261003/430013-after-320-japanese-cast.jpg)、[820截图](../.analysis/ui-event-20261003/430013-after-820-cast.jpg)、[组合返回 JSON](../.analysis/ui-event-20261003/430013-after-unit-return.json) |
| `430013`确认报酬卡 / 同期派生卡 → 卡片 → Shell返回 | 4确认报酬 / 1派生卡分类保留；确认报酬返回 `event-card:430013:reward:029ass_sr05`，派生返回 `relation:event-derived-card:430013:027yuk_r02`。确认报酬入口实测高104.15至120.94px，未被媒体重试样式压成32 / 44。320px四个14px卡名均完整、详情305 / 305。[报酬返回 JSON](../.analysis/ui-event-20261003/430013-after-card-return.json)、[派生返回 JSON](../.analysis/ui-event-20261003/430013-after-derived-return.json)、[手机标题 JSON](../.analysis/ui-event-20261003/430013-after-320-rewards.json)、[截图](../.analysis/ui-event-20261003/430013-after-320-rewards.jpg) |
| `event:20001`，320px，展开Wiki19行并访问兑换卡 | 3独立Wiki卡 / 19行保留；本期 story / cast / 客户端报酬与 general rows为合法0，未制造空章节；table273 / scroll380有界横滚。两条来源链接13px / 约44px。兑换卡→卡片→返回 `event-card:event:20001:exchange:029ass_sr02`。[Wiki JSON](../.analysis/ui-event-20261003/20001-after-320-wiki.json)、[截图](../.analysis/ui-event-20261003/20001-after-320-wiki.jpg)、[兑换返回 JSON](../.analysis/ui-event-20261003/20001-after-exchange-return.json) |
| `410017`，320px，跨组合样本 | 4 cast / Altessimo、Beit、High×Joker、C.FIRST四组合 / 3确认报酬 / 1同期派生仍正确；11章，详情305 / 305。本样本是呈现与数量检查，未遍历四组每条入口。[JSON](../.analysis/ui-event-20261003/410017-after-cross-unit.json) |
| `410011`，320px，滚到visual可见并人物往返 | Jupiter三张画架均约230px、art约170px；三图complete=true、natural分别719×820、475×783、594×796。详情305 / 305，北斗往返焦点 `idol-reference:003hok`。首次 lazy offscreen complete=false不记为资源失败。[几何 / 图片 JSON](../.analysis/ui-event-20261003/410011-after-320-visual.json)、[截图](../.analysis/ui-event-20261003/410011-after-320-visual.jpg) |
| 目录情人节 → Happy Valentine2023 `event:40002` → 阅读季节企划 → Shell返回，320px | 实际到 `view=seasonal_campaign&story_section=valentine_2023`，返回 `event-seasonal:event:40002:valentine_2023`；0本期episodes / 0卡保留，251 general reward rows仍存在，零卡有说明。只访问季节目录并返回，未点季节 Player / Reader。[返回 JSON](../.analysis/ui-event-20261003/seasonal-after-return.json)、[截图](../.analysis/ui-event-20261003/seasonal-after-320.jpg) |

所有小型证据在本 checkout 的 `.analysis/ui-event-20261003`。主要Before截图为 `410012-before-1280.jpg`、`410012-before-320.jpg`、`410012-before-780-chapters-rewards.jpg`、`410012-before-820-story.jpg`、`430013-before-320-cast.jpg`、`430013-before-820-cast.jpg`、`20001-before-320-wiki.jpg`和`410011-before-320-visual.jpg`；对应 DOM / 返回记录单独保存在 JSON 中，截图不替代焦点身份或数值测量。

## 覆盖边界与后续

本批 Browser 是5199的本地生产代码 pin + 现有资源映射验收，不是部署、完整媒体包或全59活动验收。`410012`实际操作 Reader概览 / EP1返回；播放按钮的样式已观察，未启动活动Player或检查视频 / 音频播放。季节样本仅验证目录入口与返回，其他季节及其Reader / Player未知。确认报酬、Wiki兑换和派生卡各走过代表入口，不等于所有奖励来源、藏品QuickView、分页、故障恢复或所有卡片路径全覆盖。

图片证据只包括本次实际可见并加载的样本，尤其410011三张角色图；没有由 source-only图谱推定所有活动资源可用。手机viewport不能证明真实设备触摸、输入缩放、刘海安全区或200% Browser zoom。QuickView / Solo及Dialog M密度仍独立；后续继续按其实际消费者与行为合同验收，不继承活动页通过结论。

下一轮按[Foundation路线](GS_UI_CONSTITUTION.md)分三批，均先取得对应 Browser Before，再决定最小改动：

| 下一批 | 必须保留 / 待核实 |
| --- | --- |
| QuickView / Solo局部样式与手机操作 | 先实看布局、安全区接入、关闭与背景滚动；保留480px宽、Solo手机85dvh与即时选择合同，不连带修改共享 TerminalDialog |
| QuickView“完整查看”返回行为 | 先实际查看完整详情往返与返回焦点，再确定原入口与异步就绪合同；本批没有操作该旅程，仍未知 |
| RewardTable scope / page恢复 | 先复现筛选 / 页码 / 详情往返；分页恢复与单行focus marker是不同状态，不能由本批代表卡片返回推定通过 |

Story等剩余完整URL筛选恢复随后推进；Dialog M继续等待用户选择密度，Player HUD和Chibi保持独立范围。
