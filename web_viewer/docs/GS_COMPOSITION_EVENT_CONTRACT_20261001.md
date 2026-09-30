# 构图编辑与活动详情合同收口

输入 HEAD：577ee368。依据用户提供的审阅与两张实拍保存图，保留已审核摄影 PB、949 标签和脚本解析；新增消费合同，不重写 RAW 或翻译。

## 来源生产批次

- `event_media.json` 从 59 条 EventData 的 bannerResourceId、logoResourceId、backgroundResourceId、resultBgResourceId 精确匹配导出名，保留 sourceField、resourceId、PNG 尺寸和 SHA256。196 项图像引用验证，40 项缺失明确记录。50001/50002 的 banner 导出缺失，存在对应 logo；不冒充横幅。BGM 仅记录身份。
- 49 份 `photo_costumes` 从既有 costume_dictionary 的明确 idol_numeric_id 和 model_resource_id 关联，不猜服装名称。690 套模型的 atlas、骨架、PNG 依赖完成文件与摘要验证；骨架实际解析后写入动画列表。空名称使用模型资源身份。
- 候选只含 JSON，位于 E:/Web_build/GS_Archive_Domain_Work/composition-media-577ee368。修订的 cardImages 候选位于 composition-media-577ee368-r2。没有复制媒体库。
- EventDetailView v2 统一 identity、period、media、story、episodes、rewards、cast、units、relatedEvents、seasonalCampaign 与 provenance；不再输出旧 event/masterEvent/supplement 三套并行字段。原剧情入口仅放在 story.entry，供既有 Player 导航消费。
- 复刻与原活动保持各自身份、时段、媒体与奖励，仅共享已明确关联的剧情。四个季节企划仍按 eventCode/detailId 精确连接。
- 奖励 presentation 在离线生产器关联名称、图片与 typed target。完整奖励行拆成至多 192 KiB 的描述符页；浏览器只在打开对应活动时按相同 release 加载这些页。
- 摄影服装为本地档案资源，不表示持有或解锁。原摄影 preset 仍绑定原脚本模型；换服装时只适配同一偶像且真实骨架存在的 motion/face/neck。

验证：46 项 readmodel 测试通过，包含全部 59 活动、49 偶像、690 服装关联、原剧情与季节身份保护。690 骨架均可解析。既有资源解析器 30 次 HTTP 夹具回归通过。以上证明来源与生产器合同，不代替 Browser、真机或部署验收。

## 构图文档

StudioDocument v1 为 JSON 构图真相：背景、独立 actors/stickers、frameId/filterId。数组从后到前排列；每个实例有唯一 instanceId、x/y、scale、rotation。人物额外持有 idolId/modelId/poseId/faceId。支持同人或同贴纸重复添加。限制 6 人与 32 贴纸；位置允许越过画布用于裁边。拒绝错误版本、重复实例、无效数值、跨偶像服装/预设和未收录素材。

参考 A：ライブハウス点灯、タケル与漣、五张贴纸。参考 B：楽屋通常、DRAMATIC STARS 三人、五张贴纸。它们是根据用户图片整理的可编辑构图，不是原游戏存档；构图、服装、姿势及裁切仍须实际 Browser 对照后调整。

构图合同回归已验证 A/B 来源闭包、数组顺序、重复实例、JSON 往返、错误输入拒绝及有界 framebuffer 导出。渲染交互与参考图复刻验收尚在进行，不据此标记玩法完成。
