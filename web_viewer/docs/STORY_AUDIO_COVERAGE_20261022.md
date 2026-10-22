# 剧情音频覆盖（2026-10-22）

基线：master `bc991170`（#80 配乐页之后）。对象：剧情目录里播放的全部 BGM / 环境音 / SE cue（`src/data/storyAudioCatalog.json`，1383 篇故事）。

## 结论

| 类别 | cue 数 | 修复前 | 修复后 |
|---|---|---|---|
| BGM | 104 | 41 个没有已转换文件；33 个 `song3_*` 请求 `audio/bgm/song3_*.ogg` 返回 404，剧情里静音 | 0 缺口 |
| 环境音 | 82 | 0 缺口 | 0 缺口 |
| SE | 433 → 431 | 6 个标为缺失 | 0 缺口；2 个音量控制 cue 不再算作音效 |

缺口的性质（按审阅建议的分类）：

- **RAW 有、从未转换**（41 BGM + 4 SE）：旧转换库 `GS_Res/Audio` 只有 55 个 BGM。7 月的 RAW 审计（`.analysis/raw-migration/audio/audit.json`）已确认剧情用到的 105 个 BGM 都有同名 ACB/AWB。
- **消费者映射缺口**（33 个 `song3_*`）：歌曲页播放的是 `/assets/live-chibi/music/<code>.m4a`，剧情的 `AudioManager.playBgm` 却请求 `audio/bgm/song3_<code>.ogg`。
- **非波形**（`00_action_volume_default_sebgm`、`00_action_volume_down_sebgm`）：`se_commu_action.acb` 里的控制 cue，没有可解码的流；运行时早已跳过（`NON_WAVEFORM_SE_CUES`），只是配乐目录把它们当成了缺失音效。

## 同名 SE 跨 sheet 的风险

`getSeUrl(cue)` 只按 cue 名解析，dev 中间件依次在 `sfx/ telephone/ system/` 里查找。7 月的解码对比（`cue-index/ambiguous_decode_comparison.json`）显示：13 个跨 bank 同名的 cue 中，12 个解码后 PCM 完全一致。剩下的 `waribashi` 是**同一个 bank 里的两条随机变体**，不是 sheet 冲突。所以 sheet 只影响总线路由（#58 已按 sheet 处理），不影响取哪个文件，暂不需要把 sheet 加进 SE 的 URL 和缓存键。

## 改了什么

- `AssetResolver.getSongFullMixUrl(code)` 作为全曲混音 URL 的唯一出处。`getBgmUrl('song3_<code>')` 返回它，`verify-song-playback-audio` 也改为 import 它，并断言 61 首歌的剧情 cue 都解析到歌曲页的同一个文件。
- `archive-sources.mjs` 增加 `rawRoot` / `derivedRoot`。`archive-assets.mjs` 增加 `derivedAudio`（`<derived_root>/audio`），作为每个 cue 的**最后一个候选**，旧转换库仍然优先。dev 服务、standalone 服务、预览导出、配乐目录都走这一个解析器，因此都能拿到派生文件。
- `scripts/build-derived-story-audio.mjs`：对目录里旧库缺失的 cue，从 RAW 解码：BGM/环境音取同名 ACB，没有流时取 AWB；SE 取 `se_*.acb` 中流名恰好包含该 cue 的唯一子流。编码与旧库一致：vgmstream 默认渲染（有循环时两遍加 10 s 淡出），Vorbis 160k 立体声 / 96k 单声道，bitexact（重跑字节一致）。来源记录在 `config/derived_story_audio.json`（RAW 路径、sha256、子流号、流名、循环点、输出 sha256）。`--check` 校验文件和来源都没有漂移、解析器实际返回的是这个文件，并且目录里旧库缺失的 cue 都有派生文件。
- 配乐目录生成器把 `NON_WAVEFORM_SE_CUES` 视为静音 cue。

派生文件在 git 忽略的 `web_viewer/.analysis/derived/audio`（45 个，约 92 MiB），只有清单进 Git。

## 验证

- `node scripts/build-derived-story-audio.mjs --check`：45 个派生 cue 与清单一致，且就是解析器返回的文件。
- `verify-song-playback-audio`、`verify-archive-assets` 通过。两项变异测试：去掉 `song3_` 映射，或去掉 `derivedAudio` 候选，都会失败。
- dev HTTP：`audio/bgm/adv_idol_birthday.ogg`、`bgm_grwsml_inst.ogg`、`audio/se/kaisou_short_low.ogg` 都返回 200 audio/ogg。
- Chromium（CDP，真实 `AudioManager`）：`song3_anwhre` 122.0 s、`adv_idol_birthday` 131.1 s、`bgm_grwsml_inst` 126.3 s、`usual_day` 162.5 s 解码并播放（AudioContext running）；SE `kaisou_short_low` 2.17 s、`violin_rei_solo_01` 9.67 s 解码成功。
- **没验证的**：Safari / iOS 真机（`AudioManager` 注释说 Safari 会静默跳过 Ogg；Voice 走 AAC，不受影响）；R2 线上（派生文件还没上传）。

## 后续

1. 下一个 R2 批次：预览导出会通过解析器自动带上 45 个派生文件；同一批次还要带上 #78 的 51 条 Valentine 语音（voice64 转码）。
2. Safari/iOS 真机验收 Ogg。如果确实不能解码，就给 BGM/环境音/SE 统一生成 AAC 派生版本，由 `AssetResolver` 按浏览器能力选择。
3. 无缝循环：旧库和派生文件都是“两遍加淡出”的渲染，`AudioManager` 是整段循环。清单里已经记录原生循环点，以后可以改为整段只渲染一遍，再用 `loopStart/loopEnd` 循环。
4. `kaisou_short_low`、`violin_rei_solo_01_loop` 与非 `_low`/`_loop` 版本共用波形，差别在 cue 参数（音量/循环），目前没有还原。
