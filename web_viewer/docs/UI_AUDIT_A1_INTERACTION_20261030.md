# A1 全站交互状态审计 — 2026-10-30

## 结论

**本轮不判定 A1 全项通过。** 已完成全站交互清单、风险驱动的多视口执行及证据交付；当前定义匹配的551个状态转换断言通过，但仍有未闭环要求，既有深链接回归脚本亦有17项FAIL需要逐项核实。没有修复正式UI，没有部署。不能从初始页面无溢出推导交互正常，也不能从一次按钮成功推导异常恢复、软键盘或真机通过。

## 基线、工具和方法

- 输入分支 `portal/20261030-responsive-audit`，HEAD `8f4432bd`，初始工作区干净；fetch后master仍为`c5efb7a0`，没有生产基线漂移。
- 复用已核对的5198工作树服务、PID10784。实际HTTP页面内archive-bootstrap的release为`bc38bea99c08930b00e82978a00035db3c99e8c607e8cacdd564433799baf34f`，data revision `2688ad94…`，media epoch `voice64-gzip-all-20260924`。这是本地源码验收，不是线上发布验收。
- 读取[A0报告](UI_AUDIT_A0_TOOLING_VALIDATION_20261030.md)和[主台账](UI_QUALITY_MASTER_LEDGER.md)，重新执行A0负向/恢复测试17/17通过，证据`E:/Web_build/SideM_Archived/web_viewer/.analysis/ui-audit-a0/run-kjLUI6/`。A0仍只是候选几何工具，本轮不将它升级为全站门禁。
- 沿用已完整读取的break-ui、mobile-native、emil-design-eng规范：实际操作真实数据，空搜索、重复打开、窄屏与桌面、键盘恢复分别测试；未修改视觉；真实软键盘、地址栏、触摸手感全部Pending。
- `scripts/qa/interaction-source-inventory.json`记录真实Vue模板的1,302个事件绑定（组件、文件、代码行、事件、handler及模板）。这不是1,302项已测交互。
- [可执行场景](../scripts/qa/interaction-scenarios.json)有47条flow、229个步骤定义，每步含源代码引用、入口、操作和可观察谓词；复用A0的35路由注册表。目录无搜索控件的情况按源码N/A，不强造控件。
- [完整要求表](../scripts/qa/interaction-requirements.json)拆成373条页面/状态要求，包含路由、组件、初态、动作、预期、实际证据、关闭/键盘/触摸范围和视口。保守映射为98条命名要求通过、6条无搜索控件N/A、269条未闭环（含部分已测但不足覆盖整条要求）；不将未执行项标为PASS。
- [实际执行索引](../scripts/qa/interaction-results-20261030.json)按“flow＋动作＋精确viewport”选择最新、且与当前selector/谓词一致的记录。过期断言/错误selector的整个flow尝试不计入产品判定，但原证据全部保留。对应551个PASS仅代表这些精确DOM/URL断言，不表示所有几何候选都已人工审完。

## 设备矩阵与输入

实际执行320×720、360×800、390×844、430×932、768×1024、1024×768、1280×688、1440×900。目录/详情主要390和1440；导航320/1280；摄影/画廊/舞台另覆盖360、430、768、1024；谱面覆盖320/1280及390/1440导出。每个流程的具体视口见执行索引，不假设未记录的笛卡尔积已执行。

采集器用Chromium/CDP的真实鼠标/触摸输入：滚入可见范围后做elementFromPoint命中检查，才发送Input事件；没有直接调用Vue方法或业务状态。键盘输入/清空/Escape独立发送。宽度<600为模拟触摸，其他为鼠标；平板触摸和所有物理键盘/软键盘仍未验证。Browser/IAB独立复核Reader Escape及两条刷新返回路径。

入口使用A0路由及场景专用控件条件；没有逐步重跑A0全部字体/可见图片Ready条件，所以图片迟到与布局跳动仍需另验。每个实际动作保存before/after PNG、URL、标题、焦点、弹层矩形、关键滚动容器、文本与A0几何候选。每张截图SHA256写入记录；下载步骤另验证实际文件及签名/hash。新run目录在E盘，未覆盖A0或旧A1证据。启动前校验谓词语法，空场景拒绝运行。初始/前序动作阻塞标BLOCKED，未满足断言标NEEDS_REVIEW，均不能计为PASS。当前工具是审计执行器，退出码0不表示全站通过，应读取记录状态。

## 已执行状态覆盖

下表数字为当前场景定义匹配后的独立动作/视口记录；source-only和过期工具尝试未计入。

| Flow | 页面/组件 | PASS | 尚未通过的执行记录 | 视口 |
|---|---|---:|---:|---|
| shell-mobile | events / ArchiveShell | 5 | 0 | 320×720 |
| shell-desktop | events / ArchiveShell | 3 | 0 | 1280×688 |
| catalog-idols | idols / ArchiveShell / ArchiveIdolGrid / App | 9 | 0 | 1440×900, 390×844 |
| catalog-units | units / ArchiveShell / ArchiveUnitCatalog / App | 4 | 0 | 1440×900, 390×844 |
| catalog-cards | cards / ArchiveShell / ArchiveCardList / App | 9 | 0 | 1440×900, 390×844 |
| catalog-songs | songs / ArchiveShell / ArchiveSongCatalog / App | 8 | 0 | 1440×900, 390×844 |
| catalog-events | events / ArchiveShell / ArchiveEventCatalog / App | 8 | 0 | 1440×900, 390×844 |
| catalog-gashas | gashas / ArchiveShell / ArchiveGashaCatalog / App | 9 | 0 | 1440×900, 390×844 |
| catalog-items | items / ArchiveShell / ArchiveCollectionCatalog / App | 8 | 0 | 1440×900, 390×844 |
| catalog-honors | honors / ArchiveShell / ArchiveCollectionCatalog / App | 8 | 0 | 1440×900, 390×844 |
| catalog-currencies | currencies / ArchiveShell / ArchiveCollectionCatalog / App | 8 | 0 | 1440×900, 390×844 |
| catalog-costumes | costumes / ArchiveShell / ArchiveCollectionCatalog / App | 8 | 0 | 1440×900, 390×844 |
| catalog-photos | photos / ArchiveShell / ArchivePhotoCatalog / App | 8 | 0 | 1440×900, 390×844 |
| catalog-unused | unused / ArchiveShell / ArchiveUnusedVoices / App | 4 | 0 | 1440×900, 390×844 |
| detail-idol | idol / ArchiveShell / ArchiveIdolDetail / App | 4 | 0 | 1440×900, 390×844 |
| detail-unit-jup | unit-jup / ArchiveShell / ArchiveUnitDetail / App | 4 | 0 | 1440×900, 390×844 |
| detail-card | card / ArchiveShell / ArchiveCardDetail / App | 4 | 0 | 1440×900, 390×844 |
| detail-song | song / ArchiveShell / ArchiveSongDetail / App | 4 | 0 | 1440×900, 390×844 |
| detail-event-long | event-long / ArchiveShell / ArchiveEventDetail / App | 4 | 0 | 1440×900, 390×844 |
| event-gallery | event-long / ArchiveEventDetail / ArchiveImageLightbox | 42 | 0 | 1024×768, 1280×688, 320×720, 360×800, 430×932, 768×1024 |
| reader | reader / ReaderWorkspaceControls / ChapterStoryReader | 21 | 0 | 1440×900, 320×720, 390×844 |
| chart | live / ArchiveLive / ArchiveSongChartPreview | 14 | 0 | 1280×688, 320×720 |
| studio-materials | studio-edit / PictureStudio | 48 | 0 | 1024×768, 1440×900, 360×800, 390×844, 430×932, 768×1024 |
| studio-layer | studio-edit / PictureStudio / StudioLayerEditing | 21 | 0 | 1280×688, 320×720 |
| studio-files | studio-edit / PictureStudio | 24 | 0 | 1024×768, 1280×688, 320×720, 360×800, 430×932, 768×1024 |
| drawer-items | items / ArchiveCollectionCatalog / CollectionDetailPanel | 42 | 0 | 1024×768, 1440×900, 360×800, 390×844, 430×932, 768×1024 |
| drawer-honors | honors / ArchiveCollectionCatalog / CollectionDetailPanel | 14 | 0 | 1440×900, 390×844 |
| drawer-currencies | currencies / ArchiveCollectionCatalog / CollectionDetailPanel | 14 | 0 | 1440×900, 390×844 |
| drawer-costumes | costumes / ArchiveCollectionCatalog / CollectionDetailPanel | 14 | 0 | 1440×900, 390×844 |
| reader-player-return | reader / ArchiveStoryReader / StoryViewer | 17 | 0 | 1440×900, 390×844 |
| stage-controls | stage / ChibiStageViewer / GsFilterMenu | 42 | 0 | 1024×768, 1440×900, 360×800, 390×844, 430×932, 768×1024 |
| studio-save-export | studio-edit / PictureStudio / useStudioComposition | 10 | 0 | 1440×900, 390×844 |
| event-request-retry | events / ArchiveEventCatalog | 4 | 0 | 1440×900, 390×844 |
| studio-person-transform | studio-edit / PictureStudio / ArchiveIdolPickerPanel | 14 | 0 | 1440×900, 390×844 |
| category-items | items / ArchiveCollectionCatalog | 8 | 0 | 1440×900, 390×844 |
| category-honors | honors / ArchiveCollectionCatalog | 8 | 0 | 1440×900, 390×844 |
| category-costumes | costumes / ArchiveCollectionCatalog | 8 | 0 | 1440×900, 390×844 |
| studio-order | studio-edit / PictureStudio / StudioLayerEditing | 11 | 0 | 1440×900, 390×844 |
| chart-export | live / ArchiveSongChartPreview | 8 | 0 | 1440×900, 390×844 |
| return-idols | idols / ArchiveShell / ArchiveIdolGrid / App | 6 | 0 | 1440×900, 390×844 |
| return-units | units / ArchiveShell / ArchiveUnitCatalog / App | 6 | 0 | 1440×900, 390×844 |
| return-cards | cards / ArchiveShell / ArchiveCardList / App | 6 | 0 | 1440×900, 390×844 |
| return-songs | songs / ArchiveShell / ArchiveSongCatalog / App | 6 | 0 | 1440×900, 390×844 |
| return-events | events / ArchiveShell / ArchiveEventCatalog / App | 6 | 0 | 1440×900, 390×844 |
| return-gashas | gashas / ArchiveShell / ArchiveGashaCatalog / App | 6 | 0 | 1440×900, 390×844 |
| studio-fullscreen | studio-edit / PictureStudio / usePlayerImmersiveMode | 6 | 0 | 1440×900, 390×844 |
| song-event-return | song / ArchiveSongDetail / ArchiveEventDetail / ArchiveShell | 6 | 0 | 1440×900, 390×844 |

### 关键观察

- 外壳：完整/收起侧栏切换、移动导航打开/Escape/重复打开/按钮关闭、中日切换的命名断言通过。
- 目录：有控件的10类目录空搜索、清空、语言和刷新通过；组合/未使用资源没有统一搜索入口的行为按当前源码N/A。道具/称号/服装补分类→空搜索→清空保留分类→重置全部。其他多筛选组合没有据此全判通过。
- 六类详情：目录进入、详情刷新、返回来源目录已测；偶像、组合、卡面、歌曲、活动补语言/直接刷新。卡池详情的完整语言/关系图仍待补。活动画廊下一张、原始尺寸/适应、Escape、重复打开和按钮关闭通过；手势pinch/缩放触摸边界未验证。
- 图鉴：道具/称号/货币/服装，手机/桌面打开、关闭、Escape、重复打开、实体URL刷新及关闭恢复目录通过。内部获取方式/来源筛选、背景点击、所有内部链接、滚动恢复量尚未全部闭环。
- Reader：手机目录/设置/篇内查找/空结果/下一EP/刷新、桌面搜索/清空/Escape/刷新通过。桌面使用整话Reader，手机为单EP。桌面search输入有内容时第一次Escape是浏览器原生清空，第二次关闭弹层并回到`.desktop-search`焦点；Browser独立复现。这不是“一次Escape失效”的产品缺陷。
- Player：从Reader实际进入；下一段推进进度、AUTO开关、菜单打开/Escape，以及返回同一reading=`1_3_10001_01_a`且event=`410001`的Reader，再返回`/events/410001/`均通过。桌面入口是“播放本段”，不能将其写为完整章节已播完。
- LIVE/谱面：从曲目进入、长轨、信息开关、沉浸进出、返回LIVE有曲目通过。PNG/SVG实际下载并校验文件，文件分别落独立步骤目录，避免同名跨视口覆盖。未将“按钮可点击”作为导出成功。
- 舞台：轻量加载选择、资源加载至transport可用、曲目/画面/编队面板切换、衣装列表及Escape已测。完整灯光加载、换人/站位、全部版本、失败资源、返回歌曲来源尚未全部闭环。
- 摄影：地点空搜索/清空、人物/贴纸/相框/滤镜各素材页；相框/滤镜第二选项的实际aria-pressed变化；真实人物001tom、贴纸添加；检查器、锁/解锁、隐藏/显示、缩放、数值X移动、数值旋转、重置、删除/撤销；两贴纸后移顺序；保存/恢复构图、PNG预览、Fullscreen API进入退出均有证据。保存作用于隔离浏览器profile，没有覆盖用户Browser中的构图。PNG预览生成不是任意场景像素保真验收。

## 证据目录

根：`E:/Web_build/SideM_Archived/web_viewer/.analysis/ui-audit-a1/`。完整before/after文件名在每条transitions记录中。

| 目录 | 内容 |
|---|---|
| run-cF3Fxc | 目录搜索/清空/语言/刷新、五类详情语言刷新，111条 |
| run-X0NGdX | 360/430/768/1024严格谓词摄影素材、道具抽屉与舞台，88条 |
| run-QlUZRW | 360/430/768/1024画廊、摄影素材/文件面板及舞台面板，104条 |
| run-VVpj4m | 四图鉴抽屉恢复、Reader/Player返回、分类组合、两贴纸排序，108条 |
| run-LKxWeU | Reader正常关闭语义、冷刷新、组合返回补验 |
| run-M0QtQZ | 真实人物加入、X移动/旋转/重置；其早期故障注入准备失败记录未算产品缺陷 |
| run-V9JR8B | 仅阻断events read-model请求，恢复网络后点击重试成功（窄屏/桌面） |
| run-S8o4DH | PNG/SVG下载的实际文件签名与hash |
| run-E80HzJ | 摄影全屏API进出 |
| run-BHhQNp | 相框/滤镜精确选中谓词与轻量舞台 |
| run-K22EFW | 五类目录→详情→刷新→返回，组合使用单独补验 |
| run-0MQvUC | 歌曲→活动→刷新→返回原歌曲，窄屏/桌面均通过 |

旧失败迭代也保留。Reader旧断言忽略原生search首次Escape、摄影旋转手机控件为pointer-only、目录错误搜索入口及reload旧loader被截屏等已记录为工具/场景差异，没有算成UI缺陷。最新结果选择规则不把它们偷偷改写成PASS。

## P0–P3与未闭环风险

本轮**未确认新增P0/P1产品缺陷**；RR-01（P1标题/语言重叠）、RR-02（P2摄影条挤压）、RR-03（P3 iOS输入缩放风险）继续留在主台账，没有修改源码，不标RESOLVED。

必须单列的阻塞：既有`verify-portal-path-locator-browser.mjs`正确参数运行后返回exit1，59项中42通过、17失败。日志`path-contracts-corrected.log`，结构化结果与截图在`path-contracts-corrected/journey.json`及同目录。失败含刷新后返回、筛选恢复、部分工具页身份断言等；**这些不能按17个已确认产品缺陷处理**。该脚本使用旧等待/定位规则；Browser独立复核偶像刷新返回和歌曲→活动刷新返回均正常，新执行器对应双尺寸亦通过。其余失败仍需逐项复现与完整前后截图，暂为NEEDS_CONFIRMATION，不以“旧脚本可能过期”推定全部无效。

首次调用该旧脚本误用了`--base=`，而它实际接受位置参数；该次失败不计入产品判定。之后按位置参数重跑，以上17项是正确调用的结果。没有修改既有脚本来消除失败，也没有重置业务实现。

## 未执行 / PENDING清单

完整373条逐项状态见requirements.json；以下是关键缺口，不能由已通过的子流程替代：

| 区域 | 尚未完整执行 |
|---|---|
| 全局 | 担当切换全链路、全站滚动恢复精确数值、所有页面前进/后退、手机/桌面导航一致性、快速连击和页面重入全部组合 |
| 目录 | 各目录所有分类/复合筛选、非空搜索与URL逐字段一致、长列表到底、所有上级返回；图鉴分类组合只选3类 |
| 详情 | 六类全部关联内容、所有上一项/下一项、全部图片/多图手势、分享URL含历史上下文裁剪等 |
| 图鉴 | 获取方式/来源筛选、内部链接、触摸背景、背景关闭、滚动位置精确恢复 |
| Reader | 所有语言/说话人模式、多匹配逐处定位、连续阅读整章与多窗口搜索/目录同时出现 |
| Player | 指定step、全程结束/继续、语音失败/缓慢/缺失的受控注入，全部来源类型返回契约。事件目录失败重试不能代替语音失败 |
| 谱面 | 所有难度、播放跟随与内部滚动冲突、导出中进度、导出失败重试、全部选歌筛选恢复 |
| 舞台 | 完整加载、各演唱版本、换人/站位、帧率/资源失败、歌曲详情来源返回；轻量面板通过不能代表完整舞台等价 |
| 摄影 | 取消选择、多对象切换全组合、触摸画布拖动/捏合、素材上限、所有图层类型排序；数值移动不代表触摸拖动通过 |
| 真机 | iOS Safari、Android Edge/Chrome、平板触摸；软键盘遮挡、安全区、地址栏展开/收缩、横竖屏转向、hover残留、后台页面触摸隔离，全部PENDING |

这些缺口在本轮报告中保留，没有留给A2一个“全站交互已通过”的错误前提。

## 验证与交付边界

新增独立运行器/场景/源事件索引/要求矩阵/结果索引/汇总脚本及合同验证；测试配置只将两项verifier登记external。`verify-interaction-contracts`验证所有谓词可解析、route ID有效、1302条来源行一致、指定run及当前索引全部1102张before/after截图SHA256一致（551条动作记录）；verifier coverage和git diff --check通过。

未运行前端build或全量Source Gate：本轮没有生产Vue/CSS/依赖/入口变化。未生成完整媒体包。所有运行都在已有dev服务，不代表生产bundle、线上、音频内容保真或真机通过。没有UI修复PR，没有部署。本轮交付后停止，后续A2应保留本报告未闭环项。
