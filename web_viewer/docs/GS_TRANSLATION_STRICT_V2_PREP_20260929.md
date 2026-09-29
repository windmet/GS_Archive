# 翻译前 strict-v2 审计与清理（2026-09-29）

基线为合并后的 `master` / `e4bb24af`，工作分支 `codex/translation-strict-v2-prep`。审阅包作为待验证线索；实际以本地 catalog、Reader、编译文件、RAW bundle 和候选字节为准。

## 本轮变更

全量检查 2,801 份 Reader、30,121 行非空文本。原有稳定身份 5,052 行，缺失 25,069 行、涉及 **2,049** 份文档（不是审阅中的 2,164）。缺失文档均找到唯一候选，涉及 491 个重新验证 SHA-256 的 RAW bundle。

初筛：137 份 / 964 行完全一致；588 份 / 6,955 行正文一致但运行结构存在差异；1,320 份 / 17,104 行有行投影差异；4 份 / 46 行候选不符合 strict schema。逐文档路径、哈希、候选、行数、差异字段在 [crosswalk](GS_TRANSLATION_CROSSWALK_20260929.json)。行差异不等于 RAW 丢字，例如 `1_1_001_01_b` 候选多投影了标题，而现有章节从对白开始。

第二轮将运行差异拆到字段：400 份涉及 `flow.choice_id`，189 份涉及章节聚合身份/边界，5 份涉及快照，1 份涉及时长；类别重叠。其中 **399 份独立剧情 / 4,030 行**只有选择编号升级，且所有选项跳转目标逐项一致，加入第二批。

- `2026-09-29-story-translation-strict-v2-001`：137 份无选择步骤的独立剧情。
- `2026-09-29-story-translation-strict-v2-002`：399 份独立剧情，只允许 RAW 选择身份升级。

合计 **536 份 / 4,994 行**原位替换为 strict-v2；正文、说话人原名、行序/步骤、音频和演出保持一致。原有明确人物身份不得改变；普通姓名补全偶像身份单独记录。未重写日文、Producer 占位符或猜测分支目标。发布注册表、账本和 Reader 已重建；新编译文件显式纳入 Git 并限定 LF，避免跨平台哈希漂移。

复核后稳定身份 **10,046 / 30,121 行**，仍缺 **20,075 行 / 1,513 份**。Reader `ready=2,490`、`unsupported=311` 保持不变；遍历限制与翻译身份仍是两类独立问题，不因身份补全而声称分支可读。

## 清理与恢复

线上路径中的这 536 份旧 legacy 字节已被替换，不保留第二份活动副本。旧字节仅保留在两个小型、逐文件验证的回滚包中，不由前端加载：

- [第一批清单](GS_TRANSLATION_STRICT_V2_BACKUP_20260929.json) / [回滚包](GS_TRANSLATION_STRICT_V2_ROLLBACK_20260929.zip)
- [第二批清单](GS_TRANSLATION_STRICT_V2_CHOICE_BACKUP_20260929.json) / [回滚包](GS_TRANSLATION_STRICT_V2_CHOICE_ROLLBACK_20260929.zip)

恢复时按第二批、第一批逆序恢复对应编译文件和注册表；仅恢复该批 Reader 的基线版本，然后重建 Reader、read-model 和派生清单，并记录新的 rollback transaction。不得直接改写既有发布账本。

仍由 catalog/runtime 使用的 legacy、兼容解析器以及未归属文件没有删除。`public/data/terminal/` 和用户原有未跟踪文件不属于本轮范围。剩余 1,513 份必须先解决章节标题/聚合投影、快照/时长差异以及 4 份 choice target=0，再迁移和退役；不能按缺少 `text_ref` 就删除。

## 可重复验收

`audit-translation-crosswalk.mjs` 默认只写 `.analysis` 审计，不改 public。`publish-translation-strict-v2.mjs` 默认只预检；`--apply` 才写入，第二批另需 `--choice-identities`。已发布范围会拒绝重复应用或基线漂移。

`node scripts/verify-translation-strict-v2.mjs` 从已提交回滚 ZIP 重验全部 536 份旧来源、4,994 个身份、strict schema、正文/步骤、音频、选择目标和演出；`npm run verify:reading` 及 `generate-reading-documents.mjs --check` 验证 Reader 合同与生成一致性。全量诊断保留在 `.analysis/translation-preflight/after-strict-v2.json`。页面和 read-model 验收记录在完成后追加；数据合同通过不代表媒体长稳或设备验收。
