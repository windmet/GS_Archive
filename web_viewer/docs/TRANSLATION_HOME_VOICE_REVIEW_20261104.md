# 首页及演出语音校对 · 2026-11-04

## 输入与范围

- 工作区：`E:/Web_build/GS_Archive_Domain_Work/i18n-20261104-home-voice/web_viewer`。
- 分支：`i18n/20261104-home-voice`；开始时 HEAD `2b254465`，fetch 后与 `origin/master` 差异 `0 0`。CURRENT_STATE 是历史入口，本轮以实际 Git 与语料为准。
- 原工作区已有 1,519 条未提交初译及发布数据。先逐条核对回传、来源与 TM，一致后提交为 `ecc9cd6f`，未把初译快照称为语义校对。
- 原始 6 批回传、batch-map、导入结果及逐文件 SHA-256 已保存在 [returns](../translation/studio/general/returns/G-card-lines-20261104-001/import-receipt.json) 下各同名批次目录；原译者信息照实保留。
- 沿用 R3.3、[角色台词政策](../translation/studio/policy/card-line-prompt.v1.json)及[用户定译](../translation/studio/policy/user-approved-terms.v1.json)：逐句核对事实、称呼、人称、时态与口吻；制作人宏原样保存；模型校对不晋升 reviewed/final。

## 批次进度

| 批次 G-card-lines-20261104- | 条数 | 当前工作 |
| --- | ---: | --- |
| 001 | 300 | 全部逐句对照；23 处修订；5 条双关 uncertain；全部 draft |
| 002 | 300 | 全部逐句对照；35 处修订；无新增 uncertain；全部 draft |
| 003 | 300 | 已核对导入一致性，尚未语义校对 |
| 004 | 300 | 已核对导入一致性，尚未语义校对 |
| 005 | 300 | 已核对导入一致性，尚未语义校对 |
| 006 | 19 | 已核对导入一致性，尚未语义校对 |

第 001 批含 card-voice 89 条、home-voice 211 条，覆盖冬马至皮埃尔（皮埃尔跨批，不代表该角色全部校对完毕）。第 002 批含 card-voice 83 条、home-voice 217 条，覆盖皮埃尔后续至隼人开头。目前累计 600 条已逐句校对，919 条待语义校对。

## 第 001 批结果

逐项 before/after、原文、source_hash、修改理由及疑义见 [edits.json](../translation/studio/general/returns/G-card-lines-20261104-001/edits.json)；300 条完整结果见 [output.edited.json](../translation/studio/general/returns/G-card-lines-20261104-001/output.edited.json)，哈希和范围见 [editorial-receipt.json](../translation/studio/general/returns/G-card-lines-20261104-001/editorial-receipt.json)。

| 编号 | 主要问题及处理 |
| --- | --- |
| 002、008 | 恢复期待／推测语气，修正“深入世界观”的搭配 |
| 051、063、065 | ゴロゴロ改为躺着放松；撤去“哼”的额外态度；明确厚着的自我决定 |
| 056、169、217、263、271 | 保留拖音，规范省略号，不动制作人宏 |
| 074、163、183 | 修正相处、甜蜜表现与判断天气的中文表达 |
| 219、234、238 | 保留过夜愿望；修正护手霜主客体倒置；いただく按享用食品处理 |
| 281、284 | 皮埃尔保持短句，但修正“快的球”“好心跳”等不通顺表达 |
| 108、109、117、126、127 | 保留字面事实并标记双关待确认，撤去“冬给you”“帅咖啡”“巧边随手拿”等生造表达 |

5 条疑义依次涉及：冬／for you、しゅんしゅん／春、かっこいい／コーヒー、ショコラ／そこら、秋冬／周到。当前候选没有重建日文同音笑点，仍需用户决定中文改写方案。未在译文中插入解释性括号。

## 第 002 批结果

输入 HEAD `a27ce05c`，fetch 后 `HEAD...origin/master` 为 `2 0`，主干没有新提交。继续时已有 `config/resource-audit.json` 本地差异，本批保留且不提交。

- 300 条全部对照，35 处修订，没有新增疑义；维持 draft。
- 修正同款围巾误作“一对”、知恵の輪无据限定“九连环”、跑足时间误作“跑满全场”、单板滑雪误作器材、屋台误限定为小吃摊等问题。
- 桐生仅在原文ワガハイ的对应处保留“吾辈”，撤去额外添加或重复的特殊自称；鸟鸣使用中文拟声，吃冷食的きーん按突发刺痛处理。
- 九郎不使用未经政策许可的“在下”；野点译为露天茶会；保留先生、君、酱和制作人保护槽。
- 完整结果及理由：[edits.json](../translation/studio/general/returns/G-card-lines-20261104-002/edits.json)、[output.edited.json](../translation/studio/general/returns/G-card-lines-20261104-002/output.edited.json)、[editorial-receipt.json](../translation/studio/general/returns/G-card-lines-20261104-002/editorial-receipt.json)。
- 验证：editorial 回放为 1,519 条导入、600 条语义对照、58 处累计修改、5 条累计 uncertain；TM 严格检查 21,016 条有效、0 orphan；release `d397b19cda1c8532ee60b3a4e953ddb0cde63653e205bd0c9e8001f1b9cb794b` 的 1,665 包验证通过；`git diff --check` 通过。
- Browser：复用进程命令行已确认归属本工作区的 5264 服务，进入苍井享介事务所 → 台词目录搜索“解环” → 第 5 句 → 关闭目录，确认对白显示“解环玩具很有意思哦。没那么容易解开，反而会燃起斗志，不知不觉就玩上瘾了。”；实际地址 `/office/013kys/?home_cue=3_1_013_04&home_costume=013kys_002_00`。截图 `.analysis/home-voice-review/batch002-home-096.png`，页面仍观察到 Spine.update、set tint 两条警告；无框架错误覆盖层。

## 验证与边界

- `node scripts/verify-home-voice-editorial.mjs`：逐字节验证 6 批导入回执；原始回传回放 23 处修订；核对现行来源、TM、发布正文；1,519 条均 draft，300 条语义对照，5 条 uncertain。
- `node scripts/general-translation-workflow.mjs verify`：21,016 条 TM 有效，0 orphan。
- `npm run verify:general-translation-workflow`：通用流程、Markdown 合同、资源审计三组回归通过（23,619 字段／92 批）；故意无效的夹具会输出跳过 1 条的预期警告，真实 TM 严格检查无无效条目。
- `node scripts/verify-card-line-translation.mjs`：5,750 条来源绑定台词与分片合同通过。
- `node scripts/verify-character-line-text.mjs`：共用文本查询、语言选择、制作人宏及错误重试回归通过；输出中的 HTTP 503 为该测试主动注入的失败夹具。
- `node scripts/verify-translation-release.mjs`：release `a69a2b49db104173224e9f1bb80c8a34ef448e9d4b43d6c3d32f6fc20369b942`，1,665 个发布包匹配。
- 实际 Browser：本工作区 Vite `http://127.0.0.1:5264/`，公共语料回退主 checkout，候选 `rm-release-20261031`。从资料馆进入神乐丽档案 → 事务所 → 台词目录第 20 句 → 关闭目录 → 原文／译文切换，确认“离不开护手霜”已显示。最终路径 `/office/008rei/?home_cue=3_1_008_19`。
- 页面截图：本工作区 `.analysis/home-voice-review/batch001-home-234.png`。无框架错误覆盖层；观察到两条 Pixi Spine 调用栈警告（Spine.update、set tint）。本轮不把页面日志称为零警告，不认定其是否为既有问题；未做整站、真机或全语音播放验收。
- 只改翻译数据、记录与独立校验脚本，没有前端代码依赖变化，未运行应用构建、未复制 public 全库、未部署。

复核各批：`node scripts/verify-home-voice-editorial.mjs`。后续按 003 → 006 继续，保留独立回执和批次提交；用户未确认前维持 draft。上方“验证与边界”为第 001 批记录，各后续批次另记实际 release 与页面旅程。
