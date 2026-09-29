# Story 文本身份补账 Batch 4（2026-09-29）

基线 `7c7845e`。对下一个 **40 个完整 group / 312 个 compiled 文件（272 集）**执行 identity-only backfill，新增 **7,422 个 compiled 引用**，不挂载 strict-v2 Runtime 候选。Reader 有效身份新增 **3,711 行**，达到 **23,291 / 30,121**，剩余 **6,830**。

写入前旧字节保存为 [Batch 4 回滚 ZIP](GS_STORY_TEXT_IDENTITY_BATCH4_BACKUP_20260929.zip)，SHA-256 `4607d16301f8c129332ce5b10e8e3c000eb03d3465759945e9b6dc57d350d3c8`。312 个成员的旧字节数与 SHA-256 均匹配各 release 的 previous_state；尚未执行回滚演练。

`npm run verify:reading`、`npm run verify:reading-sources` 和 `python scripts/verify-mounted-story-groups.py` 通过。全量身份诊断无 integrity issue、compiled identity issue 或冲突 unit ID；Reader `ready=2,490`、`unsupported=311` 保持不变。余下 **43 组 / 436 集**及 **4 个 target=0 独立来源**，P2-B 仍是 `NOT EXECUTED`。
