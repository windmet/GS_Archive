# 域扩展收尾：明确身份的目录与跳转

输入 HEAD fea5e28a。此阶段先提交离线 producer，以满足不可变产物必须从已提交来源生成的硬门禁；界面接线随后以实际 r3 Browser 验收单独提交。

## 离线数据连接

- 奖励卡片/卡片碎片只按 Product.productId 等于既有 canonical card_id 的唯一映射生成卡片目标；不猜 resource_id 前缀。不同 Product 类型使用不同命名空间，缺失/未知实体不产生按钮。
- 摄影 Filter/Sticker/Spot/Scene/Frame 只在对应摄影表存在相同主键时生成 typed `photo` 目标。衣装、talk 等未实现目标仍为原文本。
- 49 位偶像各8个排名称号（392个）按来源显式 IdolId 关联，不按名字归属；保留源条件中的 IdolId 并可从个人资料进入称号详情、返回个人资料。
- 49 个偶像资料页新增 photo 摘要：由 idolUnit 的数值 idol_id 和已验证 photo actor 连接，提供表情/姿势/真实去重 cue 数；不由名字推称号归属。
- 藏品薄目录追加本地图片 URL/status 和原 Name/DisplayName，详情媒体/来源不复制进全局页。
- 4 个情人节/白色情人节活动按精确 event_code 连接既有 seasonal campaign，同时校验 campaign_detail_id；复用现有阅读身份，不复制正文，不用年份猜映射。

## 界面工作范围

八类物品用途标签依据包中的原文说明整理，不是官方枚举；未知 type 进入其他/待分类。保留主键和原 ItemType/HonorType，不按同名/同资源去重。列表仅按25条分页请求图片，缺图保持图标。奖励跳转、偶像摄影入口和季节企划入口需要 r3 实际 Browser 验收后接受。

## 当前证据

离线合同覆盖唯一卡片、同ID不同摄影命名空间、缺失目标、未知状态、重复卡片拒绝；实际 corpus 覆盖535物品/1613称号、49摄影与49资料身份、奖励非空跳转和4个季节 event/detail ID。新界面生产编译9.53秒通过（未复制public），Browser最终产物验证正在进行。

未扩大为完整 mission/exchange/服务器奖励库；原效果、物理设备、发布部署仍未验证。
