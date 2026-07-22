# Background Transition Runtime 唯一 Owner 验收

> 状态更新：StoryViewer 内的迁移与旧 rollback 分支清理已完成；URL flag 说明仅作为迁移历史保留。首页 `ArchiveImmersiveHome` 是不经过 Story Runtime 的独立 `SpineStage` consumer，现已通过 opt-in `manageBackground` contract 获得 standalone background owner；没有恢复本文已删除的全局 legacy writer。

日期：2026-07-22

## 结论

带 `bg_transition` 的背景切换已默认由 Runtime Scheduler/PerformanceHandle 唯一驱动；entry snapshot 以 0 时长恢复进入该步之前的背景。`applyStepSceneState` 默认不再调用 legacy `setBackground(bg, transition)`。

明确回滚入口为 `runtimeBackground=0`，并且它优先于 `runtimeCues=1`。legacy background 分支计划在 camera 与 SE channel 也完成默认验收后，随 compatibility owner 一并删除。

## 生命周期

- start：Runtime 把 manager 返回的 transition Promise 交给 PerformanceHandle，贴图加载或 tween 未结束时继续阻塞 Auto；
- settle：已有 manager transition 时直接落到终态；若贴图仍在异步加载、transition record 尚未建立，则先取消该 pending 请求，再以 0 时长加载目标背景；
- cancel：manager 恢复旧 sprite，随后导航 entry snapshot 安装目标步骤的稳定背景；
- restore：只安装 snapshot `bg`，不重放旧 transition；
- resize：沿用 `BackgroundManager.handleResize()` 的 cover 布局，桌面与 390×844 均覆盖完整 stage。

## 验收矩阵

| 路径 | background transition owner | 结果 |
| --- | --- | --- |
| default | Runtime | PASS |
| `runtimeBackground=1` | Runtime | PASS（与 default 同义） |
| `runtimeCues=1` | Runtime | PASS |
| `runtimeBackground=0` | legacy scene watcher | PASS |
| `runtimeCues=1&runtimeBackground=0` | legacy scene watcher | PASS（回滚优先） |

自动验证覆盖 owner 选择、entry restore、start Promise、settle、贴图未就绪 fallback 和 cancel。单标签浏览器在 `1_4_001_01_a` 第 4 步验证了 1.5 秒 dissolve、0.6 秒提前 settle、返回取消、390×844 resize 与 legacy 回滚；应用错误为 0，标签数始终为 1。

## 实测发现并修复的竞态

第一次移动端提前 settle 时，画面错误保留在 entry 天空。原因是 `BackgroundManager.setBackground()` 在贴图 Promise 完成前已写入 `currentBgId`，第二次 0 时长请求被“同背景”短路。Runtime fallback 现会先 `clearBackground()` 使 pending token 失效，再安装目标背景；复验后正确显示 `bg030_315prodoor_in_10`，并在下一步保持该终态。

## 本批未迁移

camera、SE、snapshot timer 与其他旧 scene/timeline 分支继续作为后续独立提交；screen/fade 已在前一提交完成，不在本提交改动。
