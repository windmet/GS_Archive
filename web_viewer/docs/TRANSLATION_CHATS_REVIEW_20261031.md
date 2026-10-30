# Chats 第一批回填校对（2026-10-31）

输入 HEAD `f3524938`；分支 `i18n/20261031-coverage-audit`。本轮用户要求继续回填校对 chats。最终核对时 12 批均已回传，共 11,534 个独立原文单位，结构、编号、源哈希、宏和数字检查通过、orphan 为 0。模型名称未注明，不推定具体模型。

## 本批完成

`G-chats-20261031-001` 全部 999 条按原文与对话顺序对照，修改 975 条，导入为 draft / not_final。覆盖冬马、翔太、北斗、辉及薰的前半部分。薰其余内容在第 2 批，不能把角色边界当作整批完成。

- [999 条原文与校订译文](../translation/studio/general/returns/G-chats-20261031-001/review.md)
- [原始回传](../translation/studio/general/returns/G-chats-20261031-001/output.original.md)、[校订输出](../translation/studio/general/returns/G-chats-20261031-001/output.edited.json)
- [975 条修改记录](../translation/studio/general/returns/G-chats-20261031-001/edits.json)、[来源与哈希凭据](../translation/studio/general/returns/G-chats-20261031-001/receipt.json)
- [12 批回传状态快照](../translation/studio/general/returns/G-chats-20261031-001/wave-status.json)

原回传有普遍的逐行机械翻译、主客体错位、专名错误、漏译和混入提示。第 1 批有 142 处说话人提示进入正文。修订示例：

| RID | 原文 | 原回传问题 | 校订 |
|---|---|---|---|
| 001 | 俺たちのライブどうだった！？ | 我们的生活怎么样！？ | 我们的演唱会怎么样！？ |
| 031 | さすが冬馬さんです | 不愧是当麻桑的期待 | 不愧是冬马先生 |
| 144 | ゲラ上がったんだって？ | 它上升到厨房了吗？ | 杂志采访的校样出来了？ |
| 145 | その時にチェックするな | 那就别检查了 | 到时候看看 |
| 203 | お安い御用です | 它很便宜，你可以使用它 | 小事一桩 |

保持制作人宏原字节、数字与表情标记；清除提示，不将译注写进正文。RID 781 天气/转机（tenki）和 796 十只蚂蚁/谢谢（ari ga tou / arigatou）两处双关仍标 uncertain，notes 留待确认；没有升级 reviewed 或 final。原始 output.md 未覆盖。

剩余 `002–012` 的 10,535 条仅完成结构/身份检查与部分质量观察，尚未全量逐句校订，未导入。其他卡面语音批次不在本次导入范围内。后续从 `G-chats-20261031-002` 接续，不应把结构 PASS 当成译文质量 PASS。

## 索引与 Player 接线

1. 通信列表标题来自聊天首句，但 compiled index 把换行转为空格并截取前 80 个 Unicode 字符。之前按精确原文查找时漏掉这些标题；现从原始首句译文派生 54 个目录别名，不另造 TM，也不覆盖精确原文或歧义条目。另保留既有 20 个随机话题标题别名。
2. 实际聊天 compiled 已带 `text_ref`，旧 `isLegacyChat` 判定阻止了加载。现 talk_mode 仅触发加载；正式引用还要匹配发布分片内的 649 个源聊天 catalogue 清单、当前引用的 catalogue 前缀及该原文的 SHA-256。既有剧情 overlay 优先；其他剧情/版本/原文/哈希不匹配仍回落原文。无引用的旧聊天继续兼容。
3. General TM 仍是唯一翻译来源。没有把聊天伪装成新一批剧情译文，Reader 正文的 32,760 条和既有 reviewed 状态不变。

## 验证与边界

- 正式 General check/import 999 条；后续措辞修正按 --replace 只更新 1 条，其他 998 条不变。全部 draft，2 uncertain。
- 原始回传 → 修改记录 → 校订输出 → TM → 发布分片逐条一致，原文、key、source_hash、凭据字节哈希和数量已复核。
- 严格 TM 校验：8,962 条有效，0 orphan；General 审计 invalid/unpublished 均 0。聊天缺译 10,535 条（回复 3,253、对白 7,282）。
- verify:general-translation-workflow、verify-character-line-text、verify:producer-addressing-runtime、verify-story-localization-runtime 通过；故意模拟 HTTP 503 / 无效条目的 fixture 警告不代表实际语料失败。
- verify-chat-translation 覆盖旧/当前聊天、原文/译文、对白/回复短选项/回复全文、catalogue/引用前缀/原文哈希失配回退、标题派生、Unicode 截断和精确条目优先。
- build:check 完整代码编译通过，固定 .analysis/build-check，无 public 语料复制。构建环境造成的 resource-audit 差异还原。既有背景资源与 chunk 体积警告未新增处理。
- 实际 Browser：本 worktree 的 127.0.0.1:5251 dev 服务，PID 26452；候选 rm-release-20261030b。桌面 1440×900 经 通信 → 选择冬马 → 个人聊天 14 条（标题均中文）→ 演出，首句与后续对白显示双语，回复选项中文可选择；390×844 继续当前方向可正常显示、返回目录。目录日/中开关均验证并恢复中文，console error 为空。没有物理手机或生产部署验收。
- 截图：E:/Web_build/GS_Archive_Domain_Work/chats-translation-qa-20261031（chat-index-desktop.png、chat-index-mobile.png、chat-player-desktop.png、chat-player-mobile.png、chat-choice-desktop.png）。

本批只提交、推送当前翻译分支，不合入 master，不部署。
