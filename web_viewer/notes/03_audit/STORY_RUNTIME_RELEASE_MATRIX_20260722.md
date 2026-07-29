# Story Viewer 运行时发布验收记录（2026-07-22）

> **当前路由：** PR #1 已合入 `master`（`ef804fcb2b258979723fcf8ce62f317671b4d701`）。本文件继续承载浏览器验收证据；新窗口的执行顺序、剩余缺口和文档索引统一见 `notes/04_refactor/STORY_POST_MERGE_HANDOFF_20260723.md`。

> **2026-07-29 follow-up：** 用户已确认 IDM 删除；应用内 Chromium
> 的真实 WebAudio 状态矩阵已推进到 partial acceptance。跨场景 timer
> receiver 缺陷由 `421c3b0` 修复。用户确认短时听感无异常，且多个常用调试
> 片段中的 Voice、SE、BGM 均正常出现；Microsoft
> Edge 首次点击、最小化暂停和恢复续播通过。Codex 应用内浏览器最小化不
> 报告 hidden，blur fallback 会误停且已撤回。详情见
> `notes/03_audit/STORY_RUNTIME_REAL_AUDIO_ACCEPTANCE_20260729.md`。当前剩余
> release blocker 为 2–4 小时混合长稳。

## 结论

本轮在 `5174` 本地服务上完成了单标签页、低负载的重点发布回归。固定剧情锚点 `1_4_001_01_d` 在 default、`runtimeCues=1`、`runtimeSpine=0` 三种模式下均可正确前进和返回；第 12 步相关黑屏过渡在返回后没有残留 overlay；浏览器应用日志中实际 `error` 数为 0。

本记录只覆盖本轮实际执行的重点矩阵，不替代完整的 1920×1080、Auto/Skip、音频生命周期和后台恢复发布验收。

## 环境

- 分支：`codex/story-localization-contract`
- 基线提交：`81cd1f8`
- 服务：`http://127.0.0.1:5174/`
- 浏览器：Codex 内置浏览器，始终复用同一个标签页
- 主要 viewport：`1280×720`
- Localization stress viewport：`390×844`

## 固定剧情锚点

基础 URL：

```text
http://127.0.0.1:5174/?view=player&story_type=main&story_section=101&scenario=episodes%2F1_4_001_01_d.json&start_step=6&end_step=12&return=story_collection
```

淡入淡出复核区间：

```text
http://127.0.0.1:5174/?view=player&story_type=main&story_section=101&scenario=episodes%2F1_4_001_01_d.json&start_step=11&end_step=14&return=story_collection
```

## 实测矩阵

| 模式 | 操作 | 预期 | 结果 |
| --- | --- | --- | --- |
| default | 第 6–12 步区间 Next → Prev | 相对步数和对白恢复 | PASS |
| `runtimeCues=1` | 第 6–12 步区间 Next → Prev | 相对步数和对白恢复 | PASS |
| `runtimeSpine=0` | 第 6–12 步区间 Next → Prev | 相对步数和对白恢复 | PASS |
| default | 第 11 步 → 第 12 步 → Prev | 返回第 11 步，画面恢复且无残留黑色 overlay | PASS |
| `runtimeCues=1` | 第 11 步 → 第 12 步 → Prev | 返回第 11 步，状态恢复 | PASS |
| `runtimeSpine=0` | 第 11 步 → 第 12 步 → Prev | 返回第 11 步，画面恢复且无残留 overlay | PASS |

补充观察：过渡期间的快速连续点击会被输入门禁忽略。验收采用等待可交互状态后再执行下一次操作；短暂的 DOM/画面跨帧差异未作为状态错误记录。

## Localization stress

URL：

```text
http://127.0.0.1:5174/?view=player&scenario=fixtures%2Fstory_localization_stress.json&start_step=1&end_step=10
```

在 `390×844` 下检查了长中文和 JP+CN 展示；语言切换前后保持在相同剧情步，未出现应用级 console error。

## 日志结论

- 应用级 `console.error`：0
- 可见的 PixiJS deprecated warning 属于依赖弃用提示，不计作本轮功能回归
- 浏览器宿主的 Statsig 网络超时属于 Codex 浏览器遥测，不属于 `5174` 应用日志

## 尚未覆盖

- `1920×1080` viewport
- Backlog restore、Choice、episode next
- Auto、Skip all、Skip read
- 首次音频解锁、SE/BGM/ambient、切后台恢复与结束 dispose
- 长时间内存增长观察

这些项目仍应在正式合并前按 `STORY_VIEWER_NEXT_WINDOW_AUDIT_20260722.md` 的完整发布矩阵执行。

## 2026-07-22 Runtime owner cleanup follow-up

基线更新为 `baf44df` 后，Screen、Background、Camera、SE、Snapshot 与 Spine 已成为无 feature flag 的唯一 Runtime owner；`runtimeCues`、`runtimeScreen`、`runtimeBackground`、`runtimeCamera`、`runtimeSE`、`runtimeSnapshots`、`runtimeSpine` 均已退役。上面的 flag matrix 作为迁移历史保留，不再代表当前回滚接口。

本轮在始终只有一个浏览器标签页的条件下追加验证：

| 环境/模式 | 锚点 | 结果 |
| --- | --- | --- |
| `1280×720` default | `1_4_001_01_a` step 38 | Camera 5.5s、SE 4.0s/5.6s 均由 Runtime 调度并启动，PASS |
| `1280×720` 全部退役参数设为 `0` | 同上 | 调度清单与 default 相同，证明旧参数被忽略，PASS |
| `1280×720` default | `1_4_001_01_d` step 12→13→Prev | fade 与 neck cue 启动；返回通过 entry snapshot 恢复且无应用错误，PASS |
| `390×844` default | `1_4_001_01_d` step 12 | 控件与对白可访问，无应用错误，PASS |
| `1920×1080` default | `1_4_001_01_a` step 38 | 控件与对白可访问，无应用错误，PASS |

构建与源码边界：

- 完整本机挂载：`node scripts/verify-story-runtime-foundation.mjs`、`node scripts/verify-story-playback-range.mjs`、`npm run build` 通过。
- 干净 source-only detached worktree：`npm ci`、Runtime foundation、Localization、Translation、Story Text verifier 与 `npm run build` 通过。
- Runtime foundation 对未纳入 Git 的 a/d mounted-corpus 锚点采用显式 `ENOENT` skip；核心 Runtime 与已跟踪 fixture 在 source-only 环境仍严格验证。挂载 corpus 后 a/d 断言仍会执行。
- `5174` 返回 HTTP 200；验收结束后恢复 `1_4_001_01_d` step 1–48 地址，浏览器仍只有一个标签页。

仍未在本轮执行长时间内存观察、后台切换和完整音频 mixer 生命周期；这些属于后续 P3 音频统一/稳定性工作，不影响本次 Runtime/Localization 基础设施 owner 收口结论。

## 2026-07-23 Audio Session follow-up

实现提交 `3ecd5b5` 已把 StoryViewer voice、BGM、Ambient 与 Runtime SE 收口到一个 AudioContext 和四条 mixer bus。自动验证 `npm run verify:story-audio` 覆盖单 owner、手势解锁、多暂停原因、rate、source release、voice onended 竞态和幂等 dispose；Runtime foundation、播放范围与生产 build 同批通过。

5174 始终复用一个标签页，实测首次 Next 手势、Runtime SE、voice、菜单打开/关闭、恢复前进与返回集合后的卸载 dispose；应用级 console error 为 0。验收结束后恢复 `1_4_001_01_d` step 1–48，标签页数量仍为 1。

尚未覆盖 Edge autoplay、自动化后台切换听感、真实 BGM/Ambient 长时间淡化恢复、跨 episode 长测及持续内存增长。音频 owner 阻塞已经解除，但 release stability 仍未完成。详细证据见 `STORY_AUDIO_SESSION_UNIFICATION_20260723.md`。

## 2026-07-23 第二 strict collection 与 PR 收口

`5_01_101_22` 已按 formal→audited compatibility→Python native strict 的两段证据链发布 aggregate/a/e 三份文件。6/6 voice refs resolved，9 unique steps 的 schema、text、voice cue、playback range、presentation、home、audio isolation 与 publisher/migration verifier 均通过；旧文件和 backup manifest 位于 `C:\Users\windm\AppData\Local\Temp\sidem-authoritative-backup-5_01_101_22-e4b8592cda5943ac849ff9a4c138cd4b`。

这次发布没有新增浏览器音频验收。IDM 会对媒体请求自动嗅探，后续画面调试仍只允许单个应用内标签与 `noAudio=1`；真实 Edge/后台/长时间音频必须另行安排，不能用 noAudio 结果代替。

PR #1 在 `88969a18` 的只读 GitHub 核对为 80 commits、131 changed files、+18,514/-838、draft、mergeable、0 status checks，且仓库无 `.github/workflows`。后续执行入口改为 `notes/04_refactor/STORY_POST_88969A1_RELEASE_GUIDE_20260723.md`：冻结 feature scope，先补 source-only CI 与真实环境 release acceptance，再收口合并。

## 2026-07-23 Source-only CI follow-up

新增 `.github/workflows/web-viewer-source-gate.yml`，对 PR、master push 与手动触发提供只读、20 分钟、同 PR 自动取消的 source-only gate。矩阵包含 authoritative schema/shape、Localization、Translation、Text、Audio、Runtime foundation、strict publisher、compiled migration 与 production build；路径过滤覆盖 `data_pipeline/**`、`web_viewer/**` 和 workflow 自身。

workflow 通过 `actionlint v1.7.12`。独立 detached checkout 在没有 mounted corpus/assets 的条件下执行 `npm ci`（108 packages，0 vulnerabilities）及全部命令，2401-module build 通过；schema 明确报告 mounted a/d anchor skip，并仍验证 tracked fixtures。

远端首次 run `29976181433` 在完整 PR patch 中发现 5 个历史 whitespace 问题并失败，证明 patch gate 生效；机械清理后 run `29976275109` 的 15 个步骤全部通过，25 秒完成。Source-only GitHub CI 缺口关闭。

## 2026-07-23 noAudio 混合播放与 marker teardown follow-up

单个应用内标签、`noAudio=1&runtimeDebug=1` 在正式 strict `1_4_001_01_a` step 37–42 执行：

```text
Choice
→ step 38 cue settle
→ Menu / Backlog
→ restore step 37 Choice
→ Auto 跨 step 38 blocking camera cue
→ step 40 Choice
→ Skip All
→ EPISODE COMPLETE
→ 次の話进入 episode b
→ simulated hidden / visible
```

首次从旧页面切换锚点时发现 `clearAllSpines` 在 debug overlay 已销毁后再次销毁 marker，触发 `Cannot read properties of null (reading 'refCount')`。修复后 manager teardown 先以 `immediate: true` 清理 marker/Spine wrapper，再销毁 overlay；删除了 delegate return 后的旧 dead clear implementation，并新增 exactly-once marker/wrapper verifier。

同一标签 HMR/reload 后重复曲线：

- Backlog 正确恢复到 step 37 的 Choice identity；
- Auto 等待 blocking cue 后到达 step 40 Choice；
- Skip All 到达 6/6 episode complete，下一话进入 `episodes/1_4_001_01_b.json` 并加载 `001tom`；
- simulated hidden 增加 `visibility` pause reason 并暂停 Runtime，visible 后 reason 清空、clock 恢复；
- AudioContext 始终 `uninitialized`，active sources、cleanup timers 始终为 0；
- 含 1 个 Spine 的 episode b 退出后，新鲜 `debug marker` warning 为 0；
- heap 观测约 89–108 MB，Backlog restore 后回落；这只是短曲线，不是 2–4 小时 soak。

截图保存在工作区外：`C:\Users\windm\AppData\Local\Temp\sidem-noaudio-mixed-after-marker-fix.png`。日志中的 `102sha_001_00` load warning 对应已知缺失 Spine→`public/assets/silhouette/102sha_001_00.png` fallback；Codex Browser Statsig timeout 属于浏览器宿主。两者不等于 marker teardown 回归，但 fallback warning 仍应在后续 missing-resource UX/日志降噪批次处理。

## 2026-07-23 Silhouette-only 资源契约 follow-up

`102sha_001_00` 已由“失败加载后补救”改为显式 silhouette-only 契约。当前审计只证明这一项确实没有 Spine 且已有正式 PNG 舞台剪影，所以另外 4 张已跟踪 silhouette PNG 没有被无证据地加入白名单。

Runtime 在调用 `spawnSpine` 前识别该契约，直接复用或加载 `public/assets/silhouette/102sha_001_00.png`；不再请求已知不存在的 `comu.atlas` / `comu.skel`。`verify:silhouette` 同时锁定白名单、PNG 存在、Spine 文件仍缺失以及 direct fallback 位于网络探测之前；source-only GitHub Actions 已纳入该门禁。

单个应用内标签、`noAudio=1&runtimeDebug=1` 在正式 strict `1_4_001_01_a` displayed step 24 定点复核：

- 剪影和背景均正常可见；
- 新日志中 `102sha_001_00`、`Failed to load texture`、`Offset is outside` 命中数均为 0；
- AudioContext 仍为 `uninitialized`，active sources 为 0，session/manager 均为 disabled；
- 验收后恢复 `1_4_001_01_d` 完整 URL，并只保留 1 个标签。

`verify:silhouette`、Spine fade/motion、Runtime foundation、首页背景 owner、playback range 与 2401-module production build 均通过。本项关闭已知 fallback 请求与日志噪声，不改变剩余 Edge autoplay、真实后台听感和数小时有声 soak 的未完成状态。

## 2026-07-23 Release soak recorder follow-up

`runtimeDebug=1` 新增显式、默认不启动的 `story-release-soak-v1` 记录器：

- 30 秒采样，481 条有界容量，覆盖起始样本与最长 4 小时；
- 记录 route/step、heap、Spine、silhouette/pending、stage/spine-container child、debug marker、audio source、cleanup timer、Runtime active cue、screen overlay 与 silhouette relayout job；
- 记录器由模块级诊断 owner 持有，StoryViewer 在 mount/unmount 时只 attach/detach collector，因此 SPA 内跨 episode 继续同一会话，且不会保留旧组件闭包；
- `STOP SOAK` 后由 `EXPORT SOAK` 在页面内生成完整 JSON；不自动下载文件，避免额外下载/嗅探行为；
- 瞬时 Runtime DOM 诊断由 500ms 降到 2 秒刷新，采样本身每 30 秒才执行。

单个应用内标签、`noAudio=1&runtimeDebug=1` 的真实计时复核先发现并修复浏览器原生 `setInterval` receiver 导致的 `Illegal invocation`；新增 receiver-sensitive 回归后重新实测：

- 30 秒后 sample count 从 1 增至 2，手动停止增加终点样本，总计 3 条；
- export contract/status/stop reason/summary 均完整；
- used heap first/last/min/max 为约 127.7/123.7/123.7/136.1 MB，记录到回落；
- active audio source、cleanup timer、Runtime active cue、screen overlay、silhouette pending/relayout job 均为 0；
- 本轮采样开始后的应用 warning/error 为 0；
- 成功加载 Spine 的 `[SPAWN_DONE]` 从 `console.warn` 降为仅 debug mode 下的 `console.debug`，不再污染发布 warning 统计。

`verify:release-soak` 覆盖容量停止、summary、手动停止、浏览器 timer receiver、旧 collector 释放、跨 StoryViewer 重挂载续接和 UI/manager 静态接线，并已加入 source-only GitHub Actions。该 48 秒曲线只验收工具本身，不替代文档要求的 2–4 小时曲线或真实有声音频验收。

## 2026-07-23 Lifecycle warning severity follow-up

应用级 `console.warn` 复核确认，Story Runtime 主路径中只有 `StoryViewer onBeforeUnmount FIRED!` 是正常生命周期事件却使用 warning；资源缺失、加载失败、动画缺失、cue target unavailable、teardown 失败等其余 warning 均保留。正常 Spine spawn 已在上一提交降为 debug，本轮又将 StoryViewer unmount 改为仅 `runtimeDebug` 下的 `console.debug`，并在 `verify:release-soak` 中禁止两类成功事件回退为 warning。

单个应用内标签、`noAudio=1&runtimeDebug=1` 从正式 `1_4_001_01_d` 点击“戻る”触发真实卸载并返回 `view=story_collection`；以点击前时间为日志边界，本次新增 warning/error 为 0，生命周期/SPAWN marker warning 命中为 0。随后恢复完整 `d` URL，仍只保留 1 个标签。Codex Browser 宿主 Statsig timeout 不属于页面日志。

`verify:spine-motion`、`verify:spine-fade`、Runtime foundation、home、playback range、100-cycle audio/noAudio verifier 与当前 2402-module production build 均通过。本轮仍不得记作 Edge autoplay、真实 `document.hidden` 听感或有声长测。

## 2026-07-23 Preferences 与 authoritative schema follow-up

- `7c1f1b2` 已退役未生效的 `text_speed`；旧 v2 localStorage 会自动清理该键并保留其他偏好，Runtime foundation 回归通过。
- `816d584` 将原 v2 schema 明确限定为 compatibility input，并新增严格 authoritative compiler output schema、正反例 fixture 与 `npm run verify:story-schema`。
- `verify:story-schema` 与 `verify:story-text` 均通过；本机首批 `1_4_001_01` a–j 被明确判定为 compatibility input，未误报为已发布 authoritative v2。

后续 `85983ee` 已补 strict candidate compiler stage：首个 `1_4_001_01` a–j 共 432 steps 均能从 compatibility input 生成 strict v2，并通过 schema、Runtime 和文本投影等价性 gate。CLI 强制把 dry-run 输出写在工作区之外；`1_4_001_01_a` 的 42-step 文件已在系统临时目录实际生成。

该阶段（实播前）仍缺 candidate 文件的浏览器固定锚点与正式发布验收，Python `ScenarioCompiler` 也尚未原生输出 strict v2。因此正式 corpus 的 authoritative output 状态仍为未完成。详细证据见 `STORY_AUTHORITATIVE_V2_SCHEMA_20260723.md`。

后续使用未跟踪临时 fixture 对 strict a/d candidate 完成单标签 5174 验收：A step 38 的 Camera 与两条 SE 均按 authored timestamp 启动；D fade 链后 Prev 恢复原对白，截图无残留黑幕；应用级 error 为 0。一次压缩加载出现 neck target unavailable warning，故 neck/Spine 仍需正式加载复核。临时 fixture 已删除，浏览器恢复正式 d 地址且仍只有一个标签页。

当前剩余项收敛为 atomic publish/backup、source-only checkout、正式 neck/Spine 加载与长时间 release acceptance；正式 corpus 仍未切换 strict v2。

后续 `2702773` / `1fb426e` 已完成 atomic publish/backup 和 source-only checkout 门禁。真实 mounted `1_4_001_01` dry-run 生成 11 份 strict candidate manifest（aggregate + a–j），全部 schema 与 Runtime/文本投影等价；发布器验证 current/candidate hash、显式 group 确认、compiled 外完整备份、原子替换、最终 hash 与失败回滚。detached source-only checkout 的全部相关 verifier 和 2400-module production build 通过。

本轮仍未正式发布 strict corpus。剩余发布阻塞为正式 neck/Spine 资源加载复核，以及 Edge autoplay、跨 episode、后台恢复、真实 BGM/Ambient、持续内存等长时间 release acceptance。

后续 `e7a78d0` 又补齐 Python `ScenarioCompiler` 原生 authoritative contract 和 `story:authoritative-native` raw-group CLI。tracked fixture 与 mounted a–j 432 unique steps 均与 JavaScript 独立投影逐字段一致；真实 raw a–j dry-run 生成 11 文件并完成 139/139 voice relink。detached source-only checkout 的 schema parity、migration、text 和 production build 通过。本项不改变“strict corpus 尚未正式发布”的结论。

同日使用正式 mounted `1_4_001_01_d` 完成 neck/Spine 单标签复核：`007kei_002_00`、`047shu_001_00` 均报告完整 neck animation table；step 6 neck 姿态可见，debug 数据为 `spine yes` 且 root 未垂直下坠；step 12 黑幕至 step 14/完成态正确清除并恢复户外背景。日志中 `spine cue target unavailable` 为 0、应用 error 为 0。浏览器最终恢复完整 d URL，标签数为 1。

因此正式 neck/Spine 加载阻塞已解除；剩余 release 阻塞为 Edge autoplay、跨 episode 长时间连续播放、后台恢复、真实 BGM/Ambient 长时淡化恢复和持续内存增长观察。

后续 `7747d23` 修复 BGM/Ambient 异步加载竞态：新 cue 已取得 ownership 后，旧请求即使更晚成功或失败也不能启动旧 source 或清空新状态；stop/dispose 会使 pending load 失效。`verify:story-audio` 增加 100 轮 crossfade、capture/restore、visibility/overlay pause、source 上限和 timer 收敛 soak，source-only checkout 与 production build 通过。

5174 单标签又完成一次真实 d→e episode 切换：旧 viewer unmount，新 URL 为 `episodes/1_4_001_01_e.json`，正文正常、应用 error 为 0，随后恢复完整 d URL 且仍为一个标签。浏览器 heap/audio global 因隔离边界无法取得可信样本，故剩余项进一步收敛为 Edge autoplay、真实 document-hidden 听感、长时间混合操作与浏览器 heap/Spine 曲线；不以 Node soak 替代这些真实环境项目。

`5d62b48` 通过 `runtimeDebug=1` 将页面主世界 audio/source、Runtime、Spine 与 Chromium heap 诊断投影到 DOM，解决浏览器隔离层无法读取页面 global 的观测缺口。单标签完成 AUTO→Choice、Choice、菜单/Backlog 暂停、Backlog 定点恢复、SKIP all→两个 Choice 的混合链路，并修复“SKIP 到无 voice Choice 后上一句 voice source 残留”。修复后 Choice 只保留 BGM/Ambient 两个 loop。

6 轮真实 `2 Spine → 0 Spine` 页面切换中，实例数严格 `2→0`，source 数 `2→0`，used heap 在约 102–198 MB 间波动并于末两轮普通页回落至约 102/104 MB，没有短程单调增长；marker destroy 告警未复现。该结果将剩余项收敛为 Edge autoplay、操作系统级真实 document-hidden/听感和数小时 soak，不把 debug visibility override 或 6 轮曲线升级为这些项目的替代证据。

## 2026-07-22 首页 consumer 回归与修复

后续首页复核发现：`ArchiveImmersiveHome` 直接使用 `SpineStage`，不经过 StoryViewer 的 `useStoryRuntimeCues`。`baf44df` 删除全局 legacy background writer 后，首页虽然正确解析 `bg001_315pro_in_01`，但没有把背景写入以黑色清屏的 Pixi stage，因此呈现黑屏。

这说明“StoryViewer Background Runtime 唯一 owner”已经成立，但当时“所有直接复用 SpineStage 的 consumer 都有显式背景 owner”尚未成立。

后续已增加默认关闭、仅由首页显式启用的 `SpineStage.manageBackground` standalone contract；没有恢复 `applyStepSceneState` 的背景写入。桌面、冬马→翔太切换及 `390×844` 移动端均恢复 `bg001_315pro_in_01`，DOM owner 为 `standalone`、应用级 console error 为 0、移动端无横向溢出。资料馆首页本项更新为 PASS；详细证据见 `ARCHIVE_HOME_BACKGROUND_OWNER_20260722.md`。

## 2026-07-23 首个 authoritative collection 正式发布

前文“尚未正式发布”均是对应阶段的历史结论，当前状态由本节覆盖。`1_4_001_01` aggregate 与 a–j 十个 episode 已使用 `python-native-v1` candidate 和 atomic publisher 正式切换为 `runtime_contract: story-runtime-v2`：

- 发布 11 files / 10 episodes / 432 unique steps / 139 unique voice refs；manifest 双表示计数为 864 steps / 278 voice refs；
- aggregate old/new hash 为 `sha256:db5d33453a9a999b35455e0fa5ee9cfa242869f7d15c91e91db4d5c572379495` → `sha256:e3a4000b6af1d69ef7294320d89cb9cd725283e537b2e4f282c3199d7a7b1b06`；
- 旧产物完整备份及 manifest 位于 `C:\Users\windm\AppData\Local\Temp\sidem-authoritative-formal-backup-4315bc2cf6454457a490aade7c9d36b2`；
- 发布后由 `8b31268` 修复 strict episode boundary、Choice `target_step_id`、`entry_snapshot.bg`、presentation 文本读取与验证器 legacy 字段假设；
- schema/publisher、Runtime、text/localization、episode/voice、playback range、presentation、首页、100 轮 audio soak 与 2400-module production build 全部 PASS。

本轮因外部 Edge 音频请求触发 IDM 自动嗅探，已停止该验证路径，并确认无 Codex 临时 Edge 进程残留。没有把纯脚本通过写成浏览器音频通过；仍未完成的 release stability 是 Edge autoplay、操作系统级真实 document-hidden/听感与数小时 heap/Spine soak。下一 collection 仍须独立执行 dry-run、parity、备份与小批发布，禁止直接覆盖全库。

## 2026-07-23 Authoritative Runtime shape 收口

`a065c22` 将 strict snapshot 顶层和 10 类 compiler cue action/channel/payload 写入 authoritative schema，并新增 mounted 全库 verifier。10,326 scenarios（含 tracked fixture）、315,124 snapshots、175,600 cues、1214 snapshot shapes、37 action/payload shapes 全部通过；未知 action、channel 错配、payload 缺失/多余字段、snapshot 顶层未知字段及空 `neck.play` 均有反例，1618 条空 `neck.stop` 按原语义显式保留。

`verify:story-schema`、`verify:story-text`、authoritative publisher、compiled migration、Runtime foundation 与 2400-module production build 通过。该项不替代 Edge/后台/数小时浏览器稳定性验收。

后续 `c6d57dd` 又关闭 background profile/effect/transition、camera、screen effect/overlay/slide、environmental、image icon、Spine/fade 等 snapshot 嵌套对象的未知字段。递归门禁覆盖 488 种 nested snapshot shape，并新增 source-only 正例以及 background profile、Spine、overlay、screen effect 未知字段反例；mounted 10,326 scenarios / 315,124 snapshots / 175,600 cues 仍全部 PASS。Runtime snapshot/cue shape 至此收口，剩余 schema 债转为 `dialogue.lip`、`resource_manifest`、`diagnostics` 和 evidence `raw_values` 等外围数据结构。

`498ac8b` 随后验证 mounted 48,073 个 lip 对象全部为唯一 `source/path/frames` shape，增加安全相对路径、正整数 frames 与 unknown-field contract；路径穿越、0 帧和 legacy 字段均有反例。Authoritative compiler 不输出的 `diagnostics` 从 strict schema 删除。`verify:story-schema/text`、publisher、migration 与 Runtime foundation 通过；此前同轮 2400-module build 已通过且该提交不修改应用源码。无 mounted 样本但 compiler 显式保留的 `resource_manifest/raw_values` 继续作为有证据边界的未完成项。

## 2026-07-23 IDM 安全隔离与无音频 soak 前置

由于外部 Edge 音频请求触发 IDM 自动嗅探，本轮不再启动外部浏览器，也不再以有声音频请求做自动化。StoryViewer 新增 `noAudio=1` 调试入口：它自动包含 `noVoice=1`，并在 AudioContext 创建及 Voice/Lip、BGM、Ambient、Runtime SE 的网络请求之前统一短路；`runtimeDebug=1` 可在 DOM 诊断中确认 session/manager 均为 disabled。自动音频 verifier 已断言禁用模式的 AudioContext factory 与 `fetch` 调用次数均为 0。

该入口只用于在单个应用内标签页中安全推进黑屏、heap 与 Spine 长测，不能替代 Edge autoplay、操作系统级 document-hidden 听感或真实 BGM/Ambient 验收。若进行页面测试，固定使用一个应用内浏览器标签页并保留 `noAudio=1`；本轮代码与脚本验证期间没有打开浏览器。

## 2026-07-23 Strict snapshot 实播消费修复

随后使用唯一应用内标签和 `noAudio=1&runtimeDebug=1` 对正式 mounted `1_4_001_01_d` 做发布后实播，发现背景能由 Runtime snapshot 正常绘制，但 `SpineStage` 与持久 BGM/Ambient watcher 仍只读取 compatibility `state`。Strict step 只有 `entry_snapshot`，因此 step 6 诊断为 0 Spine，画面缺少圭与翔太，并出现 `spine cue target unavailable`；这证明此前 schema/publisher verifier 没有覆盖舞台 consumer 的实际渲染投影。

本轮增加统一 `StepSceneState` 投影：authoritative consumer 优先读取 `entry_snapshot`，compatibility 才回退 `state`；StoryViewer、SpineStage、首屏 preload、dialogue visibility 与 BGM/Ambient 复用同一规则。另修复首页离开时 pending Spine load 在 manager destroy 后继续落地导致读取空 `app.screen` 的竞态，并删除 spawn 路径重复创建的 debug marker。

同一标签重载后，背景正常，`047shu` 与 `007kei` 两个 Spine 均可见；step 6 → 7 的一次 Next 后实例数保持 2。诊断始终为 AudioContext `uninitialized`、active source 0、audio session/manager disabled；重载后的日志不再出现 destroyed manager warning 或 neck target unavailable。仅剩 Pixi 7 依赖自身 `rgb2hex/hex2rgb` 弃用提示。Runtime foundation、Spine fade、首页、playback range、100 轮 audio verifier 与 2401-module production build 通过。

该结果关闭首个 strict collection 的“snapshot 已发布但角色/持久场景音频仍读 legacy state”缺口；无音频实播仍不替代 Edge autoplay、真实后台听感与数小时有声 soak。
