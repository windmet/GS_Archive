# 称号反查第二轮：原生枚举与任务解锁引用

输入 HEAD：`5dccb508`。延续第一轮 `d3880d7d` 的离线反查，不改另一窗口的前端显示、公开数据或 readmodel 版本。第一轮目录仍为 1,613 称号、886 已知来源、727 unknown；本轮没有新增可证明的称号获取来源。

## 新的直接证据

读取现有 `.analysis/sidem_ios_keyfiles/global-metadata.dat`，SHA256 `658f966af11aef965b541e093889056cafa61a7f7fcd4bbf38e1ca2eab6d6e00`。该哈希与全 protobuf schema 的 source 绑定一致。通过 v27 type definitions、nested types 和 field default values 解析 10 个具名枚举、139 个成员；每个成员保留字段 index/token、默认值文件位置和原始四字节。

默认值类型 index `30716` 由元数据 `System.Int32` 定义核对。常量字段的 enum type index 与默认值的基础 Int32 type index 不相等是正常结构，不能把它们强行当同一个类型。嵌套类型名按 nested-types 表重建，没有把空 namespace 的 `Type`、`MissionType` 拼到猜测的父类上。

| 原生声明 | 已确认数值 | 反查用途与边界 |
| --- | --- | --- |
| `Growing.Models.Data.ProductType.Honor` | 6 | 验证 typed Product 的称号命名空间 |
| `ProductRouteType.Mission` | 19 | 筛选真实 ProductRoute 响应中的任务路由；ParamA/B 含义仍待证明 |
| `ProductRouteType.LoginBonus` | 21 | 登录来源的候选路由，不证明任何称号由登录获得 |
| `ProductRouteType.EventExchange` | 15 | 活动兑换候选路由，不与任务或积分奖励混用 |
| `ReleaseConditionData.Types.Type.ReleasedByMission` | 2 | 定位客户端 PB 的任务解锁引用；解锁对象不等于奖励对象 |
| `HonorData.Types.HonorType` | Normal=1、Idol=2、Event=3 | 原始称号类别，不作为获取条件 |
| `Growing.Theater.MissionTopView.MissionType` | Daily=0、Normal=1、Limited=2 | 客户端 UI 分类；不是服务请求所需任务身份 |

同时导出 `MissionTransitionType`、`MissionStatusType`、称号 `EffectType` 和 FeatureRelease 两种枚举。MissionTransitionType 是跳转页面枚举，不能用来解释任务达成触发器。原第一轮字段导出中的 CLR 类型未知边界仍保留；本轮具名 enum 声明不冒充完整字段 runtime 类型解析。

## 实际 PB 继续反查

沿已验证 compact 根表绑定及显式审计适配器，扫描 16 个含 ReleaseCondition(s) 的根模型、3,851 条记录，得到 3,851 条解锁引用。额外适配器只用于审计，未修改生产解码器。ReleaseConditionData 的字段号、字段名、backing type indices 逐项核对，未知字段、重复 singular message、重复主键和错误 wire 均拒绝。

其中 391 条为 `ReleasedByMission`，全部来自根表 `MobileReleaseConditions`（180）。这些嵌套消息的实际 presentFieldNumbers 全为 `[1]`，内容为 `{type:2}`；没有显式 ParamA 或 ParamB。

因此当前只能确认“这批手机内容使用任务解锁”。不能从行 ID、GroupId、称号名或 protobuf 缺省 0 反推出任务 ID，也不能把这 391 条填进称号获取目录。审计将它们标为 `release-reference-only-not-honor-acquisition`，并保存原根记录和嵌套条件的 SHA256、topOffset、fieldOffset 与 ordinal。

## 本地历史响应查找

检查 `E:/BaiduNetdiskDownload/SideM/サイスタ - 副本/Container`：25 个文件，Documents 下 12 个文件；按常见抓包扩展名和 mission/productroute/response 文件名匹配，未找到候选。该结果仅证明指定容器的文件名检索，不证明所有磁盘或未命名/加密内容中没有响应。

HTTP 数据库 `Library/HTTPStorages/jp.co.bandainamcoent.BNEI0395/httpstorages.sqlite` 为 16,384 字节，SHA256 `9ac743cb5cbca439d92017a4a1ce7f60f0f169a75472e59dc7d160005854875d`。WAL 为 0 字节；通过只读 immutable SQLite 读取 schema，只有 `alt_services` 表，没有响应缓存表。本轮未读取偏好设置、用户令牌、网络 host 值或 Firebase 消息内容。若 WAL 非空，工具明确标为需要快照检查，不能忽略它后宣称数据库中没有响应。

还检查了已有解包资产的名称清单：`MissionData_GeneratedGameDb` 等命中是 MonoScript 类型标识，不是实际任务奖励数据；未把类名命中升级为来源证明。

## 产物与复现

新增工具：[scan-honor-native-evidence.py](../scripts/scan-honor-native-evidence.py)。新增回归：[verify-honor-native-evidence.py](../scripts/verify-honor-native-evidence.py)。输出仍在第一轮固定 `.analysis/honor-acquisition-v1/` 审计目录，不复制媒体、不创建新的全量构建树。

- `native_enum_catalog.json`：10 个枚举、139 个常量及逐项原始证据。
- `mission_release_reference_queue.json`：全部 3,851 条解锁引用与 391 条任务相关引用；参数缺失保持缺失。
- `local_response_search_receipt.json`：指定容器的检索范围与只读数据库检查。

```powershell
python scripts/scan-honor-native-evidence.py --container 'E:\BaiduNetdiskDownload\SideM\サイスタ - 副本\Container'
python scripts/verify-honor-native-evidence.py
python scripts/verify-honor-acquisition.py
```

6 项原生证据回归与第一轮 8 项来源回归通过。覆盖枚举成员和真实文件字节、源哈希拒绝、PB 根/嵌套位置与哈希、391 条缺参数边界、未知字段/重复 singular/缺失或重复身份拒绝、SQLite 原文件保持及非空 WAL 边界。文档链接和 `git diff --check` 通过。本批为独立 Python 审计，不需要 Vite 或 Browser 验收，无发布结论。

下一步仍是定位真实 `Mission*ListReply` 或 `ProductRouteReply` 响应存档。现在可使用原生 `Honor=6` 和 `Mission route=19` 做精确筛选；路由参数、任务身份、条件文本和奖励连接必须由实际载荷证明。已询问用户是否另有响应备份路径；收到路径后继续离线解析。当前称号获取源仍未补齐，goal 保持进行中。
