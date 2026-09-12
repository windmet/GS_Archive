# Archive Navigation B2 Inventory — 2026-09-12

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

`PASS`只表示已有机器合同覆盖；`PARTIAL`和`FAIL`均不得写成最终验收。

| 旅程 | 首轮状态 | 证据/缺口 |
| --- | --- | --- |
| N01 | PARTIAL | 集合/Player return已有测试；Portal与旧主线位置待Browser |
| N02 | PARTIAL | 活动筛选字段保留；列表滚动与焦点未恢复 |
| N03 | PASS | unit→song parent及unit实体已编码 |
| N04 | PASS | unit→event parent及unit实体已编码 |
| N05 | FAIL | `openEventCard`清空event后进入card，`goBackToCards`固定返回cards |
| N06 | PARTIAL | card→event→card可回；再回筛选列表可保留字段，位置/焦点未恢复 |
| N07 | PARTIAL | card详情保留筛选字段；位置/焦点未恢复 |
| N08 | FAIL | `openGashaCard`进入card后固定返回cards |
| N09 | FAIL | idol关联card进入详情后固定返回cards |
| N10 | PARTIAL | scope/query保留；位置/焦点未恢复 |
| N11 | PASS | song→collection parent、Player return已有合同 |
| N12 | PASS | Reader row/revision/range往返已有回归 |
| N13 | PASS | event Reader/Player来源实体已有回归 |
| N14 | PASS | work idol/story来源已有回归 |
| N15 | PASS | story detail作为Player return已有合同 |
| N16 | PASS | episode queue下一集不改return已有回归 |
| N17 | PASS | `portal_from`完整路由、刷新及迟到close抑制已有回归 |
| N18 | PARTIAL | Portal切section与Browser Back/Forward未执行完整矩阵 |
| N19 | PASS | card深链required/fallback已有route回归 |
| N20 | PASS | event/song/gasha required/fallback已有route回归 |
| N21 | PASS | Reader版本/行/range错误已有可解释失败回归 |
| N22 | PASS | navigation intent迟到响应抑制已有回归 |
| N23 | PARTIAL | 路由字段可往返；各组件选择/tab需逐页Browser |
| N24 | FAIL | archive_status→Spine/Chibi的返回固定home |

## 第一实现批边界

先修N05/N06/N07/N08/N09共用的详情来源问题。来源保存为一个经`archiveRoute`规范化、同源、长度受限、禁止Player/Portal/实验页、主动剥离内层来源的单层query；不复制整个浏览器history，不允许递归嵌套。卡片详情优先读取新来源，旧深链继续回cards；活动详情先保留旧`parent`兼容，后续同批迁移到相同解析器。完成后跑routes、navigation-state、async-navigation、portal-navigation及真实Browser活动430018报酬卡闭环。

## 第一实现批结果

卡片详情与活动详情现可持有一个`from`来源路由；Player仅在返回这两类详情时携带同一来源。解析器拒绝外部URL、超长query、Player/Portal/Reader/实验页目标，并在保存时移除来源中的内层`from`，因此关系链长度固定为一。新入口从cards、event、gasha或idol捕获完整canonical route；详情返回优先恢复该route，旧URL没有`from`时继续使用原cards/event parent兼容路径。

机器回归覆盖筛选cards→card URL往返、非法来源、禁止递归、card Player来源保留及无关Player不继承；routes、archive-navigation-state（47 refs、1792组合）、portal-navigation、archive-async-navigation、reading-playback通过。Browser 1280×900从活动430018打开北斗报酬卡`003hok_sr10`，URL包含单层编码的event来源；返回恢复`?view=event_detail&event=430018`。卡片页刷新后再次返回仍恢复同一活动，console error为0。N05的来源与刷新闭环由此修复；N06/N07/N08/N09已接同一入口代码及机器合同，仍需各自Browser旅程验收，列表滚动/焦点继续是独立缺口。

Vite构建通过，入口`index-BIIisoxJ.js` 547.95kB，保留既有chunk提示；仓库外产物`C:/Users/windm/.codex/qa/sidem-navigation-source-b1-20260912/build`。下一批处理N24资源实验页来源，并开始N18 Portal Back/Forward与滚动/焦点恢复证据。

## N24实现结果

`spine_lab`和`chibi_stage`现在可作为单层来源的持有页，但仍被禁止成为来源目标；从资源页进入任一实验页会保存`archive_status`，两个实验页互跳时沿用同一来源，返回统一恢复来源。没有`from`的旧实验页深链继续回home。route/state回归覆盖两页共享来源。Browser实际打开`archive_status`→Spine实验室，URL为`?view=spine_lab&from=%3Fview%3Darchive_status`；刷新后点击“返回资料馆”恢复`?view=archive_status`，console error为0。Vite构建2m46s通过，入口548.20kB，产物`C:/Users/windm/.codex/qa/sidem-navigation-n24-20260912/build`。N24的Spine路径已实测，Chibi互跳共享代码已机器覆盖，仍待完整视觉旅程。
