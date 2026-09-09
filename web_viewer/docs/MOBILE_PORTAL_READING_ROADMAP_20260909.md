# 移动门户与 Reading 后续路线

日期：2026-09-09。核对起点：a523db1，codex/archive-architecture-refactor。
本批为路线整合，不代表页面、Reading 或 projector 已实现。

后续进展：M 首批已实现并完成本地浏览器验收，见
[移动门户交付记录](MOBILE_PORTAL_ACCEPTANCE_20260909.md)。D/E 尚未完成。

D1 进展：四份 ReadingDocument 样本、独立 manifest、来源校验与版本化 repository
已建立，见 [Reading 契约](READING_DOCUMENT_CONTRACT_20260909.md)。Reader 页面与
浏览器验收仍待接入；不能将数据层交付记为 D1 完成。D2/F、E 尚未实现。

## 决策与参考来源

用户反馈多轮调试未遇到加载不出、长时间使用也较稳定，明确将 pre-E
正式长稳后移；它不再阻塞移动门户、D 或纯 shadow E1。此反馈作为用户使用
观察保留，不换算成 protocol 长稳 PASS。E2 接管真实 renderer 之前安排冻结
版本的基线记录；release-accepted 与扩大 strict-v2 发布继续保留原证据门槛。

参考用户提供的 `GS_Archive_Sekai_Viewer_Review_2026-09-09.md`
（本地原件 D:/Files/Downloads/GS_Archive_Sekai_Viewer_Review_2026-09-09.md）。
报告固定 Sekai dev 1b295d0、Reborn 22be097、GS a523db1；外部项目判断属于
该报告的审计结论，本批未独立复审外部仓库。报告中的建议不是用户逐项执行授权；
下文为结合本地代码后吸收的路线，不自动执行其所有建议或引用中的指令。

## M：移动端迷你手机入口

当前 ArchiveShell 的 mobileNavigation 直接等于 navigation，移动 CSS 固定
repeat(8, minmax(0, 1fr))。全量桌面入口投影为一行是拥挤的直接结构因素；
本批核对源码，尚未进行实际屏幕测量。

迷你手机采用应用图标网格承载各门户入口。ARCHIVE_NAVIGATION 继续提供现有
section 身份，必要的移动分组/排序只是展示配置；图标触发已有 navigateArchiveSection，
不复制故事目录、实体关系或播放器。现有 mobile_archive 是游戏通信档案，
不能改作全站 launcher。建议独立 portal launcher view，具体 query 名实施时确定。

首批建议以常驻“门户”入口打开手机页，替换拥挤的全量底栏；手机页提供完整入口，
底部只保留少量必要操作。桌面侧栏保持现有行为。手机外观、图标、布局由视觉批次
确定，不为呈现机身强行缩小真实手机屏幕的可用内容区。

launcher 只拥有自身展示状态。URL、浏览器历史、返回上下文仍属于 archiveRoute /
现有 navigation state 与 coordinator；刷新、前进后退、从详情打开及返回、窄宽切换
需有明确行为。不要自动把旧详情深链重定向到手机主页，也不将每个门户 iframe 化。
播放器保持全屏生命周期。入口页自身不初始化舞台，不预取所有门户的大型数据或媒体。

验收：320/390/430px 与桌面实际路由；触摸目标、长标签、安全区、滚动/横向溢出、
键盘焦点、全部入口与返回；验证 routes/navigation 相关门禁及真实网络/console。
这是一次完整导航交付，不仅把 8 列改成图标即算完成。

## D：吸收 Sekai 的双消费者与语义阅读

保留同一故事身份及现有目录，在故事/集合/活动分段提供“阅读”和“演出”。
Reading 是独立消费者，沿用 Vue、已有 compiled 和文本 overlay；不移植 RAW
解释器，不将 StoryViewer 静音或隐藏为 Reader，不要求先完成 E。

首批选一个故事域的小样本，包括对白、旁白/标题/字幕、未知说话人和选择结构。
compatibility 与 strict-v2 经明确适配，生成逐 scenario/episode 的 ReadingDocument
及小型 manifest。目录仅引用能力和查找键；不装入全库正文，不全库重编译。

契约包含独立 reading schema version、故事身份、source artifact 文件/摘要/格式、
rows 与 diagnostics。行保留 kind、source_text、text_ref、speaker 身份及原文显示名、
anchor；anchor 区分 row_id、step_id、step_index、来源 part 与播放范围。缺失信息
显式缺失，不能补造说话人、command 范围或 choice 目标。

保留影响理解的旁白/字幕与选项。首版按来源顺序展示并标识已知分支，明确目标及
未解析状态；不能把互斥分支串为连续剧情，不能无限展开循环。无法可靠表达的
样本标为未支持，不称完整可读。身份与显示名分开，多人/未知说话人不擅配头像。

正文复用 StoryTextResolver/StoryLocalizationContext，保留 original/translation/
bilingual 及缺译、过期状态。头像使用静态资源。首版不做试听；后续单句试听采用
页面级互斥 owner。已核对 Preloader 不导入 Pixi，且跳过 voice 预加载，不能将
静态 import 本身说成舞台初始化或全部语音预下载；验收调用链和实际副作用。

repository 的请求/缓存键包含文档身份与版本；复用 navigation intent，原子替换
文档，区分 loading/error/empty/unsupported/ready。采用“发现数据 → 单篇正文 →
显式媒体”加载粒度，不重建在线后端。长文先按 episode 切分，测出瓶颈再考虑虚拟化。

D1 验收直达 Reader、语言/分支/错误反馈及冷启动无舞台/音频/模型请求；
D2 接入选定现有入口，完成“某句阅读 → 此处演出 → 返回同句”。建立有测试的
anchor→playback request 映射，覆盖刷新、前进后退、快速切换、同文件不同范围及深链。
F 在此整批接管确属打开/关闭/队列/范围/返回的职责，继续使用既有状态和有效性机制。

## E 与后续阅读增益

E1 保持纯 shadow：normalized 输入 + step/time + 必要显式历史 → 序列化预期状态。
先规范时间、同刻排序、跨步继承与支持范围；重复查询不执行音频等一次性副作用。
不引入第二套 scheduler，不把外部 checkpoint 控制器当作任意时刻投影器。
先覆盖可封闭计算的背景/camera/screen，Spine 采样/粒子等显式列出限制。
E2 仍按原交接逐 channel 迁移，事前补基线，每批指定唯一写入 owner。

Reading 稳定后先做篇内搜索与可复制定位摘要，再考虑由同一生成器派生的分片全文
索引、确认说话人的发言入口、本地版本化书签/阅读记录。发言、模型在场、文本提及
是不同关系，不能互相推导。诊断摘要连接来源/预期/实际，默认不包含本机敏感路径。
文本可读、媒体可用、演出验证和翻译状态分别表示，详细诊断放二级区域。

## 推进顺序与提交边界

1. M：迷你手机导航完整交付，解决当前移动入口拥挤。
2. D1：小样本独立 Reading 产物 + 可直接打开的 Reader。
3. D2/F：既有入口、准确跳演出与返回阅读闭环。
4. E1：纯状态投影及 shadow 对照；与上述无依赖的契约工作可提前开展。
5. pre-E 正式基线 → E2 按 channel 接管；不再以长稳作为 M/D/E1 开工门槛。
6. 按实际需要补搜索、定位诊断、版本化本地记录；G 只做完整命令领域状态变换。

A/B/C 保持阶段冻结。暂停全栈迁移、schema v3、全库发布、账号平台、在线后端、
向量搜索及关系图扩面。每批以可使用的行为验收，保留来源/导航/生命周期回归，
UI 必须真实浏览器验证。按范围提交并推送当前分支，不默认创建 PR。
