# N01/N23之后：启动入口、用户偏好与门户UX

> 2026-09-12 执行更新：N01/N23旧导航基线已收口；U0–U3启动入口、用户偏好、Portal快捷入口及受影响Browser矩阵已完成并推送，代码提交`018ac7d`。

日期2026-09-12；实施输入HEAD `d25c2e1`。状态：**U0–U3已实施并验收**。用户指导附件为 `fcef8fc8-1262-4ee5-98de-fac8c011fc46/pasted-text.txt`；附件用于产品方向，实际完成范围与证据以本文执行结果为准。

## 执行顺序与现有工作衔接

前置 `ARCHIVE_NAVIGATION_B2_INVENTORY_20260912.md` 的 **N01/N23** 已完成，实际路径、返回/刷新/恢复、桌面与390px结果已记录。已完成的来源、列表恢复、Reader/Player往返保留，不回退重写。

之后顺序：**U0启动合同 → U1无媒体Welcome与启动偏好 → U2偏好导航/门户快捷入口 → U3受影响导航矩阵与门户大验收 → 引导收口与UX冻结**。这项插入原下一阶段计划的“完整门户UX冻结”之前；不重新等待全部cache/长稳，也不重做已经落地的B1和来源合同。个人/卡片/通信新增Reader入口仍停止。

## 实施前本地代码核查

| 当前实现 | 证据/改造位置 | 影响 |
| --- | --- | --- |
| `home`挂载ArchiveImmersiveHome | App.vue模板与静态import | Welcome必须是上游分流，不能是盖在已挂Home上的弹窗 |
| 首页人物初值和恢复回退为001tom | useArchiveNavigationState.js、App.vue恢复逻辑 | 移除隐含全局偏好；显式角色链接继续有效 |
| activeIdol/activeCue成立即挂SpineStage | ArchiveImmersiveHome.vue；Stage为async component | 保留受控人物/cue/服装接口；只为已选人物准备舞台 |
| App静态import Home，Home又import StoryAudioSession | App.vue、ArchiveImmersiveHome.vue | 不能仅凭Stage异步就宣称轻入口无重运行时；核查模块图、实例创建与请求，必要时连Home一起懒加载 |
| cards/idol_detail/mobile_archive无idol时补001tom | archiveRoute.js:normalizeArchiveRoute | U2分域调整无参数合同，不读取localStorage作隐式路由输入 |
| 全局导航消费currentCharacterId | App.vue:navigateArchiveSection | 当前浏览角色与长期preferredIdol不同；在点击入口时明确选择及写入URL |
| 现有偏好只保存首页外观/自动语音 | data/archiveHomePreferences.js | 新用户偏好独立版本化，旧主题/背景/音量习惯不丢失 |
| App初始化先await档案数据，再恢复路由 | App.vue:onMounted | 启动选择要在首次挂媒体之前完成；不能让初始home在await期间闪现 |
| Portal是现有轻量launcher，旧ArchiveHome并存 | ArchivePortalLauncher.vue、ArchiveHome.vue | 复用Portal，不并造第三份全站目录或两套网站 |

当前N01/N23缺口来自本地库存文档，不认为另一任务idle或既有源码测试可以代替Browser结尾验收。阅读产物覆盖数仅作历史背景，本批不重生成文档、不宣称全库演出已验收。

## U0：先固定启动与路由合同

裸入口判定在原始URL层进行，不能在normalize已补`home`之后猜来源。区分裸`/`、允许忽略的追踪参数、显式`view=home`及其他深链；未知/损坏路由保留明确错误或fallback，不用Welcome掩盖错误。启动resolver消费URL与显式传入的已验证偏好，保持可单测；canonical normalization保持纯函数。

| 输入 | 目标行为 |
| --- | --- |
| 裸/，无有效偏好 | 无媒体Welcome |
| 裸/，light | Portal |
| 裸/，immersive且人物有效 | 明确人物的沉浸Home；URL写入对应home角色字段 |
| 裸/，immersive但人物失效/缺失 | 无媒体人物选择，不默认冬马 |
| 显式Reader/Player/实体/Portal深链 | 直接恢复链接，不强制引导、不由偏好覆盖人物/筛选 |
| 显式home且人物明确 | 保持该沉浸入口与人物，不能被light偏好重定向 |
| 显式home但无人物 | 中立选择入口；是否使用已保存首页人物须在U0写成明确合同并显式化URL |
| 全局“首页”点击 | 经动作解析到用户启动页；无偏好到Welcome |
| 浏览器Back/Forward或来源返回 | 精确恢复已有route，不重新套用户启动偏好 |

Portal按钮始终表示全站入口；独立“游戏风首页”入口可随时进入沉浸Home。canonical面包屑仍表达信息结构，不根据偏好改成私人层级；全局首页动作和breadcrumb层级链接分开测试。首次分流使用replace避免产生无意义启动历史，用户后续选择按明确导航合同处理，不制造Back循环。

## U1：首批只做启动隔离和用户偏好

实现使用独立`ArchiveWelcome`、版本化`archiveUserPreferences`、纯`archiveStartup` resolver，以及App/route最少接线。偏好包含version、startupMode、可空startupIdol/preferredIdol、onboardingComplete；首页外观仍归ArchiveHomePreferences。未选模式不会用默认值视为已完成引导。

Welcome提供“资料馆/轻量浏览”和“游戏风首页”；“稍后再选”直接进入Portal，并保持可重新选择。沉浸入口的人物选择仅取静态小头像、原始姓名、组合；名单来自发布数据，不写死49，不预热所有候选模型。可以“随机一位”：从实际可用首页人物中取样，每次显式选择只解析一次并写明当前人物，不能在render/watch反复随机；随机浏览不自动写成长期自推。“每次随机”属于额外偏好策略，首批不默认加入。

选人物后复用原Home选cue/服装链；只挂载选中对象，不重新造Spine loader。需要区分“本次首页人物”与“我的偶像”；轻量用户同样可以后续设置自推。设置入口可更改模式、修改/清除偏好、重新打开引导；本地存储拒绝/配额不足/损坏/未知版本都不导致白屏，降级为本次会话可用并给出适当反馈。已有纯Home外观偏好不强行迁移成用户自推。

验收门槛：Welcome及light裸启动 **0 canvas、0 skel/atlas、0舞台纹理/剧情voice/audio请求，且不导入/执行SpineStage重运行时**；静态头像/图标请求允许。检查构建模块依赖、运行时请求和挂载，不能只数canvas。拒绝自动音频授权，沿用现有autoVoice显式偏好。验证启动慢数据、存储失败、无效人物、选择后返回/刷新、快速改选的过期请求隔离。light仍可主动进入完整Player，绝非功能阉割模式。

## U2：偏好导航与门户呈现

用户点击全局偶像/卡片/互动/Work/个人故事快捷入口时，由动作层生成显式人物URL；已带人物的深链、关系链接、列表筛选、来源返回均优先自身目标。不能让“当前浏览角色”悄悄改写长期偏好，也不能把全站结果过滤成只有自推。

无自推时保持中立入口。cards可考虑全偶像，idol/mobile/work等需人物的页面可先选择；根据各消费者能力分域落实，不直接删`001tom`然后把空值传给要求人物的组件。旧无人物链接的行为变更需增加兼容测试与文档，禁止normalize读取localStorage。

Portal保留原全站网格，有自推时增加轻量“我的偶像”与资料/剧情/卡片/Work/通信快捷入口，不加载人物舞台。顺序和标签统一使用同一导航合同，手机与桌面语义一致。不恢复旧ArchiveHome作为重复索引，也不新增个人/卡片/通信Reader。

## U3：新增启动矩阵并重测受影响旧旅程

| 用例 | 必须证明 |
| --- | --- |
| U01 新用户裸/ | Welcome先于任何Home媒体；轻量/稍后均无舞台 |
| U02 已存light裸/ | 直达Portal；设置仍可进入游戏风首页 |
| U03 immersive+非冬马人物 | 首次实际挂载即为选中人物，无冬马中间请求 |
| U04 存储拒绝/损坏/旧版本 | 会话可用、可选择、无白屏/循环 |
| U05 light偏好+显式人物/Reader/Player深链 | 链接身份、播放范围、阅读锚点不被偏好覆盖 |
| U06 自推快捷入口 | URL明确人物；切换他人、返回和分享不漂移 |
| U07 随机/失效人物 | 随机只解析一次；失效回选择，不默认001tom |
| U08 全局Home/Portal/breadcrumb/浏览器历史 | 各自合同一致，刷新与往返无循环 |
| U09 设置更改/清除 | 当次导航与下次裸启动按新偏好，正在播放不被强制切走 |
| U10 轻量→主动Player→返回 | Player按需加载/卸载，返回仍轻量，不污染来源 |

所有用例在desktop与390px验证；320/430补选择网格/长名/焦点/触摸边界。记录冷缓存网络、console、截图、横向溢出、URL、返回恢复。U1后重跑受启动/首页语义影响的N01/N17/N18/N19–N23；U2后补N07/N09/N14及其他变更入口。旧N01/N23结尾PASS是旧语义基线，不自动继承为新首页PASS。

## 2026-09-12实施与验收结果

代码提交`018ac7d`从输入HEAD `d25c2e1`完成U0–U2。裸入口在原始URL层判断，追踪参数不改变裸入口语义；显式route始终优先。Welcome与Portal会在完整档案数据到达前发布轻量页面和规范URL，`ArchiveImmersiveHome`改为动态导入。已存immersive模式则等待有效人物清单后一次性挂载所选人物，避免先发布无人物Home再丢失启动身份。

用户偏好独立保存`startupMode`、`startupIdol`、`preferredIdol`与`onboardingComplete`。存储拒绝、缺失方法、损坏JSON和未知版本均有机器回归，写入失败保留当前会话可用状态；已有Home外观设置仍由原模块拥有。Welcome支持轻量入口、游戏风首页、稍后进入Portal、静态头像选择、显式随机一次、自推设置及清除。Portal保留全站网格，有自推时增加资料、个人故事、卡片、Work与通信五个显式人物快捷入口。

路由不再用`001tom`填充缺失人物：无人物cards显示全部826张；资料、Work、个人故事与通信进入人物选择器。数据到达后发现无效人物代码时也回对应选择器；Browser以`work_archive&idol=999xxx`确认显示49人选择、无冬马档案及canvas。当前浏览人物不会改写`preferredIdol`。

U3使用5175本工程dev服务和独立Edge CDP profile执行18项实际浏览器场景。冷裸入口为`?view=welcome`，canvas为0，且请求记录没有`ArchiveImmersiveHome`、skel、atlas、voice或音频；light选择与刷新均为根Portal、canvas为0。immersive选择`002sht`首次挂载即为翔太，URL写入`home_idol=002sht`，请求记录没有冬马媒体中间请求。失效启动人物在390px回无媒体选择器。light偏好下，北斗显式Home、主线Reader的`step-8:text`双语锚点及活动430018 Player的1–26范围均保持；Player返回活动详情后canvas归0。翔太自推Portal与Work显式URL、浏览北斗后的偏好隔离、Home→Portal→history back、设置清除后再次裸启动均通过。

选择器在320、390、430px均为单列，随机按钮每次点击只解析一次且选择保持，主按钮可操作；所有18项记录的横向溢出与console error均为0。IAB另外完成翔太勾选自推→Home→Portal→Work、北斗浏览后偏好保持、全卡片826条及无效Work人物回选择器的交互核对。冷启动/矩阵证据保存在忽略目录`.analysis/startup-ux-browser-acceptance.json`，不作为发布资产提交。

机器验证通过`verify:archive-startup-route`、`verify:routes`、`verify:archive-navigation-state`（49 refs、1920种投影与URL组合、恢复及16条关系边）、`verify:portal-navigation`、`verify:archive-async-navigation`、home/idol/work/communication/card/event/archive-data相关回归。`npm run build:check`在`.analysis/build-check`完成2515 modules；主入口537.81kB，游戏风Home单独为18.35kB JS与16.42kB CSS，仅保留既有主chunk体积提示。该构建不复制public，也不代表完整媒体发布包或长音频压力测试。

U0–U3与本轮门户UX冻结完成。后续仍按总交接回到媒体ready、缓存复用和长稳路线；不把本批启动隔离扩写成全库媒体加载已经完成。

## 执行、构建与交接

每批先读AGENTS.md及[BUILD_ACCEPTANCE_POLICY.md](BUILD_ACCEPTANCE_POLICY.md)。纯规划/验收记录不跑构建；代码改动按范围回归，需要前端编译时只用 `npm run build:check`，固定E盘工程内.analysis/build-check，禁止C盘全量public副本和每提交默认build/smoke。真实Browser验收不可由代码构建代替；完整媒体打包只在明确打包任务中使用。

分批显式stage/commit/push，保留无关v9 HTML，不默认PR/部署。后续执行先读取本文完成记录和最新交接，再继续媒体加载工作。
