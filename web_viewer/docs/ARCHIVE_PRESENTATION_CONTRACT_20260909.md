# H：档案展示与技术证据

用户提供的最新指导基于 `f343dda`；2026-09-09 用户再次明确长稳继续后移。
H 不以 P2-B 为开工门槛。暂不接管 renderer，不恢复 B28+ 主动微修。

## 第一批：Songs → RelationList → Idol / Unit

`buildSongPresentation()` 是歌曲展示的身份解析边界：输入现有 song catalog、
canonical idol/unit dictionary，以及已发布的试听 manifest。组件只显示已解析名称。
音频资源的三位组合别名只在此转换为正式两位组合身份；特殊 selector 不当作组合。
未知身份显示待确认并禁用对应人物/组合跳转，证据中保留原始 code。

资源收录、可试听与实验混音分别表达。媒体 URL、播放与编成时钟、演唱切换和
导航身份保持原契约；SongDetail、ExperimentalPlayer、LineupPlayer 不再依赖
IdolNameMap。实验混音和未完成听感校准仍在用户可见说明中明确标识。

`technicalEvidence` 保留完整输入 catalog、试听来源和实验 manifest。
`ArchiveTechnicalDetails` 使用原生 details/summary，默认收起，可键盘展开。
技术区保留原始表号、代号、cue、offset、资源与映射证据，不删除或重写源数据。

RelationList 默认呈现类型、标题、用户 metadata、可用状态和原有动作。
evidenceLabel/evidence/resource 进入独立折叠区；显式 showEvidence 模式可用于技术页。
折叠区不嵌套在导航按钮中，切换关系集合时重新收起。调用方仍负责提供面向用户
的 title/meta，不能认为共享组件已自动清理所有旧调用方的动态文案。
Idol/Unit 的身份、歌曲映射与剧情资源统计也移入技术区，页面保留原有关系导航。

## 第二批：Event / Gasha / Card 与通信、季节、工作、故事详情

活动和卡池页面以标题、日期、报酬与关联卡片为主；原始表号、公告编号、
资源标识与推导证据集中到默认收起的技术区。卡池列表也不再逐行显示编号。
推定关联、获得方式待确认与复刻关系仍分别说明，不能因折叠证据而升级事实。

卡片保留卡面切换、数值与技能、分类语音试听、演出预览和剧情入口。
未归类语音候选进入技术区；未核对卡面仍有可见标识。空文本/占位值 0
显示仅音频，缺失的技能数值说明显示未收录，原始模板和候选完整保留在证据中。

通信随机话题仍说明随机候选与真实聊天顺序的区别；默认使用话题标题、时间
和解锁条件，技术区保留表 104/105、抽选权重及脚本边界。季节、工作与通用
故事详情展示人物、剧情和收录状态，原始资源保留在各自技术区。
这批没有改变媒体 URL、导航 payload、编译产物、主数据或播放器控制逻辑。

## 验证范围

`npm run verify:archive-presentation` 检查全部 61 个现有歌曲记录：canonical 名称、
别名路由、固定/特别/自由编成、未知身份、可试听边界、证据完整性和输入不变性。
真实 Vue SSR 覆盖全部歌曲、61 个卡池、4 个季节企划、49 个工作角色、4 种通信
模式及卡片代表样本、缺失活动/故事样本、RelationList 两种模式。模板 AST 门禁
覆盖 16 个已迁移组件，结合表达式 AST 检查正文与 title/alt/aria-label 的直接
技术身份输出，允许 key、URL、事件参数、明确技术区及具名展示/计数投影。
该门禁已接入 source CI，是有边界的回归保护，不是整个仓库的完整数据流审计。

既有 song playback、experimental audio、song landing、idol/unit、navigation state、
async navigation 门禁通过。source-only Vite 构建通过，仍有大于 500 kB 分块提示；
不代表完整媒体发布。旧文案/组件接线断言随新契约更新，源数据关系断言继续保留。

真实 Browser 在此 checkout 的 5175 服务验收：歌曲 → Jupiter → 冬马 → 歌曲；
技术信息展开/收起；DRIVE A LIVE 组合模式播放/暂停及 solo/lineup 名称选择。
1280×800 与 390×844 无页面横向溢出，验收时无应用 warning/error。
截图位于仓库外 `C:/Users/windm/.codex/evidence/sidem-presentation/2026-09-09/`。
这是 UI/交互验证，不是混音听感或正式长稳验收。

第二批通过 card voice preview、gasha catalog、event story、seasonal、work story、
external story resource UI 与 story player UI PR2 门禁，以及更新后的展示门禁和
source-only 构建。Browser 在 390×844 验证活动报酬卡导航、卡池列表和推定关联、
卡面边框切换、默认隐藏占位文本、证据展开/收起、随机话题、工作场景台词、
季节年份/节日/事务所切换及检索到故事详情；所测页面无横向溢出，日志无应用错误。
新增截图 `card-mobile.png`、`mobile-topics.png` 与第一批截图位于同一证据目录。

## 后续顺序

1. H 列表收尾已完成：故事全部检索、主线/生日/额外目录和集合、个人故事及卡片列表。展示门禁扩至 20 个组件。
2. D 按实际剧情入口扩展；E1 扩充只读覆盖。P2-B 继续后移，E2 仍未开工。

## 第三批：列表与故事集合收尾

故事搜索结果不再逐行输出资源编号和演出步骤；标题、简介、收录状态与原有
筛选/排序/编号检索能力保留。目录和集合页的完整证据默认折叠，卡片列表的
来源仍可在卡片详情中查看。生日目录去掉数字身份后同步调整网格列，避免姓名
挤入原编号列。公共篇仍独立于偶像个人生日档案，未公开章节仍不可播放。

新增 SSR 检查覆盖全部故事搜索结果、主线/生日/额外入口与集合，以及卡片列表；
20 组件模板门禁通过。原有 card filters、story catalog、main/extra/birthday landing、
idol story interface 验证通过。两项旧英文文案断言改为中文标签，数据关系断言未删。
Browser 检查编号检索仍命中、生日到个人故事跳转、手机目录和列表布局。

## 缺失文本的既有来源

2026-09-09 用户补充：本地缺失文本基本从 https://wikiwiki.jp/sidem-gstars/ 获取，
此前是复制页面后交给本地处理，尚未批量导入。这是后续补录的来源约定，
不是已完成逐字段核实的声明，也不是全站批量导入的授权。补录应记录具体来源页、
对应实体/字段及导入范围；未核实内容继续显示待确认，不以资源编号填充名称。
