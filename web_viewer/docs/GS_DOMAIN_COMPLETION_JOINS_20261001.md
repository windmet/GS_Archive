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

## 最终本地验收

- r3 producer `2dab7f487445231f8d6efb2fa5af1525a417f53b`；最终 r4 producer `cbea52caaecd16d0dbd8ff78f2e0ef7bafcc50c4`，release `e687f9ea33ec12cb28210e91297f068e3b7f458e1fb433a5af4a1881f0f6332c`。r4 为8,607文件/73,469,371 decoded bytes，bootstrap14,344 bytes；所有哈希、schema envelopes、descriptor引用闭合通过。仅数据产物，未复制完整媒体库、未部署。
- readmodels 46测试通过；更新后完整49偶像/392称号链接、4季节 event/detail身份覆盖通过。原偶像资料50身份、季节/偶像/活动导航取消与重试、56独立导航状态/1792组合、B00259文档999行通过。
- r4生产代码编译10.03秒，bootstrap匹配，build audit无禁止初始模块/全局旧资料loader；初始JS gzip估计126,794 bytes。全站旧parity与真实device门禁仍未通过，不由本批覆盖。
- IAB桌面1440×1000、窄屏390×844：全部物品535，8用途分类分别170/282/16/3/3/1/2/58，未知其他0；称号1613。列表25条分页图片实际解码。同名票券30300/30302/40345保持三个独立身份；窄屏长名不溢出。
- 410001活动8400PT专用碎片→049eis_r02《信念を賭けて》→返回同活动；13400PT贴纸→stickers:66→目录3/8定位→摄影工作台实际带入Not Alone。摄影目标URL清除无关活动参数，来源链保留。
- Happy Valentine2023→valentine_2023共52段；共通导入与冬馬5_01_001_23的真实Spine、推进、回看重放、返回季节→原活动通过。Happy Whiteday2022→white_day_2022身份正确。TOUR想いはETERNITY显示165条、独立累计/排名/歌曲面板/活动期内与存档剧情范围；窄屏390无横向溢出。THEATER、CARNIVAL与复刻样本先前本地证据保留。
- 冬馬资料→photo_idol=1，11表情/8姿势/5真实cue；鋭心→photo_idol=49。冬馬honor:30025001、鋭心honor:30025193均原文正确、仅一条明确偶像排名来源，返回正确个人资料。桌面四列称号按钮、窄屏单列长名，profile clientWidth/scrollWidth375相等。
- r3完整HTTP636：629x200、7x404。7个404为未收录季节横幅4次、原有可选中文译文2次、构建中旧tab请求已替换chunk1次。旧chunk刷新后成功；JP正文可读，缺横幅稳定降级，不把这些记为全部HTTP成功。最终代码重新载入后没有新console error。
- 首开独立tab首页（2026-09-30 20:33:33–20:34:10 UTC）53请求，仅home自己的6个readmodel引用；没有items/honors/photos/events或PictureStudio请求，没有直接domain JSON请求。数据版本更新后首页遵守相同按需合同。
- r4小证据 E:/Web_build/GS_Archive_Domain_Work/browser-qa-r4/：idol-honors-desktop.png、idol-honors-mobile.png、最终工作台截图；r3证据保留于browser-qa-r3/，包括列表图片、同名票券、季节入口、实际Player与导出预览。已用view_image检视桌面/窄屏/Player/PNG预览。
- PNG编码及预览重新解码1280×720通过；IAB blob下载没有事件，文件落盘未验证。原Prefab相框排布/场景效果/shader数值/嘴型同步、物理Android/iOS、CORS远端与部署未验证。

本地链路范围：PB来源→管道→公开白名单→按版本readmodels→目录/来源/个人资料→季节阅读或实验摄影→PNG预览。任务/商店完整取得库、所有权和官方原效果不在本次可证明范围。

最终 r4 代表旅程 HTTP 快照：187 请求全部200，唯一release为e687f9ea…6332c，最大readmodel leaf375,214 bytes，没有直接domain JSON请求；r4载入后无新console error。最终摄影台鋭心joy/face_happy、通常2、C.FIRST贴纸和重新解码PNG1280×720通过，截图studio-ready-desktop.png与studio-final-desktop.png。Browser临时viewport已reset，工作台tab保留作为本地交付。
