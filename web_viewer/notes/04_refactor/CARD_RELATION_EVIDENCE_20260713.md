# 卡片小剧情与共通系列关联证据 - 2026-07-13

## 结论

卡片出卡批次、活动剧情、卡片小剧情是三个独立概念。不得用发布时间相等推导卡片属于某个活动剧情。

当前只保留两类可回溯关系：

1. `scenario_entries`：卡片自身直接关联的小剧情或电话。
2. `release_series`：标题和发布时间完全一致的共通卡片系列。

已撤销 `release_event`。例如 `040ren_ssr02` 与 `GROWING SELECTION -Swing Your Leaves-` 仅发布时间相等，不能因此关联；该卡真正可用的剧情关系是自身的 `2_4_040_02_09_a` 与 `2_4_040_02_09_b`。

## 原始字段

卡片来自 decoded `client_master_data` 顶层表 1：

- field 1：`card_id`
- field 14：`resource_id`
- field 18：`release_at`
- field 40：`title`

卡片小剧情来自顶层表 43：

- field 1：剧情关系行 ID
- field 3：标题
- field 4：剧情资源 ID

## 关系模型

### `scenario_entries`

卡片小剧情使用原始行 ID 中的卡片 ID 建立直接关系：

```text
scenario_row.field_1 // 100 == card.field_1
```

这条关系可以驱动详情页的小剧情入口。它不经过活动表，也不表示活动共通剧情。

### `release_series`

至少两张不同 `resource_id` 的卡同时满足以下条件时，归入同一共通系列：

```text
card_a.release_at == card_b.release_at
card_a.title == card_b.title
```

关系类型为 `exact_release_timestamp_and_title`。`series_id` 由发布时间和标题 SHA-1 摘要组成，不依赖数组顺序。

该规则正确覆盖 `PASSION FESTIVAL`、`NEXT DESTIN@TION!`、`Take a Stump!`、`315!!!SHOP`、`超常事変` 等单卡面系列。系列归类只说明同批同标题，不自动产生剧情关系。

## 当前结果

正式卡优先消除 10 个教程占位碰撞后，共有 826 张唯一卡片：

- 177 张卡有直接卡片小剧情，共 313 条，资源验证 313 / 313 通过。
- 389 张卡归入 8 个共通系列，系列一致性验证 8 / 8 通过。
- 8 个全员共通系列当前均没有 `scenario_entries`；这与系列归类不冲突。

| 系列 | 卡片 | 偶像 |
| --- | ---: | ---: |
| スタートライン | 49 | 49 |
| GROWING STARS | 49 | 49 |
| NEXT DESTIN@TION! | 49 | 49 |
| PASSION FESTIVAL | 49 | 49 |
| 315!!!SHOP | 49 | 49 |
| Take a Stump! | 49 | 49 |
| 超常事変 | 49 | 49 |
| グローリーモノクローム | 46 | 46 |

## 前端行为

- 卡片目录的 `relation_state` 支持：全部关联、有卡片小剧情、共通系列、暂无直接关联。
- 卡片详情中的小剧情入口只读取 `scenario_entries`。
- 共通系列显示同批卡片横向列表，可跨偶像进入卡片详情。
- `超常事変` 等系列的单卡面资源规则继续独立生效。
- 不再显示或跳转任何由发布时间碰撞生成的活动剧情入口。

## 排查边界

- 活动故事类别中不存在可泛化为所有同期卡片的“共通剧情”。
- 发布时间只能作为候选线索，不能单独作为剧情外键。
- 后续若要建立活动奖励、卡池或 FES 分类，应继续审计奖励表、gasha 表或明确的 card foreign key，并新增独立关系类型。
- 没有 `scenario_entries` 不代表卡片没有主题，只表示当前主数据没有直接卡片小剧情关系。
