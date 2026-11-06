# 故事播放器交接（2026-11-06）

## 现状

分支 `portal/20261105-player-continuous`（基于 origin/master a7b97598），本地提交 4d5093e8，**未推送、无 PR**。
LF worktree 在 `C:/Users/windm/AppData/Local/Temp/claude/E--Web-build-SideM-Archived/d65e3718-8722-49bc-b776-f23f180d07ba/scratchpad/wtm`（node_modules 是指向主检出的 junction）；临时目录可能被清，丢了就从分支重建 worktree。

4d5093e8 已完成并经 CDP 真点击验收：

1. **跨话 AUTO 挂不上**：新 viewer 实例的 `audio-lock` 暂停原来只在播放器内 pointerdown 才解除。现在挂载时 `releaseAudioLockWhenRunning()` 在已有用户激活时主动 resume AudioContext，running 后解锁；1.5 s 仍未 running 才出「轻触继续自动播放」。验收：一次点击后 a→f 六段连续自动。
2. **章节连播**：`continuousPlayback && nextTarget.kind==='chapter'` 时结束栏倒计时后自动进下一话（从故事合集页「连播演出」进入才有 nextChapter；从阅读器进入没有，显示「当前观看范围已结束」——既有行为）。
3. **结束栏不再顶起对话**：结束栏占 dock 的位置与高度（dock 在栏开时隐藏），删掉了 `completion-open` 抬高 `--player-content-bottom` 的规则。

## 已定待办（用户 11-06 同意）

### A. 本分支收尾（先做）
- `StoryViewer.vue` 里 `CHAPTER_COUNTDOWN_MS = 5000` → **1500**，保留「取消」按钮（对齐原生结束淡出约 1.5 s，取消是 Web 端额外保留）。
- 倒计时 1.5 s 下 `Math.ceil` 显示的数字只有 2/1，考虑去掉数字只留环，或保留——看截图定。
- 重跑验收：`web_viewer/.analysis/story-player-20261106/cdp-player-auto.mjs`（主检出，已从临时目录备份）（`ENTRY_URL=/?view=story_collection&story_type=main&story_section=101 PLAY_TEXT=连播演出 CHAPTER=1_4_001_00`，沙盒外跑 headless-shell）。
- 可选：对 master 做变异对比（还原修复后 AUTO 跨段应停住），证明验收不是空的。
- `npm run gate:source`（LF worktree）→ 推送 → 开 PR，正文写清三项 + 原生对照。

### B. 新分支：原生交互对齐（单独 PR）
- **点按=停住、再点=下一句**：原生在文本 cut 上第一次点击补完打字并置 `isAutoStop`（文本框显示停止图标），第二次点击清除、跳过语音/演出并前进，自动继续。
- **速度 ×1.0 / ×1.5 / ×2.0**：一个按钮循环；>1.0 时语音强制关、文本强制显示；所有动画与脚本等待按倍速。
- 原生没有 AUTO 开关（永远自动，语音+动画结束即进，无额外行间延迟）。Web 端保留 AUTO 开关，但 AUTO 开时的节奏应向这个靠拢——动手前先确认现有 auto_delay_ms 的默认值。

### C. 最后、新分支：作品页（工作页面）加载慢——只做根本修复
- 根因：`StoryLineText` 每行拉整份阅读文档；`functions/data/[[path]].js` 把 `1_5_*` 302 到 `/_work-backfill/...`（无缓存头、丢 `?rev`、目标 `max-age=0`）；每个偶像 13 份文档、TTFB 0.75–3.5 s；文字 pending 时 `visibility:hidden`，F5 后又从头来。
- 方案：把每行译文标题/首句直接构建进作品读模型，列表不再拉阅读文档；收掉 302，作品文档走与其它阅读文档相同的不可变缓存路径。**不打短期补丁**。

## 原生播放器逆向结论（Ghidra）

详见记忆 `sidem_native_story_player_logic.md`。要点：WaitAnimationEnd 逐帧等语音/打字/各演出/`nextCutWaitTime`（按 deltaTime×speed 递减）全部结束即 Next；连播 = AdventureSectionData+0x90 的剧集 ID 队列，开关在 +0x82；结束：0.5 s → StoryEndFade → 1 s → StoryFinishAPI 出队并上报 → JumpView，队列非空且（开关开或作品故事 7/8）且下一话未锁、活动未关 → 直接重载 StoryView，无弹窗无倒计时；否则回列表弹「とじる / 次のエピソード」。章节级「連続再生」弹窗按钮为 取消 / voice_dl_btn_1 / voice_dl_btn_2（推测为有语音/无语音，文本表未找到）。

工具：Ghidra 项目 `E:/Tools/ghidra_work/sidem`，`targetsN.tsv` + `runN.cmd`；RVA 取自 `web_viewer/.analysis/sidem_runtime_dump/il2cppdumper_out/dump.cs`；`DAT_` 字面量用 `web_viewer/.analysis/story-player-20261106/annotate_dat.py`（同目录有带注释的反编译输出）（读 ELF 里的 8 字节指针槽再查 stringliteral/script.json；Windows 控制台显示日文会乱码，读输出文件即可）。
