# 称号获取反查：第一轮离线关键词与来源链

输入 HEAD：`3f09739e`，分支 `codex/story-interaction-v2-before-b002`。用户授权读取指导包并开始称号解析、反查链路和关键词抓取；同工作区另一窗口继续前端调试。本批只新增独立审计脚本、回归和本记录，未改前端、公开目录、readmodel 白名单或版本。

## 指导包与本轮范围

指导包：`D:/Files/Downloads/Honor_Acquisition_Graph_Guide_v1.zip`，SHA256 `0f947223218a820286ae73f5aefc177ba6b6650a791b13e3d291f345eccf3681`。已直接读取全部五个 Markdown，没有把包覆盖安装到工作区。

包提出 Honor → Reward/Product → Mission/Event/Login/Achievement、导出相关 protobuf 模型、记录字段号/类型/引用、保留原 ranking、无歧义奖励连接和 unknown。本轮按用户的解析任务采用这些证据要求。包内 UI 迁移是后续建议，不作为本轮改界面的授权。

## 可重现输入与产物

- decoded PB：`.analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb`，SHA256 `25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1`。异于基线时脚本拒绝继续。
- 全 schema：`../data_pipeline/schema/il2cpp_protobuf_schema.json`，SHA256 `a909b151e80c74493da5790da5d964fb3f795c79a0d1feed1f86bb8369932399`。
- compact wire schema：`../data_pipeline/schema/archive_domain_fields.v1.json`，SHA256 `e066474132fdec256a25dd906f41d27ad116b36af9575dec28a9b165f4b8f0a3`。
- 脚本：[honor-acquisition-scan.py](../scripts/honor-acquisition-scan.py)；回归：[verify-honor-acquisition.py](../scripts/verify-honor-acquisition.py)。每次产物记录生成器文件 SHA256。
- 固定审计目录：`E:/Web_build/SideM_Archived/web_viewer/.analysis/honor-acquisition-v1/`。四个 JSON 合计约 5.3 MB，不含媒体；被现有 `.gitignore` 排除，可重复生成，不作为公开数据发布。

| 产物 | 用途 |
| --- | --- |
| `honor_acquisition_catalog.json` | 1,613 个独立称号身份及来源；每个 source 含 type、sourceId、condition、rawEvidence |
| `protobuf_keyword_scan.json` | 272 个匹配模型的完整字段清单，167 个根表及实际记录数 |
| `reverse_lookup_keyword_queue.json` | 727 个未知称号的精确 ID、原名、resourceId、typed Product 条件，以及服务/字段关键词 |
| `validation_report.json` | 覆盖数量、25 个奖励相关根表的 7,775 条记录探针、哈希与 nextGate |

执行：

```powershell
python scripts/honor-acquisition-scan.py
python scripts/verify-honor-acquisition.py
python scripts/verify-archive-domains.py --decoded-masterdata .analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb
```

## 实际结果

1,613 称号中 886 个有可证实来源，727 个 unknown。848 条排名来源全部保留（456 个活动总排名、392 个偶像排名），另 38 条活动积分来源。排名源是显式 HonorId，审计明确标注为 `explicit-HonorId-not-encoded-Product`；其展示用 Product(type=6, amount=1) 是既有生产解析的投影，不伪装为原 PB 嵌套消息。38 条积分源才是实际编码 Product。

每条已知来源保留原 rewardRecord 与条件，并附奖励行、活动行、活动详情行的原始位置、记录 SHA256 和命名投影。奖励 GroupId 到详情配置的 GroupId 连接，以及情人节 EventValentineId/IdolId，均有实际 PB 回归。Product 探针独立验证所有已知引用；同数值 item ID、CostProduct 消耗、重复 singular product、重复主键、缺称号目标、额外 schema 漂移都不会生成可信获取来源。

本轮没有新增可证明的称号获取来源，也没有把称号名称、分类、开放时间或资源编号当获取条件。未知称号的名称和 resourceId 只进入检索提示。

## 已定位的反查入口

任务模型：`DailyMissionData`、`NormalMissionData`、`TimeBoundMissionData` 的 Products 是 field 8；RequiredCount 为 5、MissionCategoryId 为 2、TransitionType/TransitionParamA 为 6/7。`PanelMissionData.Product` 为 6，`PanelMissionPanelData.Product` 为 4，并有 PanelMissionGroupId 为 3。

服务关键词：`MissionDailyMissionListReply`、`MissionNormalMissionListArgs/Reply`、`MissionTimeBoundMissionListArgs/Reply`、`MissionEventTimeBoundMissionListArgs/Reply`、`MissionReceivePanelMissionProductsReply`。其中事件限时任务 Args.EventId 为 field 1，须用真实响应证明活动身份，不能从称号名或日期猜。

另一路是 `ProductRouteArgs.Products` field 3 → `ProductRouteReply.ProductWithRoute` field 2 → `ProductWithRouteData.Product` field 1 / ProductRoutes field 2 → `ProductRouteData.Type/ParamA/ParamB/Name/ResourceId/Term` fields 1–6。它是 schema 定位到的候选反查协议；尚无真实响应，不能据此新增来源。

任务定义和任务列表回复模型存在，但 Masterdata 根表只有 MissionCategories（4 行），没有 Daily/Normal/TimeBound/PanelMission 定义表。SongRewards 扫描 216 行，未见称号 Product；ContinuousLoginBonusProducts 为 0 行。既有 LoginBonusProducts/CampaignLoginBonusProducts 亦未见称号 Product。不要因为登录或任务 schema 存在就宣称称号从那里取得。

按模型名或字段名匹配：Mission 123、Reward 23、Product 119、Honor 10、Login 23、ReleaseCondition 26、Exchange 46，模型可能重复匹配。Achievement/Unlock 字面匹配均为 0；这只是当前抽取 schema 的检索结果，不能证明游戏没有成就或解锁机制。`AchievedMissionData` 表示任务达成结构，不改称 Achievement 来源。

字段类型边界：现有全 schema 给的是 backing_type_index，并未解析为 CLR 类型名。导出同时保留该索引、已有 compact wire rule、相同 backing 索引的 wire 候选及引用依据；CLR type 明确 null。索引相同只用于候选定位，不能冒充已验证业务枚举含义。

## 验收和下一步

新增 8 项回归通过；既有 archive domains 14 项回归及实际 PB 生成通过，仍为 535 道具、1,613 称号、59 活动、7,943 奖励链接。原来源条件、PB 位置/哈希、typed Product 命名空间、消耗与奖励方向、缺失和歧义拒绝均覆盖。`git diff --check` 通过。本批是独立 Python 工具和离线审计，不触发 Vite 构建或 Browser 验收，也无部署结论。

nextGate：取得本地历史 `Mission*ListReply` 或 `ProductRouteReply` 真实响应，确认载荷版本和来源，解析嵌套模型，证明 Product.type=6、ProductId、条件、唯一 source 身份。当前没有这些响应证据；目录仍为候选，publicationReady=false。关键词队列可供后续检索，不触发在线接口调用，也不读取凭据。
