# 卡池与卡片关联证据 - 2026-07-14

## 结论

卡池、活动剧情和卡片小剧情是三条独立关系。当前卡池关联使用 decoded `client_master_data` 中的两个原始信号交叉确认：

```text
card.limitbreak_item_id exists
card.release_at == gasha_announcement.start_at
```

关系类型为 `limitbreak_item_and_exact_gasha_start_timestamp`。只使用发布时间会把同期活动卡和共通系列卡误收进卡池，因此 `LimitbreakItemId` 是必要的推导条件，但它不是卡池外键。

## 原始字段

卡片来自顶层表 1：

- field 1：`card_id`
- field 14：`resource_id`
- field 18：`release_at`
- field 23：`LimitbreakItemId`，当前索引名为 `limitbreak_item_id`

字段名由 IPA 内 IL2CPP v27 `global-metadata.dat` 的 `CardData` protobuf 常量确认。其常量值为 23；字段值 `10501` 至 `10505` 对应卡片所使用的突破道具。该字段可区分同期卡池卡与多数活动报酬卡，但不能单独证明卡池归属。

卡池公告来自顶层表 173：

- field 1：`announcement_id`
- field 3：开放与结束时间
- field 4：`destination_id`
- field 5：banner 资源前缀
- field 6：公告类型

表 173 共提取 61 条带 `announce_gasha_` 的公告，输出到 `public/data/masterdata/gasha_announcement_index.json`。

## 名称边界

当前 `client_master_data` 没有发现卡池名称文本。以 `10028` 为例，masterdata 只保存：

```text
announcement_id: 210028
destination_id: 710028
asset_prefix: image_home_announce_gasha_10028_
start_at: 1655618400
end_at: 1656482400
```

「夏の夜を彩るキャンドルナイトガシャ」直接烘焙在 banner 图片中，不在表 173 的字符串字段里。客户端类型中存在 `GashaData_GeneratedProtobuf` 和 `GashaServiceData_GeneratedProtobuf`，但本地 client master 快照中未发现以 `710028` 为键、同时带名称与卡片清单的记录；该部分可能由运营服务接口下发。

卡池名称使用独立确认表补录，不改写 raw 提取结果。`10028` 的名称由用户在 2026-07-14 通过外部 wiki 核对，并与本地 banner 文字一致。未确认名称的条目回退显示内部编号。

## 关键样本

### ガシャ 10028

开放时间：2022-06-19 15:00 JST。

`LimitbreakItemId` 与开放时间共同筛出：

- `003hok_r02`
- `045sor_sr05`
- `035mco_ssr02`
- `040ren_ssr02`

本地 `image_home_announce_gasha_10028_01.png` 展示的 pickup 与上述集合一致。因此 `040ren_ssr02` 属于「夏の夜を彩るキャンドルナイトガシャ」，不属于同期 FRAME 活动剧情。

### ガシャ 10042

发布时间相同的非活动卡有 6 张，但 `LimitbreakItemId` 只筛出 banner pickup：

- `006tsu_sr05`
- `005kao_ssr02`
- `031sak_ssr02`

这说明“同期剩余卡”仍然过宽，不能替代 `LimitbreakItemId` 条件。

## 与活动关联的优先级

活动卡关系仍要求发布时间与活动发布时间一致，且卡片角色出现在 compiled 活动阵容中；在此基础上必须排除已经获得卡池关系的卡片。

该优先级纠正了两个冲突样本：

- `008rei_r02`
- `036rui_sr05`

两张卡的角色都出现在同期活动阵容中，但突破道具字段与卡池开放时间共同提供了更强的卡池推导证据。

## 当前验证

- 卡池公告：61 条。
- 卡池关联卡：336 张，验证 `336 / 336`。
- 活动关联卡：由 120 张修正为 118 张，验证 `118 / 118`。
- 组合活动：`36 / 36`。
- 卡片小剧情：`313 / 313`。
- 共通系列：`8 / 8`。

前端新增 `relation_state=gasha_card`，卡片详情显示卡池名称或内部编号、字段证据与开放时间。活动按钮只对真正的活动关联卡出现。

## 后续方向

1. 从本地 banner 批量建立卡池名称确认表，可采用 OCR 后人工复核。
2. 若找到服务端 `GashaServiceData` 响应归档，优先提取显式名称、pickup 卡片外键和概率组，替换名称补录层。
3. 卡池详情页应以公告、pickup 卡、开放区间和 banner 为主体；不要与活动剧情详情合并。
4. 任何仅由时间碰撞得到的候选关系继续留在排查报告中，不进入正式导航。
