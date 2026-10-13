# 原版链路反查与关联、数据修正交接

## 交接基线与范围

- 日期：2026-10-13。
- 工作目录：`E:/Web_build/SideM_Archived/web_viewer`；Git 根目录为其上一级。
- 分支：`claude/native-runtime-fidelity-20261013`；本文输入 HEAD：`366825d6`。
- 本文汇总首页语音、工作剧情、生日与个人故事、卡池四组反查结果，并附上此前运行时修复后仍待处理的数据风险。
- 本次仅创建交接文档，没有实施下述关联、投影、数据或 UI 修正；未部署、未重启服务。
- 浏览器测试入口沿用 `http://localhost:5212/`；后续接手须重新确认服务归属和源码版本。本文不将此前其他任务的浏览器结果当成本次四组关联的运行验收。
- `a64249aa`（首页审计）和 `366825d6`（工作审计）已本地提交。此前自动审批拒绝公开推送审计内容；已核实 origin 为公开仓库 `https://github.com/windmet/GS_Archive`，尚未收到明确的公开推送确认。后续不要把这些提交写成“已推送”。

相关既有记录：

- [首页系统语音审计](NATIVE_HOME_SYSTEM_VOICE_AUDIT_20261013.md)
- [工作剧情组织审计](NATIVE_WORK_STORY_AUDIT_20261013.md)
- [Spine track 与 trackTime 修复记录](NATIVE_RUNTIME_TRACK_TIME_20261013.md)
- [构建与验收约束](BUILD_ACCEPTANCE_POLICY.md)

## 证据等级与输入

本轮证据来自当前源码、已解码 masterdata、已发布 compiled/index、RAW 文件与 IL2CPP 反编译。反编译提供结构和执行语义，不自动提供服务端响应中的历史实例值。

| 输入 | 本地位置 | 用途与限制 |
| --- | --- | --- |
| 解码 masterdata | `.analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb` | 当前静态表的记录与字段值 |
| protobuf 字段定义 | `../data_pipeline/schema/il2cpp_protobuf_schema.json` | 正式字段号与名称；不能替代实例值 |
| 域字段注册 | `../data_pipeline/schema/archive_domain_fields.v1.json` | 表号与域名映射 |
| IL2CPP dump | `.analysis/sidem_runtime_dump/il2cppdumper_out/dump.cs` | 类、枚举、偏移与方法声明 |
| 补充反编译 | `.analysis/native-home-voice-audit/`、`.analysis/native-work-audit/`、`.analysis/native-story-category-audit/`、`.analysis/native-gasha-audit/` | 各有 targets、decompiled 与 decompiled_annotated；均在现有 Ghidra 项目上以只读方式提取 |
| 正式目录与剧本 | `public/data/masterdata/`、`public/data/compiled/` | 当前消费者实际可用的数据；不可只核对 ignored 候选副本 |

`.analysis` 是本地证据，未随文档提交。接手环境若没有这些目录，应从 targets 或本文方法名/RVA 重新提取，不能声称已访问这些证据。

## 一、首页通用、季节与时段语音

### 已确认的缺口

当前 `src/data/archiveHomeState.js` 的 `buildArchiveHomeState` 只读取 `card.home_voice_cues`，遗漏了偶像通用首页语音池。

- table 90 `IdolSystemScenarios` 共 1,421 条，其中 HomeStand=1 的 1,029 条，49 位偶像每人 21 条。
- 全部 1,029 条已对应到 RAW、49 个 compiled 文件中的唯一对白步骤及非空本地音频。属于“资源已收录但首页未消费”。
- 391 条有非全年月份条件，420 条有非全天时间条件；两类有重叠，不可相加。
- table 91 `CardSystemScenarios` 共 2,564 行，其中 HomeStand 2,356、HomeCard 208；原始行有重复，不是唯一语音数量。
- table 172 `SubCharacterSystemScenarios` 另有 15 条 HomeStand。该分支不计入上述 49 位偶像的 1,029 条。

原版调用：`HomeIdol.<SetData>.MoveNext`（`0x1d7d5e0`）→ `SystemScenarioDecider..ctor`（`0x1e4dabc`）→ `DecideByWeight`（`0x1e4e23c`）→ `IdolController.Play(ScriptName, ScriptLabel)`。候选池合并当前卡片与当前偶像的语音，按月份、时间、Param1 权重、卡片条件及 override 关系筛选，维护容量 4 的最近队列。

原版使用 `ServerDateTime.Now`，月份允许 12–2 月跨年；时间为起点包含、终点不包含，00:00→00:00 表示全天。不要未经验证改成浏览器本地时区时钟。跨午夜日期锚定应单独测试，未觉醒卡片的 Param2 条件也要保留。

### 需要修正的关联与投影

`../data_pipeline/sidem_masterdata/mobile.py` 的 `build_short_adv_profile_index` 把 ScriptLabel（嵌套字段 2）当作 compiled 文件定位键，而正确定位需要 ScriptName（字段 1）加文件内 jump point。现有索引 1,029 条 HomeStand 全部 `compiled_file=null`，但实际资源存在。

例：`ScriptName=3_1_048` → `3_x_048mom_3_1_048.json`，`ScriptLabel=3_1_048_05` → `jump_points` 第 7 步 → `3_1_048_05.m4a`。百々人的通用池包括早安、晚间慰劳、春日犯困、樱花、冬天与关东煮。

后续工作：

1. 建立明确的通用首页语音投影；保留偶像、类型、ScriptName、ScriptLabel、月份、时间、权重、Param2、override 关联及来源。
2. 修正 compiled 解析，验证跳转点存在且对应预期对白/音频；不要仅把 `compiled_exists` 改成 true。
3. 首页自动互动合并卡片池与通用池，恢复条件、权重和最近播放规则。
4. 手动回听展示完整语音池及条件，允许回听非当季内容；自动抽选与档案访问分别处理。

不要将 table 104/105 误命名的 time_slot 资源当作本链路；它们是 Mobile 随机话题/引导。情人节、白色情人节、生日等独立入口需另查，不能全部塞入普通首页触摸池。

验收：1,029 条无缺跳转/音频；普通、时间、季节、跨年月份与最近重复行为回归；5212 Browser 实测百々人手动回听、自动互动及卡片切换，并确认既有卡片 cue 去重不退化。

## 二、工作剧情目录

### 当前组织准确的部分

| 原表 | 当前目录 | 当前内容 |
| --- | --- | --- |
| table 54 JobStories | scene_lines 场景台词 | 441 条，每位 9 条，全部 1 段对白 |
| table 55 JobStoryAppendixes | short_stories 工作短剧情 | 196 段，每位 4 段；189 段有 10 段对白、6 段有 9 段、1 段有 11 段 |

全部 637 条已逐项对上 masterdata 的偶像、GroupId、ResourceId，实际 compiled 对白数也无差异。单段对白可以含换行或多个句子。没有发现长剧情被截成一句的问题。

table 53 JobData 的 GroupId 关联为 Physical 11/21、Intelli 12/22、Mental 13/23。第四项“みんなのお仕事”没有独立 group ID，不意味着缺失另一套剧情。

`WorkTopView.WorkStartAPI`（`0x1ff67a4`）调用服务端；成功响应含 `JobStoryId` 与 `JobStoryAppendixId`，`PlayADVView`（`0x1ff69ac`）先加入前者，后者非零时追加。不能由客户端证明 appendix 每次必播、出现概率或 9 条单句与 4 段长剧情的固定配对。

### 已定位的数据修正

- `../data_pipeline/sidem_masterdata/work.py` 把 JobData 字段 10 当 sort_order；真实字段 6 才是 SortOrder，字段 10 是 IdolType。当前四行数值恰好相同，尚未出现可见错序。应修字段并独立保留 IdolType。
- JobStory/Appendix 字段 4 Term 没有保留实际值。当前 637 条有效期均为 946652400→4102412400，没有因此漏掉限时内容；后续仍应保留。
- 453 条有背景名，184 条未知。地点名来自 PictureStudio 背景关联，并非原版章节标题，未知时不要猜名称。
- 工作选单山村贤使用 `scenario_4_1_101_01`、`101ken_001_00` 及 5 个候选语音，另一路打乱后循环，不属于 637 条偶像工作剧情。

后续保持两类目录，修投影字段与有效期；若要补玩法关系，应说明两类播放顺序及不确定性，不制造一一配对。

验收：重生索引并比较变更范围；保留 49 位、441+196 条、637 个自然入口；针对字段 6 与 10 不同的 fixture 验证修复，避免现有等值数据掩盖错误；浏览器核对两页签与完整剧情播放。

## 三、生日剧情与个人故事

### 原版边界与共享关系

原版 `StoryType` 明确区分 Idol=3、ProducerBirthday=9、IdolBirthday=10。不是依据对白是否提到生日决定分类。

| 原版结构 | 当前数据与含义 |
| --- | --- |
| table 7/8/9 IdolStory Chapters/Sections/Episodes | 49 位偶像、78 个“第几话”章节、491 个小节；每话 5 个正式 Episode，部分第2话另有 Small Talk |
| table 76/77/78 BirthdayStory Chapters/Sections/Episodes | 4 个大类、181 条记录；制作人生日第1/2年、偶像生日第1/2年 |
| BirthdayStoryChapter.PlayYearCount + BirthdayType | 标识第1/2年及生日对象，不宜写成纯发布日期年份；当前 UI 的“第几期”可改为更忠实的“第几年” |

四个生日大类的当前记录数：制作人第1年 51、制作人第2年 51、偶像第1年 50、偶像第2年 29。不要要求按 49×4 补齐：存在工作人员、公共篇与当前数据批次差异。

181 条生日逻辑记录中，152 条仅属于生日域，29 条同时属于生日与个人故事。共享的是 Small Talk 文件关系，不等于整个个人故事只有生日目录里那一份文件。

原版 `IdolBirthdaySpecialPageView.OnClickBirthdayEpisodeCell`（`0x1c97eec`）按 PlayYearCount、BirthdayType、角色定位生日表；`OnClickIdolEpisodeCell`（`0x1c982e4`）跳到 StorySelectView 的个人故事模式。生日专页本身就同时提供两种入口。

神谷幸广的具体例子：

- 第1话 `ティータイムの談話`：5 个 Episode，compiled `1_2_027yuk_01_1_2_027_01.json`。
- 第2话 `『忘れられない』誕生日にする方法`：5 个 Small Talk + 5 个 Episode。
- Small Talk 文件 `1_x_027yuk_2_1_2_027_12.json` 同时属于生日第2年记录；正式 Episode 使用 `1_2_027yuk_02_1_2_027_02.json`。
- Small Talk 当前均为默认/开放条件；正式 Episode 2～5 通过上一 Episode 完成条件（type 203）顺序解锁。档案可自由阅读，但应保留原版条件证据。

### 后续展示与数据要求

个人故事按“偶像→第几话＋ScenarioTitle→Small Talk / Episode”展示；生日按“制作人生日 / 偶像生日→第1/2年→角色”表达，并明确共享入口指向个人故事所属章节。保留现有按角色浏览能力，不必为了复刻入口删除方便检索的视图。

重点入口：`src/data/storyCollections.js`、`src/data/storyDomainIdentityIndex.js`、`public/data/masterdata/idol_episode_index.json`、`birthday_story_semantic_index.json`、`story_catalog.json`。现有 `domainMemberships` 与 `canonicalRelation` 已表达共享关系，应复用而不是另造重复身份。

不要将两个未绑定单一角色的制作人生日公共篇强归山村贤；也不要按内容主题将 Small Talk 从个人故事搬走。保持已发布正文的逻辑身份、锚点、跳转与翻译关联；历史合并文件的问题不能用覆盖发布历史来处理。

验收：181=152+29，公共篇 2 条，共享入口 29 条；神谷幸广第2话的两文件、10 小节和往返路由；Birthday 与 Idol Episode 双入口对应同一逻辑内容而不重复发布正文。

## 四、卡池、物品、卡片、剧情与视频

### 已解出的直接关系与缺失实例

| 原版字段/结构 | 可表达的直接关系 | 当前限制 |
| --- | --- | --- |
| GashaData.PickupCardIds | 卡池→Pickup 卡片 | 服务端卡池实例值未保存在静态 masterdata |
| GashaData.CardDetails→CardId | 卡池展示→卡片及展示顺序 | 同上；展示卡片不能自动等同于完整可抽取名单 |
| GashaPlans→GashaCosts→CostProduct | 卡池方案→具体票券/货币及消耗 | 缺方案实例，不能用 Item.Value 代替 |
| GashaData.HomeStoryEpisodeId | 卡池→宣传剧情 | 链路明确，但确切卡池实例指针缺失 |
| GashaData.MovieAnnounceId | 卡池→告知视频记录 | 链路存在，不能靠相似编号替代缺失指针 |
| GashaStepInfos→GashaId | STEP 各阶段卡池关系 | 缺历史实例，不能从公告阶段补出完整规则 |
| GashaRateReply / GashaStepRateReply | 普通/保底/阶段出率 | 独立服务端响应，未因反编译而恢复历史数值 |

`GashaListReply.Gashas` 下发 GashaData；Masterdata 的 protobuf 字段列表没有 Gasha 表。反编译是“结构已知”，不是“各期实例已恢复”。若后续获得历史响应，应按真实 GashaId 建立关联，并记录来源与哈希，再替换相应 derived 关系。

### 当前关系不能升级为官方值

- `../data_pipeline/sidem_masterdata/gasha.py` 从 table 173 公告建立目录：61 条公告、57 条主记录、336 条卡片推定关系。
- 卡片关系来自 LimitbreakItemId 与唯一精确开放时间匹配，保持 `evidence_level=derived`。不是官方 Pickup 或完整池内容。
- 票券证据共 273 种、81 个名称组，补录 25 条，合并目录 82 条；两个同名 STAGE 公告仍有歧义，另有 2 种未指名选择券不关联卡池。
- 逐项检查上述 273 种票券：均 ItemType=3；Item.Value 有 213 条缺省（protobuf 默认 0）、60 条为 1，没有可定位具体卡池的隐藏 ID。
- `destination_id` 已保留公告跳转信息，但它不是完整卡池实例；不能直接把公告记录等同于 GashaListReply 内容。

入口：`src/data/gashaCatalog.js`、`gashaTicketCatalog.js`、`src/components/archive/ArchiveGashaDetail.vue`、`public/data/editorial/gasha-ticket-evidence.json`。页面目前正确提示推定关系及服务端信息缺失，不应提前取消这些提示。

### 已有但没有接入卡池页的内容

1. **告知视频**：table 175 的 30 条 MovieAnnounceData 均精确对应 RAW `movie_home_announce_<ResourceId>.usm`，已进入 `movie_announce_index.json` 与 `usm_relation_catalog.json`。当前卡池页没有视频消费者。该资源对应明确，不等于所属卡池已确认；RAW/ffprobe 证据也不等于已生成浏览器可播放媒体。
2. **宣传剧情**：`GashaTopView.PlayHomeStoryEpisode`（`0x1ec54f8`）用 episode ID 读取 HomeStoryEpisodeData，并以 HomeStoryGasha=12 播放。部分内容已进入额外剧情，例如 GROWING FES 的四篇，但卡池→剧情入口未接入。不要把所有 HomeStory/额外剧情都认作卡池剧情。

后续可以先提供独立可检索的宣传内容，再逐条补卡池关联证据；不得仅按编号、时间相近或“GROWING FES”同系列名称自动硬连。只有确切对应的条目才能在卡池详情显示“关联剧情/视频”，其余保持未确认。

验收：保留 336 条 derived 等级与 STAGE 歧义；有依据的新关系独立列出来源、直接键与旧关系差异；视频完成资源转换、HTTP 与 Browser 播放才能标可播放；不得补造出率、卡片范围、STEP 保底或日期。

## 五、此前运行时工作仍需跟踪的风险

这些问题不是上述四组审计已经实施的修复，后续按独立批次处理：

| 项目 | 当前状态 | 后续边界 |
| --- | --- | --- |
| 原版 track 编号与 trackTime 管线 | `de850b7e` 已实现并推送，body0/neck1/face2/mouth3/eye4 | 历史正式 JSON 的 381 条非零 body trackTime、涉及 250 个 RAW 文件尚未回填；仅有隔离候选验证，不能称全库已生效 |
| `off` 闭眼语义 | 已由原版 PlayCloseEye / ResetCloseEye 及 RAW 证实；百々人多条首步闭眼与 RAW 一致 | 不要因观感统一改成睁眼 |
| 空表情标记继承 | state.py、JS legacy normalizer、Python authoritative 等路径存在 truthy 更新风险 | 区分缺字段与显式空值；先明确原版语义，再修继承 |
| 延迟同表情 cue 合并 | compiler `_process_timeline` 有去重忽略 eye flag、近时刻归并和 `result[-1]` 回写风险 | 已发现百々人 RAW 中 off→目 被折叠的真实例子；保留动作时序与 actor 身份，不做无依据全库重编译 |

表情扫描中“1172 条空标记”“441 次原始行序的空标记跟在 off 后”“5293 组延迟同表情眼标记变化”仅为排查范围，不是已证明的正式数据受影响数量。不能将这些扫描计数写成修复成果。

## 建议实施顺序与交付合同

1. **首页通用语音解析与数据投影**：先解决 ScriptName/Label 关联，产出小型差异清单，再接消费者与原版条件抽选。优先处理已完整收录的 1,029 条真实缺口。
2. **工作字段修正**：修 SortOrder/IdolType、保留 Term；限定为工作投影，避免重生其他域。
3. **生日/个人故事展示细化**：复用既有身份与共享关系，只改变分层/标签与入口表达；不制造正文副本。
4. **卡池宣传内容与关联补证**：先证明单条关联，维护 confirmed/derived/unresolved；服务端实例未找回前保留已有推定体系。
5. **运行时遗留数据问题**：trackTime 历史回填、眼标记继承与 cue 去重各自独立候选、独立验收，不夹入目录展示修正。

每批开始先核对最新 HEAD、工作区、正式数据与活动服务，保留无关未跟踪文件。数据修正先产生候选与逐条差异，明确来源身份、影响条目、发布与翻译锚点，再按现有发布合同提升正式产物；不直接覆盖旧文件、全部重编译或改写 append-only 发布历史。

验证按 [BUILD_ACCEPTANCE_POLICY](BUILD_ACCEPTANCE_POLICY.md) 选择：纯文档只做事实/链接/diff 检查；代码做相关回归与必要的 `npm run build:check`；渲染或媒体变化必须真实 Browser 验证。build-check 固定输出 `.analysis/build-check`、不复制 public，不是完整发布包。不要更换 5212 端口或默认部署。

## 已执行的核查与接手可复跑命令

本轮已有结果：首页主链反编译 41+2 个目标、工作 14 个、生日/个人故事 6 个、卡池 7 个，均成功；首页 1,029 条本地覆盖、工作 637 条身份与对白核对完成。生日/卡池结论另由当前 schema/index 和源码确认。

以下命令已通过；它们各自覆盖合同，不代表逐条真实媒体播放：

```powershell
node scripts/verify-work-story-index.mjs
python scripts/verify-masterdata-work.py
node scripts/verify-birthday-story-domain-landing.mjs
node scripts/verify-gasha-catalog.mjs
node scripts/verify-gasha-ticket-evidence.mjs
```

`verify-masterdata-work.py` 本次未传 mounted-baseline 参数，不能写成历史哈希基线复验。生日门禁验证 51 个集合、181 条逻辑记录、2 条公共篇和 29 条跨域文件。卡池门禁证明现有推定/补录合同保持一致，不证明服务端历史池内容完整。

尚未完成：上述修正的代码实现、正式数据迁移、对应 Browser 验收、公开推送确认和部署。后续交付应逐项更新这些状态，避免把本交接的建议当成已完成事项。
