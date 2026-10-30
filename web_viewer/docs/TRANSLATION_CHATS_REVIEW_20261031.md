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

## 第二批完成（G-chats-20261031-002）

`G-chats-20261031-002` 全部 999 条逐句校订，修改 992 条，导入为 draft / not_final。覆盖樱庭薰后半段（001–135，接续第 1 批）、柏木翼（136–350）、都筑圭（351–574）、神乐丽（575–787）及鹰城恭二前半段（788–999）。

- [999 条原文与校订译文](../translation/studio/general/returns/G-chats-20261031-002/review.md)
- [原始回传](../translation/studio/general/returns/G-chats-20261031-002/output.original.md)、[校订输出](../translation/studio/general/returns/G-chats-20261031-002/output.edited.json)
- [992 条修改记录](../translation/studio/general/returns/G-chats-20261031-002/edits.json)、[来源与哈希凭据](../translation/studio/general/returns/G-chats-20261031-002/receipt.json)
- [12 批回传状态快照](../translation/studio/general/returns/G-chats-20261031-002/wave-status.json)

原机器回传在平假名理解、家庭关系、人名昵称及偶像组合术语上存在大量荒谬误译。修订重点示例：

| RID | 原文 | 原回传问题 | 校订 |
|---|---|---|---|
| 008 | お気遣いには及びません | 没必要担心 | 您不用这么费心 |
| 232 | 弟と妹が真似をして、モデルさんごっこを始めてしまいました | 哥哥姐姐都模仿我 开始玩模型 它消失了 | 弟弟妹妹都跟着模仿，玩起模特过家家游戏来了 |
| 465 | けいこ、がんばってくださいね | 惠子，加油！ | 排练请加油哦 |
| 478 | あなたにきょうふはありますか | 你的京府有吗？ | 你会有恐惧感吗？ |
| 505 | 音楽にりゆうはありません | 音乐没有瑞宇 | 音乐并没有什么特别的理由 |
| 584 | 先ほど貴殿から頂いたメールへの返信です | 这封邮件是回复您刚才发给你的主的。 | 这是对我刚才收到阁下发来邮件的回复 |
| 626 | 兜と祭りを回っている | 我正在兜里逛祭典呢 | 我和大吾正在逛庙会祭典 |
| 711 | フントと走ってきました | 我和伊诺洪德一起跑步 | 我刚才带着小猎去跑步了 |
| 803 | きょうじかっこいい！ | 今天真是太酷了！ | 恭二好帅！ |
| 942 | Beitはとても素敵なユニットですね | Beit是一个非常漂亮的单位 | Beit是一支非常优秀的组合呢 |

严守制作人占位符宏原字节（`●●●●プロデューサー` / `●●●●プロデューサーさん`），阿拉伯数字与原文受保护 token 100% 精确对齐。

TM 累计有效条目增至 9,961 条（0 orphan）。发布分片 chats.json 增至 1,481 条对白与 652 条选项。
verify:general-translation-workflow 与 verify-chat-translation 全部通过。
下一批从 `G-chats-20261031-003` 接续。

## 第三批完成（G-chats-20261031-003）

`G-chats-20261031-003` 全部 955 条逐句校订，修改 950 条，导入为 draft / not_final。覆盖鹰城恭二后半段（001–042，接续第 2 批）、皮埃尔（043–208）、渡边实（209–409）、苍井悠介（410–633）、苍井享介（634–869）及握野英雄前半段（870–955）。

- [955 条原文与校订译文](../translation/studio/general/returns/G-chats-20261031-003/review.md)
- [原始回传](../translation/studio/general/returns/G-chats-20261031-003/output.original.md)、[校订输出](../translation/studio/general/returns/G-chats-20261031-003/output.edited.json)
- [950 条修改记录](../translation/studio/general/returns/G-chats-20261031-003/edits.json)、[来源与哈希凭据](../translation/studio/general/returns/G-chats-20261031-003/receipt.json)
- [12 批回传状态快照](../translation/studio/general/returns/G-chats-20261031-003/wave-status.json)

原机器回传在皮埃尔假名、双子口吻及组合专属称谓上存在极其严重的机械误译（如将“心里暖洋洋”误译为人体器官、将植物花名双关全部断裂）。修订重点示例：

| RID | 原文 | 原回传问题 | 校订 |
|---|---|---|---|
| 069 | らなんきゅらす みのり、おしえてくれた。 かえるっていみ、ある。 | 瑞南丘拉斯 | 叫花毛茛！实里教我的。说是青蛙的意思哦。 |
| 150 | ぼく、えがお！ みのりきょうじも、すまいる！ | 我，艾高！稔恭二也笑了！ | 我，笑容！实里和恭二也微笑！ |
| 163 | ぼく、むねがぽかぽかなった すごく、うれしい | 我的乳房感到温暖。我好开心 | 我心里暖洋洋的，超级开心！ |
| 173 | やおやさん、さかなやさん | 八矢桑、坂名桑 | 蔬菜店老板、鱼店老板 |
| 184 | ぼく、きぐるみすき！ | 我爱基古鲁米！ | 我喜欢吉祥物玩偶装！ |
| 221 | 俺たちBeitの衣装って やっぱりかっこいいよね！ | 我们的贝特服装是什么？真的很酷！ | 我们Beit的服装，果然还是超级帅气对吧！ |
| 242 | ラナンキュラスって花なんだ。 花言葉は『幸福』 | 毛茛属植物是一种花。花的语言是“幸福” | 是叫花毛茛的花。花语是『幸福』。 |
| 420 | ●●●●●●●●●●監督、 オレたちにやってほしいこと なにかあったら教えてよ！ | 错漏监督称谓宏 | ●●●●●●●●●●监督，要是你有什么想让我们做的事，记得告诉我们哦！ |
| 465 | 315サンデーを作ったら 面白いかも！ | 315星期天 | 做成315圣代的话说不定很有意思呢！ |
| 625 | あれ、バレちゃった？ 当たりさわりのない内容なら バレないかなと思ったんだけど | 错乱代称与语境 | 哎呀，被识破了吗？本以为写得平平淡淡不会暴露呢。 |
| 871 | FRAMEの曲が流れた時の ファンの歓声が凄かったな。 | 帧曲 | FRAME的曲子响起时，粉丝们的欢呼声真的太震撼了。 |
| 929 | それから春名の好きな ドーナツと、俺が 好きなパンケーキもな。 | 煎饼 | 另外还有春名喜欢的甜甜圈，以及我喜欢的松饼也要准备好。 |

严格维持双子 10 点专属宏（`●●●●●●●●●●监督`）以及 4 点制作人宏（`●●●●プロデューサー` / `●●●●プロデューサーさん`），阿拉伯数字与受保护 token 100% 精确一致。

TM 累计有效条目增至 10,916 条（0 orphan）。发布分片 chats.json 增至 2,211 条对白与 943 条选项。
verify:general-translation-workflow 与 verify-chat-translation 全部通过。
下一批从 `G-chats-20261031-004` 接续。
