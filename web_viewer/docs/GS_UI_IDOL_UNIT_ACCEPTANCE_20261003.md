# GS Archive 人物 / 组合详情一致性验收

2026-10-03。接续[歌曲返回 / 卡片批次](GS_UI_SONG_RESTORATION_CARD_ACCEPTANCE_20261003.md)与[UI Foundation](GS_UI_CONSTITUTION.md)。任务输入HEAD为`81707aa14e0240e1342bbcd6347ccfbfed05d066`；共享分支中的Chibi窗口随后提交到`b3295fb40bcd23e657ba3d266758d66c8f3ed253`，本批没有回退或覆盖它。

本批只修改`ArchiveIdolDetail.vue`、`ArchiveUnitDetail.vue`、App的人物展示姓名接线和既有`verify-terminal-idol-localization.mjs`。共享头像、切换器、关系列表与技术资料组件只在两个详情消费者内覆盖样式。Dialog M密度选择、活动详情、Reader / Player与Chibi不属于本批验收。

人物代码与回归独立提交为`52fa3283c70da8b5cbcea445f7104233399c0f16`；组合代码独立提交为`5f2e5e42e88588f1987b2214a3a0a5ce4fd33845`，均已确认在远端。共享分支同时push曾出现ref锁竞态；fetch后本地/远端均为同一组合提交、ahead/behind为0/0，没有force push或覆盖其他窗口工作。两个提交对应下面同一次编译及Browser证据，文档提交不重复构建。

## Before 与本批实现

Before使用5199原有生产代码映射服务PID53728，代码pin来自`b8edb7bb`构建。输入HEAD到该构建之间的App、Idol、Unit、Switcher、tokens差异为空，已对照相关源码及pin清单。不能把该旧bundle称为`81707aa1`的全代码构建。

| Browser实际Before | 本批After / 原因 |
| --- | --- |
| `029ass`中文状态：切换器为阿斯兰·别西卜II世，Shell / 面包屑 / hero / 头像alt仍是日文原名 | 使用既有`idolDisplayName(code, rawFallback)`；四处展示姓名与语言连续。canonical profile、技术JSON与emit仍使用原对象 |
| `029ass`，780px：详情client609 / scroll642；header561 / 618，select右缘797.6超出header右缘741.1。820px同样外溢 | 详情content container在800px及以下将切换器放入下一行；头像与姓名仍在同一行。实际780/820均无横向溢出 |
| `029ass`，320px：头像与姓名分成上下两行；标题19.2、章节13.76、组合按钮约29、切换器34、select10.72px | 78px头像与姓名同排；实体22、章节18、正文14、meta12、操作13。触摸按钮/select44、select16；生日使用pre-line保留真实换行 |
| `10caf`，320px：查看卡片按钮约32，内部标签10.56；章节13.76 | 操作13/600、触摸44；章节18。仅数量span使用meta角色，避免把CTA内部文字再次缩小 |
| `10caf`，日文320 / 780 / 820px：阿斯兰入口nowrap；姓名scroll178分别大于client156 / 162 / 85，姓名不可完整读取 | member姓名14/600正常换行，当前320 / 780 / 820均client=scroll，完整身份可读；保留原有成员grid与44px头像 |
| `02dra`，1280 / 320px：实体标题28.8 / 23.2；组合背景、logo、主视觉各有自己的几何 | 实体标题统一22；保留hero min220/170、logo74px、歌曲封面44px、背景裁切与组合性格。desktop hero26×28 framing保留并注释 |
| 人物→组合、组合→卡片入口，Shell返回到正确实体但焦点留在返回按钮 | 增加按canonical实体与入口命名的`data-archive-focus-id`，接入现有返回恢复。没有新增路由或恢复控制器 |

普通padding/gap/radius、focus与字体角色接入Foundation；图片几何、卡片归属、关系类型、计数、资料来源算法保持原合同。Unit脚本相对HEAD完全相同，template除三个focus属性完全相同。人物的展示回调仅改变h2/头像alt；App标题/面包屑另外消费同一回调。

## 验证与代码映射

已通过相关回归：

```text
node scripts/verify-terminal-idol-localization.mjs
node scripts/verify-idol-page.mjs
node scripts/verify-idol-readmodel-navigation.mjs
node scripts/verify-unit-page.mjs
node scripts/verify-unit-readmodel-navigation.mjs
node scripts/verify-idol-reference.mjs
node scripts/verify-archive-relation-navigation.mjs
node scripts/verify-song-domain-landing.mjs
node scripts/verify-archive-presentation.mjs
```

既有localization测试扩展到真实Idol / Unit / Avatar / Technical SFC，共28次真实Vue渲染。验证中文/日文、真实translation repository的缺失姓名fallback、默认回调、App当前profile与语言响应、canonical头像资源、原始技术JSON及emit对象。沿用既有Vite SSR测试结构；没有另外实现renderer，也没有用CSS字符串断言充当排版验收。该测试不证明Browser原生点击、滚动或focus。

其他测试范围分别为50个人物身份（含unknown）、16个组合 / 34身份案例、60作品 / 61歌曲实体以及presentation来源合同。`verify-idol-reference`的836张卡是该脚本的legacy输入，与当前Browser卡片目录826不是同一统计口径，不能混写。

本批一次`npm run build:check`在输入HEAD`b3295fb4`通过，15.00s。六个相关源文件SHA在构建前后与Browser完成后相同；固定输出`.analysis/build-check`，`copyPublicDir:false`。现有大chunk提示保留；这是代码编译，不是可独立发布的媒体包。

核对旧5199进程脚本、端口和证据目录后，仅替换本任务服务为PID64680。当前5199服务将191个代码文件pin在RAM，文件名/SHA与该次编译回执逐一匹配；现有public及外部资料继续映射，未复制语料。资料根为`E:/Web_build/GS_Archive_Domain_Work/song-discovery-readmodels-20261002`，release为`d30e1e94cc6a1089a9e7ecbf6111ff63be0bfdc714293c2ebca319976fde364a`。

实际Browser加载`/_app/index-C974TQvD.js`，HTTP200，SHA `f662cfc7637db24f24d2159dc18e1a444d26d5e5a0a6d4edfcb9954459b63bfd`。截至最终复核，PID64680的134条HTTP没有400以上响应，server stderr为空；实体tab warn/error为空。本批没有故障注入。

小型日志、截图与SHA证据均在本checkout的`.analysis/ui-idol-unit-20261003`：`before-state.json`、`before-pinned-code.json`、`source-before-build.json`、`build-check.log`、`compiled-build.json`、`pinned-code.json`、`after-server.json`、`http-requests.jsonl`与`final-code-http.json`。

## Browser实际After

| 实际旅程 / viewport | 结果 |
| --- | --- |
| `029ass`中文↔日文，1280 / 320px | Shell、面包屑、hero、头像alt均随语言；中文阿斯兰·别西卜II世、日文アスラン＝ベルゼビュートⅡ世，后者320px两行完整 |
| `029ass`，1280px | 详情1109 / 1109；hero为104 + 509.3 + 360三列；头像约104；标题22、章节18 |
| `029ass`，780 / 820px | 详情609 / 609、649 / 649；header561 / 561、601 / 601；select右缘673.1 / 713.1均在header内，切换器独占下一行 |
| `029ass`日文，320px | 详情305 / 305；姓名155 / 155；头像约78与姓名同y75.99；组合入口、箭头、select约43.994px，select16；生日仍为原始`マヤ歴5174年\n10月9日`两行 |
| 人物→Café Parade→Shell返回 | `idol-unit:029ass`恢复焦点，人物scroll0 |
| `10caf`，日文320 / 780 / 820px | 阿斯兰姓名分别152 / 152、168 / 168、91 / 91，white-space正常；详情305 / 305、609 / 609、649 / 649 |
| `10caf`查看卡片→Shell返回 | 原有正确路线仍是`view=idols&category=cards&unit_filter=10`，显示Café Parade五成员筛选入口；回组合焦点`unit-cards:10caf`，scroll87.8。没有擅自改成直接卡片列表 |
| `10caf`阿斯兰成员→人物→Shell返回 | 回组合原成员按钮，焦点`idol-reference:029ass`；实际滚动容器是`.unit-detail`，不是window.scrollY |
| `10caf`Café Parade!→歌曲→Shell返回，820px | 回组合歌曲入口`unit-song:10caf:cfprde`，scroll506.2 |
| 人物17张卡片→卡片目录→Shell返回，780px | 实际目录17卡，回人物`idol-domain:029ass:cards`，scroll314.0 |
| 人物Café Parade!→歌曲→Shell返回，780px | 回人物`idol-song:029ass:cfprde`，scroll1249.2 |
| 人物下一位→上一位→原生select | `029ass`→`030mak`卯月巻緒→`029ass`→`004ter`天道輝，当前route/profile/标题匹配；另选`041ryo`进入F-LAGS |
| `02dra`，1280 / 320px | 详情1109 / 1109、305 / 305；实体22，hero min220/170；320px CTA43.994/13。3成员、3歌曲、3剧情、属性出演存在、跨组合章节隐藏 |
| `14fla`，320px | 详情305 / 305；3成员、3歌曲、3剧情；属性/跨组合出演均真实0，保持隐藏，不制造空章节 |

Before截图`idol-before-780.jpg`、`idol-before-320.jpg`、`unit-caf-before-320.jpg`、`unit-caf-ja-before-820.jpg`；After截图`idol-final-780.jpg`、`idol-ja-final-320.jpg`、`unit-caf-ja-final-320.jpg`、`unit-caf-ja-final-820.jpg`、`unit-dra-final-1280.jpg`、`unit-dra-final-320.jpg`与`unit-fla-final-320.jpg`。切换viewport后核对innerWidth，再取稳定截图。`unit-dra-before-320-viewport-transition.jpg`是在resize后仍显示前一物理viewport的过渡帧，已按此命名，不能作为320px视觉证据；其独立DOM元数据与最终稳定320截图分别记录。

## 下一域计划与覆盖边界

当前49人物 / 16组合没有主要详情全空的真实样本。F-LAGS只证明可选章节的合法零；不能称整页empty验收。称号和组合剧情新增focus属性，但本批没有执行它们的Reader / Collection往返；其他关联资料的所有入口、失败重试也未由卡片/歌曲的代表旅程全面证明。200%真实Browser zoom、真机触摸、安全区、音频播放长稳和Chibi未覆盖。

下一批是活动详情。只读核对当前release的59个真实detail和SHA后，选定以下四个Before样本；目前仍是来源/源码准备，尚未活动Browser验收：

| 活动路由身份 / 奖励原始eventId | 样本用途 |
| --- | --- |
| `410012 / 10012`，Multiple Entertainment Show! | 最长45字符标题；11章/11ready阅读、3客户端报酬卡、161奖励行 |
| `430013 / 30013`，Reversed Masquerade | Café Parade五人含阿斯兰；4确认报酬卡＋1同期派生卡、167奖励行 |
| `410017 / 10017`，FLASH LIGHT | 4人/4组合跨组；3确认报酬卡＋1同期派生卡、161奖励行 |
| `event:20001 / 20001`，315カーニバル | 本期剧情/阅读/参演/客户端卡与奖励均0，但独立Wiki仍补录3兑换卡＋19行，不可称整页无交互 |

先看1280/320及content偏窄的780/820：story-band/cast列、长标题/姓名、阅读CTA与summary/select命中区、中文回调及卡片/人物/组合往返。再按证据迁移本页字体、spacing和共享消费者局部样式，保留banner940/510、奖励图72、logo70×38以及cast的visual/portrait分支。

必须保持确认报酬、同期派生与Wiki独立来源，路由身份与奖励eventId分开，canonical cast同序/分片身份校验、首章文件对应ready阅读的算法不变。旧`verify-event-story-navigation`只遍历manifest36活动，当前catalog38条storyAvailable，不得写成59详情全面验收。QuickView、Solo和剩余筛选URL合同另批处理；Dialog M继续保留生产密度直到用户选择。
