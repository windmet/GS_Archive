# 卡池实体、服务 Schema 与页面接入 - 2026-07-14

## 结论

本地 IPA 可以证明完整卡池实例的结构，但当前设备 Container 没有保存这些实例值。完整的 `GashaData` 由 `Growing.Services.GashaListReply` 下发；本地 `client_master_data` 表 173 只保留卡池公告、时间、跳转目标和 banner 资源前缀。

因此当前档案库采用以下证据边界：

- Raw：61 条表 173 公告与 61 张本地 banner。
- Derived：336 张由 `LimitbreakItemId + 唯一精确开放时间` 得到的卡池关联卡。
- Curated：人工核对的卡池名称，目前确认 1 条。
- Missing：服务端 `GashaData` 实例、显式 pickup 外键、概率与抽卡计划。

这套边界允许先建立卡池目录与详情页，同时为未来导入真实服务响应保留替换位置。

## Container 排查

检查范围：`E:\BaiduNetdiskDownload\SideM\サイスタ - 副本\Container`。

- `Documents/client_master_data`：有效，包含静态 masterdata 与公告表。
- `Documents/growing_local_data`：只有用户状态、教程、News 设置与剧情已读状态，没有卡池响应。
- `Library/HTTPStorages/.../httpstorages.sqlite`：只有空的 `alt_services` 表，没有 HTTP 正文或缓存记录。
- `Library/Application Support/Google/FirebaseMessaging/rmq2.sqlite`：消息表均为空。
- Preferences：只有应用参数和分析配置，没有服务响应。

结论不是“尚未认出某个 SQLite 表”，而是该 Container 没有留下可恢复的运营接口正文。继续在这份备份中扫描卡池实例的收益很低；后续应优先寻找其他设备备份、代理抓包或旧日志。

## IL2CPP Schema 字典

新增 `data_pipeline/extract_il2cpp_protobuf_schema.py`，直接解析 IL2CPP v27 `global-metadata.dat`：

- 665 个 protobuf 模型
- 3147 个字段号
- `Growing.Models.Data` 364 个模型
- `Growing.Services` 301 个模型

生成文件为 `data_pipeline/schema/il2cpp_protobuf_schema.json`。它保存模型全名、字段号、FieldNumber 常量、metadata field/type index 与 token，可重复生成，不依赖 FairPlay 加密的代码段。

### `Growing.Models.Data.GashaData`

| 字段号 | 名称 | 用途 |
| ---: | --- | --- |
| 1 | Id | 卡池实例 ID |
| 2 | Name | 正式名称 |
| 5 | Term | 开放区间 |
| 9 | PickupCardIds | 显式 pickup 卡 ID |
| 10 | GashaPlans | 抽卡计划与消耗 |
| 11 | GashaCeiling | 天井状态 |
| 13 | GashaDetail | 说明与注意事项 |
| 14 | LogoResourceId | Logo 资源 |
| 15 | TopResourceId | 顶部主视觉资源 |
| 17 | SchemeName | 方案名 |
| 18 | CardDisplayType | 卡片展示类型 |
| 19 | HomeStoryEpisodeId | 首页剧情入口 |
| 20 | BgmType | BGM 类型 |
| 21 | MovieAnnounceId | 视频公告 |
| 22 | CardDetails | 卡片展示详情 |
| 23 | GashaStep | Step 卡池配置 |
| 24 | AppealResourceId | Appeal 资源 |

`Growing.Services.GashaListReply` 的 field 1 为 `Gashas`，另外还包含历史记录、天井转换、免费活动与用户更新。这是“完整实例来自服务下发”的字段级证据。

## 规范卡池索引

新增 `gasha_index.json`：

- `gashas`：61 个规范实体。
- `by_id` / `by_code`：稳定查询索引。
- `relations_by_card` / `relations_by_gasha`：双向卡片关系。
- 每个实体保存 `banner_url`、公告时间、原始来源、名称来源与 `derived_pickup_cards`。

人工标题放在 `data_pipeline/curated/gasha_titles.json`，不写回 raw 公告。`10028` 的名称为 `夏の夜を彩るキャンドルナイトガシャ`，来源为用户提供的牙崎涟卡片 wiki 页面，并与本地 banner 一致。

## 前端结果

- 资料馆侧栏新增“卡池”。
- 卡池目录显示 61 张原始 banner、开放日期、名称状态与关联卡数量。
- 卡池详情显示公告 ID、目标 ID、开放区间、来源等级与关联卡片。
- 卡池可以进入卡片详情；卡片详情的 Pickup 区可以返回卡池详情。
- 搜索支持卡池编号、名称、卡片标题、资源 ID 与偶像名。
- URL 使用 `view=gashas` 与 `view=gasha_detail&gasha=...`，可直接分享和恢复。

当前验证结果：

- 卡池实体：61 / 61
- Banner：61 / 61
- 卡池关联卡：336 / 336
- `10028 -> 040ren_ssr02` 固定样本：通过
- 独立生产构建：通过
- 桌面浏览器目录、详情与双向导航：通过

## 下一步

1. 以卡池目录作为人工校对工作台，逐条补齐 60 个未知标题；每条必须保留 banner 或外部档案来源。
2. 先识别特殊编号 `1000011 / 1000051 / 200701 / 200721 / 300xxx` 的卡池类型，避免把复刻、庆典、免费或特殊卡池混为普通 pickup。
3. 从 schema 字典继续导出 `EventData`、Story、Costume、Home interaction 的正式字段名，逐步消除前端与提取器里的裸表号。
4. 若发现 `GashaListReply` 归档，新增 `raw_service` 导入器，用显式 `PickupCardIds` 替换 derived 关系；UI 与路由无需重做。
5. 在卡池名称覆盖率提高后，再加入年份、卡池类型、偶像、稀有度与复刻状态筛选。
