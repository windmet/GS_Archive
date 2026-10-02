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

## 可交换构图文件与导入失败保护

输入 HEAD：80e65e46。原页面仅有此浏览器的单个存档，且载入失败会写入画布错误、禁用原本有效构图的 PNG 导出。现提供折叠的「构图文件」入口：生成 JSON 文件、从文件载入、复制构图内容。文件沿用 StudioDocument v1，仅包含素材身份与构图参数，不嵌入媒体；加载前限制 64 KiB，并检查实际 UTF-8 字节数、JSON、版本、对象数、重复实例、数值范围及当前资料中的人物/服装/预设/素材归属。接受 UTF-8 BOM。

读取与素材验证完成后才替换 draft。错误导入保留当前构图、选中对象与渲染，错误消息独立于画布加载错误。读取期间禁止保存与导出；更晚的参考构图请求可覆盖正在读取的文档。文件和 PNG 的 Blob URL 独立管理，修改构图或退出工作台时释放，生成 PNG 不会移除已有构图文件链接。复制、保存与导出继续按文档定格恢复预览。

`verify:studio-composition` 验证真实 A/B 经文件序列化、File 读取及 BOM 的完整往返，拒绝损坏 JSON、其他版本和 UTF-8 超限文本；超过文件大小限制时不调用 file.text。最终 `build:check` 9.35 秒完成，copyPublicDir:false。该批仅改消费与文档，不改变 r6 数据 release。

同一已核对 PID 39916、5198/r6 生产代码服务的 Browser：载入三人五贴纸文件，薰 rotation=8、poseTime=.42、faceTime=3.4 保留；串服装文件、损坏 JSON 和 65,537 字节文件实际拒绝，当前旋转与对象数不变，仍可生成 1280×720 PNG。通过页面「复制构图内容」实际读回内容，再从该内容保存的文件导入，切换到 A 后恢复原 B 的三人、五贴纸、顺序与数值。构图文件链接和 PNG 预览同时保留。390×844 页面 scrollWidth=390，画布固有 1280×720，无控制台 error，结束时 viewport 重置。

证据在 `E:/Web_build/GS_Archive_Domain_Work/composition-browser-r6/document-import-r1`，含 Browser 实际复制的 `copied-composition.json`、`document-roundtrip-ui.png`、`document-mobile.png`、输入失败文件与最终 build 日志。原生 JSON Blob 下载事件等待 8 秒仍超时，因此 JSON 下载落盘未验收；复制→文件→重新载入路径已实际验证，不把它记为下载通过。薰的原图举手、原始效果与物理设备仍未完成。

## 人物坐标稳定性与 v2 兼容

输入 HEAD：30118538。旧 Stage 以人物首次载入的姿势范围决定大小和 pivot，随后换姿势仍沿用首次范围。同一份参考 B 的薰改为 hello 后保存，刷新再载入，1440×900 Browser 同位置的 843×474 画布截图有 100,712 像素不同（25.2043%）。这是构图解释依赖操作历史，不能由保存的 JSON 恢复。

StudioDocument 现在写入 schemaVersion=2。新人物的 layoutBasis=source-bounds，以骨架导出的不可变 x/y/width/height 计算大小及脚底锚点，并转换源 Y-up 到 Pixi Y-down。v1 文件仍接受并规范化为 v2，强制保留 pose-bounds 规则和原 x/y/scale/rotation；按文档最终姿势的当前附件几何测量，播放预览期间不更新尺寸。再次保存时携带该规则，不把旧坐标直接套用新模型尺寸。旧浏览器存档 key 保留。参考 A/B 的数值按真实骨架几何换算到新规则，继续保留可编辑、来源明确的构图。

选择框原先读取 Pixi 保留的显示对象范围，换姿势后也可能沿用旧范围。现在按当前骨架附件测量，再经实际人物 transform 换算画布四角；旋转后取画布轴对齐范围。旧人物尺寸也使用当前骨架附件，避免显示对象缓存带入历史状态。

`verify:studio-placement` 读取全部 49 人、690 套真实骨架及 atlas，验证原始尺寸可用；五位参考人物使用真实 Skeleton/AnimationState 与 Pixi Container，比较 weight→angry→hello 和直接载入 hello 的骨骼坐标、大小、pivot、选择框，分别覆盖两种尺寸规则。新文档换姿势的锚点保持固定。这里是无图像复制、无 GPU 的几何回归。`verify:studio-animation` 与 `verify:studio-composition` 通过，后者覆盖 v1 规范化/再次序列化、v1 扩展字段不能改写尺寸语义、未知规则拒绝。最终 `build:check` 9.21 秒完成，copyPublicDir:false，没有修改 r6 数据 release。

同一 PID 39916、5198/r6 映射服务的最终生产代码 Browser：新 v2 构图换姿势后保存和刷新载入，843×474 同位置画布（含选择框）逐像素比较为 0 差异；实际导入本轮修复前保存的 v1 文件，换姿势后保存/刷新载入也为 0 差异。该结果只证明这两个测试旅程的恢复一致性，不代表与用户原图逐像素一致。参考 A 两人五贴纸、参考 B 三人五贴纸均实际生成 PNG 预览，固有尺寸 1280×720，最终控制台 error 为空。

证据 `before-warm.png`、`before-fresh.png`、`final-warm.png`、`final-fresh.png`、`legacy-warm.png`、`legacy-fresh.png`、像素比较 JSON、A/B 导出界面和 build 日志在 `E:/Web_build/GS_Archive_Domain_Work/composition-browser-r6/actor-placement-r1`。直接从 Blob 链接取得 PNG 的 Browser 下载仍等待 8 秒超时，没有新增下载落盘通过声明。

补充核对了薰 001–004 的真实纹理：002 的蓝衬衫、白领及领带与原图一致，摄影脚本亦指定该模型。没有用其他服装掩盖手势差异。薰的举手、原图尺寸/角度、原生相框运行时尺寸、天气/shader/lipsync 和物理设备仍待完成。

## 横向全屏工作台与直接操作

输入 HEAD：d8862b9d。用户将摄影目标调整为接近参考图即可，优先触屏与桌面交互；随后明确要求手机默认横向全屏、右上角展开菜单，桌面也可使用这一模式。本批按此实现，不以附件内的建议代替用户授权，也不继续追求原图逐像素一致。

手机尺寸默认进入覆盖页面的横向工作台。竖屏时将整个工作台顺时针旋转 90°，实际横屏时恢复正常方向；画布始终保留 16:9，没有裁掉构图。右上角「菜单」打开独立滚动的抽屉，分为素材、对象、保存 / 导出。素材中可选择背景、人物、贴纸和画面效果；对象列表默认折叠，先露出所选对象的设置。分区切换会回到菜单顶部，收起菜单和 Esc 返回画布。桌面的「全屏工作台」提供同一交互，退出后保留构图、选中对象和参数。菜单内容通过 Teleport 移动现有节点，画布及 Spine 实例不随模式切换重建。

「隐藏浏览器栏」在用户点击时复用故事阅览器的 usePlayerImmersiveMode，尝试原生全屏及横屏锁定；不依赖页面载入时申请原生全屏。拒绝或不支持该 API 时，覆盖页面的横向工作台仍可使用。本轮不声明手机浏览器栏隐藏、物理旋转锁定或各平台原生全屏已经验收。

新增 StudioCanvasInput、StudioGestures 和 StudioHitTest。原生 Pointer Events 捕获最多两个接触点；第一个点选对象后，第二个点锁定同一对象，以双指中点、距离和角度同时移动、缩放和旋转。松开一根手指后重新建立基准，继续拖动不会继承旧双指偏移。Esc 可恢复整次手势开始前的参数；指针取消、失去捕获、窗口失焦、尺寸变化、模式切换、删除对象和组件销毁均释放相应状态。单指从空白处开始不移动对象，仍允许随后双指调整已选对象。

普通视图按实际 canvas DOMRect 映射到 1280×720；旋转视图对顺时针 90°变换求逆，用 clientY 对应画布 X、DOMRect.right-clientX 对应画布 Y。手柄尺寸也按旋转后的逻辑宽度计算，命中直径为 44 CSS 像素，超出画布的人物仍可在可见范围操作。画布上圆柄旋转、方柄缩放；桌面滚轮围绕鼠标位置缩放，Shift＋滚轮旋转，方向键微调，＋/− 缩放，[ / ] 旋转。菜单保留 44 像素快捷按钮及输入框作为补充操作。

人物命中使用当前 RegionAttachment 和变形后的 MeshAttachment 三角形，按实际前后顺序选择；贴纸使用已加载原图的透明度遮罩，不能读取像素时才退回图片范围。修正旧 transform 回调将所有非 Y 参数限制在 [-1,2] 的问题，改用位置、大小与旋转各自的合法范围。直接操作立即更新真实显示对象与文档，导出继续隐藏整个选择框和手柄。

参考图 B 的遮挡关系有新的核对结果：薰旁边那只手属于辉的左手。辉的 surprise 同时显示两只手，薰保持 weight 并处于辉前方，可形成参考图的遮挡。因此前文「薰的举手」是当时未证实的判断，现予以更正，不再把它当作遗漏动作。两张构图的十个贴纸及部分人物位置、大小、角度按本地原始素材近似调整；没有生成替代图片，也没有修改 r6 release。原生相框运行时尺寸、天气、shader、lipsync 和物理设备边界继续保留。

验证：verify:studio-gestures 通过，覆盖真实事件绑定与清理、CSS 坐标、90°逆变换、拖动→双指→拖动连续性、第二指不能改选对象、零距离安全处理、缩放上限、取消恢复、手柄、滚轮和键盘，以及真实附件类、网格变形和贴纸透明像素命中。这里的多点输入是回归夹具，不是物理触屏操作。verify:studio-animation、verify:studio-composition、verify:player-immersive 通过；本批此前运行的 verify:studio-placement 对 49 人、690 模型及五位参考人物的真实骨架检查通过。最终 build:check 10.61 秒，输出复用 .analysis/build-check，copyPublicDir:false，不复制媒体库。

同一已核对 PID 39916、5198/r6 服务的生产代码 Browser：1920×1080 原页面实际拖动人物、拖动缩放柄和旋转柄、滚轮缩放、键盘微调与旋转；点水滴实体选中贴纸，点其透明角落选中背后的薰。390×844 普通布局无横向溢出，约 44×44 的快捷按钮可用，拖出画布仍继续移动。844×390 默认横向工作台从菜单载入 B、搜索并添加怒り贴纸、收起菜单拖动，保存后刷新恢复为三人六贴纸；新增贴纸 x=0.6137606562820015、y=0.7106104537668678、scale=.8、rotation=0 保留，并生成固有 1280×720 PNG。

390×844 旋转工作台实际拖动薰，x 从 .266653 变为 .3166387397238167、y 从 1.999961 变为 2.042860602089807，符合旋转坐标逆变换。1440×900 桌面切入同一工作台并拖动新增贴纸到 x=.6484717970497448、y=.7352939330406697；Esc 收起菜单，退出后这两个数值保持。参考 A/B 的 PNG 预览仍为 1280×720，不含手柄；最终控制台 error 为空。这些 Browser 拖动由真实鼠标输入完成，不能提升为手机双指设备通过。

证据在 E:/Web_build/GS_Archive_Domain_Work/composition-browser-r6/gestures-r1：landscape-focus.png、landscape-objects.png、portrait-focus.png、landscape-materials.png、desktop-focus.png、focus-export-preview.png、回归日志和最终 build-check.log。未重新宣称 Blob 下载落盘通过；触屏双指、移动浏览器工具栏和系统旋转锁定仍需实际设备验收。

## 藏品与奖励条目响应式展示、快捷查看（2026-10-01）

输入代码基线为 3f09739e；工作期间另一窗口独立提交 d3880d7d（称号离线证据工具），本批接续该 HEAD，没有覆盖该提交。用户提供的修复建议仅作为设计参考：采用条件、图片/名称、数量的响应式条目，数字不拆行，复用藏品资料快捷查看。不采用示例奖励数值、未经确认的译名或“限定/关键大奖”等分类。数据 release 仍为 r6 ff4455d1d133f86c0fa5c2f4c3503642e48e62c22866a6df16a72758677c8fb7，无语料和来源规则变更。

ArchiveRewardTable 同时用于活动奖励和藏品已知来源，保留原顺序、25 条分页、获取方式过滤、未知引用提示、历史企划日期。条件分别显示累计点数、排名区间、重复点数的间隔/起点/上限、剧情阅读、登录天数等，不能全部化为 PT 里程碑。宽区域显示三列，手机或桌面窄详情栏以容器宽度切为上下排列。图片只有在已有绑定时展示；标量奖励保留真实名称，不虚构图标、藏品身份或重复类别。

活动材料及已解析道具/称号打开快捷查看，经过现有 release-pinned ReadModelClient 和 DomainRepository 严格查找及核验实体身份。共享 CollectionEntryDetails 与藏品馆使用同一说明、类别、持有上限及历史配置提示；关闭保留活动地址、过滤和当前页，焦点返回触发条目，弹层打开时背景 inert，Tab 在弹层内循环，Esc 关闭。失败可重试；关闭、切换和卸载中止旧请求，并以 revision 拒绝迟到结果。卡片和摄影素材继续使用原有类型化详情入口。

回归：verify:reward-presentation --models E:/Web_build/GS_Archive_Domain_Work/composition-readmodels-r6 通过，实际读取并验证活动 410014 的 161 条奖励、item:10401 的原名称、称号实体，以及并发切换、关闭、卸载、失败重试、非法和混合实体拒绝。verify:domain-navigation 和 verify-event-readmodel-navigation 通过。最终 npm run build:check 9.60 秒完成，复用 .analysis/build-check，copyPublicDir:false，不复制 public 媒体。构建过程中曾因旧浏览器页面引用已替换的 chunk 出现动态模块加载错误，完成构建后刷新并重新验收，不将中间状态算作通过。

Browser 为 PID 39916、5198 的既有生产 bundle / r6 映射服务。390×844 实际核对首条 100 PT、フィジカルバッジ、数量 40，打开 item:10401 的原始日文说明与持有上限 999,999；关闭返回相同活动地址和焦点。真实排名共有 12 条，第一名称号 honor:30017340 可快捷查看并进入藏品馆，已知来源指回本活动。重复奖励的每 10,000 PT、起点 200,000 PT、上限 9,999,999 PT、数量 100,000 在 320×740 下保持数字完整、条目无横向溢出。分页第二页的 25,000 PT 卡片“楽しく弾んで”实际进入卡片详情；13,400 PT 贴纸实际进入摄影资料 stickers:162。840×900 的道具详情 336px 窄来源栏改为上下排列，1280×900 和 1440×900 验证桌面奖励布局。最终构建的手机道具/称号旅程控制台新增 error 为空，临时 viewport 已恢复。

证据位于 E:/Web_build/GS_Archive_Domain_Work/collection-rewards-browser-r1：before-mobile.png、mobile-rewards.png、mobile-quick-view.png、narrow-repeated.png、desktop-rewards.png、desktop-quick-view.png、desktop-narrow-sources.png、reward-regression.log、build-check.log。该证据属于桌面 Browser 的尺寸测试，不代表实体手机触屏、原生全屏或完整媒体发布验收。

## 藏品目录与详情读取隔离（2026-10-01）

输入 HEAD 5ac7c6c5。Browser 注入 item:10701 对应详情页 15 秒延迟，复现改选后整个目录与搜索框消失。新增 CollectionCatalogSession 将目录与详情加载/错误分开；同域保留已校验目录，改选及详情重试不重复读取整目录。详情开始读取即清空上一件内容，选择态绑定请求实体；未知实体不回退冒充第一件。类型切换丢弃当前目录引用，旧目录/详情请求由 abort + revision 阻止回写；离开页面释放状态。桌面目录列表改为有界滚动，避免选到列表下方时右侧详情已在视口外。

verify:collection-catalog-session --models composition-readmodels-r6 通过，包含真实 535 道具、1613 称号、目录复用、详情/目录失败重试、混合身份拒绝、快速跨域往返与卸载。verify:domain-navigation、verify:reward-presentation（实际 161 条奖励）通过。最终 build:check 10.85 秒，copyPublicDir:false，复用本 checkout .analysis/build-check，r6 release 未改变。

PID 39916、5198/r6 生产 bundle Browser：1280×900 注入详情 12 秒延迟，535 条目录继续可用，搜索 10402 并改选物理戒指成功，旧详情不覆盖后选资料。桌面详情一次 503 后仍有目录、选择态与原地重试；重试读取初级课程笔记的真实说明及 418 条来源。390×844 同一 503→重试链路通过，类型切换能进入称号目录。故障文件已恢复 rules:[]。证据在 E:/Web_build/GS_Archive_Domain_Work/collection-loading-browser-r1，包括前后加载截图、桌面错误/重试、手机重试、回归与构建日志；注入期间的 HTTP 503 是预期测试事件。该批为读取恢复与交互，不代表所有资料域或实体手机已验收。

## 藏品卡片网格、固定详情栏与活动图片边界（2026-10-01）

输入 HEAD 03bc0300。用户要求吸取 BRMY item 页的卡片布局、桌面右侧固定详情思路，并明确称号图标横向铺满、文字下移。参考图片只用于布局；未复制 BRMY 的分类、任务或奖励文字。道具目录为响应式卡片网格，手机双列；称号目录使用完整原比例横幅、名称和编号放在下方，手机单列。共享藏品详情同样先展示原图再显示名称及原始说明。

桌面将标题与种类导航保留在上方，目录和详情占用剩余可视高度并分别滚动；目录搜索/分类在左侧滚动区顶部固定。详情有关闭按钮，关闭后目录扩大；改选保留现有源绑定读取、取消及重试行为。手机选中藏品后使用底部面板，背景 inert，Esc/关闭按钮收起，Tab 在面板内循环并返回触发条目；尺寸切换移动同一详情内容，卸载恢复背景。面板仅消费既有条目、说明和已知来源，缺失来源仍明确为未收录。

活动页真实复现：44px compact figure 内的图片被共享大图 min-height:80px 撑到 80px。DomainMediaPreview 的 compact 图现在明确 min-height:0、width/height/max-height:100%、object-fit:contain，固定图框不被 flex 压缩。活动报酬卡使用 72px 图框，材料使用 44px；图片重试与卡片/材料入口为并列按钮，不再形成嵌套按钮。compact 图片失败时只保留 44×44 重试按钮，避免小按钮与图标争占空间。活动头部和图库按可用容器宽度调整，不能只用窗口宽度推断内容栏宽度。

回归：verify:collection-catalog-session --models r6（535 道具、1613 称号）、verify:reward-presentation --models r6（410014 的 161 条奖励）、verify:domain-navigation、verify-event-readmodel-navigation 通过。最终 build:check 10.44 秒，copyPublicDir:false，复用 .analysis/build-check；r6 release ff4455d1d133f86c0fa5c2f4c3503642e48e62c22866a6df16a72758677c8fb7 未改变。

PID 39916、5198/r6 生产 bundle Browser：1280×900 左侧目录三列；右侧详情顶部 248.92、底部 876.24，位于 main 的 75.99–900.23 范围内。实际分别滚动目录与详情，右侧顶部不变，目录/详情 scrollTop 独立。关闭、重开、搜索 10701 和手机转换可用。390×844 手机道具双列、详情底部面板；清除搜索仍保持 item:10701 和真实说明、418 条来源。称号 10001001 的原图横向完整展示，名称位于图下，原数据没有来源时仍显示 0 条。320×740 称号图片约 247.46px 宽，文字下移，页面 scrollWidth 与 clientWidth 相等。

活动 410014 在 390px 下的全部 compact 图片测得无容器越界、嵌套 button 为 0；840×900 内容栏约 669px，头部自动单列，图库图片均在 figure 范围内；320px 无横向溢出。实际报酬卡进入 card_detail/012yus_sr07，材料打开原说明快捷查看；称号 30017340 的已知来源回到本活动且保留返回藏品的路线。只对一张报酬卡图片注入一次 503，重试按钮实测 43.99×43.99 CSS px（浏览器小数取整），独立于卡片按钮；重试后真实图片恢复为约 72×72。故障文件恢复 rules:[]，最终无故障旅程控制台 error/warn 为空，临时 viewport 已恢复，保留当前浏览器选择。

证据目录 E:/Web_build/GS_Archive_Domain_Work/collection-layout-browser-r1：before-event-icons.png、event-mobile.png、event-desktop.png、event-narrow-desktop.png、event-image-retry.png、item-desktop-grid.png、item-mobile-cards.png、item-mobile-detail.png、honor-mobile-cards.png、honor-mobile-detail.png、honor-desktop.png、final-console.json、两份回归日志与 build-check.log。这是桌面 Browser 的尺寸/交互证据，不提升为实体触屏或部署验收。既有源数据缺项、原生摄影效果和全站迁移边界继续保留。
