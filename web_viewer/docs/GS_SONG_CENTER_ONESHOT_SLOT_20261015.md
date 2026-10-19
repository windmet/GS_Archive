# 歌曲 Center 台词槽：2026-10-15

分支：`portal/20261015-song-voice-slot`，起点 master `dc348a9c`。

## 问题

FLASH LIGHT（flslgt）与 precious love（pcuslv）的 ACB 各带 49 条 `song3_<code>_oneshot_<idol>`。歌曲页此前写成“收录 49 位偶像音轨 / 成员的简短演出语音”，实际上这是曲中一句台词：完整混音在该处只有伴奏（约 -12 dB，演唱者事件在 flslgt 35600 ms 处为空），游戏在此播放其中一位偶像的台词。

## 客户端机制（反查结论）

来源：`libil2cpp.decrypted.so`，Ghidra headless 只读反编译；字段名取自 il2cpp dump。

- 歌曲 live_effect CSV（`RAW/asset/song_<code>.unity3d`）的 `Unit_serif` 行（`LiveEffectType.Unit_serif = 903`）：flslgt `35550, 1, song3_flslgt_oneshot_`；pcuslv `60000, 1, song3_pcuslv_oneshot_`（CSV 内重复一行，同一时刻同一 cue，按一次处理）。
- `Unit_serifLiveEffectTypeExecuter.PlayEffect`（RVA `0x19C6B28`）：`liveData.deck.deckLiveCards.ToList().ElementAtOrDefault(value1 - 1)` 取卡，拼接 `value2 + idolData.code` 为 cue，在本曲 cue sheet 上 `SoundManager.PlayVoice`。
- `LiveDeckData.get_deckLiveCards`（RVA `0x1D69030`）按编成槽顺序展开；`UserDeckData.get_centerUserCardData`（RVA `0x276F798`）为 `FirstOrDefault`，即编成第 1 槽是 Center 卡。
- 结论：value1 = 1 → 播放**编成 Center 卡的偶像**的台词。不读取舞台站位（未调用 `GetTargetIdol(positionNo)`），也与演唱成员无关。

## 实现

- `scripts/prepare-song-oneshot-voices.py`：从 song bundle 读 `Unit_serif`，用 vgmstream 按 subsong 解码 98 条 cue（flslgt 4.444 s、pcuslv 3.636 s），ffmpeg AAC 160k 写到 `public/assets/live-chibi/oneshot/<code>/<idol>.m4a`（被忽略的媒体，共 6.3 MB）；生成跟踪的 `public/data/song_oneshot_voices.json`，记录触发时间、编成槽、cue 前缀、RVA 证据、ACB/bundle 与每条剪辑的 SHA-256。
- `src/composables/useStageOneshotVoice.js`：独立播放槽。选项为“跟随 Center”（默认）、任选 49 人、关闭（保留原曲留白）。舞台页没有编成，“跟随 Center”取当前编队的演唱位 1（经 `stagePositionMap` 换算到舞台位；flslgt 演唱位 1 = 3 号位，原曲成员下为 048mom）。在 `toggleStage` 开始时按当前时间定位游标；`updateStage` 越过触发点即播放，若从台词中间开始则带偏移续播，跳过已结束的台词；`stopStage` / `seekStage` 停止；跟随倍速。媒体元素模式与声部实验模式共用同一舞台时钟。
- `ChibiStageViewer.vue`：编队面板“Center 台词”选择框与说明，只在 manifest 收录的歌曲出现。
- 歌曲页 / 曲库：形式标签“演出语音”改为“Center 台词”，与卡面演出语音区分；说明改为机制描述。

## 验证

- `npm run verify:song-oneshot-voices`（已加入 source gate）：manifest 与曲目目录一一对应、触发时间、cue/URL/哈希、重复行折叠、游标与选择解析语义、舞台播放钩子。
- `verify-song-detail-presentation`（`--experimental-vm-modules`）随标签更新后通过；`verify-song-domain-landing`、`verify-chibi-song-library` 通过；`npm run build:check` 通过（随后恢复其生成器改写的 `config/` 与 translations manifest）。
- Browser（5177，Edge headless 经 Playwright，拦截 `HTMLMediaElement.play`）：FLASH LIGHT 默认 Center 播放 `003hok.m4a`（起点偏移 0.006 s）；选 001tom 并 1.5× 播放 `001tom.m4a` 且 rate 1.5；从 36.5 s 开始在 0.95 s 偏移续播；从 41 s 开始与“关闭”均不播放；控制台无错误。截图保存在会话 scratchpad，未入库。

## 边界与后续

- 98 条 m4a 只在本地（经 junction 写入主 checkout 的 `public/assets/live-chibi/oneshot/`），尚未上传 R2；上线前需在 `release/` 线按增量流程上传。
- precious love 的选择框与触发由同一 manifest / 代码路径覆盖，本次 Browser 实播只覆盖 FLASH LIGHT。
- 游戏内具体音量平衡（voice bus）未复刻，剪辑按 1.0 音量叠加在原曲上。
