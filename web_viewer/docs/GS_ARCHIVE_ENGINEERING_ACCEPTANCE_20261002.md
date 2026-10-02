# 工程审计复核与扩展验收（2026-10-02）

## 输入与批次边界

先完成故事发现 / 活动资源改造并提交 `f6faf0b3d2bbdf8234a6a3e7af34e29838fd61bd`，然后复核用户提供的 `GS_Archive_Engineering_Audit_71c26533.zip`。包 SHA-256：`0f14dae30b1f302ffce386142ac3391d624f924e8b3ac4c3a228b79d82e9b652`；24/24 校验项匹配。包基线为 `71c2653335f6dfd75b41e06c092f5a6716538590`，不是当前功能基线。包内补丁作为候选源码逐项审查，未执行安装脚本。只解压小型文本到本仓库忽略的 `.analysis/engineering-audit-71c26533`。

前一批设计、翻译审批和 Carnival 证据见 [活动与故事资源验收](GS_EVENT_STORY_RESOURCE_ACCEPTANCE_20261002.md)。本批不重新审批其他翻译，不修改正式剧情 JSON 或公开媒体内容；新增资源资产政策只登记本分支已存在的原生音符资产。

## 发现复核

| 编号 | 当前结论 | 本批处理 / 验证边界 |
| --- | --- | --- |
| F01 | 基线问题仍可复现 | 起播独立意图、并发幂等、resume 超时/取消、全部局部节点回滚；dispose 可检查 PCM 字节与待关闭状态。实际分轨播放、暂停正常。 |
| F02 | 基线问题仍可复现 | 独占 BaseTexture 创建者负责失败释放；共享缓存默认不销毁；abort/超时/构造抛错各有回归。 |
| F03 | 基线问题仍可复现 | 舞台起播、预载、slot 替换和晚到 motion 都受版本/实例/意图约束；native play 超时撤销旧所有权，旧失败不停止新 owner。真实舞台播放到 0:25 后暂停、换装、离开成功。 |
| F04 | 基线问题仍可复现 | 独立分类与筛选 URL；无默认虚假实体；关闭详情清空实体；返回来源保留筛选、分页和详情；刷新验证 W 的 `05w00` 代码。 |
| F05 | 原报告的风险有效，但需区分状态 | 把版本失配显示为“来源摘要暂不可用”，合法空来源显示“来源未收录”；纯展示模块移出组件目录。release-bound sidecar 的生产者迁移仍属架构债务。 |
| F06 | 架构债务，不能直接断言路由坏掉 | 既有导航、restore、Reader/Player 往返和扩展藏品合同通过；本批未重写 App 全部编排。 |
| F07 | 性能风险，尚无成本测量 | 构图增删、锁定、隐藏、撤销、真实 1280×720 导出及十轮进入/导出/退出正常；没有据此宣称 idle ticker 或 drag 全同步成本已消除。 |
| F08 | 预算风险，不能等同实际 OOM | 新音频 inspect 区分解码 PCM 与 JSON 缓存。没有全站统一 GPU/RGBA 预算或真机堆测量；6 MiB read-model LRU 不是总内存上限。 |
| F09 | 原始分类仍应独立于条件 | honorType=1 呈现“普通称号”；偶像标签使用全局译名，typed 羁绊来源不变。旧数字身份推断与 sidecar 生产者分层尚未完全重构。 |
| F10 | 原报告的验证边界仍成立 | 增加音频可检查标量，真实舞台/摄影 DOM 清理旅程；不把 Story 探针或零 DOM 残留当成 GPU/音频驱动回收证明。 |
| F11 | 原分支 push 确实未命中 | 当前分支进入 push 范围；PR 自带 Source Gate，增加工程行为和扩展数据门禁。 |
| F12 | 静态断言不足 | 新增真实源函数跨 await、取消、替换、失败回滚及字节协议用例，保留原有静态/生产者合同。 |

## 对过时门禁的修复

首次全量运行：90 个命令，79 成功、10 个真实过时/失配检查、1 个本地 runner 参数错误（把 ref 名称传给只接受 SHA 的 publication gate）。后者改成实际 `origin/master` 40 位 SHA，不修改门禁规则。

- Reader 测试注入正式 PlayerPreferences 依赖，SSR Event 样本采用 v2 view shape；文字断言对应目前正式控件名，仍验证不可用/未支持分支。
- Story 卡片拆为子组件后，恢复验证引用真实子组件；列表和表格均保留来源 focus ID。
- 卡片过滤用当前源绑定译文；偶像页 legacy digest 只排除此次新增的 `attribute` / `gameplay` 元数据，同时验证对象仍来自相同源。
- authoritative publication 登记仅在 manifest 路径集合完全一致时补回最新 release owner；201 次发布 / 1368 个 logical ID 保持 append-only 与 index/HEAD/工作区内容校验。
- 224 张已跟踪 PNG 入政策，原生 Sprite 与衍生对照图分开分类；不增加新媒体包。
- 基线只更新 authoritative v2 和 tracked-binary 投影，保留原报告 RAW/外部挂载历史采集信息；未冒充新的全资源扫描。
- publication verifier 批量读取 Git blob 与 eol 属性，保留逐字节 SHA、大小、Git HEAD/index、JSON 语义和换行约束；严格协议错误及实际单 blob / 批量等价回归通过。
- 移除跨整条分支出现的 Python 文件 EOF 多余空行，master 到本批的 whitespace gate 通过。

## 本地门禁与实际浏览器

完整 CI 命令镜像：92/92 通过，包含 read-model 生产者、路由、Reader/Player、Wire、主数据扩展、受审译文、资源来源、publication、tracked PNG 和 build audit。之后 W 路由发现含数字代码需 whitelist，修复后重跑相关工程、导航、阅读与主数据回归并重新编译。提交后再以最终 HEAD 编译 / 核对 build audit；GitHub PR 门禁另行作为最终源版本证据。

工程新增可控行为测试：20/20 音频/纹理生命周期用例、14/14 舞台/motion/Git byte protocol 用例、藏品刷新/close/source-return/filter/page 路由与未知来源语义。基线同类生命周期用例为 7/18 成功、11 个失败；新用例不以 XFAIL 隐藏失败。

浏览器使用已有 5198 服务（最新 `.analysis/build-check` bundle；既有外挂主数据 / 媒体），未启动第二台服务，未复制 public 语料库：

- 藏品普通称号筛选搜索 → 刷新 → 详情 → 关闭 → 再刷新；无默认弹窗。道具“文具” → 对应卡池 → 返回恢复原详情与查询。十轮详情开关后 0 个 dialog、0 个 audio/video/canvas。
- 中文称号筛选 49 位偶像显示固定译名；W 组合筛选刷新仍为 `05w00`，4 件羁绊称号，条件未被误改。
- DRIVE A LIVE Jupiter 小编成分轨播放 / 暂停；多人舞台预载、播放到 0:25、暂停、换装、返回歌曲。舞台 1 个 canvas，离开后 0 个；歌曲自身 1 个 audio，进入摄影后 0 个。
- 摄影两个人物 + 贴纸：锁定、隐藏/显示、删除/撤销后 3 图层；输出实际解码 PNG 1280×720。另十轮进入、真实导出、退出，每轮结果 1280×720，退出 0 个 canvas/audio/video。
- 第一章目录展开只显示当前全局语言的简介；Reader 日/中/双与 ADV 中/双/日仍可循环；Reader、ADV 返回保持来源目录。
- 390×844：藏品详情可开关；document scrollWidth=390。检索表格 680px 只在内部滚动，页面 scrollWidth=390；Portal 与检索主要设计证据见前一批验收。
- 本轮工程旅程没有新增控制台 error。既有 08:48/09:09/09:12 bundle 替换分块失败和 09:43 错误手输 Event ID 记录保留，不能称“全历史零错误”。

小型证据位于 `.analysis/engineering-validation-20261002`：`source-gate-before.json`、`source-gate-final.json`、`lifecycle-before.json`、`lifecycle-after.json`、`studio-cycles.json`、`stage-paused-desktop.png`、`studio-export-desktop.png`、`collection-mobile.png`、`honor-detail-mobile.png`、`search-final-mobile.png`。这些是本地验收输出，未新增跟踪二进制。

## 门禁含义与未验收范围

Source Gate 通过代表当前源码 / 版本绑定 / 离线合同通过；`check_cutover_routes --progress` 明示没有 real-device 与全路径 parity 全部通过。仍未完成真实 iPad 静音开关、前后台/耳机切换、长期 heap/GPU 预算、全歌曲/全场景逐媒体穷举、生产发布包和线上部署验收。F05/F06/F07/F08/F09/F10 的上述剩余债务不能改写成“全部架构问题已修复”。

本次提交并新建到 master 的 PR，不直接合并或部署；保留不属于本任务的未跟踪证据和资源。

## GitHub 跨平台补验

PR #46 首轮 Linux Source Gate 在新增 editorial 步骤发现活动关系图的 source SHA 使用 Windows CRLF 字节，Git 检出 LF 后不一致。为编辑性 JSON 来源明确 `sha256-utf8-lf-v1` 哈希格式，只规范 CRLF；任何其他空格、值或字段变化仍使 SHA 失配。生产者 / 验证器共用同一规则并测试 LF、CRLF 等价及其他内容变化拒绝。图片 SHA 和正式 publication blob 的原始字节校验没有改动。此处记录的是实际 CI 失败后修复，不把第一次本地通过当成 Linux 验收。

后续 CI 还发现新 checkout 没有 `.analysis`（测试现在自行建立小型隔离 fixture），以及旧 Reader / Studio 的 compiled 来源摘要曾绑定 CRLF，而 publication 明确发布 LF。正文/译文/审批收据均未重写：共享 `ReadingSourceBytes` 仅提供原始字节及 LF/CRLF 两个精确传输变体，Reader→ADV 与 Studio 复核共同检查原摘要；非换行空格变化、键名/值变化均被新回归拒绝。正式 publication verifier 仍检查实际 LF artifact、Git index/HEAD 和原始 SHA。此兼容修复同时防止正式 LF 文件在历史正文入口被误拒。

Linux checkout 不含忽略的媒体库，原 speaker-avatar 测试把本地资源验收混进 Source Gate。现默认仍严格核对 25 个 NPC 的 masterdata / 真实正文身份及排除规则；显式 --local-media 另检查 25 张 PNG 的签名和 148×148 尺寸，本地通过。源码模式明确输出未验收图像字节，历史 HTTP / Browser 验收边界保留。

构建 CI 暴露唯一漏跟踪的 Reader compiled 来源：冬马生日剧情 1_2_001_12 的父文件。它已经是正式 Reader manifest 的 ready 文档与 authoritative-registry pre-ledger 来源，17 文本行、20 steps、RAW hash 均在原记录；这里只补入该既有 174385 字节文本文件，未新生成剧情、未把 pre-ledger 改为 release owner。其历史 CRLF 来源摘要继续由精确换行传输兼容验证；全 2801 Reader 来源仅此一份缺 Git 跟踪。

## 手机故事门户专项适配

前述“390px 表格可内部横滚”只记录旧版现状；用户随后否定该交互。本轮先修复 CI 来源缺口（a0c6127c 的 push / PR Source Gate 均成功），再实施手机专项适配：

- 仅故事目录与章节目录采用紧凑手机 chrome：返回 / 标题 / 中日切换一行。52px 页头 + 44px Tabs = 96px，隐藏面包屑并保留返回的可访问名称；Reader / ADV 三种正文模式继续独立。
- 760px 及以下真正切换为两行列表，不渲染表格或视图切换器。60px 行高，类型 + 标题，主要角色 + 译文状态；所选偶像 / 组合成员优先显示，完整 cast 保留。活动标题收起重复系列前缀。
- 手机检索条件默认收起，搜索和结果数保持可见；展开可使用原有系列、49 人多选、组合、分类、可用性、排序与翻译状态。完整面板有内部高度限制，实色吸顶避免正文透字。
- 主线手机全宽单列（390px 视口卡片约 351×151），查看全部不折行；组合前传继续单行横滑。
- 手机使用每次追加 40 条的加载更多，不使用 35 页分页。进入正文详情再返回保留已加载范围；改变筛选重置范围。桌面页码 / 表格选择独立保留，跨断点恢复。目录底部 70px 留白，导航另占独立 grid row。

真实 5198 Browser：360 / 390 / 410px 无 document 横向溢出；表格 DOM 与视图切换器均不存在。390px 页头 + Tabs 96px，收起检索 85–87px（旧版 367px）。硲道夫 45 篇、S.E.M 100 篇，追加 40→80 后进入山下次郎工作剧情再返回仍为 80 / 100。加载更多按钮实际 bottom 608px、导航 top 770px，未被底栏遮挡。1280px 桌面表格 40 行 / 44.64px，第二页缩至手机会改用列表，恢复桌面仍为第二页。

本地完整 92 命令复验中，91 个合同通过；唯一 build-audit 正确拒绝了测试期间继续修改的源码。最终源码重新编译后补验 build-audit，最终 PR CI 另绑定实际提交。没有把旧 bundle 验收作为新源码编译证明。截图与小型证据继续放于 `.analysis/engineering-validation-20261002`，不新增媒体包。

## F07 第二轮：摄影静止与变换工作量

输入 HEAD `147cfca2`。静止摄影改为按变更合并一次 requestAnimationFrame 重绘；只有可见页面的动作预览启动 30fps 私有 ticker，隐藏人物跳过骨骼更新。暂停、页面隐藏和销毁停止 ticker，页面恢复不会擅自启动已暂停的预览。选择、变换、姿势/表情、素材移除、背景缩放、滤镜、窗口变化和导出恢复均发出重绘请求。

构图变更保留文档数值验证；素材/身份/差分/顺序 signature 不变时，只应用有变化的对象变换及背景缩放，不调用全量来源校验/素材重整。身份或预设改变、增删、排序、首次载入、失败重试仍走完整同步；显式定格时刻更新主动结算骨骼，不能依赖静止 ticker 来修正画面。导出仍同步渲染无选框的 framebuffer，再恢复编辑选框。

`verify:engineering` 新增真实 Vue deep-watch 回归：100 次位置编辑只更新目标人物；显式时刻、预设切换、隐藏/显示、排序、删除/撤销、非法服装身份拒绝；受控帧队列验证静止零 tick、变更合并、隐藏/恢复、预览、销毁晚到回调。现有真实 Spine 动作恢复、690 源 bounds、手势、构图文件/导出合同均通过。`build:check` 不复制 public。

5198 最新 bundle 实测：暂停 5 秒前后 render=3/modelUpdate=1/sync=2 保持不变；放大人物 render=4，modelUpdate/sync 不变。参考 A 为 2 人物 + 5 贴纸，预览增加更新；返回定格后另 5 秒 render=694/modelUpdate=1379/sync=3 完全不变。两次方向键微调不增加 sync。390px 仍可编辑，真实导出图 naturalWidth=1280/naturalHeight=720，返回来源后 canvas=0。小型截图 `studio-work-mobile.jpg` 与日志在既有证据目录。控制台无 error，首次 Spine 渲染有一条 SimpleMesh/Spine update 警告栈，保留为观察项，未据此声称零警告。

此轮验证工作次数与功能回归，不代表耗时、电量、GPU heap 或物理双指设备验收；F07 的上述冗余工作已消除，F08/F10 预算和真机边界继续保留。

## 手机歌曲档案

源码基线 `726818d5`，歌曲布局与 producer 提交 `2b11b278`。手机隐藏重复概览，筛选单行横滑，歌曲行高 72px、封面 52px；演唱组合/成员先于制作信息，手机隐藏读音与 credits，箭头固定右侧居中。桌面保留概览与双列目录。歌曲目录与故事目录共用紧凑手机页头。

旧 bounded song rows 没有演唱身份；producer 现在投影既有 song-detail 的确认组合、编成 scope 与偶像 ID/displayName，搜索复用固定译名与原名别名。自由编成不冒充全员合唱，未确认特别演出不猜组合。新候选 `E:/Web_build/GS_Archive_Domain_Work/song-discovery-readmodels-20261002` 的 release 为 `d30e1e94cc6a1089a9e7ecbf6111ff63be0bfdc714293c2ebca319976fde364a`，bootstrap 14,344 字节，8,750 小型模型文件、总 decoded 76,645,309 字节；无媒体复制。全文件 byte verifier 和全部 60 首的现有 selector 一致性通过。索引合同 46/46，歌曲关联回归通过；三处旧 UI/migration fixture 更新为现有入口，未降低身份检查。

第一次构建正确拒绝旧 routes ledger release，更新版本绑定与历史验收边界后 `build:check` 成功。现有自建 5198 映射服务只切换到已验证候选，仍使用原 public/外挂媒体。390×844 实测首屏完整 7 行，页头 52px，筛选 44px，卡片 72px；360/410px 均 document 无横向溢出、胶囊仅一行。六类筛选结果分别 60/11/1/3/2/1；硲道夫与硲 道夫均得到 4 首，详情返回恢复 query 与 4 条结果；全局语言切换正确显示混合编成的固定译名或日文原名。1280px 概览仍显示、双列列表保留。歌曲验收旅程无新增控制台 warning/error；13:13 切换旧 bundle 时的分块错误和既有摄影 warning 保留，不称全历史零错误。

截图 `song-mobile-390.jpg`、生成/字节/来源一致性/构建日志保留在既有 `.analysis/engineering-validation-20261002`。这是本地生产代码 Browser 和 source acceptance，未转化为物理触屏或线上部署验收。

## 通用手机 chrome 与卡片目录

输入 HEAD `e8c6f0f4`。ArchiveShell 的普通档案页面统一 48px 手机页头，隐藏面包屑，返回保持可访问名称；中/日用一个 48×44px 切换按钮，高亮当前语言。桌面双语按钮保留，Reader/ADV 正文模式不变。可检索页面的搜索图标展开输入框，页头临时为 92px，正文确实向下避让；收起为 48px。有查询的返回/刷新自动展开搜索，避免隐藏生效条件。Home/Portal 无普通页头的结构和独立工具导航仍保留。

卡片手机隐藏重复标题，偶像选择器只占一行；稀有度单行横滑；两个资源/关联下拉与视图按钮一行。紧凑卡片为 76px，稀有度叠头像，标题与姓名有单行宽度约束，语音/剧情图标计数带完整可访问名称，箭头居中右侧。二列网格仍可选，并显示稀有度角标。偶像切换器、目录标题和卡片所属姓名统一使用稳定偶像 ID 的全局译名；源 identity 与原名不修改，详情共通系列继续保留原有来源信息。

826 张卡、1,225 种过滤组合回归通过；卡片异步选择/竞态/重试/故事导航、故事全语料索引、Portal 来源返回回归通过，`build:check` 成功。真实 5198 最新 bundle：360/390/410px document 无横向溢出，页头 48px，卡片 76px，稀有度一行，首屏完整 6 行。390px 下 GROWING STARS 文本区宽 235px；展开搜索 header=contentTop=92px、inputBottom=84px，搜索不覆盖正文。SSR=124，SSR+卡池关联=110；网格为二列、角标可见。大河武搜索 GROWING 得到 1 张，日文切换为大河 タケル，详情返回保留偶像 ID `038tak` 与 query。1280px 桌面仍 76px header、面包屑、双语按钮、重复的桌面偶像信息块和 826 行。

截图 `card-mobile-390.jpg` 与相关小型日志留在既有证据目录。手机宽度模拟不代表真实触屏键盘、安全区或物理设备验收。

## 门户层级与窄屏顶栏

输入 HEAD `87d15b2b`。门户和桌面侧栏共用一个导航分组定义：核心档案 4、历程记录 4、工具拓展 3；首页独立。所有已发布目的地及来源返回语义保留，导航覆盖/刷新/深链/晚到关闭回归通过。桌面侧栏行高 36px、图标 18px，1280×640 实测 12 个按钮全部可见，nav clientHeight=scrollHeight=531，末项资源 bottom=589；不以缩短侧栏删除功能。

手机门户为 2×2 核心卡片、4 条历程记录、3 个工具入口。偶像/组合统计来源为 bootstrap，其他入口用内容说明，无猜测计数。顶栏只显示中/日、设置与可选来源返回；壁纸通过设置菜单打开原选择器。P 名字与担当合并为 64px 工作台按钮，原 P 名字/担当设置和快捷操作保留在弹窗中。320px 下真实截图确认无控件覆盖，工作台64px；360/390/410px document 宽度等于 viewport。窄屏实际打开设置→SSR 壁纸、工作台，未修改用户偏好；歌曲入口读取 60 首后返回门户、活动入口读取 59 条均可用。桌面双语言、首页/壁纸/启动设置独立按钮保留。

`build:check` 通过，固定输出 `.analysis/build-check`，现有5198映射服务复用，无 public 或媒体复制。截图 `portal-mobile-390.jpg` 留在既有证据目录。本轮为本地 Browser 响应式模拟，物理设备边界继续保留。
