# Story 文本身份补账 Batch 2（2026-09-29）

基线 `2f5b7b4b`。对试点及 Batch 1 后的剩余完整组先运行 163 组 dry-run，1,426 个 aggregate/episode artifact 全部通过 identity-only gate。旧 `talk_stamp` 有一处仅含空文本的兼容 dialogue，而 strict 候选无此容器；工具只对该空、无引用的 stamp 容器放行，未复制任何候选 Runtime 字段。

本批发布剩余清单中的前 **40 组 / 395 个 compiled 文件（355 集）**，新增 **8,440 个 compiled 文本引用**；Reader 有效身份新增 **4,220 行**，达到 **17,160 / 30,121**，剩余 **12,961 行**。Reader `ready=2,490`、`unsupported=311` 不变；全量身份诊断无 integrity issue、compiled identity issue 或冲突 unit ID。每组仍是独立 `backfill` release，保留当前 legacy Runtime 字段。

写入前的 395 份精确旧字节归档为 [Batch 2 回滚 ZIP](GS_STORY_TEXT_IDENTITY_BATCH2_BACKUP_20260929.zip)，SHA-256 `f75cb7dfb2eea4544bf9415e8203647fd265915e8cd622a63e94edd0ea40c295`。成员和每个旧 artifact 哈希由 `verify-story-text-identity-pilot-backup.py` 对本批 release 索引核验通过；未执行回滚演练。

`npm run verify:reading`、`npm run verify:reading-sources` 和 `python scripts/verify-mounted-story-groups.py` 通过。后续仍有 **123 组 / 908 集**及 **4 个 target=0 独立来源**。P2-B 仍为 `NOT EXECUTED`。
