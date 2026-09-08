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
