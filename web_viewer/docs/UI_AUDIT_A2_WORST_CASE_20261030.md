# A2 — Real-Data Worst-Case & Content Stress Audit（2026-10-30）

## 结论与边界

本轮交付真实数据极值库、开发专用真实组件 fixture 和浏览器证据。**不是全站 Worst-case 通过证明**。新增 P2：摄影首次资料加载失败后，重试没有自动恢复预置构图；另有 P3 候选：LIVE空数据仍显示加载中。未修复正式 UI，未部署，未创建 UI 修复 PR。

主要目录/详情边界、Reader/ADV、摄影与谱面已执行八尺寸风险矩阵；尚未覆盖的独立详情、2D 舞台完整编队、全部资源错误、连续播放、所有图鉴目录高密度状态与真机项目逐项保留 Pending。几何采集结果仍是 REVIEW_REQUIRED；不能把脚本退出码、Ready 或预期错误分支当成产品 PASS。

## 工程基线与主干变化

- 开始于审计分支 `portal/20261030-responsive-audit`，HEAD `dcb3e3d4e85ae8fdef994c82a7409cf98cb9a217`，初始工作树干净；`441780f9` 仍是祖先。
- 首次 fetch 为 master `c5efb7a0`。收尾 fetch 发现 #151 已合入，master 变为 `a2c07d169a3d9e3251cb424209de4166d4fee798`。先报告差异，再通过 merge 同步；同步后审计 HEAD `3f0ab7134d62b2148c3ac251f1247e389077abf8`，没有 rebase/force push。
- #151 新增 LIVE 谱面表和 GsFilterPanel，替换工具入口旧曲目列表，微调 GsInfo，并接入指定难度导航。A2 将真实 `ArchiveLiveChartTable` 加入 fixture，并补测全量难度和筛选面板。摄影恢复逻辑未被该 PR 修改。
- `CURRENT_STATE.md` 的旧 master/release 表与实际源码不同；本报告以受跟踪 bootstrap、实际候选和 git 结果为准，不将旧状态文档当工程事实。
- 消费 release 仍为 `bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f`；data revision `2688ad94abf9bd93277ec844a6ada160131e6f0856e5fad891ceb69de72f83bc`，media epoch `voice64-gzip-all-20260924`。这是本地源码消费绑定，不代表线上当前发布验收。
- 候选 `E:/Web_build/GS_Archive_Domain_Work/rm-release-20261030b` 与 bootstrap release 一致；重新扫描 2,657 个候选 catalog/detail JSON 并保存 SHA256，没有直接沿用旧前五条样本。
- 原阅读 corpus 位于 `E:/Web_build/SideM_Archived/web_viewer/public/data/reading`，译文位于 `public/translations/zh-CN/scenarios`。扫描 3,140 个 JSON、33,293 条文本；9,119 条译文按文本单元和 source_hash 匹配。其与 release 的完整投影对应关系未证明；fixture 中 release 是本次审计关联值，scope 明确标记，不宣称全 release 最长台词。
- 复用本工作树的 5198 Vite 入口；证据均写入 E: 新 run 目录。未清理旧审计工作树、截图和失败尝试。

## 技能执行与采集可信度

实际读取并使用 break-ui 的 SKILL/CATALOG：按消费字段取真实极值，通过 props/受控请求边界注入，Normal/Worst 切换，空/单/密集/缺字段/延迟/错误另测，先报告再停止。没有按字段名随意取前五项，也没有制造无意义长字符串。没有发现统一的前端文本长度限制；本轮最大值是已扫描 corpus 的观测值，不是业务 schema 的永久上限。

mobile-native 用于区分模拟视口与硬件行为；没有输入缩放、软键盘、地址栏、惯性或安全区真机通过声明。emil-design-eng 仅用于非回归观察，没有主动改版、改正式颜色/字体/间距或添加动效。

A0 负向与 mutation 控制重新执行 17/17，通过证据：`E:/Web_build/SideM_Archived/web_viewer/.analysis/ui-audit-a0/run-iei6LN/`。探针未改变，仍只收集候选。A1 的交互覆盖缺口和 A1-V01 没有被 A2 清零。

Browser/IAB 实际打开并读取过活动极值页；后续视口和交互调用返回 `browser.user is unavailable`。因此批量与交互证据使用用户要求的独立 Chromium/CDP 基础设施；不能写成 IAB 手机通过或 WebKit/真机通过。

采集器保存 route/domain、URL、标题、视口、浏览器版本、HEAD、release、时间、fixture 状态、输入文件 hash、截图 SHA、异常、图像状态和几何候选。每次新建目录，截图使用独占写入，不覆盖上一轮。字体与 fixture 挂载 Ready 不等于资源/业务流程全部完成；图像 complete/naturalWidth 单独记录，懒加载离屏图片不当成失败。

### 已排除的工具误用

1. 初次独立 AdvUI 缺少 App.vue:2724 的 border-box 前提，造成虚假溢出。已在 QA 容器镜像既有 reset，未引入生产 overflow 隐藏；旧记录不用于产品判断。
2. 把最长梗概、短信对白送入 ADV 会得到错误语义与原始表情标签。Reader 与 Player 已分开：ADV 只取 `field_kind=dialogue`、无 phone presentation 的真实行；旧 Player 记录全部排除。
3. 初次 Missing 删除全部 image binding，包含画布必需背景，不能称为可选字段测试。保留原尝试，但正式 Missing 仅移除摄影可选姿势/表情缩略图。
4. 长轨桌面折栏需要横向滚轮；只派发 deltaY 的旧“末端”结果不足以证明最后一栏可达。已按实际滚动轴补测。
5. 同步后首次窄屏重试采集遇到一次Uncaught，缺少after图，未用于最后恢复结论；停止并发构建/生成后单独重跑run-Jj3dPi，两端均有前后图、保存键人物数和实际控件状态。collector遇异常改为INCONCLUSIVE，避免保留旧的就绪状态。
6. Domain/Reading Error 是 fixture loader 错误，不是生产请求失败；只有摄影/谱面的受控 transport 错误测试了正式错误界面。

## 数据库、字段映射与 fixture

完整原始值、来源文件、JSON Pointer、release、字段类型、比较人口和 SHA 位于 [extremes.json](../scripts/fixtures/responsive/extremes.json)、[reading.json](../scripts/fixtures/responsive/reading.json)、[tools.json](../scripts/fixtures/responsive/tools.json)。长度按 Unicode code point，非字体实际宽度。数组按项数；活动图片按有效 URL binding 数，未把字典键数当图片数。不同极值保留完整真实实体，通过 metric URL 单独选，不拼成业务上不存在的混合实体。

| 页面/边界 | 实际消费字段 | 实际组件 | 覆盖限制 |
|---|---|---|---|
| 偶像目录 | id/name + bootstrap 的 unitName/color | ArchiveIdolGrid | 49 人 Dense；缺头像由 ID 解析，单删目录图片字段不证明头像请求失败 |
| 组合目录 | catalog.unit/unit_name、members/cardStats | ArchiveUnitCatalog | 16 组合 Dense；独立组合详情未完整挂载 |
| 卡面目录 | title、资源 ID、稀有度等完整 catalog row | ArchiveCardList | 826 张 Dense；独立卡面画廊未覆盖 |
| 歌曲详情 | view.title/variants/performers/officialVideos/gameplay | ArchiveSongDetail | 独立各最大关联实体；音频实际失败/慢加载仍 Pending |
| 活动详情 | identity.title、media、castReferences、cards/songs/episodes | ArchiveEventDetail | 图片条属于允许内部滚动；完整外壳标题问题仍 RR-01 |
| 卡池详情 | display_name、related_pickup_cards | ArchiveGashaDetail | 含辅助 ticket/detail 记录，不能把所有 detail 数当 primary 目录数量 |
| 道具/称号/货币/服装详情 | entry.nameJa/descriptionText、sources、usageCards/cards | CollectionDetailPanel → CollectionEntryDetails/ArchiveRewardTable | 测真实详情及来源；独立目录 1,613 称号等未完整 Dense 挂载 |
| Reader | source_text、speaker、anchor、匹配 overlay | ReadingTranscriptRow / StorySynopsisCard | 多种真实文本类型；章节目录+搜索+全文同时存在仍 Pending |
| ADV Player | 纯 ADV dialogue、source_text、匹配 overlay | AdvUI + 正式 StoryTextResolver | 单条对白组件边界；不是完整 StoryViewer/连续播放/返回契约 |
| LIVE 表 | catalog 标题/组合及正式 liveChartTable 统计 | ArchiveLiveChartTable / GsFilterPanel | #151 补入；244 档全量难度、手机/桌面筛选面板 |
| 谱面 | 真实 chart descriptor，正式 hash 校验加载 | ArchiveSongChartPreview | 最长 tick/最多音符，长轨、滚动和 PNG 安全拒绝；不代表完整 SVG/PNG 成功导出矩阵 |
| 摄影 | 真实素材 ID + schema 合同 6 人/32 贴纸 | PictureStudio / ReadModelClient / StudioComposition | 组合位置与重复人物为 SYNTHETIC；最大衣装 actor/每个素材类型逐一选中未覆盖 |
| 舞台/摄影选人 | bootstrap 名称、组合、全员和重复计数徽标 | ArchiveIdolPickerPanel | 只证明共享选择器；2D 舞台编队、资源、演唱版本和画布未被此项替代 |

候选 catalog 数量：idols 49；units 16；cards 826；songs 60；events 59；gashas 57；items 535；honors 1613；currencies 7；costumes 690；photos 50；stories 1394。歌曲 detail 包含变体 61 条，正式 LIVE 统计为 61 首/244 档，不应与 60 个 primary catalog row 混为一谈。

### 候选 release 消费字段极值（47 项）

字符串列完整值保存在 JSON；表中长值仅为摘要，数组/对象不在报告重复展开。每条 source + pointer 可直接回查，validator 已核对原值和 hash。

| Metric / 页面 | 极值 | 原始值摘要 | 来源 / JSON Pointer |
|---|---:|---|---|
| longest-idols-catalog-title | 14 | アスラン＝ベルゼビュートⅡ世 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/idols/catalog/page-0000.json` · `/data/rows/28/name` |
| maximum-idols-name | 14 | アスラン＝ベルゼビュートⅡ世 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/idols/detail/804277a853735b1df41342c15cfe1b36.json` · `/data/view/profile/display_name` |
| maximum-idols-related-songs | 5 | 5 个关联项 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/idols/detail/200553b9084ae4e950b8521b8e1c40e8.json` · `/data/view/songs` |
| longest-units-catalog-title | 14 | DRAMATIC STARS | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/units/catalog/page-0000.json` · `/data/rows/1/name` |
| maximum-units-name | 14 | DRAMATIC STARS | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/units/detail/d4735e3a265e16eee03f59718b9b5d03.json` · `/data/view/entry/unit/unit_name` |
| maximum-units-members | 5 | 5 个关联项 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/units/detail/2c624232cdd221771294dfbb310aca00.json` · `/data/view/entry/members` |
| maximum-units-songs | 3 | 3 个关联项 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/units/detail/19581e27de7ced00ff1ce50b2047e7a5.json` · `/data/view/songs` |
| longest-cards-catalog-title | 17 | NEXT DESTIN@TION! | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/cards/catalog/page-0000.json` · `/data/rows/5/title` |
| longest-songs-catalog-title | 28 | The 1st Movement ～未来のための二重奏～ | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/songs/catalog/page-0000.json` · `/data/rows/13/title` |
| maximum-songs-name | 28 | The 1st Movement ～未来のための二重奏～ | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/songs/detail/da1dff5d75344b72536b0a6d1f768cf7.json` · `/data/view/title` |
| maximum-songs-versions | 1 | 1 个关联项 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/songs/detail/468aaabb700baf3c6a6609c7bf766543.json` · `/data/view/variants` |
| maximum-songs-cast | 5 | 5 个关联项 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/songs/detail/268d1e81f59c1e2f5404448672349a3b.json` · `/data/view/performers` |
| maximum-songs-videos | 1 | 1 个关联项 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/songs/detail/0043600a1a909c75e4a0931f85a054fb.json` · `/data/view/officialVideos` |
| maximum-songs-difficulties | 4 | 4 个关联项 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/songs/detail/0043600a1a909c75e4a0931f85a054fb.json` · `/data/view/gameplay/difficulties` |
| longest-events-catalog-title | 45 | GROWING SIGN@L -Multiple Entertainment Show!- | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/events/catalog/page-0000.json` · `/data/rows/11/title` |
| maximum-events-name | 45 | GROWING SIGN@L -Multiple Entertainment Show!- | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/events/detail/3a798f0994abab0248498fadbfbae093.json` · `/data/view/identity/title` |
| maximum-events-cast | 5 | 5 个关联项 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/events/detail/019fbf3b6735d0a41ae68e030ba70a03.json` · `/data/view/castReferences` |
| maximum-events-cards | 5 | 5 个关联项 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/events/detail/019fbf3b6735d0a41ae68e030ba70a03.json` · `/data/view/cards` |
| maximum-events-songs | 1 | 1 个关联项 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/events/detail/019fbf3b6735d0a41ae68e030ba70a03.json` · `/data/view/songs` |
| maximum-events-episodes | 11 | 11 个关联项 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/events/detail/019fbf3b6735d0a41ae68e030ba70a03.json` · `/data/view/episodes` |
| longest-gashas-catalog-title | 41 | THE IDOLM@STER SideM 7th STAGE ステップアップガシャ | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/gashas/catalog/page-0000.json` · `/data/rows/15/display_name` |
| maximum-gashas-name | 41 | THE IDOLM@STER SideM 7th STAGE ステップアップガシャ | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/gashas/detail/60e660f9c5ac774b13fb6455abf9cbfc.json` · `/data/gasha/display_name` |
| maximum-gashas-cards | 49 | 49 个关联项 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/gashas/detail/60e660f9c5ac774b13fb6455abf9cbfc.json` · `/data/gasha/related_pickup_cards` |
| longest-items-catalog-title | 52 | アンコールスターV付き！Chocolate Night ～魅惑のバレンタインナイト～ガシャ10回チケット | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/items/catalog/page-0007.json` · `/data/rows/48/name` |
| maximum-items-view-entry-nameJa | 53 | アンコールスターV付き！Chocolate Night ～魅惑のバレンタインナイト～ガシャ / 10回チケット | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/items/details/page-0014.json` · `/data/rows/19/view/entry/nameJa` |
| maximum-items-view-entry-descriptionText-plain | 67 | 類いわく「cuteでdeliciousでamazing」な / お菓子。買うためにはとても並ばないと / いけないらしい。STを30回復する。 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/items/details/page-0011.json` · `/data/rows/60/view/entry/descriptionText/plain` |
| maximum-items-view-sources | 478 | 478 个关联项 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/items/details/page-0006.json` · `/data/rows/0/view/sources` |
| maximum-items-view-usageCards | 399 | 399 个关联项 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/items/details/page-0004.json` · `/data/rows/2/view/usageCards` |
| longest-honors-catalog-title | 42 | 2022/VDCPのアスラン＝ベルゼビュートⅡ世のランキングで4～10位にランクイン | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/honors/catalog/page-0020.json` · `/data/rows/55/name` |
| maximum-honors-view-entry-nameJa | 42 | 2022/VDCPのアスラン＝ベルゼビュートⅡ世のランキングで4～10位にランクイン | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/honors/details/page-0020.json` · `/data/rows/55/view/entry/nameJa` |
| maximum-honors-view-entry-descriptionText-plain | 24 | プロデューサーのプロフィールに / 設定できる称号。 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/honors/details/page-0000.json` · `/data/rows/0/view/entry/descriptionText/plain` |
| maximum-honors-view-sources | 1 | 1 个关联项 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/honors/details/page-0003.json` · `/data/rows/44/view/sources` |
| longest-currencies-catalog-title | 10 | プロデューサーExp | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/currencies/catalog/page-0000.json` · `/data/rows/4/nameJa` |
| maximum-currencies-view-entry-nameJa | 10 | プロデューサーExp | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/currencies/details/page-0000.json` · `/data/rows/4/view/entry/nameJa` |
| longest-costumes-catalog-title | 16 | ファンタスティックリマーカブル+ | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/costumes/catalog/page-0001.json` · `/data/rows/20/nameJa` |
| maximum-costumes-view-entry-nameJa | 16 | ファンタスティックリマーカブル+ | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/costumes/details/page-0001.json` · `/data/rows/20/view/entry/nameJa` |
| maximum-costumes-view-cards | 1 | 1 个关联项 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/costumes/details/page-0000.json` · `/data/rows/5/view/cards` |
| longest-photos-catalog-title | 14 | アスラン＝ベルゼビュートⅡ世 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/photos/catalog/page-0000.json` · `/data/rows/29/nameJa` |
| maximum-photos-costumes | 19 | 19 个关联项 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/photos/detail/4fc82b26aecb47d2868c4efbe3581732.json` · `/data/view/costumes` |
| maximum-photos-fields | 18 | 18 个关联项 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/photos/detail/811786ad1ae74adfdd20dd0372abaaeb.json` · `/data/view/actor/faces` |
| longest-stories-catalog-title | 45 | GROWING SIGN@L -Multiple Entertainment Show!- | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/stories/catalog/page-0000.json` · `/data/rows/33/title` |
| maximum-stories-chapter-name | 45 | GROWING SIGN@L -Multiple Entertainment Show!- | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/stories/detail/87b0c4599b020de69d558695d566a331.json` · `/data/story/title` |
| maximum-stories-cast | 51 | 51 个关联项 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/stories/detail/30ab21fc2ab3c1a21479ee87bceeb32c.json` · `/data/view/castReferences` |
| maximum-events-visible-media-bindings | 4 | 5 个字段；按有效绑定排名 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/events/detail/29993a9e7e963c4ed05dfc9d5f5224f6.json` · `/data/view/media` |
| longest-official-video-title | 82 | ゲーム【サイスタ】「アイドルマスター SideM　GROWING STARS」3Dライブ　Legenders「Time Before Time」【アイドルマスター】 | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/songs/detail/0b05a522434be82573687dc00a9c1954.json` · `/data/view/officialVideos/0/title` |
| longest-items-source-event-title | 45 | GROWING SIGN@L -Multiple Entertainment Show!- | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/items/details/page-0000.json` · `/data/rows/3/view/sources/55/event/title` |
| longest-honors-source-event-title | 45 | GROWING SIGN@L -Multiple Entertainment Show!- | `_catalog/v/bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f/honors/details/page-0008.json` · `/data/rows/10/view/sources/0/event/title` |

### 阅读与工具额外极值

| 语义边界 | 观测值 | 比较范围 |
|---|---:|---|
| longest-dialogue | 104 | 28199 条符合语义的候选；来源见 reading.json |
| longest-synopsis | 113 | 925 条符合语义的候选；来源见 reading.json |
| longest-title | 36 | 1713 条符合语义的候选；来源见 reading.json |
| translation-longer | 66 | 251 条符合语义的候选；来源见 reading.json |
| original-longer | 109 | 7980 条符合语义的候选；来源见 reading.json |
| no-translation | 113 | 24174 条符合语义的候选；来源见 reading.json |
| no-speaker | 113 | 5083 条符合语义的候选；来源见 reading.json |
| longest-translation | 92 | 9119 条符合语义的候选；来源见 reading.json |
| longest-player-dialogue | 60 | 23414 条符合语义的候选；来源见 reading.json |
| player-translation-longer | 48 | 96 条符合语义的候选；来源见 reading.json |
| player-original-longer | 53 | 3097 条符合语义的候选；来源见 reading.json |
| player-no-translation | 60 | 20155 条符合语义的候选；来源见 reading.json |

Reader 最大文档 40 rows；原文对白全 corpus 最长 104 字来自通信类型，**纯 ADV 最长 60 字，比较 23,414 条**。这也是必须按实际组件消费边界取样的原因。最长匹配译文 92 字；另有译文较原文长、原文较译文长、无译文的独立样本。

摄影真实库含 133 地点、186 场景、184 贴纸、26 相框、4 滤镜、395 动作、554 表情；最长素材名称在 tools.json 按分类保留指针。组合为 SYNTHETIC：6 个相同真实人物实例 + 32 个真实贴纸 ID，坐标和叠放人为安排，符合 StudioDocument 的硬上限。

谱面候选比较 244 个 difficulty descriptor：最大 2,832,080 tick；最大 757 个 note objects。它们是两个独立真实谱面，未伪造 note 数据。最长轨在默认 scale 90 的连续图约 254,972 CSS px，浏览器 PNG 被安全预算主动拒绝。

## 八状态与设备矩阵

统一入口、模式转换和局限见 [fixture README](../scripts/fixtures/responsive/README.md)。Normal/Worst 是真实源数据；Empty/One/Dense 重排或裁减、Missing/Delayed/Error 均明确标 SYNTHETIC。Dense 保留整个真实 catalog 或真实最大关联实体；摄影则使用明确 schema 上限。不同模式未必覆盖每一层嵌套数组；不能仅因有八个按钮就判八类业务状态全部完成。

- 主视口：320×720、360×800、390×844、430×932、768×1024、1024×768、1280×688、1440×900。Normal/八状态主要两端尺寸；Worst/Dense 风险矩阵补中间尺寸。
- 标题/组合/图鉴/活动：559/560/561、759/760/761 ×800；摄影面板：719/720/721、1099/1100/1101 ×800；新 LIVE 筛选另外759/760/761。
- CN 与 JP/双语分别采集；720×450 为1440×900在200%缩放下的等效 CSS 可用空间，只验证 reflow，不是实际浏览器缩放/系统大字体或手机缩放验收。没有靠禁用 zoom 处理输入风险。
- 新 LIVE 筛选使用真实全部难度后打开面板；谱面使用真实点击切换长轨，按轴派发滚轮。摄影恢复错误使用真实点击重试。
- 固定工具占整个 viewport，QA 控制条可能被其遮盖：这些控制条不属于产品，也不把其字号/遮挡记为产品缺陷。

实际证据索引：[responsive-stress-results-20261030.json](../scripts/qa/responsive-stress-results-20261030.json)。选入 26 个完整 run，按页面/模式/独立极值/视口/语言/交互标志去重后 **576 条记录**；540 REVIEW_REQUIRED，36 EXPECTED_FIXTURE_ERROR。校验 **1083 张 PNG 的 SHA256**（含被新同键结果替代的重复有效证据），不是1,083项产品PASS。

518条记录来自同步后HEAD 3f0ab713；58条为同步前的CN/断点/长轨/分页等窄范围补充，保留各自HEAD与manifest，不改写成最新HEAD。两者实际消费release相同；相关组件变更已单独重测。新主干的主域250条、补充144条、阅读56条/12条、摄影谱面32条及新LIVE筛选10条都已重新执行。正式可见图片 pending=0、可见 broken=0；离屏懒加载仍可能未完成，不能说全部媒体已加载。

- 当前主域完整样本：`E:/Web_build/SideM_Archived/web_viewer/.analysis/ui-audit-a2/run-MbT4pZ/`（250条）与 `run-SHr5Cn/`（144条）。
- 当前阅读/ADV：`run-LTHtBp/`、`run-NFNjfp/`；摄影/谱面：`run-aSMh9T/`、`run-xqmE7A/`；新LIVE筛选：`run-LDOyN4/`。
- 478来源末页：`run-nPsHbh/`；最后一页20/20、3条、nextDisabled=true。桌面长轨最后一栏：`run-WXlEUm/`，left等于scrollWidth-clientWidth；新版主干安全拒绝：`run-dRGjkO/`。
- 受控恢复的期望未满足单独记录在recovery字段，不因顶层EXPECTED_FIXTURE_ERROR掩盖它。所有productVerdict默认UNREVIEWED，只有下面点名的问题有人工结论。

A2-01正常1人、首次失败与重试后截图：

[正常1人](E:/Web_build/SideM_Archived/web_viewer/.analysis/ui-audit-a2/run-aSMh9T/0001-studio-Normal-320x720.png) · [首次失败](E:/Web_build/SideM_Archived/web_viewer/.analysis/ui-audit-a2/run-Jj3dPi/0001-studio-Error-320x720.png) · [重试后0层](E:/Web_build/SideM_Archived/web_viewer/.analysis/ui-audit-a2/run-Jj3dPi/0001-studio-Error-320x720-retry.png) · [桌面重试后0层](E:/Web_build/SideM_Archived/web_viewer/.analysis/ui-audit-a2/run-Jj3dPi/0002-studio-Error-1440x900-retry.png)。

其他抽样：[399关联卡片](E:/Web_build/SideM_Archived/web_viewer/.analysis/ui-audit-a2/run-8XtDeg/0217-items-Worst-320x720.png) · [双语Reader](E:/Web_build/SideM_Archived/web_viewer/.analysis/ui-audit-a2/run-JYAXQz/0002-reader-Worst-320x720.png)。它们保留原HEAD，不冒充最新全页面回归截图。


## 问题与复现

### A2-01 — P2 / REPRODUCED：首次资料读取失败后重试没有恢复上次构图

- 页面：摄影入口“继续上次构图” → `/studio/edit/`。实际受控复现入口：`/scripts/qa/responsive-tools.html?domain=studio&mode=Error`。
- 组件：PictureStudio、useStudioComposition。视口320×720、1440×900均出现；载入的是同一真实人物 ID 的 SYNTHETIC 1 人构图。
- 步骤：在隔离浏览器保存 fixture 的1人构图 → 以 restoreOnOpen=true 挂载正式组件 → 第一次 photos 请求由测试 adapter 拒绝 → 等错误提示 → 点击正式“重试”。
- 预期：资料恢复后再载入用户请求继续的构图，1个图层。
- 实际：背景和素材库恢复，图层为0。最终恢复采集明确记录 STATE_MISMATCH：expected=1 / observed=0，导出按钮可用。保存键中仍有1个人物，未自动载入；早期谓词显示LOADING只是测试状态，**不是产品仍显示loading spinner**。最终隔离重跑没有未捕获异常。
- 代码：`src/components/archive/PictureStudio.vue:386–387` 在 busy 从 true→false 时立即将 restoreAsked 消耗；`src/components/archive/useStudioComposition.js:435–456,534–539` 的失败路径也使 busy=false。首次失败时 actor/materials 尚未可用，restore 已尝试；重试 load 后不再执行这次恢复请求。CSS 定位不适用，这是状态时序问题。
- 建议：后续修复仅在资料加载成功后消耗 restore 请求，或失败后保留它用于重试；重测正常1人、空构图、38图层和失败重试。此处只给建议，不修改正式组件。
- 稳定性：受控 adapter 复现于两个视口，主干同步后再次执行；真实网络故障触发、手动载入和完整入口返回契约仍 Pending。不能写成保存数据已损坏或永久丢失。
- 前后证据见下方 receipt；台账新增 A2-01，保留真实网络条件限制。

### A2-02 — P3 / NEEDS_CONFIRMATION：LIVE空catalog与加载中使用同一说明

- 组件/路由：新主干 ArchiveLiveChartTable，`/live/`；QA `responsive-domains.html?domain=live&mode=Empty`，320×720与1440×900。
- 人为把实际catalog数组裁减为0，fixture已READY，但组件仍显示“正在读取曲目…”。预期已完成的空数据有明确无记录说明，实际边界没有区别loading/loaded-empty。
- 代码：`src/components/archive/ArchiveLiveChartTable.vue:22` 的 `!songs.length` 分支；组件没有独立busy输入。建议后续由真实父级状态区分空与加载。
- [窄屏截图](E:/Web_build/SideM_Archived/web_viewer/.analysis/ui-audit-a2/run-MbT4pZ/0091-live-Empty-320x720.png) · [桌面截图](E:/Web_build/SideM_Archived/web_viewer/.analysis/ui-audit-a2/run-MbT4pZ/0187-live-Empty-1440x900.png)。
- 仅确认SYNTHETIC空边界的文案；正式release含60个catalog项，尚无真实loaded-empty返回证据。因此是Fragile候选，不能标成生产已确认故障或P0加载卡死。后续A3检查父级错误/空状态契约。

RR-01 P1、RR-02 P2 保持原 REPRODUCED；RR-03 P3 和 A1-V01 保持 NEEDS_CONFIRMATION，没有通过本轮解除。没有新增已确认 P0/P1；这不是全站无 P0/P1 的证明。

### 候选复核与保持稳定的边界

- 活动图片带的 viewport-overflow 是允许的内部画廊，不是 document 溢出；不可借此豁免整个页面。
- 399 关联卡片的道具详情在320px截图中保留标题/卡片/数量；478来源使用正式分页，并另执行末页旅程。不是把数百行静态堆进假页面。
- Reader 的法文长标题、中日双语和缺译文使用正式文本组件；ADV 只消费纯对白。截图抽样未见此前 QA reset 造成的右侧溢出。
- 摄影38图层可加载，计数为38，人物6/贴纸32；设计性遮挡和重叠属于本 fixture 目的，不当成布局缺陷。
- 最长/最密谱面使用虚拟分段；连续长轨滚到末端，折栏按横向测最后一栏，PNG 越安全预算时有说明与重试，未静默截断。
- 以上为命名边界和抽样观察；其余几何候选没有逐项人工审结，不批量转 PASS。产品视觉 token、设计方向和正式CSS完全未修改。

## 尚未覆盖 / Pending

| 类型 | 尚缺证据 |
|---|---|
| 独立详情与外壳 | 完整偶像/组合/卡面详情的全部八状态、长标题与全局语言控件共同出现；RR-01仍在 |
| 图鉴目录 | 1,613称号/690服装/全部未使用资源的目录 Dense、全部来源文字组合；摄影/道具仅详情边界不代替它们 |
| 文本 | 真实 release 全量阅读投影、生产译文仓库完整绑定、生产最终渲染来源说明/日期宽度的全局最大值；现有rank仅列明的消费字段 |
| Reader/Player | 章节/搜索/正文同时存在、大量搜索命中、说话人切换、完整连续播放、语音失败/慢加载/缺失和返回上下文；单条AdvUI不替代这些 |
| 2D舞台 | 完整编队、多版本、站位、服装缺失、资源失败、帧率/画面设置、旋转及画布手势 |
| 摄影 | 最大衣装actor、所有最长素材逐一选入、最大背景实际像素、全部锁定/隐藏组合、导出PNG成功矩阵、检查器每种选择上下文；共享选择器不替代完整场景 |
| 谱面 | 全部SVG/PNG成功导出与失败后成功重试、真实内存/GPU/低端设备；安全拒绝不代表成功导出 |
| 环境 | WebKit、iOS Safari、Android Edge/Chrome、平板真机、软键盘、地址栏、safe area、惯性与触摸hover；全部Pending |
| 稳定性 | 全量CLS/图片懒加载后布局跳动、每个内部容器末端、所有几何候选人工复核；没有历史截图掩盖错误 |

## 验证、隔离与后续

- `python scripts/verify-responsive-fixtures.py`：逐条验证原值/JSON Pointer/SHA与候选输入 hashes，使用正式 StudioDocument validator 检查5种构图；检查生产源码没有引用 QA 路径。它是来源与隔离合同测试，不是布局通过门禁。
- `node scripts/verify-verifier-coverage.mjs`：注册 fixture verifier 为需要本地候选的 external local-only；不把浏览器候选工具挂成 CI 产品PASS。
- A0负向17/17；最新主干 `verify-live-chart-table`（61首/244档）、`verify-song-navigation`、`verify-gs-primitives` 通过。
- 使用 `npm run build:check`，仅源码编译、`copyPublicDir:false`，复用 `.analysis/build-check`。主干同步前后各执行一次；生成器临时更新的 resource-audit 已恢复，不随QA提交。没有全媒体复制、发布包或部署。
- 生产 build-check 内未出现 QA 实验室标记/入口；Vite默认生产入口没有导入 fixtures。DEV guard + 非生产入口依赖图隔离共同成立，不能只靠隐藏按钮声称不发布。
- Source Gate建议：来源指针/hash、生产入口隔离、固定schema上限校验可以门禁；真实fixture Ready timeout 必须失败/不确定；几何结果、图片crop和滚动例外必须人工监督；A2-01应在后续授权修复时增加真实失败→重试→图层恢复断言。
- 可以继续A3独立审计，但应携带本报告Pending、RR-01/RR-02/RR-03/A1-V01与A2-01；不能以A2作为全站内容压力验收通过条件。

本轮在提交独立QA工具和文档后停止。未修复正式UI，未部署，等待A3。
