# 首页及演出语音校对 · 2026-11-04

本轮6批共1,519条已全部逐句校对。相对初译，163条译文有改动，另7条仅登记疑义，共170条有文字或决定差异；其中15条等待定译／中文双关决策。全部保持draft，未执行整批review晋升，也未部署。逐项清单见[最终复核清单](../translation/studio/general/returns/voice-review-inventory-20261104.json)。

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
| 002 | 300 | 全部逐句对照；31条译文修订＋1条地名疑义，共32处差异；全部 draft |
| 003 | 300 | 全部逐句对照；26条译文修订＋4条地名疑义，共30处差异；全部 draft |
| 004 | 300 | 全部逐句对照；24处修订；4条 uncertain；全部 draft |
| 005 | 300 | 全部逐句对照；57处修订；1条地点定译 uncertain；全部 draft |
| 006 | 19 | 全部逐句对照；4条译文修订；无新增 uncertain；全部 draft |

第001–005批分别覆盖冬马至皮埃尔、皮埃尔后续至隼人开头、隼人后续至卷绪开头、卷绪后续至涟开头、涟后续至贤的部分事务所语音；006为贤的剩余4条office-voice及社长15条unused-voice。前四批card-voice／home-voice分别为89／211、83／217、78／222、90／210；005为card-voice 75、home-voice 218、office-voice 7。六批累计1,519条全部完成语义对照。

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
- 鸟鸣使用中文拟声，吃冷食的きーん按突发刺痛处理。初次对“吾辈”的4处删减已在下方追补阶段撤回，不再作为有效纠错。
- 九郎不使用未经政策许可的“在下”；野点译为露天茶会；保留先生、君、酱和制作人保护槽。
- 完整结果及理由：[edits.json](../translation/studio/general/returns/G-card-lines-20261104-002/edits.json)、[output.edited.json](../translation/studio/general/returns/G-card-lines-20261104-002/output.edited.json)、[editorial-receipt.json](../translation/studio/general/returns/G-card-lines-20261104-002/editorial-receipt.json)。
- 验证：editorial 回放为 1,519 条导入、600 条语义对照、58 处累计修改、5 条累计 uncertain；TM 严格检查 21,016 条有效、0 orphan；release `d397b19cda1c8532ee60b3a4e953ddb0cde63653e205bd0c9e8001f1b9cb794b` 的 1,665 包验证通过；`git diff --check` 通过。
- Browser：复用进程命令行已确认归属本工作区的 5264 服务，进入苍井享介事务所 → 台词目录搜索“解环” → 第 5 句 → 关闭目录，确认对白显示“解环玩具很有意思哦。没那么容易解开，反而会燃起斗志，不知不觉就玩上瘾了。”；实际地址 `/office/013kys/?home_cue=3_1_013_04&home_costume=013kys_002_00`。截图 `.analysis/home-voice-review/batch002-home-096.png`，页面仍观察到 Spine.update、set tint 两条警告；无框架错误覆盖层。

### 猫柳自称追补

用户提醒猫柳的设定自称为“吾辈”后，在 HEAD `0e4d3949` 重新核查：本批猫柳34条，日文10处明示ワガハイ均保留；初稿14处吾辈被机械缩减为10处。194、216属于省略主语的自然补译，209、217属于中文重复程度的选择，不能据显式代词词数认定错误。现有来源绑定的 reviewed 旧译也有9条省略主语但补出吾辈的先例。

- 恢复194、209、216、217的原稿自称；初次35处修改及原回执不改写，追加 [follow-up回执](../translation/studio/general/returns/G-card-lines-20261104-002/followups/kirio-self-reference-20261104/receipt.json) 和逐项回填记录。002现有31处差异，001–002累计54处差异、5条疑义，仍为draft。
- 将“省略主语时是否自然需要补出”与“自称是否符合角色”分开判断，不把每个ワガハイ对应一个吾辈当作词数门禁；不修改被旧回执哈希绑定的政策文件。
- 增加follow-up回放校验：原回执 → 追补回执哈希链 → 精确before/after → 当前TM和发布正文。严格TM、来源回放、1,665包release校验通过；追补release为 `581d6bc32729f3254ff3bde13a09fa459005576b72409b3f7ccc2e72252ce7c2`。
- Browser：5264猫柳事务所 → 台词目录查找“吾辈是在纠结” → 第8句 → 关闭目录，确认回填译文实际显示；地址 `/office/017kir/?home_cue=3_1_017_07&home_costume=017kir_001_00`，截图 `.analysis/home-voice-review/kirio-self-reference-restored.png`。

## 第003批结果

- 输入HEAD `c4bd614e`；300条全部对照，26处修订，无新增疑义，全部draft。
- 鬼ごっこ改为“捉人游戏”；覇道改为“称霸之路”；日语手首、足首、首筋的共同字为“首”，纠正把中文手腕、脚踝归为带“颈”字的错误；修正敷衍工作、过往努力、替母亲做发型等关系与时态。
- 阿斯兰的“吾”、四季的Mega／Hyper及旬亲等既定口吻保留，不采用显式代词数量门禁。
- 第028条“榊女士”保留：旧审B014 [batch-map](../translation/studio/reviews/B014-idol-story-r33-edited-20261008/batch-map.json) T000045原文明示她是夏来的祖母，T000046说明其养育旬的关系；[既有修订记录](../translation/studio/reviews/B014-idol-story-r33-edited-20261008/edits.json)已由“榊先生”修正为“榊女士”，本批不重新猜定性别或称呼。
- 完整结果：[edits.json](../translation/studio/general/returns/G-card-lines-20261104-003/edits.json)、[output.edited.json](../translation/studio/general/returns/G-card-lines-20261104-003/output.edited.json)、[editorial-receipt.json](../translation/studio/general/returns/G-card-lines-20261104-003/editorial-receipt.json)。
- 来源回放：1,519条导入，900条语义对照，84处初次编辑及4处追补，当前80处有效差异、5条累计uncertain；TM严格检查21,016条有效、0 orphan；release `672363bc891d571c176dd9e874f785e88c5a6c1ae87f84479d34b41a644710eb`的1,665包校验通过；`git diff --check`通过。
- Browser：5264春名事务所 → 台词目录搜索“捉人” → 第10句 → 关闭目录，确认“刚才和四季他们玩了捉人游戏。可激烈了！”显示；地址 `/office/023har/?home_cue=3_1_023_09&home_costume=023har_001_00`；截图 `.analysis/home-voice-review/batch003-home-092.png`。

## 第004批结果

- 输入HEAD `b7fc5944`；300条全部对照，24处修订，4条新增uncertain，全部draft。
- 修正“我也差点被他全吃光”的主客体、阿斯兰喜欢设计的指代、直央对过去晚霞的希望、道流对食欲之秋的表达、涟照明对象的无据补出等问题。
- 水岛咲的パピッ／パピカワ在本地有17条reviewed先例，包含“啪噼一下”“啪噼可爱”等，本批保留口癖，未按一般语法残留删除。花音、次郎、涟的既定自称保留。
- 待确认4条：第006条宠物ブブ、第243／244条宠物チャンプ，以及第175条剑玉招式もしかめ。宠物及招式暂保留原名，原稿“布布”“冠军”“莫西卡美”留在before记录中，等待项目定译。数字、英语及制作人宏不变。
- 完整结果：[edits.json](../translation/studio/general/returns/G-card-lines-20261104-004/edits.json)、[output.edited.json](../translation/studio/general/returns/G-card-lines-20261104-004/output.edited.json)、[editorial-receipt.json](../translation/studio/general/returns/G-card-lines-20261104-004/editorial-receipt.json)。
- 来源回放：1,200条语义对照，108处初次编辑及4处追补，当前104处差异、9条累计uncertain；TM严格检查21,016条有效、0 orphan；release `87e6bedc45b8ea53fc324cbfbd373eec8cbc0899129c48bc27cc73fbe1215211`的1,665包校验通过；`git diff --check`通过。
- Browser：5264大河武事务所 → 台词目录搜索“栗子饭” → 第19句 → 关闭目录，确认“我的那份圆城寺先生做的栗子饭，也差点被他全吃光。”正确显示；地址 `/office/038tak/?home_cue=3_1_038_18&home_costume=038tak_002_00`；截图 `.analysis/home-voice-review/batch004-home-250.png`。

## 第005批结果

- 输入HEAD `c6be24b2`；300条全部对照，57处修订，其中33处仅规范九十九一希句首省略号；1条新增uncertain；全部draft。
- 修正涟把“卖拉面的”人物绰号机械套作店铺、九十九的お化け像误作雕像、雨彦お前さん被额外译成贬义的“你这家伙”、想乐的商品POP被无据限定成手写牌等问题。
- 第030条秋月凉的“嘎哦哦哦嗯”在B010 T000262、B016 T000373有先例，保留；第028条原文连续两次秋月涼的自我纠正也保留，不因文字相同而改写笑点。大吾的俺、Boss以及百百人的P酱等保持现行译法。
- 第202条鱼名：以[新潟市水族馆](https://www.marinepia.or.jp/picturebook/fish/entry-11243.html)的日名→学名，再用[台湾鱼类数据库](https://fishdb.sinica.edu.tw/taxon/381978-fishdb)的同一学名→中文名，核定キュウセン为“花鳍副海猪鱼”，替换初稿“九线隆头鱼”。未把鱼类事实之外的信息添加进台词。
- 第188条戻りガツオ按“南返的鲣鱼”译，参照[农林水产省和食资料](https://www.maff.go.jp/j/keikaku/syokubunka/culture/attach/pdf/index-183.pdf)的秋季南下说明。该PDF整页打开失败，本轮使用搜索索引中的官方片段，不声称完整读过PDF。
- 第207条ドッキンガム広場保留当前“多金汉广场”候选并标uncertain：旧reviewed译文另有“道金汉姆广场”，需用户统一；不覆盖旧reviewed条目。
- 完整结果：[edits.json](../translation/studio/general/returns/G-card-lines-20261104-005/edits.json)、[output.edited.json](../translation/studio/general/returns/G-card-lines-20261104-005/output.edited.json)、[editorial-receipt.json](../translation/studio/general/returns/G-card-lines-20261104-005/editorial-receipt.json)及[外部来源核对记录](../translation/studio/general/returns/G-card-lines-20261104-005/reference-checks.json)。
- 来源回放：1,500条语义对照，165处初次编辑及4处追补，当前161处差异、10条累计uncertain；TM严格检查21,016条有效、0 orphan；release `7b73b4640f19c69a79651bdbdb71c2eb32c4479b663ad02f007ab1ef48a0659b`的1,665包校验通过；`git diff --check`通过。
- Browser：5264克里斯事务所 → 台词目录查找“花鳍” → 第7句 → 关闭目录，确认“像花鳍副海猪鱼那样”正确显示；地址 `/office/046chr/?home_cue=3_1_046_06&home_costume=046chr_001_00`；截图 `.analysis/home-voice-review/batch005-home-202.png`。

## 第006批及跨批收口

- 输入HEAD `2fea06b7`；第006批19条全部对照，4处中文句法与搭配修订，无新增疑义，全部draft。
- 完整结果：[edits.json](../translation/studio/general/returns/G-card-lines-20261104-006/edits.json)、[output.edited.json](../translation/studio/general/returns/G-card-lines-20261104-006/output.edited.json)、[editorial-receipt.json](../translation/studio/general/returns/G-card-lines-20261104-006/editorial-receipt.json)。
- 两组地名冲突追加至[002追补](../translation/studio/general/returns/G-card-lines-20261104-002/followups/place-name-conflicts-20261104/receipt.json)、[003追补](../translation/studio/general/returns/G-card-lines-20261104-003/followups/place-name-conflicts-20261104/receipt.json)，各附原有reviewed候选的来源、哈希和上下文；没有反向改写旧reviewed条目，也没有改变本轮地点候选正文。
- Browser：5264事务所 → “事务所语音” → 事务所 → 齋藤，确认“精神饱满地打声招呼再开始工作”“感谢你在工作中的付出”“尽情畅谈一番偶像论”“浑身都充满活力”4处均显示。地址 `/unused/?voices=saito`，截图 `.analysis/home-voice-review/batch006-other-voices-013.png`；本次页面error级日志为空，不把此前Spine警告称为已修复。

## 待确认清单

下表共10个决策项，涉及15条TM记录。完整日文、当前候选、疑义说明、说话人和使用位置都在[最终复核清单](../translation/studio/general/returns/voice-review-inventory-20261104.json)的pending数组中。

| 决策项 | 批次／编号 | 当前处理 |
| --- | --- | --- |
| 冬／for you双关 | 001／108 | 保留冬日送礼字面，不生造“冬给you” |
| 春／しゅんしゅん双关 | 001／109 | 保留水壶声与春天场景 |
| かっこいい／コーヒー双关 | 001／117 | 保留喝咖啡与自夸，不生造“帅咖啡” |
| ショコラ／そこら双关 | 001／126 | 保留巧克力与那边的字面，不补“随手拿” |
| 秋冬／周到双关 | 001／127 | 保留秋季准备过冬与有备无患的字面 |
| ドッキンガム広場 | 002／046；003／132、163；005／207 | 当前候选“多金汉广场”；旧reviewed另有“道金汉姆广场” |
| アソビーロード | 003／194、223 | 当前候选“游乐之路”；旧reviewed另有“阿索比路” |
| 宠物ブブ | 004／006 | 暂保留ブブ；初稿“布布”待确认 |
| 宠物チャンプ | 004／243、244 | 暂保留チャンプ；初稿“冠军”待确认 |
| 剑玉招式もしかめ | 004／175 | 暂保留もしかめ；未采纳无项目依据的“莫西卡美” |

## 最终验证

- `node scripts/verify-home-voice-editorial.mjs`：1,519条导入与1,519条语义对照均覆盖；169处初次编辑＋9处追补可精确回放；170条当前差异、15条uncertain、0条仅导入未校对。6份原始回传及导入回执、6份编辑回执、3份追补回执及其哈希链均通过，原始证据保留。
- `node scripts/general-translation-workflow.mjs verify`：21,016条真实TM有效、0 orphan。
- `npm run verify:general-translation-workflow`：通用流程、Markdown、资源审计三组回归均通过，覆盖23,619字段／92批；夹具中的1条无效TM跳过警告为预期注入，不能据此认定真实TM无效。
- `node scripts/verify-card-line-translation.mjs`、`node scripts/verify-character-line-text.mjs`通过：5,750条来源绑定台词及发布分片、保护槽还原、语言选择、命名／未命名制作人、查询失败重试等合同。HTTP 503为测试主动注入的失败，不是Browser实际请求失败。
- `node scripts/verify-translation-release.mjs`：最终源侧译文release `afcd9faaf961bbf4e47d57e0ddfd8712ee91cb04018ddd782ebb74c84bbc0472`，1,665个发布包逐字节匹配。这是本地发布包指纹，不是生产部署证据。
- Browser按批抽查实际页面，路径和截图已逐批记录；未声称1,519条全部逐条播放、真机验收或完整舞台无警告。
- 本轮源码基线最终fetch仍未落后origin/master；没有前端代码依赖变化，未机械运行应用构建、未拷贝public全库。独立回放校验脚本与翻译相关回归通过。
- `git diff --check`及文档本地链接检查通过；按明确路径提交，保留工作区无关内容。未创建PR、未合并master、未部署。

## 第001批验证与边界（历史记录）

- `node scripts/verify-home-voice-editorial.mjs`：逐字节验证 6 批导入回执；原始回传回放 23 处修订；核对现行来源、TM、发布正文；1,519 条均 draft，300 条语义对照，5 条 uncertain。
- `node scripts/general-translation-workflow.mjs verify`：21,016 条 TM 有效，0 orphan。
- `npm run verify:general-translation-workflow`：通用流程、Markdown 合同、资源审计三组回归通过（23,619 字段／92 批）；故意无效的夹具会输出跳过 1 条的预期警告，真实 TM 严格检查无无效条目。
- `node scripts/verify-card-line-translation.mjs`：5,750 条来源绑定台词与分片合同通过。
- `node scripts/verify-character-line-text.mjs`：共用文本查询、语言选择、制作人宏及错误重试回归通过；输出中的 HTTP 503 为该测试主动注入的失败夹具。
- `node scripts/verify-translation-release.mjs`：release `a69a2b49db104173224e9f1bb80c8a34ef448e9d4b43d6c3d32f6fc20369b942`，1,665 个发布包匹配。
- 实际 Browser：本工作区 Vite `http://127.0.0.1:5264/`，公共语料回退主 checkout，候选 `rm-release-20261031`。从资料馆进入神乐丽档案 → 事务所 → 台词目录第 20 句 → 关闭目录 → 原文／译文切换，确认“离不开护手霜”已显示。最终路径 `/office/008rei/?home_cue=3_1_008_19`。
- 页面截图：本工作区 `.analysis/home-voice-review/batch001-home-234.png`。无框架错误覆盖层；观察到两条 Pixi Spine 调用栈警告（Spine.update、set tint）。本轮不把页面日志称为零警告，不认定其是否为既有问题；未做整站、真机或全语音播放验收。
- 只改翻译数据、记录与独立校验脚本，没有前端代码依赖变化，未运行应用构建、未复制 public 全库、未部署。

复核各批：`node scripts/verify-home-voice-editorial.mjs`。本轮逐句校对及证据收口完成；后续按上方10个决策项处理用户定译，不把模型校对或个别名词决定晋升为整批人工reviewed。
