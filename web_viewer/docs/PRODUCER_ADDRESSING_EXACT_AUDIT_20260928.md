# Producer 人称称呼：截图与原文的进一步核实

后续状态（2026-09-29）：两类姓名宏的屏幕显示语义已经用户批准并接入共享文本入口；运行时合同与验收边界见 [PRODUCER_ADDRESSING_RUNTIME_20260929.md](PRODUCER_ADDRESSING_RUNTIME_20260929.md)。下文保留 2026-09-28 的原始审计结论与当时未决状态。

2026-09-28；审计输入为 `codex/gs-architecture-rebuild` 的 `55f85b865469867dde8eac2c73d42e6758bdce21`。参考包 `GS_Producer_Bible_Audit_20260928.zip` 的 SHA-256 为 `280ffd3d7cb9b2d79bf5850bf8e0422e8b9aa78bbaf31277f0e423e78d1f9118`。包内说明与执行指令作为待验证材料；以下结论来自当前 checkout、包内 7 张截图的目视核对，以及本地 Reader、compiled、隔离候选和指定 RAW TextAsset 的只读扫描。

## 扫描范围与结论边界

- ZIP 的 31 个文件均通过包内 manifest 字节数和 SHA-256 校验；附带的 33 项合成测试在本机通过。包原先未跑过本地全库扫描，也未导入 Notion 数据。
- 本次定位器核对 2,801/2,801 份 Reader 文档，遍历 10,420 份 mounted compiled 和 4,939 份已存在的 strict-v2 隔离候选文件；读取非空文本字段分别为 30,121、121,649、52,704，`issues.json` 为 0。155 是**跨层重复和仅锚点候选也计入**的匹配数，不是 155 条截图绑定。
- 逐张截图的文字与包内转写相符。截图展示的是屏幕结果；左上角时钟不是视频进度，截图没有提供可核定的剧情 ID、版本或完整播放链接。因此“屏幕 ↔ 某一 RAW 版本”的最终绑定仍待人工核定，不能把下表的文本唯一候选当成游戏宏算法的证明。
- 隔离候选的 `text_ref` 与来源 hash、坐标通过工具检查，并逐条在对应 RAW 的 `Command/Values/1` 找到相同原文；这不等于相应 unit 已发布。现有 Reader 中 S01、S03 的同文行缺 `text_ref`；其余五条精确句未在 Reader 精确命中。

## 七张截图的逐句结果

表中 command 均为零基 index。`part` 是 RAW TextAsset 文件名；七条的原文字段均为 `Command/<index>/Values/1`。对应的 `unit_id` 与 bundle/container/pathID/payload SHA-256 见本地 `.analysis/producer-exact-audit-r1/raw_command_evidence.json`，不把隔离候选 ID 擅自发布。

| 图 | 屏幕形式 | 精确原文候选及源类别 | bundle / part / command | 判定 |
| --- | --- | --- | --- | --- |
| S01 大河タケル | `叶絵理奈P` | `お疲れ、●●●●プロデューサー。`；四黑点+职业词 | `scenario_1_3_10008_01.unity3d` / `scenario_1_3_10008_01_c.json` / 25 | 同文展开在多个 compiled 文件共 14 个 full-screen 候选；此候选的 RAW 说话人是 `038tak`，但缺截图剧情 ID，绑定未终审。Reader `1_3_10008_01_c:step-5:text` 同文且仅有可见角色候选，缺 `text_ref`。 |
| S02 伊瀬谷四季 | `懐意Pちゃん` | `あっ、いたいた！　●●●●プロデューサーちゃん、\nちょっといいっすか？`；四黑点+职业词+ちゃん | `scenario_5_02_024_23.unity3d` / `scenario_5_02_024_23.json` / 16 | 同一 TextAsset 在 mounted/隔离编译层重复出现；RAW 精确句与 `024shk` 对上，截图版本仍待绑定。 |
| S03 蒼井悠介 | `監督` | `監督、お願い！\n享介に渡す誕生日プレゼントの相談に乗って！`；**字面称呼，无黑点** | `scenario_1_2_012_01.unity3d` / `scenario_1_2_012_01_a.json` / 16 | RAW 证明本句原文就是字面 `監督`。Reader `1_2_012_01_a:step-5:text` 同文但缺 `text_ref`。不能拿另一条含十黑点的悠介 Work 句替代本截图。 |
| S04 円城寺道流 | `森蜥師匠` | `お返しは、●●●●●●●●●●師匠からもらった\nパワーを、少しでも返せるように選んだッス！`；十黑点+師匠 | `scenario_5_02_039_22.unity3d` / `scenario_5_02_039_22_a.json` / 37 | 这条 RAW 确有十黑点；用画面姓名代入能得到截图整句，但这只是与画面相符的展开假设，宏的全局规则仍未知。 |
| S05 円城寺道流 | `師匠` | `師匠に最高のお返しをしたくて、\n気合い入れて選びました！`；**字面称呼，无黑点** | `scenario_5_02_039_22.unity3d` / `scenario_5_02_039_22_b.json` / 35 | 与 S04 属同一 aggregate bundle 的不同分集；没有十黑点。不能据此说 S04 的十黑点被省略，也不能反过来给本句插姓名。 |
| S06 牙崎漣 | `下僕` | `おい下僕、こっち来やがれ。`；**字面称呼，无黑点** | `scenario_5_02_040_22.unity3d` / `scenario_5_02_040_22_b.json` / 13 | RAW 精确句及 `040ren` 候选已找到。先前另一个 Work 的 `下僕` 句不是本截图的来源。 |
| S07 山村賢 | `森蜥Pさん` | `●●●●プロデューサーさん、お疲れ様です！`；四黑点+职业词+さん | `scenario_5_02_000_22.unity3d` / `scenario_5_02_000_22.json` / 14 | RAW 精确句及 `101ken` 候选已找到；仅凭共同的“お疲れ様です”有 40 个宽松锚点命中，不应算作来源。 |

S01/S07 的 full-screen 命中数受 mounted 编译多版本与相同短句影响；S02–S06 也有同一 TextAsset 的 aggregate/part/隔离编译副本。不得把这些层的重复记录当作独立的游戏屏幕证据。特别是 S04、S05 的不同分集保留为两个来源，不合并为“有时有姓名”的一条规则。

## 十黑点的反例与称呼词面扫描

两条包内原本只有 Reader 位置、没有 RAW 坐标的反例现已在指定 TextAsset 逐字找到：

| Reader 行 | RAW bundle / part / command | 原文要点 | 身份边界 |
| --- | --- | --- | --- |
| `1_1_002_02_j:step-13:text` | `scenario_1_1_002_02.unity3d` / `scenario_1_1_002_02_j.json` / 53 | `●●●●●●●●●●さん` | Reader `text_ref` 为空；RAW 坐标只供审计。 |
| `1_2_029_01_e:step-19:text` | `scenario_1_2_029_01.unity3d` / `scenario_1_2_029_01_e.json` / 69 | `我が主●●●●●●●●●●` | Reader `text_ref` 为空；姓名槽还可能出现在称谓后。 |

这两条连同 S04 排除“十黑点一律删除”以及“所有姓名槽都在称谓前”的处理。四黑点+`プロデューサー` 一组有 S01、S02、S07 的画面展开例，但仍需独立测试具体设置字段、默认值与各显示入口；固定字面 `監督`、`師匠`、`下僕` 不应插入用户姓名。

特殊词面定位器另外给出 960 条跨层候选，不代表 960 次独立称呼。只看 Reader，`下僕` 7 行、`師匠` 70 行、`監督` 118 行、`ボス` 58 行、`我が主` 10 行、`主よ` 24 行；其中十黑点同句分别为 0、34、56、28、1、0 行。这只是角色词面**同句**统计，可能包含提及、角色扮演或引用，不能自动标成对 Producer 的直接称呼或译法规则。可见角色候选也不能替代明确的 speaker 身份。

## 交付与下一门槛

本次未改 RAW、public、Reader、compiled、translation overlay、运行时渲染或既有 453 条人工 review 队列。队列原文件 SHA-256 为 `7cc13bd23c9c58c45b20f7238fe92670560b876dc91a52fe4f4e41f1ab1d3c81`。两份包内 Notion 参考仍为 **0 行导入**；不能借它们补全人物关系。

验证：包内 `python -m unittest discover -s tools/tests -v` 33/33 通过；当前仓库 `npm run verify:producer-addressing-bible` 通过（1,982 条证据，review 队列及来源 hash 保持）。本批只增加审计文档与入口链接，按 `docs/BUILD_ACCEPTANCE_POLICY.md` 不做 Vite 构建或 Browser 运行验收；截图核对是对包内静态图片的目视核对。

下一轮若要把 S01–S07 升为已确认的“截图 ↔ RAW 版本”绑定，需要原视频链接及实际播放进度或其他能核对剧情/分集的来源证据。若要在产品中解释十黑点，还需原游戏的设置字段与同一源句的受控屏幕对照；本次扫描不批准全局渲染规则。已有 local 审计明细在 `.analysis/producer-exact-audit-r1/` 和 `.analysis/producer-raw-spotcheck-r1.json`，属于未发布证据，不是正式翻译账本。
