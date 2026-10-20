# 剧情音频的原生总线路由（电话 / 电视 / 混响）

客户端里电话语音、剧情里"电视里的声音"不是原声直出，但也不是播放时临时加的滤波：
`StoryView` / `PhoneDisplay` 只调用 `SoundManager.PlaySe/PlayVoice(cueSheet, cue)`，
`PhoneDisplay._VoiceEffectCoroutine` 只切换声波动画的 Animator `Play`，与音频无关。
效果完全来自 CRI 的创作数据，分两层：

1. **每个 cue 的总线发送**（ACB）。命令 `0x006f` = `u16` 总线名（ACB `StringValueTable` 下标）+ `u16` 电平 /10000，
   出现在 Sequence / Track / TrackEvent / Synth 命令里。cue 一旦列出发送，就**只**送到这些总线：
   只列 `bus_phone` 的 cue 没有干声。
2. **总线本身的 DSP**（IPA `/Data/Raw/ADX2/glowing.acf`，`DspBusSetting_0` 默认快照，`SoundManager.DSP_BUS_SETTING`）。

| 总线 | 音量 | DSP（ACF 参数，大端 float） | 去向 |
|---|---|---|---|
| `bus_phone` | 0.8 | `CRIWARE/Bandpass` [300, 6000]；`CRIWARE/32BandsEQ` 8 段 peaking：29 Hz Q1 −24 dB、36 Hz Q1.91 −24 dB、271 Hz Q2.4 +2.4 dB、388 Hz Q2.4 +3 dB、728 Hz Q4.7 +3 dB、998 Hz Q3.9 +2.4 dB、15779 Hz Q1 −24 dB、16874 Hz Q1.1 −24 dB | MasterOut 1.0 |
| `bus_reverb` | 0.5 | `CRIWARE/Reverb` [时间 2000 ms, 房间 25 m, 预延迟 20 ms, 低切 0, 高切 8000 Hz] | MasterOut 1.0 |

`Snapshot_Stage*` 快照把 `bus_phone` 设为 1.0，只在 Live 里应用，剧情用默认快照。

## 哪些声音走这两条总线（RAW/audio 4055 个 ACB 全量）

| 发送 | cue 数 | 例 |
|---|---|---|
| `bus_phone 1.0` | 3695 语音 + 3 | 电话篇 `2_4_xxx_xx_09_*`（2124）、2_3 / 1_2 / 1_3 / 1_4 / 1_8 / 5_00 / 1_1 里的通话台词；`se_commu/bgm_tibeti_TVCM`、`se_telephone/1_3_10016_akeome`、`ambi_out_sunny_day_t` |
| `MasterOut 0 + bus_phone 1.0` | 66 语音 + 20 环境音 + 27 SE + 1 BGM | `1_4_001_*_t0x`（电视里的声音）、其余 `ambi_*_t` 环境音表、`se_telephone`（22）与 `se_commu/*_tel`（5）、`adv_ldyrdm_tv_inst` |
| `MasterOut x + bus_reverb y` | 695 语音 + 1 SE | 2_4 / 2_5 的 `_04_*`（0.5+0.4、1.0+0.4、0.9+0.4），`1_3_30015_01_h`（0.95+0.2），`se_commu_2022/kakugame_fight_loop`（1.0+0.05） |
| `MasterOut 0.8` | 174 | 2_4 / 2_5 的 `_04_01` |

所以"电话"和"电视"是同一条 `bus_phone`；单独的参数是 `bus_reverb`。`stage_master`（song3 / crowd）只属于 Live，不在这里处理。
另外检查过：`0x0044` / `0x0045` 在所有剧情 ACB 里都是同一个值，cue 之间唯一的混音差别就是总线发送。

## cue sheet 决定路由，不是 cue 名

同名 cue 在不同表里路由不同：`se_telephone/door_ent` 走 `bus_phone`，`se_commu/door_ent` 是干声。
剧情 se 行是 `[awb(cue), startTime, volume, Loop, acb(cue sheet)]`（`SoundCommandData`），`PlaySeCoroutine` 把 `acb, awb` 原样传给 `PlaySe`。
RAW 全量 18517 个音频行里：6734 个 se 行 acb 为空，cue 全部在 `se_commu`（`ADX2GeneralSoundUtility` 通用表的第一个）；54 行指定 `se_telephone`。

- 编译器（`sidem_scenario/audio_commands.py`）把非空 acb 记成 `se_events[].sheet`，权威 cue 的 `payload.sheet` 同步；空表不记。
  **已发布语料要等重编译晋升后才带上 sheet**，在那之前 `se_telephone` 的音效按 `se_commu` 干声播放。
- 语音按播放器最终解析到的文件名（= ACB cue 名）查表；环境音和 BGM 的编译数据保留的就是表名，单 cue 表直接按表查。

## 实现

- 表：`src/data/nativeAudioBusRouting.json`，由 `scripts/build-native-audio-bus-routing.py --ipa <2.6.10 IPA>` 从 RAW ACB 与 ACF 生成，只记录与默认 `MasterOut 1.0` 不同的 cue。
- 运行时：`src/core/story-runtime/nativeAudioBuses.js` 查路由并搭 DSP；`StoryAudioSession.routeSource(node, { bus, route })` 按发送接线，
  效果总线按「声道 × 总线」懒创建、接在声道总线之前，所以播放器的音量设置照常生效。
  接入点：`useVoicePlayer`（Web Audio）、`VoiceMediaOutput`（兼容模式，每句重新接线）、`AudioManager` 的 SE / 环境音 / BGM。

Web Audio 近似（参数照 ACF，算法不是 CRI 的）：

- Bandpass = 二阶 highpass 300 Hz + 二阶 lowpass 6000 Hz（Q = 0.707）；CRI 的阶数未知。
- 32BandsEQ 段类型 2 按 ASR EQ 枚举（0 低架 / 1 高架 / 2 peaking）解释；线性增益换成 dB。
- Reverb = 固定种子噪声 × RT60 指数衰减的脉冲响应（2.0 s、20 ms 预延迟）卷积，后接 8000 Hz lowpass；房间尺寸 25 m 没有对应参数。
- MasterOut 上的 `CRIWARE/Limiter` 没有复现。

## 验证

- `npm run verify:native-audio-bus`（已并入 `verify:story-audio`，进源码门禁）：路由解析、ACF DSP、接线（电话线路没有干声通路）、
  兼容模式每句改线、Web Audio 语音、AudioManager 的 SE 表 / 环境音 / BGM、SE cue 带 sheet。11 个变异全部失败。
  - `--mounted --voice-dir=<public/assets/voice>`：4630 个带路由的语音 cue 全部是已发布的 m4a。
  - `--rebuild --ipa=<IPA>`：从 RAW + ACF 重新生成，必须与提交的表逐字节相同。
- 真实 Chromium（OfflineAudioContext 渲染真实语音文件，经运行时模块）：`1_1_002_02_a1000` 低频（<200 Hz）相对 1–3 kHz 从 −1 dB 降到 −9.8 dB，
  高频（>8 kHz）从 −6.9 dB 降到 −24.5 dB，响度基本不变；`2_4_001_01_04_03` 的混响发送在语音结束后留下尾音。

## 未做

- se 行的 volume 列（`SetSeVolume`）目前没有生效，`playSE` 固定 0.6，与本次路由无关，另立。
