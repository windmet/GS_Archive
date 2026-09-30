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

参考 A：ライブハウス点灯、タケル与漣、五张贴纸。参考 B：楽屋通常、DRAMATIC STARS 三人、五张贴纸。它们是根据用户图片整理的可编辑构图，不是原游戏存档；背景、服装与贴纸按本地图片核实；手部姿势与相对尺寸仍保留差异，不标记逐像素一致。

构图合同回归已验证 A/B 来源闭包、数组顺序、重复实例、JSON 往返、错误输入拒绝及有界 framebuffer 导出。渲染与编辑交互验收见下；原始游戏效果与逐像素复刻仍未完成。


## 本批消费与本地 Browser 验收

- `ArchiveEventDetail` 仅消费 EventDetailView v2；App 在打开该活动时按描述符加载奖励页，拒绝旧合同、混入别的活动、错误行数及损坏页。卡片、材料、奖励表均展示精确绑定的缩略图与 typed target。
- 删除三种模式的 ArchiveDomainCatalog；活动、藏品、摄影各有独立动态组件、目录状态、取消与重试。摄影目录增加本地媒体缩略图，失败状态按分类和实体区分。
- StudioDocument 增加背景 zoom、动作时刻与表情时刻，允许在真实动画中定格；未指定动作时刻时仅使用骨架确有的循环变体。参考 B 的闭眼取实际表情动画 3.4 秒的眨眼帧。
- PNG 背景、贴纸、相框显式使用 UNPACK alpha；Spine 与旧 Player 默认 PMA。每个对象拥有请求、纹理和骨架实例，移除后释放；请求控制器、CPU缓存和构图对象数有界。
- 生产器提交 6f9fa7c3，r5 release `5dcd466557d86b7a410ccfaa68579b290ba834dea29b3cdeb40ce5d80858000a`。外部 readmodels 候选：E:/Web_build/GS_Archive_Domain_Work/composition-readmodels-r5；8750 份 JSON 校验通过、解码合计 75,907,933 字节、bootstrap 14,344 字节。
- Browser 使用本 checkout 的 `.analysis/build-check` 生产代码，5198 映射现有 public、外部资源与 r5；没有复制媒体库。证据在 E:/Web_build/GS_Archive_Domain_Work/composition-browser-r5。临时故障规则清空后服务恢复正常。

| 实际旅程 | 本地结果 |
| --- | --- |
| 参考 A / B | 分别 2 / 3 人物、5 张独立贴纸。两套背景与服装均使用真实素材。A 的小人最终为贴纸 0140「SideMini 円城寺道流」，原图红头巾与拉面店围裙已对上，未使用翔太替代。 |
| PNG | 两组实际编码的预览均为 1280×720，右侧裁边稳定；选中描边不进入导出。Browser 的 Blob 下载等待超时，落盘下载未验收。截图 `reference-A-preview.png` / `reference-B-preview.png` 是 Browser 渲染的导出预览，非下载文件。 |
| 文档编辑 | 蛋糕旋转 12 度、前移后保存；刷新、载入后保留 12 度与顺序。重复水滴独立移动至 X=1.2，删除新增实例；键盘微调问号 X 从 .145 到 .155。 |
| 素材失败 | 仅贴纸 0062 请求注入一次 503：出现可重试状态，禁止导出；重试后恢复 2 人 5 贴纸。 |
| 音频与退出 | 漣指定语音实际播放；改选贴纸后音频节点为 0。离开工作台进入活动目录后 canvas 为 0。未据此声称 GPU 长稳或全部语音验收。 |
| 活动 v2 | Not Alone 显示 3 张报酬卡、159 条奖励、材料图片；Reader 回到原详情。复刻独立显示 2023-04-05/04-15 时段，继续进入原剧情 Player；人物纹理和对白实际渲染。 |
| 季节媒体 | Happy Whiteday 2022 使用自己的 50001 logo 和背景，并明确标注 banner 缺失；没有别的活动图片替换。 |
| 拆分目录 | 59 活动筛选、藏品称号切换、摄影地点/媒体入口实际打开。 |
| 390×844 | 页面宽度 390，无页面横向溢出；画布仍为 1280×720；对象控制在素材库之前，按钮与数值控件可用。临时 viewport 在结束时重置。 |

代码验证：46 readmodel 测试、构图来源/JSON/顺序/错误输入回归、Event v2 消费回归、图片生命周期默认 PMA 与显式 UNPACK、全套异步导航、949 摄影脚本预设、B002 59 份/999 行以及 B001 52 文档/993 单元保护通过。`build:check` 完整代码编译并保持 copyPublicDir:false；build audit progress 的初始 JS gzip 约 127 KiB，没有 forbidden/global legacy 模块。全站迁移、设备和部署仍保持原有 pending/partial 状态。

## 视觉对照与残差

对照设计稿与实际截图：宽屏采用大画布及 320px 对象栏；背景和边框沿用资料馆浅蓝/白，选择与导出使用薄荷绿；24px 页面标题、较小表单与实际字体保持原站层级；贴纸由源缩略图显示；主操作和保存/载入分两排；手机改成单列，把对象操作放在素材库前。原站「故事/资源」导航保留。设计稿里的虚构人物替换为本地真素材。

A/B 是可继续编辑的参考构图。A 已匹配两位人物、道流小人、背景和贴纸来源；B 已匹配三人服装、背景及贴纸，薰的手部姿势仍与原图有明显差异，尺寸/角度尚非逐像素一致。没有伪造原游戏存档或隐瞒来源差异。拖拽已实现，当前 DOM Browser 接口未提供实际拖拽操作，数值与方向键交互已验收；触屏与物理设备待验。原相框 Prefab、天气粒子、shader 参数和 lipsync 仍未完整复原。

## 动作预览与构图定格修正

输入 HEAD：8ef141eb。原实现从定格循环直接开始预览，退出预览时保留了运行帧；保存的 poseTime/faceTime 却没有改变，导致当前画面和刷新后载入的构图不一致。

现在预览重新播放来源 main motion，并排入骨架实际存在的循环；「返回定格」、保存与导出都重新构建文档指定的身体、表情和颈部轨道。预览不会修改 StudioDocument；播放中显示保存/导出会恢复定格的说明。PNG 以文档定格为准。

`verify:studio-animation` 使用本地四个真实骨架状态（含同人重复实例和 sad + neck_question），检查 main→loop、独立表情起点、默认与 0.42 秒定格、精确恢复骨骼/附件/颜色以及静止重复更新不累积颈部变换。无 GPU 的状态回归与 `verify:studio-composition` 均通过；`build:check` 10.13 秒完成，copyPublicDir:false。

5198 同一 r5 映射服务的生产代码 Browser 在 1440×900 实际检查：参考 B 三人五贴纸，预览后返回、预览中保存和导出均退出预览；PNG naturalWidth/Height=1280/720；薰动作 0.42 秒、表情 3.4 秒保存后刷新/载入数值一致，控制台 error 为空。截图 `animation-restored-ui.png` 在既有 E:/Web_build/GS_Archive_Domain_Work/composition-browser-r5；屏幕裁图只支持视觉观察，未据其宣称像素级同一性。设备、实际拖拽与 Blob 落盘边界不变。

另外直接检查 RAW costume_005kao_002_00.unity3d：仅一个 comu.skel，并非遗漏另一个摄影骨架；原 idol_motion_stg_005kao 的 7 条 motion→pose 映射均为现有 main/loop，weight 的 backAnimationName=back。Browser 第八个 sad + neck_question 仍未呈现参考图举手动作。这里证明本次检查范围，不能据此判定原图动作不存在或已经完成复刻。

## 原生相框锚点修正

输入 HEAD：6bd16a17。新增 `scripts/inspect-photo-studio-layout.py` 从本地 2.6.10 XAPK 的 base APK、assets/bin/Data/data.unity3d 直接读取 Unity 原生 RectTransform；只生成外部 JSON，不解包复制媒体库，也不运行游戏。候选 `E:/Web_build/GS_Archive_Domain_Work/studio-native-frame-anchors-r2.json` 核对后保存为 `src/core/studio-native-frame-anchors.json`。

源 Unity 2020.3.34f1，data.unity3d SHA256 `d35231c0b00a09f6941f47f7ffedde9e9b35701f5b66d6f432517da860e1a500`。五处 StudioRoot 的 LeftFrame/RightFrame 原生锚点、pivot、位置、缩放一致；LeftFrame=(1,1)、RightFrame=(0,0)，位移为零。相框 0001 的真实缩略图与两张 PNG 交叉确认 _01 对应右上、_02 对应左下。网页之前的左上/右下放反了，现通过 Unity→Pixi 坐标换算改正。

这里仅恢复原始锚点。原生 RectTransform 的 sizeDelta 为零，实际相框尺寸应由运行时代码设置；APK 脚本元数据头不符合标准 IL2CPP 格式，现有 TypeTreeGenerator 无法读取该代码合同。因此保留既有网页尺寸近似，并在 UI 明示。素材对图层的配对来自缩略图交叉确认，未宣称已反编译验证原游戏的绑定方法；相框全精度、shader、天气效果继续 pending。

`verify:studio-frames` 对 26 套真实两图层绑定使用实际 Pixi Sprite 检查边界和切换释放，同时核对五处源布局一致；`verify:studio-animation` 再次通过。`build:check` 9.48 秒完成，copyPublicDir:false。同一 5198/r5 映射服务的 1440×900 Browser 实际导出相框 01 和 26，naturalWidth/Height=1280/720，无控制台 error。390×844 页面宽度为 390，画布固有 1280×720。截图 `frame-01-export-preview.png`、`frame-26-export-preview.png` 和 `frame-mobile.png` 存在 composition-browser-r5。原生 Blob 下载事件仍超时，落盘下载没有被提升为通过。

## 服装字典来源门与 r6 消费

生产器提交 `74f61ffd3abe8fcef0198a82aef53049ac0e64a6`。服装叶子的 PB 摘要不足以证明其使用了当前服装字典；现在从 checkout 实际读取的字典字节取得 SHA256，逐偶像校验 dictionarySha256、完整模型集合、名称、costumeId、sourceTables 与资源所属模型。拒绝旧字典、漏行、重复行、额外模型、状态不一致、跨模型 atlas/骨架/纹理以及重复动画名。真实数据中同一个 numeric costumeId 可对应不同模型，按 modelId + idolId 保留，不错误去重。

47 项 readmodel 回归全部通过，包括真实 49 人、690 模型和上述损坏输入拒绝。新候选 `E:/Web_build/GS_Archive_Domain_Work/composition-readmodels-r6` 的 8750 份 JSON 通过摘要、包络与依赖闭包验证，解码合计 75,907,935 字节；bootstrap 为 14,344 字节。release 为 `ff4455d1d133f86c0fa5c2f4c3503642e48e62c22866a6df16a72758677c8fb7`。挂载 bootstrap 与路由台账后 `build:check` 9.83 秒完成，无媒体复制。

只替换本任务已核对身份的 5198 QA 服务，映射 r6 与现有 public。1440×900 Browser 实际打开参考 A，将漣从 `040ren_005_00` 换为字典的「ベーシックウェア」`040ren_002_00`；2 人 5 贴纸保持，生成 PNG 预览固有 1280×720。参考 B 为 3 人 5 贴纸并生成同尺寸 PNG，控制台 error 为空。Not Alone 活动实际打开，11 章、3 张报酬卡、159 条奖励正常消费。证据 `ren-costume-ui.png`、`reference-B-ui.png` 与 HTTP 摘要日志在 `E:/Web_build/GS_Archive_Domain_Work/composition-browser-r6`。这里验证新 release 的代表消费，未重复宣称全部 UI、实际下载或设备验收。

原生追查补充：本地 2.6.10 IPA 的标准 IL2CPP v27 元数据可读，确认 StudioRoot.AddFrame、IdolSlot.PlayPose/PlayFace、插槽缩放与贴纸编辑等接口名；但 UnityFramework 的 Mach-O 代码段 cryptid=1，当前工具未恢复方法体。接口名不能证明相框尺寸或随机动作参数。按已核对摘要重读完整摄影 PB 后，395 条姿势与 554 条表情均未写入 storyCostumeId，395 条姿势亦未写入 defaultPhotoFaceId；现有域投影没有漏掉这些值，不能凭 schema 字段存在虚构 fallback。薰的举手、原生相框尺寸、天气、shader 和 lipsync 仍保留未完成边界。
