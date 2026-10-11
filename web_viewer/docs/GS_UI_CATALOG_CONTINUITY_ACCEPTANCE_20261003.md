# GS 目录语义与浏览状态验收

2026-10-03。接续[目录基础迁移](GS_UI_DIRECTORY_FOUNDATION_ACCEPTANCE_20261003.md)的实测问题；规则见[GS UI规范](GS_UI_CONSTITUTION.md)。本批覆盖歌曲目录页面身份/搜索焦点/未知统计，以及活动目录加载态、URL浏览状态和返回恢复。Chibi、详情密度、媒体播放与部署不属于本批验收。

## 实测问题与改动

| Before证据 | After |
| --- | --- |
| 歌曲页Shell h1与内容h2重复“歌曲档案” | 删除内容重复h2及其独占样式；保留说明、SONG ARCHIVE标识、统计与Shell h1 |
| Tab进入歌曲搜索：input outline none/0，外框无焦点提示 | 外框focus-within使用GS焦点尺度与绿色轮廓；键盘进入可见，移到筛选后消失。没有改变搜索框几何 |
| 活动首次加载统计暂显0，结果数也像已读取 | 加载/失败统计为“—”，结果数分别为“正在读取…”/“结果暂不可用”；成功后才显示真实计数和零结果。article标注aria-busy |
| 活动形式/排序/分页为组件局部ref；详情返回只保留query和focus | App持有受控eventBrowse；独立event_kind/event_sort/event_page写入URL，经现有from保存和返回恢复 |
| 空目录容器先出现，共享位置恢复器会提前结束 | 活动成功ready补执行一次待恢复入口。控件操作、上下文改变、revision变化或离开视图会取消；不修改共享恢复算法 |

歌曲无catalog时，四项统计及六个筛选计数同样显示未知。原有加载/失败文案和重试接线保留。活动页码与既有Collection合同一样使用0-based；表单变化显式归0，hydrate时不归0，成功载入真实记录后才clamp到末页。新字段仅归活动目录所有，既有故事sort/event_scope保持原含义。

歌曲验证器的旧portrait引用断言已准确改为performerReference(entry.reference)；音频原始entry.reference断言保留，不使用宽松OR或跳过身份检查。已有实际SFC双语performer回归继续覆盖。

## 构建与资源身份

- 编译输入HEAD为`9cbd1909453b7306e023461a054b27f61f8a9022`加本批六个生产文件；SHA-256见`.analysis/ui-catalog-continuity-20261003/scoped-source-receipt.json`。构建后、Browser后、提交前均核对未变。另一窗口后来提交`5caf8be3`，保留其工作；本批没有提交Chibi文件。
- `npm run build:check`通过，Vite13.12s；固定`.analysis/build-check`，copyPublicDir:false，无语料副本。已有大chunk提示保留，不声称完整发布包验收。
- 5199 QA服务启动前核实旧PID42844及命令/监听归属，只重启本任务服务；最终PID64832。生产代码固定在内存，`pinned-code.json`时间`2026-10-02T21:39:53.056Z`，190份代码文件。
- 资源仍原位映射`E:/Web_build/GS_Archive_Domain_Work/song-discovery-readmodels-20261002`；release `d30e1e94cc6a1089a9e7ecbf6111ff63be0bfdc714293c2ebca319976fde364a`。HTTP路径/status/hash/PID/release见该QA目录的`http-requests.jsonl`。
- 本地fault文件用于events/index的10秒延迟及一次503、songs/index的一次503；验收后已清空rules，保留服务。只有两条预期console error，分别为ArchiveEvents与SongReadModel的HTTP503，无其他warning/error。

## 回归

| 命令 | 结果与证据类型 |
| --- | --- |
| `node --experimental-vm-modules scripts/verify-event-catalog-navigation.mjs` | 通过。真实SFC setup/template/model和实际App回调；合成目录/内存几何测试URL、from、分页、异步hydrate、成功clamp、失败retry/abort和控件/跳离取消ready，不冒充Browser |
| `node scripts/verify-archive-async-navigation.mjs` | 通过；新增实际applyArchiveRoute的活动browse恢复场景 |
| `node scripts/verify-archive-navigation-state.mjs` | 通过，58个独立ref/1792投影和URL用例 |
| `node scripts/verify-archive-routes.mjs`、`node scripts/verify-domain-navigation.mjs` | 通过；既有路由/域所有权保持 |
| `node scripts/verify-portal-navigation.mjs`、`node scripts/verify-collection-route.mjs` | 通过；门户来源与Collection合同保持 |
| `node scripts/verify-event-readmodel-navigation.mjs`、`node scripts/verify-archive-view-restoration.mjs` | 通过；已有请求超越/重试、位置恢复合同保持 |
| `node scripts/verify-song-domain-landing.mjs` | 通过，60作品/61实体；上批记录的旧引用断言失败已修正 |
| `node scripts/verify-terminal-idol-localization.mjs` | 通过，20个实际SFC场景；双语可读名称、typed focus-id及原始媒体证据保留 |

`diff --check`通过。VM实验特性提示属于Node测试运行方式。以上回归并非整仓所有测试，也不是逐首播放或完整活动媒体验收。

## Browser实际旅程

| 旅程 | 结果 |
| --- | --- |
| 歌曲1280/320 | 页面同名heading仅Shell h1；键盘Tab进入搜索后外框有轮廓。CSS声明3px/offset3，当前Browser计算约2.76px；截图确认可见。320输入16px/外框约44px，无横向溢出；真实零结果、特殊版本1首、移开焦点均正常 |
| 门户→歌曲失败/重试1280 | 注入一次index503；四统计/六计数均“—”，有重试，无假零结果。重试后60行、60/11/1/3恢复 |
| 活动深链第二页320、延迟10秒 | 等待中统计三个“—”、aria-busy=true、URL event_page=1不提前归0；成功后59/38/2、24行、2/3、oldest |
| 活动第二页→410011→刷新详情→Shell返回320 | from保存oldest/page1和门户来源；返回后2/3，focus恢复event:410011、scrollTop恢复2173.79。该返回目录有缓存，不把它称为慢返回 |
| 活动目录刷新、延迟10秒320 | 读取中scrollTop暂0；成功后event:410011与2173.79恢复。单独验证了ready后的实际位置补恢复 |
| THEATER/oldest/query10012→410012→Shell返回320 | 三字段完整保留，1条结果，焦点回event:410012；修复上批实测的kind/sort重置 |
| 活动index503/重试320 | 错误时URL仍page1，三个“—”、结果暂不可用，无空结果说明；重试后2/3和59/38/2恢复 |
| 慢加载中改query/kind/sort320 | 加载时控件可操作，成功后真实0结果且输入保持焦点。另切回已记忆event:410012的THEATER/oldest/query10012组合；成功1条后焦点仍在搜索框，没有被迟到ready夺走 |
| 活动越界页/Browser history1280 | 请求page10000，成功后URL规范到page2；3/3、11行、下一页禁用。Browser后退到已加载歌曲页、前进回活动页后，oldest及末页保留 |

截图与小日志都在本checkout `.analysis/ui-catalog-continuity-20261003`；代表画面为`songs-heading-focus-1280.jpg`、`songs-focus-empty-320.jpg`、`songs-error-1280.jpg`、`events-loading-page-320.jpg`、`events-error-page-320.jpg`、`events-delayed-focus-restored-320.jpg`、`events-late-ready-keeps-input-320.jpg`和`events-clamped-history-1280.jpg`。恢复默认viewport，密度原型与验收tab继续保留。

## 后续与边界

活动面包屑继续表示canonical层级入口，点击它回目录使用默认筛选；本批精确恢复覆盖Shell返回、Browser history和from。真实coarse设备、非零safe-area、200% Browser zoom、媒体播放、故障下的所有离开旅程未覆盖；内存回归覆盖跳离/abort，不能替代真机。

下一阶段候选来自源码审查，尚不能称为实测UI缺陷：卡池分类按钮/metadata角色、零结果与明确重试；摄影重复标题、表单输入字号、加载时控件卸载以及工作台返回focus-id。先逐域Browser复现，再迁移局部规则，保留横幅比例和有效详情选择。详情密度仍等待用户在原型中选择，随后再迁移Dialog M；QuickView/Solo继续独立验收。

## 提交

- `2457e4ba34b14b155b474d6243145b92deed93be`：歌曲页面身份、焦点与未知统计；准确维护已有歌曲断言。已推送。
- `68de133b185d64606bee6ecda22b388673ee6302`：活动加载态/URL/返回恢复及相关回归。已推送。
- 本记录与规范更新另以`docs: record catalog continuity acceptance and remaining portal scope`提交；仅显式stage本批路径，不重复构建，也不包含其他窗口改动或QA产物。
