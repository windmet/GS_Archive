# Story Runtime 合并后交接与剩余事项（2026-07-23）

## 本文定位

本文是 PR #1 合并后的唯一执行入口，供新窗口接手。它不取代架构设计、审计证据和旧发布指导，而是回答三个当前问题：

1. 哪些工作已经真正合入 `master`；
2. 哪些项目仍欠缺真实证据或产品化收口；
3. 新窗口应按什么顺序继续，且不得突破哪些边界。

如旧文档中的“尚未合并”“PR 仍为 draft”“strict corpus 尚未发布”等阶段性结论与本文冲突，以本文和对应文档中日期更晚的 follow-up 为准。

## 当前 Git 基线

- 仓库：`windmet/GS_Archive`
- 已合并 PR：[#1](https://github.com/windmet/GS_Archive/pull/1)
- 合并时间：2026-07-23 14:04:50（Asia/Shanghai）
- `master` 合并提交：`ef804fcb2b258979723fcf8ce62f317671b4d701`
- PR 最终 head：`e77495c1fd28727a587200267573b523ef41a500`
- 合并方式：merge commit；保留 88 个逻辑提交，未 squash
- 合并提交两个 parent：
  - 原 `master`：`6b10fbc758be41364dbed58643603a61b8d2c985`
  - PR head：`e77495c1fd28727a587200267573b523ef41a500`
- 原功能分支暂时保留，待发布交接稳定后再决定是否删除。

合并后已在 `origin/master` 的临时干净 worktree 中运行 source-only gate。`npm ci`、完整 story verifier、release soak recorder verifier、silhouette verifier、publisher/migration verifier 和 production build 均通过；build 为 2402 modules。source-only 环境中 mounted 媒体锚点按设计显式跳过，两条未挂载资源 URL 提示不等于运行时资源通过。

## 已完成范围

### Runtime 与消费端

- Story Runtime 已成为 screen、background、camera、SE、snapshot 等场景状态的唯一 owner，旧 runtime writer 已清理。
- strict step 的 `entry_snapshot` 已通过统一 `StepSceneState` 投影供 StoryViewer、SpineStage、首屏 preload、dialogue visibility 与持久 BGM/Ambient 使用。
- 首页直接复用 `SpineStage` 的 standalone background owner 已补齐，首页黑屏回归已关闭；未恢复全局 legacy background writer。
- `102sha_001_00` 已成为审计支持的 silhouette-only 显式契约，并有 source-only verifier。
- StoryViewer 正常卸载和成功 Spine spawn 已降为 debug，不再污染发布 warning 统计。

### Audio 与可观测性

- Voice、BGM、Ambient、Runtime SE 已收敛到 `StoryAudioSession` 生命周期。
- BGM/Ambient 异步竞态、无 voice Choice 遗留上一句 voice source、stop/dispose pending load 等问题已有自动回归。
- `runtimeDebug=1` 可观察 Runtime、Spine、audio source/timer、overlay 和 Chromium heap。
- Release soak recorder 已提供 `START SOAK`、`STOP SOAK`、`EXPORT SOAK`，导出契约为 `story-release-soak-v1`。
- `noAudio=1` 会在 AudioContext 创建和 Voice/Lip、BGM、Ambient、Runtime SE 网络请求前短路，并自动包含 `noVoice=1`；它只用于无音频稳定性测试。

### Strict schema、compiler 与小批发布

- Authoritative v2 schema、JavaScript candidate compiler、Python native compiler、atomic publisher、backup/rollback、source-only gate 与 mounted corpus verifier 已形成闭环。
- 首个正式 collection `1_4_001_01`：
  - 11 files / 10 episodes；
  - 432 unique steps；
  - 139 unique voice refs；
  - aggregate 与 a–j 已正式切换为 `story-runtime-v2`。
- 第二个正式 collection `5_01_101_22`：
  - 3 files / 2 episodes；
  - 9 unique steps；
  - 6/6 voice refs resolved；
  - formal→compat non-text parity 与 Python native→JavaScript oracle parity 均通过。
- 两批发布都保留工作区外的旧文件备份与 manifest。不得因两批成功就直接覆盖全库。

### Localization 与 UI

- deterministic text identity、source hash、translation overlay、fallback-source 和结构化 bilingual view 已接入主要 Story UI。
- ADV、Choice、Backlog、Title、Synopsis、Mobile、Call、speaker/choice view 和语言切换已有自动或定点证据。
- 当前 formal overlay 只证明 3 个 valid unit 和 24 个显式 fallback unit；这证明机制有效，不等于完整中文化。

### CI 与合并

- source-only GitHub Actions 已运行并通过。
- PR #1 已从 draft 转为 ready，在精确 head SHA 上以 merge commit 合并。
- `origin/master` 合并提交的 parent、祖先关系、patch whitespace 和干净 build 均已复核。

## 仍欠缺的内容

### P0：真实发布稳定性证据

这些是当前最重要、且不能由 Node verifier 或 `noAudio` 代替的缺口：

- Edge 首次用户手势解锁和 autoplay 行为；
- 操作系统级真实 `document.hidden`、恢复及实际听感；
- 真实 BGM/Ambient 长淡入淡出、跨 episode 延续与恢复；
- 2–4 小时 Next / Auto / Skip / Backlog / Choice / episode 切换混合曲线；
- 数小时 heap、Spine instance、stage child、active source、timer、overlay 的连续收敛证据。

由于 IDM 会自动嗅探媒体请求，在用户明确确认 IDM 嗅探已停用前，禁止启动外部 Edge、独立 Playwright 或任何真实音频请求。`noAudio=1` 的通过不得写成音频验收通过。

### P1：Localization 与 corpus 覆盖

- Formal translation coverage 仍极低，只有 3 valid + 24 explicit fallback units 的已核证样本。
- Strict 正式发布当前只有两个 collection；相对完整 corpus 仍低于 1%。
- 下一批 strict 样本应补 Phone / Mobile / Choice 或无 Spine 等不同形状，但必须在 release acceptance 后另开小分支，继续按 dry-run、parity、备份、原子发布和回滚证据执行。
- `resource_manifest` 与 evidence `raw_values` 缺少足够 mounted shape 证据，仍是 authoritative schema 外围数据债；不能凭 compiler 保留字段就宣称已闭合。

### P2：产品化

以下均应在稳定性验收后另开分支，不进入本次文档交接：

- 一个完整、经人工通读的双语 episode；
- 稳定部署、公开演示入口；
- 错误页、缺资源状态和用户可理解的恢复路径；
- 播放器 UI 精修与可访问性补充；
- 按 `1 → 3 → 10 → 按类型抽样` 扩大 strict collection。

## 新窗口执行顺序

### 0. 只读接管

先运行：

```powershell
git fetch origin
git status -sb
git rev-parse HEAD
git rev-parse origin/master
Get-NetTCPConnection -LocalPort 5174 -State Listen
```

预期 `origin/master` 为 `ef804fcb2b258979723fcf8ce62f317671b4d701`。本交接时 `5174` 由 `127.0.0.1` 上 PID 984 监听并返回 HTTP 200，但 PID 和服务状态会漂移，新窗口必须重新核对。

同时确认：

- 只保留一个应用内浏览器标签；
- IDM 当前是否仍会嗅探媒体；
- 用户是否提供了连续 2–4 小时、CPU 可承受的测试窗口；
- 当前工作树是否有用户自己的未提交改动。

### 1. 先做无音频长测

在 IDM 仍启用时，只使用一个应用内标签和以下模式：

```text
http://127.0.0.1:5174/?view=player&story_type=main&story_section=101&scenario=episodes%2F1_4_001_01_d.json&start_step=1&end_step=48&return=story_collection&noAudio=1&runtimeDebug=1
```

点击 `START SOAK` 后执行正常 Next、Auto、Skip、Backlog、Choice 和 episode 切换。SPA 内 StoryViewer 卸载/重挂载会延续记录；硬刷新、关闭标签或重新加载站点会清空本次内存记录。

终点停在无进行中转场、无 voice 的普通 ADV/Choice 页，等待至少 30 秒，再点 `STOP SOAK` 和 `EXPORT SOAK`。把 JSON 保存在工作区外，并记录浏览器/系统版本、是否 `noAudio`、起止 episode、实际时长和操作曲线。

验收应检查 `summary` 与最后 25% 样本：

- heap 至少出现回落，稳定场景基线不能持续单调上升；
- quiet endpoint 的 `active_runtime_cues`、`audio_cleanup_timers`、`active_screen_overlays`、`silhouette_pending`、`silhouette_relayout_jobs` 为 0；
- `spine_instances`、`silhouette_instances`、`spine_container_children`、`debug_markers` 与终点画面一致；
- `stage_children` 不随 episode 单调累加；
- 新增资源失败、动画缺失、cue target unavailable、marker teardown 或未处理异常均判为问题。

记录器每 30 秒采样，最多 481 条（起始样本加 4 小时）。它只产生证据，不自动判定 PASS。

### 2. IDM 停用后再做真实音频

只有用户明确确认 IDM 嗅探已停用后，才开始：

- Edge 首次手势解锁；
- Voice、SE、BGM、Ambient 实际播放；
- 系统级切后台/恢复；
- BGM/Ambient 淡出、续播和跨 episode 所有权；
- 有声混合曲线和 quiet endpoint。

有声测试期间，active source 应与当时实际 BGM/Ambient/voice 所有权一致，不能机械要求全程为 0。若测试触发 IDM 下载窗格，立即停止音频路径；不要代替用户关闭 IDM 窗格。

### 3. 形成 release acceptance 结论

把无音频与有声音频证据分开记录，至少包括：

- 环境、commit、URL、时长和操作曲线；
- `story-release-soak-v1` 文件位置；
- warning/error 起始边界；
- 最后 25% 曲线判断；
- 已通过、未通过、未执行三类结论；
- 未执行项是否阻塞 release，以及后续负责人/issue。

只有完成该结论后，才决定下一批 strict collection 或产品化分支。

## 不得突破的边界

- 不把 `noAudio`、Node 100-cycle verifier 或 48 秒 recorder 自测写成真实音频通过。
- 不在稳定性测试窗口同时加入新 Chibi、门户、翻译批处理、compiler 大改或技术栈迁移。
- 不做全 corpus strict 覆盖；每批必须独立 dry-run、parity、备份、原子发布和回滚验证。
- 不恢复已经退役的 legacy runtime writer 来绕过 consumer 问题。
- 不删除 mounted corpus 备份或原 PR 分支，直到 release handoff 明确接受。
- 不额外开启浏览器窗口；普通调试只复用一个应用内标签。
- 不在未检查用户改动时清理或覆盖工作树。

## 参考文档索引

### 新窗口优先阅读

1. `notes/04_refactor/STORY_POST_MERGE_HANDOFF_20260723.md`
   - 当前唯一执行入口、剩余项、顺序和边界。
2. `notes/03_audit/STORY_RUNTIME_RELEASE_MATRIX_20260722.md`
   - 已执行浏览器矩阵、后续 follow-up 和仍未覆盖项目。
3. `notes/04_refactor/STORY_POST_88969A1_RELEASE_GUIDE_20260723.md`
   - 合并前发布收口、评估纠偏、soak 操作规程；现作为历史依据。
4. `notes/03_audit/STORY_AUDIO_SESSION_UNIFICATION_20260723.md`
   - Audio session 所有权、竞态修复、noAudio 边界和诊断证据。
5. `notes/03_audit/STORY_AUTHORITATIVE_V2_SCHEMA_20260723.md`
   - authoritative schema、compiler、publisher、两批 strict collection 和外围 schema 债。

### 架构与契约

- `notes/04_refactor/STORY_VIEWER_RUNTIME_REFACTOR_DESIGN_20260718.md`
  - Runtime 目标架构、生命周期、快照、迁移与验收设计。
- `notes/04_refactor/STORY_LOCALIZATION_CONTRACT_20260719.md`
  - text identity、source hash、overlay、fallback 与语言边界。
- `notes/03_audit/STORY_STRUCTURED_BILINGUAL_UI_20260722.md`
  - 结构化双语 UI 的组件覆盖和浏览器证据。
- `notes/04_refactor/STORY_VIEWER_NEXT_WINDOW_AUDIT_20260722.md`
  - PR 合并前的完整审计清单；仅用于追溯，不再作为首要入口。

### Runtime owner 与回归证据

- `notes/03_audit/STORY_SCREEN_RUNTIME_OWNER_20260722.md`
- `notes/03_audit/STORY_BACKGROUND_RUNTIME_OWNER_20260722.md`
- `notes/03_audit/STORY_CAMERA_RUNTIME_OWNER_20260722.md`
- `notes/03_audit/STORY_SE_RUNTIME_OWNER_20260722.md`
- `notes/03_audit/STORY_SNAPSHOT_RUNTIME_OWNER_20260722.md`
- `notes/03_audit/STORY_RUNTIME_LEGACY_OWNER_CLEANUP_20260722.md`
- `notes/03_audit/ARCHIVE_HOME_BACKGROUND_OWNER_20260722.md`
- `notes/03_audit/1_4_001_01_ICON_SILHOUETTE_BG_AUDIT_20260708.md`
- `notes/REGRESSION_LEDGER_20260708.md`

### Migration 与发布证据

- `notes/03_audit/STORY_COMPILED_MIGRATION_DRY_RUN_20260722.md`
- `notes/03_audit/STORY_FORMAL_COLLECTION_MIGRATION_20260722.md`

## 交接完成条件

新窗口接管成功不等于立即开始有声测试。最低条件是：

1. 核对 branch、HEAD、worktree、5174 和 IDM 状态；
2. 明确本次窗口只做无音频 soak、真实音频验收或 release report 中的一类；
3. 保持单标签和低 CPU 边界；
4. 产出可复查的导出文件/日志，而不是仅口头描述“看起来正常”；
5. 将仍未执行的项目继续明确标记为未完成。

## 2026-07-28 `noAudio` deep-link startup follow-up

Commit `a393bba` fixed a startup-only isolation gap discovered during the first
publication-ledger browser transaction. Before asynchronous route restoration,
`App.vue` briefly mounted `ArchiveImmersiveHome`; its eager next-voice
preparation used an independent enabled AudioSession even when the requested
player route contained `noAudio=1`.

The application now remains in a neutral boot view until route restoration,
and the immersive home shares an AudioSession disabled by the page-level
`noAudio` flag. Fresh direct-player and home tabs showed no audio error, and a
home voice-button click in `noAudio` mode produced no error/warn. Automated
audio, home, route, Runtime foundation, production build, and GitHub
Source-only contract run `30375716445` passed.

This closes only the no-audio startup isolation defect. It does not count as
real Edge audio, autoplay, hidden/resume, cross-episode, or long-soak
acceptance. Existing Pixi Spine update/tint warnings remain a separate item.

## 2026-07-29 真实音频阶段验收 follow-up

用户已明确确认 IDM 从电脑删除，真实媒体请求前置条件已解除。Codex 应用内
Chromium 已完成 first gesture、Voice/SE/BGM/Ambient、跨 episode、Menu
pause/resume 和 debug visibility pause/resume 的 runtime 验证。

测试发现跨场景淡出会在浏览器原生 timer 上抛出 `TypeError: Illegal
invocation`，使 Ambient watcher 中断并阻止 BGM 切换。提交 `421c3b0`
通过 plain-function timer wrapper 修复 receiver，并让 persistent
BGM/Ambient watcher 与 `AudioManager.inspect()` 的实际状态对账。修复后
`event_before / ambi_shop_shoutengai` 正确切换到
`usual_day / ambi_room`；45 秒短记录末尾为 2 个预期持久 source、0 cleanup
timer、0 active Runtime cue。

详细矩阵与证据见：

`notes/03_audit/STORY_RUNTIME_REAL_AUDIO_ACCEPTANCE_20260729.md`

本 follow-up 只把真实音频状态从 `not executed` 推进到 `partial
acceptance`。Microsoft Edge 专属 autoplay、人工听感、真实
`document.hidden` 和 2–4 小时混合长稳仍未执行，Story Runtime 仍不能写成
release-accepted。
