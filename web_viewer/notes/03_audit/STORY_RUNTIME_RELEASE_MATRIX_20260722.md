# Story Viewer 运行时发布验收记录（2026-07-22）

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
