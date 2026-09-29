# Story 文本身份补账 Batch 3（2026-09-29）

基线 `4e25a7cb`。本批按已审计清单迁移下一个 **40 个完整 group / 240 个 compiled 文件（200 集）**；只补五类文本引用，候选的 Runtime 字段没有发布。新增 **4,840 个 compiled 引用**，正式 Reader 身份新增 **2,420 行**，达到 **19,580 / 30,121**，剩余 **10,541**。

写入前旧字节保存为 [Batch 3 回滚 ZIP](GS_STORY_TEXT_IDENTITY_BATCH3_BACKUP_20260929.zip)，SHA-256 `b3bb9f5913c2db77dd6eb651d5cc873f2772e3a16ce468a248ea695e9fc49b82`。240 个 ZIP 成员均与本批 release 的 previous_state 字节数和哈希一致；尚未执行回滚演练。

`npm run verify:reading`、`npm run verify:reading-sources` 与 `python scripts/verify-mounted-story-groups.py` 通过。全量身份诊断无 integrity issue、compiled identity issue 或冲突 unit ID；Reader `ready=2,490`、`unsupported=311` 保持不变。余下 **83 组 / 708 集**及 **4 个 target=0 独立来源**，P2-B 仍是 `NOT EXECUTED`。
