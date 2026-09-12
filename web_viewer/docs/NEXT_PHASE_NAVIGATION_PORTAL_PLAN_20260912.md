# 下一阶段：加载安全闭环与门户导航验收

日期：2026-09-12；核对基线：`dae8e0d`，分支 `codex/p1-effect-texture-deps`。
状态：**已规划，未实施、未验收**。本次只更新工作文档。

来源：用户附件 `739d9877-2898-4977-b988-cbab53afeec0/pasted-text.txt` 的审阅，以及用户要求规划代码/门户调试并写入工作 MD。附件提供建议，不作为逐条执行命令；下面是结合当前代码采纳并修正后的安排。

## 当前执行顺序

**B1 最低加载安全闭环 → B2 导航模型审计 → B3 来源/返回/恢复迁移 → B4 门户与档案旅程验收 → B5 引导文案及 UX 冻结 → 返回缓存/媒体增强 → pre-E 基线 → E2。**

不再等待完整 cache、弱网优化、长稳全部完成才开始门户。B2 的只读盘点和 fixture 编写可在 B1 未结束时提前做；不新增并行代理要求。B1 通过后停止扩展加载优化，切换导航主线。已知会破坏当前演出的严重资源/状态问题仍立即修复，不以切换阶段为由搁置。

个人、卡片、通信新增 Reader 入口继续停止；验证这些页面的既有导航不等于扩展 Reader。保留标题 v9、源剧情/译文身份、既有媒体边界；不引入 Vue Router、不重写全站、不扩大 strict-v2 发布、不默认 PR/部署。正式长稳后移，不写成已通过。

## 已核实的代码基线

| 现状 | 当前入口 | 对下一阶段的影响 |
| --- | --- | --- |
| critical 先行、后台续跑与当前步重排已实现 | `Preloader.js`、`prepareScenario.js`、`useStoryPlaybackController.js` | 复用同一个计划和取消归属，不重做资源扫描 |
| 运行时等待当前人物投影，同背景请求共享终态 | `useStoryRuntimeCues.js`、`SpineStage.vue`、`BackgroundManager.js` | 只是部分准备条件，不能宣布所有媒体 ready |
| Viewer 仍存在5秒 ready兜底；publish/导航finish会清loading | `StoryViewer.vue`、`useStoryPlaybackController.js`、`App.vue` | B1须共同收口，不能只删除超时 |
| canonical breadcrumbs 明确排除parent/return来源 | `src/core/archiveRoute.js:buildArchiveBreadcrumbs` | 保留这条边界，筛选和来源不混入层级 |
| 30个route contracts已有section/required/fallback | `ARCHIVE_ROUTE_CONTRACTS` | 以现有合同扩展，不另造不一致的导航表 |
| 多个ParentView与preserves条件集中在状态投影 | `useArchiveNavigationState.js:currentArchiveRoute`、App open/close | 来源、恢复渐进迁移；旧URL需兼容 |
| 顶部按钮仍固定“返回” | `ArchiveShell.vue` | label必须来自实际back target，不能只改文案 |
| Portal已有序列化往返，历史用push/replace和popstate | `archiveRoute.js`、`App.vue:open/closePortal` | 浏览器时间历史与页面语义返回分别验收 |
| CI已有部分runtime/asset/导航检查 | `.github/workflows/web-viewer-source-gate.yml` | B1核对覆盖清单再组合门禁；当前仅master push、PR、手动触发，分支push不等于CI已跑 |

## B1：最低加载安全闭环

产物：明确的playable contract、真实当前步准备/错误状态、buffering暂停原因、统一回归命令及CI接线。建议命令名 `verify:story-loading-safety`，**目前尚不存在**。

1. 按当前入口及当前步列出真正阻塞演出的资源：舞台实例、入口背景纹理、可见人物/剪影、当步必需的音频及效果。显式无资源的步骤可立即通过；不要求整集完成，也不等待动画播完才允许启动。
2. 资源准备、源状态投影、时钟启动、加载提示消失分别明确owner。沿用source/instance/generation/AbortSignal；过期完成、失败、重试均不能影响另一实例。消除5秒假ready，取消不能变成成功或重试错误。
3. 首屏和远跳都使用同一当前步门槛。等待时冻结cue clock及对应声音/自动推进；完成只移除buffering原因，保留用户Pause、后台隐藏、菜单等独立原因。失败有可理解提示、重试和返回，避免无限等待。
4. 音频缓存/共享解码可以后移，但必需声音尚未准备、浏览器阻止播放、已知无音轨、用户显式静音必须分别定义。不能用“audio后移”允许时钟随机先跑，也不能自动取消用户静音或暂停。GPU readiness以真实实例/纹理可用为证据，不承诺无法证明的全GPU驻留。
5. 复用现有entry-retry、preload-status/cancellation、spine/config-preload、stage-readiness、background-loading、camera-clock、audio/pause检查；新增受控慢资源与失败用例。CI仅使用已跟踪fixture，不依赖本机RAW或忽略compiled目录。

退出验收：冷入口、远跳、失败→重试、等待中返回/换故事、等待中手动暂停、隐藏恢复、静音/音频受限均有证据；必要资源未准备时演出时钟不走，恢复不释放其他暂停。source-only自动回归与真实Browser短验收分别记录。**达到此门槛即转B2/B3；transport合并、跨场景audio cache、弱网性能调优不作为转阶段门槛。**

## B2：导航模型审计与合同冻结

不改UI。交付全部30个当前view的清单（未来新增由差异检查发现），每项记录 canonical parent、section、实体身份、实际入口、back origin、恢复字段、无来源deep-link fallback、现有open/close和测试位置。来源不明标待核实，不根据页面名猜测行为。

三层合同：

- **层级**：canonical hierarchy只决定结构归属、面包屑、section和无来源fallback。同一活动从卡片/组合/门户进入，层级一致。审阅中card canonicalParent携带rarity/query的例子不照搬，筛选属于恢复。
- **来源**：页面返回消费有效back target；建议结构为规范化`route + labelKey/entity identity + reason`，label由实际目标生成。验证白名单、必需字段、自指/循环、来源实体失效和深度上限；无有效来源才用canonical fallback。
- **恢复**：可分享的筛选/搜索/tab保留在规范化URL；滚动、焦点、Reader行等易变状态按history entry与route身份保存。数据渲染完成后恢复；过期实体/行/筛选有确定回退。刷新后的降级规则须明示，不能只保存view名称。

浏览器Back/Forward沿时间历史；顶部返回沿来源；breadcrumb沿层级。不要强求三者去同一页。popstate恢复不再push，顶部返回是否replace/push由旅程合同固定并测循环，不能每个close各自决定。Portal是入口页；关闭Portal恢复进入前页面，不能用Portal按钮代替页面返回。

退出验收：完整view清单、24条旅程的具体有效实体/route fixture、每条预期、旧URL兼容及状态归属决策齐全。下表是待落地的用例范围，**不是现有功能PASS清单**。

## Navigation Matrix：24条待执行旅程

| ID | 入口与操作 | 顶部返回/恢复预期 |
| --- | --- | --- |
| N01 | Portal→故事→主线集合→章节 | 回对应集合/主线位置，Portal仍是入口 |
| N02 | 活动列表→430018 | 返回原活动筛选与列表位置 |
| N03 | Jupiter→关联歌曲 | 返回Jupiter；当前组合详情无tab，tab恢复为N/A |
| N04 | Jupiter→关联活动430018 | 返回Jupiter；活动breadcrumb不变 |
| N05 | 活动430018→报酬卡 | 返回该活动及原滚动位置 |
| N06 | 卡片详情→关联活动→返回 | 返回该卡，再返回原筛选列表 |
| N07 | cards冬马/SSR/搜索→卡片→返回 | 筛选、搜索、位置、焦点恢复 |
| N08 | 卡池列表→卡池→卡片 | 回卡池，再回原列表 |
| N09 | 偶像详情→卡片→返回 | 回原偶像；当前偶像详情无tab，tab恢复为N/A |
| N10 | 歌曲列表筛选→歌曲→返回 | 回原歌曲列表状态 |
| N11 | 歌曲→关联剧情集合→Player | 逐层返回集合、歌曲 |
| N12 | 主线Reader→Player→Reader | 同文档、模式、原行/位置 |
| N13 | 活动Reader→Player→Reader→活动 | 原活动430018，不丢parent |
| N14 | Work选偶像/tab→Reader→返回 | 回原偶像Work tab |
| N15 | 剧情详情→Player→返回 | 回原详情及其来源 |
| N16 | 组合剧情→Player下一集→返回 | 队列推进不改来源集合 |
| N17 | 带筛选详情→打开Portal→关闭 | 精确回原路由和恢复状态 |
| N18 | Portal→另一个section→浏览器Back/Forward | 沿时间历史恢复，不重复push |
| N19 | 无来源card_detail深链 | 有效卡回cards；无效卡明确fallback |
| N20 | 无来源event/song/gasha深链 | 各自确定fallback；刷新一致 |
| N21 | Reader/Player深链缺失或过期文档/行 | 可解释错误与有效返回，无循环 |
| N22 | 快速A→B导航，A响应迟到 | 页面、来源label、恢复均只属于B |
| N23 | 工作/个人/通信既有页往返Portal | 保留已支持的选择/tab；不新增Reader |
| N24 | 档案资源→Spine/Chibi实验页→返回 | 回对应资源入口；生命周期清理 |

每条都核对8项：section、canonical breadcrumb、Back label、Back target、恢复状态、浏览器Back/Forward、刷新、桌面/移动语义。确实不适用填N/A及原因，不以缺证据填PASS。B2选定实体后固定fixture；关系缺失如实记录，不为了凑路径创建虚假关系。

## B3：逐域实现来源与恢复

建议改动边界：`archiveRoute.js`合同/规范化 → 独立纯back-target解析与验证 → navigation state/coordinator接线 → App open/close → ArchiveShell label。命名以B2结论为准，不先搭空框架。

先迁移N02/N05/N06卡片↔活动闭环，再组合/歌曲、Reader/Player/Work，最后Portal与其他view。每批旧parent/return字段通过单一兼容适配进入新模型，迁移域不能再保留两个写入owner；来源路由包含必要实体与筛选，避免只用parentView丢失来源。不得递归复制整个history或将任意对象塞进query。

B3先提供准确可测试的目标名称；B5再润色文案。完成的域运行其矩阵及既有routes、archive-navigation-state、archive-async-navigation、archive-startup-route、portal-navigation、reading导航/播放回归，然后做真实Browser小验收再提交。不要等全部域改完才第一次点页面。

## B4：门户与档案交互大验收

完整24条矩阵在desktop（至少1280宽）和390px执行：正常点击、刷新、浏览器后退/前进、来源返回、Portal round-trip；320/430px补入口网格、长标签、安全区和触摸目标边界。校验真实URL/实体/可见状态、截图、console、横向溢出、焦点与滚动恢复；非必要Reader入口不得加载舞台/声音。

同一部署版本和数据版本记录证据。建议产物 `ARCHIVE_NAVIGATION_ACCEPTANCE_YYYYMMDD.md`，逐条附环境、动作、预期、实测、证据路径和未解决项。构建/URL单测不等于浏览器验收；浏览器短测不等于pre-E长稳。发现问题回其owner修复、补fixture、重测影响路径，避免零散按钮补丁。

## B5：引导收口与冻结

导航稳定后统一“返回目标”、landing一句用途说明、“阅读/观看演出”、关联活动/收录歌曲/相关卡片、实验badge、空状态与错误状态、按钮优先级。无需新手弹窗或新导航系统。UI标签若改变，同批更新可访问名称与旅程定位。

冻结条件：全部view有合同；24条矩阵完成或有明确不适用依据；无已知错误来源返回、刷新丢关键状态、history循环；桌面与移动同语义；遗留问题有范围和处理决定。冻结是导航行为/文案基线，不冻结可访问性或缺陷修复。之后恢复shared transport/audio cache、媒体能力增强、弱网与长稳路线；E2仍受既定基线门槛约束。

## 执行记录规范

每批记录输入HEAD、实际改动、验证命令及结果、Browser证据、遗留风险、commit/push。明确“计划/实现/机器回归/真实浏览器/长稳”五种状态。只提交相关路径，保留未跟踪v9 HTML；沿用当前分支，不默认开PR或部署。

下一步具体动作：先写B1当前资源→消费者→就绪/失败信号表及可控慢资源用例；同时可做B2只读view/入口盘点。不要继续以修完所有cache作为门户开工条件。

## B1执行结果：当前步playable门槛

输入HEAD `a920616`。Player发布scenario后保持独立`playbackBuffering`；当前步只有在同一播放实例、同一源step的人物投影完成、所需人物存在Spine或剪影可渲染对象、剪影图片不再pending，并且入口背景请求返回completed后，才发布`playable`。人物缺失或背景失败发布`blocked`，停止共同cue时钟和Auto，退出全屏等待并显示“重试当前段落/返回”；重试保留来源文件、播放范围、返回目标和episode queue，以该源数组索引重新进入。旧实例、旧step和已经撤销的异步结果不能解除当前等待。

StoryViewer删去5秒兜底ready与重复首步warmup。环境音、BGM、voice及旧自动推进计时改到`playable`回调后启动；等待/阻断使用独立buffering pause reason，与visibility、overlay、audio-lock并存，解除buffering不会误解除其他暂停原因。这里的playable表示当前画面可渲染及入口背景落定，不表示所有后续媒体已缓存，也不声称音频已提前解码。

新增统一`verify:story-loading-safety`并接入source gate，覆盖入口critical/retry、后台预热、预载状态/取消、实例隔离、当前步人物/背景门槛、暂停/恢复、背景生命周期和音频session。真实Browser从活动430018进入episode2：首屏等待后显示5/26；点击下一段时再次显示“正在准备当前画面…”，随后才显示6/26。1280×900和390×844均无横向溢出，390画面中背景与翔太均为1.3倍，console error为0。构建产物位于仓库外`C:/Users/windm/.codex/qa/sidem-loading-safety-b1-20260912/build`。

B1当前安全门槛到此冻结；后续缓存复用、弱网和长稳不作为B2开工前置。下一步按B2只读盘点所有view/入口/现有来源字段，产出24条旅程的fixture和差异表，再决定最小导航模型改动。

B2首轮盘点见[ARCHIVE_NAVIGATION_B2_INVENTORY_20260912.md](./ARCHIVE_NAVIGATION_B2_INVENTORY_20260912.md)。已确认N05/N08/N09和N24为源码级断点；第一实现批从卡片详情的单层、有界来源路由开始，覆盖活动/卡池/偶像进入卡片及既有筛选列表返回。

第一实现批已完成N05来源/刷新Browser闭环，并让N06/N07/N08/N09共享同一单层来源合同；详见B2 inventory执行结果。下一批先修N24 archive_status→Spine/Chibi返回，再执行N18 Portal Back/Forward与详情列表滚动/焦点恢复审计。

N24的Spine来源/刷新返回已修复并实测，Spine/Chibi互跳沿用同一资源来源。下一步转入N18 Portal Back/Forward和列表滚动/焦点恢复。

N18已完成真实Browser的Portal→歌曲→Back/Forward及关闭Portal恢复筛选来源。列表恢复第一批也已落地：导航层用规范路由与history entry双键保存内部滚动和实体焦点，卡片、活动/剧情、歌曲、卡池目录接入统一标记；N07筛选路线、桌面和390px长列表均已实测。下一批不再修改恢复模型，直接执行N02活动、N10歌曲及N06/N08/N09的具体Browser旅程，发现域内缺口再回对应owner修复。

N02活动目录和N10歌曲目录现已在1280×900与390×844完成长列表滚动/焦点恢复，歌曲scope/query路线也已实测，二者改为PASS。卡片目录偶像标题同时改回master-data源名，`天ヶ瀬 冬馬`与切换器保持一致。下一批直接补N06/N08/N09关系旅程。

N06/N08/N09关系旅程已完成真实Browser验收：北斗活动关联卡逐层返回3项筛选列表，卡池210003经关联卡刷新后逐层返回57项列表，冬马偶像详情经19张卡片及`001tom_ssr02`逐层返回原偶像；对应实体焦点与长列表滚动均恢复，源名保持`天ヶ瀬 冬馬`。偶像详情当前不存在tab控件，因此N09的tab项明确记为N/A。下一批执行N03/N04组合关系旅程及N24 Chibi完整视觉路径。

N03/N04已以Jupiter→`unmikn`歌曲、Jupiter→活动430018完成Browser验收：详情保持各自canonical breadcrumb，顶部返回恢复`unit=01jup`；组合详情无tab，N03 tab项为N/A。N24也已完成`archive_status`→Spine→Chibi 5/5角色就绪→资源页的视觉旅程，并为Chibi卸载时的动画、媒体、图层、runtime和Pixi资源释放补充回归边界。下一批执行N11及N12/N13的剧情集合、Reader与Player逐层返回。

N11以`drv999`→额外剧情602→Player完成逐层返回原集合与歌曲；N12主线Reader的`1_4_001_01_d / step-8 / bilingual`在Player返回后恢复版本、行、焦点与正文滚动。N13实测发现Player返回Reader时会丢活动的Jupiter父来源，现已让活动Reader/Player共同序列化并恢复`category/unit/event/parent/from`，真实Browser可从Reader逐层返回活动430018和Jupiter。相关reading、routes、navigation-state、async回归及生产构建通过。下一批执行N14 Work选择态与N15详情→Player来源旅程。
