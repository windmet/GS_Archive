# Story 文本身份独立补账：5 组试点（2026-09-29）

基线 `02cea7f98f18ec6ba23cf766015d97ccca455f40`，分支 `codex/translation-strict-v2-prep`。输入为当前 mounted compiled、`.analysis/local-story-group-v2-final` 候选及其 188 组审计、RAW bundle。附带意见是实施线索；本记录以当前本地来源、hash 和脚本核验为准。

P2-B 保持 `NOT EXECUTED`，仍约束 Story Runtime 的 release-accepted 声明及会改变 Runtime 语义的 strict-v2 promotion。identity-only backfill 独立进行：候选只提供 `text_ref` 坐标，不发布候选的 schema、duration、Spine snapshot、cue、audio、flow 或 episode 边界。用户描述的长期部署和朋友试用提供运行信心，但本批没有正式 2–4 小时仪表化 P2-B 报告。

本次对 5 个完整组（51 个 aggregate/episode 文件）执行 `node scripts/backfill-story-text-identities.mjs --groups ... --apply`，各组对应一笔 `transaction_kind=backfill` 的 publication release：

| 完整组 | Release | 特征 |
| --- | --- | --- |
| `1_1_001jup_01_1_1_001_01.json` | `2026-09-29-story-text-identity-backfill-001` | 10 集、重复 synopsis、候选 Runtime drift |
| `1_1_002dra_02_1_1_002_02.json` | `2026-09-29-story-text-identity-backfill-005` | 10 集、Producer 文本 |
| `1_1_007sai_03_1_1_007_03.json` | `2026-09-29-story-text-identity-backfill-023` | 10 集、choice、Producer 文本 |
| `1_2_027yuk_02_1_2_027_02.json` | `2026-09-29-story-text-identity-backfill-097` | 5 集、choice |
| `1_3_10002_01.json` | `2026-09-29-story-text-identity-backfill-133` | 11 集、多 choice |

工具逐组核对原 mounted 与候选哈希、RAW bundle 哈希及 part/container 对应，拒绝旧身份漂移和 unit ID 碰撞；只向五种白名单文本字段填入候选引用。补写后剔除这些字段必须与原 compiled deep-equal，Reader 行 kind、原文、说话人原名、顺序、步骤锚、控制项与状态不变。各 release 记录旧/新 artifact 哈希和基线 commit；本次未把 legacy group 写进只接纳 Runtime v2 的 `authoritative_story_publications.json`。

回滚边界：本试点首次执行时仅在进程内保留旧字节用于写入失败回滚；原 compiled 之前被 Git 忽略。随后从先前已部署的预览站点逐文件取回旧版，**51/51 均与写入前记录的 SHA-256 和字节数完全一致**，保存为 [精确回滚 ZIP](GS_STORY_TEXT_IDENTITY_PILOT_BACKUP_20260929.zip)（SHA-256 `a33b06007b29ff30e4fbbc8378882ce274b724483fc2c3a49ebf56ad5d267a17`）。`python scripts/verify-story-text-identity-pilot-backup.py` 重验 ZIP 成员及每个 release 的旧哈希。回滚仍需独立执行、重新生成 Reader 和发布恢复事务，不能把存在备份写成回滚已演练。后续批次的工具改为在写入前先将旧字节保存到本工程 `.analysis/text-identity-backfill/`。

试点新增 **1,162 个 compiled 文本引用**，其中 parent 与 episode 双份对应同一来源；正式 Reader 新增 **581 个有效身份行**。Reader 非空总行数维持 30,121，稳定身份从 **10,046 增至 10,627**，剩余 **19,494** 行。`ready=2,490`、`unsupported=311` 不变；`audit-reading-diagnostics` 报告 0 integrity issue、0 compiled identity issue、0 conflicting unit ID。`npm run verify:reading` 与 `npm run verify:reading-sources` 通过。Runtime strict-v2 drift 和 4 个 target=0 独立来源仍未处理。

下一批需在更新后的 Reader manifest 上逐文件核对未迁组的旧来源哈希，不能拿原始全局 manifest SHA 阻断后续批次；每组先完整 dry-run，再应用、重建 Reader、核对诊断及 publication ledger。剩余 183 个 group / 1,463 集与 4 个 target=0 独立来源尚未补账，最终目标仍为 30,121 / 30,121。
