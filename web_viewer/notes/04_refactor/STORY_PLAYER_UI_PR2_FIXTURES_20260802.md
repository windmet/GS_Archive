# Story Player UI PR2：通信场景 fixture 清单（2026-08-02）

本文是 UI PR 2（手机剧情呈现与上下文选择）的 fixture 建档，按
`STORY_PLAYER_UI_REBUILD_NEXT_WINDOW_HANDOFF_20260802.md` §9 要求，
在开工前建立。所有 URL 以 5174 dev server 为准，deep link 参数沿用
交接文档 §9 锚点格式（`view=player&story_type=...&scenario=...`）。

## 1. corpus 已核事实（2026-08-02 扫描 `public/data/compiled/`）

| 事实 | 结论 | 影响 |
| --- | --- | --- |
| talk/call/choice step shape | `{step_id, type, state, chara_id, dialogue}`；call 无 image/still/photo 字段 | Call 回退链最终落点 = 角色 mobile bg / 中性占位 |
| `state.talk_mode` / `state.phone_mode` | talk step `talk_mode:true`；call step `phone_mode:true`；choice 继承通信 state | 权威模式信号，非仅靠 `type` |
| stamp | `step.stamp = {id:"image_mobile_stamp_<chara>_<n>", raw_id, speaker, chara_id}`，88 个场景 | stamp 渲染读 `step.stamp.id` |
| emoji | `<emoji>xxx</emoji>` 行内标记，256 个文件 / 857 处 | 行内 emoji 解析保留 |
| choice options | `{label, text, detail, step_id}`，最多 3 个 | 无 4+ 选项 corpus；4+ 布局仅防御性 |
| 群聊 | `8_2_x_<unit>_8_2_1_<n>.json` 共 32 文件，16 个含 talk | `scenarioId.startsWith('8_2_')` 作为 group-talk 信号成立 |
| 个人 Talk | 每个偶像 `<chara>_30x_2_3_..._09_[ab].json`，均为 solo | 09 系列 = 手机通信番外 |
| 背景契约 | 现状 Talk→unit bg、Call→chara bg，与 §5.2.2 修订解析一致 | 保留现状，新增显式 state 信号分支 |

## 2. fixture 清单

### 2.1 个人 Talk（组合背景 + 组合色顶栏）

| 组合 | 成员场景 | 预期视觉 |
| --- | --- | --- |
| FRAME 06fra | `016sei_301_2_3_016_01_09_a.json` | FRAME 组合背景 + 绿色顶栏 |
| FRAME 06fra | `014hid_301_2_3_014_01_09_a.json` | 同上 |
| THE 虎牙道 13the | `038tak_301_2_3_038_01_09_a.json` | THE 深色背景 + 深色顶栏 |
| C.FIRST 16cfi | `048mom_301_2_3_048_01_09_a.json` | C.FIRST 背景 + 青色顶栏 |

自然入口：story_catalog → 各偶像 story collection → 番外话。
deep link（示例）：
`?view=player&story_type=idol_story&story_section=016&scenario=016sei_301_2_3_016_01_09_a.json&start_step=2&end_step=12&return=story_collection`

卡片条件语义 fixture：`038tak_301_2_3_038_01_09_a.json` 必须显示
`【燃え盛る蒼き闘志】 突破 4 次`，并可进入卡片 `1338001` 资料页；
同卡 `09_b` 是 `card_awakened`（特训完成），不可与 `09_a` 对调。映射来自
`mobile_archive_index.json` 的表 32/63/180 派生链，卡名来自 `card_index.json`。

### 2.2 组合群聊

| 场景 | 预期视觉 |
| --- | --- |
| `8_2_x_006fra_8_2_1_006.json`（FRAME 群聊，talk:28 choice:3） | FRAME 组合背景 + 组合名顶栏 |
| `8_2_x_013the_8_2_1_013.json`（THE 群聊） | THE 背景 + 组合名顶栏 |

deep link：`?view=player&story_type=unit_story&scenario=8_2_x_006fra_8_2_1_006.json&start_step=1&end_step=30&return=story_collection`

### 2.3 Talk → Choice → 制作人回复

| 场景 | 验证点 |
| --- | --- |
| `001tom_301_2_3_001_01_09_a.json`（talk:9 choice:1） | 选择后 P 消息注入右侧绿色气泡 |
| `001tom_303_2_3_001_03_09_b.json`（talk:11 choice:2） | 连续两次 choice 的注入顺序 |

### 2.4 Stamp / Emoji

| 场景 | 验证点 |
| --- | --- |
| `001tom_301_2_3_001_01_09_b.json`（talk_stamp:1） | 透明 stamp 不塞进白气泡 |
| `002sht_301_2_3_002_01_09_a.json`（emoji） | 行内 emoji 不撑大行高 |

### 2.5 Call → Choice → 屏外回复

| 场景 | 验证点 |
| --- | --- |
| `001tom_307_2_3_001_07_09_a.json`（call:8 choice:1） | Call 场景在 choice 时保持连续，选项在设备外 |
| `001tom_312_2_3_001_12_09_a.json`（stage:2 call:9 choice:2） | stage+call 混合 + 连续 choice |

个人故事条件语义 fixture：`1_x_038tak_2_1_2_038_22_t01.json` 必须显示
`「誰がための誕生日パーティ」エピソード5 完成`。其
`release_condition.param_a = 2380208`，点击后进入大河タケル个人故事的
`story_section=23802&episode=2380208`，并高亮对应章节与分段；浏览器 Back
返回原 Mobile 通信列表。

deep link：`?view=player&story_type=main&scenario=001tom_307_2_3_001_07_09_a.json&start_step=1&end_step=10&return=story_collection`

### 2.6 3 选项 Choice

| 场景 | 验证点 |
| --- | --- |
| `039mcr_301_2_3_039_01_09_b.json`（choice 3 options） | 三气泡紧凑排布不溢出 |

### 2.7 直接 choice 深链

`?view=player&story_type=idol_story&scenario=001tom_301_2_3_001_01_09_b.json&start_step=9&end_step=12&return=story_collection`
（start_step=9 为 choice step，step_id=9）

### 2.8 goPrev / Backlog restore

从 §2.1/§2.3 场景 goPrev 至 choice 前、Backlog restore 到 talk 中段，通信上下文必须一致（unit/顶栏不变）。

### 2.9 NPC / 缺图

未知或缺失的角色资源走中性 fallback，头像、stamp、行内 emoji 都不得出现
浏览器破图图标。corpus 中唯一缺少个人头像文件的引用是 `001jup`；它不是
未知 NPC，而是 Jupiter 组合代码。fixture
`1_x_001tom_8_2_2_001_01.json` 必须从 scenario authority 恢复
`primaryCharaId=001tom`、保留 `unitCode=01jup`，并按冬马消息而非制作人回复
呈现。

## 3. 现状核对结论（改造前）

- MobileUI：unit 背景已实现；缺组合色顶栏、typing indicator、P 消息当前
  用 `#22c55e`（将改 `#167A43`）、无响应式倾斜构图；
- CallUI：chara bg + 手机内 choice（将移到设备外 rail）；
- ChoiceUI：通用弹层，不区分 Stage/Mobile。

## 4. UI PR2 浏览器验收记录（2026-08-02）

以下均在 5174 当前 checkout 实际执行，使用 `noAudio=1`；不是只读 source/CSS
推断。

| 项目 | fixture / 结果 |
| --- | --- |
| FRAME 个人 Talk | `016sei_301_2_3_016_01_09_a.json`：`06fra` 背景，`#087A2C → #00C814` 顶栏 |
| THE 虎牙道个人 Talk | `038tak_301_2_3_038_01_09_a.json`：`13the` 背景，`#242843` 顶栏 |
| C.FIRST 个人 Talk | `048mom_301_2_3_048_01_09_a.json`：`16cfi` 背景，`#007C73 → #00C7B7` 顶栏 |
| FRAME 群聊 | `8_2_x_006fra_8_2_1_006.json`：标题 `FRAME`，组合背景与主题色一致 |
| unit-coded speaker | `1_x_001tom_8_2_2_001_01.json`：`001jup` 恢复为 `001tom`，冬马头像 160px 原图，`row-idol` |
| emoji | `002sht_301_2_3_002_01_09_a.json`：`image_talk_emoji_05` 原图 160px，渲染高约 15.8px，小于 22px 行高 |
| stamp 完成态 | `001tom_301_2_3_001_01_09_b.json`：236×160 原图；完成后仍显示，Next disabled，非阻断完成提示 |
| 双语 Talk | `fixtures/story_localization_stress.json` step 6：JP/zh-CN 独立 DOM，390px 消息框自然增高，无横向溢出 |
| 双语 Mobile Choice | 同 fixture step 8：JP/zh-CN 独立 DOM，选项高约 78px，rail `scrollWidth = clientWidth = 362px` |
| goPrev 上下文恢复 | `001tom_301_2_3_001_01_09_a.json` 选择制作人回复后退回 step 4：冬马身份、Jupiter 语境与已选回复均保留 |
| Backlog restore | 同 fixture 从 step 4 的 Story Log 恢复到 step 2：返回 Talk，进度为 `2 / 11`，URL 的 `start_step=1&end_step=11` 不变 |
| Call choice 深链 | `001tom_307_2_3_001_07_09_a.json&start_step=8&end_step=10`：初始 `1 / 3`，选项在设备外；选择后冬马来电与制作人回复在设备内连续呈现 |

三选项 fixture `039mcr_301_2_3_039_01_09_b.json` 在以下视口均无 body
横向溢出，rail 的 `scrollWidth === clientWidth`：

- `1650×900`
- `1366×768`
- `1024×768`
- `390×844`

资源覆盖审计：compiled corpus 引用 14 个 stamp、38 个 emoji，全部有本地 PNG；
52 个 talk `chara_id` 中唯一没有个人头像文件的是组合代码 `001jup`，已按上文
恢复到冬马身份。未知头像、stamp、emoji 和 Call portrait 均有 `error` 回退，
不显示浏览器破图。

本轮没有修改运行时分支、音频、publication 或真实用户解锁状态。P2-B 2–4 小时
长稳仍为 **NOT EXECUTED**。
