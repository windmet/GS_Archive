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
