# Center 台词：固定嘴型目标修正

2026-10-23，输入 HEAD `dedcafe1`，分支 `stage/20261022-particle-gaps`，主 checkout。用户询问额外 Center 台词是否接上嘴型；先前仅检查独立 Audio 槽后回答“还没单独挂上”，遗漏已接入的 RAW 固定嘴型，结论需要纠正。

## 原生链路与根因

- `Unit_serif.PlayEffect` RVA `0x19c6b28` 按 deck 编成槽取卡并拼 cue，调用 `SoundManager.PlayVoice`。重新只读反编译三个 overload `0x1d9e9b8 / 0x1d9e9e8 / 0x1d9ea38`，随后经 `PrepareAtomSource 0x1d9cbbc`、`ExtendedAtomSource.Play 0x1b40cd8` 启动 CRI 并登记 playback。这些已查看函数未直接写舞台角色嘴型，不能把任意语音音量拟合作为原生证据。
- 台词的确定嘴型来源是 `Livechara_mouth_shape_fix`。FLASH LIGHT 35.55s 触发音频，35.75s/36.5s/37.15s 的 Fix 与 37.65s 的 Erase 控制开合；precious love 60s 触发音频，60.4s/61.2s/61.45s/61.75s 的 Fix 与 61.9s 的 Erase 控制开合。两首均 target1。
- `IdolLiveEffectTypeExecuter.GetTargetIdols 0x2342c18` 的正数目标交给 `GetTargetIdol 0x2342be4`，再由 `LiveStage.GetTargetIdolObj 0x1f29b84` 对原生 `idols` 列表取 `[value1-1]`。不是网页画面站位编号。
- 同一列表的 `LiveStage.SwitchSingers 0x1f29a68` 按演唱索引写角色 `+0x88`（lipSyncEnabled）；`UpdateCurrentTime 0x1f2a03c` 经回调 `0x1cb0740` 写 `+0x8c`（mouthScale）。`LiveObjectIdol.UpdateLip 0x221c630` 则先判断 `+0xac` 固定嘴型，再判断歌曲嘴型；固定嘴型可以在演唱列表为空时生效。

10-15 记录曾把原生列表编号称作场景站位，Viewer 将 RAW target1 直接用于画面1。这与现有动作/演唱/Center 音轨采用的 performerSlot→stagePosition 映射不一致。FLASH LIGHT 的原生槽1位于画面3，修正前中心角色做着台词动作，嘴型却覆盖左侧画面1。

## 修正和验证

`applyCurrentLipSync` 先调用现存 `sourceSlotForStagePosition(position)`，再采样原生 MouthFix。诊断仍输出画面站位，RAW target、开度、OutQuad、结束释放和 Spine 优先级不变。target0 仍覆盖原生1…5中实际出演者。任选49人音轨只换试听声音，未凭该选项重写原编排的目标。

重新从 RAW 导出 118 编排 / 29 条嘴型至 E 盘 `.analysis/center-lip-recheck-20261023/mouth-fix.json`，与当前 published JSON 深比较一致（LF 输出 SHA256 `93c170fc7c763f9602d7fb452bf174cfc26e2d411f2f3549c13e84b2b5ff768c`）。原生只读反编译输出在同目录，保留未成功取得额外 metadata 注释的边界，不声称重新完整分析二进制。

回归执行真实 SFC 消费者及已安装 Spine hook：两首台词在未演唱时对画面3应用开度，画面1不再收到该 override；闭嘴、Erase 完成、倒拖恢复均验证。published-assets 模式对四份有 MouthFix 的真实编排，以当前 `stagePositionMap` 遍历全部29条命令的起点、中点、终点，核对消费者目标。旧实现会在两首 Center 用例失败。

`verify-chibi-mouth-fix.mjs --published-assets`、`verify:song-oneshot-voices`（2曲/98音轨）、body-colors 和粒子生命周期回归通过。`build:check` 17.56s，通过；固定 E 盘代码输出，不复制 public。整批源码门禁与 Browser 最终结果见下方验收补记。

本批不增加台词 lip-sync 曲线，不改变音轨或原生指令时序，不宣称不同偶像任选台词均与同一套原编排嘴型逐字吻合，也未验证原片逐帧/实体设备。

## 最终验收

- `npm run verify:source-batch`：167/167；构建生成的资源和翻译审计元数据恢复到输入 HEAD，未纳入提交。
- Browser 5213/PID25568、候选 `rm-release-20261015`，使用沿用的手动四人编队；不作为原曲成员验收。桌面1280×720、移动390×844（clientWidth/scrollWidth均390）。
- FLASH LIGHT 修正前36s是画面1开度0.7025，修正后冷重载36s为画面3开度0.7025，当前演唱者列表为空；36.7s闭嘴0.15，37.8s释放，倒拖36s恢复。任选冬马台词音轨后，原编排嘴型仍在画面3。
- precious love 60.7s为画面3开度0.66，移动端同值；62s已释放。关闭嘴型时窗和切歌清退另由消费者回归覆盖。没有把静态seek采样写成音频实播验收。
- 小图 `center-lip-flash-fixed-36000.png`、`center-lip-precious-fixed-60700.png`、`center-lip-precious-fixed-mobile.png` 保存于本任务 visualizations 目录。首次移动截图因视口切换未稳定而失真，未采用；后续独立截图已确认完整390×844页面。
- 所查 console error 为0；保留了初始加载与HMR时 Pixi Spine tint/update 的4条 warning堆栈，未把本次会话描述为无 warning。
