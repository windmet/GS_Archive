# GS Compact 列表验收（2026-10-03）

本批处理歌曲目录、活动报酬卡、Mobile 通信外围列表 / header，并纳入 Portal 工作台头像的局部修正。用户已选择 Compact；正式 Collection Dialog M 仍待独立迁移。角色与范围沿用 [UI 宪章](GS_UI_CONSTITUTION.md)、[Foundation 验收](GS_UI_DIRECTORY_FOUNDATION_ACCEPTANCE_20261003.md)及[前一批 QuickView / Solo 验收](GS_UI_SURFACE_ACCEPTANCE_20261003.md)。

**状态：三个代码批已完成对应回归、code-only 构建、实际 Browser 验收并分别提交 / 推送。正式 Dialog M 与歌曲详情内部改版仍属后续批次。**

## Before / After / Why

| 消费者 / 真实样本 | Before：已捕获的 Browser 事实 | After：实际 Browser 结果 | Why / 保留的职责 |
| --- | --- | --- | --- |
| 歌曲目录，320px；`drvalv`、Beyond The Dream 与全目录长名 | 行约 296.47×72px，独立边框 / 圆角与整项箭头；标题 15px、单行省略。全目录实查 60 项，9 个真实标题文本宽度超过可用宽度，例如 The 1st Movement ～未来のための二重奏～ 为 302 / 169px。`drvalv` 显示“自由编成 · 全组合可选”。 | 60 项标题均未横向截断；标题16px自然换行。The 1st Movement 行高80.69px，仅底部分割线、圆角0、箭头0；显示“自由编成”，完整演唱文本仍用于 title / 搜索。 | 目录先呈现歌名与演唱范围。保留实际封面、版本 / 媒体标记和数据口径；目录没有属性 / BPM 投影，不补造颜色或数值。Before 的 Beyond The Dream 与末项本就完整可见，不将它们描述为已复现缺陷。 |
| 活动 `410012`，320px；次郎 / 类 / 道夫报酬卡 | 3 个卡条目均有独立边框、12px 圆角及箭头；条目高约129.98 / 129.98 / 146.77px。道夫阅读条件显示“剧情 4100120110 阅读报酬（活动期内）”。 | 轻量分割行、独立稀有度徽章，72px缩略图保留；行高131.42 / 131.42 / 114.63px。道夫显示“第10话 阅读（活动期内）”，日文为“エピソード10”；碎片分别为62,000 / 80,000 / 8,400 PT起，各4次、共×4。 | 精简框线与条件，但不承诺每行都缩短。阅读条件按reward key、卡目标及真实episode ID匹配；未知 / 歧义 / Panel / repeated等保留原label。资源ID后缀不当章节序号。 |
| Mobile 电话 `004ter`，320px；10条记录 | header210px，说明74.92px，tabs60.09px（含约16px原生scrollbar），首行top479.21px，2行完整可见。台词11.2px / 700，条件8px / 22px，播放36px，select10.72px / 34px；手机隐藏元数据。 | header157.13px、48px头像；tabs44.91px且scrollbar:none；说明默认收起、可展开原文；首行top376.16px。台词14px / 400，条件13px，播放 / 箭头44px，select16px / 44px。类型图标并入日期行，正文宽229.30px。 | 首行提前103px，并恢复可读字阶及触摸尺度。首条由旧122.35px到165.08px，首屏仍是2整行＋第3条预览，不能宣称首屏4–5条。中间候选的191.01px首行已因图标占列问题修正。完整台词、条件及日期均保留。 |
| Mobile，780 / 1280px；个人 / 组合 / 随机与长姓名320px | 780px内容宽609px，旧选择器未溢出；header190px，元数据8px。冬马个人14个bundle / 20个scenario，台词含P宏。 | 780 / 1280电话header104.22px，无横向溢出；冬马个人14条仍对应20项解锁记录；W组合3条含三项长条件、表情及缺脚本禁用入口；辉随机5话题 / 7开场语，全天 / 间隔14天保留；阿斯兰日文姓名完整换行，header222.81px、select44px。 | 按实际内容宽度排布，长姓名及源profile自然增高，不承诺固定70px头部。随机候选解释仍显示，不能误作连续历史。Mobile列表P宏未在此layout批替换。 |
| Portal工作台，320 / 1280px；冬马 / 阿斯兰 | 按钮宽270.63px；头像shell105.74×42px、图109.84×38.44px，被通用span flex规则拉宽。设置输入windmet、预览windmetP，门户却显示windmet。 | 专用文字class后头像恢复42×42、flex:0 0 42px；中文冬马与长日文阿斯兰均通过。门户复用现有Presenter显示windmetP，输入仍windmet；空值显示“未设置制作人”，最终5202刷新保留担当和windmetP。 | 修正局部选择器碰撞与展示口径，不改共享头像、保存值、P宏规则或App。没有新增去重P规则。 |

## 已有证据与回归边界

Song / Event 的 [Before 状态收据](../.analysis/ui-lists-20261003/before-state.json)记录工作区 HEAD `467cbb388a702479981f4957d82cecaf1a088d17`；Mobile 的 [Before 状态收据](../.analysis/ui-mobile-list-20261003/before-state.json)记录 HEAD `cabf0c86a4a489cac9d1bc5f649cb8dfe45dd3dd`。两次实际预览均来自 PID `63344` 的旧代码 pin，code build HEAD 为 `3770316e2d89b849ab2738bca8e0cae1fdcbe629`。工作区 HEAD 与浏览器所看 RAM pin 分开记录，不能用编辑后的源码 SHA 替代 Before 页面身份。

主要 Before：歌曲 [DRIVE A LIVE](../.analysis/ui-lists-20261003/song-before-320-drive.json)、[BEYOND THE DREAM](../.analysis/ui-lists-20261003/song-before-320-beyond.json)、[全目录长名测量](../.analysis/ui-lists-20261003/song-before-all-320.json)；[活动报酬](../.analysis/ui-lists-20261003/event-before-320.json)；[Portal 工作台](../.analysis/ui-lists-20261003/portal-workbench-before-320.json)；Mobile [电话 320](../.analysis/ui-mobile-list-20261003/phone-before-320.json)、[电话 780](../.analysis/ui-mobile-list-20261003/phone-before-780.json)、[个人 320](../.analysis/ui-mobile-list-20261003/personal-before-320.json)。同目录 jpg 是实际截图；本文件不将源码候选追加为 Before 缺陷。

| 已保存日志 | 实际结果 | 能证明 / 不能证明 |
| --- | --- | --- |
| [Song domain](../.analysis/ui-lists-20261003/song-domain.log) | 60 works / 61 song entities、47 个确认的 unit 映射、13 首明确 performer 歌曲及双向实体链接通过 | 数据 / 源码合同；不能证明换行、触摸或返回焦点。 |
| [Terminal localization](../.analysis/ui-lists-20261003/terminal-localization.log) | 42 个真实 SFC render 场景通过，含报酬 episode / 点数 / 碎片来源绑定、Wiki 兑换限制、缩略图独立重试及首章阅读守卫 | SSR 展示 / payload / 回退合同；日志明确不代表 DOM、pin 的 read-model 字节或播放验收。 |
| [Mobile identity](../.analysis/ui-mobile-list-20261003/mobile-identity.log) | 49 idols / 16 units，过期 URL / selection 拒绝及未知状态安全通过 | owner / selection 身份合同；不能证明新外围排列或内部媒体播放。 |

同轮实际执行并通过 `verify-reward-presentation.mjs`、`verify-event-story-navigation.mjs`（36事件 / 396章节）、`verify-event-view-consumer.mjs`；Mobile的 `verify-idol-communication-index.mjs`（1269 scenario / 1268 compiled、342电话 / 830个人 / 97组合，保留已知缺脚本）、`verify-archive-inline-presentation.mjs`（155技能级及表情合同）；Portal的 `verify-producer-addressing-runtime.mjs` 与 `terminal/verify-terminal-contracts.mjs`（40项）。源 / 合同回归不替代下面的Browser结果。

## After、构建与冻结

- Song / Event + Portal构建输入HEAD `6eae38fd7876a1717812ae64a216c519ead5aba5`，`build:check` exit0 / 24.17s，见[输入SHA](../.analysis/ui-lists-20261003/build-input-final.json)与[日志](../.analysis/ui-lists-20261003/build-check-final.log)。Before已保留，中间未含Portal的16.74s构建不冒充最终验收。
- Mobile窄列改动后重新构建：输入HEAD `f6894978338f485cd8008b9b0e503696bcafa0ef`，exit0 / 22.19s，见[最终输入SHA](../.analysis/ui-mobile-list-20261003/build-input-final.json)与[日志](../.analysis/ui-mobile-list-20261003/build-check-final.log)。五个消费者 / App源码与构建输入核对后才启动服务，Mobile最终SHA `01e69e807763819c87fe917b855c9362de8fafb8b123487eea1fd026da275580`。两次均固定 `.analysis/build-check`、不复制public；有现存大chunk提示，非发布包。
- 5201 / PID49744服务验收Song / Event + Portal，[RAM pin](../.analysis/ui-lists-20261003/pinned-code.json)190文件，main `index-DOLOipPg.js` SHA `cc5494e2ecdcb7cb6047919f9f6f7077bc2d8388829cf6e640269fe86ef769e0`。03:07:16Z[请求收据](../.analysis/ui-lists-20261003/after-integrity.json)：589请求、HTTP失败0、所请求代码与pin不一致0、stderr0。一次错误QA路由`event=20001`被既有恢复保护拒绝，console记录1条；之后从活动目录进入真实`event:20001`成功。不能说console全程零错误。
- 最终[预览5202](http://127.0.0.1:5202/?view=portal) / PID53252验收Mobile修正及Portal刷新，[RAM pin](../.analysis/ui-mobile-list-20261003/pinned-code.json)190文件，main `index-_6Qok3fM.js` SHA `d3d14357f9ac1c417a3ba08ce9476b809dc2d5ffadeeb4147b796a369f916113`。03:07:17Z[请求收据](../.analysis/ui-mobile-list-20261003/after-integrity.json)：105请求、pin不一致0、stderr0；HTTP失败1为电话播放器可选中文翻译 `004ter_401_2_4_004_01_09_b.json`缺失，实际日文台词回退可见。该origin无warn/error console，[完整日志](../.analysis/ui-lists-20261003/browser-console.json)仍保留5201错误路由诊断。
- 两服务沿用已核实 `E:/Web_build/GS_Archive_Domain_Work/song-discovery-readmodels-20261002` 与public / 配置素材映射，release `d30e1e94cc6a1089a9e7ecbf6111ff63be0bfdc714293c2ebca319976fde364a`；编译代码固定在RAM，后续磁盘rebuild不改变所看版本。5199旧pin、5201阶段证据及其他窗口服务保留。

实际旅程与文件：

- 歌曲：[60项320测量](../.analysis/ui-lists-20261003/song-after-all-320.json)、[长名截图](../.analysis/ui-lists-20261003/song-after-long-320.jpg)、[列表旅程](../.analysis/ui-lists-20261003/song-after-journey.json)。完整“全组合可选”搜索仍命中5首；3DMV11项、零结果状态正常；Pavé详情返回保留query / 3DMV及焦点`song:pavetl`。末项bottom750.61px < navTop826.24px，原76px底部padding保留。1280双列、46px封面，无页面横向溢出。
- 活动：[410012测量](../.analysis/ui-lists-20261003/event-after-320.json)、[截图](../.analysis/ui-lists-20261003/event-after-320.jpg)、[Wiki卡测量](../.analysis/ui-lists-20261003/event-wiki-after-320.json)。次郎卡打开及返回焦点`event-card:410012:reward:037jir_sr06`；奖励161项 / 7页，实际翻到2/7再返回1/7；“活动期内剧情”过滤2项、Physical徽章QuickView开关成功。Wiki兑换卡的40 / 35 / 15、限兑1次及来源标记保留；长中日姓名、320 / 1280无页面溢出。缩略图重试仅有真实SFC回归，本批未做Browser故障注入。
- Mobile：[最终电话320](../.analysis/ui-mobile-list-20261003/phone-final-320.json)、[780](../.analysis/ui-mobile-list-20261003/phone-final-780.json)、[1280](../.analysis/ui-mobile-list-20261003/phone-final-1280.json)、[个人](../.analysis/ui-mobile-list-20261003/personal-final-320.json)、[组合](../.analysis/ui-mobile-list-20261003/unit-final-320.json)、[随机](../.analysis/ui-mobile-list-20261003/random-final-320.json)。details实际展开 / 收起，第四个横滚tab可点击；004ter首个电话打开原播放器，选择当前方向后出现真实台词并返回原电话列表，不宣称长音频或所有台词已播放。阿斯兰日文[截图](../.analysis/ui-mobile-list-20261003/long-name-final-320.jpg)完整换行；W的缺脚本记录仍禁用播放，未改写其来源。
- Portal：[5201中日 / 长姓名记录](../.analysis/ui-lists-20261003/portal-workbench-after-320.json)、[5202最终测量](../.analysis/ui-mobile-list-20261003/portal-final-320.json)、[截图](../.analysis/ui-mobile-list-20261003/portal-final-320.jpg)。通过UI保存windmet及担当，重新打开输入仍windmet，门户windmetP；关闭恢复工作台入口，刷新后设置保留。

独立代码提交均已push到 `codex/chibi-stage-reconstruction-20261002`：Portal `117e9aac1291dabe8abdaecb0569bc68ba5e0770`；Song / Event +真实SFC回归 `f6894978338f485cd8008b9b0e503696bcafa0ef`；Mobile `b20c3fcea33236261d5d844d884d11443be44a2f`。并行Chibi提交自然保留在历史中；显式stage本批文件，未回退 / 覆盖共享工作区。文档检查不再构建。

## 保留与未覆盖

Mobile 本批只改同组件外围 header / list / scoped CSS 及必要模板排列；script、emit、owner 身份、P 名 Store、共享内部播放器保持原合同。列表不增加时长、行内播放器或新的 P 设置；没有以示例补造 metadata。原 `projectCommunicationInlineContent(bundle.title)` 投影保留，列表标题中的 P 宏没有在本批替换，后续需独立展示批验证。电话、个人、组合及随机模式的真实条件、日期、候选说明仍可读。

Panel 条件保留为明确遗留：本批的活动报酬短条件只在来源匹配且有充分字段时转换；Panel 条件的显示名称 / 规则需要完整映射与独立样本，不将内部 ID 猜成名称，也不丢弃活动期、点数起点、次数、重复或限定条件。共享 RewardTable 的 scope / 分页返回状态及 QuickView 完整查看返回 Event 的 focus 属于独立行为批，不能由本次扁平外观验收推定已经修复。

外部 read-model、素材、社区资源与实体 / 剧情的映射沿用来源证据。SSR 的合成 fixture 与实际浏览器所载资源不同；构建没有复制 public corpus，不能代表完整媒体包装、远端资源可用、社区链接全量有效或部署验收。外部资源映射的新增 / 未映射条目、冷热缓存与资源失败重试，只按实际访问补记。本批不扩展或改写原始数据 / 映射。

真机、软键盘、实际 touch / wheel、缩放、屏幕安全区硬件表现、长音频与内部播放器连续播放均未由本批覆盖。窄屏 Browser 的尺寸 / 键盘检查与硬件验收分开；已有 CSS inset fixture 也不能替代真机。Chibi 与其他窗口的共享脏文件 / QA 证据保留。

## 下一轮

用户追加歌曲内部建议后，先研究该消费者，再接回M / Story计划。这些是后续工作，不是本批完成结果。

1. 歌曲头部瘦身：`ArchiveSongDetail.vue`的形态徽章与dl重复，去掉“试听：可试听”和重复音频形态，日期降为metadata；未提供试听仍保留明确状态。官方属性沿真实song字段，不从目录补猜属性。分轨 / 单轨 / 特殊版各取真实样本，按内容宽度检查封面 / 标题流式布局，不承诺所有长歌名强制单行。
2. 试听模式横向栏：320px真实DRIVE A LIVE的四按钮各57.12×70.24px、white-space:normal，已复现挤压换字；780px各125.06×44px正常。采用自然宽度、nowrap、44px触摸高度、可横滚的分段栏，保留原四模式语义 / 加载保护。现有版本320的DRIVE A LIVE标题22px / 169.31px、实际单行，不能把外部截图的折行直接记成本地已复现；780px头部426.26px的单列堆叠需要后续比较。见[320调查](../.analysis/ui-lists-20261003/song-internal-audit-320.json)、[截图](../.analysis/ui-lists-20261003/song-internal-audit-320.jpg)和[780](../.analysis/ui-lists-20261003/song-internal-audit-780.json)。
3. 控件排列 / 图形化只复用真实播放、暂停、seek、归零能力；目前没有循环或随机功能，不能先造按钮。Experimental归零暂停，SinglePlayer seek(0)可保持当前播放；`continuous:true`是Solo全程声部，不是单曲循环。保留音轨ID / URL、五槽 / 空槽静音、歌唱事件、归一化、舞台handoff身份及restart-at-zero合同。需要的下一批回归是song detail presentation、view restoration、experimental audio、stage handoff及terminal localization；这轮调查没有执行这些新增入口或实施歌曲内部改版。
4. 独立迁移已选Compact的正式Dialog M：保留580px / 桌面84dvh / 手机78dvh，以及真实来源 / 分页 / native dialog合同。再按主阅读 / 次播放整理轻量章节行、消费者内简介折叠及仅main的话级Tabs，分别验证Reader / Player队列与来源返回；不把整部阵容当逐EP cast。
5. Mobile列表P宏、Panel条件映射另立来源明确的展示批；QuickView→Event返回、RewardTable分页恢复另立行为批。
