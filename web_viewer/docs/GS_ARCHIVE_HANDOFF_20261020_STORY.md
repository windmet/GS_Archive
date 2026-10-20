# 交接：剧情 / ADV 线（2026-10-20 晚）

新窗口从这里继续剧情重编译与 ADV 播放器这条线。舞台线（`stage/20261020-native-followup`）由另一个会话负责，本页不涉及。

## 现在的位置

| 项 | 值 |
|---|---|
| master | `dd1035dc`（已合入 #56 视觉收敛、#57 ADV/摄影工坊原生姿势、#58 CRI 总线） |
| 本线分支 | `portal/20261020-story-recompile`，PR #59，头 `cffb7943`，已推送，Source-only contract 通过 |
| 与 master | ahead 5 / behind 5。behind 的 5 个是 #56–#58 的合并提交；#58 的内容已经在本分支里（`eaefc085`），合 master 预计无冲突 |
| worktree | `E:/Web_build/GS_Archive_Domain_Work/story-recompile-wt-20261020`（`web_viewer/node_modules` 是目录联接，删 worktree 前先解联接） |
| 候选语料 | `E:/Web_build/GS_Archive_Domain_Work/story-recompile-20261020/full3`（`candidates/`、`ledger.json`、`diff-report.json`、`full3.report.log`）。full / full2 / waitprobe* / spot* 都是旧产物 |
| 细节 | [STORY_RECOMPILE_CANDIDATE_20261020.md](STORY_RECOMPILE_CANDIDATE_20261020.md)（工具、risky 逐项结论、裸 wait 规则）；音频总线见 [NATIVE_AUDIO_BUS_ROUTING.md](NATIVE_AUDIO_BUS_ROUTING.md) |

PR #59 里有三样东西：重编译候选工具与报告、编译器的裸 wait（`post_wait` / `pre_wait`）、播放器的停顿。**没有改 public 下的 compiled**。

## 关键事实（别重新推导）

- 客户端每个 `wait` 都结束一个 cut；只含 wait 的 cut 让画面原样停 N 秒，点击或 skip 清零（`native_cuts.py` 记了 RVA）。RAW 有 48,268 个，约 42,000 s，旧编译器全部丢弃。
- 编译器不加 step：记成上一步 `post_wait`，或跳转标签后 / part 开头的下一步 `pre_wait`。step_id、text_ref、reading_control_flow 不受影响。
- 播放器停 `post_wait(当前) + pre_wait(目标)`；点击跳过、skip 不停、自动模式等待、菜单/回看/暂停不倒数；选择肢按所选分支目标停；转场 step 把停顿加进计时器。
- **已发布语料没有这两个字段**，所以 #59 的运行时代码合入后对线上读者没有变化，要等语料晋升才生效。这是「合工具」和「晋升语料」可以分两步的根据。
- full3 的 risky 17 项与 full2 相同，全部来自 master 里早已合入的编译器修复（10-13 / 10-15），不是 #59 引入的。所以那 13 个文件的 RAW 核对是**晋升的门槛**，不是合 #59 的门槛。
- 验证入口：`npm run verify:native-cut-wait`（编译器夹具 + 真 StoryViewer 处理函数，已变异检验）；编译器部分也在 `verify:scenario-package`。改了 `goNext` 结构要同步 `verify-title-transition.mjs` 和 `verify-story-interaction-matrix.mjs` 的沙箱上下文（它们从 StoryViewer 源码截取函数）。

## 对照 10-20 审计的判断

审计的总体方向（收束、不再大重构、先测量再优化、工具与语料分两步）同意。本线有三处修正：

1. **#59 可以先合，不用等 13 个文件核完。** 理由见上：risky 来自 master 已有的编译器，运行时停顿在晋升前不生效。#59 只需合 master、门禁绿。
2. **晋升前多一个阻塞项：Valentine 语音。** `5_01_041_23`–`5_01_049_23` 的 b 段线上在播放 `1_1_001_01` 的语音（102 处错接）。候选给的是正确的原生名，但本地没有这批音频，晋升后会从「放错的声音」变成「没有声音」。建议先从 RAW ACB 补抽这批语音再晋升；如果要先晋升、接受暂时静音，这得由用户决定。
3. **翻译线要排在晋升之后。** 候选新增了 1697 个文件的 `dialogue.text_ref`、624 个文件的 `options[].text_ref`；晋升后翻译审计、manifest、搜索本地化都要重新生成。在那之前开新翻译批次会对着旧绑定做。

审计的第 3 步（UX 盲测）用户已经做完。新窗口拿到盲测结果后，先把条目分到三条线：剧情播放器（本线）、门户视觉、舞台。剧情播放器相关的条目要在**候选语料**下复测，因为停顿会改变节奏；在线上语料下看到的「点了没反应」「自动太快」可能已经被 full3 改变。

## 下一步（按顺序）

1. **收口 #59**
   - 在 worktree 里 `git merge origin/master`（不 rebase，不 force push），跑 `verify:native-cut-wait`、`verify:scenario-package`、`verify:story-schema`、`verify:story-audio`、`verify:player-repair`、`verify:title-transition`、`verify:source-batch`、`build:check`。`build:check` 会改 `config/resource-audit.json` 和 `config/translation-audit/summary.json`，用 `git checkout` 还原，别提交。
   - 推送后等 Source Gate 绿，交给用户合并。
2. **分拣盲测结果**（见上一节）。本线只接剧情播放器条目；要动 StoryViewer 的，先守住两条约定：阅读范围只走 ReaderViewport，译文时机只走 withStoryText。
3. **晋升前核对**（新开 `portal/<日期>-story-promotion`，从 master 开）
   - 13 个文件逐例对 RAW：`spines[].fade` 移除 9 个（例 `1_2_017kir_02_1_2_017_02`、`1_2_027yuk_02_1_2_027_02`、`episodes/1_2_027_02_c`），`idol_color(_transition)` 2 个（`1_3_30010_01`、`episodes/1_3_30010_01_f`），`timeline` 2 个（`1_3_30017_01`、`episodes/1_3_30017_01_d`）。`diff-report.json` 每项只留 3 个例子，完整清单要用报告脚本对 full3 重新列出。
   - Valentine b 段语音补抽（或用户决定接受静音）。
   - 抽几篇典型剧情在本地播放器里用候选语料实听：adv 连续台词（`1_1_012_03`）、通信 talk 带分支（`001tom_301_2_3_001_01_09_a`）、电话、季节企划聚合文件。
4. **晋升**（发布事务，`publication/releases` 按 supersede 记账）
   - 重跑后处理：`derive-chat-threads.py`（`presentation_context`）、phone forks、reading_control_flow。
   - 重新生成翻译审计、manifest、搜索本地化。
   - 先进 preview 集成部署，不碰正式站；正式站发布要用户明确授权。
5. **之后**再恢复翻译批次；再处理 SE 音量列（`SetSeVolume`，`playSE` 现在固定 0.6）。

## 不要做

- 不在 #59 里放语料；不在晋升 PR 里改编译器。
- 不改阅读文档字节（被审校回执钉住，只能用 `--documents` 定向生成）。
- 不直接 `vite build`；不 push master；不在共享暂存区提前 `git add`。

## 收尾清理（用户确认后）

- 已合入的 worktree：`adv-native-pose-20261020`（#57）、`native-audio-bus-wt-20261020`（#58）。都有 `node_modules` 联接，先解联接再 `git worktree remove`；远端分支可删。
- `story-recompile-20261020/` 下 full、full2、waitprobe、waitprobe2、spot、spot2 可删，留 full3 与 mounted-groups。
- `claude/player-voice-preload-20261013` 仍未合入（见 CURRENT_STATE），与本线的 StoryViewer 改动会冲突，重做时从 master 开新分支。
