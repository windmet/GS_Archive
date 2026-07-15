# 偶像个人故事与 Mobile Masterdata 审计

日期：2026-07-16

外部对照：

- `https://wikiwiki.jp/sidem-gstars/アイドルエピソード`
- `https://wikiwiki.jp/sidem-gstars/モバイル`
- `https://wikiwiki.jp/sidem-gstars/【モバイル】天ヶ瀬 冬馬`
- `https://wikiwiki.jp/sidem-gstars/【モバイル】Jupiter`

## 结论

本地资料足以把“偶像个人故事”和“Mobile 通信”建设成两个有正式实体关系的档案模块，不需要继续依赖 `compiled/index.json` 的平面分类猜测。

本轮生成：

- `public/data/masterdata/idol_episode_index.json`
- `public/data/masterdata/mobile_archive_index.json`

个人故事共 49 个偶像章节、78 个分节、491 条 Episode，491 条全部能关联本地编译文件。Mobile 共 1,269 条正式场景关系，其中个人聊天 830、组合聊天 97、电话 342；1,268 条能关联本地编译文件。

## 个人故事结构

| Masterdata 表 | 实体 | 数量 | 主要字段 |
| ---: | --- | ---: | --- |
| 7 | `IdolStoryChapterData` | 49 | 偶像、名称、开放时间、资源前缀、BGM |
| 8 | `IdolStorySectionData` | 78 | 第几话、正式标题、代表背景、开放条件、奖励组 |
| 9 | `IdolStoryEpisodeData` | 491 | SMALL TALK / Episode、资源 ID、顺序、前置 Episode、角色组 |
| 68 | `IdolStoryProductData` | 39 | 奖励类型、数量、排序 |

现有 `story_master_index.idol_story` 只保存了表 8/9 的平面记录，没有正式保留表 7 的偶像章节实体、奖励表和完整分层。新索引补齐了这部分。

Wiki 记载第 1 话由 5 个 Episode 构成；第 2 话由“组合成员数个 SMALL TALK + 5 个 Episode + 来电”构成。本地冬马记录与此一致：

- 第 1 话「頼れる大人」：5 个 Episode；
- 第 2 话「世界にひとつだけのバースデーカレー」：3 个 SMALL TALK + 5 个 Episode；
- 来电「進化し続ける3人」独立存在于电话表，开放条件为完成 `IdolStoryEpisode 2010208`。

因此来电应该作为故事详情页的“解锁后通信”显示，不应伪装成第 2 话内部的第 9 个播放文件。

奖励组 1 的本地记录为 `ProductType=2, Amount=10`，与 Wiki 的每个 Episode 星宝石 10 个相符。当前没有在 schema 中恢复 `ProductType` 枚举名称，所以规范索引保留原始数值，不把外部名称伪装成 masterdata 字段。

## Mobile 结构

| Masterdata 表 | 实体 | 数量 | 用途 |
| ---: | --- | ---: | --- |
| 32 | `IdolTalkScenarioData` | 830 | 个人聊天；任务、卡片获得/特训/突破通信 |
| 34 | `IdolUnitTalkScenarioData` | 97 | 组合任务与成员生日聊天 |
| 36 | `IdolGroupTalkScenarioData` | 0 | 临时群组聊天，本版本无静态实例 |
| 43 | `IdolPhoneScenarioData` | 342 | 个人故事与卡片衍生电话 |
| 44 | `MobilePriorityData` | 1,269 | 通信优先级 |
| 63 | `MobileScenarioGroupData` | 1,269 | 场景类型、开放顺序、有效期、条件组 |
| 94 | `IdolMobileData` | 49 | 个人房间、签名、背景、图标、颜色 |
| 96 | `IdolUnitMobileData` | 16 | 组合房间和视觉资源 |
| 98 | `IdolGroupMobileData` | 3 | 公共/支援角色群组房间 |
| 103 | `TalkRoomData` | 49 | 个人随机 Talk 房间与权重 |
| 104 | `ChatTopicData` | 245 | 随机话题、时间窗、间隔和开场权重 |
| 105 | `ChatIntroData` | 343 | 按时间变化的开场和加入概率 |
| 106 | `ChatSegmentData` | 11 | 随机 Talk 时间分段 |
| 180 | `MobileReleaseConditionData` | 1,269 | 正式开放条件及参数 |

旧 `home_interaction_index` 曾把表 32/34 整体暂标为 `card_link_talk` / `birthday_unlock`。这两个描述只覆盖了表中部分实例：表 32 同时包含常驻任务、SR/SSR 卡片通信，表 34 同时包含组合任务和生日通信。本轮已改成 `idol_talk_scenario` / `idol_unit_talk_scenario`。

## 条件反查

本地条件分布：

| 条件类型 | 规范语义 | 数量 | 参数 |
| ---: | --- | ---: | --- |
| 1 | 默认或仅受有效期控制 | 49 | 无 |
| 2 | 场景标题本身描述任务 | 391 | 无 |
| 203 | 完成指定个人故事 Episode | 29 | Episode ID |
| 1602 | 获得指定卡片 | 124 | Card ID |
| 1603 | 指定卡片特训/觉醒 | 338 | Card ID、阶段 1 |
| 1604 | 指定卡片突破 | 338 | Card ID、突破次数 4 |

冬马 Wiki 中列出的累计工作 3/5 次、编成 Live 50/100 次、信赖度 25/50 等条件，均能从表 32 的正式标题直接恢复。本地还多出信赖度 100，以及所有 SR/SSR 卡片通信的卡 ID 和开放阶段。

Jupiter Wiki 样本也能直接复现：

- 「BRAND NEW FIELD」累计 500 万 / 1,500 万分；
- Jupiter 成员合计粉丝数 3 万；
- 冬马、翔太、北斗的 2022 生日组合聊天和一天有效期。

## 随机 Mobile Talk

Wiki 提到个人随机聊天会随时间改变开场。本地表 103-106 可以进一步恢复：

- 每个偶像的 5 个随机话题；
- 话题权重和重复间隔；
- 16 个开场槽位的权重；
- 早晨、白天、夜间等开放时间窗；
- 开场角色加入概率。

这些记录使用 `8_1_2_xxx` 脚本前缀，与正式任务聊天 `8_1_1_xxx` 是不同机制。UI 应把它们作为“随机 Talk 档案”单列，不能混进任务解锁列表。

## 本地缺口

唯一未关联到 compiled 文件的 Mobile 记录是：

- W / 蒼井享介 2022 生日组合聊天；
- masterdata 资源前缀：`8_2_2_013`；
- masterdata 仍保留标题、有效期、房间和条件，但当前 raw/compiled 归档没有对应脚本。

这应标记为“metadata-only / 本地脚本缺失”，不能删除该记录，也不能拿悠介或其他生日脚本替代。

## 不能由静态包恢复的内容

IL2CPP schema 中存在 `UserIdolTalkScenarioData`、`UserIdolUnitTalkScenarioData`、`UserIdolPhoneScenarioData` 和 `UserIdolStoryEpisodeData`，其中包含：

- `ReleasedAt` / `ReceivedAt`；
- `StartedAt` / `FinishedAt` / `ReadCount`；
- `IsFavorite` / `FavoredAt`；
- 玩家实际选择记录。

这些是账号服务状态。当前设备 Container 没有完整保存对应服务响应，所以档案库可以重建“理论开放条件”，但不能声称恢复了某个玩家当年的已读、收藏或实际解锁时间。

## 页面建设建议

### 偶像个人故事

1. 入口按偶像展示第 1 / 第 2 话，强调正式 `ScenarioTitle`、代表背景和开放日期。
2. 详情页把 SMALL TALK 与 Episode 保持原顺序，并显示连续开放关系。
3. 完成条件指向电话时，在末尾显示“解锁后通信”，跳到 Mobile 电话详情。
4. 奖励只展示本地可证明的类型数值和数量；补上枚举名称后再切换正式图标。

### Mobile

1. 一级切换个人、组合、电话、随机 Talk。
2. 个人与组合页面使用表 94/96 的正式背景、图标和颜色，不复刻 Wiki 表格皮肤。
3. 任务标题直接作为开放条件文案；卡片条件同时链接对应卡片详情。
4. 生日等限时通信显示原始有效期；服务器关闭后的档案可播放不等于“当年账号已解锁”。
5. 脚本缺失记录仍进入目录，但播放按钮禁用并显示 metadata-only 状态。

## 验证与生成

只生成本轮索引：

```powershell
python ..\data_pipeline\masterdata_extract.py <client_master_data> `
  --out-dir .analysis\masterdata `
  --public-out-dir public\data\masterdata `
  --compiled-dir public\data\compiled `
  --idol-communication-only
```

验证：

```powershell
npm run verify:idol-communication
```

前端通过 `loadIdolCommunicationData()` 按需加载两个索引，避免所有页面默认承担约 5 MB 的 Mobile/个人故事数据。
