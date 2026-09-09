# 导航状态边界

2026-09-08，重构 F2。`src/core/useArchiveNavigationState.js` 现在拥有原 App 中
39 个 URL/返回上下文 ref，以及 `currentArchiveRoute()` 投影。App 解构的是原 ref，
不是值快照；模板、computed、watcher 和现有导航动作仍读写同一份状态。
每次调用创建独立实例，无全局缓存、window 访问或额外 history listener。

导航状态涵盖当前 view、选中实体/分组、检索过滤、首页选择、播放器文件/起止范围、
return/parent 上下文。currentGroup/currentUnit 保存选中的上下文对象引用，模块不
加载这些对象。完整剧情 payload、播放队列、音频、loading/preloadProgress 与资源
索引不归该模块；它也不决定数据缺失时应该退回哪个产品页面。

投影保留既有规则：player 只在匹配的 returnView 下携带 event/story/collection
上下文；song_detail 或歌曲下的 collection 保留歌曲身份；unit 返回上下文优先
archive unit；非播放器不输出 scenario/voice/start/end；非首页不输出首页选择。
既有过滤参数保留方式未改，不能把此提取当作 URL 清理或 query 语义调整。

`archiveRoute.js` 继续拥有 query 编解码和浏览器 history API；App 暂时仍负责
applyArchiveRoute、数据依赖等待、commitView/sync、popstate 安装/释放及播放器加载。
F2 没有引入第二份 route store，也没有声称修复异步导航覆盖问题。

## 验证

`npm run verify:archive-navigation-state` 使用冻结自 `59c906e` 的测试专用旧投影，
对 28 个视图 × 8 个 returnView × 8 个 parentView（1,792 组）逐属性和 URL 对照；
同时验证 39 个 ref 的实例隔离、初始化值、player/非 player 字段、歌曲 collection
和 event→unit 返回规则。旧投影只在 fixture 使用，不被产品代码导入。

routes、song-domain-landing、story-collections、main-story-domain-landing、
idol-story-interface 与 source-only Vite 构建通过；歌曲测试已由检查 App 内的
投影源码改为调用实际导航模块。CI 已加入新导航验证。

内置浏览器桌面执行：直接打开 C.FIRST collection → 点击歌曲 → 浏览器后退。
collection 参数、4 章/40 段和截图均恢复，无 error。此为一次真实历史恢复冒烟，
不是所有视图、快速连续后退、慢网络或完整响应式矩阵验证。

## F3：异步导航生命周期

`ArchiveNavigationCoordinator.js` 统一拥有当前异步导航的有效性和历史恢复期间的
URL 写入抑制。剧情 fetch/preload、历史恢复和异步功能入口在等待后检查同一
intent；普通切页与详情选择使旧 intent 失效。旧请求可以完成共享资源加载，
但不能覆盖新页面、进度或清除新导航的 loading。没有中止底层网络 I/O。

历史恢复内的剧情加载继承外层 intent，因此旧恢复结束不会提前解除新恢复的
URL 写入抑制。卸载使未完成动作失效并拒绝新动作；当前失败仍按原路径报告，
已失效动作的失败不再影响当前页面。App 保留产品选择规则、缺失数据回退和
加载动作本身，F2 的 ref 与路由投影不变。

`npm run verify:archive-async-navigation` 执行 App 的实际导航函数与生产控制器，
用可控的异步依赖复现旧剧情晚到、新旧预加载交错、并发历史恢复、功能模块晚到、
用户切页/选择、当前失败和卸载；验证页面、范围、返回上下文、history、进度和
loading 的归属。依赖为测试替身，不等于真实网络竞态或音频长稳验证。CI 已接入。

F3 验证：上述时序回归、1,792 组投影、routes、story-collections、
idol-story-interface、song-domain-landing、story-playback-range 与 source-only
Vite 构建通过。Browser 实际执行 C.FIRST 合集 → 第一段剧情 → 返回合集，
并验证浏览器后退恢复合集、前进恢复剧情，error 日志为空；剧情 URL 为 `episodes/1_1_016_01_a.json`，
start=2/end=26/return=story_collection，合集恢复 4/4 章、40/40 段。
使用 noAudio=1；不计作 P2-B 真实音频长稳验收。

## 后续

F4 的首个功能适配边界为 `src/data/cardVoicePreview.js`：卡片已有 cue 查找和
单步预览 payload 组装已移出 App。它不导入 Vue 或播放器；调用方显式传入
显示名解析函数，兜底 speaker 按传入卡片的 character_id（缺失时 resource_id
前缀）解析，不再取当前页面选中的偶像。来源 preview_step 深拷贝，只把
step_id 设为 1，并保留 source_scenario_id/source_compiled_file。
既有默认舞台、文本和口型路径保留；没有将兜底预览升级为正式编译剧情。

`verify:card-voice-preview` 遍历提交的 836 张卡片，覆盖 2,564 个来源 step 和
3,457 个兜底项，验证来源保真、深拷贝隔离、cue 查找优先级、未知 cue 拒绝、
说话人和口型归属。异步导航回归额外执行 App 实际语音打开函数，覆盖过期
预览和另一偶像被选中时的预览。卡片语义字典验证与源码构建通过。
Browser 用 noAudio=1 直达 `001tom_r01` / `2_2_001_01_02_00`，显示天濑冬马，
再返回同一卡片详情，error 日志为空；来源文本 `0` 原样保留。此为导航与
内容组装冒烟，没有验证真实音频播放或长稳。

F4 的播放队列由 `src/core/useEpisodeQueue.js` 拥有成员快照、游标、下一段与清空。
App 只从合集/活动/偶像剧情提供有序分段，负责加载及返回页面；连续播放偏好
仍由 App 保存。关闭播放器、独立剧情加载和语音预览清空队列。历史恢复按
file 加已提供的 start/end 匹配，范围不匹配时不继承旧队列；无范围旧链接仍选
文件的第一项。解决的是共享文件兼容路径的错误游标，未改动已发布剧情。

`verify:episode-queue` 验证当前主线/组合前传 744 个分段的恢复与下一段；当前
这些产物都使用独立分段文件。共享文件、多范围、缺失项、旧链接与隔离另用
合成样例覆盖；异步导航测试执行 App 的真实恢复动作，确认范围传入队列。
时序回归、story-playback-range、story-collections 与源码构建通过。
Browser 实测 C.FIRST 第二段（`1_1_016_01_b.json`）跳过本话后点击下一话，
进入第三段（`1_1_016_01_c.json`，start=1/end=26），显示第三段对话、无加载
遮罩残留，error 日志为空。使用 noAudio=1，不是连续实音长稳验收。

其他 feature 的数据派生与展示组合仍留在 App；后续继续提取功能边界。
完整桌面/平板/390px、快速历史连续操作与真实慢网络矩阵仍未覆盖。
被动过滤 watcher 与启动数据加载尚未纳入完整的用户意图模型，不把本批
显式导航时序回归外推为所有输入/启动竞态均已解决。

## F5：卡片筛选不再读取 App 状态

`src/data/cardFilters.js` 接收卡片列表、搜索/稀有度/资源/关联条件，以及显式资源、
活动与卡池关系映射。App 保留 computed 和筛选状态，只负责传参。筛选模块
不导入 Vue、repository 或播放器；保持既有大小写搜索、未知条件回退、缺失
资源处理和空关系数组也代表关联存在的语义，不修改卡片对象或列表顺序。

迁移时保存旧 App 实际函数作本地对照，826 张规范化卡片、1,225 组条件逐项
deepEqual 通过；`verify:card-filters` 固定旧实现的结果摘要作为公共数据回归，
另外覆盖缺失数据、搜索、空关系数组、对象身份和输入不变性。未来卡片产物
变化需有意更新摘要，不能把摘要不匹配自动当成筛选逻辑错误。已加入 CI。

publicDir:false 生产构建通过。浏览器进入天濑冬马卡片页显示 All 19、SSR 3，
点击 SSR 显示 ssr01/02/03，进入 ssr01 详情并返回后保留 rarity=SSR。
此为实际筛选与详情返回冒烟；资源/关联组合的等价证据来自上述全数据对照，
未新增窄屏矩阵或卡图像素比对。

## F6：卡池目录与关联卡片派生

`src/data/gashaCatalog.js` 负责主卡池选择/逆序、分类选项、复刻或主卡池来源的
关联卡片解析、分类与搜索。App 只传入 index、筛选条件和 idolEntitySearchText，
翻译与响应式状态留在调用方；纯模块不导入 Vue、repository 或播放器。
保留分类数量取自 index.meta、关联卡片沿来源顺序筛选、无关联返回原对象等行为。

迁移时用旧 App 实际代码对照：57 个主卡池、61 个详情、25 组筛选全部 deepEqual。
verify:gasha-catalog 固定此次完整目录/详情/筛选摘要，补充复刻来源、缺失来源、
本地化名称搜索与输入不变性回归；产物变化需有意复核摘要。已加入 CI。
publicDir:false 生产构建通过，保留原有两个背景路径构建警告。

浏览器目录显示 57 条，GROWING FES 筛选显示 4 / 57；进入 13000911 详情，
显示三张 Derived 关联卡片，返回保留 growing_fes 分类。该项为桌面功能冒烟，
未覆盖窄屏矩阵；复刻分支由可控样例与全详情对照验证。

## F1–F6 综合回归：代码基线 9a0ed64

卡片与卡池提取完成后，在干净工作区重新执行以下关联门禁，全部 exit 0：

| 命令 | 此次证据 |
| --- | --- |
| `npm run verify:archive-data` | 27 个当前产物契约；请求去重、刷新/清理竞态、重试、部分结果与延迟加载错误 |
| `npm run verify:archive-navigation-state` | 39 个导航 ref，1,792 组视图/返回/父级投影及 URL 用例 |
| `npm run verify:archive-async-navigation` | 剧情加载、预加载、历史恢复、延迟 feature、语音预览、失败及销毁竞态 |
| `npm run verify:archive-baseline:source-only` | 10,329 个 compiled JSON 与 183 个已跟踪 PNG 的源码基线 |
| `npm run verify:routes` | 故事入口与详情路由契约 |
| `npm run verify:card-semantic-dictionaries` | 836 张卡片，160 个技能与 53 个中心技能 |
| `npm run verify:song-domain-landing` | 60 部作品/61 个歌曲实体、47 个正式组合映射、13 个明确演唱者歌曲与双向链接 |
| `npm run verify:story-domain-identity` | 主线 3/22/204、生日 51 集合/181 条目及额外剧情 10 作品/47 条目的域身份 |

这些检查补足独立 selector 对照之外的跨页面契约证据。该批没有发现需要修复
的集成回归，不修改运行时代码。它不是所有 CI 门禁或浏览器矩阵的通过记录。

F 仍未完成：App 中偶像资料/统计/歌曲及活动关系派生仍直接组合索引；被动过滤
watcher 与启动加载仍待审计；平板/390px、快速历史连续操作及真实慢网络完整
矩阵尚未验收。下一项架构工作从偶像页面的数据派生边界继续，不重复已通过
的卡片/卡池等价迁移。E 的逐 channel 状态计划、G 的 publish/compiler 边界与
真实音频长稳也不能由此综合回归推定完成。

## F7：偶像详情的数据派生

`src/data/idolPage.js` 提供独立的 profile、stats、events、songs selector。
App 只在各 computed 中显式传入所需索引，保持响应式依赖分开；卡片数量仍
复用 cardsForCharacter，歌曲证据标签沿用明确表 46 / 正式组合补全两种依据。
资料覆盖优先级、仅首个个人故事 chapter 的统计口径、通信条目过滤与活动/
歌曲排序均保持原行为，不将此迁移视为统计口径修正。

旧 App 实际计算函数与新模块对照，49 位偶像加缺失 ID 的四组完整结果逐项
deepEqual；verify:idol-page 固定结果摘要，并验证组合资料优先级、缺失数据、
缺失通信条目、歌曲证据标签及输入不变性。公共产物更新需有意复核摘要。
已加入 CI；异步导航、歌曲域回归和 publicDir:false 生产构建通过。

浏览器冬马页面显示 19 cards / 13 segments / 20 chats / 9 phones、4 songs、
2 events；点击下一位到翔太，资料更新为 002sht，统计为 17 cards / 18 chats /
6 phones，歌曲明确映射变为リトルハピネス，活动更新为 3 条。此为实际响应式
切换冒烟，未覆盖窄屏布局或全部偶像的浏览器逐页验收。

## F8：启动数据加载后读取当前浏览器路由

App 原来在 loadArchiveData/实体翻译 await 之前捕获 initialRoute，加载期间
浏览器历史变化后仍恢复旧地址。现将 readArchiveRoute 移到实际 applyArchiveRoute
调用处，使用两组初始化加载结束时的最新地址。既有销毁检查保留。

verify:archive-startup-route 在 VM 中执行 App 的实际 onMounted 回调，以可控
数据/翻译 Promise 模拟两次地址变化。旧实现先复现恢复 cards/001tom 而不是
idol_detail/002sht；修复后恢复并写回最新地址，卸载后无恢复或地址写入。
已加入 CI，异步导航、routes 与 publicDir:false 构建通过。

该测试没有启动真实浏览器或注入真实慢网络。applyArchiveRoute 自身异步恢复
期间的历史变化、初始化前页面内交互、被动筛选 watcher 仍需进一步审计；
本批只关闭初始数据/翻译加载窗口中的过期地址问题，不视为 F 完成。

## F9：初始路由恢复期间接收历史导航

F8 后仍有第二个窗口：applyArchiveRoute 可能等待剧情或 feature 资源，此时
popstate listener 尚未安装。现在在首次恢复前安装监听；每次恢复分配本地
generation，仅最新一次恢复完成后设置 archiveRouteReady 并写回规范化地址。
旧恢复仍交给已有 navigation coordinator 取消发布，启动完成归属单独校验；
新页面无需等待旧资源请求返回即可完成启动。

扩展 verify:archive-startup-route，执行生产 onMounted，暂停首次 player 恢复，
在此期间触发 gashas 历史导航。旧实现先复现 listener 为 undefined；修复后
新恢复先完成并写回一次，旧恢复随后结束不重复写入。F8 的加载期地址变化与
销毁用例仍通过。异步导航和 routes 回归通过；测试没有真实浏览器网络注入，
尚不能据此声称全部启动/页面内交互/筛选竞态已覆盖。

本批 publicDir:false 生产构建通过，保留已有背景路径构建警告。

## F10：显式筛选事件拥有导航意图

搜索与偶像组合、卡片稀有度/资源/关联、卡池分类、歌曲范围、故事分区清除/
活动范围/可用性/排序事件，统一调用 updateArchiveFilter。值实际变化时先
invalidate 旧导航并清除旧加载标记，再写入目标 ref；相同值不取消加载。
URL replace 仍由原有 watcher 处理。路由恢复直接赋 ref，不经过用户事件入口，
因此不会因程序赋值取消自身。子组件的 query 更新源已核对为输入事件转发。

扩展异步导航 verifier：延迟个人页恢复期间输入搜索，旧行为先复现 pending
仍为 true；修复后旧恢复不覆盖当前卡片页与搜索。另覆盖十类筛选在剧情加载
期间更新、旧请求不发布、重复相同输入不中断加载。启动恢复、routes 与
publicDir:false 构建通过；未人为注入浏览器慢网络，竞态证据来自生产函数
和真实 coordinator 的可控 Promise 回归。

浏览器冬马卡片页 All 19 → SSR 3，非 SSR 条目移除且 URL 写入 rarity=SSR，
确认模板事件已接通新入口；此冒烟不代替慢网络竞态测试。

## F11：剧情加载失败不进入播放器

loadScenario 在 HTTP 响应后先检查 intent 是否仍有效，再检查 response.ok；
解析后要求剧情对象具有 steps 数组。HTTP 错误或基本结构错误不进入预加载，
不替换页面/当前剧情，也不写路由，沿用原有错误记录与 loading 清理。
过期响应直接退出，不再解析可能昂贵或报错的 JSON。空 steps 数组仍合法，
此边界不是完整剧情 schema 验证器。

异步导航回归在旧实现复现 JSON 404 使 cards 页面进入 player。修复后覆盖
404 JSON、200 错误对象、非数组 steps、null，以及已失效请求的 500 响应不
解析/不报当前错误；检查无预加载、无地址写入、原页面保留和 loading 清理。
现有成功加载与导航竞态、启动恢复和 routes 回归通过。

publicDir:false 生产构建通过。本批错误注入采用生产 App 函数与可控响应，
未在浏览器代理层注入 HTTP 故障，不将该证据外推为真实网络矩阵验收。

## F12：剧情准备与页面发布分离

`src/data/prepareScenario.js` 负责 no-store 请求、HTTP/steps 基本校验、并行等待
播放器模块与剧情资源、有效请求的进度通知；它不导入 Vue、Preloader 或播放器，
通过回调传入这些依赖。成功返回原剧情对象，过期返回 null，当前错误交给调用方。
App 保留 navigation.run、loading ref、队列、分段范围、当前剧情及路由发布。
没有新建共享缓存或改变请求时间戳、加载顺序和 F11 错误处理语义。

原异步导航 verifier 现在将生产 App 与真实 prepareScenario 接通，既有请求/
预加载/历史/失效进度/错误回归通过；新增独立调用验证 URL/cache 参数、两项
加载并行启动、只完成资源时不能返回、进度转发和返回对象身份。启动恢复、
routes 与 publicDir:false 构建通过。

浏览器 noAudio C.FIRST 剧情加载完成后进入第 2 段，前进到第 4 段显示预期
天峰秀对白，再返回集合 16。此为正常加载集成冒烟，不替代慢网络或实音长稳。

## F13：按需数据的页面发布归属

`lazyArchiveResource.js` 统一卡片详情与偶像通信的页面级等待、复用、失败重试和
卸载保护；repository 继续拥有 HTTP 请求、缓存与产品契约。App 提供 read/load/
publish 回调，通信的三个索引仍在组合加载成功后一起发布。卸载后的成功结果
不写 ref，迟到失败不输出页面错误；当前失败返回 null，下一次调用可重试。

verify:archive-data 已纳入独立回归，覆盖并发只加载/发布一次、实例隔离、已加载
读取、失败重试、同步异常、卸载前后成功/失败。数据、异步导航、启动恢复、routes
与 publicDir:false 构建通过；构建保留此前两个背景路径的运行时解析提示。
浏览器从冬马详情进入 19 张卡片目录，再进入 001tom_ssr01，通信数量、能力技能、
衣装和语音文本正常显示。故障/卸载采用可控异步验证，未作浏览器网络故障注入，
亦未执行实音长稳。

## F14：启动恢复与页面操作共用导航版本

启动 wrapper 原先仅按历史恢复次数判断收尾资格；页面内新导航未参与该计数，
迟到的首次恢复可能清除新加载的 loading，并在 archiveRouteReady 尚未开启时
阻断新页面的 URL 写入。现在 coordinator 对 begin/invalidate/dispose 统一递增
版本，启动 wrapper 仅在版本仍匹配时规范化地址。基础数据与翻译就绪后开启
地址同步，进行中的恢复仍由 isRestoring 抑制；页面操作取得导航归属后可直接
同步地址，不再等待过期恢复。

启动 verifier 执行实际 App startup/sync 函数与真实 coordinator，覆盖首次恢复
未完成时同步切页、异步加载新页面：旧恢复不得清除新 loading、不得写地址，
新页面完成仅写一次。原历史竞争、卸载、异步导航与 routes 回归通过。
publicDir:false 构建通过，保留两个已知背景路径运行时解析提示。本批竞态由
可控 Promise 验证，未声称浏览器慢网络矩阵或实音长稳已完成。

## F15：额外剧情关联卡池的返回目标

额外剧情作品打开关联卡池时，原先返回固定进入卡池列表。现在导航状态拥有
gashaParentView，沿用 URL 的 parent=story_collection 与 story_type/story_section
保存来源；刷新恢复仅接受带作品标识的 extra 来源。返回前验证作品仍存在，
无来源、无效来源或作品缺失时回到卡池列表。卡池列表进入详情仍保留查询与
分类，面包屑仍表达卡池的目录层级。

verify:archive-navigation-state 保留冻结的 1792 个旧投影用例，并执行生产入口、
恢复赋值与返回函数，覆盖作品来源、URL 往返、无效来源、缺失作品与列表筛选。
routes、startup-route、gasha-catalog 和 publicDir:false 构建通过；构建仍有两个
已知背景路径运行时解析提示。

2026-09-09 内置浏览器 noAudio 实测作品 604 → 卡池 1300011 → 重新加载详情 →
返回作品 604；筛选 growing_fes/q=FES 的列表进入同一卡池后返回，地址与搜索框
保留筛选。直接打开无 parent 的卡池详情返回卡池列表。此为导航验收，不是实音或完整响应式验收。

## F16：组合页面的领域派生

`src/data/unitPage.js` 负责组合目录、代码/数字 ID 查找、前传和已确认归属的歌曲。
成员名单由 manifest membership 选出，字典只补原有显示元数据；卡片摘要复用
现有 selector，活动关系保留原 evidence 对象。App 只组合这些纯函数和页面 refs，
currentArchiveUnitMembers 复用 currentArchiveUnitEntry，不再重复查找同一组合。

verify:unit-page 已接入 source CI。冻结 eff79c7 的原 App 投影作为独立对照，
逐项比较 16 组合/34 种 ID（含空值和缺失）下的完整目录、成员、卡片、活动、
前传与歌曲结果；另验证 membership 优先、缺失关系、严格歌曲归属、排序和输入
不变。导航 1792 用例、idol-page 及 publicDir:false 构建通过。

2026-09-09 内置浏览器 noAudio：目录显示 16 个组合，Jupiter 为 3 成员/52 卡片/
2 团活；详情成员、3 首歌曲、2 团活、2 属性团曲出演与 3 条组合剧情可见。
实际进入 BRAND NEW FIELD 后返回 Jupiter，unit=01jup 恢复。未播放音频，
不将该导航检查称为实音长稳或完整响应式验收。
