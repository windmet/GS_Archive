# Story 文本身份补账收口（2026-09-29）

基线为 `master` 合并后的 `e4bb24af`，工作分支 `codex/translation-strict-v2-prep`。本轮以当前 mounted compiled、Reader、RAW bundle、候选账本和逐文件 publication record 为准；审阅包只提供待核实线索。

## 覆盖与边界

翻译前审计发现 30,121 条非空 Reader 文本行中缺少 25,069 条稳定身份。536 份独立正文 strict-v2 publication 补上 4,994 条；其后 identity-only 路径覆盖 **188 个完整 group / 1,509 集**及 **4 个 target=0 独立剧情**。最终全量 Reader 诊断为 **30,121 / 30,121** 条文本行具有 `text_ref`，`reading_units.unique_ids=30,121`；2,801 份文档中 `ready=2,490`、`unsupported=311`，没有把遍历受限误记为可读。

188 组按 5 组试点、Batch 1（20 组）、Batch 2（40 组）、Batch 3（40 组）、Batch 4（40 组）、Batch 5（43 组）发布。组补账覆盖 aggregate 与 episode，但同一文本在 Reader 中只计一次。最后 4 份独立剧情的 RAW 文本坐标分别补上 13、11、5、17 条；其无效 `target_step_id=0` 原样保留，仍不能作为 strict-v2 Runtime 候选发布。

每笔 identity-only transaction 均在写入前核对正式来源、Reader、候选和 RAW bundle 哈希，并验证正文、步骤、音频、choice target 与非身份 Runtime 字段不变。严格候选只提供文本身份，没有整份替换正式 Runtime，也没有改写日文或推断分支目标。聚合候选仍有 46 集 Runtime 差异；P2-B 真实音频验收仍为 **NOT EXECUTED**。文本身份清零不解除这些独立门禁。

## 回滚与发布记录

旧 compiled 精确字节分别保存在[试点](GS_STORY_TEXT_IDENTITY_PILOT_BACKUP_20260929.zip)、[Batch 1](GS_STORY_TEXT_IDENTITY_BATCH1_BACKUP_20260929.zip)、[Batch 2](GS_STORY_TEXT_IDENTITY_BATCH2_BACKUP_20260929.zip)、[Batch 3](GS_STORY_TEXT_IDENTITY_BATCH3_BACKUP_20260929.zip)、[Batch 4](GS_STORY_TEXT_IDENTITY_BATCH4_BACKUP_20260929.zip)、[Batch 5](GS_STORY_TEXT_IDENTITY_BATCH5_BACKUP_20260929.zip)和[4 份独立剧情](GS_STORY_TEXT_IDENTITY_STANDALONE_BACKUP_20260929.zip)。每个 ZIP 的成员、大小和 SHA-256 对照各 release 的 `previous_state` 验过；**未执行实际回滚演练**。最后一包 SHA-256 为 `b05ef7feef1c93fa75d5584898574e4fad92960bd46d89b1c72b2b8953c2b61c`。

publication manifest 为 198 releases / 1,367 stable logical IDs，其中本轮 identity-only 新增 188 个 group 和 4 个独立 logical ID；既有 owner 与当前 Runtime 指向没有越权改变。最后 4 笔 release 为 `2026-09-29-story-text-identity-standalone-001` 至 `004`，当前 Browser acceptance 字段仍为 `not-tested`。

## 验收与派生证据

全量 `audit-reading-diagnostics`：2,801 documents、30,132 rows（30,121 text / 11 nontext）、30,121 identity-verified，0 missing、0 integrity issue、0 compiled identity issue、0 conflicting unit ID。Reader 合同/来源/生成一致性、mounted group、story presentation、authoritative publication 注册表及完整 publication ledger 通过。最后 4 份的 choice target 数组中共 5 个零值，补账前后逐项相同。

Producer 称呼 Bible 已从当前 Reader 重生成：1,982 条完整证据、163 个汇总组，440 条抽样复核队列；旧队列中 13 条仍在完整证据集但已不属于当前抽样。核对旧表所有人工字段为空、状态均为 `unreviewed` 后，仅移除这 13 条，保留其余 440 条原行；`verify:producer-addressing-bible` 通过。完整派生文件位于 `.analysis/translation-bible`，不作为手工验收或译文。仓库当前没有独立的翻译 benchmark corpus 契约或产物，本轮不虚构一个基准集。

本轮为文本身份与派生数据变更，没有进行新的 Browser、实机、真实媒体长稳或远端部署验收。既有 `unsupported` Reader 的可遍历性以及 46 集 Runtime 差异仍须按各自门禁处理。
