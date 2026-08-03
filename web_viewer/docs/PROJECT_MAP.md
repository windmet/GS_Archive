# PROJECT_MAP

GS Archive 是 local-first 的 GROWING STARS 档案浏览与重建项目。前端使用
Vue 3、Vite、PixiJS 7 和 Spine 3.8；仓库保存代码、Schema、关系规则、
验证报告和开发证据，不镜像 RAW、masterdata 原文件或大体积媒体。

## 1. 产品入口

```text
src/main.js
  -> src/App.vue
     -> archive/list/detail/resource views
     -> src/core/StoryViewer.vue
        -> src/components/SpineStage.vue
```

`src/core/archiveRoute.js` 是 query route 契约。当前正式视图包括：

```text
home
idols / idol_detail
unit_catalog / unit_detail
cards / card_detail
gashas / gasha_detail
event_detail
story_catalog / story_collection / story_detail
external_story_resources
seasonal_campaign
work_archive
idol_story_archive
mobile_archive
groups / episode_zero_units / episodes / files
archive_status
player
spine_lab / chibi_stage
```

不要从旧截图或旧 note 推断现行页面；以 `archiveRoute.js` 的
`VALID_VIEWS` 和 `App.vue` 的 view 分支为准。

## 2. Story Runtime 当前所有权

| 范围 | 当前 owner | 说明 |
| --- | --- | --- |
| 播放会话与导航协调 | `src/core/StoryViewer.vue` | 当前 step、历史恢复、Auto/Skip、暂停原因和诊断 |
| cue 归一化与调度 | `src/core/story-runtime/useStoryRuntimeCues.js` | 调度 Screen、Background、Camera、SE、Snapshot 和 Spine cue |
| 逻辑时间 | `src/core/story-runtime/StoryClock.js` | pause/resume/rate 和逻辑时间 |
| 场景历史 | `src/core/story-runtime/SceneSnapshotStore.js`、`src/core/story-runtime/StepSceneState.js` | settled/entry snapshot 与导航恢复 |
| 音频会话 | `src/core/story-runtime/StoryAudioSession.js` | Voice、SE、BGM、Ambient 的共享生命周期和 mixer |
| Voice 适配 | `src/core/useVoicePlayer.js` | 仍在使用，但依附共享 `StoryAudioSession`，不是第二套音频 owner |
| Pixi 舞台实现 | `PixiStageManager.js` 及各 Manager | 背景、镜头、Spine、屏幕效果的渲染执行 |
| Vue 舞台适配 | `src/components/SpineStage.vue` | manager 生命周期、runtime scene/snapshot 应用、诊断桥接 |

`useTimelineRunner.js` 已不在当前源码中，不得再把它列为正式 Runtime。
`SpineStage.vue` 也不是整个剧情 step 的权威调度器；正式 cue 调度属于
`useStoryRuntimeCues.js`。它仍可保留局部舞台同步和兼容适配职责。

### Active adapter 与辅助模块

以下模块仍在生产路径中，但不取代上表的 authoritative owner：

- `src/core/useStoryNavigation.js`：episode 范围、Next/Prev、Choice 和恢复入口；
- `src/core/useStepSceneEffects.js`：BGM、Ambient、Voice 触发和 legacy Auto
  适配；Screen、Background、Camera 和 SE 的 cue ownership 不在这里；
- `src/core/AudioManager.js`：在共享 `StoryAudioSession` 上实现 BGM、Ambient
  和 SE source；
- `src/core/applyStepSceneState.js`：应用仍未迁入 cue runtime 的局部视觉状态；
  不再拥有 `screen_slide`、`screen_fade`、Background 或 Camera transition；
- `src/components/SpineStage.vue`：将稳定 scene/snapshot 投影到 Pixi manager，
  不是另一套 timeline。

### Debug-only、release instrumentation 与 retired

- `src/core/story-runtime/DebugSnapshotRuntime.js` 只服务 `snapshotAt` 调试 cue；
- `src/core/story-runtime/ReleaseSoakRecorder.js` 只在 `runtimeDebug=1` 下暴露
  recorder UI/collector；它通过机器测试不等于 2–4 小时长稳已经执行；
- `src/debug/installSpineAnimationDebug.js` 是诊断桥，不是产品 route 或 Runtime
  owner；
- `useTimelineRunner.js` 已 retired 且不在 tracked source 中；
- 本地若存在 ignored 的 `src/core/PixiStageManager_4_guided_fix.js`，它是早期
  工作副本，不属于 Git 权威源码；正式实现只有 tracked
  `src/core/PixiStageManager.js`。

Runtime ownership 的标准机器入口是：

```powershell
npm run verify:story-runtime-foundation
npm run verify:story-audio
```

## 3. 工程分层

### `src/components/archive/`

门户页面和详情组件。包括角色、组合、卡牌、卡池、活动、剧情、移动端档案、
外部熟肉入口和资源状态页面。产品 UI 改动优先在这一层完成，不要把关系推导
塞进组件。

### `src/core/story-runtime/`

确定性 Story Runtime。新增跨 step 行为前，先确认现有 cue channel、snapshot
和 pause reason 是否已经覆盖该语义。

### `src/core/`

播放器容器、Pixi/Spine/背景/镜头实现、路由契约及 Runtime 的少量适配器。

### `src/data/` 与 `src/utils/`

前端选择器、索引标准化、字典、资源 URL、语言和文本辅助。只消费已生成的
public data，不扫描 RAW。

### `public/data/`

门户索引、compiled story、authoritative registry、publication ledger、
external story resources 和各类可再生关系 catalog。一个 compiled JSON
artifact 不等于一篇剧情。

生日域的章节、期次、角色与官方日期以
`public/data/masterdata/birthday_story_semantic_index.json` 为准；该索引由表
76/77/78/80/86 生成。表 80 未指定角色的记录不得仅按资源名归入某位角色。

卡片突破素材及技能分类以 `card_detail_index.json` 的去重字典为准：卡片表 1
字段 23 硬关联道具表 16，技能表 20 字段 8 硬关联分类表 75，中心技能表 23
字段 9 硬关联中心分类表 130。组件只通过 `archiveSelectors.js` 组装这些关系，
不得在 UI 内按稀有度或技能名称猜测。

### `scripts/`、`tools/`、`data_pipeline/`

离线生成、审计、candidate/parity/publish/rollback 和 verifier。它们不进入
浏览器 Runtime。RAW 提供物理载荷，masterdata 提供语义身份，整理者导出只作
parity 或兼容参考。

### `schemas/`、`policies/`

机器契约和治理策略。publication v1 已冻结；publication v2 和 annotation v1
已激活，但当前仍只有一笔 production release。

### `notes/`

审计证据和历史交接。当前入口见 `notes/INDEX.md`。历史 note 中的 P0/P1 标签
描述当时阶段，不自动成为今天的优先级。

## 4. 当前量化边界

以 `public/data/archive_baseline_report.json` 和各 verifier 为准：

- 3,398 个 RAW logical story group、4,939 个有效 part 均有唯一 public 对应；
- compiled 目录含 10,329 个 JSON artifact，不等于 10,329 篇剧情；
- strict authoritative Runtime v2 为 3 collections + 1 standalone /
  18 artifacts；
- publication ledger 为 1 release / 1 stable logical ID；
- external GS translation registry 当前有 8 条 exact mapping；
- tracked PNG 为 183 个，约 49.1 MB；其中 108 个为 grandfathered，
  14 个为 P1 Extra Story 导航视觉，61 个为 P1 Song 的有界 RAW-derived
  365x360 封面；
- USM 为 260 个，当前 89 exact consumer、166 exact masterdata、5 unresolved。

## 5. 当前优先级（2026-07-30）

### P0：收口当前架构认知

- 保持本文件、`AGENT_START_HERE.md`、route 表和 Runtime owner 说明一致；
- 将 authoritative owner、active adapter、deprecated 和 debug-only 模块分开；
- 新 Agent 不应依赖几十篇历史 note 才能找到现行入口。

### P1：用户可见门户与有界内容整合

- 改善搜索、关系跳转、观看入口、覆盖状态和移动端信息密度；
- 在 `ArchiveShell` 中增加由 route/entity 派生的统一面包屑，帮助用户理解
  “资料馆域 → 列表/集合 → 当前实体”的位置；
- 外部熟肉继续 exact-only、GS-only，并与本地 publication ledger 分离；
- P1 不等待 strict-v2 promotion 或 Runtime 长稳；P1 批次也不得顺带创建
  publication transaction。

面包屑不是浏览器 history 的可视化，也不替代现有 Back。`player`、
`spine_lab` 和 `chibi_stage` 保持全屏；它们只继续使用明确的
`return`/`parent` 返回契约。

### P2-A：代表性 strict-v2 promotion

只选择 Main、Unit、Idol、Event、Mobile/Call 等代表性 collection 小批推进，
不进行 3,398 group 一键迁移。P2-A 与 P1 产品 UI 使用独立分支和证据。

### P2-B：Runtime 长时验收

2–4 小时混合长稳、最后 25% 资源曲线和 quiet endpoint 尚未执行。它仍是
宣称 Story Runtime `release-accepted` 的必要证据，但不再是门户开发、
资源关系审计或代表性 v2 小批的阻塞条件。

## 6. 禁止默认扫描目录

- `node_modules/`、`dist/`
- `_archive/`、`_migration_backup*/`、`_encoding_review/`
- `_archived_volume_lipsync/`
- `external_raw/`、`raw/`、`public/raw/`
- 大体积 `.unity3d`、`.acb`、`.awb`、`.usm`
- 未索引 scenario 原始目录

只有任务明确涉及 RAW、包内对象、音频或视频物理身份时才读取这些范围。
