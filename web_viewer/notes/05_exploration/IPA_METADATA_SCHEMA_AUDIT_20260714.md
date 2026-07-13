# IPA 元数据与内容提取审计 - 2026-07-14

## 结论

`E:\BaiduNetdiskDownload\SideM\サイスタ - 副本` 仍然是高价值参照源，但不应再把目标设成“从 IPA 直接恢复完整运营数据库”。当前最有效的用途是恢复数据字段语义、服务响应模型、资源命名和 UI 结构；实际运营期服务响应若没有留在设备缓存中，IPA 本身不能补回其中的动态值。

建议把后续逆向工作拆成两层：

1. **静态协议层**：从 IPA 的 IL2CPP 元数据恢复类、字段号、枚举和接口模型。
2. **内容实例层**：用已解码 `client_master_data`、本地资源、公告 banner 和外部可靠档案填充实际记录。

静态协议层负责告诉我们“一条记录有哪些字段”，内容实例层负责回答“这些字段当时具体是什么值”。

## 当前归档内容

IPA `サイスタ 2.6.10.ipa` 中已确认存在：

- `global-metadata.dat`：12,431,328 bytes，IL2CPP metadata version 27。
- `UnityFramework`：73,999,520 bytes，App Store FairPlay 加密仍在，不能直接依赖其代码段反汇编。
- `data.unity3d`：73,489,866 bytes，可继续用于资源类型和内置资产审计。
- Unity linker JSON：可辅助确认程序集和类型保留情况。

同目录 XAPK 中还有未加密但重度 stripped 的 Android `libil2cpp.so`。因此推荐以 iOS metadata 恢复类型，以 Android binary 补查常量和实现，不再投入主要时间尝试修补 iOS FairPlay 标记。

设备 Container 中已确认有解码后的 `client_master_data` 和少量本地状态，但 HTTP storage 没有保存可用的运营接口响应。因此卡池详情等服务下发内容不能假定仍在本地。

## 已恢复的 CardData 字段证据

通过解析 metadata header、type definitions、field definitions 和 field default values，已直接恢复 `Growing.Models.Data.CardData` 的 protobuf 字段号。与当前卡片索引相关的关键字段包括：

| 字段号 | protobuf 名称 | 当前用途 |
|---:|---|---|
| 1 | `Id` | 卡片数值 ID |
| 2 | `IdolId` | 偶像 ID |
| 3 | `CardRarityId` | 稀有度 |
| 13 | `CatchCopy` | 卡片标题原文 |
| 14 | `ResourceId` | `040ren_ssr02` 等资源 ID |
| 18 | `OpenAt` | 发布时间 |
| 19 | `VoiceText` | 特训前卡面文本 |
| 22 | `AwakenedVoiceText` | 特训后卡面文本 |
| 23 | `LimitbreakItemId` | 突破道具 ID |
| 36 | `GashaVoiceText` | 卡池演出语音文本 |
| 40 | `PlainCatchCopy` | 无括号标题 |
| 54 | `FesFlag` | FES 标记 |

这次恢复纠正了一个重要命名：此前索引将 field 23 暂称为 `gasha_pool_item_id`，现在应改为 `limitbreak_item_id`。它与唯一卡池开放时间组合时仍能稳定推导出 336 张卡池卡，但字段本身不是卡池 ID。

## 已恢复的 GashaData 字段证据

`Growing.Models.Data.GashaData` 明确包含：

- `Name`
- `SchemeName`
- `PickupCardIds`
- `GashaPlans`
- `GashaCeiling`
- `GashaDetail`
- `LogoResourceId`
- `TopResourceId`
- `HomeStoryEpisodeId`
- `CardDisplayType`
- `BgmType`
- `MovieAnnounceId`
- `CardDetails`
- `AppealResourceId`
- `GashaStep`

这证明原游戏服务模型中存在显式卡池名和 pickup 卡 ID。当前 decoded client master 的公告表只含开放区间、跳转目标和 banner 前缀，没有这些完整实例，因此缺失部分更可能来自运营接口下发，而不是我们尚未识别的公告字段。

## 可继续提取的内容

优先级从高到低：

1. 批量导出 masterdata 相关 protobuf 类的字段号和字段名，建立正式 schema dictionary，逐步替换 `field_XX` 临时命名。
2. 导出 `GashaData`、活动、剧情、卡片、服装、主页交互等服务模型，确认数据库应该保留的实体边界。
3. 从 `data.unity3d` 和 linker JSON 建立内置 UI prefab、图集、枚举及资源路径清单，为整体 UI 重构提供原始结构依据。
4. 在 Android binary 中只针对少数关键方法或枚举做定点分析，不再追求完整 dump。
5. 检查其他设备备份、代理抓包归档或旧日志是否存在 `GashaServiceData` 等响应；这类内容一旦找到，价值高于继续扫描 IPA 字符串。

## 不应期待的内容

- IPA 不等于服务端数据库快照。
- 类型中出现 `PickupCardIds` 不代表 IPA 内保存了每个卡池的 pickup 实例。
- FairPlay 加密的 iOS 可执行代码不适合作为当前主线。
- 仅凭 banner OCR 可以补名称，但它属于人工确认层，不能伪装成 masterdata 原始字段。

## 对档案库架构的影响

可以继续朝 Sekai Viewer 式档案库推进，但数据层应明确保留三种来源：

- `raw`：masterdata、资源文件和已保存响应中的直接字段。
- `derived`：由时间、角色阵容、突破道具等条件推导出的关系。
- `curated`：banner OCR、外部 wiki 和人工复核得到的名称或纠错。

前端只消费统一实体和关系，不把推导规则埋进组件。这样未来发现真实 `GashaData` 响应时，可以替换卡池关系来源而无需重做卡片页和筛选逻辑。

## 下一步执行顺序

1. 先生成 IL2CPP protobuf schema dictionary，并优先覆盖当前正在使用的 card、gasha、event、story 表。
2. 把现有卡池关系标注为 `derived`，保留规则和验证样本。
3. 批量识别 61 张卡池公告 banner 的名称，人工复核后进入 `curated` 层。
4. 再开始卡池详情页与全局 UI 重构；页面模型应基于稳定实体，而不是直接绑定未命名表号。

这条路线能让 IPA 继续产生实际收益，同时不会拖住当前档案库的内容建设。
