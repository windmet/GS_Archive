# Story Runtime 真实音频阶段验收（2026-07-29）

## 结论先行

当前状态是 **partial acceptance / 仍不具备 release-accepted 条件**。

已完成：

- 用户已明确确认 IDM 从电脑删除，真实媒体请求前置条件解除。
- Codex 应用内 Chromium 环境完成首次手势后的 WebAudio `running` 验证。
- Voice、SE、BGM、Ambient 均有真实资源解码和 source 注册证据。
- `1_4_001_01_d -> e` 跨 episode 后，旧 episode 的持久音源退出，新 episode 仅保留预期 BGM/Ambient。
- Menu overlay 能暂停 AudioContext，关闭后恢复。
- debug visibility override 能暂停并恢复 AudioContext。
- 发现并修复跨场景淡出时的浏览器定时器 receiver 错误；修复后 `event_before / ambi_shop_shoutengai` 正确切换为 `usual_day / ambi_room`。

仍未完成：

- Microsoft Edge 专属首次手势/autoplay 验收。
- 人工听感（音量、爆音、淡入淡出听感、声画同步）。
- 真实操作系统或真实标签页 `document.hidden === true` 的后台/恢复。
- 2–4 小时 Next / Auto / Skip / Backlog / Choice / episode 混合长稳。

因此不能把本记录写成完整真实音频 release acceptance。

## 环境与 Git

- 仓库：`windmet/GS_Archive`
- 分支：`codex/post-merge-story-handoff`
- 修复提交：`421c3b0 fix: reconcile story audio across scene transitions`
- 服务：`http://127.0.0.1:5174/`
- 浏览器：Codex 应用内 Chromium；**未证明是 Microsoft Edge**
- IDM：用户在 2026-07-28 明确确认已从电脑删除
- 音频模式：真实 WebAudio，URL 未使用 `noAudio=1`

## 无音频基线

证据：

`C:\Users\windm\.codex\evidence\sidem-story-runtime\2026-07-29\story-release-soak-noaudio-1_4_001_01_d-e-20260729.json`

- 时长：240.828 秒
- 样本：11
- 操作：Next、Auto、Skip、Choice、Menu/Backlog、noAudio voice replay、d -> e、debug visibility、quiet endpoint
- heap：124,513,456 -> 107,150,983 bytes，净变化 -17,362,473
- quiet endpoint：active sources / audio timers / runtime cues / overlays / silhouette pending / relayout 均为 0
- stage children 稳定为 7

边界：这是约 4 分钟 `noAudio` 基线，不是有声验收，也不是 2–4 小时长稳。

## 真实音频矩阵

| Case | 观察 | 状态 |
| --- | --- | --- |
| first gesture | 首次 `次へ` 后 AudioContext 从 suspended 进入 running | PASS（Chromium runtime） |
| Voice | `1_4_001_01_d1000.m4a`、`1_4_001_01_e1010.m4a` 注册为 dialogue source，并自然释放 | PASS（runtime） |
| SE | `step_walk_come_conc_boot`、`step_walk_come_lino_boot`、`door_ent_kishimi_squeak` 注册并自然释放 | PASS（runtime） |
| BGM + Ambient | `counsel_wonder` + `ambi_jinja_nature_birds` 以及 `usual_day` + `ambi_room` 持续运行 | PASS（runtime） |
| cross episode | d 的持久音源退出；e 仅保留 `event_before` + `ambi_shop_shoutengai` | PASS（runtime） |
| overlay pause/resume | Menu 打开时 pause reason=`overlay`、Context suspended；关闭后 running | PASS |
| visibility code path | debug override hidden/visible 时 suspended/running | PASS（仅代码路径） |
| actual hidden/resume | 未能让 `document.hidden` 真实变为 true | NOT EXECUTED |
| Edge autoplay | 当前受控环境不是已确认的 Edge | NOT EXECUTED |
| human listening | 自动化只能观察 WebAudio/runtime 状态 | NOT EXECUTED |
| 2–4h mixed soak | 尚未执行 | NOT EXECUTED |

## 缺陷、根因与修复

### 复现

在 e 段快速推进至 step 30/32 后，authoritative `entry_snapshot` 期望：

- BGM：`usual_day`
- Ambient：`ambi_room`，volume `0`

但实际持久 source 仍是：

- BGM：`event_before`
- Ambient：`ambi_shop_shoutengai`

### 根因

首次从旧持久音源切换到新音源时，`AudioManager` 需要安排旧 source 的淡出清理。构造函数把浏览器原生 `setTimeout` 保存为实例字段，随后以 `this._setTimer(...)` 调用。在当前 Chromium 环境中，这给原生 timer 传入了 `AudioManager` receiver，浏览器抛出：

`TypeError: Illegal invocation`

Ambient 路径先抛错，导致 watcher 中断；BGM 切换也无法完成。直接从新场景打开不会触发旧 source 淡出，所以此前直达 step 24 可以正常工作。

### 修复

- `AudioManager` 用箭头 wrapper 以 plain-function 语义调用注入的 `setTimer` / `clearTimer`。
- persistent BGM/Ambient watcher每步读取 `audioManager.inspect()`，以实际 manager cue/source 对账，不再只依赖 hook 内局部缓存。
- 自动测试加入 browser-like timer receiver、stale observed cue 和 orphan source 回归。

## 修复后短时记录

证据摘要：

`C:\Users\windm\.codex\evidence\sidem-story-runtime\2026-07-29\story-release-soak-realaudio-e-transition-pass-20260729.summary.json`

- route：e，`start_step=20&end_step=30`
- 时长：44.968 秒
- 样本：3
- 操作：首次手势、自动推进、BGM/Ambient 跨场景切换、Voice/SE、Menu pause/resume、debug visibility pause/resume
- stop sample：Context `running`
- 持久 sources：2，恰为 `usual_day` + `ambi_room`
- cleanup timers：0
- active runtime cues：0
- active overlays：0
- stage children：7
- heap：119,457,628 -> 107,479,695 bytes，净变化 -11,977,933
- 修复后的验收时间线未新增 `Illegal invocation`

另有失败观察文件：

`C:\Users\windm\.codex\evidence\sidem-story-runtime\2026-07-29\story-release-soak-realaudio-e-ambient-transition-20260729.json`

该文件保留为缺陷发现证据，不能计为 PASS。

## 自动门禁

在 `421c3b0` 前执行并通过：

- `npm run verify:story-audio`
- `node scripts/verify-story-runtime-foundation.mjs`
- `git diff --check`
- `npm run build`

production build：2404 modules，3m06s。

## 下一步

1. 用已确认的 Microsoft Edge 执行 first gesture / autoplay 和人工听感。
2. 通过真实窗口最小化、切换应用或真实标签页切换，让 `document.hidden` 确实进入 true，再验证恢复。
3. 执行 2–4 小时混合曲线并导出完整 `story-release-soak-v1`。
4. 只有以上项目完成后，才评估 Story Runtime 是否 release-accepted。
