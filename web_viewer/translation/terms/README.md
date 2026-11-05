# 项目术语登记表

[`registry.v1.json`](registry.v1.json) 是项目术语的唯一来源。剧情提示词（R3.x）、通用文本提示词（card-line）、`glossary.md` 和译文术语检查都应由它投影，不再各自手写词表。这里的译法是项目选择，不代表官方中文译名。

## 状态

| status | 含义 | 提示词 | 检查器 |
|---|---|---|---|
| `approved` | 用户确认 | 写入 | 强制 |
| `project` | 现行试译词条，沿用至今 | 写入 | 警告 |
| `pending` | 待审，`zh` 为空 | 不写入 | 不检查 |

## 与旧政策文件的关系

`trial-policy.v2.3.json`、`card-line-prompt.v1.json`、`user-approved-terms.v1.json`、`term-decisions.template.json`、`voice-profiles.trial.v1.1.json` 和 `translation-r3.3.md` 的哈希被既有审校回执引用，原地不改。它们的每一条术语都已在登记表中由 `migrated_from` 承接，或由 `supersedes` 明确取代；`npm run verify:term-registry` 检查这一点，以及被取代的原文片段仍然存在。偶像姓名表继续使用 `idol-names.v1.json`，登记表只引用。

## 2026-11-05 决定

依据 [角色称呼审计](../../docs/TRANSLATION_CHARACTER_TERMINOLOGY_AUDIT_20261105.md)，用户确认：

| 原文 | 译法 | 范围 |
|---|---|---|
| ちょうちょさん | 蝶蝶桑 | 猫柳→华村；比喻用法不算 |
| チビ／ちび | 矮子 | 只限涟→武 |
| らーめん屋 | 拉面店的（指人） | 涟→道流；らーめん屋ん家→拉面店的家 |
| カエール | 蛙埃尔 | 专名；普通青蛙、路人的カエルさん不算 |
| パピ词族 | Papi、Papi Papi、PapiPuPe、HapiPapi、Papi可爱／Papi酷炫／Papi闪亮、Papi族 | 咲 |
| アルト | 阿尔托 | 丽家犬名 |
| ロール | 卷卷 | 咲→卷绪；蛋糕卷、控制不算 |
| もふもふえん | もふもふえん | 所有领域，含元数据 |
| ボス | Boss | 大吾→制作人 |
| ワガハイ／ワガハイたち | 吾辈／吾辈们 | 猫柳；禁用“在下” |
| 人名＋っち | 人名＋亲 | 四季；取代 trial-policy 中的“仔” |
| パッション | PASSION | 见下 |

两条规则：人名＋さん 仍译“先生／小姐”；固定绰号或物件＋さん 整体登记为专名，所以“桑”只经由登记词条出现。说话人专属绰号按“说话人→被称呼人”登记，不做全局替换。

### PASSION

パッション 是齋藤社長的口头禅，也被制作人和偶像在情人节、周年等剧情中复述，与活动名 PASSION FESTIVAL 同形。现译中有 PASSION、Passion、热情、激情四种写法，其中剧情以 PASSION 居多。统一为：

- 片假名 パッション／ぱっしょん → **PASSION**；汉字 情熱 照常译“热情”，两者由此区分。
- パッションの像 → PASSION之像；パッションチョコ（DX）→ PASSION巧克力（DX）；パッションシール → PASSION贴纸；パ、パ、パ、パッション → PA、PA、PA、PASSION。
- 原文已是拉丁字母的 passion（舞田类）按原文大小写保留。

## 存量回填

已发布译文的术语修正记在 `translation/studio/amendments/<日期>-terms.json`（GS-TERM-AMENDMENT-V1），每条带原文绑定和改前文本。审校回执的复现脚本先撤销术语修正、再撤销空格修正，所以历史字节不变（`scripts/lib/term-amendments.mjs`）。`npm run verify:terminology` 检查全量译文不劣于 `config/terminology-baseline.json`，并验证修正记录可复现。回填降低计数后，用 `node scripts/verify-terminology.mjs --write-baseline` 重写基线。

2026-11-05 第一批：203 个剧情单元、131 条 TM，另有 3 个草稿生成器（照片贴纸、道具礼物、元数据）同步改写。已批准词条的禁用写法降为 0。基线里仍留着这批范围外的 315プロ 等缺项。
