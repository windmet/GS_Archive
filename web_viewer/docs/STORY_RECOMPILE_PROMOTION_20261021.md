# 剧情语料重编译晋升（2026-10-21）

候选：`story-recompile-20261020/full4`（`scripts/recompile-story-corpus-candidate.py`，3402 个源文件 → 5382 个产物，4 个 blocked 与 full3 相同）。
基线：master `865a4d55`。发布记录：`public/data/publication/releases/2026-10-21-story-recompile-promotion-001.json`。

## 晋升了什么

| 项 | 数量 |
|---|---|
| 账本单元（supersede，前态全部 governed-release） | 1365 个逻辑 ID，2897 个产物 |
| registry `ownership.release_id` 改指新 release | 1173 条 |
| 已跟踪但不归账本管理的 compiled（季节企划等，保持原状态，只换字节） | 587 个 |
| 阅读文档重新生成 | 3113 篇（全部；每篇内嵌 compiled 哈希） |
| 译文目录从分篇改按合集 | 1509 份 → 188 份，20,029 条 |
| 审校文档续接到新哈希 | 2806 篇 |

gitignore 里的 1898 个候选产物不进仓库，另行拷进主检出语料（先备份）。

## 晋升门槛的处理

- **report 分级**：safe 72 / review 111 / risky 17；risky 与 full3 相同，来自 master 早已合入的编译器修复。full3 之后新增的 8 个字段都有来源：`screen_overlay`、`screen_effects[].color`、`screen_overlay.color` 来自 #73，`camera_filter_transition` 来自 #66。
- **13 个 RAW 核对文件**：
  - `spines[].fade` 9 个、`timeline` 2 个都是报告按 (type, text) 对齐造成的假象。已发布版、候选、RAW 三方的 fade 序列和 timeline 序列完全一致，fade 次数等于 RAW `idol_fadein`/`idol_fadeout` 命令数。
  - `idol_color` 2 个（`1_3_30010_01` f 段）是真修复：046chr 在命令 74 `idol_slideout` 退场，到 127 才再淡入，107/118 的 `idol_color` 打在不在场的角色上；旧版在 148–153 步错画了 046chr。
- **Valentine 语音**：根因是 `data_pipeline/extract_voice.py` 写死 `MAX_SUBSONGS = 200`，而 `valentine_1/5_01_999_23.acb` 有 251 条流（3447 个 ACB 里唯一超 200 的）。改为按 `vgmstream -m` 的 stream count 抽取，新增 `--only`；补抽 51 条（时长与 ACB 最大差 0.0007 s）。102 处原先错接到 `1_1_001_01_b*` 的语音全部改为本篇 b 段原生语音。
- **后处理**：`presentation_context` 只有 `1_4_001_05`（含 `episodes/1_4_001_05_h`）有，已用 `derive-chat-threads.py` 从 RAW 重新派生，11 条线程与已发布版一致；发布脚本把这两份作为有记录的例外，并核对它们与候选只差 `presentation_context`。`reading_control_flow`（phone forks）由编译器重新推导，结构与已发布版一致，只是 `raw_hash_format` 从 `sha256-raw-file-v1` 变为 `sha256-decoded-command-json-v1`（两者都受支持）。
- **schema 补口**：`sePayload.sheet`（#58 的 bus 路由，运行时 `SeCueRuntime.js` 读）、`spineState.idol_zoom_x/y`（运行时 `SpineStage.vue:606` 读）、`spineState.idol_zoom_transition`（编译器早就输出，`SpineStage.vue:612` 读，复用 `durationTransition`）。1196 个 strict v2 产物与全部 compiled 的运行时形状检查都通过。

## 门禁里顺带修的

- `verify-title-transition.mjs`：候选第一次把 b944618f 的原生标题后停顿（title 步 `post_wait: 0.4`）带进语料，测试的「恢复后前进一次」因此被原生等待挡住。等待本身由 `verify-native-cut-wait-runtime.mjs` 负责，title 测试改为在不带 `post_wait/pre_wait` 的标题步上验证完成放行。
- `event-resource-graph.json`：只更新 reading manifest 的 source hash。生成器只用 manifest 的 `parent_file/domain/status` 选首篇，这三列新旧完全一致；没有整体重生成，因为 worktree 里解析到的活动主图和主检出不同。
- Producer 称呼审阅队列 `translation/bible/review/producer-addressing-review.csv`：说话人识别变好（约 1500 篇 named → idol）改变了入选行，484 → 462（保留 451、移出 33、新增 11）。旧表 484 行全部 `unreviewed`、没有任何视频或笔记标注，重生成不丢人工结果。
- 5 份文档里的账本摘要标记：releases 209 → 210。

## 译文目录换键（为什么、怎么证明没丢）

旧编译的分篇文件没有 `text_catalog_id`，运行时退回 `scenario_id`，所以这 1509 篇的译文按分篇存放。重编译后它们和其他 strict v2 源一样，`text_catalog_id` 指向合集（仓库契约：`verify-authoritative-story-publish.mjs`、`verify-mounted-story-groups.py`；已有 373 篇按合集查找）。不跟着换键，这 1509 篇会在播放器和阅读器里变回日文。

- `scripts/rekey-story-translation-catalogues.mjs` 把分篇条目逐条原样搬进合集文件，不重译、不改任何一条的 unit_id / source_hash / 译文 / 状态。
- `translation/studio/supersessions/2026-10-21-story-recompile.json`：每份旧目录的哈希与去向，每篇审校文档的旧/新 Reader 与 compiled 哈希。审校回执本身一字未动。
- `scripts/lib/studio-source-supersessions.mjs`：B001/B002 校验器从合集文件按字节重建每份旧目录，必须等于回执里的 sha256；合集必须恰好是各分篇条目之并；审校文档的文本单元必须与回执证据一致（只允许目录名变化）；每条记录都必须被某个回执用到。
- 变异测试：改一条译文、加一条、删一条、混入别篇条目、篡改记录的新/旧哈希、删一条文档记录，B002 全部报错；改 B001 覆盖的合集译文，B001 报错。
- 端到端：按运行时查找规则统计，改动前后都是 32,760 行里 30,532 行有译文，丢失 0、新增 0、内容变化 0。

## 待办

- 本地播放器实听：`1_1_012_03`、`001tom_301_2_3_001_01_09_a`、一篇电话、一个季节企划聚合文件。
- 下一个 R2 批次要带上 51 条新语音（voice64 转码）和全部变更的 compiled / reading / translations。先进 preview，正式站要用户授权。
- 翻译批次可以恢复：之后的新批次按合集目录出。
