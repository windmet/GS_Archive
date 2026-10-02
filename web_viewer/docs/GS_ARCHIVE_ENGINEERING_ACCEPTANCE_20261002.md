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
