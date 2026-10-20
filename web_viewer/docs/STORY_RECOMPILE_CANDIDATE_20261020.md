# 故事语料全量重编译候选（2026-10-20）

只产出候选，不写 public。目的：把 9 月以来的编译器修复（10-13 原生音频列 / PlayView / 粒子 alpha / Spine 轨道，10-15 站位与镜头）带进已发布语料前，先逐字段看清会变什么。

## 工具

```
python scripts/recompile-story-corpus-candidate.py --output <web_viewer 外的空目录> \
    --compiled-dir E:/Web_build/SideM_Archived/web_viewer/public/data/compiled
python scripts/report-story-recompile-candidate.py --candidate <同一目录>
```

- domain worktree 只跟踪部分 compiled，`--compiled-dir` 指向主检出（只读）。
- 出处按已发布文件判定：`text_ref.source.file` 指向 bundle 容器，或 `source.raw_path` 是 `RAW/asset/…`，就用 `publication/releases/*.json` 登记的 bundle、sha256 和每个 part 的容器路径，从 TextAsset 编译；其余走 legacy JSON（`compile_candidate`）。
- voice 保持编译器原样输出，和已发布语料一致；播放器由 `AssetResolver.resolveVoiceFilenameCandidates` 解析。报告用 Node 直接 import 这个函数，对照 `public/assets/voice` 判断两边是否播放同一个文件，不写镜像规则。
- 报告先按 `(type, text)` 对齐 step 再比字段，插入一步不会让后面全部错位。

## 本轮结果（full2）

3402 个已发布文件：3398 个候选 + 4 个 blocked，共 5382 个产物（bundle 1362 / legacy 2036）。

| 级别 | 字段数 | 文件数 |
|---|---|---|
| safe | 64 | 5382 |
| review | 106 | 4575 |
| risky | 17 | 197 |

上一版候选的两个回归已修复并确认清零：
1. **voice 错接**：`relink_voices` 解析不到时取第一个同后缀文件，让电话、`4_x_101ken` 等播放别的剧情的语音（22 处）。候选现在不再 relink。
2. **text_ref 路径漂移**：192 个兼容文件走了 legacy JSON，`source.file` 从容器路径变成 `scenariodata/…`（1702 个产物）。现在改按发布台账走 bundle。

变异检验：新报告跑旧候选，18 处 now-plays 和 4 处 other-file 都被标成 risky，`source.file` 漂移也是 risky。

## risky 逐项结论

| 字段 | 文件 | 结论 |
|---|---|---|
| `state.environmental.volume` 移除（含 snapshot） | 97 | 有意：4808dc01 按客户端读音频列 |
| `spines[].idol_zoom_y_offset` 移除 | 40 | 有意：e7aab177 删掉猜测偏移，运行时已不读 |
| `spines[].anim_no_back` 移除 | 4 | 有意：de850b7e 原生 Spine 轨道 |
| `bg_effects[].action/delay/duration` 移除 | 5 | 有意：73ab7983 `effect_bgstart[2]` 是粒子 alpha |
| `step-removed`（stage） | 30 | 编译器既有「丢弃无演出的裸 wait」策略；f21db85b 后空 bgm 行不再算演出，所以多丢了一些 wait。节奏会变短（例：`1_1_012_03_g` 少 0.5s）。**待定**：原生客户端裸 wait 也会真的等待，是否改编译器另议 |
| `voice:now-silent` | 22 / 102 处 | 全部是**已发布版错接**：Valentine `5_01_041_23`–`5_01_049_23` b 段现在播放主线 `1_1_001_01` 的语音。候选给的是正确的原生名，只是本地没有这批音频。属于修复；**跟进**：补抽这批语音 |
| `presentation_context` 移除 | 2 | 由 `derive-chat-threads.py` 后处理产生，候选没跑后处理。晋升时必须重跑 |
| `spines[].fade` / `idol_color(_transition)` / `timeline` 移除 | 9 / 2 / 2 | 都在 10-13/10-15 Spine 重构的范围内，**需逐例对照 RAW** |

## review 主体

- 新增文本绑定：`dialogue.text_ref` 1697 个文件、`options[].text_ref` 624 个。unit_id 规则不变，已有绑定集合抽样一致。晋升后要重新生成翻译审计、manifest 和搜索本地化。
- BGM / 环境音状态变化（`bgm`、`bgm_volume`、`bgm_stop_fade`、`environmental.cue`）：对应 10-13 的原生音频修复。
- step 增减带来的 `step_id`、`episodes[].*_index`、`aggregate_source.*`、`total_steps` 变化（约 115 个文件）。
- `reading_control_flow.*` 的哈希随基底变化（592 个文件），晋升时要和分叉一起重新生成。

## blocked（4，非故事内容）

`7) talk_chat_01.json`、`7) talk_chat_02.json`、`_test_se_env.json`、`scenario_2_4_040_01_00_compiled.json`：git 未跟踪，src、reading 和索引都没有引用，属于测试残留。是否清理由维护者决定。

## 晋升前还要做

1. 逐例确认 fade / idol_color / timeline 的 13 个文件，以及裸 wait 策略是否要改。
2. 晋升流程要包含后处理：chat threads、phone forks、reading_control_flow。
3. 与 i18n 通道错开：晋升后重新生成翻译审计、manifest 和搜索本地化。
4. 晋升属于发布事务（`publication/releases`），按 supersede 记账。
