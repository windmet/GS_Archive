# 称呼证据 Bible（第一批）

本目录把机器观察、人工核验、翻译指导分开。当前只有 Producer 相关的**机器候选**
与 [待核验工作表](review/producer-addressing-review.csv)；没有任何已确认的
Producer 姓名语义、人物口癖或译法规则。不要把本目录直接作为翻译模型的
`verified` Bible 使用。

从 `web_viewer` 运行：

```powershell
npm run generate:producer-addressing-bible
npm run verify:producer-addressing-bible
```

生成器只读取 tracked Reader manifest/文档、speaker dictionary，以及可用的
compiled step。它不会修改 `public/`、RAW、`text_ref`、`source_hash`、
译文 overlay 或 Reader UI。全量机器文件留在本地
`.analysis/translation-bible/`：

- `producer-addressing-evidence.csv` / `.json`：逐句来源、公开说话人、
  精确词典或可见角色候选身份、原文与前后文、Reader 行链接、视频检索片段；
  voice cue 只有 compiled step ID 和正文同时精确匹配才填。
- `producer-addressing-summary.csv`：角色 × 原文形式的观测次数、文档、域、
  来源身份与核验队列数。未解析说话人按单条证据隔离，不以 `？？？` 合并。
- `producer-addressing-following.csv`：十黑点后紧随 surface 的实测频次，
  用来查找 `P` / `Ｐ` 等未证实形式。

当前输入 `3d3363ff` 的 2,801 份 Reader 文档中，剧情**对话**得到 1,982 条
候选证据：四黑点 1,096、十黑点 194、无黑点的字面
`プロデューサー` 称谓候选 692。比前次全 Reader 行审计的
1,097/195 各少 1，是因为非对话行不代表角色称呼习惯。角色映射覆盖 48 位
偶像与 2 位 NPC；`040ren` 在当前检测词面中无匹配，不能推断其没有其他称呼。
还有 75 条未解析说话人、2 条仅有可见角色候选，均不能自动升为已确认规则。

实测十黑点后缀：`監督` 56、`ぴぃちゃん` 46、`師匠` 34、`ボス` 28、
`番長さん` 28、`さん` 1、无后缀 1。未检出紧接 `P` 或 `Ｐ`。
四黑点后的词面为 `プロデューサー` 467、`プロデューサーさん` 457、
`プロデューサーちゃん` 132、`プロデューサークン` 36、
`プロデューサー君` 4。无姓名槽的对话词面单独统计，不能转成姓名 token。
所有这些数都是机器观测，未证明姓名槽分别对应原游戏哪一设置字段，也未证明
句中职业词必然是在直接呼唤 Producer。

## 人工工作表

`review/producer-addressing-review.csv` 当前含 453 条 `unreviewed` 代表证据。
每个角色 × 形式在 3 条及以下时全选；其余选 3 或 5 条，优先跨域、跨文档、
有无语音差异。`source_text` 仅在这份工作表里折叠换行便于筛选，机器 evidence
保留原始字节。生成器在工作表存在时不会覆盖人工填写的列；`--check` 会验证
所选 evidence ID 没有漂移。若来源更新导致 ID 变化，应人工迁移批注后再重建。

只需人工填写 `verification_status`、`video_reference`、`video_timestamp`、
`observed_name`、`observed_full_address`、`notes`。状态可用
`unreviewed / confirmed / confirmed-variant / not-name-placeholder /
ambiguous / needs-more-evidence / source-problem`。
录屏/音频的“屏幕实际显示”和“语音实际读法”分开记；仅凭本地 cue 存在不推断
声优念出了玩家名。只有经过来源复核的观察才可进入将来的 `verified/`，翻译
指导再由已确认观察和译例制定。

工作表的 `reader_url` 默认指向 `http://127.0.0.1:5176/`，可在生成时设置
`SIDEM_BIBLE_READER_URL`。一条悠介十黑点证据已在本地 Edge 实测：Reader
打开目标文档，`reading_row` 精确高亮台词，无页面错误。这是本地链接验收，
不是录屏语义确认。

干净 CI checkout 只有 Git 跟踪的 compiled 子集；本地有完整 mounted 目录时，
机器 evidence 能补齐更多精确 voice cue。review queue 选择只用 Reader 的
`has_voice`，所以两种环境的队列 ID 一致。CI 会重跑生成两次并比较机器
产物哈希，同时确认不会覆盖工作表；完整本地 cue 只作为本机证据。
