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

其他 feature 的数据派生与展示组合仍留在 App；后续继续提取功能边界。
完整桌面/平板/390px、快速历史连续操作与真实慢网络矩阵仍未覆盖。
被动过滤 watcher 与启动数据加载尚未纳入完整的用户意图模型，不把本批
显式导航时序回归外推为所有输入/启动竞态均已解决。
