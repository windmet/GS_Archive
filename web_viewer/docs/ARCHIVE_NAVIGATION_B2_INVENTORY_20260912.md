# Archive Navigation B2 Inventory — 2026-09-12

> 2026-09-12 最新前置修复：见 [关系链逻辑盘点与交接](ARCHIVE_RELATION_CHAIN_CLOSEOUT_20260912.md)。Song→Idol/Unit 等遗漏关系、多层来源、Reader 返回及成员卡片网格刷新已修复；本轮完成定向 Browser 和代码回归，完整关系图/390px/Back-Forward 与原 N01/N23 收尾由验收窗口继续。之后再开始 U0/U1 门户启动 UX。历史 PASS 保持原证据范围，不外推为整张导航图已验收。

## 范围与证据边界

输入HEAD `d27fa61`。本轮只盘点 `archiveRoute.js`、`useArchiveNavigationState.js`、`App.vue` 的真实view/入口/返回写入点及现有路由回归，不把源码存在写成Browser验收。当前有30个合法view、8个Portal一级section；`portal_from`已经能保存一个有界的完整当前路由，普通详情之间仍主要依赖单值`parent`及若干页面专属parent ref。

## View合同盘点

| View组 | View | 当前canonical身份 | 当前返回owner | B2结论 |
| --- | --- | --- | --- | --- |
| Portal/Home | `portal` | `portal_from` | `closeArchivePortal`恢复完整路由 | 合同完整，需N18 Browser history验收 |
| Portal/Home | `home` | `home_idol/home_cue/home_costume` | 无 | 合同完整 |
| 剧情 | `story_catalog` | domain/mode/filter/sort | domain landing或home | 状态可编码，滚动/焦点未恢复 |
| 剧情 | `external_story_resources` | view | story catalog | 合同明确 |
| 剧情 | `story_collection` | type/section/story | 专属parent ref | song/idol/external已接，仍是枚举式来源 |
| 剧情 | `story_detail` | story | 专属parent ref | external/catalog已接 |
| 剧情 | `event_detail` | event + parent +相关实体 | `eventParentView`枚举 | card/idol/unit/home来源可回；进入卡片后来源丢失 |
| 剧情 | `seasonal_campaign` | section | story catalog | 合同明确 |
| 剧情 | `work_archive` | idol/story | story catalog | Reader往返已有回归 |
| 剧情 | `idol_story_archive` | idol | story catalog | Portal往返需保留组件选择态复核 |
| 剧情 | `reader` | reading/rev/row/mode +来源实体 | `closeStoryReader` | event/work/collection已接 |
| 播放 | `player` | scenario/range/return +来源实体 | playback controller | queue、Reader、event、collection已有回归 |
| 偶像/组合 | `idols` | category/unit_filter/query | home | 列表位置/焦点未恢复 |
| 偶像/组合 | `idol_detail` | idol | home | 从关联卡片返回会落到cards，来源丢失 |
| 偶像/组合 | `unit_catalog` | view | idols | 合同明确 |
| 偶像/组合 | `unit_detail` | unit | unit catalog | song/event来源返回已接 |
| 卡片 | `cards` | idol/rarity/assets/relation/query | idol detail | 筛选可编码，位置/焦点未恢复 |
| 卡片 | `card_detail` | card +卡片列表字段 | 固定`goBackToCards` | event/gasha/idol来源均无法返回，首个实现目标 |
| 卡池 | `gashas` | type/query | home | 筛选可编码 |
| 卡池 | `gasha_detail` | gasha +有限parent | collection或gashas | 进入卡片后来源丢失 |
| 歌曲 | `song_catalog` | scope/query | home | 筛选可编码，位置/焦点未恢复 |
| 歌曲 | `song_detail` | song + parent | idol/unit/song catalog | 已覆盖现有三种来源 |
| 互动 | `mobile_archive` | idol/unit/mode/scenario | home | Portal往返需组件状态复核 |
| 旧剧情入口 | `groups/episode_zero_units/episodes/files` | category/idol/group/unit/episode | 页面专属函数 | 保留兼容，需N01/N23回归 |
| 资源 | `archive_status` | view | home | 进入实验页后来源丢失 |
| 资源 | `spine_lab/chibi_stage` | view | 固定home/互跳 | N24失败，后续迁移来源路由 |

## N01–N24首轮状态

`PASS`表示该旅程的现有合同与指定Browser路径均已核对；`PARTIAL`和`FAIL`均不得写成最终验收。表内状态随执行批次更新，具体边界以各结果段为准。

| 旅程 | 首轮状态 | 证据/缺口 |
| --- | --- | --- |
| N01 | PARTIAL | 集合/Player return已有测试；Portal与旧主线位置待Browser |
| N02 | PASS | 活动筛选、长列表滚动与活动实体焦点在桌面/390px返回后恢复 |
| N03 | PASS | Jupiter→歌曲`unmikn`→Jupiter已实测；组合详情无tab，tab项为N/A |
| N04 | PASS | Jupiter→活动430018→Jupiter已实测，活动breadcrumb保持活动层级 |
| N05 | PASS | 活动430018→报酬卡及刷新后返回均恢复活动来源 |
| N06 | PASS | 北斗活动关联卡→活动430018→卡片→原3项关联筛选列表，来源、位置与焦点均恢复 |
| N07 | PASS | cards筛选、搜索、滚动与实体焦点按规范路由/history entry恢复；桌面与390px Browser已验收 |
| N08 | PASS | 卡池210003→关联卡→卡池→57项卡池列表，刷新、来源、位置与焦点均恢复 |
| N09 | PASS | 冬马偶像详情→19张卡片→卡片详情→逐层返回偶像；当前偶像详情无tab，tab项为N/A |
| N10 | PASS | 歌曲scope/query、长列表滚动与歌曲实体焦点在桌面/390px返回后恢复 |
| N11 | PASS | `drv999`→额外剧情602→Player→集合→原歌曲已实测 |
| N12 | PASS | 主线Reader双语step-8→Player→Reader，文档、模式、焦点与滚动已实测恢复 |
| N13 | PASS | Jupiter→活动430018→Reader→Player逐层返回Jupiter已实测，完整来源已修复并锁定 |
| N14 | PASS | Work切换翔太及场景台词tab后进入Reader，返回恢复偶像、tab与来源文件 |
| N15 | PASS | 生日剧情详情→Player→详情→生日搜索目录已实测，详情CAST保持源名 |
| N16 | PASS | Jupiter第一章episode1→下一话episode2→集合已实测，type/section/story/return与展开章保持 |
| N17 | PASS | 冬马SR末项→详情→Portal→刷新→关闭→详情→列表已实测，完整路由、1106px滚动与焦点恢复 |
| N18 | PASS | Portal→歌曲的Browser Back/Forward、关闭Portal恢复完整筛选来源已实测 |
| N19 | PASS | card深链required/fallback已有route回归 |
| N20 | PASS | event/song/gasha required/fallback已有route回归 |
| N21 | PASS | Reader版本/行/range错误已有可解释失败回归 |
| N22 | PASS | navigation intent迟到响应抑制已有回归 |
| N23 | PARTIAL | 路由字段可往返；各组件选择/tab需逐页Browser |
| N24 | PASS | archive_status→Spine→Chibi 5/5就绪→archive_status已实测，卸载清理合同已回归锁定 |

## 第一实现批边界

先修N05/N06/N07/N08/N09共用的详情来源问题。来源保存为一个经`archiveRoute`规范化、同源、长度受限、禁止Player/Portal/实验页、主动剥离内层来源的单层query；不复制整个浏览器history，不允许递归嵌套。卡片详情优先读取新来源，旧深链继续回cards；活动详情先保留旧`parent`兼容，后续同批迁移到相同解析器。完成后跑routes、navigation-state、async-navigation、portal-navigation及真实Browser活动430018报酬卡闭环。

## 第一实现批结果

卡片详情与活动详情现可持有一个`from`来源路由；Player仅在返回这两类详情时携带同一来源。解析器拒绝外部URL、超长query、Player/Portal/Reader/实验页目标，并在保存时移除来源中的内层`from`，因此关系链长度固定为一。新入口从cards、event、gasha或idol捕获完整canonical route；详情返回优先恢复该route，旧URL没有`from`时继续使用原cards/event parent兼容路径。

机器回归覆盖筛选cards→card URL往返、非法来源、禁止递归、card Player来源保留及无关Player不继承；routes、archive-navigation-state（47 refs、1792组合）、portal-navigation、archive-async-navigation、reading-playback通过。Browser 1280×900从活动430018打开北斗报酬卡`003hok_sr10`，URL包含单层编码的event来源；返回恢复`?view=event_detail&event=430018`。卡片页刷新后再次返回仍恢复同一活动，console error为0。N05的来源与刷新闭环由此修复；N06/N07/N08/N09已接同一入口代码及机器合同，仍需各自Browser旅程验收，列表滚动/焦点继续是独立缺口。

Vite构建通过，入口`index-BIIisoxJ.js` 547.95kB，保留既有chunk提示；仓库外产物`C:/Users/windm/.codex/qa/sidem-navigation-source-b1-20260912/build`。下一批处理N24资源实验页来源，并开始N18 Portal Back/Forward与滚动/焦点恢复证据。

## N24实现结果

`spine_lab`和`chibi_stage`现在可作为单层来源的持有页，但仍被禁止成为来源目标；从资源页进入任一实验页会保存`archive_status`，两个实验页互跳时沿用同一来源，返回统一恢复来源。没有`from`的旧实验页深链继续回home。route/state回归覆盖两页共享来源。Browser实际打开`archive_status`→Spine实验室，URL为`?view=spine_lab&from=%3Fview%3Darchive_status`；刷新后点击“返回资料馆”恢复`?view=archive_status`，console error为0。Vite构建2m46s通过，入口548.20kB，产物`C:/Users/windm/.codex/qa/sidem-navigation-n24-20260912/build`。N24的Spine路径已实测，Chibi互跳共享代码已机器覆盖，仍待完整视觉旅程。

## N18与列表恢复批结果

输入HEAD `b5b021c`。N18在真实Browser中从`cards/001tom/SSR/q=Jupiter`进入Portal，再进入歌曲档案：浏览器后退恢复带完整`portal_from`的Portal，前进恢复歌曲档案；再次后退并关闭Portal后，精确恢复原卡片筛选路线。全程无history重复写入、横向溢出或console error。

新增统一的列表恢复owner：页面离开前只读取显式标注的内部滚动容器与当前实体按钮，以规范路由保存最近状态，并以`sidemArchiveEntryId`区分同一路由的不同history entry。浏览器Back/Forward优先读取entry状态；顶部返回创建的新entry使用同一规范路由的最近状态。记录限制为80项，焦点ID有长度上限；sessionStorage不可用时导航继续工作。卡片、活动/剧情目录、歌曲和卡池已接入同一合同。

N07真实Browser使用冬马SSR与`q=ランウェイ`打开`001tom_ssr02`，返回后URL、搜索值、结果数与焦点全部恢复；另以19张冬马卡片长列表验证实际滚动，1280×900恢复到约970/970并聚焦同一卡片，390×844恢复到约1508/1508并聚焦同一卡片。浏览器前进到详情、后退到列表也恢复滚动位置和实体焦点；无横向溢出或console error。N02活动与N10歌曲已接入同一机制，仍需各自Browser长列表旅程后才能改为PASS。

机器回归新增`verify-archive-view-restoration.mjs`并并入`verify:archive-navigation-state`；routes、navigation-state、portal-navigation、archive-async-navigation、archive-startup-route与reading-playback均通过。生产构建通过，产物位于仓库外`C:/Users/windm/.codex/qa/sidem-navigation-restoration-20260912/build`，入口551.54kB，保留既有chunk提示。下一批执行N02活动列表与N10歌曲列表的实际位置恢复，再补N06/N08/N09关系链Browser证据。

## N02/N10 Browser扩展与卡片源名修正

N02使用活动检索目录的36条实体，从列表末端打开`430018 / GROWING SELECTION -運命光年-`。1280×900返回后恢复`event:1_3_30018_01.json`焦点及约1587/1587滚动；390×844恢复约3300/3300。N10使用60首歌曲目录打开末项`pl1gdd`，1280×900恢复约2466/2467，390×844恢复约8285/8285并聚焦同一歌曲；`song_scope=layered&q=DRIVE`打开`drvalv`后，返回仍保留scope、query与焦点。两域均无横向溢出或console error，因此N02/N10由PARTIAL改为PASS。

卡片目录标题此前单独使用中文实体译名，和同页偶像切换器的档案源名不一致。`currentCardCharacterName`现统一读取master-data源名；Browser确认顶部标题、正文标题和切换器均显示`天ヶ瀬 冬馬`。`verify:card-filters`新增此边界检查，826张卡片、1225组筛选组合通过。生产构建3m17s通过，入口551.54kB，产物`C:/Users/windm/.codex/qa/sidem-navigation-list-domains-20260912/build`，保留既有chunk提示。下一批继续N06/N08/N09关系旅程。

## N06/N08/N09关系旅程验收

输入HEAD `a494cbb`，本批没有修改导航实现，只对已落地的来源与恢复合同执行独立Browser验收。

- N06固定fixture为北斗卡片`003hok_sr10 / 頼もしさ添えるエール`及活动`430018 / GROWING SELECTION -運命光年-`。从`relation_state=event_card`的3项卡片列表进入卡片，再进入活动；活动顶部返回恢复卡片详情，卡片顶部返回恢复原关联筛选列表、`card:003hok_sr10`焦点和原列表状态。来源query保持单层，无横向溢出或console error。
- N08从57项卡池目录末端打开`210003 / GROWING TWILIGHT LIVEガシャ`，再进入`018shm_ssr01 / 華の支度は抜かりなく`。刷新卡片详情后，顶部返回恢复卡池详情；再次返回恢复卡池列表、`gasha:210003`焦点及约1969/1970滚动。无横向溢出或console error。
- N09从`idol_detail&idol=001tom`进入冬马19张卡片列表，打开末端`001tom_ssr02 / 賑やかなランウェイ`。返回后恢复`card:001tom_ssr02`焦点及约1149/1150滚动，再次返回准确恢复`idol_detail&category=idol&idol=001tom`；详情页、卡片页与切换器均显示源名`天ヶ瀬 冬馬`，无横向溢出或console error。当前`ArchiveIdolDetail`只有单一档案视图，没有tab控件，因此N09的tab恢复记为N/A，而不是缺证据。

N06、N08、N09由待Browser验收改为PASS。下一批优先执行尚未完成的N03/N04组合关系Browser路径，以及N24 Chibi完整视觉旅程；继续复用现有来源与恢复owner，不为单个入口增加页面私有状态。

## N03/N04与N24视觉验收

输入HEAD `2c86aa7`。N03从Jupiter组合详情打开`unmikn / 運命光年`，歌曲页保持“资料馆 / 歌曲 / 運命光年”的canonical breadcrumb，顶部返回准确恢复`unit_detail&category=idol&unit=01jup`。N04从同一组合页打开活动430018，活动页保持“资料馆 / 活动 / GROWING SELECTION -運命光年-”层级，顶部返回同样恢复Jupiter。当前组合详情没有tab控件，因此N03的tab恢复明确为N/A；两条路径无横向溢出或console error。

N24从`archive_status`进入Spine实验室，再通过“多人舞台”进入`chibi_stage`；两页URL持续携带单层`from=?view=archive_status`。Chibi舞台完成5名角色装载，状态由3/5到5/5，实际画面显示5人站位；“返回资料馆”恢复`archive_status`，无横向溢出或console error。`verify:song-experimental-audio`新增卸载边界，锁定构建/口型序列失效、动画停止、ResizeObserver、媒体与舞台声部、背屏/图像/物件/灯光/背景、角色runtime、阴影纹理和Pixi app释放；连同routes与archive-navigation-state均通过。N24由PARTIAL改为PASS。

下一批进入N11歌曲→剧情集合→Player逐层返回，以及N12/N13 Reader/Player来源与位置的真实Browser旅程。

## N11/N12/N13 Reader与Player来源闭环

输入HEAD `59ab950`。N11使用唯一已登记歌曲关联fixture `drv999 / DRIVE A LIVE（パッションMAX Ver.）`，进入`story_type=extra&story_section=602 / 2022年エイプリルフール`，再打开`episodes/5_03_000_22_a.json` Player。顶部返回依次恢复602集合和原`drv999`歌曲详情，canonical breadcrumb分别保持剧情集合与歌曲层级；无横向溢出或console error。页面准备期间的首次点击不计作失败，稳定后同一入口正常响应。

N12从主线Reader文档`1_4_001_01_d`的`step-8:text`、双语模式进入全篇Player。返回后文档ID、SHA revision、行锚点、双语选择、焦点和约769px正文滚动位置全部恢复；无横向溢出或console error。

N13实测发现旧实现只在Player URL暂时保留活动`parent=unit_detail`，Player返回Reader后会丢parent，Reader返回活动后也失去Jupiter来源。修复后，活动Reader及其Player统一携带`category=idol`、`unit=01jup`、`event=430018`、`parent=unit_detail`及单层`from=?view=unit_detail&category=idol&unit=01jup`；Reader刷新/Player往返均可复原这些字段，Reader→活动恢复完整活动来源，活动→Jupiter恢复`unit_detail&unit=01jup`。实现复用既有导航refs，没有新增第二份Reader来源状态。

`verify-reading-playback`新增真实App函数的活动来源往返与`closeStoryReader`目标验证，`verify-reading-navigation`覆盖完整非主线Reader路由；reading playback/navigation、routes、archive-navigation-state和archive-async-navigation均通过。生产构建通过，入口`index-BzsO9vel.js` 552.28kB，保留既有chunk提示；仓库外产物`C:/Users/windm/.codex/qa/sidem-navigation-reader-source-20260912/build`。下一批执行N14 Work选择态与N15详情→Player来源旅程。

## N14/N15 Work与剧情详情旅程验收

输入HEAD `9d7f8c1`。N14从冬马工作档案切换至`002sht / 御手洗 翔太`，选择“场景台词”并打开`1_5_002sht_1_5_002_00_0.json` Reader；返回后仍是翔太工作档案，场景台词tab保持激活，来源文件保留在规范路由中。N15使用生日剧情`1_x_001tom_1_7_001_01.json / 冬馬さん、お誕生日おめでとうございます！`，详情进入Player后返回原详情，再由详情返回`story_type=birthday&story_mode=search`的152项检索目录；筛选来源、路由和页面状态保持，无横向溢出或console error。

Browser核对同时发现剧情详情CAST仍使用界面本地化名，显示“天濑冬马”，与卡片页及master-data源名不一致。`ArchiveStoryDetail`现只在CAST入口改用`idolSourceName`，显示恢复为`天ヶ瀬 冬馬`；其他需要本地化的界面不受影响。routes、archive-presentation、birthday-story-domain-landing和work-story-index通过；生产构建2m55s通过，入口`index-BnDyiRIQ.js` 552.28kB，保留既有chunk提示，产物位于`C:/Users/windm/.codex/qa/sidem-navigation-work-story-20260912/build`。下一批继续N16/N17队列与Portal来源旅程，再回收N01/N23剩余Browser缺口。

## N16/N17队列、Portal来源与103kur加载修复

输入HEAD `a5f97b2`。N16从Jupiter剧情集合第一章打开episode1 `episodes/1_1_001_01_a.json`（2–17），播放完成后点击“下一话”进入episode2 `episodes/1_1_001_01_b.json`（1–28）；`story_type=unit_story`、`story_section=1`、章节文件、`return=story_collection`及队列范围均保持。返回集合后第一章仍展开，console error为0。

N17从冬马SR的12项列表滚至末项`001tom_sr13`（约1106/1106），进入卡片详情，再打开Portal并刷新。关闭Portal精确恢复原卡片详情；详情返回精确恢复`idol=001tom&rarity=SR`列表、`card:001tom_sr13`焦点及约1106px内部滚动，无横向溢出或console error。卡片详情的同系列角色名同时改用master-data源名，Browser确认冬马、翔太、北斗、FRAME及Altessimo均保持日文源名。

该旅程还暴露episode2的`103kur_001_00 / 黒井社長`只有正式剪影PNG、没有Spine bundle；旧预载会继续请求不存在的placement/mouth/atlas，Vite的HTML fallback又被当成JSON或atlas文本，最终产生4项失败。现将该模型加入审计过的静态剪影清单；只在其全部use均属于剪影bundle时排除人物placement/mouth预热，共用真实Spine人物的依赖仍保留。预载器拒绝HTML响应，atlas解析器也只接受`.png`页名，避免HTML标签再变成假纹理URL。Browser重载episode2后失败横幅消失，推进至12/28显示黒井社長全身黑色剪影，左上角没有社长/组合小图标，console error为0。

`verify:card-filters`、portal/navigation/route/playback回归、story config/spine/atlas/silhouette、`verify:story-loading-safety`、runtime/stage/plan/asset-plan均通过；本地725个atlas页全部符合PNG合同。生产构建2511 modules、3m01s通过，入口`index-C1MBxdDq.js` 552.94kB，保留既有chunk提示，产物在`C:/Users/windm/.codex/qa/sidem-navigation-queue-loading-20260912/build`。N16/N17完成；下一批处理N01/N23尚缺的真实Browser覆盖。个人、卡片、通信不新增Reader入口。
