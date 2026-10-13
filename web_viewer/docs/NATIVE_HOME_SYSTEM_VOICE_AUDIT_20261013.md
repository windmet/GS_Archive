# 原版首页通用、时段与季节语音链路核查

核查日期：2026-10-13。输入 HEAD：`de850b7e6af128f8920427ef5efa7d4f2382d8aa`，分支 `claude/native-runtime-fidelity-20261013`。本批只读核查并记录结论，不修改首页、编译数据或资源，不部署。

## 结论

当前首页漏接了偶像通用首页语音池。当前 masterdata 的 49 位偶像每人 21 条，共 **1,029 条 HomeStand 记录**，其中包含普通问候、时段和季节语音。这些记录全部能对应到本地 RAW、49 个 compiled 剧本中的唯一对白步骤，以及非空本地音频文件。问题是消费与关联链路缺失，不能描述为音频未收录。

1,029 条中，391 条设置了非全年月份范围，420 条设置了非全天时间范围；两项可能重叠，不可相加作为遗漏数量。不要仅按 label 尾号推断条件，个别季节内容也有全年条件。

## 原版调用链与依据

反编译输入为现有 Ghidra 项目 `E:/Tools/ghidra_work/sidem/project/sidem_il2cpp` 中的 `libil2cpp.decrypted.so`；以 `-noanalysis -readOnly` 补充反编译，未保存项目改动。核查脚本及结果保存在本 checkout 的 `.analysis/native-home-voice-audit/`。

| 环节 | 反编译依据 | 行为 |
| --- | --- | --- |
| 首页初始化 | `HomeIdol.<SetData>.MoveNext` RVA `0x1d7d5e0` | 使用偶像 ID、当前卡片 ID、类型 1 和最近记录容量 4 构造 `SystemScenarioDecider` |
| 组候选池 | `SystemScenarioDecider..ctor` RVA `0x1e4dabc` | 合并当前卡片的 CardSystemScenarios 与当前偶像的 IdolSystemScenarios；按类型、可选性、卡片条件及 override ID 筛选 |
| 可选性 | `SystemScenarioData.HasPossibility` RVA `0x1e4d974` | HomeStand 类型要求 Param1 大于 0 |
| 选择 | `SystemScenarioDecider.DecideByWeight` RVA `0x1e4e23c` | 先筛有效期，再按 Param1 权重抽取；候选足够时排除最近播放记录，维护最近队列 |
| 月份与时间 | `IsInTerm` RVA `0x1e4eab0`、`ValidateNowMonth` RVA `0x1e4ee10` | 月份允许跨年，如 12–2 月；时间比较为起点包含、终点不包含；00:00 至 00:00 表示全天 |
| 时钟 | `ServerDateTime.get_Now` RVA `0x1e02af8` | 使用同步时间基准加客户端运行时间差，并按帧缓存；不能未经验证替换成浏览器本地时区时钟 |
| 播放 | `HomeIdol.<PlayAction>.MoveNext` RVA `0x1d7c770` | 调用 DecideByWeight，将选中记录的 ScriptName 与 ScriptLabel 交给 IdolController.Play |

时间段跨午夜时原版会对结束日期加一天；若实现完整复刻，还需针对凌晨区间验证具体日期锚定行为，不自行补成推测的规则。未觉醒卡片有 Param2 过滤；override 字段在本次卡片表数据中均为 0/缺省，但链路存在，不应丢弃语义。

类型定义来自 protobuf/IL2CPP schema：HomeStand=1、HomeCard=2、HomeSetting=3、IdolDetail=4、Training=5、LiveResult=6、ReliabilityRankUp=7、HomeStandCard=8、LiveStartButtonVoice=9。因此不能把整张表所有记录当首页触摸语音。

## 本地表、投影与消费者

| 来源 | 本次数据情况 | 当前链路 |
| --- | --- | --- |
| table 90 `IdolSystemScenarios` | 1,421 条，其中 HomeStand 1,029、IdolDetail 49、LiveResult 343 | 已被写入 short_adv_profile_index，未进入首页候选池 |
| table 91 `CardSystemScenarios` | 2,564 条，其中 HomeStand 2,356、HomeCard 208 | card_tables.py 抽取为卡片 cue，经 compiled_projection.py 生成 home_voice_cues；原始行数包含重复，不能当唯一语音数 |
| table 172 `SubCharacterSystemScenarios` | 22 条，其中 HomeStand 15、LiveResult 7 | 原版首页另有辅助角色分支；本次 1,029 条统计只包含 49 位偶像 |

`src/data/archiveHomeState.js` 的 `buildArchiveHomeState` 仅遍历 `card.home_voice_cues`，以卡片及 cue 去重。`src/data/ArchiveDataRepository.js` 未向首页装载偶像通用系统语音池。

另一个关联缺陷在 `../data_pipeline/sidem_masterdata/mobile.py` 的 `build_short_adv_profile_index`：它以嵌套字段 2（ScriptLabel）寻找 compiled 文件，而脚本文件对应字段 1（ScriptName），label 应作为该文件中的跳转点使用。现有索引的 1,029 条 HomeStand 全部 `compiled_file=null`，但实际文件和跳转点均存在。因此不能用这个 null 判定资源缺失。

例如：`3_1_048` 对应 `public/data/compiled/3_x_048mom_3_1_048.json`；其 `jump_points[3_1_048_05]=7`，第 7 步对白音频为 `3_1_048_05.m4a`，位于 `public/assets/voice/`。

## 百々人的具体例子

以下六条均已核对 masterdata 条件、compiled 对白、跳转步骤及非空音频：

| label | 月份 | 时间 | 内容摘要 |
| --- | --- | --- | --- |
| `3_1_048_05` | 全年 | 06:00–11:00 | 早安，今天也很高兴见到制作人 |
| `3_1_048_12` | 全年 | 19:00–00:00 | 今天辛苦了，询问肩膀是否酸痛并提议按摩 |
| `3_1_048_13` | 3–5 月 | 10:00–17:00 | 春天暖洋洋，容易犯困 |
| `3_1_048_14` | 3–4 月 | 全天 | 把捡到的漂亮樱花送给制作人 |
| `3_1_048_19` | 12–2 月 | 全天 | 天冷时怀念夏天，询问喜欢夏天还是冬天 |
| `3_1_048_20` | 12–2 月 | 全天 | 肉包和关东煮，邀请一起去便利店 |

## 接入时的边界

1. 建立基于 ScriptName + ScriptLabel 的通用首页语音投影，保留偶像、类型、月份、时段、权重、Param2 和 override 关联；不依赖卡片 cue 推导通用语音。
2. 首页随机互动如要还原原版，需要合并当前卡片与偶像候选池，并实现有效期、权重及最近播放规则。仅把所有语音均匀加入当前随机列表会让季节和时段失效。
3. 档案的手动选择应能查看完整通用池并显示条件；自动互动与手动回听分别处理，避免历史季节语音只能等到对应日期访问。
4. `home_interaction_index.json` 中 table 104/105 的 time_slot 名称实际关联 Mobile 随机话题/引导资源，不能据名称认作本次首页时段语音来源。
5. 情人节、白色情人节等 seasonal_communication / seasonal_campaign 表属于另一路活动内容。本次确认的是日常 HomeIdol→SystemScenarioDecider 链路，没有证据将活动表全部并入普通首页触摸池。生日、周年等独立入口也不能据本次结论声称已完整覆盖。

## 验证范围

- 主链补充反编译 41 个目标，成功 41、失败 0；补充时钟与可选性 2 个目标，成功 2、失败 0。
- `.analysis/native-home-voice-audit/system-scenario-tables.json` 保存当前解码表；`coverage.json` 保存 1,029 条条件、compiled 文件、唯一步骤、RAW 存在性及音频字节数。无缺项，实际命中 49 个 compiled 文件。
- 证据为反编译、当前 masterdata、源码、compiled 与本地文件核查；未声称逐条音频试听或原版运行画面对照。未改前端，因此本批不运行应用构建，不重启 5212 服务。
