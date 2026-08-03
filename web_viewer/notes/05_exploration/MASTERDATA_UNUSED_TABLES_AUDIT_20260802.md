# Masterdata 未用表审计（158 表全盘点）

> 维护说明：本文记录 2026-08-02 对 raw client_master_data 全部 158 张表的消费状态盘点。
> 现行基线以 `CURRENT_ARCHIVE_BASELINE_20260728.md` 为准；本文件是"还有哪些表没解析"的探索记录，
> 不改变任何已发布索引的权威性。

> **2026-08-03 收口更正：** 本文原来的“69 张已消费 / 90 张未解析”是
> 2026-08-02 的 AST 探索快照，不是当前消费总数，也不能证明页面或 Runtime
> 已消费。除下表列出的增量外，尚未逐项核对生成物与消费方的条目统一标为
> **TODO consumer-check**；在重新运行全表盘点前，不再对当前已消费/未消费总数
> 作确定陈述。

创建：2026-08-02
关联：RAW_MASTERDATA_MIGRATION_20260726.md | GS_ARCHIVE_EXTRA_OFFICIAL_TAXONOMY_20260730.md | INDEX.md

---

## 背景与动机

「大海捞针」式疑问：masterdata 里还有没有**没被利用的、有参考价值**的信息？资产关联表面上已覆盖
卡片/剧情/音乐/活动/服装/背景等，但那是"已消费表"的视角。需要一张全表消费状态图，找出盲区。

## 消费状态口径与 2026-08-03 增量

- **consumer-verified**：至少有生成索引，并有 selector/组件或专用 verifier
  证明下游读取；有浏览器证据时另行记录 browser-accepted。
- **source-audited**：表结构、join 或 RAW 对应已核对，但尚不能声称产品消费。
- **TODO consumer-check**：尚未核对最终生成物及其下游消费；不能据此删除、
  降级或宣称“无增量”。

| 表 | 当前状态 | 证据边界 |
|---|---|---|
| 16 / 75 / 130 | **consumer-verified（当前分支）** | `card_detail_index.json` + selector + 专用 verifier + 5174 卡片详情验收 |
| 76 / 77 / 78 / 80 / 86 | **consumer-verified（master / PR #36）** | `birthday_story_semantic_index.json` + 专用 verifier + Birthday 页面投影 |
| 178 | **consumer-verified（master / PR #32）** | `extra_story_visual_index.json` + Extra landing verifier + 页面视觉 |
| 143 | **TODO consumer-check** | 产品已有 3 个 supplement 投影，但尚未确认它是由表 143 直接生成而非策展映射 |
| 39 / 57 / 58 / 60 / 61 / 87 / 91 / 111 / 122 | **TODO consumer-check** | 只有 source audit、候选用途或局部对照，不得写成已消费 |

## 方法

1. `iter_top_records()` 全量扫描 raw pb（`web_viewer/.analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb`，3,053,002 字节）
   → 得到 **158 张 top-level 表**，记录数/字节数/字段分布/JP 文本与资源匹配样本（流水线已有 `masterdata_table_scan.json`）。
2. AST 汇总 `masterdata_extract.py` + `build_index.py` 所有表引用（set 字面量、`tables.get(N)`、`tables[N]`）
   → 当时得到 **69 张生成侧引用候选**，不等于 consumer-verified。
3. 差集 → 当时得到 **90 张未解析候选**，逐表解码样本、按价值分层；该差集
   未随 PR #32–#36 及当前卡片语义分支重算。
4. 用两次实际反查（卡片 1338001、个人故事 2380208）验证索引反查链路，作为"已利用能力"的对照。

## 全表概况

| 指标 | 数值 |
|---|---|
| raw pb 大小 | 3,053,002 字节 |
| top-level 表总数 | 158 |
| 2026-08-02 AST 生成侧引用候选 | 69（历史快照，待重算） |
| 2026-08-02 未解析候选 | 90（历史快照，待重算） |
| 未解析表字节合计 | ~1.15 MB（约占 20%） |

## 2026-08-02 AST 引用候选 69 张（历史分组，非当前消费结论）

| 分组 | 表 ID | 产出索引 |
|---|---|---|
| 主线/剧情章节 | 4, 5, 6, 8, 9, 11, 12, 13, 14, 15, 43, 54, 55, 78, 144, 145 | story_master_index, idol_episode_index, work_story_index |
| 卡片 | 1 | card_index, card_skill_movie_index |
| 音乐/影片 | 46, 112, 133, 175 | music_catalog, movie_announce_index, song_movie_index |
| 活动 | 10, 70, 113, 114, 124, 126 | event_index |
| 通信/电话/房间 | 32, 34, 36, 43, 44, 63, 68, 94, 96, 98, 103–106, 180 | mobile_archive_index, home_interaction_index |
| 偶像/单位/说话人/服装 | 2, 7, 24, 27, 28, 29, 100, 101, 176 | idol_unit_dictionary, speaker_dictionary, costume_dictionary, face_dictionary |
| 季节/情人节/白情 | 20, 21, 23, 40, 146–150, 153, 159, 162, 165, 168 | seasonal_communication_index, seasonal_campaign_index |
| 演出用其他 | 53, 90, 107, 108, 110 | background_catalog, short_adv_profile_index |

## 2026-08-02 未解析候选 90 张（按价值分层）

### Tier 1 — ~~完整剧情演出数据~~ → 已确认为照片工作室姿势语音（非剧情）

**2026-08-02 深究结论：`3_4_xxx` 不是剧情，是ピクチャースタジオ（Photo Studio）姿势语音体系。**

决定性证据（il2cpp schema 精确字段匹配）：

| 表 | 模型（精确/子集匹配） | 关键字段 |
|---|---|---|
| 122（1,975 条） | **`PhotoPoseVoiceData`（精确匹配）** | 1 Id, 2 PhotoPoseId, 3 Weight, 5 CueSheetName, 6 CueName |
| 57（554 条） | `PhotoFaceData`（子集，缺 12） | 1 Id, 2 IdolId, 4 SortOrder, 7 AnimationName, 11 ScenarioResourceId, 13 IconResourceId |
| 58（395 条） | `PhotoPoseData`（子集，缺 14/16） | 1 Id, 2 IdolId, 4 SortOrder, 7 AnimationName, 12 ScenarioResourceId, 15 IconResourceId |

数据形态（`3_4_001` 为例）：

- 表 122：`{"1": 1010101, "2": 10101, "3": 1, "5": "3_4_001", "6": "3_4_001_01"}` → CueSheetName=`3_4_001`、CueName=`3_4_001_01`；
- 表 57：`{"1": 10101001, "2": 1, "4": 10101001, "7": "3_4_001_2_01", "11": "3_4_001", "13": "default"}` → IdolId=1、ScenarioResourceId=`3_4_001`、表情 `default`；
- 表 58：`{"1": 10101, "2": 1, "4": 10101, "7": "3_4_001_1_01", "12": "3_4_001", "15": "0001"}`。

RAW 对应资源（49 组完整覆盖）：

- `RAW/audio/3_4_001.acb` … `3_4_049.acb`（49 个，cue_index 中 245 个 cue = 49 组 × 5 句 `3_4_001_01`~`_05`）；
- `RAW/asset/lipsync_3_4_001.unity3d` … `lipsync_3_4_049.unity3d`（49 个口型）；
- **无 `scenario_3_4_*.unity3d`**（不是故事剧本，所以没有）。

分布佐证：

- 表 57 IdolId 分布多样（45 号 18 行、9 号 16 行、10 号 12 行…），field-13 表情枚举每种 49（default/joy/happy/angry/sad/serious/shy/surprise）→ 49 姿势 × 表情组；
- 表 58 field-1 范围 10101–14908（49 个姿势 ID 101–149）；
- 表 4 的「第3章」（103）release 1893423600 = 2030-01-01 远期占位，与 `3_4_` 无关；主线表 5 只有 10100/10200 两组（第1/2章，各 PROLOGUE+10话），表 6 只有 `1_4_001_`/`1_4_002_` 前缀。

**Why 会误判**：前缀 `3_4_` 与主线 `1_4_` 平行、且有音频/口型资源，初看像未实装剧情；但 il2cpp schema 精确匹配直接指向 Photo Studio 模型，字段名（CueSheetName/CueName/PhotoPoseId/IdolId/AnimationName）彻底排除剧情。

**How to apply**：若未来做「照片工作室素材索引」或给偶像详情页加姿势语音，这三张表 + RAW 音频/口型就是完整来源；但**不应**进入 story_master_index / compiled 剧情管线。

### 表 91（2,564 条）— source-audited；TODO consumer-check

初看体量大、带时间码，很诱人。但嵌套 protobuf（field-4）里 826 个 cue base 与
`card_voice_cue_field91_extract.json` 的 scenario_base **100% 重叠**（826/826）：
`{"1": 1, "2": 1401001, "4": "0a0d325f345f303031..."} → base "2_4_001_01_00" cue "2_4_001_01_00_01" 时间码 "00:00:00"`。
样本对照里唯一增量是 cue 时间码。**TODO consumer-check：** 尚未与播放器、
口型/字幕时间轴或其他最终消费方逐项比对，不能据此作全局“无增量”结论。

### Tier 2 — 字典类（可直接回填现有页面）

| 表 | 条数 | 内容 | 潜在用途 |
|---|---|---|---|
| 16 | 535 | ItemData 道具 master（12 类，il2cpp 精确匹配 15 字段） | **consumer-verified**：当前卡片语义分支已消费 5 个限凸素材 |
| 39 | 1,613 | HonorData 称号 master（3 类，il2cpp 精确匹配 9 字段） | **TODO consumer-check**：称号页/偶像页/活动页均未核对消费 |
| 76 | 4 | 生日章节目录（511/512/521/522） | **consumer-verified**：PR #36 Birthday 语义索引 |
| 77 | 181 | 生日节定义：`51101` プロデューサー誕生日 1年目 天ヶ瀬冬馬 | **consumer-verified**：PR #36 Birthday 语义索引 |
| 80 | 181 | 生日 episode→角色映射（field-2 = 原始 varint 角色 ID） | **consumer-verified**：PR #36 Birthday subject 解析 |
| 86 | 78 | 偶像生日公告文本：`10月9日はアスラン＝ベルゼビュートⅡ世の誕生日です`（两版 × 29 角色重复） | **consumer-verified**：PR #36 官方生日；其他资源字段仍 TODO |
| 60 | 4 | PhotoFilterData 滤镜：sepia/sepia_light/gray/mono | 见下方「贴纸/相框深究」专节 |
| 61 | 184 | PhotoStickerData 贴纸：ステッカー Jupiter / DRAMATIC STARS | 同上 |
| 111 | 26 | PhotoFrameData 相框：フレーム 上下カット細 | 同上 |
| 75 | 19 | 技能分类：判定強化等 | **consumer-verified**：当前卡片语义分支已 join 分类、色值与图标语义 |
| 87 | 19 | ProducerSkillData | **TODO consumer-check**：未找到可核对的产品消费方 |
| 130 | 28 | 中心技能分类 master | **consumer-verified**：当前卡片语义分支已 join 分类名 |
| 178 | 7 | ExtraStoryChapterData（正式作品权威） | **consumer-verified**：PR #32 正式作品与 RAW 导航视觉 |
| 143 | 10 | Extra campaign（作品名 + 开催时间） | **TODO consumer-check**：先核对是否为直接生成来源 |

### 生日体系深究（表 76/77/80/86 + 已消费的表 78）— 2026-08-02 结论

**2026-08-03 状态：生日剧情与语义层均已消费。`story_master_index.birthday`
含 181/181 条且全部 `compiled_exists: true`；PR #36 又将表 76/77/80/86
生成 `birthday_story_semantic_index.json` 并投影到 Birthday 页面。未核对的是
表 86 的其他资源字段，不是整张表的消费状态。**

#### 表结构与 join 链路

| 表 | 模型 | 条数 | 内容 | 消费状态 |
|---|---|---|---|---|
| 76 | BirthdayStoryChapterData | 4 | 章节目录：511 P生日1年目 / 512 偶像生日1年目 / 521 P生日2年目 / 522 偶像生日2年目（field-7 1=P生日、2=偶像生日） | **consumer-verified** |
| 77 | BirthdayStorySectionData | 181 | 节定义：`51101` プロデューサー誕生日 1年目 天ヶ瀬冬馬 | **consumer-verified** |
| 78 | BirthdayStoryEpisodeData | 181 | episode：`5110101` + field-5 资源 `1_8_001_01` | **已消费** → birthday 索引 |
| 80 | BirthdayStoryCharacterSetData | 181 | episode→角色：`5110101` → 原始 varint `01`（天ヶ瀬冬馬） | **consumer-verified** |
| 86 | BirthdayAnnounceText(?) | 78 | 生日公告：「10月9日はアスラン＝ベルゼビュートⅡ世の誕生日です」 | **consumer-verified（生日日期）；其他字段 TODO** |

join 链路：76 → 77（chapter→section）→ 78（section→episode，field-2=节 id、field-5=资源）→ 80（episode→角色，field-2=varint 角色 ID）
→ 表 2 idol master（角色 ID→名字，49 偶像含 DRAMA 与アスラン）。表 86 按角色 ID（field-2）直接 join 表 2。

#### 章节构成（表 77）

- **511（P生日1年目）51 节** = 49 偶像（51101~51149）+ 511100（无名，标题无偶像名）+ 511101 山村賢
- **512（偶像生日1年目）50 节** = 49 偶像（51201~51249）+ 512101 山村賢
- **521（P生日2年目）51 节** = 49 + 521100 无名 + 521101 山村賢
- **522（偶像生日2年目）29 节** = 29 角色（非全 49！）

山村賢（101）不在表 2 的 49 偶像里，是事务所工作人员，但有自己的生日剧情与生日文本（7月2日）。

#### 时间戳语义（field-4/6）

- **511/521（P 生日）全部 946652400 = 2000-01-01 占位** —— P 生日由玩家自定义，无固定日期，官方用占位时间戳。
- **512/522（偶像生日）= 真实生日日期（UTC 前一天）**：51201 冬馬 = 2022-03-02（生日 3/3）、51229 アスラン = 2021-10-08（生日 10/9）。
  512 全 50 节均为「2021-10-08（生日系统随 DRAMA 实装）之后每个角色第一次生日」的日期；
  522 全 29 节 = 第二轮生日（2022-10-08 アスラン … 2023-04-21 橘志狼）。
- **522 只有 29 条的原因 = masterdata 快照时点 ≈ 2023-04-21**：2023-04-21 之后生日的角色（木村龍 5/5、牙崎 5/14… 眉見鋭心 5/23 等）2 年目剧情未入快照。
  佐证：522 的 29 角色集与表 86 第二版 29 条（50~78）完全一致，日期范围 2022-10 ~ 2023-04。

#### 资源族（表 78 field-5 → RAW/compiled）

| 资源前缀 | 对应章节 | 场景 bundle | compiled | 音频 bank | 内容形态 |
|---|---|---|---|---|---|
| `1_7_001_01`~`1_7_049_01` + `1_7_101_01` | 512 偶像生日1年目（50） | `scenario_1_7_xxx.unity3d` × 50，每 bundle 1 个场景 | `1_x_xxx_1_7_xxx_01.json`（100 文件含 compiled 副本） | `1_7_xxx_01.acb` × 50 | P 与偶像 1 对 1：「冬馬さん、お誕生日おめでとうございます！」7 步 |
| `1_8_001_01`~`1_8_049_01` + `1_8_101_00_a/01` | 511 P生日1年目（51） | **全部 102 个场景塞在单个 `scenario_1_8.unity3d`**（50KB） | `1_x_xxx_1_8_xxx_01.json`（204 文件） | `1_8_xxx_01.acb` **只 31 个** | 冬馬祝 P：「●●●●プロデューサー、誕生日おめでとう！」8 步 |
| `1_8_001_02`~`1_8_049_02` + `1_8_101_00_b/02` | 521 P生日2年目（51） | 同上（`_2` container 目录） | 同上 | `1_8_xxx_02.acb` 49 个全齐 | 同上 2 年目版 |
| `1_2_001_12`~`1_2_047_12` | 522 偶像生日2年目（29） | `scenario_1_2_xxx_12.unity3d` × 29 | `1_x_xxx_2_1_2_xxx_12.json`（283 文件） | **无专用 audio** | **多偶像团体庆祝**：315 lounge 场景，翔太/北斗/冬馬 等全员登场 |

**audio 缺口（唯一素材盲区）**：P 生日 1 年目 `1_8_xxx_01` 只有 31 个 bank，缺 18 个偶像（006 柏木翼、011 渡辺みのり、012/013 蒼井兄弟、015 木村龍、022 榊夏来、023 若里春名、024 伊瀬谷四季、026 黒野玄武、030 卯月巻緒、031 水嶋咲、036 舞田類、038 大河タケル、039 円城寺道流、040 牙崎漣、041 秋月涼、046 古論クリス、049 眉見鋭心）——这 18 个偶像 P 生日 1 年目剧情**无语音**（lipsync 同步缺失）；2 年目 49 个全齐。

**陷阱记录**：场景与 compiled 都存在，早期「RAW scenario_1_8_ = 0 / compiled 1_8 = 0」的结论是 grep 模式漏报——`scenario_1_8` bundle 无编号、compiled 文件名带 `1_x_xxx` 偶像前缀。

#### 表 86 结构（78 条 = 两版）

- 1~48：48 偶像生日文本（**13 蒼井享介 无独立条目**——39 号「7月7日は蒼井 悠介と蒼井 享介の誕生日です」双子合并），field-5=1002~1049；
- 49：山村賢（7月2日），field-5=1050；
- 50~78：**第二版 29 条**（field-5=1052~1080），角色集与 522 章 29 角色完全一致 —— 即 2 年目/2023 版公告（field-6 = 1064~1102 与第一版不同）；
- field-8 = `0801101d` 风格 hex 串（疑似立绘/画像资源引用），field-5/6 为资源 id（语义未完全确认）。

**可回填增量**（若做生日页/日历 widget）：
1. 表 86 → 49 偶像 + 賢 生日日期与公告文本（field-2 join 表 2）；
2. 表 77 节标题（「プロデューサー誕生日 1年目 天ヶ瀬冬馬」）与表 78 episode 标题（「プロデューサー 誕生日エピソード」）补全 birthday 索引条目；
3. 表 80 角色映射 → 偶像详情页反查生日剧情；
4. 表 78 的 field-4（发布时戳）可用于「生日剧情年份」排序。

### Extra 权威深究（表 178/143 + 已消费的 144/145）— 2026-08-02 结论，2026-08-03 消费更正

**当前结论：`story_master_index.extra` 已消费表 144/145（47 集全 compiled）；
PR #32 又将表 178 的 7 个正式作品与 RAW 导航视觉投影到 Extra 页面并通过
专用 verifier。表 143 仍为 TODO consumer-check：产品已有 3 个 supplement，
但本轮尚未证明它们由表 143 直接生成。**

#### 四表 join 链路

```
表 143 Extra campaign (10)  ── id ──→ 表 144 section.chapter_id (47)
表 178 正式作品 (7)        ── ChapterId ──→ 表 144 section.chapter_id
表 144 section ── field-1 ──→ 表 145 episode.section_id (47)
表 145 ── field-5 ──→ 场景资源 5_xx_xxx_xx → RAW scenario/audio + compiled
表 144 f8 (仅 GROWING FES 3 节) ──→ 表 175 movie announce id（Term 字节完全一致）
```

#### 表 178 = ExtraStoryChapterData（il2cpp 精确匹配，7 条）

| 字段 | 语义 | 值 |
|---|---|---|
| 1 Id | 条目 id | 1010010、1010040、1010050、1010060、1010080、1010090、1010100 |
| 2 ExtraStoryChapterType | 枚举 | 全 = 1（未知） |
| 3 ChapterId | 章节 | 601、604、605、606、607、608、609 |
| 4 ResourceId | 图片资源 | 同 Id，**605 例外：Id=1010050 但 ResourceId=1010070** |
| 5 LogoResourceId | logo 资源 | 同 ResourceId |
| 6 Term | 嵌套 {1: 开催, 2: 结束} | **结束全 = 4102412400（2100 远期占位）→ 常设开放** |
| 7 SortOrder | 大整数 | 76967585000~77989900000（语义未定） |

- **7 个正式作品**：601 謹賀新年2022、604/606/607/609 GROWING FES、605 1st Anniversary、608 謹賀新年2023；
- **605 的 ResourceId 分离**：RAW 只有 `image_story_extra_1010070.unity3d`、无 1010050 —— 证实 TAXONOMY note「非推断关系」；
- **RAW 图片**：`image_story_extra_{ResourceId}.unity3d` × 7，每 bundle = `image_extra_banner_{id}.png` + `image_extra_kv_story_{id}.png` + `image_extra_logo_{id}.png`（Texture2D + Sprite）。

#### 表 143 = Extra campaign（10 条，无 il2cpp 模型）

字段：Id / 名称 / release 时间戳 / "0" / Id。10 条 = 7 正式 + 3 supplement：

| id | 名称 | release（JST） |
|---|---|---|
| 601 | 謹賀新年 | 2022-01-01 08:00 |
| 602 | 22/4エイプリルフール | 2022-04-01 08:00 |
| 603 | 22/3プロミ連動 | 2022-03-13 11:30 |
| 604 | GROWING FES | 2022-06-29 08:00 |
| 605 | 1st Anniversary | 2022-09-15 08:00 |
| 606 | GROWING FES | 2022-09-28 15:00 |
| 607 | GROWING FES | 2022-12-28 08:00 |
| 608 | 謹賀新年2023 | 2023-01-01 08:00 |
| 609 | GROWING FES | 2023-03-24 08:00 |
| 610 | 23/4エイプリルフール | 2023-04-01 08:00 |

release 与表 178 Term.start **7/7 完全一致** → 表 143 是时间主。602/603/610 无表 178 条目（无正式 KV/banner）= TAXONOMY note 的「3 个 Home Story supplement」。

#### 表 144 = ExtraStorySectionData（47 节，已消费为 extra.groups）

- 字段：Id / ChapterId / 名称 / **Term（活动真实时间窗）** / "0" / Id / **f7 枚举** / **f8 movie_announce_id（3 行）**；
- **Term 与表 178 不同：是实际活动窗口**（非远期）——謹賀新年 8 天、愚人节 OP/ED 各 1 天、プロミ 27.5h、GROWING FES 4 天、1st Anniv 每日 1 集（2022-09-14 ~ 10-05）、謹賀新年2023 2022-12-31 ~ 2023-01-07；
- **f7 枚举**：1（22 节：Anniv/プロミ/ポートレート）、2（5 节：謹賀新年/愚人节）、5（3 节：GROWING FES）、7（17 节：謹賀新年2023）——语义未定（疑似 release 方式分组）；
- **f8 = 表 175 movie announce id**：604→230001（影片 30001）、606→230003（30003）、607→230006（30006），Term 字节串与表 175 field-5 完全一致 —— GROWING FES 三作有对应宣传影片（表 175 已消费为 movie_announce_index）。

#### 表 145 = ExtraStoryEpisodeData（47 集，已消费为 extra.episodes）

- 字段：Id / SectionId / 标题 / release / **资源 5_xx_xxx_xx** / Id / 章节内集数 / **f8 解锁条件** / 排序 / Id；
- **f8 解锁条件嵌套**：{1: 1} = 无条件；60202「そして日常はつづく」/ 61002 = {1: 2003, 2: 6020101}（前置 = 6020101 完成）；
- **610（23/4 愚人节）复用 602 场景** `5_03_000_22_a/b` → 47 集 = **45 唯一资源**；
- 资源族：`5_00_000_22`（謹賀新年2022）、`5_00_00x_23` ×17（謹賀新年2023）、`5_03_000_22_a/b`（愚人节，单 bundle 双场景，同 1_8 模式）、`5_04_000_22`（プロミ）、`5_05_00x_00` ×4（GROWING FES）、`5_06_0xx_22` ×20（1st Anniv，**跳号 019**：5_06_018 → 5_06_020）；
- RAW 场景 26 个 bundle 全齐；**45/45 资源全部有 compiled**（当前基线；TAXONOMY note 的「44 compiled」是旧统计）；
- **音频缺口 2 个**：`5_04_000_22`（603 運動会が終わって）、`5_06_018_22`（60519 ライブが終わって）——无 ACB bank。

#### 2026-08-02 候选缺口（PR #32 后需逐项复核）

下列清单保留原始探索结果。表 178 的正式作品分组与图片已完成；其余字段只有
在核对当前生成物与组件消费后才能继续标为缺口：

`story_master_index.extra.groups` 目前只有表 144 原始字段（Term 未解码），缺：

1. 表 178 → 正式作品分组（7 个）+ ResourceId → banner/KV/logo 图片路径（RAW `image_story_extra_xxx`）；
2. 表 143 → campaign 名称与开催时间（谨贺新年/GROWING FES/1st Anniversary/愚人节）；
3. 表 144 Term 解码（活动时间窗）+ f7 枚举归一化；
4. 表 144 f8 → movie_announce_index join（604/606/607 的 PV 30001/30003/30006）；
5. 610/602 场景复用关系（47 集 → 45 资源）。

### 道具/称号深究（表 16 + 表 39）— 2026-08-02 结论

**两张表均为 il2cpp 精确匹配；表 16 的限凸碎片回填已验证，表 39 有完整称号族谱（含活动排名编码）。**

#### 表 16 = ItemData（535 条，15 字段全解）

字段：1 Id / 2 ItemType / 3 Value（恢复量等）/ 4 ResourceId / 5 SortOrder / 6 Name / 7 Description / 8 **Term（嵌套，全部 {2000-01-01, 2100 远期} = 常设）** / 9 MaxAmount（999999）/ 10 ExpireType（1=195、3=278、4=61、2=1）/ 11 ExpireDays（278 行）/ 12 DisplayName / 13 LabelType（1=310、4=171、3=54）/ 14 RarityResourceId（仅限凸碎片：1=N 2=R 3=SR 4=SSR）/ 15 IsDiscardExceeded（仅アンコールスター）

12 类道具（ItemType × ID 前缀）：

| 前缀 | ItemType | 条数 | 内容 |
|---|---|---|---|
| 101xxx | 1 | 170 | 体力系 `stamina_001` ゴーゴーゼリー（Value=恢复量） |
| 303xxx | 3 | 269 | プラチナガシャ券 `gasha_ticket_0101`（+203xxx/403xxx 共 273） |
| 104xxx | 4 | 11 | 觉醒素材 `card_awake_001` フィジカルバッジ |
| 105xxx | 5 | 5 | **限凸碎片 `card_limitbreak_001` 彩光の欠片** |
| 107xxx | 7 | 3 | 技能书 `skill_levelup_001` 初級レッスンノート |
| 110xxx | 10 | 3 | 报酬提升 `live_rewardup_001` アンコールスター |
| 112xxx | 12 | 1 | 剧情钥匙 `scenario_key_001` 思い出のダイアリー |
| 114xxx | 14 | 2 | ガシャ代币 `gasha_token_001` メモリースター |
| 318xxx | 18 | 9 | 选择券 `selection_ticket_001` |
| 415xxx | 15 | 20 | 活动练习套装 `event_10001` 『Not Alone』練習セット |
| 416xxx | 16 | 34 | 活动贴纸 `event_20001_n` パッションシール |
| 417xxx | 17 | 4 | 情人节巧克力 `campaign_vd_001_n` パッションチョコ |

**card_index 回填验证（5/5 命中）**：`limitbreak_item_id` 10501~10505 →
10501 彩光の欠片 N（x53 卡片）/ 10502 R（x86）/ 10503 SR（x399）/ 10504 SSR（x117）/ 10505 フェス限定彩光の欠片（x12）。
card_index 唯一的道具引用就是它，回填后每张卡可显示限凸道具名。

#### 表 39 = HonorData（1,613 条，9 字段全解）

字段：1 Id / 2 Name / 3 ResourceId / 4 HonorType / 5 OpenAt / 6 **SortOrder（双轨）** / 7 Description（全 = 「プロデューサーのプロフィールに設定できる称号。」）/ 8 **EffectType（1=1601、2=12）** / 9 PrefabResourceId（本快照无）

3 类称号（HonorType）：

| 类 | 条数 | ResourceId 模式 | 内容 |
|---|---|---|---|
| 1 normal | 114 | `honor_normal_1000xxxx` | P 常设称号：仕事熱心、一流の仕事人、フィジカル/インテリ/メンタルワーカー、思い出の紡ぎ手… |
| 2 idol | 122 | `honor_idol_2XXYY001` | 偶像称号：**2XX = 偶像 id（201 冬馬…249 鋭心）**、YY=种类（15=担当、22=FES 称号、25=？、27=チェンジ、28=限界突破满破） |
| 3 event | 1,377 | `honor_event_3XXXXYY` | 活动称号：**3XXXX = 活动 id（30017=Not Alone、30024/30025…）**、YY=第几组 |

**idol 类编码验证**：20115001 天ヶ瀬冬馬担当（常设）、20122001 楽勝！だぜッ！（open 2022-09-28 GROWING FES）、20327001 22/12FES限定フォトをチェンジさせる_伊集院 北斗、20328001 …限界突破させる（open 2022-12-28）。

**EffectType=2（12 条）= FES 限定フォト满破成就称号**（22/6・22/9・22/12・23/3 FES 各偶像），稀有特效。

**SortOrder 双轨**：
- 小值（236 条）= 常设，sort = id 自身；
- **大值 4448000000000 起（1,377 条）= 活动排名称号**，前缀编码：4448=Not Alone、44491=想いはETERNITY、44502=Plus 1 Good Day!、44521=Study Equal Magic!… 每活动 13 档（0位=参与、1/2/3/10/100/1000/10000位）；44531 起 = 各旬活动 pt 报酬称号（2021-12 ~ 2023-03，每活动 13 档）；
- **44601/449581（各 441 条）= VDCP 情人节巧克力成就**：49 偶像 × 9 档（「天ヶ瀬 冬馬の渡したチョコ数100個達成」等），2022/2023 两版。

**发放条件不在 masterdata**：全库扫描无任何表数值/字符串引用称号 id（仅表 39 自身）；表 180 release_condition 也不涉及——称号由服务器端任务系统发放。

**可回填增量**：
1. card_index.limitbreak_item_id → 表 16 名称（已验证 5/5）；
2. 称号页/详情：表 39 三类称号 + OpenAt（活动开放时间）+ 排名编码（f6 可还原「Not Alone 1000位」）；
3. 活动页：event_100xx 练习套装 ↔ honor_event_3XXXX 呼应（如 Not Alone）；
4. 偶像页：honor_idol_2XXYY001 反查「該当アイドル担当」称号。

### 贴纸/相框深究（表 60/61/111 + 已消费的 107/108/110）— 2026-08-02 结论

**2026-08-02 源侧结论：Photo Studio 五要素中滤镜/贴纸/相框三字典
（表 60/61/111）已完成 schema 与素材覆盖审计，地点/场景可在
`background_catalog` 找到 186 个背景。表 60/61/111 的最终产品消费尚未核对，
当前状态统一为 TODO consumer-check；基础贴纸/相框的客户端内置素材仍是独立
提取缺口。**

#### 表结构（il2cpp 精确匹配）

| 表 | 模型 | 行数 | 字段 |
|---|---|---|---|
| 60 | PhotoFilterData | 4 | 1 Id / 2 Name / 3 SortOrder / 4 OpenAt / 5 ResourceId / 6 Description |
| 61 | PhotoStickerData | 184 | 1 Id / 2 Name / 3 SortOrder / 4 OpenAt / 5 ResourceId / 6 Description / 7 DisplayName |
| 111 | PhotoFrameData | 26 | 1 Id / 2 Name / 3 SortOrder / 4 OpenAt / 5 ResourceId / 6 Description |
| 107 | PhotoSpotData | 133 | 1 Id / 2 Name / 3 SortOrder / 4 OpenAt / 5 BackgroundResourceId / 6 PhotoSceneGroupId / 7 Description |
| 108 | PhotoSceneData | 186 | 1 Id / 2 GroupId / 3 Name（通常/日中…）/ 4 SortOrder / 5 OpenAt / 6 BackgroundResourceId / 7 Effect / 8 Description |

- **表 60 四滤镜**：`sepia` セピア(強) / `sepia_light` セピア(弱) / `gray` グレイッシュ / `mono` モノトーン——ResourceId 是英文名，CSS filter 可 1:1 模拟
- **表 61 贴纸构成**：id 1-65 基础贴纸（16 单位 + 3 品牌 + 3 属性 + 42 表情/物品图标）、66+ 活动/歌曲联动（Not Alone、6thツアー、SideMini 49 偶像、復刻 等）；缺行 id 37/74/180/184-187（已删除）；f5 ResourceId = 零填充序号 `0001`~`0191`
- **表 111 相框**：1-16 基础（上下/左右カット、ドットライン、コーナーデコ 7 色）、17-26 活动（バレンタインリボン 等）；f5 同上 `0001`~`0026`
- **表 107 spot ↔ 108 scene join 全通**：133 spots 全部映射到 133 个 scene group（0 缺失）；spot 的 bg ⊆ scene 的 bg（186 唯一背景），spot 是 scene 的引用变体

#### 素材落地（RAW 覆盖矩阵）

| 元素 | 资源名 | RAW 覆盖 | 缺口 |
|---|---|---|---|
| 背景（spot/scene） | `adv_background_bgXXX` | 186/186 在 background_catalog，asset_exists 全真 | 无 |
| 滤镜 | 英文名 | 无需素材（CSS 模拟） | 无 |
| 贴纸 | `image_picturestudio_sticker_XXXX` | 120/184（0066-0191 区间） | **id 1-65 基础贴纸全缺** |
| 相框 | `image_picturestudio_frame_XXXX` | 10/26（0017-0026 + normal_release） | **id 1-16 基础相框全缺** |

基础贴纸/相框是**客户端内置**（data.unity3d 主资源包，apk assets 64MB），不在服务器下载清单。若需完整复刻，需 UnityPy 提取 data.unity3d（游戏包 `サイスタ - 副本` 的 xapk 内有），或 CSS/占位替代。

**可回填增量**：表 60/61/111 → 新建 photo_studio_catalog（滤镜/贴纸/相框字典 + RAW 资源路径 + asset_exists 状态），配合已消费的 background_catalog 即可支撑复刻拍照环节。

### 技能字典深究（表 75/87/130 + 消费侧 20/21/40/23）— 2026-08-02 结论，2026-08-03 消费更正

**当前结论：技能数据以及表 75/130 分类 join 已由当前卡片语义分支写入
`card_detail_index.json`，并通过 selector、专用 verifier 与 5174 页面验收；
表 87 的产品消费仍是 TODO consumer-check。**

#### 表结构

| 表 | il2cpp 模型 | 条数 | 字段 |
|---|---|---|---|
| 75 | SkillCategoryData | 19 | 分类名（判定強化/ダメージガード/コンボボーナス 等）+ 色码 + 资源 |
| 87 | ProducerSkillData | 19 | 名称 + 描述 + 效果组 1–17 + 时长 + 资源 |
| 130 | CardCenterSkillCategoryData | 28 | 分类名（id 1–28，**27 空缺**） |

#### join 验证（全命中）

- 表 20（SkillData，333 行，已消费）field-8 → 表 75：19/19 分类全命中，0 缺失
- **教程技能 id 1–5（スコアアップ/ライフ回復/コンボボーナス/判定強化/ダメージガード）f9=None**（无固定效果组），对应 5 个基础分类；id 6+ 全部有 f9 效果组
- 表 23（CardCenterSkillData，61 行，已消费）field-9 → 表 130：20/20 全命中，0 缺失

#### 消费侧结构（关键修正：card_index 无 gameplay）

`build_card_detail_index` 把 gameplay 从卡片 **pop 掉**——`card_index.cards` 最终**没有 gameplay 键**，技能信息在 `card_detail_index.json`：

- `skills_by_id`（160 个去重 id）：`id/name/description_template/levels/effects`（表 20 + 21 等级 + 40 效果组归一化）
- `center_skills_by_id`（53 个）：`id/name/description`（表 23）
- `cards_by_resource_id`（826 条）：**777 条同时带 skill_id + center_skill_id（严格同现，0 单边）**；49 条两者皆无 = N 卡（有数值无技能）

**技能条目未 join 分类**：skills 无表 75 分类名/色码，center_skills 无表 130 分类名。

#### 可回填增量

1. `skills_by_id` → join 表 75：分类名 + 色码（判定強化 等 19 类）；
2. `center_skills_by_id` → join 表 130：分类名（id 1–28）；
3. 表 87 消费方（ProducerSkillEffectData）**不在 masterdata**（服务器端技能），仅 19 条，价值低。

### Tier 3 — 低价值候选（UI 文本 / 任务 / 数值 / 演出参数）

> **TODO consumer-check：** 本节“低价值”只是 2026-08-02 的探索优先级，
> 不是删除或不消费结论。下列各表尚未逐张核对生成索引、selector、组件、
> Runtime 或服务器侧替代来源；完成核对前一律保留为待办。

| 表 | 条数 | 内容 |
|---|---|---|
| 62 | 107 | UI 文案：gasha_rate_disclaimer（ガシャ提供割合说明）等 |
| 64 | 638 | UI 文案：common_bar_001 対象がありません |
| 92 | 23 | 页面定义：ホーム/home、ライブ/live（含版本号） |
| 173 | 131 | 公告横幅图 id：image_home_announce_event_10001_ |
| 25 | 3,800 | 数值表：`101001, 1, 1, 225, 300, 225`（疑似任务奖励/门槛） |
| 48/49 | 2,376 | 数值表：`100111, 10011, 1`（疑似关卡/掉落） |
| 50/51 | 594/216 | 数值表 |
| 52 | 48 | 数值表 |
| 115 | 240 | 数值表：`1, 1, 1, 1, 30017002` |
| 117 | 205 | 数值表：含 blob `0802189003` |
| 128 | 126 | 数值表：含重复小 blob 列表 |
| 142 | 145 | 背景 UI 引用：`bg001_315pro_ui_23` + 时间码 |
| 47 | 396 | 数值表 |
| 56/76/81/82/89/109/116/118/123/129/134/135/136/137/138/139/140/143/156/169/170/171/172/174/177/179/183 | 少量 | 小表/配置表 |

（表 3/18/19/22/26/30/38/41/45/65/66/67/69/71/72/73/74/83/84/85/88/93/157/158/160/161/163/164/166/167
为更小的配置/翻译/参数表，**均为 TODO consumer-check，尚未逐张展开**。）

## 反查链路验证（本会话两例）

证明 `mobile_archive_index.json` 的 `release_condition` 归一化字段可作反查入口：

1. **卡片 1338001（大河タケル 恒常SR「燃え盛る蒼き闘志」，038tak_sr01）→ 限凸4回台词**
   - 表 180 type 1604 `card_limit_break` param_a=1338001 param_b=4 → 条件组 113380010201
   - 表 63 → scenario_id 1133800102 → 表 32 base `2_3_038_01_09_a` → `038tak_301_2_3_038_01_09_a.json`
   - 句子「●●●●プロデューサー、明日レッスンスタジオの予約頼んでもいいか」= step 3（adv）
   - raw pb offset 1525338 字节级验证：varint 1133800102 + 标题「[恒常SR] 大河タケル_限凸4回」+ `2_3_038_01_09_a` 同记录

2. **个人故事 2380208（エピソード5「誰がための誕生日パーティ」）→ 后续电话**
   - 表 180 type 203 `idol_story_episode_finished` param_a=2380208 → 条件组 20221101
   - 表 63 → scenario 202211 → 表 43 base `1_2_038_22_t01` → `1_x_038tak_2_1_2_038_22_t01.json`
   - 句子「プロデューサー。お疲れ様。今いいか？」= step 2（call）
   - raw pb offset 1864541 字节级验证：varint 202211 + 「祝われるだけではなくて」+ `1_2_038_22_t01` 同记录

注意：**卡片→限凸台词的反查入口是 mobile_archive_index（表 180 条件）**，不是 card_index——card_index 只挂
home voice（`2_3_038_01_00`）。

## TODO：未深究或未核对消费的字段级盲区

- 表 46（SongData）字段 2/18（1001–1099 ID）、21（415xx 疑似影片 ID）、43（21/25，疑似 story section）未确认语义；
- 表 91 嵌套的 cue 时间码（field 5/6）未与任何消费方比对；
- 表 57 field-13 情绪标签枚举（default/joy/…）未与面部动画对照；
- 表 122 field-3 枚举（1 = ?）未确认；
- 表 86 field-5/6 资源 id（1002 起连续、第二版 +22 偏移）与 field-8 hex 串（`0801101d`）的具体资源指向未确认；
- 表 80 field-2 varint 角色 ID 与表 2 的 join 已验证到「节号 = 角色号」级别（5110101→01 冬馬、52229→29 アスラン）；511100/521100 无名节在表 80 **无角色映射**（field-2 缺）、511101/521101/512101 山村賢 → 0x65=101；表 80 中另有 5111001/5211002 两条 id（field-2=0x0A=10）不在表 78 的 episode 集合内，疑为节级重复记录，未深究。
- 表 87（ProducerSkillData）消费方 ProducerSkillEffectData 不在 masterdata（服务器端）；表 130 id 27 空缺、表 20 教程技能（id 1–5）f9=None 的原因未深究。

## 下一步深究

1. ~~确认 `3_4_xxx` 语义~~ **已完成（2026-08-02）：照片工作室姿势语音，非剧情，不入剧情管线**。剩余：
   表 57/58/122 的姿势/表情/语音索引若做 Photo Studio 素材页可直接消费。
2. **道具/称号**：表 16 的 5 个限凸素材已在当前卡片语义分支
   **consumer-verified**；**TODO consumer-check：表 39** 是否已有任何称号页、
   偶像页或活动页消费，确认没有后再决定新功能。
3. **生日语义**：PR #36 已完成表 76/77/80/86 的索引与页面消费；
   **TODO：** 仅继续核对表 86 未解释的资源字段，不重复建设生日场景索引。
4. **Extra**：PR #32 已完成表 178 的正式作品分组与导航视觉消费；
   **TODO consumer-check：表 143** 是否直接进入生成物，以及 Term/f7/f8 哪些字段
   仍只存在于探索笔记。
5. **技能字典**：当前卡片语义分支已完成表 75/130 的分类 join；
   **TODO consumer-check：表 87** 的真实消费方与价值边界。
6. **贴纸/相框**：表 60/61/111 的 schema 与素材覆盖已 source-audited；
   **TODO consumer-check：** 先核对现有产品是否读取这些表，再决定是否建立
   `photo_studio_catalog`。基础贴纸/相框 81 个客户端内置素材仍是独立提取待办。
