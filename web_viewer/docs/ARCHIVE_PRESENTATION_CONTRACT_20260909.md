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

## 验证范围

`npm run verify:archive-presentation` 检查全部 61 个现有歌曲记录：canonical 名称、
别名路由、固定/特别/自由编成、未知身份、可试听边界、证据完整性和输入不变性。
真实 Vue SSR 覆盖全部歌曲与 RelationList 两种模式；模板 AST 门禁覆盖已迁移的
八个组件。禁止直接将技术身份插值到普通正文，允许 key、URL、事件参数与明确
技术区；计数投影有单独允许规则。该门禁已接入 source CI，不能声称覆盖未迁移页。

既有 song playback、experimental audio、song landing、idol/unit、navigation state、
async navigation 门禁通过。source-only Vite 构建通过，仍有大于 500 kB 分块提示；
不代表完整媒体发布。旧文案/组件接线断言随新契约更新，源数据关系断言继续保留。

真实 Browser 在此 checkout 的 5175 服务验收：歌曲 → Jupiter → 冬马 → 歌曲；
技术信息展开/收起；DRIVE A LIVE 组合模式播放/暂停及 solo/lineup 名称选择。
1280×800 与 390×844 无页面横向溢出，验收时无应用 warning/error。
截图位于仓库外 `C:/Users/windm/.codex/evidence/sidem-presentation/2026-09-09/`。
这是 UI/交互验证，不是混音听感或正式长稳验收。

## 后续顺序

1. Event / Gasha：普通活动与卡池信息、获得关系说明、折叠 provenance。
2. Card：分类语音、未分类候选、资源可用性分层，候选明确进入技术区域。
3. Mobile / Seasonal / Work / Story：清理资源身份与工程统计的默认展示。
4. D 按实际剧情入口扩展；E1 扩充只读覆盖。P2-B 继续后移，E2 仍未开工。
