# 本地剧情 strict-v2 文本重编译账本（2026-09-28）

基线：`codex/gs-architecture-rebuild`，开始时 HEAD `49c97a9`。本轮针对本机 `RAW/asset/scenario_*.unity3d` 做隔离重编译，来源文件只读；包内说明和此前 unsupported 分析作为待核对线索，不作为本次结果。范围是 RAW 剧情 TextAsset，不包括卡牌 UI、游戏 MasterData 的所有文本，也不代表正式 collection publication。

逐个 bundle 读取 Unity TextAsset，记录容器路径与 payload SHA-256，使用当前 `ScenarioCompiler` 编译 strict-v2 候选，并枚举 `text_ref.unit_id`。候选留在 `.analysis/local-story-strict-v2-r2/candidates/`，完整本机账本留在同目录 `ledger.json`。可提交的[逐来源账本](GS_LOCAL_STORY_STRICT_V2_LEDGER_20260928.json)只含身份、哈希、状态、候选相对路径及错误，不含 RAW 正文；正式 `public/data/publication` 账本及 `public/data/compiled` 均未改动。

| 结果 | 数量 |
| --- | ---: |
| 遍历的剧情 bundle | 1,435 |
| strict-v2 候选 TextAsset | 4,862 |
| 候选文本身份（含不同来源的重复内容，不等于去重译句） | 50,930 |
| 编译失败 TextAsset | 78 |
| 跳过的非剧情 TextAsset | 2 |
| 候选文件总字节 | 394,069,762 |

失败分类：70 项为 `dialogue.text_ref is required for authoritative v2 output`。抽查全部 70 项的 compatibility 编译结果，找到 88 个空文本 `talk_stamp` 和 2 个空文本 `synopsis` 步骤；这些步骤没有可哈希的正文，strict-v2 投影却要求 `dialogue.text_ref`。这揭示投影契约问题，不能把它们计成遗失日文。另 7 项是同一 bundle 中不同容器的同名 TextAsset 产生相同 `unit_id`，但 payload 哈希不同；需核定容器/角色所有权后再定义唯一翻译身份。最后 1 项 RAW payload 不是有效 JSON（`Expecting value`）。`scenario_others.unity3d` 的 2 个 `chat_*.json` 不以 `scenario_` 命名，按本批范围跳过。

这轮候选不能直接替换已发布剧情：逐 TextAsset 编译未完成多 part 连续状态、音频重连、舞台/分支 parity 或 Reader 发现路径审计。候选 50,930 个身份也不能直接与此前 29,172 条 Reader `missing-text-ref` 相减；两者范围和去重口径不同。冬马生日 `1_2_001_12` 的 RAW 候选已在逐来源账本中，但 Reader 缺失分集的问题仍须单独处理。门户排查与本轮无耦合。

复现及核验（从 `web_viewer` 运行）：

```powershell
python scripts/recompile-local-story-text.py --output .analysis/local-story-strict-v2-r2 --export-ledger docs/GS_LOCAL_STORY_STRICT_V2_LEDGER_20260928.json
python scripts/verify-local-story-text-ledger.py --output .analysis/local-story-strict-v2-r2
```

核验器重新哈希 1,435 个本地 bundle 和 4,862 份候选，检查 strict-v2 shape、来源绑定、计数、全局 `unit_id` 唯一性、账本覆盖与候选目录集合；结果一致。后续应先修正空文本投影规则并补回归，再处理 7 处跨容器身份碰撞；正式 publication 仍需按 collection 审计与发布门槛独立执行。

## 文本收尾续批（输入 HEAD `b51d31f`）

本节更新前述候选结论；上面的 4,862/78/7 是第一轮历史结果，不再代表当前账本。空正文 `talk_stamp` 在 strict-v2 中保留 stamp 与演出状态，不制造空字符串 `text_ref`；空正文但有标题的 `synopsis` 保留 `speaker_text_ref`。Python 与 JavaScript 投影及严格 schema 同步，新增跨语言对照回归。schema 的 stamp 定义保留运行时/Reader 实际使用的 `raw_id`、`speaker`、`side`，仍拒绝其他未知字段。

重新遍历同一 1,435 个 RAW bundle，按已挂载 compiled 路径选用身份：独立来源使用 `owner + part`，现有分集使用 group identity；91 处同时有 owner 与 episode 投影的来源在逐项账本中显式标注，不据此宣布二者已完成出版去重。新账本结果如下：

| 状态 | TextAsset |
| --- | ---: |
| strict-v2 schema 有效候选 | 4,934 |
| 有文本身份但选择目标 `0`、schema 无效 | 5 |
| 空 payload 编译失败 | 1 |
| 非剧情 TextAsset 跳过 | 2 |

全部 4,939 份候选合计 52,704 个文本身份、403,525,939 bytes；这个数量包含源版本与结构字段，不等于唯一待翻译句数。`verify-local-story-text-ledger.py` 对所有候选重新核哈希、来源和身份，`verify-local-story-strict-schema.mjs` 对 4,939 份逐一校验：4,934 份有效，5 份仅命中已记录的 choice target 最小值错误，没有意外 schema 失败。剩余空 payload 是 `scenario_others.unity3d` 中的 `scenariodata/scenario_dummy.txt`，实测 0 字节，不是已发现正文丢失。

先前 7 项身份碰撞在空文本修复后扩展为 9 个同名 part 对；每一对的两个容器 payload 不同、文本多重集无交集。18 个来源都有各自对应的 `public/data/compiled/<owner>_<part>.json`，RAW 重编文本与各自已挂载文件的文本多重集 **18/18 一致**。候选采用这一已有 owner 身份，9 对均不再发生 `unit_id` 碰撞；这只解决候选的确定性命名，尚未修改已发布内容或宣布全部来源关系通过正式 publication 审计。

Work 域作为隔离 backfill 试点：637 份现有 Reader 文档与重编候选的行种类、原文及顺序 **637/637 一致**；旧非空行 4,103，新候选非空行 4,103，且 **4,103/4,103** 都带 `text_ref`。运行时比较排除旧文件本来没有的 RAW provenance 与新增文本身份后，非文本差异 0/637。机器结果为 `.analysis/translation-preflight/work-pilot.json`，可由 `node scripts/check-work-text-backfill-pilot.mjs` 重现。这证明 Work 候选具备文本回填的局部 parity，不等于已发布 Work：`public/data/compiled`、Reader、translation overlay 和 publication ledger 本批仍未改动。

正式 Work publication 需将候选作为完整批次审计并生成可回滚的发布账本，再重生 Reader、校验远端/设备。当前 [PROJECT_MAP.md](PROJECT_MAP.md) 的 P2-B 长稳仍是选择下一 strict-v2 collection 的项目门槛；本续批未把候选写进公开 corpus，也不把 Work 试点结果写成正式翻译可用状态。

## 2026-09-29 编译作用域更正

上述独立 part 结果保留为历史取证。当前重编命令默认改为完整 mounted group 编译再切 episode；旧 part 模式须显式传入 --scope raw-parts。已核实 1,320 份额外简介行来自作用域差异，完整复审见 [编译逻辑修复报告](GS_GROUP_COMPILATION_REPAIR_20260929.md)。候选修复不等于正式身份回填。
