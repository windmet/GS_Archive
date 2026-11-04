# 语音疑义研究回传与回填（2026-11-04）

输入 HEAD：`5140ef80`。用户提供 Q01–Q10 的研究报告，并指示：“我倾向于保留这种双关，你来确认并回填”。本轮处理15条语音，并同步两处旧卡文地名。修改后的条目均为 `draft`；没有整批 reviewed 晋升或部署。

原始问题、日文全文及上下文见[独立检索包](TRANSLATION_VOICE_OPEN_QUESTIONS_FOR_EXTERNAL_RESEARCH_20261104.md)。回传报告[原样留存](../translation/studio/general/returns/voice-research-20261104/external-report.original.txt)，它是用户提供的研究材料，不能据其自述“核实完成”推定所有外链及词源均已独立确认。

## 回填决定

| 问题 | 批次尾号／短编号 | 本轮采用 | 编辑边界 |
| --- | --- | --- | --- |
| Q01 | 001／108 | 礼物“冬”通送给你—— | 保留冬季＋送礼＋冷笑话；冬／通只是近音创译。不用“冻人的你”，避免增加对听者的形容。 |
| Q02 | 001／109 | 水壶在“春春”欲动地响着呢。毕竟是春天嘛。 | 春春／蠢蠢承接春季笑点；日文拟声改为中文拟态，不宣称逐字对应。 |
| Q03 | 001／117 | 是不是“咖”外帅气？ | 保留咖啡嵌进帅气自夸的造词感；咖／格是宽松近音，普通话并不同音。 |
| Q04 | 001／126 | 只是“巧”好放那边的—— | 巧／恰呼应巧克力；不造“巧边”地名，不增添拿取动作。 |
| Q05 | 001／127 | 这才叫准备周到！ | 还原周到的字面意义，留下秋冬／周到的潜在呼应。是否为编剧有意双关仍未确认，不影响此句可作为普通中文成立。 |
| Q06 | 002／046；003／132、163；005／207 | 多金汉广场 | 项目汉译，非官方中文定译。四条语音正文不变，解除定译疑义。 |
| Q07 | 003／194、223 | 出发去“游乐之路”旅行吧！／。 | 依用户保留语义呼应的偏好，保留遊び的意译；引号及“去”明确这是具体街道目的地。 |
| Q08 | 004／006 | 布布 | 项目音译，不在字幕新增小猪、饲养者或出门前等背景。 |
| Q09 | 004／243、244 | 冠军 | 恢复专名意译，保留命名的称号意味，不添加猫的背景。 |
| Q10 | 004／175 | 大皿、小皿、皿上来回，接～／世界一周，finish☆ | 译成招式序列；不把世界一周当旅行；保留原有英语及星号。 |

完整15条的原文、来源哈希、修改前后全文、旧／新decision与notes、修改理由见[decisions.json](../translation/studio/general/returns/voice-research-20261104/decisions.json)。其中11条语音正文变化，另4条仅解除疑义并登记决定。

## 证据核对与保留意见

- 日文台词及季节、时间、人物、语音cue均以本地来源和先前检索包为准；每条 source_hash 保持不变。
- [NAMJATOWN日文官方页](https://bandainamco-am.co.jp/tp/namja/about/dokkingham.html)和[英文官方页](https://bandainamco-am.co.jp/en/tp/namja/about/dokkingham.html)首次工具打开成功，页面标题确认ドッキンガム広場／Dokkingham Square。后续正文复查请求发生网络失败。因此研究报告关于街道细节的引文仍标为回传材料，不声称本轮成功逐行复查。
- 未获得官方材料直接支持的“仿自Buckingham”“仿自Abbey Road”构词说法，不作为定译依据。“游乐之路”只采用日文遊び的明确语义与道路专名属性。
- Q01–Q04的文字本身足以支持冷笑话结构；中文近音改写是本轮编辑选择。Q05的秋冬／周到仍是分析假说，不因uncertain解除就变成已证实典故。
- [日本剑玉协会规则](https://kendama.or.jp/wp-content/uploads/2019/09/f1a67030e4f0167d14488f72596fe8bd.pdf)搜索索引支持もしかめ为大皿与中皿交替动作；[GLOKEN赛事说明](https://www.gloken.net/jp/blog/202601170417/)索引支持世界一周为招式序列。本轮未完整打开这些正文，不称已经核实报告所说的“协会正式中文译名”。“皿上来回”作为有中文用例的项目用语采用。
- 布布、冠军采用报告建议及合理专名译法；没有将报告中的发现地点、颜色、归属、命名词源等细节补写进字幕，也未将社区转录当作本轮亲自读过的官方漫画。

## 旧卡文一致性

- 黑野玄武 `026gen_sr06/awakened`：道金汉姆广场 → 多金汉广场。
- 水岛咲 `031sak_sr07/awakened`：阿索比路 → 游乐之路。

两条其余正文不变，旧reviewed全文、reviewer及batch元数据保存在[legacy-edits.json](../translation/studio/general/returns/voice-research-20261104/legacy-edits.json)。修改后两条回到draft，去除旧reviewer，避免将旧正文的审核状态自动用于新正文。相关的另外两篇旧卡文原已使用采用的译名，不改。

## 回执与验证

- 六批原始输入、导入和初次编辑回执保持原样；本轮向001–005各追加 `external-research-20261104` 追补阶段，previous_receipt_sha256连续衔接。
- 总回执：[receipt.json](../translation/studio/general/returns/voice-research-20261104/receipt.json)，包含原始回传、15条决定和两条旧卡文变更的逐字节SHA-256及大小。
- [当前总清单](../translation/studio/general/returns/voice-review-inventory-20261104.json)：1,519条语义对照完成；与初译相比170条正文或元数据有差异，其中163条正文变化；uncertain由15归零。归零表示本轮编辑决定完成，不表示所有研究假说成为事实或全部译文已人工reviewed。
- `node scripts/verify-home-voice-editorial.mjs`：原始导入→169处初次编辑→24处追补精确回放；核对15条决定及两条旧卡文现行TM和发布正文。
- `node scripts/general-translation-workflow.mjs verify`：21,016条TM有效，0 orphan。
- `npm run verify:general-translation-workflow`：通用流程、Markdown合同、资源审计均通过，覆盖23,619字段／92批；无效TM跳过警告属于该测试主动构造的夹具。
- `node scripts/verify-card-line-translation.mjs`、`node scripts/verify-character-line-text.mjs`通过；后者两次HTTP 503是故意注入的重试夹具。
- `node scripts/verify-translation-release.mjs`：`cb29bdebd56f1db193a04bf2b0abdfb5fb9c7aacc712fa032e6c2a7469aa6f27`，1,665个源侧发布包匹配。这不是线上部署。
- Browser复用本任务worktree的5264端口，候选 `rm-release-20261031`，主checkout公共语料回退；抽查天道辉冬季、春季、咖啡、巧克力双关实际中文字幕。截图位于 `.analysis/home-voice-review/research-q01.png`、`research-q02.png`、`research-q03.png`、`research-q04.png`。未声称全部15条逐条播放或真机验收。
- 本轮没有前端代码依赖变化，未运行应用构建或复制public全库；只运行相关数据和独立校验器回归。
