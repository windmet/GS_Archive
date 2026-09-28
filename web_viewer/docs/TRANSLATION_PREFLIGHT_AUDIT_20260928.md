# 翻译前正文与身份审计（2026-09-28）

## 后续出版与 Reader 修复（同日）

本节记录后续 Work 正式出版和生日剧情 Reader 入口修复后的现状；下文的
932/29,172 和“缺失”结论保留为原审计时点的历史基线，不应当作当前计数。
Work publication `2026-09-28-story-work-text-backfill-001` 已将 637 份作品的
4,103 条非空文本行纳入稳定身份；详见
[`GS_WORK_TEXT_PUBLICATION_20260928.md`](GS_WORK_TEXT_PUBLICATION_20260928.md)。

Reader 现在对唯一完整覆盖父文件的单集剧情，在分集文件不存在时复用已经
登记的父 compiled；`1_2_001_12` 因此成为可读文档，使用
`1_x_001tom_2_1_2_001_12.json` 的 15 段对白，不导入 a/b/c 重复文本。
重新运行 `node scripts/audit-reading-diagnostics.mjs` 得到 2,801 份文档、
30,121 条非空文本行，其中 5,052 条具有已核验身份、25,069 条仍缺身份；
一致性异常和身份冲突均为 0。该生日剧情新增 17 条有身份文本行，缺身份
数量不变。Reader 仍有 311 份 unsupported，主要为控制流问题。

这些数字只覆盖 Reader 投影与现有 compiled 身份，不代表 RAW 全量完整性、
语境核查、译文交付或生产部署验收。

输入分支 `codex/gs-architecture-rebuild`，HEAD `5cf227190e708c4846cf434b272db9f39baad449`。用户提供的 unsupported 分析用作待验证假设。本批只增加审计工具、回归与记录；结论来自当前文件及本地 RAW 实测。

## 结论

主要缺口是稳定翻译身份，而不是已经证明全库遗失了原文。Reader `ready` 只说明阅读投影能力，不能代替翻译回填条件。311 份 unsupported 全部缺少文本身份，当前不能据此直接放行翻译 overlay。已有 114 份文档、932 条文本通过现有编译产物的身份/哈希检查，可作为下一批来源核验候选；这不代表已完成 RAW 完整性或译文验收。

另确认一处 Reader 发现路径缺口：冬马生日剧情 `1_2_001_12` 的 RAW 和父级编译文件存在，但分集文件缺失，15 段对白未被当前 Reader 收录。不能将父级和 a/b/c 的同文版本重复计为 30 段遗失。

## 全量范围与计数

对 manifest 所属 2,800 份 Reader 文档逐一核对文件哈希、源 compiled 哈希、manifest 元数据，并在内存重建 rows/diagnostics/controls/status：一致性异常 0。未覆盖全部 RAW、游戏 UI、卡牌名称或其他非 Reader 文本。

| 项目 | 数量 |
| --- | ---: |
| ready / unsupported / excluded | 2,489 / 311 / 1 |
| 全部行 / 非空文本行 / stamp 等非文本行 | 30,115 / 30,104 / 11 |
| 带有效 text_ref 的文本行 | 932 |
| 缺少 text_ref 的文本行 | 29,172 |
| report-only eligible / partial / blocked 文档 | 114 / 0 / 2,686 |
| legacy v1 / strict runtime v2 文档 | 2,777 / 23 |
| compiled 现有身份数 / 未投影到 Reader 的身份数 | 932 / 0 |
| 重复 unit_id / 冲突 unit_id | 0 / 0 |

eligible 表示本次 compiled/Reader 的 ID、来源坐标和原文 hash 校验通过；blocked 表示尚不能可靠回填翻译，不表示日文不可读。missing-text-ref 按非空行计数；没有把 11 个非文本行计为缺失。

| 域 | 文档 | 非空文本行 | 有效身份 | 缺身份 | unsupported |
| --- | ---: | ---: | ---: | ---: | ---: |
| card_scenarios | 342 | 3,633 | 0 | 3,633 | 248 |
| unit_story | 540 | 6,342 | 0 | 6,342 | 0 |
| idol_story | 484 | 5,303 | 522 | 4,781 | 2 |
| event | 396 | 5,841 | 171 | 5,670 | 32 |
| main | 204 | 3,483 | 239 | 3,244 | 19 |
| work | 637 | 4,103 | 0 | 4,103 | 0 |
| birthday | 152 | 761 | 0 | 761 | 1 |
| extra | 45 | 638 | 0 | 638 | 9 |

缺身份行类型：dialogue 24,517；choice 1,059；title 1,652；synopsis 871；caption 813；narration 178；choice_detail 82。2,777 份均有 compatibility 警告，但其中 91 份 legacy 文档已具备身份，故不能只按 schema_version 判定翻译可用性。

## unsupported 具体原因

| 原因 | 文档数 | 诊断次数 |
| --- | ---: | ---: |
| branch-exits-unavailable | 308 | 323 |
| nonsequential-choice-path | 129 | 139 |
| unresolved-choice-target | 4 | 5 |
| unsupported-step-kind | 2 | 3 |
| invalid-stamp-identity | 0 | 0 |
| unsupported-control-flow | 0 | 0 |

原因重叠，不能相加作总文档数。互斥组合：仅 branch 176；branch + nonsequential 128；branch + unresolved 3；仅 nonsequential 1；仅 step-kind 1；branch + step-kind 1；仅 unresolved 1，合计 311。

`unsupported-step-kind` 三次全部为视觉指令 `fadecolor`：`1_2_005_01_a` step 19，以及 `1_3_30013_01_j` steps 53、56。它们没有 dialogue/text_time/options 文本容器。前者 RAW 抽查 15 个文本槽全部已有 Reader 文本，因此该 unsupported 不是已证实的漏文；后者还有独立分支问题。

未解析目标清单（step 为当前 compiled step_id）：

| 文档 | step | 标签 | 选项原文 |
| --- | ---: | --- | --- |
| 025suz_403_2_4_025_03_09_b | 9 | phone_select2（两个选项） | 大丈夫だと思います！ / 先方に相談して\nおきます |
| 033shr_402_2_4_033_02_09_a | 7 | phone_select3 | バッチリです |
| 1_x_039mcr_1_8_039_01 | 8 | talk_select1 | 必ず行きます！ |
| 5_00_017_23_5_00_017_23 | 31 | a2011 | パッション！！ |

RAW 中 `2_4_025_03_09_b` 的 command 20、21 都选 `phone_select2`，command 22 却声明 `jump_point phone_select1`；`2_4_033_02_09_a` command 19 选 `phone_select3`，command 20 声明 `jump_point 0.5`。当前编译器只读重编仍产生目标 0：不是重新跑编译就会自动消失的问题。两份样本 13/11 个文本槽均与 Reader 对得上，文本存在与分支路径可信度必须分开。其余两份目标异常暂未做完整 RAW 控制流解释，不猜测修复目标。

## RAW 抽查：实际缺口与去重

通过 Unity TextAsset 精确名称、container_path 提取 10 个明确 source part，记录 bundle/payload SHA256，调用当前 ScenarioCompiler 在内存生成候选；不写 public、不发布候选身份。command_index 从 0 开始。

| source part | 候选文本槽 | 对应 Reader 行 | 差异说明 |
| --- | ---: | ---: | --- |
| 1_4_001_03_h | 34 | 32 | command 0 的 synopsis/title 未在此分集出现，但同文已在 `_a` 收录 |
| 2_4_025_03_09_b | 13 | 13 | 文本多重集一致；目标标签异常如上 |
| 2_4_033_02_09_a | 11 | 11 | 文本多重集一致；目标标签异常如上 |
| 1_2_005_01_a | 15 | 15 | 文本多重集一致；fadecolor 能力差异 |
| 1_3_30013_01_j | 35 | 33 | command 0 的 synopsis/title 未在此分集出现，但同文已在 `_a` 收录 |
| 5_00_017_23 | 17 | 17 | 文本多重集一致；包含短选项及详细文本 |
| 1_2_001_12 | 17 | 0 | 无对应 Reader 文档；2 个结构文本 + 15 段对白 |
| 1_2_001_12_a / b / c | 各 7 | 各 0 | 每段 2 个重复结构文本 + 5 段对白；与父级有换行/空白版本差异 |

前两处结构文本例：`好きに真っすぐ！`、`Petit à petit l'oiseau fait son nid.`，均不是全库缺失。逐分集翻译交付时仍需决定复用与来源身份归属，不能擅自用同文代替 source identity。

生日缺口的发现链：

1. coverage 排除 `episodes/1_2_001_12.json`，原因 `source-read:ENOENT`；该文件实测不存在。
2. catalog 父级 `1_x_001tom_2_1_2_001_12.json` 存在，strict v2、20 steps，episode 指向 root part `1_2_001_12`。Reader discovery 由此寻找缺失的 episode 文件。
3. RAW `scenario_1_2_001_12.unity3d` 含 root 与 a/b/c 四份精确 TextAsset；manifest 中没有其对应条目，row anchor 也无对应 source_part_id。
4. 标题 `世界にひとつだけのバースデーカレー` 和梗概在 `1_2_001_02_a` 有同文匹配；15 段对白全库精确匹配与去空白匹配均为空。例如 root command 25 `うん……うんうん！…今日のカレー、すごくいい感じ。…`，command 69 `カレーもケーキも\n喜んでもらえたかな。`，command 160 `さっすが冬馬君！\n楽しみにしてるね♪`。
5. root 与 a/b/c 不应双重导入。恢复前需核定 catalog、publication 和分集所有权，再修复派生文件/发现规则并验证 UI 入口。

抽查候选均生成 text_ref，但只证明这 10 份 RAW 可由当前编译器提取。未验证全量 RAW 完整性、所有命令文本字段覆盖、候选 ID 的正式 scenario 命名或对话顺序/舞台等价；不能用它替换全量编译产物。

## 下一批修复顺序

1. 优先恢复 `1_2_001_12` Reader 入口，确定 root 与 a/b/c 的唯一出版方案；回归 catalog → publication → compiled → Reader → 可见入口。
2. 选一个小域从 RAW command 坐标重建稳定身份，保留 source file、part、field、ordinal 和规范化原文 SHA256。逐份对比文本/控制流/舞台差异，不能按 Reader 行号补造身份。已有 932 个 ID 必须保持兼容或提供明确迁移映射。
3. 单独处理 fadecolor 的 Reader 支持，不把分支 unsupported 顺带改成 ready；对于原始标签异常，保留诊断和上下文待核。
4. 建立批次台账：身份已核验、RAW 覆盖已核验、上下文待核、可交付翻译、可回填分别记录。翻译前先确定术语、角色称呼、短/长选项、标题复用等规则。

## 复现与验收边界

从 web_viewer 运行：

```powershell
node scripts/audit-reading-diagnostics.mjs
python scripts/audit-reading-source-samples.py
node scripts/verify-reading-diagnostics-audit.mjs
node scripts/verify-reading-documents.mjs
npm run verify:story-text
```

本轮上述检查通过。独立审计工具的回归覆盖 Unicode/BOM/换行 hash 规范化、陈旧 hash、来源坐标不匹配、缺 ID、非法 ID 和不安全来源路径。全量 Reader 重投影与哈希一致性为 0 异常；932 条既有 compiled 身份均已投影。

完整机器报告位于本工作区 `.analysis/translation-preflight/reading-diagnostics.json` 和 `raw-samples.json`，包含每条缺身份原文、anchor、逐诊断详情、RAW 来源哈希及候选缺口坐标；体量较大，不提交语料副本。脚本和本文提交即可在持有同一公开产物及本地 RAW 的环境复现。

本批为独立审计工具改动，按 BUILD_ACCEPTANCE_POLICY 不执行 Vite 构建；未涉及渲染改动，不主张 Browser、真机、译文或部署验收。
