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

## 2026-07-22 首页 consumer 回归与修复

后续首页复核发现：`ArchiveImmersiveHome` 直接使用 `SpineStage`，不经过 StoryViewer 的 `useStoryRuntimeCues`。`baf44df` 删除全局 legacy background writer 后，首页虽然正确解析 `bg001_315pro_in_01`，但没有把背景写入以黑色清屏的 Pixi stage，因此呈现黑屏。

这说明“StoryViewer Background Runtime 唯一 owner”已经成立，但当时“所有直接复用 SpineStage 的 consumer 都有显式背景 owner”尚未成立。

后续已增加默认关闭、仅由首页显式启用的 `SpineStage.manageBackground` standalone contract；没有恢复 `applyStepSceneState` 的背景写入。桌面、冬马→翔太切换及 `390×844` 移动端均恢复 `bg001_315pro_in_01`，DOM owner 为 `standalone`、应用级 console error 为 0、移动端无横向溢出。资料馆首页本项更新为 PASS；详细证据见 `ARCHIVE_HOME_BACKGROUND_OWNER_20260722.md`。
