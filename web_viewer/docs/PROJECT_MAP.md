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
| 场景历史 | `SceneSnapshotStore.js`、`StepSceneState.js` | settled/entry snapshot 与导航恢复 |
| 音频会话 | `StoryAudioSession.js` | Voice、SE、BGM、Ambient 的共享生命周期和 mixer |
| Voice 适配 | `src/core/useVoicePlayer.js` | 仍在使用，但依附共享 `StoryAudioSession`，不是第二套音频 owner |
| Pixi 舞台实现 | `PixiStageManager.js` 及各 Manager | 背景、镜头、Spine、屏幕效果的渲染执行 |
| Vue 舞台适配 | `src/components/SpineStage.vue` | manager 生命周期、runtime scene/snapshot 应用、诊断桥接 |

`useTimelineRunner.js` 已不在当前源码中，不得再把它列为正式 Runtime。
`SpineStage.vue` 也不是整个剧情 step 的权威调度器；正式 cue 调度属于
`useStoryRuntimeCues.js`。它仍可保留局部舞台同步和兼容适配职责。

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
- tracked PNG 为 108 个，约 26.4 MB；
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
- 严格 v2 只做代表性小批，不进行 3,398 group 一键迁移。

面包屑不是浏览器 history 的可视化，也不替代现有 Back。`player`、
`spine_lab` 和 `chibi_stage` 保持全屏；它们只继续使用明确的
`return`/`parent` 返回契约。

### P2：Runtime 长时验收

2–4 小时混合长稳、最后 25% 资源曲线和 quiet endpoint 尚未执行。它仍是
宣称 Story Runtime `release-accepted` 的必要证据，但不再是门户开发、
资源关系审计或代表性 v2 小批的 P0/P1 阻塞条件。

## 6. 禁止默认扫描目录

- `node_modules/`、`dist/`
- `_archive/`、`_migration_backup*/`、`_encoding_review/`
- `_archived_volume_lipsync/`
- `external_raw/`、`raw/`、`public/raw/`
- 大体积 `.unity3d`、`.acb`、`.awb`、`.usm`
- 未索引 scenario 原始目录

只有任务明确涉及 RAW、包内对象、音频或视频物理身份时才读取这些范围。
