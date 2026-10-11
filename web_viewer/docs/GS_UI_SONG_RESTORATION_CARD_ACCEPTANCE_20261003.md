# GS Archive 歌曲返回状态与卡片详情一致性

2026-10-03，接续[实体详情验收](GS_UI_ENTITY_DETAIL_ACCEPTANCE_20261003.md)。本批继续[UI Foundation](GS_UI_CONSTITUTION.md)的文字、间距、控件与返回合同。

## 输入与 Before

开始时HEAD为`60d8c1b3`。Before沿用5199服务PID42072的生产代码RAM pin，详情源码与上批提交相同；证据位于`.analysis/ui-song-restoration-20261003`。期间另一窗口继续提交Chibi，本批不回退或接管其工作。

| 已操作的旅程 / 样本 | 实际观察 |
| --- | --- |
| `flslgt`，320px，声部都筑圭 → 人物 → Shell返回 | 4人主演唱与49条声部使用重复`idol-reference:007kei`；返回归档关闭，焦点落在主演唱名单 |
| 全部卡片搜索`001tom_ssr01`进入，780px | Card client609 / scroll639；能力双列client543 / scroll606，等级select右缘794.9超出Card右缘765.1，截图可见裁切 |
| 同一卡片，820px | Card外层不溢出，但能力双列client583 / scroll606；select伸出该章节内容右缘 |
| 同一卡片，320px | 边框按钮30px、等级select28px、演出预览30px；实体标题18.4、章节14.72px |
| 卡片关联人物 → 天濑冬马 → Shell返回，320px | 两处人物入口复用`idol-reference:001tom`，实际焦点回头部，未回关联区 |
| 人物筛选阿斯兰 → `029ass_ssr01` → 日文资料，320px | 头部/关联的全名均为nowrap；head client78 / scroll178，relation client132 / scroll178，两处都省略 |

上述是实际访问与操作证据。卡片目录的搜索placeholder指向标题/稀有度；本次通过人物select访问阿斯兰样本，不将一次姓名检索无结果推定为所有目录检索失败。

## 实现与回归

歌曲主演唱、声部人物及声部组合拥有按歌曲和分组区分的焦点ID。普通进入仍保持49条声部懒挂载。详情提供显式`prepareRestoreFocus({focusId,songId,isCurrent})`，只展开属于当前歌曲、确有入口的归档；原生details的open与Vue挂载状态同步，再等待nextTick。

App在URL/history context采用后与歌曲ready时尝试同一一次性握手，等待异步详情真实实例准备目标，再调用既有恢复器。上下文、恢复revision、导航revision、组件实例、页面、歌曲和dispose共同约束归属；共享恢复器在frame前后及focus后写scroll前检查`isCurrent`。没有新增URL字段或缓存。

卡片接入文字与普通间距角色，保留卡面、SSR横图、单卡面系列缩略图的资源及几何用途。双列按详情实际内容宽度折列；桌面入口使用compact，手机/coarse使用44px、select16px。两处人物入口分别标记head/relation，姓名可自然换行；边框按钮的pressed语义与现有active状态同步。

头部右列保留至少240px，内容box不超过640px时头部与能力区折列；宽屏因内容触发的头部单列仍保留双卡面组340px上限。边框组不收缩、标签不换行。单卡面170px、手机卡面布局及系列74/62px几何保持；Card script与输入HEAD相同，未改变技能计算、关系解析或资源身份。

源码回归已通过：`verify-archive-view-restoration`、`verify-song-domain-landing`、`verify-archive-navigation-state`、`verify-archive-async-navigation`、`verify-archive-route-preparation`。

新增/扩展回归：

- `node --experimental-vm-modules scripts/verify-song-detail-presentation.mjs`运行真实Song与IdolReference SFC，覆盖懒挂载、唯一入口、语言与canonical identity、capture → prepare → shared restore、主名单隔离、错误/过期目标、换歌和卸载。多idol分组为明确标注的合成扩展，当前真实语料没有该布局。
- `node scripts/verify-song-archive-view-restoration.mjs`通过AST提取真实App采用/握手函数，并运行真实storage/core与navigation coordinator，覆盖早ready/晚挂载、并发单次恢复、未知focus的scroll恢复、归属撤销、竞争adopt及frame/focus取消。

这些是受控内存宿主证据，不能代替完整popstate加载、原生toggle时序或实际可见焦点。

Card既有回归通过：`node scripts/verify-card-detail-semantics.mjs`、`node scripts/verify-card-semantic-dictionaries.mjs`、`node scripts/verify-card-readmodel-navigation.mjs`、`node scripts/verify-card-voice-preview.mjs`、`node scripts/verify-archive-relation-navigation.mjs`。真实Card/IdolReference SFC编译及SSR检查覆盖pressed、唯一owner ID、等级描述与数据不变。头部CSS补丁后重新编译真实SFC的script/template/scoped style并检查diff；没有因CSS补丁重复跑数据回归。

## Browser / 构建结果

首轮`npm run build:check`输入HEAD为`077e3128`，14.22s通过；输出仍为唯一的`.analysis/build-check`，`copyPublicDir:false`。5199服务PID44992将编译代码pin在RAM中，映射当前public与外部readmodel，不复制媒体语料。来源摘要、源码SHA、首轮pin与HTTP回执分别保存在`source-before-build.json`、`pinned-code-initial-after.json`、`http-requests.jsonl`。readmodel release为`d30e1e94cc6a1089a9e7ecbf6111ff63be0bfdc714293c2ebca319976fde364a`。

歌曲在这份生产代码上完成以下真实Browser操作，源码随后独立提交并推送为`39ed7770`：

| After旅程，320px | 实际结果 |
| --- | --- |
| `flslgt`普通进入 → 展开声部 | 初始0条声部；展开后49条。4人主演唱与声部等54个focus marker各自唯一 |
| 声部都筑圭 → 人物 → Shell返回 | 原生details重新展开，49条已挂载，焦点回`007kei`的声部入口，scroll1830.8 |
| 同歌曲再从声部阿斯兰进入人物 → Browser back | 焦点回`029ass`的声部入口，scroll3063.0；继续回到先前history entry时仍恢复`007kei`/1830.8，两条同URL记录相互独立 |
| 折叠声部 → 主演唱都筑圭 → 人物 → Shell返回 | 焦点回主演唱入口；声部保持关闭、0条挂载 |
| `drvalv`组合声部Jupiter → 组合 → Shell返回 | 焦点回该歌曲/分组的`01jup`入口；真实16个组合及49个人物声部重新挂载 |

截图`song-shell-return-after-320.jpg`与`song-history-aslan-after-320.jpg`保留了返回入口与滚动位置；焦点身份另由DOM检查确认。该tab的warn/error记录为空；未启动播放器或Chibi。

卡片首轮实际操作已确认两处owner入口分别返回head/relation；阿斯兰日文全名在320px完整换行，select与直接操作为44px。但780px截图暴露头部文案列过窄，短姓名/组合名/边框按钮出现逐字换行。保留该中间证据为`card-header-narrow-intermediate-780.jpg`，修复后才做第二次构建。一次viewport操作实际作用在另一选中tab，随后通过`innerWidth`确认并重新操作；当时实际320px的照片命名为`card-skill10-after-320.jpg`，没有算作780px验收。

第二次`npm run build:check`输入HEAD为`b8edb7bb`，12.99s通过，源码SHA在构建前后相同。仅替换同一代码输出，不复制public。已核对5199原进程的脚本/端口/证据目录后，替换本任务服务为PID53728；5198/5200服务保持原有归属。191个RAM pin文件与该构建捕获的名称/SHA逐一匹配。证据为`source-header-before-build.json`、`build-check-header.log`、`compiled-header-build.json`、`pinned-code.json`、`after-server.json`。清单的PowerShell嵌套数组格式已用最初捕获的名称与hash核正，原回执保留为`compiled-header-build-array-receipt.json`，没有据此额外构建。

最终Browser实际加载`/_app/index-ByKPwLDq.js`，HTTP200/SHA `a5b5f34ce1c968914e0db9935b86bba21d88911300a933672a8f97b843f3718a`；Card CSS为`ArchiveCardDetail-B4DeibXu.css`，SHA `485bc757727fd62c8cbd478b568cf58019fee6aba77e36a53a2907a58b2525eb`。截至该轮复核，PID53728的227条HTTP请求没有400以上响应，server stderr为空；Card与最终Song tab的warn/error为空。这些回执证明本次代码/资料映射，不能替代媒体播放验收。

| 最终Card / Song After | 实际结果 |
| --- | --- |
| `001tom_ssr01`，780/820px | Card client/scroll分别609/609与649/649；能力区543/543与583/583，单列。780px select右缘与章节内容右缘均732.1；头部单列、卡面组340，短姓名与Jupiter一行，边框标签nowrap |
| 同一卡片，900/1280px | 900px头部340+303、能力区339.8+307.4，无溢出；1280px头部340+494.2。标题22、章节18，普通/特训后portrait均640×800、4:5 |
| 带框 → 无框、下一张 → 上一张，1280px | pressed随状态切换，portrait资源hide↔show且加载成功；邻居实际到`001tom_ssr02`后回`001tom_ssr01`，未因目录query只命中1张而禁用有效邻居 |
| SSR横图 → 原图查看 → 关闭，1280px | 两张1800×960横图成功加载，15:8几何保持；普通横图可打开并关闭。未据此宣称完整gallery焦点/键盘合同通过 |
| `009kyj_ssr02`，320px，Lv.1 ↔ Lv.10 | 长判定说明247/247无溢出；概率30%↔48%，PERFECT/GREAT与GREAT→PERFECT完整换行。select16px/44px，导航、边框、演出预览44px（Browser小数约43.994） |
| `036rui_ssr02`，320px | `出类拔萃的Entertainer`标题247/247，Card305/305，无溢出 |
| `001tom_sr04`，320px | PASSION FESTIVAL为1张真实单卡面，170px，640×800图片加载；49系列入口74px/图62px。零剧情真实隐藏，没有伪造empty文案 |
| `001tom_n01`，320px | N卡实际无技能/等级select、无剧情，Card305/305 |
| `029ass_ssr01`日文，320px | `アスラン＝ベルゼビュートⅡ世`头部112/112、关联124/124、14px/正常换行，两行完整。关系入口往返焦点relation/scroll186.2；头部往返焦点head/scroll0，均是当前卡片入口 |
| 最终构建`drvalv`，320px，Jupiter组合声部往返 | 普通进入0条人物声部；返回49人物/16组合展开，焦点回当前歌曲分组`01jup`，visible y455.1 / scroll1314.0 |

最终截图：`card-header-final-780.jpg`、`card-long-skill-final-320.jpg`、`card-single-final-320.jpg`、`card-long-owner-ja-final-320.jpg`、`song-unit-final-return-320.jpg`。切换viewport后核对实际`innerWidth`，截图使用稳定的Browser截图接口。卡片源码随后独立提交并推送为`0b413ef7`。

## 后续与边界

本批完成歌曲返回与Card一致性，继续人物/组合、活动详情，再处理共享QuickView/Solo安全区及Story等剩余筛选URL合同。不能从歌曲/卡片的覆盖推定其他域已验收。

下一批只读源码与当前readmodel选出的真实样本如下，尚未完成该域Browser Before：

| 样本 | 下一批针对的内容 |
| --- | --- |
| 人物`029ass` | 最长中日姓名、生日真实换行、头部切换器；17卡/15故事/16聊天/9电话 |
| 组合`02dra` | 最长组合名DRAMATIC STARS；3成员/3歌曲/3剧情、跨组合出演0 |
| 组合`10caf` | Café Parade五成员（含阿斯兰）、83卡、长成员入口 |
| 组合`14fla` | 属性出演/跨组合出演均0的合法可选章节隐藏 |

先实看1280/320与侧栏仍在的780/820，确认人物hero原名与目录/切换器的语言连续性、头部实际可用宽度及直接操作尺寸。再做两个详情的文字/间距角色、局部共享样式与必要的既有姓名回调接线；保留104/78px人物头像、44px歌曲封面、220/170px组合hero与74px logo的用途。返回入口和失败重试先操作再决定独立行为批，不把源码缺少focus marker或“请重试”文案直接写成已实测缺陷。当前49人物/16组合主要详情没有真实全空样本，不能伪造全空验收。

200% Browser zoom、真机触摸、音频试听/长稳及Chibi仍未由本批证明。Dialog M密度继续等待用户选择，本批实体详情不依赖该选择。
