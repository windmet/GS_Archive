# RAW 选择与分支编译修复（2026-09-30）

输入：`codex/story-interaction-v2-before-b002`，`279807e6356d57fcb9d5f9828ca110f9aa618e49`。本批修复当前挂载的 compiled → reading → readmodels → Player/Reader 链路；不重新编译或替换画面快照、对白、音频、译文或 RAW 包。

遍历 1,435 个 RAW 剧情包、4,939 份 Command 脚本、330,025 条指令；1,286 份脚本含选择。非 Command 的聊天 Nodes JSON 和空占位文件单独登记，扫描错误为 0。12 处 `appeal` 均来自 `text_select` 第三栏，聊天第三栏 2,268 处真实附文保留。

旧问题来自有限的电话两选一修补与编译投影丢失 label，而不是 EP 尾号。新解析器按源文件、part、command_index、原文和精确 RAW 哈希绑定，解析任意标签拼写的前向命令图，以各路径必经的共同后继证明汇合。支持多选、聊天、共用正文、嵌套选择、静默画面和结束选择；缺失标签继续拒绝。严格 v2 投影和拆分 episode 均保留、重定位这些证据。

挂载修复 511 份 compiled 文件，增加 378 个父/分段分支证据；仅 5 个 option target 有 RAW 证明的修正（舞田類的一次连续选择，活动 30005 的共用正文：父/分段各两项）。所有原有 step/text unit/source hash/dialogue/scene/audio 字段深比较保持一致。`appeal` 保留原文和 text_ref，在编译阶段标记 `presentation-marker`，阅读文档生成 `choice_metadata`，公共阅读投影不再当作附文；旧锚点仍能定位对应选项，旧缓存显示回退保留。

阅读文档 2,801 份：ready 2,492 → 2,798，unsupported 309 → 3。指定第三话 EP04/05/08、第十话 EP09/10 已 ready。另两份原先因 `fadecolor` 被误判的文档恢复，作为静默视觉步骤投影。

剩余 3 份是 RAW 缺陷，不猜测替代标签：

| 文档 | 源证据 |
| --- | --- |
| `025suz_403_2_4_025_03_09_b` | cmd20/21 都指向 `phone_select2`，后面仅 `phone_select1` 标签 |
| `033shr_402_2_4_033_02_09_a` | cmd19 指向 `phone_select3`，cmd20 标签实际为 `0.5` |
| `1_4_001_04_g` | cmd55 跳往 `g3000`，不存在该前向标签；另一分支跳往 `g4000` |

校验：全 1,286 份含选择 RAW 经当前 Python 编译器回归，仅上述 3 份异常；2,801 文档完整哈希/合同/行唯一性/真实附文/元数据别名验证；324 个阅读分支的所有选项执行实际 useStoryNavigation 前进、嵌套选择、返回和结束检查；损坏证据拒绝。`verify:reading`、`verify:reading-sources`、`verify:player-qa`、`verify:story-schema`、`verify:reviewed-b001` 通过（B001 52 文档、42 目录、993 单位）。原 schema 验证把历史 identity backfill 一律误当 strict promotion，现按实际 runtime_contract 区分，严格输出仍必须登记、通过严格 schema。

精确扫描、备份和候选证据在 `E:/Web_build/SideM_RAW_Flow_QA_20260930`；包含 `raw-selection-inventory.json`、`repair-ledger.json`、`compiler-acceptance.json`、`reading-candidate-acceptance.json` 和逐文件 `before/`。此目录为小型 JSON 源/校验材料，不含媒体包。发布账本新增 supersede 事务，保留既有 RAW 来源和全部 owner artifacts，未把 compatibility 数据提升为严格 Runtime。

代码构建与 Browser 实际旅程将在新 readmodel release 切换后补记；目前不宣称部署、媒体发布、真实设备或全分支画面验收。
