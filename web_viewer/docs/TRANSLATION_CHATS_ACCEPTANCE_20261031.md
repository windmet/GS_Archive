# Chats 002 起的回填验收补正（2026-10-31）

输入 HEAD `e391de58`，验收期间另有同工作区提交 `8f64c02e`（发布清单更新）；沿用 `i18n/20261031-coverage-audit`。用户已提交 chat002–012 的编辑回填，本次基于这些已导入版本验收，未覆盖其原始回传、校订输出或 receipt。

## 续验：chat005 全量语义复验

输入 HEAD `5f65ac98`。chat005 的 999 条全部逐句对照原文和当前 TM，追加修正 86 条，保持 draft。补齐原文“隼人さん／旬さん／夏来さん／春名さん”的先生称谓；九郎不擅用“我等”；撤去“热血笨蛋”“即兴改编”“瓷砖反射”“穿给大家看”等原文没有的贬义、演奏方式、材质和动作限定，纠正“今”误写“刚才”、重复字“2人人”及不自然的句尾断句。

[86 条原文与验收前后对照](../translation/studio/general/acceptance/chats-005-semantic-20261031/review.md) · [修改记录](../translation/studio/general/acceptance/chats-005-semantic-20261031/edits.json) · [凭据](../translation/studio/general/acceptance/chats-005-semantic-20261031/receipt.json)

chat002–005 已逐句语义复验；006–012 共 **6,599 条**仍待继续。全部 Chats 11,534 条仍为 draft，missing/stale 0、uncertain 4；本批没有新增 uncertain。正式 import --replace 只写入 86 条，913 条保持不变。验收链核验 10,535 条来源绑定，重放首轮 746 条与三次续验共 278 条修正；General 严格验证 19,497 条有效、0 orphan。verify-chat-translation、verify:general-translation-workflow 均通过；无前端代码改动，未重复 Vite 构建或复制资源包。

Browser 复用 5251 / PID 26452，HTTP chats.json 与本工作区字节一致（3,692,931 bytes）。通信→天濑冬马→组合聊天→Jupiter 信赖度聊天 `8_2_x_001jup_8_2_1_001.json`，经过制作人回复后，18/32 的已显示正文含“冬马君真是热血啊”，与日文原文相对照；1440×900、390×844 截图均可见此条，console error/warn 为空，页面非空、无框架错误覆盖层，返回组合目录正常。快进范围已还原“仅已读”，视口恢复默认，未保存屏幕方向或改变担当。截图在 `E:/Web_build/GS_Archive_Domain_Work/chats-acceptance-qa-20261031/005-corrected-tone-desktop.png` 和 `005-corrected-tone-mobile.png`。未据此宣称全部 UI、所有 detail 气泡或实体手机通过；原菜单“译文暂时无法载入”提示仍保留。没有部署。

## chat004 全量语义复验（上一批）

输入 HEAD `871a429d`。chat004 的 983 条全部逐句对照原文和当前 TM，追加修正 111 条，保持 draft。主要修正キリオ误称“清澄”、あまね误译“雨音”、そーいちろー误译“想一郎”，以及蝶蝶小姐、制作人君和吾辈们的项目称谓。撤去“幸运女神”“小擦伤”“中暑”“倾尽全军之力”等原文未限定的性别、伤势或夸大内容。

[111 条原文与验收前后对照](../translation/studio/general/acceptance/chats-004-semantic-20261031/review.md) · [修改记录](../translation/studio/general/acceptance/chats-004-semantic-20261031/edits.json) · [凭据](../translation/studio/general/acceptance/chats-004-semantic-20261031/receipt.json)

chat002–004 已逐句语义复验；005–012 共 **7,598 条**仍待继续。全部 Chats 11,534 条仍为 draft，missing/stale 0、uncertain 4；本批没有新增 uncertain。此次 import --replace 仅写入 111 条，872 条保持不变；原始回填和既有验收凭据未改。验收链核验 10,535 条来源绑定，重放首轮 746 条与两次续验共 192 条修正；General 严格验证 19,497 条有效、0 orphan。verify-chat-translation 和 verify:general-translation-workflow 均通过。数据变更未重复 Vite 构建或生成资源包，未部署。

Browser 继续复用 5251 / PID 26452；HTTP 发布分片与本工作区一致（3,693,431 bytes）。通信→猫柳桐生，个人聊天 `017kir_301_2_3_017_01_09_a.json` 验证“制作人君”及两次回复交互；播放器回复气泡显示短文，没有将未显示的完整 detail「桐生先生」记作页面通过。随后返回随机话题池，第 01 话题入口显示“蝶蝶小姐”；第 02 话题 `8_1_x_017kir_8_1_2_017.json` 的正文显示“九郎君带来的茶点，还有庄一郎君的蛋糕”，1440×900 与 390×844 均完成截图，console error/warn 为空，页面非空、无框架错误覆盖层。截图位于 `E:/Web_build/GS_Archive_Domain_Work/chats-acceptance-qa-20261031/004-corrected-name-desktop.png` 与 `004-corrected-name-mobile.png`。返回目录后视口已恢复，临时快进范围已还原“仅已读”；未改变担当或保存屏幕方向。菜单仍显示既有“译文暂时无法载入”提示，未将所有菜单、完整 detail 气泡或实体手机验收记作通过。

## chat003 全量语义复验（上一批）

输入 HEAD `cd70c39a`。chat003 的 955 条已逐句对照原文与当前 TM，追加修正 81 条。修正覆盖「カエール／かえーる」的项目术语“青蛙玩偶”、实先生的称谓、サポーター不擅定为“后援会”、ファンサービス的互动含义，以及原文没有的邮件发送、快闪店、具体痣位置等补写。知恵の輪改为“益智解环”，不指定为九连环；タキシード改为无尾礼服。

店名たまこや缺乏已核准中文定译，撤去“玉小屋”，保留原名并标 uncertain。全部 Chats 仍为 11,534 条 draft，missing/stale 0；uncertain 从 3 增至 4。chat002、003 已完成逐句语义复验；004–012 共 **8,581 条**仍待继续，不能据此宣称全部审校完成。

[81 条原文与验收前后对照](../translation/studio/general/acceptance/chats-003-semantic-20261031/review.md) · [修改记录](../translation/studio/general/acceptance/chats-003-semantic-20261031/edits.json) · [凭据](../translation/studio/general/acceptance/chats-003-semantic-20261031/receipt.json) · [验收链索引](../translation/studio/general/acceptance/index.json)

验证：

- 正式 import --replace：955 条中写入 81 条、874 条不变。General 严格验证 19,497 条有效，0 orphan；审计 invalid/unpublished 均为 0。
- 验收 verifier 从原 receipt、原始回传、旧编辑重放、首轮 746 条补正，继续重放本轮 81 条修正，再逐条比较 TM 与发布内容。10,535 条绑定通过；索引记录前一 receipt 哈希。新增凭据原始字节由 .gitattributes 固定。对哈希、before、语义条数的三种内存篡改均被拒绝，未修改工作区证据。
- verify-chat-translation、verify:general-translation-workflow 均通过；后者模拟坏数据的 invalid 提示属于预期回归。无前端代码改动，本轮为数据及独立校验工具变更，未重复 Vite 构建或生成资源包。
- 5251 / PID 26452 继续使用现有 dev 服务，HTTP chats.json 与本工作区发布分片字节一致（3,694,103 bytes）。没有部署。
- Browser：通信→苍井享介→随机话题池→第 03 个话题；目录已显示“益智解环”。实际播放 `8_1_x_013kys_8_1_2_013.json` 的 12–16 段；1440×900 验证修正正文及“你解开了啊”回复选项，选择后 390×844 验证回复气泡与后续对白，再返回目录。页面身份、非空内容、无错误覆盖层、交互和截图均通过，console error/warn 为空。视口已恢复默认，没有改变担当设置或快进范围。未扩展为全部聊天、所有菜单或实体手机验收，首轮记录的菜单问题仍保留。
- 截图：`E:/Web_build/GS_Archive_Domain_Work/chats-acceptance-qa-20261031/003-corrected-choice-desktop.png`、`003-corrected-reply-mobile.png`。

## 首轮结果与范围（历史记录）

- 002–012 共 10,535 条：原回传、批次身份、原文哈希、修改重放、TM 和发布内容均逐条核验。旧编辑日志的 before 有时仍是 GS_ADDRESS 保护标记；按该原文的严格保护槽恢复后再比较，没有放松哈希或文本检查。
- chat002 的 999 条做了原文/译文逐条复核，追加修正 105 条。最关键的是 RID 710–730 共 21 条错接：编号和 source_hash 正确，但译文是另一段对话，与当前原文不符；已逐条重译。
- 003–012 为全量身份校验、规则筛查和异常行定向复核，追加修正 641 条，**没有宣称这 9,536 条全量语义验收完成**。后续从 chat003 继续逐句复验。
- 总计 746 条补正，保持 draft，不提升 reviewed/final。chat002/534 宠物名フント缺乏已核准中文定译，撤去擅定的“亨特”、保留原名并标 uncertain。全 Chats 当前 11,534 条均有 draft、missing/stale 为 0，uncertain 为 3（含第一批原有 2 个双关）。

[746 条原文／验收前后对照](../translation/studio/general/acceptance/chats-002-012-20261031/review.md) · [修改记录](../translation/studio/general/acceptance/chats-002-012-20261031/edits.json) · [凭据](../translation/studio/general/acceptance/chats-002-012-20261031/receipt.json)

| 批次 | 补正数 | 本轮语义复验范围 |
|---|---:|---|
| 002 | 105 | 全部 999 条 |
| 003 | 51 | 规则与异常行 |
| 004 | 154 | 规则与异常行 |
| 005 | 71 | 规则与异常行 |
| 006 | 75 | 规则与异常行 |
| 007 | 30 | 规则与异常行 |
| 008 | 57 | 规则与异常行 |
| 009 | 34 | 规则与异常行 |
| 010 | 64 | 规则与异常行 |
| 011 | 63 | 规则与异常行 |
| 012 | 42 | 规则与异常行 |

修正依据为项目 R3.3 与 card-line-prompt.v1.json：制作人さん不加先生；ちゃん→酱、クン→君；番長さん→番长、ボス→Boss；四季不在中文里保留っす，人名っち→亲；实的名字与称呼、辉先生/丽先生等一对一对应；桐生ワガハイ→吾辈，翔真アタシ→我，志狼オレ→我；涟只有源文明确オレ様/おれさま时保留本大爷（支持跨换行的词，不误改为普通自称）；百百人ぴぃちゃん按既有决议用P酱。原始制作人宏、数字、表情一律保留。

chat002 还撤去原文没有的“天空之城”、宠物/动物身份、额外收件人、纪念品、准备室、王子角色等补写，并保留原文称谓层级（例如兜不改成大吾）。这些修正不代表逐项外部考据完成。

## 验证

- 新增 node scripts/verify-chat-editorial-acceptance.mjs：验证 11 批原 receipt 字节哈希、原机器输出→旧编辑记录→旧校订输出→本次补正→draft TM→发布分片的完整链。10535 来源绑定和 746 补正通过。
- 正式 General import --replace 仅写入这 746 条，其余 9,789 条不变。严格 TM：19,497 条有效、0 orphan；审计 invalid/unpublished 为 0。既有剧情与 reviewed 数据未改。
- verify-chat-translation 与 verify:general-translation-workflow 通过（模拟坏数据/503 的测试提示不代表实际数据失败）。
- build:check 通过（31.36s），只复用 .analysis/build-check，不复制 public 资产。resource-audit 的环境差异还原。生成发布清单并核对本端口 HTTP 返回与当前 chats.json 字节一致（3,694,386 bytes）。
- Browser 复用本工作区 dev 服务 127.0.0.1:5251 / PID 26452，经通信选神乐丽，进入信赖度聊天 `8_1_x_008rei_8_1_1_008.json`。1440×900 验证第 15 段的「サポートします！」对应「我会支持您的！」，点击后到第 17 段，「今日のライブの出来はどうだった」正确显示「今天的演唱会，表现怎么样？」。390×844 验证同一段对白、回复气泡及返回神乐丽目录。console error 为空；QA 使用的快进范围已恢复“仅已读”，视口恢复默认。
- 截图在 E:/Web_build/GS_Archive_Domain_Work/chats-acceptance-qa-20261031：002-corrected-choice-desktop.png、002-corrected-dialogue-desktop.png、002-corrected-dialogue-mobile.png。dev 验收不代表生产发布或物理手机验收。
- 另观察到既有播放菜单“本话选集”一直提示读取下一话信息，以及正文已显示译文时菜单仍有“译文暂时无法载入”重试提示。未将这些菜单状态记为通过，本轮未修改菜单逻辑。

原[回填记录](TRANSLATION_CHATS_REVIEW_20261031.md)属于提交历史。其中“全部译完与审校”“本地化就绪”不能替代本次验收结论；当前质量覆盖以上表为准。没有部署。
