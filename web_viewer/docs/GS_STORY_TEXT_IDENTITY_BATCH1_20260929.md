# Story 文本身份独立补账：Batch 1（2026-09-29）

基线为 5 组试点提交 `1ce7d66d139a09e0d9a4d93e37f0eec9f526c559`。从未发布的 group 候选中按清单顺序选 20 个完整组，覆盖 `1_1_001jup_02` 至 `1_1_007sai_02` 的当前 mounted aggregate 与全部 episode，共 **220 个文件 / 200 集**。每组单独创建 `2026-09-29-story-text-identity-backfill-NNN` release；strict-v2 Runtime 候选仅提供文本身份，未整份挂载。

`backfill-story-text-identities.mjs` 先完成 20 组 dry-run，核对当前 compiled、Reader 单文件来源、RAW bundle、part/container、候选哈希、旧 identity 与 Reader/Runtime 非身份 parity，然后才执行 `--apply`。结果新增 **4,626 个 compiled 引用**；aggregate 和 episode 均含同一来源的引用。正式 Reader 新增 **2,313 个有效身份行**，稳定身份由试点后的 **10,627** 增至 **12,940 / 30,121**，剩余 **17,181**。Reader `ready=2,490`、`unsupported=311` 不变，身份诊断 0 integrity issue、0 compiled identity issue、0 conflicting unit ID。

写入前精确旧字节保存为 [Batch 1 回滚 ZIP](GS_STORY_TEXT_IDENTITY_BATCH1_BACKUP_20260929.zip)，SHA-256 `eca7e9e52a3b40b6e316d49353e3b9e47613107d642e0bac2e8ce12540c23685`。`python scripts/verify-story-text-identity-pilot-backup.py --zip docs/GS_STORY_TEXT_IDENTITY_BATCH1_BACKUP_20260929.zip --ids 2,3,4,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22 --count 220` 验证 ZIP 全部成员的旧字节哈希。备份存在不等于回滚已演练。

`npm run verify:reading-sources`、`npm run verify:authoritative-story-publications`、`npm run verify:reading`、`npm run verify:story-presentation`、`python scripts/verify-mounted-story-groups.py` 和全量 `node scripts/verify-publication-ledger.mjs` 均通过。回归过程中 `verify-reading-documents.mjs` 的逐字节 `hash(row.source_text)` 遇到含 `\r` 的 `1_1_007_01_g`，与正式 `sourceHash` 的换行归一化合同冲突；已改为使用同一标准校验，数据身份仍由 RAW 候选及独立诊断验证。

本批未处理剩余 163 个 group / 1,263 集及 4 个 target=0 独立来源。P2-B 仍为 `NOT EXECUTED`，Runtime strict-v2 drift 继续单列。
