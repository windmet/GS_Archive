# 命名剧情目录 v1

2026-09-08，重构 C。目录行的 masterdata 数字字段解释移至
`data_pipeline/story_catalog.py`；浏览器使用 `src/data/storyCatalog.js`。
`archiveSelectors.js` 保留同名导出，所有仓内 `buildStoryCatalog` 调用已切到新输入。
其他 selector 仍使用旧 story master，不能将本批称为全部 masterdata consumer 迁移。

## 生产与输入

`masterdata_extract.py` 正常完整运行时同时生成/复制 `story_catalog.json`。
也可从现有中间产物重建目录，无需解码 RAW 或重编译剧情：

```sh
npm run generate:story-catalog
npm run verify:story-catalog
```

单独生成入口与完整提取器调用同一个 Python builder。输入为
`public/data/masterdata/story_master_index.json`；输出为同目录 `story_catalog.json`。
不修改输入、不运行 candidate/publish、不触碰 compiled 剧情或 ledger。
产物没有时钟时间戳；`source_digest` 是输入对象的 UTF-8、排序键、紧凑 JSON SHA-256。
验证器会重跑生成并深比较提交产物，源索引更新而目录未更新会失败。

## 字段与责任

顶层固定 `schema_version: 1`、`source_digest`、`entries`。运行时的可执行形状
校验为 `validateStoryCatalog`：版本、digest 形状、唯一 ID、domain、字符串字段、
字符/标题/资源数组、可空 summary、有限或空日期、exists/file 关系与正整数 rowCount。
不将当前 1,394 这个档案数量写为浏览器启动条件。

每条 entry 的字段：

| 字段 | 含义 |
| --- | --- |
| id / file / domain / exists | 文件身份、首个来源域及可播放标记；无文件但有资源时保留 missing 身份 |
| resourceIds / rowCount | 合并到同一文件的资源身份，保留首次出现顺序与来源行数 |
| titles / characters / summary | 去重的检索标题、人物与首个可用编译摘要 |
| officialTitle / episodeLabel | 根据来源域解析的正式标题与章节标签 |
| sectionId / sectionLabel | 来源层级的分组身份和名称；活动的中文域标签由消费者补充 |
| unitId / unitName | 组合前传所属组合 |
| releaseAt | 来源日期数字；不具备数字日期时为 null |

域遍历顺序、重复文件的首个域归属、缺失 parent 回退、summary 后到时合并、
任一来源标记 missing 时整个 entry 为不可用，均保持原行为。
原前端把部分资源字符串当日期转成 NaN；新 JSON 用 null 明示未知，consumer
暂映射回 NaN，避免本批顺带改变排序行为。Python float 可解析数字下划线，
但资源 ID `1_5_001_00_0` 必须保持未知日期，此差异已被全量 parity 捕获并修复。

中文域标签、presentation overlay、最终显示标题/副标题、searchText 仍由前端负责。
前端不再解析目录相关的数字 wire 字段；Python 不导入前端实现。
`ArchiveDataRepository` 注册新资源并校验；`App` 用独立 storyCatalogData 构建目录。
迁移期额外加载约 1.6 MB JSON，旧约 3.4 MB story master 暂供其他域 selector 使用。

## 验证与边界

测试专用 `fixtures/story-catalog/legacy-catalog-v0.mjs` 冻结自 `3f48731`，不进入
产品模块，是迁移前的行为对照。对全部 1,394 条结果，在有/无 presentation 两种
情况下逐字段深比较，包括顺序、搜索文本、数字 NaN、所有最终字段。它不是以
JSON.stringify 擦掉 NaN 差异的比较。另有重复跨域、缺失文件/parent、晚到 summary、
数字标题、空白标题和资源日期 fixture，以及非法版本/重复 ID/错误类型拒绝测试。

本批通过 catalog parity、story-collections、story-presentation、event-story-navigation、
birthday-story-domain-landing、extra-story-domain-landing、idol-story-interface、routes、
archive-baseline:source-only、source-only Vite 构建；完整提取器的 --help 入口可用。
未运行完整 RAW 解码提取来重写其他索引。CI 已增加 catalog 校验。

内置浏览器桌面验证：首页 → 故事分类 → C.FIRST 前传，4 章/40 段及
`?view=story_collection&story_type=unit_story&story_section=16` 正常，截图可见正式标题、
概要与分段入口，无 error 日志。本批没有改 UI 布局，未跑完整移动端矩阵或实音播放。
阅读模式、其他域 selector、App 拆分和 Python package 迁移继续按总体计划推进。

## C2：文件列表消费命名元数据

2026-09-08，`story_catalog.json` 增加必需的 `fileMetadata`，仍保留 v1 的原有
目录行字段。生成器、产物和消费者需要一起交付；旧产物缺少此字段会在 repository
契约校验处被拒绝，不会回退到浏览器重新解析数字字段。现有生成命令和完整
masterdata generation job 都调用同一个 builder，本批仅运行独立目录生成。

`fileMetadata.entries` 由 pipeline 按原文件元数据遍历顺序生成：key、可选 file、
resourceIds、titles、exists，以及可选 summary。summary 仅保留文件列表消费的
voice_count/lip_count/step_count，不复制场景资源清单。原先无人消费的 rows 已删除。
文件标题保持旧 rowDisplayTitle 语义，不能复用包含父章节标题的目录检索 titles。
无文件的 key 仍为 `missing:<resourceId>`，保留其跨域合并行为。

`fileMetadata.missingExtra` 保存原缺失 extra 行的 resourceId/title，保留顺序和重复。
`src/data/storyFileMetadata.js` 只投影命名字段及中文缺失提示；`App.vue` 的文件列表
不再解释该路径中的数字字段，也不再用 storyMasterData 构建 scenarioMetaByFile。
旧 story master 仍有 storyCollections 等消费者，本批不能移除其加载。

测试冻结 `14af6e4` 的旧文件 metadata builder，逐字段对照 1,394 份文件的实际
消费字段；另测缺失资源、跨域同名 missing key、重复缺失 extra、字段 5 fallback、
晚到 summary、数字标题。原目录全属性 parity 继续通过；契约拒绝缺字段、重复 key、
file/key 不一致和非法计数。归档数据、路由、source-only baseline 门禁均通过。
源代码构建通过（2470 modules）；仍有原先两个运行时背景路径提示。

浏览器 1280×720：extra → 1st Anniversary 展示 20 个文件，标题及 voice/lip
计数正常；搜索 `5_06_018_22` 收敛为“ライブが終わって”，显示 `13 steps`。
本批未改变布局，没有以此替代窄屏完整矩阵或实音长稳。

产物从 1,549,728 增至 2,263,684 bytes；本地 gzip 对照从 103,943 增至
154,750 bytes（不是实测 HTTP 压缩传输）。这是迁移期增加的约 714 KB 原始数据，
后续其他旧索引消费者迁移完成后再处理重复加载；未重编译剧情或修改 publication ledger。

## C3：主线与组合前传集合关系

`collectionStructure` 增加 19 个命名集合：domain/sectionId/title/releaseAt/assetCode、
chapters 及其 episodes。Python 解释组、章、分段的数字字段、归属、排序、资源后缀
和视觉资源编号；浏览器 `storyCollections.js` 只组合这些字段与 presentation。
空或无效来源日期由 JSON null 表示，消费者恢复原 NaN 语义。组保持来源顺序，
章和分段保持原数字 ID 稳定排序；章文件仍在分段排序前选择第一个有文件的来源行。

播放 boundary 匹配、首段 playableStart、episode 本地/共享文件坐标、标题 fallback、
中文展示文本和汇总计数继续留在消费者。Extra 和 birthday 显式使用 App 已构建的域
模型；移除了集合模块偷偷从 raw master 构造 extra 域的 fallback。所有仓内调用已
改为传命名目录，误传旧 master 会明确报错。storyDomainIdentityIndex 等其他旧数据
消费者仍存在，不代表整个前端已停止读取 masterdata。

验证：冻结 `0fe4993` 的集合构建器，对真实 19 个主线/前传集合在有/无 presentation
两种情况下逐字段比较，连同 extra 投影一并保持；86 话、744 段的关系与所有结果
字段一致。合成输入覆盖乱序、零 ID、空章节、无效日期、字段 5 资源 fallback，
以及“排序前选文件”的行为。契约检查缺结构、非法分段后缀和错误日期类型。
story-catalog、story-collections、episode-queue、extra/birthday 域入口和 archive-data
门禁通过，源代码生产构建通过（2471 modules，原有两个背景路径提示仍在）。

浏览器 1280×720：C.FIRST 集合 4/4 话、40/40 段；进入第二分段，URL 指向
`episodes/1_1_016_01_b.json`、start_step=1/end_step=18。截图确认两角色、对话及
控制条，点击返回恢复同一集合。本次使用 noAudio=1；不替代实音、窄屏或长稳验收。

新增结构随目录一起生成和交付，不增加 HTTP 请求。相对 Git 中 C2 的 LF 产物，
本轮原始 JSON 从 2,177,114 增至 2,334,120 bytes，本地 gzip 从 153,425 增至
163,284 bytes（C4 复核时统一按 Git LF 更正；原记录误将 CRLF 工作树作为后一项）。
C2 上节记录的是当时工作树字节，受换行影响，不能直接作本轮差值。
未运行 RAW 全量提取、剧情编译或发布。

## C4：活动分段关系

新增 `eventEpisodeStructure`，按活动组 ID 分组存放已排序的命名 episodes。
组归属、数字 ID 稳定排序、资源 ID fallback、分段后缀解析由 Python 负责；
与 C3 复用 `named_episode`，避免重复解释同类来源字段。事件消费者只选择组，
保留原默认序章/章节标签、缺省 ID、presentation 匹配和播放边界算法。
App 的活动分段不再读 storyMasterData；仍有主线域身份、extra 和 birthday
三条旧索引消费者，旧资源暂不能移除。新产物字段必须与消费者一起交付。

冻结 `1b26d77` 的旧活动消费者，对全部 36 个活动、396 个分段逐字段比较；
有、无 presentation 均通过。合成输入验证乱序、零 ID、字段 5 fallback、大写
后缀、缺组、本地文件和共享文件边界。契约拒绝缺字段、重复组和非法资源字段，
误传 raw master 明确报错。story-catalog、event-story、story-collections、
archive-data 与源代码构建通过（2471 modules，原有两个背景路径提示保留）。

浏览器 1280×720、noAudio=1：活动 410001 展示 11 个分段；点击第六个入口
进入 `episodes/1_3_10001_01_f.json`，start_step=1/end_step=21。可见正文推进，
截图显示角色、背景及控制条，返回后恢复同一活动。此回归不代表实音长稳完成。

统一 LF 后，JSON 从 2,334,120 增至 2,397,621 bytes，本地 gzip 从 163,284
增至 166,545 bytes。不新增请求，不重编译剧情，不修改 publication ledger。

## C5：主线域身份（2026-09-09）

`mainIdentity` 由 Python 生成 collections、logicalEntries 和 meta，保留组/章/分段
来源表与 offset、跨记录文件去重、空章节占位和统计。App 的 mainStoryDomain 改读
命名目录；原主线 builder 移除数字字段解释，返回独立 JSON 副本，既兼容 Vue 响应式
代理，也避免页面修改污染 repository 缓存。聚合身份索引新增显式 storyCatalog 输入，
authority.mainIdentity 标明 `story_catalog.mainIdentity`；其他域仍来源于旧 master。

冻结 `c32d867` 主线 builder，全量逐字段比较 3 章、22 话、204 条逻辑记录及全部
source 字段。合成输入覆盖空章节、无效日期、孤立分段、同 ID 的 ASCII 资源名排序、
大小写并列和两种 provenance 字段。另测 Vue reactive 输入、返回副本隔离；契约拒绝
缺模型、计数不符、占位不符、丢失 source、章节顺序关系和未知逻辑条目引用。

story-catalog、story-domain-identity、main-story-domain-landing、archive-data、
story-collections 通过；源代码构建通过（2472 modules，两个原有背景路径提示）。
浏览器 1280×720、noAudio=1：主线 3/22/204，第3章仍为 disabled 未公开；进入
第二章显示 11/11 话、102/102 段，返回后恢复主线域，截图确认三张章节卡布局。
本批未运行窄屏完整矩阵或实音长稳。

LF JSON 从 2,397,621 增至 2,497,495 bytes，本地 gzip 从 166,545 增至
173,611 bytes。旧剧情索引在 App 中仍供 extra/birthday 使用，暂不移除；没有新
网络请求、剧情重编译、RAW 全量提取或 publication 修改。

## C6：额外剧情来源身份（2026-09-09）

新增 `extraIdentity.groups/logicalEntries`。来源排序、组归属、系列 ID、标题、
releaseAt、compiledFile/compiledExists 和 provenance 由 pipeline 解释；与主线
复用 identity_rows/identity_source/logical_identity_entry，原主线全属性 parity 保持。
浏览器保留 extraStoryTaxonomy、卡池和视觉索引组合、日期展示与共享播放文件统计，
使用命名身份副本，不再读 extra 的数字字段。App 旧 storyMasterData 只剩 birthday
消费者；聚合 identity authority 增加 `story_catalog.extraIdentity`。

冻结 `d58d4a0` 的域身份实现，对 10 个作品、47 条剧情、44 个播放文件逐字段比较。
有/无真实 gasha 和 visual 资料均保持一致，覆盖来源、官方/补充分类与关联资产。
合成输入补共享文件、同系列多组、乱序、未知父组、缺失文件及两种 source 字段；
Vue reactive 输入和副本修改隔离通过。命名契约检查字段和来源类型，误传 raw master
会明确报错。story-catalog、extra-story-domain-landing、story-domain-identity、
story-collections、archive-data 及源代码构建通过（2473 modules；原两个背景路径提示）。

浏览器 1280×720、noAudio=1：Extra 目录展示 7 个官方作品和 3 个补充作品；
进入 604（夜陰のルミネセンス）后，截图确认封面、1 话/1 段和关联卡池 300011；
点击进入 announcement 1300011 的卡池详情，目标正确。返回按钮回到 gashas，
未恢复作品：App 既有 gasha_detail 返回逻辑固定如此，C6 未改变它。这是后续导航
工作需处理的上下文缺口，不将本次浏览器检查写成“卡池返回作品通过”。

LF JSON 从 2,497,495 增至 2,531,628 bytes，本地 gzip 从 173,611 增至
177,346 bytes。不新增请求，不重编译或发布剧情；实音长稳和完整窄屏矩阵仍未完成。

## C7：生日来源身份与旧索引请求退场（2026-09-09）

`birthdayIdentity.logicalEntries` 由 pipeline 提供来源字段、排序、跨域文件归属及
来源行自带的 birthdaySemantics。浏览器继续通过命名 semantic index 解释 subject、
series 和公告，并关联 idol/speaker 字典；外部语义覆盖来源内嵌语义的优先级保持。
公共篇的显式 null subject 不退回资源 ID 推断，来源内嵌公告 ID 不擅自升级为外部公告。

App 删除 storyMasterData；repository 移除 story_master_index.json 的启动请求及
对应旧契约分支。聚合身份入口只接收 storyCatalog，authority.semanticIdentity
随之更新。src 不再有 storyMaster/story_master_index 的消费者；原 JSON 继续供
离线生成、审计和历史对照使用，没有删除或修改其内容。其他字典及生日语义索引仍需加载，
这不等于所有 masterdata 产品或所有资源语义都已从前端移除。

旧生日实现冻结在 d58d4a0 oracle 中：全量 51 个集合、181 条记录、2 个公共篇、
29 个跨域文件在有/无语义索引时逐字段一致。测试覆盖 reactive 输入、内嵌 subject
与外部 null override、公告来源、非法域成员和语义类型。story-catalog、birthday
域入口、story-domain-identity、archive-data、story-collections、idol-story-interface
通过；个人故事仍为 49 偶像、491 分段、29 条 after-story 关联。source-only baseline
与源代码构建通过（2474 modules；原两个背景路径提示仍在）。

真实浏览器请求验收：本地 5186 转发到 5175，但对旧索引路径固定返回 503。经该入口
打开 birthday 目录及 producer_birthday_common 集合，AX 确认公共篇两期入口可见。
最终日志 2,078 条请求，story_catalog.json 2 次，story_master_index.json 0 次。
日志保存于 `C:\Users\windm\.codex\evidence\sidem-story-runtime\2026-09-09\c7-catalog-cutover-requests.jsonl`。
临时代理退出码 0，页面恢复到 5175。期间截图显示 319px 宽生日目录；随后重新读取
AX 确认最终为公共篇集合，不将该截图描述为公共篇截图或完整移动端验收。

本批 LF 目录从 2,531,628 增至 2,630,969 bytes，gzip 从 177,346 增至
183,840 bytes；移除的旧索引工作树文件为 3,390,805 bytes。这是请求体原始大小，
不声称等于实际压缩网络流量。实音长稳、完整窄屏矩阵和 C6 记录的卡池返回上下文缺口
仍未完成；未进行 RAW 全量提取、剧情重编译或 publication。
