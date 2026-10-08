# App orchestration 专项审计

日期：2026-10-08。审计源码：Resource Status 收尾提交 `cc0aa069` 的 `web_viewer/src/App.vue`。本报告讨论职责，不以行数、文件数量或 composable 数量判断完成。

## 结论

**No：App 已以 orchestration 为主，但尚未只剩 orchestration。**

Resource Status 已独立持有资源目录/页/详情验证、入口并发计数与页面进入规则；App 只组装依赖、按原顺序调用 loader、检查 route intent 后发布结果。该模块本轮收口。

仍有下列可定位的领域/展示规则留在 App。它们不使本次迁移失败，也不等于运行时缺陷，但足以否定“只剩 orchestration”。因此本次不宣布整个 App 已达到冻结条件；也不启动又一轮按行数搬家。已认可的编排部分应保持稳定，后续若处理残留，应逐条以独立职责和行为证据为理由。

## 判定标准

允许 App 保留：组件/服务创建和注入；共享 route refs 与 payload 持有；跨域调用顺序；历史与来源恢复；请求 intent/生命周期；根壳层标题、导航、加载提示；把已有领域结果转成组件 props 的薄适配；持久化/全局主题的生命周期接线。

不算纯编排：从原始目录重新计算领域集合或聚合；在根组件内定义资源命名/编号映射；实现名称归一化和语言回退算法；自行决定领域对象的默认选择、媒体候选资格。代码短或叫 computed 不改变职责。

路由分派并不因存在 if/switch 就需要搬迁。根组件检验目标存在、选择下游入口、设置上下文及发布被认可的结果，属于允许的编排；下表区分的是其中嵌入的实际领域规则。

## 确认残留

| 编号 | 源码证据（该提交行号） | 为什么超出编排 | 若后续处理，最小职责边界与验收 |
| --- | --- | --- | --- |
| R1 | App.vue 1126–1171：`idolList`、`searchMatchedIdols`、`filteredIdols`、`idolUnitOptions` | 根据卡片目录聚合每位偶像数量，筛选有卡偶像，组合去重/计数，并定义搜索匹配；不是只读取现成投影 | 偶像/卡片成员目录投影；固定 bootstrap+card rows，验证成员范围、数量、单位类型、译名/组合搜索和无卡情况。App 保留 refs 接线 |
| R2 | App.vue 1249–1255、1275–1294：`currentStoryCollection`、`currentStoryVisualUrl` | 定义 legacy section 归属，以及主线 section 减 100、组合固定代码顺序、图像路径拼接、生日候选/已提升视觉的回退优先级 | 剧情详情展示/身份解析；对照既有映射、未知编号、legacy section、生日视觉回退。不能用迁移改资源路径或 UI |
| R3 | App.vue 1553–1601：`idolSourceName` 至 `loadIdolEntityTranslations` | 实现原名回退、空白归一化反向索引、日/中文选择与译名回退，另管理实体翻译修订 | 偶像名称展示适配；原名/别名/缺译/日文模式、反向识别、语言切换后失效行为须维持。Repository 已承担存储和传输，不能再复制一份翻译数据 |
| R4 | App.vue 1854–1858：`applyArchiveRoute` 内 Home cue/costume 选择 | 请求 cue 不存在时选首 cue；服装按请求→cue 对应模型→首件回退。该优先级是 Home 选择规则 | 只把选择解析交给 Home 域，保留 App 的恢复顺序、intent 检查和 refs 发布。不要把整个 apply 为这一段搬走 |
| R5 | App.vue 2358–2370：`openPortalStage` | 跨域加载/跳转属于编排，但 `choreography_candidate` / `special_single` 白名单是舞台候选资格规则 | 由 Stage/歌曲投影提供候选解析；保留 Portal 来源保护和异步归属，不改变可打开的舞台类型 |
| R6 | App.vue 2426–2429：`loadPlayerQueue` 的 event 分支 | 分派和 deadline 属于编排，但 `exists !== false && file` 是活动播放队列成员资格规则 | 交给已有 Player/Event 的队列选择边界；验证缺文件、明确不存在、原顺序及完整/片段播放合同。无需新建通用路由框架 |

以上是职责审计发现，不是要求立即创建六个新文件。R2/R3 是展示逻辑，本轮只记录，不改外观或译文；其余规则也不在本轮顺手改动。

## 应当保留的编排

| 审阅范围 | 判断与理由 |
| --- | --- |
| template 与根样式 | 主要是路由视图挂载、props/events、根壳层和诊断提示；两处失败任务 filter 仅筛选根诊断展示。不存在为了减行数迁移模板/样式的理由 |
| imports、异步组件目录、服务/refs 创建 | composition root 的依赖装配。动态组件准备与并发版本防护属于根加载生命周期 |
| feature factories | Reader、Portal、Mobile、Home、Idol、Unit、Card、Gasha、Event、Story、Legacy、Song、Stage、Photo、Resource 的调用与回调接线保留；延迟回调解决初始化顺序，不因体积再套总工厂 |
| 简单投影与壳层 | archiveStats、scope-idol、detail 的直接取值、标题/搜索提示/面包屑、加载提示、语言控件属于根壳层适配；R1–R3 的领域计算是明确例外 |
| `commitView` / `commitArchiveSelection` / `syncArchiveRoute` | 统一状态发布、重置播放器、历史同步与滚动上下文顺序；集中保留可清楚看见事务边界 |
| `applyArchiveRoute` / `restoreRoute` / `restoreDetailSource` | 分派到领域 loader、等待、检查 intent、发布 refs、回退路由、写 history；主干属于编排。仅 R4 等明确内嵌规则需要领域归属，不拆整个分派器 |
| `goHome` / `goArchiveBack` / section、picker、Portal 分派 | 跨域清理、来源优先级和目标入口选择是应用工作流。长重置列表和 route map 不是独立拆分理由；R5 的资格规则单独记录 |
| Player 入口/返回/队列适配 | 构造调用已有 cue/scenario/queue helper，交给 playbackController，deadline 和 intent 串联保留；R6 单独记录，不把播放内核拉回 App |
| view restoration 与全局 effects | DOM 就绪后恢复位置、语言/布局持久化、主题 token 应用、payload 释放、popstate 与 unmount disposal 均属于根生命周期 |

审阅覆盖 template、全部 script setup 顶层声明/副作用、apply/restore/Back/Portal/Player 函数及两段样式。AST 清点和 template 指令表达式保存在 `.analysis/app-orchestration-inventory.json`（含规范换行后的源码哈希）；它是审阅定位证据，不是自动判定器。搜索 readModelClient.load/fetch、Map/筛选、资源 URL、stageKind 只用于定位；结论来自具体实现及调用方，不把“没有直接 HTTP”当成编排完成证明。

## 收口与冻结规则

1. Resource Status 本轮停止拆分。其 loader/入口语义由真实传输、错误变体、App apply 接线与 Browser 深链接验收保护。
2. 不设 App 行数目标。上表已经认可的 orchestration 不再为结构整齐而迁移；仅实际缺陷或明确新需求才改。
3. 本轮止于审计。未改 R1–R6，未新增 UI、翻译、部署、R2 上传或服务重启。
4. 若后续解决或经代码证据重新判定所有明确残留，重新做职责审计；确认 yes 后正式冻结结构。不能仅靠更多测试变绿或达到某个行数自动宣布 yes。
5. 该结论固定于 `cc0aa069`。共享窗口之后的改动需单独归属，不继承本报告的验收结论。

Resource Status 的验证与最终完整源码门记录见 [工程进度](GS_ARCHIVE_ENGINEERING_PROGRESS_20261007.md)。相关实现：[App.vue](../src/App.vue)、[useResourceNavigation.js](../src/composables/useResourceNavigation.js)、[真实加载回归](../scripts/verify-resource-readmodel-navigation.mjs)。

最终验收：固定 `cc0aa069` 的干净源码门 114 通过、0 失败、1 跳过；118/118 batch、构建及当前审计通过。Browser 桌面/手机对照与深链接刷新通过。临时检出已清理，5175 未重启。完整证据位于工程进度所列目录。
