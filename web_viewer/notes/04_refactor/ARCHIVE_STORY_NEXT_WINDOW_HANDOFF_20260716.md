# 资料门户与剧情浏览：新窗口开发交接（2026-07-16）

## 新窗口目标

把当前已经可用的资料页和剧情页收束为稳定的档案产品，而不是继续增加平行的临时分类页。

建议把工作分成两条紧密相连、但不可混写的主线：

1. **资料门户**：负责跨域入口、实体关系、默认浏览上下文和资料发现。
2. **剧情浏览**：负责故事集合、章节详情、简介、播放边界、连续播放和阅读状态。

Chibi 舞台是独立实验线。相关交接见 `STAGE_CHIBI_NEXT_WINDOW_HANDOFF_20260716.md`；除共享偶像/服装字典外，不要把舞台运行时并入档案路由或剧情播放器。

## 当前稳定基线

### 资料门户

- 首页、故事、偶像、卡片、卡池、互动、资源七个一级导航已经稳定。
- 偶像、卡片、互动采用内容优先入口；没有有效角色上下文时默认 `001tom`。
- 三个域之间切换会保留当前偶像。
- `ArchiveIdolSwitcher.vue` 是偶像详情与卡片页的共享切换契约。
- Mobile 归属互动，不再作为故事门户的重复入口。
- 旧 `view=idols&category=idol_chat/idol_phone` URL 会迁移到规范 Mobile 路由。

### 剧情浏览

- Main / Unit 已有 `story_collection` 集合页、正式章节和独立小话边界。
- Event 已有独立详情、奖励卡、出演偶像/组合和小话播放。
- Idol Episode 已有 49 人页面、78 个正式 section、491/491 个可播放分段。
- Work 与 Seasonal Campaign 已有专用页面。
- Mobile 已规范化为 personal / phone / unit / random 四类互动记录。
- 播放器支持 `start_step` / `end_step`、连续队列和返回原集合。
- `story_presentation_index.json` 已把播放前简介与正式播放步骤分离。

### 已知本地缺口

- Mobile `8_2_2_013` 仍缺少本地编译脚本；只能保留记录并禁用播放。
- Main 第三组、部分 Unit 第四章可能只有 masterdata 记录而没有本地剧情；不可伪造文本或文件。
- Extra、Birthday、Card Story 仍主要依赖通用搜索/旧分组，尚未全部获得专用集合详情。
- 用户阅读、收藏、解锁和已接收状态不属于静态 masterdata，当前没有权威服务端状态。

## P0：下一阶段必须先做

### 1. 统一 Story Collection 实体契约

不要先重画门户。先定义所有故事集合都能提供的最小结构：

```text
collection_id
domain
title / subtitle
visual
release_at
synopsis
chapters[]
episodes[]
relations[]
availability
source_provenance
```

现有 Main、Unit、Event、Idol、Work、Seasonal selector 应适配这个读取契约，但保留各自专用页面。统一的是数据和导航语义，不是强迫所有页面使用同一模板。

建议新建纯数据 selector/adapter，不要把关系推导堆回 `App.vue`。

### 2. 给剩余故事域建立正式入口

按以下顺序推进：

1. **Extra Story**：先按 masterdata 明确系列/标题分组，避免把 Home Story、纪念剧情和 Campaign 混成一类。
2. **Birthday**：区分偶像生日、Producer 生日和年度批次；入口显示年份与对象。
3. **Card Story**：以卡片资源为主体，卡池、活动、发行系列只作为关系，不把同活动所有卡强行视为同剧情。

每一类都必须先回答“集合实体是什么”，再做页面。搜索页继续作为诊断和跨域检索，不作为正式层级的替代品。

### 3. 收束故事门户

`ArchiveStoryCatalog.vue` 的 portal 模式最终只展示正式集合入口：

- Main Story
- Unit Story
- Event Story
- Idol Episode
- Card Story
- Work
- Birthday
- Extra / Campaign

门户卡片负责说明“进入哪个集合”，不直接承载大量 episode 列表。搜索模式保留域、可播放状态和证据筛选。

## P1：播放器产品化

在集合层稳定后，再补官方菜单中已经明确的产品行为：

- 连续播放开关；
- 播放速度；
- 台词显示开关；
- UI 隐藏；
- Skip；
- Log；
- 本地 Favorite。

实现约束：

- Raw 本来就是一小话一小话，不能重新合并成一个不可区分的大剧情。
- 简介只出现在播放前入口，不作为正式播放步骤。
- 连续播放应在一话结束后进行明确加载，再进入队列下一话。
- `start_step` / `end_step` 必须继续可深链接、刷新和返回。
- Log 从当前播放范围生成，不应跨越其他小话边界。

## P2：本地用户状态

建立版本化 client repository，首批只保存：

- story progress；
- favorite story/card/mobile；
- player preferences；
- last opened collection/idol。

不要把这些字段写回静态 masterdata JSON。需要提供 schema version、迁移和清空入口；URL 仍是可分享状态的唯一来源，本地状态不能覆盖显式 URL 参数。

## 数据证据硬约束

1. **卡片、卡池、活动剧情相互独立**。只有 masterdata/reward/gasha/release evidence 能建立关系。
2. 活动剧情可以有奖励卡和出演阵容，但“出现在同一活动”不等于“拥有共通卡片剧情”。
3. 单卡面 SR 系列可共享发行系列，但仍需逐卡保留资源与剧情状态。
4. Wiki 只用于补充、交叉验证和标注来源，不覆盖本地 masterdata 的原始字段。
5. 缺失内容显示 unavailable/missing，不生成占位剧情。
6. 日文 master text 是 source of truth；中文简介应作为 overlay，不覆写原字段。

## 推荐首批改动

新窗口第一批建议只做以下闭环：

1. 盘点 Extra / Birthday / Card Story 的 master rows、编译文件和现有 selector。
2. 输出三类的 collection 候选统计与无法归类清单。
3. 定义 `storyCollectionAdapter` 接口并先接入 Extra。
4. 建立 Extra 专用集合入口和详情页。
5. 补 verifier、桌面/390px 浏览器检查和文档。

完成一个域后再复制模式，不要同时开三个半成品页面。

## 关键文件

- `src/App.vue`：当前路由编排；继续减轻，不增加大段领域推导。
- `src/core/archiveRoute.js`：规范路由、旧 URL 迁移、一级导航归属。
- `src/data/archiveSelectors.js`：通用档案 selector。
- `src/data/storyCollections.js`：Main / Unit 集合基线。
- `src/data/idolCommunicationSelectors.js`：Idol Episode / Mobile 基线。
- `src/components/archive/ArchiveStoryCatalog.vue`：故事 portal/search 双模式。
- `src/components/archive/ArchiveStoryCollection.vue`：Main / Unit 集合页。
- `src/components/archive/ArchiveIdolStory.vue`：个人故事页。
- `src/components/archive/ArchiveEventDetail.vue`：活动详情页。
- `src/components/StoryViewer.vue`：播放器产品行为。
- `public/data/masterdata/story_master_index.json`：故事 master 入口。
- `public/data/masterdata/story_presentation_index.json`：简介与播放边界。

## 验收与提交

每批至少运行：

```powershell
npm run verify:routes
npm run verify:story-presentation
npm run verify:story-collections
npm run verify:story-playback-range
npm run verify:idol-story-interface
git diff --check
npm run build
```

浏览器至少检查：

- 1280x720 与 390x844；
- 入口、详情、播放器、返回四段闭环；
- 深链接刷新；
- 连续播放跨小话；
- unavailable 记录；
- 无横向溢出、图片缺失和 console error。

代码、生成数据、验证器、文档继续分批提交。不要把 Chibi 调试改动和档案/剧情改动混在同一个 commit。

