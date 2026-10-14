# 新悬灯颜色与节拍通道接线

输入：`stage/20261014-native-fidelity` / `c1ab908c`。已 fetch 并执行 `git merge origin/master`，结果 Already up to date。本批在独立工作区 `E:/Web_build/GS_Archive_Domain_Work/stage-native-fidelity-20261014/web_viewer` 开发，保留主 checkout 的 R2 分支及未跟踪文件。

## 行为变化与依据

原消费者把 coloranim / beat_show 作为 unresolved，随后整盏新悬灯的 alpha 变为 0。本批接入四种颜色模式及 BeatShow，保留旋转、缩放、显示和透明度各自的通道。颜色控制捕获当时的浮点 RGB，不在重放中反复量化；仅在 PIXI tint 输出时转换为 8 位。

依据主 checkout `.analysis/ghidra-il2cpp/decompiled_pass3_annotated/` 中 `Growing.Live.LiveObjectNewSuspensionLight.c` 及其 DisplayClass10/11/17 回调：

- `ColorAnim` RVA `0x221f55c`：1=同色相整圈循环；2=单次 HSV 渐变；3=各占半时长的往返循环，返回仍沿指定色相方向；4=当前色与非空 value3/6/7/8 组成的颜色列表。
- `UpdateColorIfContinuousChangeColorModeOn` RVA `0x221f490`：颜色列表只在 NormalShow / BeatShow 的整个周期结束时递增，包含熄灭等待；不是按帧或按颜色命令时长轮换。
- `BeatShow` RVA `0x221f298`，回调 `0x1bbfd34`：触发时捕获 `noteManager.curTempo`；半拍亮起、value3 拍保持、半拍熄灭、value4 拍等待。value2=0 时首次等待半拍加熄灭等待，否则立即启动。value3/4 的 Float getter 先除 1000。
- 读取 `E:/Tools/ghidra_work/sidem/libil2cpp.decrypted.so` ELF LOAD segment，确认 RVA `0x317a340` 的 float 为 60，故毫秒消费者使用 `60000/BPM`。DOVirtual.Float 和既有 DOTween 设置提供 OutQuad 依据；没有用线性曲线替代。

颜色列表按周期计数重建，支持跨很多周期 seek。换颜色模式只取消颜色通道；替换 show 保留颜色列表索引。重建同 ID、erase、后退 seek 与慢速资源加载沿用明确的生命周期归属。

## 本家族指令矩阵

全部来源都是现有 `stage-effects/new-suspension/*.json` 的有序 RAW values，保留 `sourceRow`、source hash、value101/102。没有修改共享 public sidecar，也没有重新执行 UnityPy 解码。以下条数包含 erase 行，不是独立灯具数。

| 原始命令后缀 | 行数 | 命名语义（value1 始终是 ID） | 导出与消费者 | 资源与验证 |
| --- | ---: | --- | --- | --- |
| create | 34,014 | 2 资源、3 alpha、4/5 XY scale、6 angle、7/8 XY、9 color、10 depth | `suspensionlight_events` → `newSuspensionlightsAt` 新 generation | 原 prefab 的 SimpleAdd Sprite、anchor、统一 native projection；既有 fixture / corpus |
| normal_show | 17,323 | 2 delay、3 rise、4 hold、5 fall、6 off wait，均毫秒 | 独立无限 show 通道 | 无限循环、首延迟、周期末换色、回跳 |
| rotateanim | 2,865 | 2 mode、3 angle、4 rise、5 hold、6 fall、7 wait、8 ease | 独立 rotation 通道 | 中断捕获、并存控制回归 |
| scaleanim | 164 | 2/3 XY scale、4 rise、5 hold、6 fall、7 wait、8 mode | 独立 scale 通道 | 并存控制回归 |
| fade | 3,311 | 2 alpha、3 rise、4 hold、5 fall、6 wait、7 mode | 独立 opacity 通道；一次 fade 完成冻结 show | erase/reuse、延迟 show、暂停重绘 |
| coloranim | 2,350 | 2 mode、3 target、4 duration、5 hue direction、6/7/8 palette | 新增 HSV / palette 通道；模式计数 1491/689/47/123 | 双方向、往返、打断、周期回调、真实语料 |
| beat_show | 331 | 2 start switch、3 hold beats、4 off beats | 新增捕获 BPM 的 show；缺 BPM 单独标记 pending | 半拍包络、延迟、BPM 捕获、Browser FLASH LIGHT |

19 份编排共 60,358 行；命令名均有消费者。331 条 BeatShow 涉及 cgtocc / flslgt / stofft / syksai / tnsdst / unmikn / wtstry 七首，当前难度 1 谱面全部恒定 BPM。Viewer 先 `validateSongChart` 再读恒定 BPM；变速谱面暂不推测 offset。纯状态接口可接受 `tempoAt(event.time)`，不等于 Viewer 已完成变速曲时基。

轨道与 BPM 请求独立完成。慢速或失败的谱面请求不会阻止普通显示／颜色通道加载；换歌、卸载和取消后不能写回旧结果。覆盖面板按实际加载的命令重新计数，不再复用旧 sidecar 的 `unimplementedCommands` 摘要；轨道未加载时明确显示加载中，缺 BPM 单独显示。

## 验收

- `node scripts/verify-chibi-suspensionlights.mjs --published-assets`：新旧包络、颜色四模式、周期列表、BPM、控制打断、erase/reuse、后退 seek、19 轨道命令与颜色有效性通过。
- `python scripts/verify-chibi-suspensionlight-parser.py`：RAW 顺序、未知命令及远端 erase 列通过。
- `node scripts/verify-stage-resource-ownership.mjs`：12 项实际 SFC 行为通过，新增慢 BPM、失败 BPM、换歌与卸载晚到响应隔离。
- `node scripts/verify-chibi-old-suspension.mjs --published-assets`、`python scripts/verify-chibi-old-suspension.py`、`node scripts/verify-chibi-stagelights.mjs`、`node scripts/verify-stage-vfx-coverage.mjs`、`node scripts/verify-verifier-coverage.mjs` 通过；两份改动 Python 导出源码 AST 通过。
- 最终代码 `npm run build:check` 通过（13.63 s）；日志 `.analysis/suspension-channels-build.log`，固定输出 `.analysis/build-check`，`copyPublicDir:false`。构建生成的无关审计／翻译清单已还原，不提交环境扫描差异。
- Browser 使用 Codex In-app Browser（cua_repl），5212 dev 服务，桌面 1440×900 / 窄屏 390×844。FLASH LIGHT：4 人就绪、跳转 42.8 s 可见 26 束新悬灯、关闭光束后为空、开启后恢复；实际播放时钟推进到 46 s，暂停后回跳同一时刻灯束 ID 一致。窄屏 document.scrollWidth=390，无横向溢出；实际截图已查看。维护模式面板显示 1005 条新悬灯、0 条未知指令，无缺 BPM。随后通过曲目搜索切换 Tone's Destiny，87.5 s 时 2 人就绪、13 束新悬灯可见，URL / data-song-id 均为 tnsdst；没有继承 FLASH LIGHT 的实例。

5212 从已核实 cwd 为主 checkout 的旧 PID 60960 切换到本工作区。新服务 PID 61564，保留 `SIDEM_READMODEL_CANDIDATE=E:/Web_build/GS_Archive_Domain_Work/rm-native-relations-20261013`。实际 bootstrap release 为 `1443ba17bda823fab56fdf04bea0aa527c4a0d0fe19486c202520e00c00636c5`；带 `/v/<release>/` 的 songs/index HTTP 200、application/json、1192 B，与候选磁盘逐字节相同。不是切换到 CURRENT_STATE 的较新 release；这是有意保留原 5212 的数据环境。

截图位于 `C:/Users/windm/.codex/visualizations/2026/10/14/01a13b34-f8ad-7920-8ee0-22c322a422ee/stage-flash-light-desktop.png` 和同目录 `stage-flash-light-mobile.png`、`stage-tone-destiny-mobile.png`。无应用 console error；既有 Pixi/Spine tint / update deprecated warning 保留，不归为本批错误。

## 边界与下一批

本批只证明新悬灯通道与现有资源消费者接通。原演出逐帧、HDR/透明深度、真机性能、变速曲 offset 尚未验收。没有全量重导 sidecar、完整资源打包或部署。

全家族 RAW census → 导出 → 消费者 → 资源的统一矩阵，以及未导出 Penlight / Searchlight / Underlight / Smoke 在覆盖面板中的显式缺口，仍是 [STAGE_GAP_AUDIT_20261014.md](STAGE_GAP_AUDIT_20261014.md) 的后续项目；本表仅收束新悬灯家族，不把其他家族写成已接。下一优先仍是 Penlight 和旧悬灯白名单。
