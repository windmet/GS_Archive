# Story 文本身份补账 Batch 5（2026-09-29）

基线 `f5bc5d46`。最后 **43 个完整 group / 479 个 compiled 文件（436 集）**全部完成 identity-only backfill，新增 **13,568 个 compiled 引用**；严格候选只提供文本坐标，未替换 Runtime 字段。正式 Reader 身份新增 **6,784 行**，达到 **30,075 / 30,121**。

剩余 **46 行**恰好落在 4 个 target=0 独立文件：`025suz_403_2_4_025_03_09_b`（13）、`033shr_402_2_4_033_02_09_a`（11）、`1_x_039mcr_1_8_039_01`（5）、`5_00_017_23_5_00_017_23`（17）。不能猜测或改变 choice target；这 4 个文本身份需独立 RAW 坐标证据。

这 46 行随后已按独立 RAW 坐标补账，当前总数及运行时边界见[收口记录](GS_STORY_TEXT_IDENTITY_CLOSEOUT_20260929.md)；本段保留 Batch 5 完成时的截面。

写入前旧字节保存为 [Batch 5 回滚 ZIP](GS_STORY_TEXT_IDENTITY_BATCH5_BACKUP_20260929.zip)，SHA-256 `b54f7f8a531ce758a4bcdd7258f5e9e9cbd2588b608241d9e9d88c450a94bcb0`。479 个成员的旧字节数和 SHA-256 与各 release 的 previous_state 全部一致；尚未执行回滚演练。

`npm run verify:reading`、`npm run verify:reading-sources` 和 `python scripts/verify-mounted-story-groups.py` 通过。全量诊断无 integrity issue、compiled identity issue 或冲突 unit ID；Reader `ready=2,490`、`unsupported=311` 不变。P2-B 仍是 `NOT EXECUTED`。
