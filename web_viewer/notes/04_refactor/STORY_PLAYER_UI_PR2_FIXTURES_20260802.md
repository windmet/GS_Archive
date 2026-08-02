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

无 charaId 且非偶像 speaker 的 talk step 走中性 fallback。corpus 中
`step.chara_id` 缺失 + `IDOL_NAME_TO_ID` 解析失败时，背景/头像使用中性
占位，不破图。

## 3. 现状核对结论（改造前）

- MobileUI：unit 背景已实现；缺组合色顶栏、typing indicator、P 消息当前
  用 `#22c55e`（将改 `#167A43`）、无响应式倾斜构图；
- CallUI：chara bg + 手机内 choice（将移到设备外 rail）；
- ChoiceUI：通用弹层，不区分 Stage/Mobile。
