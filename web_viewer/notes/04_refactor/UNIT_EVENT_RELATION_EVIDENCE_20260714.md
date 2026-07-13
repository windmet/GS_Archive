# 组合活动关系与活动类型证据 - 2026-07-14

## 结论

活动剧情是独立的团活资料域，不从卡片发布时间、卡池或 FES 卡片关系反推。当前 36 个活动按以下三类组织：

- 固定组合团活：31 个。
- 属性团曲活动：3 个。
- 跨组合团活：2 个。

FES 卡片小剧情继续只使用卡片自身的 `scenario_entries`。`extra` 继续表示 story master 的额外剧情资料域，与上述活动分类无关。

## 固定组合团活

固定组合关系必须满足：活动 compiled summary 中出现的 49 名正式偶像阵容，与现有组合成员集合完全一致。`mob` 等非正式角色不参与集合比较。

```text
event.compiled_characters == unit.members
```

验证结果：

- `GROWING SIGN@L`：16 个固定组合各 1 个，共 16 个。
- `GROWING SELECTION`：15 个固定组合各 1 个，共 15 个。
- `C.FIRST` 当前只有可验证的 `SIGN@L -Not Alone-`，没有固定组合 `SELECTION` 条目。

例如 `GROWING SELECTION -Swing Your Leaves-` 的 compiled 阵容是 FRAME 三人，因此归入 FRAME。该关系不延伸到同发布时间卡片。

## 属性团曲活动

以下分类由用户于 2026-07-14 根据原游戏活动语义确认，并与 compiled 阵容逐人核对：

| 活动 | 属性 | 阵容 |
| --- | --- | --- |
| `GROWING SELECTION -ANYWHERE-` | INTELLIGENCE | 北斗、薫、享介、次郎、雨彦 |
| `GROWING SELECTION -RED HOT BEAT!!-` | PHYSICAL | みのり、龍、隼人、朱雀、鋭心 |
| `GROWING SELECTION -リトルハピネス-` | MENTAL | 翔太、九郎、春名、巻緒、類 |

这些活动没有包含任何固定组合全员，因此不归入某个固定组合团活；组合详情只显示本组合成员的出演关系。

## 跨组合团活

| 活动 | 阵容 |
| --- | --- |
| `GROWING SIGN@L -FLASH LIGHT-` | 圭、恭二、夏来、百々人 |
| `GROWING SIGN@L -precious love-` | 四季、直央、漣、クリス |

两者均为纯跨组合阵容，不带属性分类，也不归属某个固定组合。

## 生成数据

`public/data/archive_manifest.json` 新增：

- `coverage.unit_events`
- `unit_event_relations[]`
- `unit_event_relations_by_unit`

每条关系记录活动 ID、标题、系列、compiled 文件、正式偶像阵容、参与组合、活动类型、属性和分类来源。固定组合关系使用 `exact_compiled_character_roster`；属性/混团分类使用 `confirmed_cross_unit_event_classification`。

`npm run verify:archive` 会从 story master 与 compiled summary 重新计算阵容、参与组合和文件关系。当前 36 / 36 通过。

## 前端行为

- 故事目录在活动资料域提供 `固定组合团活 / 属性团曲 / 跨组合团活` URL 筛选。
- URL 参数为 `event_scope=fixed_unit_event|attribute_event|mixed_unit_event`。
- 活动列表以活动名为主标题，剧情内部标题作为副标题。
- 组合详情分别显示固定组合团活、属性团曲出演和跨组合团活出演。
- 组合详情同时展示成员卡片总数、SSR 数、有小剧情卡数和单卡面数。
- 活动和卡片入口都保留稳定返回上下文。

## 回归结果

- 活动目录数量为 31 / 3 / 2，筛选刷新后保持。
- FRAME 显示两条固定组合团活，`RED HOT BEAT!!` 位于 PHYSICAL 属性出演。
- High×Joker 同时显示 MENTAL、PHYSICAL 属性出演，以及 `FLASH LIGHT`、`precious love` 两条跨组合出演。
- `extra` 仍为 44 条独立额外剧情，不显示活动类型筛选。
- 桌面与 390×844 移动端无横向溢出，页面无控制台错误。
