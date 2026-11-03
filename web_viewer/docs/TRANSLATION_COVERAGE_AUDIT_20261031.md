# 全站翻译覆盖盘点 · 2026-10-31

本轮在最新远端 master `a2c07d169a3d9e3251cb424209de4166d4fee798`（#151）上新开 `i18n/20261031-coverage-audit`，固定语料基线，只盘点、校验和建立待办。原主工作区仍为 `portal/20261025-costume-filters` / `0f1e7356`，其未提交文件未带入、未修改。`CURRENT_STATE.md` 的文字基线较旧，本轮实际以 fetch 后的 Git 与文件为准。

没有生成新翻译批次、导入旧输出、提升 reviewed/final、修改 UI 或发布站点。Reader #152 的未合入改动不在本轮基线内。

## 1. 已接入语料的准确总账

重新执行 `npm run audit:translations` 后，受跟踪的 `config/translation-audit/` **没有差异**。现有面板 [ArchiveTranslationAudit.vue](../src/components/archive/ArchiveTranslationAudit.vue) 与 [summary.json](../config/translation-audit/summary.json) 继续是进度入口；本文件及 [机器快照](qa/translation-coverage-20261031/baseline.json) 是固定基线的审计证据，不建立第二套手工进度表。

| 范围 | 总数 | draft | reviewed | final | missing | stale |
|---|---:|---:|---:|---:|---:|---:|
| Reader 唯一正文单元 | 32,760 | 29,539 | 993 | 0 | 2,228 | 0 |
| 通用资料唯一原文（按 kind + field + 原文哈希） | 23,315 | 2,603 | 7,647 | 0 | 13,065 | 0 |
| 已提取 UI 词条 | 72 | 72 | 0 | 0 | 0 | 0 |
| 偶像 / NPC 显示名 | 52 | 52 | 0 | 0 | 0 | 0 |
| 卡池名称关联补录（单列，勿与道具翻译相加去重） | 81 | 0 | 81 | 0 | 0 | 0 |
| 说话人词典（现有面板未统计） | 348 | 348 | 0 | 0 | 本轮 verifier 无缺项 | 本轮 verifier 无失配 |

Reader 为 3,113 篇、1,420 个已有 overlay；通用资料有 29,234 次引用。通用记忆 orphan / invalid / unpublished 均为 0。通用语料的去重不是跨域、跨字段的纯字符串去重，不能将引用数量或不同范围的计数混算为全站覆盖率。

附件的「2,727 条通用草稿」应拆为 **2,603 通用资料 + 72 UI + 52 实体显示名**；348 条说话人草稿在这之外。词典覆盖 347 种无实体名牌，条目数多 1 是作用域词条，不能据此推断重复错误。reviewed 也不等于最终译名或 final。

### 正文与通用缺译

| 待补内容 | missing | 管线 / 顺序 |
|---|---:|---|
| 季节企划 | 2,228 | Story Studio；优先恢复这部分，其他八类正文 missing 为 0 |
| 通信对白 | 7,948 | General TM；保留会话、发言者与轮次 |
| 制作人回复 | 3,586 | General TM；保留选项和回复关系，与通信一起推进 |
| 首页通用语音 / 自我介绍 | 1,078 | General TM 的 card-lines 分片 |
| 已有转录的卡面演出语音 | 415 | General TM 的 card-lines 分片 |
| 事务所系统语音 | 11 | General TM 的 card-lines 分片 |
| 有脚本文字的未使用语音 | 15 | General TM；优先级取决于当前用户入口 |
| 摄影场景 | 12 | General TM 的 photos 分片 |

季节企划共 2,639 条，411 条为 B036 草稿。其余 Reader 的 30,121 条均已有草稿或 reviewed。正文按类型、全部通用 kind 的状态及缺译文档 ID 已保存在机器快照，不再抄写第二份数字表。

## 2. 旧批次与未导入输出

本机只读扫描主 checkout 的 `.analysis/translation-studio` 和五个历史 general 批次根目录；没有扫描所有 worktree、下载目录、浏览器会话或已删除文件。详细每份映射、输出 SHA-256 与当前源匹配结果留在本工作树 `.analysis/translation-coverage/inventory.json`。

- 发现 **1,336 份 batch-map、82 个有输出的映射目录、139 份输出文件**；不是 1,336 个独立待译批次，包含多次重导出、试译和历史副本。未发现找不到同目录映射的输出，JSON 读取错误为 0。
- 有输出的映射合计 71,267 行次，其中 71,191 行次能以当前 `unit_id + source_hash` 对上，均已有有效译文；76 行次身份或原文不再对应。以上含重复导出，不能当作唯一文本数量。
- 在严格同身份、同原文的范围内，**没有发现能补上当前 missing 的旧输出**。这不表示旧输出与当前译文逐字相同，也不表示历史稿已经通过质量审校。
- 76 行次来自 `run-250643f6b490/B012-idol-story`（17）、`run-9fa31503ff4b/B012-idol-story`（17）和 `run-9f96acb828c1/B017-idol-story`（42）。本轮不做模糊匹配、不自动迁移；将来复用必须回查当前 Reader、RAW 和迁移证据。
- 六份历史输出经 RID 格式解析仍有错误，涉及 B003 原稿、B007 原稿、B033 原稿及 TEST_ONLY 稿。快照列出文件与错误数量；没有覆盖修订稿，没有重新导入。
- 所有带输出的旧映射 `source_commit` 均不等于当前基线。RID 可解析与当前缺译匹配检查，不等于原有完整 check 的 PASS；完整 check 还要求提交、Reader、compiled、RAW、policy 与保护槽匹配。

### 季节批次不能按编号直接套用

本机现存 `seasonal-20261010` 是**三批旧拆法**，与 [第二波记录](TRANSLATION_WAVE2_INVENTORY_20261009.md) 中 10-15 的 B036–B041 六批不同：

| 现存批次（嵌套同名目录） | 行数 | 当前仍缺译 | 已有译文 | output |
|---|---:|---:|---:|---|
| B036-seasonal | 995 | 691 | 304 | 无 |
| B037-seasonal | 991 | 884 | 107 | 无 |
| B038-seasonal | 653 | 653 | 0 | 无 |

三批的 2,228 条 missing 恰好覆盖现存缺口，但 B036/B037 也混有已导入的 411 条。**不把旧 B036 当作当前 B036，不重新翻译其中已有内容。** 10-15 的六批目录当前不存在；已入库 B036 的 authoritative 草稿 receipt 是 [B036 review receipt](../translation/studio/reviews/B036-seasonal-valentine-2022-1-r33-edited-20261017/receipt.json)，明确不是整批人工审校通过。

文档记载的 `.analysis/general-translation-batches/wave2-20261015` 及其父目录当前不存在；另四个旧 general 根目录也不存在。`E:/GS_Archive_cold/20261019/cleanup-20261019.ps1:466–470` 将这些根列为清理目标，这只能佐证清理意图，不能证明每个子批次如何处理。有限查看的冷存目录未找到对应批次，未进行全盘恢复搜索。不能据旧文档声称 12 批通信与 2 批首页语音的包仍可直接复用。

## 3. 整站文本域与面板盲区

| 文本面 | 当前证据 / 入口 | 盘点结论与下一步 |
|---|---|---|
| Reader / Player 正文、选项 | `reading/manifest.json`、Story overlay、现有审计 | 已有稳定身份与逐域统计；先补季节 missing，再审校草稿 |
| 人物显示名、名牌、匿名标签 | entities/idols、npcs、speakers；speaker verifier | 显示名仍 draft；名牌应补入将来的面板范围；匿名与 #N/A 不猜身份 |
| 卡片标题、台词、触摸、电话标题 | General kind 注册表、card-lines 分片 | 均已有 reviewed；keep-source 是明确决策，不能用中日字符串相等判为缺译 |
| 通信对白 / 回复 | chat-text-index、chat-line / chat-choice | 11,534 条 missing；不是已经翻译完成，verifier 通过只证明工具与消费合同 |
| 首页、事务所、卡面演出及未使用语音文字 | 对应 voice kind 与分片 | 有字可翻与 audio-only 分开；不将音频数量当作日文句数 |
| 道具、衣装、货币、称号、技能 | General TM、kind 注册表 | 全部进入现有总账；技能等草稿需要质量复核 |
| 偶像资料、组合简介、签名、工作名 | profiles 分片 | 已接入部分为 draft；不推定资料页每一个字段均已接入 |
| 摄影场景、地点、相框、贴纸、背景与差分 | photos 分片 | 12 条场景缺译；其他接入字段有 draft |
| 卡池名 | gasha-ticket-evidence | 81 个名称 reviewed；82 条目录记录，关联条数不等于独立译文数 |
| 已提取播放器 / Reader UI | zh-CN / ja-JP UI 字典 | 72 个配对 key；当前审计的 draft 是结构口径，不是人工质量证明 |
| 门户、详情、摄影、舞台与设置的硬编码 UI | `src` 静态候选 CSV | 已建立文件 / 行号候选；需要逐页判定双语范围、专名与中文直写，不计为 missing 总数 |
| 活动 / 歌曲 / 作品专名、动态文案 | src 数据、目录与 read-model 消费 | 需要字段级范围决策；注册表尚不是所有数据字段的清单；保留原名须有明确决策 |
| 图片内文字、歌词 | 原图 / 歌词资源 | 未建立逐资源文字清单；单列未测，不混入正文完成率 |
| 未进入 Reader 的 RAW 文本 | 原始资源与 publication 范围 | 尚未全量建立身份，不凭 Reader 计数推定已覆盖 |
| 仅音频：卡面 2,568、其他语音 948、LiveResult 未计量 | 现有 summary.pending | 先转录与核实，再入库翻译；优先实际展示的语音 |

静态扫描覆盖 481 个跟踪的 `src/**/*.vue/js/ts` 文件，发现 2,434 行 CJK 字面量候选，排除 src/data 与 locale 字典；附行号清单位于 `.analysis/translation-coverage/ui-candidates.csv`。含中文硬编码、日文专名、部分已接线字符串与误报；不覆盖动态数据、纯英文或跨行拼接。**候选行数不等于缺译数，也不是 Browser 可见文字清单。** 尚未执行逐页切换语言、移动端、隐藏状态、弹层、错误态或空态的 Browser 覆盖验收。

## 4. 规范状态与质量审校

| 规范来源 | 当前事实 | 能用于什么 |
|---|---|---|
| [B001 receipt](../translation/studio/reviews/B001-main-r3-20260929/receipt.json) | reviewed，993 条，仍 not_final | 已确认批次基准；不能推导所有后续批次已认可 |
| [R3.3](../translation/studio/policy/translation-r3.3.md) | 文件开头明示本轮试译编辑选择 | 当前翻译提示与审校依据，不能改称全项目公开最终审定 |
| [术语决策模板](../translation/studio/policy/term-decisions.template.json) | 9 项 chosen_zh 为空 | 是历史待选模板，不表示后续已有记录的决定无效 |
| [trial-policy v2.3](../translation/studio/policy/trial-policy.v2.3.json) | 48 项，frozen-for-trial，public_approval=false，3 项 pending_terms | 局部用户确认与编辑试用必须逐条看 provenance；不可整体升级 |
| [人物口吻 v1.1](../translation/studio/policy/voice-profiles.trial.v1.1.json) | 13 人、试用状态 | 不是 49 人均已有冻结口吻档案 |
| [姓名 v1](../translation/studio/policy/idol-names.v1.json) | 49 项，其中 44 项 project-draft、5 项 user-selected | 皮埃尔、渡边实、猫柳桐生、阿斯兰·别西卜II世、古论克里斯已有逐项用户选择记录；实体 overlay 的 49 项仍是 draft，不能混淆两个状态 |

后续建立 `translation/bible/GS_ARCHIVE_ZH_CN_TRANSLATION_BIBLE.md` 时，应按人名 / 组合 / 作品、人称敬称、人物口吻、游戏术语、格式保护槽五部分，逐条记录「已确认 / 批次限定 / 试用 / 待选」、证据文件、适用范围与 supersedes。先整理来源，不能把模板、R3.2、R3.3 和模型译例拼成全部已确认的规则。本轮没有替用户选择待定译法。

质量审校先查原意与跨行遗漏、否定数量条件、口吻、称呼关系、自然中文和保护槽。机检 PASS 不代替逐条审校，review 命令只在真实校对者确认完整批次后执行。已有 reviewed 内容不默认重翻；草稿修订按原身份与哈希回填。

## 5. 发布闭环与下一批

本轮另检查本地 `public/translations/manifest.json` 的 1,483 个文件 SHA-256、字节数与 release 聚合摘要，并与 `config/translation-release.json` 比对，全部通过。翻译 release 为 `e9e6b7916005a5d77f665b44894c93e75f4f7b2c7ee7adc4893bda8e32874757`。机器快照记录结果；这只证明当前受跟踪翻译包自洽，**不证明 R2、read-model 或线上实际使用了这些译文**。原主工作区两个 release/manifest 未提交差异未触碰，不能将它们当作本轮新发布结果。

下一批按以下可验收边界推进：

1. 在固定 i18n 提交重新导出季节企划的实际 missing，重新核对 2,228 条、不带入已译 411 条；保留 RID、原文、source_hash、上下文与 `{{GS_ADDRESS:...}}`。保留旧 map 仅作对照，使用新批次身份避免重号歧义。
2. 通信重新从 General TM 导出当前 missing，保留会话上下文；再处理首页 / 卡面 / 事务所语音与 12 条摄影场景。沿用 [General 工作流](GS_ARCHIVE_GENERAL_TRANSLATION_WORKFLOW.md)，不合并两条管线。
3. 草稿审校与翻译规范来源整理独立留痕；规范未确认的内容不自动 frozen/reviewed。
4. 将静态候选逐页转为 UI 覆盖矩阵，记录桌面 / 手机、语言模式、状态、可见原文、范围决策；动态数据字段及图片 / 歌词 / RAW 另列清单，逐步消除 unmeasured。
5. 未来每批 import 后生成 general overlay / release / audit / 搜索本地化，验证实际受影响消费者；发布另行授权并记录代码提交、翻译 release、read-model release、HTTP 与 Browser 消费证据。

## 6. 复现与验证边界

在本 i18n 工作树的 web_viewer 目录执行：

```powershell
npm run audit:translations
node scripts/general-translation-workflow.mjs verify
node scripts/inventory-translation-coverage.mjs --local-root E:/Web_build/SideM_Archived/web_viewer --out .analysis/translation-coverage
node scripts/verify-story-translations.mjs
node scripts/verify-speaker-label-dictionary.mjs
node scripts/verify-card-line-translation.mjs
node scripts/verify-chat-translation.mjs
git diff --check
```

审计与上述回归通过；speaker verifier 初次因新 worktree 缺 Vue 依赖无法启动，联接主 checkout 的 node_modules 后复跑通过。没有复制 public 语料、没有运行应用 build、没有创建发布包或启动 / 重启服务。该脚本只读源文件与显式指定的历史批次根，写入输出 JSON/CSV；完整历史批次 check、翻译质量、Browser 与线上部署不在其 PASS 含义内。
