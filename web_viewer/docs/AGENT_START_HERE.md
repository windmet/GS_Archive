# AGENT_START_HERE

本项目是 local-first 的 GROWING STARS 档案门户与 Story Runtime，不再只是
“本地 SideM 剧情浏览器”。当前工作原则是小批、可证明、可回滚，并严格区分
本地资源存在、关系证明、稳定发布、浏览器验收和产品完成度。

## 一、开始任务前

按以下顺序读取：

1. `docs/PROJECT_MAP.md`
2. `notes/03_audit/GS_ARCHIVE_P0_ARCHITECTURE_CLOSEOUT_20260730.md`
3. `notes/03_audit/GS_ARCHIVE_PRODUCT_HISTORY_RECONCILIATION_20260730.md`
4. `notes/04_refactor/GS_ARCHIVE_POST_MERGE_NEXT_STEPS_20260729.md`
5. `notes/03_audit/CURRENT_ARCHIVE_BASELINE_20260728.md`
6. `notes/INDEX.md`
7. 用户本次明确点名的文件

只有任务涉及 Pixi/Spine 舞台时再读 `docs/SMOKE_CASES.md`、
`docs/SMOKE_EXPECTATIONS.md` 和 `docs/DO_NOT_REOPEN.md`。前两者是人工兼容
样例，不是自动化 Story Runtime 门禁。

然后只读核对：

```powershell
git status -sb
git rev-parse HEAD
git rev-parse origin/master
Get-NetTCPConnection -LocalPort 5174 -State Listen
```

交接文档中的 branch、PID、PR 和计数都可能漂移，必须以当前 checkout 和机器
报告为准。

## 二、当前优先级

- **P0：当前架构认知。** 保持 owner、adapter、route 和文档入口准确。
- **P1：用户可见门户与有界内容整合。** 优先可搜索、可跳转、可理解的产品
  能力；不得在 UI 批次中顺带创建 publication transaction。
- **P2-A：代表性 strict-v2 promotion。** 继续采用独立小批证据。
- **P2-B：2–4 小时 Runtime 长稳。** 状态仍是 `NOT EXECUTED`。它只阻止
  `release-accepted` 宣称，不阻止 P0/P1 工作。

不得因为长稳降为 P2 就写成已经通过，也不得在普通门户批次中顺手执行或伪造
长稳结论。

## 三、权威边界

1. masterdata 定义实体、标题、分组和关系语义。
2. RAW `asset/audio/movie` 提供物理载荷。
3. Unity object、container、PathID 和 CRI cue 选择包内子资源。
4. 整理者导出只作 parity、发现或兼容参考。
5. external GS translation links 是社区发现层，不进入本地 publication ledger。

文件名相似、token 出现、浏览器能显示或本地存在，都不能单独证明 exact relation
或 stable publication。

## 四、Runtime 定位

- `StoryViewer.vue` 协调播放会话、导航、历史恢复和诊断。
- `story-runtime/useStoryRuntimeCues.js` 是正式 cue 调度入口。
- `StoryAudioSession.js` 拥有统一音频会话；`useVoicePlayer.js` 是其 Voice
  适配器，不是独立音频系统。
- `SpineStage.vue` 是 Pixi 舞台的 Vue 适配层，不是整个 step timeline owner。
- `useStoryNavigation.js`、`useStepSceneEffects.js`、`AudioManager.js` 和
  `applyStepSceneState.js` 是 active adapter/compatibility modules，不是第二套
  Runtime owner。
- `DebugSnapshotRuntime.js` 和 `ReleaseSoakRecorder.js` 属于 debug/release
  instrumentation；后者的自动测试不证明真实长稳已经完成。
- `useTimelineRunner.js` 已不存在，不得作为当前核心模块引用。

修改 Runtime 前必须先读 `docs/PROJECT_MAP.md` 的 owner 表及对应 verifier。

标准命令：

```powershell
npm run verify:story-runtime-foundation
npm run verify:story-audio
npm run verify:routes
```

## 五、默认禁止扫描

不要默认读取：

- `node_modules/`、`dist/`
- `_archive/`、`_migration_backup*/`、`_encoding_review/`
- `_archived_volume_lipsync/`
- `external_raw/`、`raw/`、`public/raw/`
- 大体积 `.unity3d`、`.acb`、`.awb`、`.usm`
- 大量未索引 scenario

资源路径问题优先查 manifest、index、registry、catalog 和 store。只有任务明确
需要物理证据时才进入挂载 RAW。

## 六、修改与验收

1. 使用独立 `codex/` 分支。
2. 一个批次只处理一个产品域或一个治理边界。
3. 保持 5174 可用；页面修改从自然入口验证，并记录完整 URL 和 console。
4. source-only PASS 不替代 mounted、真实媒体或浏览器证据。
5. candidate 不得批量提升为 exact；不得一次替换整个 `public/assets`。
6. publication release 与 annotation 必须走独立 Schema、verifier 和 append-only
   规则。
7. 提交前执行相关 verifier、`git diff --check` 并检查生成报告 diff。

## 七、交付说明

每次交付至少说明：

1. 当前判断和实际修改；
2. 涉及文件；
3. 验证范围和结果；
4. 未验证或仍 deferred 的范围；
5. 风险与回滚入口；
6. 下一批从哪个文档或命令开始。
