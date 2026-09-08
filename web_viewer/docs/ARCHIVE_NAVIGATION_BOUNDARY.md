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
