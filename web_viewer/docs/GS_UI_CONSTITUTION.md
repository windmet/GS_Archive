# GS Archive UI Foundation

2026-10-03。初期输入 HEAD `89f61110`；上一轮主门户/UI 审计截止 `89278976`。初期先迁移 Portal、StoryDiscovery、Collection 目录与 CollectionDetailPanel，后续各域按相同角色逐步迁移。Chibi、Reader 正文与 Player HUD 不在初期Foundation迁移范围；后续歌曲消费者批次单独记录，不将历史范围说明当作当前完成状态。

第二批目录迁移以`d0b6fc24`为基线，已接入Shell搜索、人物/组合、歌曲和活动目录。具体Before/After、Browser旅程与剩余行为问题见[目录基础验收](GS_UI_DIRECTORY_FOUNDATION_ACCEPTANCE_20261003.md)。该阶段人物和歌曲详情本体仍保留原规则，不能因入口已验收就称为详情全域验收；后续实体与歌曲响应式批次的完成状态见下文。

接续的[目录语义与浏览状态验收](GS_UI_CATALOG_CONTINUITY_ACCEPTANCE_20261003.md)已处理歌曲重复身份/搜索焦点、歌曲和活动未知统计，以及活动目录完整browse URL与延迟恢复。活动面包屑仍是默认筛选的层级入口；精确返回由Shell返回/from/Browser history承担。

## 基础语法与页面性格

基础定义见 [GS_UI_TOKENS.css](../src/styles/GS_UI_TOKENS.css)。该文件只声明变量，不全局重置 `h1`、按钮或输入；组件选择适合自己的角色。新 UI 先选择角色，再选择尺度。现有数值不因不在尺度中就自动成为缺陷。

| 页面 | 应保持的性格 | 本轮接入方式 |
| --- | --- | --- |
| Portal | 游戏门户、品牌层级、非对称入口轮廓 | 入口文字、分组节奏；品牌标题独立 alias |
| 资料目录 | 搜索和筛选优先、密集可扫读 | 控件、结果行、metadata；手机切换触摸尺度 |
| Reader | 连续阅读、舒适行高、主题完整 | 保留阅读专用 token，另域迁移 |
| Player / Studio / Chart | 沉浸式工具、画面和操作优先 | 保留 HUD / viewport 规则，另域迁移 |

## Typography、spacing、control

| 角色 | 默认值 | 用途 |
| --- | --- | --- |
| caption | 11px | 次要状态、小标记；不用作主操作名称 |
| meta | 12px | 数量、来源、辅助字段、紧凑标签 |
| ui | 13px | 桌面按钮、搜索与筛选 |
| body | 14px | 目录主要文字与详情正文 |
| subtitle | 16px | 重要入口标签、小节中的主要内容 |
| section | 18px | 详情中的章节标题 |
| title | 22px | 实体标题、普通页面标题 |
| portal | 26px / 窄屏23px | 已有门户品牌标题；不覆盖资料页标题 |

正文400；metadata400/500；操作标签600；section700；品牌800。目录卡片名称可用600/700表达扫描层级，不能把所有字段加粗。字体保留 Portal 的 SC→JP 与目录的 JP→SC 回退顺序，弹窗应显式选择字体，不依赖 Teleport 外的祖先。

默认间距使用 `2 / 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40px`。图标几何、图片尺寸、断点、sticky offset、安全区不属于 spacing 角色。门户90/82px大入口、非对称10/20px角、藏品图像与四列格子都有内容理由，可以保留。文字基线微调也可以保留，但应注释理由。

桌面控件 compact32、normal36、toolbar40；手机或 coarse pointer 的直接操作命中区至少44×44px（文字按钮可更宽）。触摸搜索/表单输入字号至少16px。大入口和目录卡片由其内容高度决定，不能按普通按钮统一压缩。全站旧 `.domain-page` 的44px规则暂不修改，仅迁移试点的局部规则。

圆角 control6、field8、panel12、surface16、pill；品牌轮廓允许局部变体。浮层沿用现有 surface shadow；不为普通目录卡片增加阴影和上浮。反馈动效只服务状态变化，默认120ms，不引入新入场/循环动画；已有 reduced-motion 规则继续生效。

## 页面信息顺序

默认顺序：页面身份 → 搜索/主要操作 → 一级筛选 → 可选二级筛选 → 结果数量/状态 → 内容 → 来源与技术资料。

- 顶栏承担页面身份，不在内容区重复一个同名大标题。
- StoryDiscovery 手机筛选是 inline disclosure，展开状态不等同于 modal sheet；折叠后仍保留所选条件。
- Collection 手机将当前结果数量放在种类 tab，保留紧凑入口；这是同一信息角色的响应式位置变化。
- 实体名称与可读说明在前，原文/编号/资源键随后；未知来源直接说尚未收录，不推断获取方式。
- 已有中文/原文检索、实体身份、语言切换与历史数据边界继续使用现有解析层，CSS 迁移不另建身份映射。

## Surface 合同

| 角色 | 现有对应 | 尺寸与行为 |
| --- | --- | --- |
| Popover | 藏品 hover/focus 说明 | 锚定内容、不改目录布局；不能承载必须操作的完整详情 |
| Dialog S | 简单设置候选 | token420px；本轮未切换现有设置窗口，需实际比较 |
| Dialog M | Collection 详情 | 580px；桌面最大84dvh，手机底部78dvh；用户已选 Compact，待独立生产迁移 |
| Dialog L | Terminal 素材选择 | 720px；header固定、body滚动、原生dialog |
| Side Drawer | Solo、活动藏品快捷查看 | 480px；长名单与原上下文并存；两个消费者布局各有明确用途 |
| Mobile Sheet | Collection 详情、Solo | 分别78/85dvh；不是统一高度，确保内容与关闭操作可达 |
| Fullscreen Tool | 摄影、谱面、舞台 | 自己的 viewport / HUD 合同，不套详情窗口宽度 |

窗口标题和实体名称是不同角色；不得用“所有h2一样大”替代合同。现存 Collection 窗口标题17、Terminal20暂保留，详情密度对照选定后再迁移 surface-title。header/body/section spacing 应按密度有命名依据；只在存在动作时加footer，不能创造空白固定操作区。

共同操作合同：打开后焦点进入窗口；Escape和背景点击关闭；Tab不得逃到背景；关闭后恢复trigger焦点；滚动内容不能带动背景。关闭按钮至少44px。安全区变量放root，Teleport/native dialog在自己的surface上接入；桌面零 inset 的Browser不能证明真机刘海验收。

本轮另批修复 native dialog 内搜索输入的 Escape：阻止浏览器先清空 search query，使第一次 Escape 关闭最内层窗口，并恢复原有打开控件焦点；嵌套的外层窗口保持打开。URL刷新直接恢复的详情没有实际点击trigger，关闭后焦点回退仍待后续行为批处理。

现有状态差异必须按用途保留：

- Collection详情 `entity` 在URL中，关闭清除entity，保留搜索筛选；刷新明确entity应恢复详情。
- CollectionQuickView是活动页临时状态，关闭留在活动页；“完整查看”才进入详情URL。
- Solo选择即时生效并关闭，查询/unit暂存在组件内，不写URL。
- StoryDiscovery的query及父级domain/section/availability/sort等在URL；series/idols/unit/language/page等模块状态在Reader往返保留，刷新重置。完整URL化是后续行为批，不在样式批中悄悄承诺。

## Loading / Empty / Error

加载使用当前资料域状态，失败保留重试入口；搜索零结果与尚未收录数据分别表达。保留已加载内容的可操作性与现有请求身份保护；不得把源码/构建完成当成真实媒体准备完成。当前原始资料可折叠，未知出处不补假badge或假说明。

目录未完成读取或读取失败时，统计以“—”表示未知，不暂显真实零。搜索无匹配只有在目录已成功加载后才显示零结果。歌曲页身份由Shell标题承担，内容说明与统计保留；搜索框自身需提供可见焦点反馈。

卡池门户读取失败在当前门户notice内提供重试，目录本体的重试保留搜索、类型和来源。横滚分类按钮保持自然宽度，触摸44px不能使长标签收缩重叠；焦点环在该横滚轨道内侧显示，避免被裁切。

摄影搜索与偶像select在加载/失败时常驻，触摸输入16px；表情/动作内容与工作台CTA必须匹配当前偶像及媒体身份。零结果可以保留有效详情，明确无效key不能冒充首条。目录数据成功ready后只消费一次入口焦点恢复；搜索、换人、选择或退出会取消旧入口待恢复与迟到定位。

## 首批迁移与验收

| Before | After | Why |
| --- | --- | --- |
| 门户 core padding15、section gap9、copy gap5，各自决定 | 16/8/4语义间距；品牌/大入口保持 | 重复决定可复用，门户轮廓保留 |
| Story行gap13/padding9×14、series文字11 | 12/8×12；操作标签meta12/600 | 目录节奏一致，辅助信息与可点操作分开 |
| 手机藏品search38px/12px，tab/select/chips32–36px | 搜索16px、直接操作触摸尺度44px | 提高真实操作可达性；验证增加高度后的内容空间 |
| 详情Teleported后依赖外部祖先的字体/标题样式 | surface显式字体与正文/章节/metadata角色 | 同一组件不因挂载位置改变文字层级 |

密度探索见 [详情对照页](prototypes/gs-ui-surfaces/index.html)：Compact、Balanced、Reading-heavy三个可操作版本，使用真实GS长名称/缺说明/未知来源数据。用户已明确选择 Compact，后续生产详情按该密度分批迁移；不得把原型页导入App或把多个变体塞入生产运行时。

回归使用当前真实corpus：535道具、1613称号（附件1616与当前数据不同），长道具`303398`、长称号`30025116`、长故事`1_3_10012_01.json`、中文/原名以及0/1/49检索。320px覆盖与真实200% Browser zoom、真机覆盖分别记录；窄viewport不冒充zoom或真机。

日常代码验证使用 `npm run build:check`，固定 `.analysis/build-check`，不复制public。Browser必须核实代码bundle、资源映射与真实旅程；截图/小日志保存在本checkout `.analysis/ui-foundation-20261003`。详细结果见 [本轮验收](GS_UI_FOUNDATION_ACCEPTANCE_20261003.md)。每批显式stage、commit/push，保留其他窗口工作。

卡池/摄影的目录角色、空/错状态与控件连续性已实测迁移，见[该批验收](GS_UI_GASHA_PHOTO_ACCEPTANCE_20261003.md)。卡池/歌曲实体详情的文字、实际内容宽度、触摸操作和声部姓名一致性见[实体详情验收](GS_UI_ENTITY_DETAIL_ACCEPTANCE_20261003.md)。完整实体名称在详情头部保留，避免Shell窄屏省略号成为唯一身份表示；它与目录中的重复页面标题有不同阅读职责。

歌曲折叠归档返回与卡片详情已完成独立批次，见[歌曲返回/卡片验收与下一批样本](GS_UI_SONG_RESTORATION_CARD_ACCEPTANCE_20261003.md)：歌曲只展开拥有原入口的归档，卡片按内容宽度折列并保留媒体几何，实际覆盖侧栏仍在的780/820px、长姓名与长技能说明。

人物/组合详情已完成独立批次，见[人物 / 组合验收与活动样本计划](GS_UI_IDOL_UNIT_ACCEPTANCE_20261003.md)：人物展示姓名跟随既有语言回调，content800px以下切换器折列，组合完整成员姓名和触摸CTA统一角色；原始资料、头像/logo/背景几何与可选章节合同保留。实际覆盖`029ass`、`02dra`、`10caf`、`14fla`及代表卡片/歌曲/成员往返，未访问入口仍单独记录。

活动详情已完成独立批次，见[活动详情验收与后续窗口计划](GS_UI_EVENT_ACCEPTANCE_20261003.md)：实际覆盖长活动名`410012`、五人长姓名`430013`、跨组合`410017`、独立 Wiki 兑换`event:20001`、三人立绘`410011`及季节入口`event:40002`。中文姓名沿用既有展示回调；内容800px以下剧情/章节/人物区折列，520px以下才隐藏章节统计；170px立绘、230px画架与 Wiki 表格局部横滚保留。阅读、报酬卡、组合、同期关联及季节企划返回均按实际原入口验证。59详情来源/SHA核对和代表旅程覆盖仍是不同边界。

QuickView/Solo 已完成消费者局部样式批，见[快捷窗 / Solo 验收](GS_UI_SURFACE_ACCEPTANCE_20261003.md)：480px宽、Solo手机85dvh及即时选择合同保留；320px/桌面和受控非零安全区 CSS 已实测，真机仍未覆盖。QuickView“完整查看”返回和 RewardTable 的 scope/page 恢复分别作为行为批：先确认实际往返与状态，再加入必要的入口/就绪合同，不能把一个行 marker 当成分页恢复。共享 TerminalDialog、Player HUD 与其他窗口工作保持各自范围。

歌曲目录 / 活动报酬扁平列表与Mobile外围布局已独立验收，见[Compact列表 / Portal修复](GS_UI_COMPACT_LIST_ACCEPTANCE_20261003.md)：歌曲名完整换行、减少边框与整项箭头，完整演唱范围仍可检索；活动阅读条件按真实episode ID映射章节，保留活动期限定、点数起点、次数和数量。目录没有属性 / BPM字段，不由示例补造。Portal文字区规则不得匹配共享头像根span；担当头像保持42px方形合同，制作人显示复用既有P宏Presenter，输入 / 保存值不加后缀。

歌曲控制台初期局部改版见[歌曲控制台验收](GS_UI_SONG_CONSOLE_ACCEPTANCE_20261003.md)：删除头部重复统计，形态仅保留一个badge，日期降为metadata；缺播放投影仍明确状态。当时采用四模式自然宽度横排 / 横滚、不换字、触摸44px；歌曲显式启用图形播放 / 暂停与归零，进度在上，默认语音控件保留。320 / 780的真实Before与320 / 780 / 820 / 1280的After分别记录；实际组合、Solo、五槽、收录音轨与单轨播放已核验。该文档及5203是历史验收，模式排列已由后续B方案替代；音轨、编成和舞台handoff合同继续保留，没有新增循环 / 随机或虚构媒体形态，Chibi视觉交接不由控制台验收证明。

用户继续反馈后拒绝C、允许A / B中判断，本批选择B，已完成单一原生试听入口及Solo确认 / 取消；自然页面歌词保留真实时间轴seek，6事件预览 / 全文、gap与focus守卫，不自动滚动页面。宽屏标题 / 面包屑、真实制作资料 / Hero与试听排列已完成；试听仅在能容纳时sticky，高内容 / 短视口自然流。见[歌曲响应式验收](GS_UI_SONG_RESPONSIVE_ACCEPTANCE_20261003.md)：保留first candidate的离屏失败及最终fit-only证据；B是实现选择，不是用户指定B。手机封面ambient与右侧半透明胶囊已实际核对320 / 390 / 780 / 1280px，长标题 / 标签自然换行、内容增高，不锁高度；四个代码批已分别提交 / push，最新视觉pin与完整性收据独立记录。真实数据没有BPM或逐句角色映射时不补造。

下一批优先迁移已选Compact的Dialog M，再将剧情拆为轻量章节行、消费者内简介折叠、仅主线的话级Tabs；主阅读 / 次播放入口、队列及来源返回分别验证。保留真实对白 / 语音统计，不把整部出演阵容当逐EP cast。Mobile外围批未改内部播放器、列表P宏或增加时长，标题展示另作来源明确批次。真机和CSS安全区样本保持各自边界。

用户本轮指定长歌名头部方案二：封面 / 标题上半部与独立通栏元数据底条，已完成320 / 390长短名、320特殊版与780 / 1280长名的实际Browser及真实SFC验收并独立commit / push `05405c97`；标题clamp仅随内容宽度、日期history优先，标签 / 日期允许自然换行，详情见[元数据底条验收](GS_UI_SONG_META_STRIP_ACCEPTANCE_20261003.md)，不与上一轮试听模式B混淆。

关联衣装采用用户所选静态合并方案：本卡明确普通 / 突破款式关系、模型与原名匹配、原文和当前语言介绍完全一致时共用一份介绍，各款名称及原有Live / 剧情标签保留。完整来源与公开投影分别验证，手机局部自然流保留真实结构标题、独立引述与空段，桌面保留原文断行，不修改共享语音重排或补造获取条件。代码 `667ac0c3` 已独立commit / push，见[衣装与换行验收](GS_UI_CARD_COSTUME_FLOW_ACCEPTANCE_20261003.md)。
