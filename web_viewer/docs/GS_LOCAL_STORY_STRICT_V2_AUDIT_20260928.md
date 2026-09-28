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
