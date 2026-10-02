# 卡池与摄影目录一致性验收 — 2026-10-03

本批继续 GS UI Foundation，将卡池与摄影目录接入既有文字、控件和状态合同。先用 Browser 复现，再作局部修改。主门户及目录是本批范围；Chibi 舞台由另一窗口维护。

## 基线与代码归属

- Before 使用已固定在内存中的 `b7d0ea91` 主门户代码，5199/PID64832；期间其他窗口提交不覆盖此验收基线。
- 构建输入及四个前端文件 SHA256 见本 checkout 的 `.analysis/ui-gasha-photo-foundation-20261003/scoped-source-receipt.json`。构建前后核对这四个文件未变化。
- 首轮功能验收使用 PID62448；焦点环修正后使用 PID59228。App、PortalLauncher、PhotoCatalog 的源码哈希保持相同；卡池 CSS 的后续修正单独复核。
- 最终构建输入HEAD `2800eae307c43f961a9ea9178df0946892508e92`，Vite编译13.06秒，最终验收使用PID11248。其他窗口随后更新共享构建输出；本批服务器仍服务其固定的代码快照，不据此验收后续Chibi代码。
- 5199 服务固定生产代码于内存，public 与外部 read-model 就地映射。数据候选为 `E:/Web_build/GS_Archive_Domain_Work/song-discovery-readmodels-20261002`，release `d30e1e94cc6a1089a9e7ecbf6111ff63be0bfdc714293c2ebca319976fde364a`。
- `.analysis/ui-gasha-photo-foundation-20261003` 仅有截图、小日志、JSON 收据；没有复制媒体包或整份 public。`pinned-code*.json` 和 `http-requests.jsonl` 记录各阶段代码、HTTP、PID 与 release。

## 实测问题与修改

| Before 实测 | After | 理由 |
| --- | --- | --- |
| 卡池类型 10.24px/约31px，按钮字体 Arial；名称12.48px、metadata9.92px | 目录字体；操作13/600，桌面36、窄屏44；名称14/700，metadata12、badge11 | 与歌曲、活动等目录的同一信息角色一致 |
| 搜索 `ZZZ_NO_MATCH_20261003` 后只有 `0 / 82` 和空白 | 明确无匹配说明；成功空目录另表达尚未收录 | 零结果与未知资料分开 |
| 门户首次卡池 index 503 后，状态文字 y916，位于900px viewport外；没有重试按钮 | 原门户 notice 区显示失败与44px重试按钮；成功后仍进入目录 | 在当前上下文可恢复，不改变入口合同 |
| 失败刷新目录缺少局部恢复操作 | 未读取统计用“—”，局部重试保留 query、类型和来源 | 未完成读取不冒充零；恢复不重置用户条件 |
| 摄影顶栏h1与内容h2均为“摄影资料” | 身份由顶栏承担，保留内容说明 | 去除重复身份 |
| 摄影320px搜索和偶像select为13px/44px | 局部输入16px/44px，标签与计数meta12、操作13/600 | 提高触摸表单可读性，保留现有两列/手机上下结构 |
| 偶像2的10秒延迟期间，搜索与select均卸载，activeElement为BODY | 工具常驻；显式Tab将焦点移到select后，慢请求中SELECT仍保持挂载与焦点 | 加载不打断可继续编辑的控件 |
| 目录与工作台入口没有可恢复的操作身份 | `photo:{tab}:{id}` / `photo-studio:{tab}:{id}`；成功ready后只消费一次真实入口待恢复 | 返回焦点等待资料完成，控件交互和退出取消迟到恢复 |

卡池保留178/126px横幅、940:510比例和430px堆叠；道具补录没有公告横幅时保留原有“抽取道具记录”，不补假日期和卡片。分类使用 group 与 aria-pressed，沿用按钮原生键盘语义。

源码复核发现选中 hover 需保持选中颜色。Browser又发现横滚容器裁切向外焦点环，分类改用内侧环；44px最低宽度使 flex 按钮收缩、长类型重叠，因此分类按钮保持自然宽度、横向滚动。最终首尾分类和桌面/320px均已复核：各按钮scrollWidth等于clientWidth，命中区约44px，焦点环完整，无document横溢出。

摄影加载只保留身份有效的资料。共享素材可保留；表情/动作要求 actor 与 media 的 idolId 均匹配当前偶像。明确无效 key 不再静默显示首条；零搜索结果仍保留已选中的有效详情。query、tab、typed selection 或请求身份改变后，不执行旧请求的手机自动定位。失败与取消不发 ready。

## Browser 覆盖

| 旅程/状态 | 已实际操作与结果 |
| --- | --- |
| 卡池桌面、320px | 82卡池、61公告、336新卡关联、25道具补录；0结果、1结果、真实长名、无公告横幅的补录记录；未见document横溢出 |
| 卡池语言 | `6thLIVE TOUR ～NEXT DESTIN@TION!～招募` 与原文 `～ガシャ`，保留同一实体和搜索条件 |
| 门户卡池503→重试 | 失败留在门户，notice内按钮可见；点击进入82条目录 |
| 卡池带筛选刷新503→重试 | 未知统计显示“—”；`q=6thLIVE TOUR`、`gasha_type=ticket_named` 和完整from在重试前后URL相同 |
| 摄影桌面、320px | 仅一个页面身份；地点133条/6页；49个偶像选项；输入16px、控件约44px，未见document横溢出 |
| 摄影慢请求与连续输入 | 偶像2延迟10秒，工具保留；可输入零结果query；完成后INPUT焦点和query保留，没有迟到滚至详情 |
| 摄影竞态 | 偶像2尚未完成时切29，最终选项29、12条表情、row id为`photo:faces:12901029`；旧请求未覆盖新偶像 |
| 摄影失败503→重试 | 偶像29明确失败姓名、结果暂不可用；工具保留、没有旧人工作台CTA；重试得29的12条表情 |
| 摄影0/1结果 | 零结果保留有效自然表情详情；`撒旦`得到1条并可选择；29有9条动作 |
| 摄影语言 | 偶像姓名可切原文，包括`アスラン＝ベルゼビュートⅡ世`；现有预设功能标签仍使用原有中文语义，没有改写翻译层 |
| 工作台往返、冷读取 | 打开偶像2表情`10201002`的工作台并返回：query、actor、选择保留，焦点回到`photo-studio:faces:10201002`，外层scroll约135.17；刷新延迟10秒后同样恢复 |
| 最终代码再次往返与冷读取 | 偶像29、query=`撒旦`、表情`12912029`：工作台返回与10秒冷读取后，焦点均为`photo-studio:faces:12912029`，外层scroll约146.67 |

最终截图：`.analysis/ui-gasha-photo-foundation-20261003/gashas-final-1280.jpg`、`gashas-focus-first-final-320.jpg`、`gashas-focus-last-final-320.jpg`、`portal-gashas-retry-final-1280.jpg`、`photo-final-1280.jpg`、`photo-final-320.jpg`、`photo-cold-return-final-320.jpg`。

工作台只验证入口及返回，不据此宣称人物动画、媒体导出或真机性能通过。摄影内层310px目录滚动没有扩大为新的恢复合同。

## 回归与边界

`npm run build:check`通过，固定复用 `.analysis/build-check`、`copyPublicDir:false`。因实际Browser暴露两项分类样式问题，修正后重编译；未新增完整资产输出树。既有大chunk警告保留。

实际SFC/模板内存renderer与生产App回调回归通过：

- `verify-photo-catalog-navigation.mjs`：有效资料/工具保留、未知/零结果、双身份检查、2→29竞态、失败重试、typed key、交互取消旧定位、ready单次恢复及工作台来源返回。
- `verify-event-catalog-navigation.mjs`：新增摄影pending绑定后的活动恢复兼容性。
- `verify-gasha-readmodel-navigation.mjs`：实际prepare清状态逻辑、门户失败重试、目录保留筛选重试和迟到请求保护。
- archive async navigation、portal navigation、domain navigation、archive routes、archive view restoration、gasha catalog/ticket evidence、terminal idol localization均通过。

回归日志与Browser证据分别记录；内存renderer不是Browser或真实媒体验收。503/延迟是本地受控故障，响应哈希与身份校验保持开启，结束后清空故障规则。

QA过程另有一条应用模块HTTP500：本地故障配置文件被截断写入时，QA服务读取到不完整JSON；服务stderr确认`JSON.parse`失败，属于QA故障配置竞态。本批随后在相同固定代码下重建验收标签并复核两种卡池失败/重试成功；不能把该500算作发布应用缺陷。后续QA服务脚本已改为原子替换故障配置，当前现役服务结束时规则为空。途中一个验收标签截图/点击超时，同一Browser新标签恢复后，最终桌面/窄屏截图与交互通过。

未覆盖：真实200% Browser zoom、真机触摸/键盘/safe area、全体49偶像的所有预设、全体卡池详情、媒体长稳和发布部署。320px viewport不代替这些验收。

下一阶段仍是按资料域迁移实体详情和剩余surface合同，先看实际内容再决定密度。Dialog M的三份密度对照继续等待用户选择，生产密度保持现状。统一角色不意味着所有页面换成同一模板。

## 分批提交

- `af9fa31732f752c100c5d4856753e59c23092a68`：卡池角色、零/未知状态、门户可见重试与保留筛选重试。
- `fdd640bb57e38f0d442c08e207f7abcbcf72346b`：摄影工具连续性、身份检查、typed焦点与成功ready恢复。

两批均显式stage、独立commit/push。验收记录另批提交；构建、截图与QA助手留在ignored `.analysis`。保留另一窗口Chibi修改及无关资源/文档。

相关：[界面规范](GS_UI_CONSTITUTION.md)、[目录基础验收](GS_UI_DIRECTORY_FOUNDATION_ACCEPTANCE_20261003.md)、[歌曲/活动连续性验收](GS_UI_CATALOG_CONTINUITY_ACCEPTANCE_20261003.md)。
