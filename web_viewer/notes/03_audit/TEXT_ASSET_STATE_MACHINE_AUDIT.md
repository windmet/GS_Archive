# Text Asset / ADV State Machine 全量审计

> 维护说明：本文保留全量审计和样本推理过程。当前项目入口见 `DEVELOPMENT.md`，已踩坑和错误路线见 `PITFALLS_AND_DEBUGGING.md`，资源接入清单见 `TEXT_ASSET_AUDIT.md`。

更新时间：2026-06-29

关联文档：
- `LIPSYNC_INTEGRATION.md`：唇形数据接入已单独收敛，本轮不再把音量驱动作为主线。
- `TEXT_ASSET_AUDIT.md`：早期 Text Asset 缺口清单，部分 P0 已过期。
- `ADV_STATE_MACHINE_NOTES.md`：记录了 `text_disable` 方向，但还没有覆盖“无对白演出段被吞”的结构性问题。

## 结论

当前最大问题不是单个命令漏 handler，而是编译器的 step 粒度仍然以“对白”为中心：大部分画面、声音、动作命令只修改累计状态，只有对白、选项、标题、淡入淡出、少量过渡会真正 emit step。

这会导致官方脚本中的“无对白演出段”丢失。典型表现是：脚步声、角色登场、动作、等待、退场这些原本应该独立播放的桥段，被压缩进下一句对白的 state snapshot，前端自然无法在第一句对白前播放它们。

## 关键样本：`1_1_013the_02_1_1_013_02`

用户指出的问题成立。

当前 viewer 的第一句是：

```text
040ren: チビたち、このビルに入ってったよな……
```

但 raw 数据 `scenario_1_1_013_02_a.json` 在这句之前有一段完整无对白演出：

| raw index | command | 作用 |
| --- | --- | --- |
| 22-23 | `se step_walk_come_*` | 两组脚步声 |
| 24 | `wait 1.25` | 等脚步靠近 |
| 26-29 | `idol_zoom` / `idol_fadein` | `038tak` 与 `039mcr` 登场 |
| 30 | `wait 1` | 停顿 |
| 31-35 | `se` / `idol_animation hello` / `idol_face` | 无对白动作 |
| 36 | `wait 3` | 保持动作 |
| 37-40 | `se step_walk_away_*` / `idol_fadeout` | 两人退场 |
| 41-46 | `wait` / `se` / `bgm` / `idol_fadein 040ren` | 接到 Ren 登场 |
| 50 | `text` | 第一句对白 |

当前编译产物中，这段没有对应的 playable step；前端只看到 `synopsis -> fadeout -> title -> adv(Ren 第一话)`。

## 当前代码状态

编译器位置：

```text
E:\Web_build\SideM_Archived\data_pipeline\scenario_compiler.py
```

当前 dispatch 已经接入：

- `text_disable`
- `environmental_volume`
- `environmental_ducking`

因此旧文档里把这三项列为“未注册 P0”的结论已经过期。

仍然是 no-op 或未注册的高价值命令：

| 命令 | 当前状态 | 风险 |
| --- | --- | --- |
| `wait` | no-op | 时间轴无法独立推进，无对白演出无法停顿 |
| `screen_slidein/out` | no-op | 画面滑入/滑出缺失 |
| `idol_neckanimation_stop` | no-op | 颈部/头部动作停止语义缺失 |
| `image_icon` / `image_Icon` | no-op | mob/icon 表现缺失 |
| `talk_end` / `phone_end` | no-op | 模式结束只靠后续状态间接覆盖 |
| `jump` | no-op | 分支流转目前依赖 step index，复杂分支仍有风险 |
| `cut_end` | 未注册 | 段落边界信号缺失 |
| `idol_nobackanimation` | 未注册 | 一次性动作/不回 idle 语义缺失 |
| `text_time` | 未注册 | 时间/地点字幕缺失 |
| `image_bg_dissolve` | 未注册 | 背景溶解过渡缺失 |
| `effect_bgstart/bgend` | 未注册 | 背景特效缺失，例如 camera flare |
| `idol_priority` | 未注册 | 多人同屏 z-order 可能不准 |
| `talk_stamp` | 未注册 | talk/phone 贴纸缺失 |
| `idol_parts_on/off` | 未注册 | 部件显隐缺失 |

## 全量 raw 指令统计

扫描范围：

```text
E:\BaiduNetdiskDownload\SideM\scripts\scenariodata
```

总 raw JSON：4941 个。

高频命令：

| command | 次数 | 文件数 |
| --- | ---: | ---: |
| `idol_face` | 65259 | 3878 |
| `wait` | 59384 | 3998 |
| `idol_animation` | 35929 | 3878 |
| `text` | 27737 | 3773 |
| `jump_point` | 11673 | 2496 |
| 空 Type | 11483 | 37 |
| `idol_fadein` | 10426 | 3862 |
| `idol_position` | 9343 | 3904 |
| `talk_text` | 8953 | 728 |
| `se` | 7434 | 1890 |
| `cut_end` | 7304 | 1601 |
| `idol_model` | 6683 | 3910 |
| `screen_fadeout` | 5810 | 4938 |
| `idol_fadeout` | 5757 | 1279 |
| `image_bg` | 5610 | 4888 |
| `idol_neckanimation` | 5086 | 2215 |
| `text_disable` | 4646 | 1466 |
| `bgm` | 3722 | 2350 |
| `phone_text` | 3717 | 458 |
| `voice_file` | 3607 | 1720 |
| `environmental` | 3604 | 2916 |
| `text_synopsis` | 2343 | 2343 |
| `talk_select` | 2307 | 687 |
| `image_bg_dof` | 1802 | 642 |
| `image_bg_color` | 1781 | 632 |
| `jump` | 1609 | 705 |
| `camera_zoom` | 1474 | 739 |

中低频但视觉影响明确：

| command | 次数 | 文件数 |
| --- | ---: | ---: |
| `screen_fadein` | 1077 | 676 |
| `idol_neckanimation_stop` | 948 | 685 |
| `idol_nobackanimation` | 835 | 418 |
| `text_time` | 835 | 695 |
| `voice` | 784 | 352 |
| `environmental_stop` | 615 | 482 |
| `idol_color` | 440 | 143 |
| `image_bg_dissolve` | 420 | 348 |
| `effect_bgstart` | 404 | 313 |
| `camera_resetzoom` | 334 | 274 |
| `idol_priority` | 277 | 107 |
| `effect_bgend` | 276 | 245 |
| `screen_slidein/out` | 212 each | 165 |
| `idol_slide` | 211 | 93 |
| `environmental_ducking` | 108 | 104 |
| `talk_stamp` | 88 | 68 |
| `idol_parts_off` | 46 | 40 |

## 当前 compiled step 统计

扫描根级编译产物：

```text
E:\Web_build\SideM_Archived\web_viewer\public\data\compiled\*.json
```

根级 compiled 文件：3402 个，总 step：51029。

| step type | 次数 |
| --- | ---: |
| `adv` | 27904 |
| `talk` | 8953 |
| `fadeout` | 5810 |
| `call` | 3723 |
| `choice` | 2130 |
| `fadein` | 1077 |
| `synopsis` | 1003 |
| `title` | 393 |
| `text_disable` | 36 |

注意：当前 compiled step 类型里没有“stage / performance / silent / wait”一类承载无对白演出的 step。只靠现有结构，无法表达用户指出的官方桥段。

`text_disable` raw 有 4646 条，但根级 compiled 只统计到 36 个独立 step。这里需要继续拆分确认：可能包含未重新编译、旧子目录产物干扰、或 handler emit 逻辑被条件路径绕过。后续统计必须只看根级合并 JSON，并同时记录编译时间。

## 无对白演出块统计

本轮按“两个 emit step 之间存在可见/可听命令，并且包含等待、延迟、SE、过渡或动作时间”的规则粗筛：

- 疑似 silent performance blocks：31846 段
- 发生在第一句对白前的 blocks：3852 段

高频组合：

| 组合 | 段数 | 说明 |
| --- | ---: | --- |
| `idol_animation + idol_face` | 7795 | 角色表情/动作变化但无独立 step |
| `idol_face` | 3063 | 表情变化可能被吞到下一句 |
| `idol_animation + idol_face + voice_file` | 2102 | 下一句语音前的角色状态准备 |
| `idol_animation + idol_face + idol_neckanimation` | 1389 | 复合动作 |
| `bgm + environmental + idol_animation + idol_face + image_bg` | 1058 | 场景建立段 |
| `se` | 812 | 纯音效段，例如脚步声 |
| `idol_animation + idol_face + se` | 715 | 音效配合动作 |
| `idol_animation + idol_face + idol_fadein` | 654 | 登场动作 |

这说明缺 step 不是少量个案，而是当前状态机模型天然会漏掉官方写好的演出时间轴。

## 状态清理风险复核

前几轮提到的“回退后角色仍变暗”等问题，本质也和状态边界有关：如果某个状态只在后续对白 snapshot 中被覆盖，而没有在 transition/stage step 中表达完整开始与结束，前端回退或跳步时就容易看到残留。

重点风险字段：

| 状态 | 风险 |
| --- | --- |
| `bg_color` / `bg_dof` | 心声、回忆、暗场恢复不完整时残留 |
| `idol_color` | 多人场景一人变暗后，正常对话未显式恢复 |
| `camera_zoom` | 镜头推进/复位若只靠下一句覆盖，回退时可能错位 |
| `screen_fade` | one-shot 清理后无法表达连续过渡 |
| `se` / `bgm_stop_fade` / `environmental_duck_target` | one-shot 信息被 snapshot 后清空，若缺 stage 会提前或延后 |
| `timeline` | 目前主要附着在对白 step，非对白段没有承载体 |

## 建议的新 step 模型

新增一种自动播放的演出 step，暂命名为 `stage`：

```json
{
  "type": "stage",
  "hide_dialogue": true,
  "auto_advance": true,
  "duration": 3.0,
  "state": {},
  "timeline": [
    { "time": 0.0, "type": "se", "cue": "step_walk_come_conc_boot" },
    { "time": 1.25, "type": "idol_fadein", "chara_id": "039mcr", "duration": 0.2 },
    { "time": 2.25, "type": "idol_animation", "chara_id": "039mcr", "anim": "hello" }
  ]
}
```

原则：

1. 不把每个 `wait` 都机械变成 step。
2. 只有当一个非对白块包含可见/可听事件时，才 emit `stage`。
3. `stage` 应保存进入该段前后的 state，并携带 timeline。
4. `stage` 自动推进，但需要允许回退准确恢复。
5. 现有 `adv / talk / call / choice / fade / text_disable` 结构尽量不破坏。

## 编译器改造路线

### P0：补上无对白演出承载体

1. 在 compiler 中引入 pending performance buffer。
2. 非对白命令进入 buffer，同时继续更新累计 state。
3. 遇到对白/标题/选项/显式 fade 前，判断 buffer 是否需要 emit `stage`。
4. `wait` 不再直接 no-op，而是给 buffer 累加时间。
5. `se`、`idol_fadein/out`、`idol_animation`、`idol_face`、`camera_zoom`、`bgm`、`environmental`、`effect_*` 等进入 timeline。
6. 前端 `StoryViewer.vue` 识别 `stage`，隐藏对白 UI，按 duration 自动推进。
7. 前端 `SpineStage.vue` / stage manager 应用 `stage.timeline`。

首个验收样本：

```text
1_1_013the_02_1_1_013_02
```

验收画面：

```text
synopsis -> fade/title -> 脚步声 -> 039mcr/038tak 登场 -> 无对白动作 -> 淡出/退场 -> 040ren 第一话
```

### P1：补会影响多人同屏的状态命令

1. `idol_priority`：用于 z-order，避免多人同屏层级错误。
2. `idol_color` 恢复策略：在 stage/adv snapshot 中明确恢复默认色，解决心声后残留变暗。
3. `screen_slidein/out`：先用 stage timeline 表达，后续再做真实转场。
4. `idol_neckanimation_stop`：补停止语义，防止头/颈动作持续残留。
5. `image_bg_dissolve`：接入背景溶解过渡。

### P2：补充表现数据

1. `text_time`：时间/地点字幕。
2. `talk_stamp`：talk/phone 贴纸。
3. `idol_nobackanimation`：一次性动作且不自动回 idle。
4. `idol_parts_on/off`：部件显隐。
5. `effect_bgstart/bgend/fadein/fadeout/single`：背景/前景特效。
6. `advbackground` 默认 ambience/BGM/color profile。
7. `idolmotionsetting`：动画链从官方配置读取。
8. `colorfilterpreset`：滤镜矩阵配置化。

## 验证计划

1. 编译前后统计 step type，确认出现 `stage` 且数量合理。
2. 对比 raw silent block 数与 emitted `stage` 数，避免过度切碎。
3. 手测样本：
   - `1_1_013the_02_1_1_013_02`：第一句 Ren 前必须出现 039mcr/038tak 无对白演出。
   - 含 `text_disable + idol_color + image_bg_dof/color` 的心声段：进入和退出都不能残留变暗。
   - 多人同屏连续数句同一人说话：未说话角色不能每句重新从 `wait_loop` 切动作。
   - 含 `idol_priority` 的场景：层级不被说话者强行覆盖。
4. 回退测试：
   - 从 stage 后退到 stage 前，角色显隐、颜色、镜头、背景滤镜必须恢复。
   - 从心声回退到正常对白，变暗状态必须被清除。
5. 产物统计只看根级合并 JSON；旧子目录 `_compiled.json` 只能作为历史参考。

## 当前优先级判断

下一步不建议先继续补单个贴图或单个 text asset 小命令。应先补 `stage` 机制，因为它是承载脚步、等待、无对白动作、过渡恢复的共同基础。等 `stage` 能表达官方时间轴后，再补 `idol_priority / image_bg_dissolve / text_time / talk_stamp` 等命令，收益会稳定很多。

## 实施记录：2026-06-29

已完成第一版 `stage` 机制：

1. 编译器中 `wait` 不再完全 no-op。当 `wait` 前存在可见/可听演出变化时，emit 自动播放的 `stage` step。
2. `stage` step 写入 `duration`、`auto_advance`、`hide_dialogue`，并可携带原有 delayed face/animation/color timeline。
3. 前端 `StoryViewer.vue` 已识别 `stage`，隐藏对白 UI，并按 `duration` 自动推进。
4. 已执行全量 `--compile-only` 重编译，产物位于 `public/data/compiled`。

重编译后的根级 compiled 统计：

| step type | 次数 |
| --- | ---: |
| `adv` | 27904 |
| `stage` | 13336 |
| `talk` | 8953 |
| `fadeout` | 5810 |
| `text_disable` | 4646 |
| `call` | 3723 |
| `choice` | 2130 |
| `fadein` | 1077 |
| `synopsis` | 1003 |
| `title` | 393 |

验收样本 `1_1_013the_02_1_1_013_02`：

- 总 step：227。
- Ren 第一话前现在有 6 个 `stage`：
  - 脚步声。
  - `038tak` / `039mcr` 登场。
  - 两人无对白动作。
  - 两人退场。
  - Ren 跑近。
  - Ren 登场。
- Ren 第一句自身仍保留 delayed face/neck timeline，没有被拆成额外等待步。

第一版仍是保守实现：只在 raw 明确 `wait` 时生成 `stage`，避免把普通对白前的表情准备拆成多余停顿。后续如果要继续逼近官方，可把 `idol_fadein/out` 的真实淡入时长、`screen_slidein/out`、`effect_bgstart/bgend` 继续加入 stage timeline。

### 追加：SE 叠放

第一版 `stage` 使用旧字段 `state.se`，同一个等待段前如果连续出现多条 `se`，只会保留最后一条。`1_1_013the_02_1_1_013_02` 开场脚步声就是典型例子：

```text
se step_walk_come_conc_boot
se step_walk_come_conc_sneaker
wait 1.25
```

已新增兼容字段：

```json
{
  "state": {
    "se": { "cue": "step_walk_come_conc_sneaker", "volume": "0.01" },
    "se_events": [
      { "cue": "step_walk_come_conc_boot", "volume": "0" },
      { "cue": "step_walk_come_conc_sneaker", "volume": "0.01" }
    ]
  }
}
```

- `se` 保留最后一条，兼容旧逻辑。
- `se_events` 保存同一步所有 one-shot SE，前端优先播放该列表。
- 已全量重编译，根级 compiled 中 `se_event_steps=6537`，其中 `multi_se_steps=697`。
- 验收样本的来场/退场脚步现在都保留 boot + sneaker 两条 SE。

### 追加：`idol_priority`

已接入官方多人同屏层级：

- 编译器读取 `idol_priority [chara_id, priority]`，写入对应角色 state 的 `idol_priority`。
- 支持“先 priority、后 idol_model”的 raw 顺序：priority 会先缓存，角色声明后再补到 spine state。
- 前端在当前 step 任一角色带 `idol_priority` 时，按官方 priority 排序；没有官方 priority 时才沿用“当前说话者置顶”的旧策略。
- 排序规则：低值在后，高值在前；例如 `-1 -> 0 -> 1`。

验收样本：

```text
1_1_015leg_04_1_1_015_04
step 155:
  045sor = -1
  044ame = 0
  046chr = 1
```

全量重编译后统计：

- `priority_entries=2245`
- `priority_steps=1317`

这会改善多人同屏时角色层级被“说话者置顶”硬覆盖的问题，尤其是官方明确指定前后关系的场景。

### 追加：`idol_fadein` / `idol_fadeout` 时长

第一版 `stage` 已经能把登场/退场桥段保留下来，但角色显隐仍接近瞬时切换。现在已把 raw 中的 `delay` / `duration` 接入：

- 编译器在角色 state 中写入一次性字段 `fade`：

```json
{
  "id": "038tak",
  "fade": { "type": "in", "delay": 0.0, "duration": 0.2 }
}
```

- `idol_fadeout` 不再在当前 step 里直接从 snapshot 消失，而是当前 step 保留角色并写入 `fade: out`；snapshot 后再从后续状态隐藏。
- 前端在 wrapper 层做 alpha 过渡，整个人物作为一层淡入/淡出，减少 Spine 内部部件半透明穿透。
- 新角色 spawn 时可使用官方 fadein duration。

验收样本 `1_1_013the_02_1_1_013_02`：

- step 5：`038tak` / `039mcr` 带 `fade in 0.2s`。
- step 7：`038tak` / `039mcr` 带 `fade out 0.7s`，并且该 step 内角色仍存在，可完成退场淡出。
- step 9：`040ren` 带 `fade in 0.2s`。

全量重编译后统计：

- `fade_steps=9127`
- `fade_entries=15351`
- `fade_in=10367`
- `fade_out=4984`

### 追加：`image_bg_dissolve`

已接入官方背景溶解切换数据：

- 编译器现在注册 `image_bg_dissolve`，读取 raw 参数 `[bg_id, color?, delay?, duration?]`。
- 该命令会像 `image_bg` 一样更新当前背景，同时写入一次性 `bg_transition`：

```json
{
  "bg": "bg086_dancestudio_in_01",
  "bg_transition": {
    "type": "dissolve",
    "color": "",
    "delay": 0.0,
    "duration": 1.5
  }
}
```

- `bg_transition` 在当前 snapshot 发出后立即清理，避免后续 step 误复用同一次过渡。
- 前端 `SpineStage.vue` 会把 `state.bg_transition` 传给 stage manager。
- `PixiStageManager.setBackground()` 现在支持官方 `delay` / `duration`，普通 `image_bg` 仍使用默认背景切换时长。
- 如果 `image_bg_dissolve` 出现在无对白演出块内，会通过 `stage` 承载，不再被压缩到下一句对白里。

验收样本：

```text
1_1_001jup_03_1_1_001_03
step 120: stage, bg086_dancestudio_in_01, dissolve 1.5s
step 163: stage, bg036_classroom_in_01, dissolve 1.5s
step 193: stage, bg086_dancestudio_in_01, dissolve 1.5s
```

全量重编译后统计：

| 指标 | 数量 |
| --- | ---: |
| `bg_transition` steps | 420 |
| `dissolve` transitions | 420 |
| 涉及根级 compiled 文件 | 144 |
| 最大官方 duration | 4.0s |

这一步解决的是背景切换过渡缺失，不直接处理背景特效。下一批更适合继续看 `screen_slidein/out` 与 `effect_bgstart/bgend`，它们同样属于“官方有演出时长，但当前容易被吞进对白状态”的类型。

### 追加：`screen_slidein/out`

已接入官方滑屏转场：

- 编译器现在注册 `screen_slidein` / `screen_slideout`。
- raw 参数按 `[delay?, duration?, direction?, ...]` 解析。
- direction 使用官方脚本里的数字方向，当前按 numpad 方向处理：
  - `2`：向下
  - `4`：向左
  - `6`：向右
  - `8`：向上
- `screen_slidein` / `screen_slideout` 不再等待下一个对白或 wait 承载，而是像 `screen_fadeout/in` 一样直接 emit 独立 step。
- 这样可以正确表达官方常见结构：

```text
screen_slidein -> image_bg / bgm / environmental / idol state changes -> screen_slideout
```

如果 slidein 只写入累计 state，会导致遮屏期间的背景和角色状态提前暴露；现在改成独立 step 后，换景发生在遮屏状态中，slideout 再揭开新画面。

验收样本：

```text
1_1_001jup_01_1_1_001_01
step 20: slidein, bg023_tvstudio_in_01, duration 0.5s
step 21: slideout, bg017_tvstation_in_01, duration 0.5s
step 89: slidein, bg012_residence_out_01, duration 0.5s
step 90: slideout, bg004_townst_out_01, delay 1.0s, duration 0.5s
```

全量重编译后统计：

| 指标 | 数量 |
| --- | ---: |
| `slidein` steps | 212 |
| `slideout` steps | 212 |
| slide 总 step | 424 |
| 涉及根级 compiled 文件 | 110 |

前端实现：

- `StoryViewer.vue` 把 `slidein/slideout` 视为 transition step，自动按 `delay + duration` 推进。
- `PixiStageManager.js` 新增顶层滑屏遮罩，支持四方向滑入/滑出。
- `SpineStage.vue` 从 `state.screen_slide` 调用滑屏动画；非 slide step 会清理一次性遮罩。

### 追加：`effect_bgstart/bgend`

已接入官方背景特效状态：

- 编译器现在注册 `effect_bgstart` / `effect_bgend`。
- raw 参数按 `[effect_id, delay?, duration?, ...]` 解析。
- 背景特效写入持久状态 `state.bg_effects`，例如：

```json
{
  "bg_effects": [
    {
      "id": "cameraflare",
      "visible": true,
      "action": "start",
      "delay": 0.0,
      "duration": 0.6
    }
  ]
}
```

- `action/delay/duration` 是一次性过渡信息，snapshot 后会清理。
- `effect_bgend` 的 step 发出后，后续累计状态会移除对应 effect，避免背景特效残留。
- 如果 start/end 出现在无对白演出块内，会被 `stage` 承载，不再吞进下一句对白。

前端实现：

- `PixiStageManager.js` 新增背景特效层。
- `cameraflare` 目前用屏幕亮光/镜头光晕模拟。
- `fx_adv_rain` / `fx_adv_rain_heavy*` 目前用持续雨线模拟。
- 未知 effect id 会保留状态但不强行显示错误视觉，方便后续按资产继续补。

验收样本：

```text
1_1_001jup_03_1_1_001_03
step 43: fadeout, cameraflare start, duration 0.6s
step 44-54: cameraflare persists across stage/adv/text_disable
```

全量重编译后统计：

| 指标 | 数量 |
| --- | ---: |
| 带 `bg_effects` 的根级 compiled 文件 | 150 |
| 全量 `stage` steps | 13340 |
| 全量 `slidein/slideout` steps | 424 |

构建验证：

- 编译器语法检查通过。
- 全量 `--compile-only` 通过，3398 个 scenario 已重新输出到 `public/data/compiled`。
- `npm run build` 完成模块转换后失败在清理既有 `dist/assets`：`ENOTEMPTY, Directory not empty`。这属于本地输出目录被占用/文件句柄问题，不是这轮代码转换错误。

### 追加：`text_time`

已接入官方时间/地点字幕：

- 编译器现在注册 `text_time`。
- raw 参数按 `[caption_text, ...]` 解析。
- 该命令会 emit 独立 `text_time` step，而不是把字幕压进下一句对白。
- step 结构示例：

```json
{
  "type": "text_time",
  "duration": 1.2,
  "auto_advance": true,
  "text_time": {
    "text": "撮影開始"
  }
}
```

- 前端新增 `TextTimeUI.vue`，在画面中央显示官方字幕。
- `StoryViewer.vue` 会按 `duration` 自动推进，并把 `text_time` 视为 transition step，避免回退时落在短字幕中间。

验收样本：

```text
1_1_001jup_01_1_1_001_01
step 129: text_time, 撮影開始
```

全量重编译后统计：

| 指标 | 数量 |
| --- | ---: |
| `text_time` steps | 835 |
| 涉及根级 compiled 文件 | 227 |

### 追加：`talk_stamp`

已接入 talk 模式贴纸：

- 编译器现在注册 `talk_stamp`。
- raw 参数按 `[speaker, stamp_id, chara_id, side?, ...]` 解析。
- `stamp_id` 会规范化成真实资源名，例如 `001tom_01` -> `image_mobile_stamp_001tom_01`。
- step 结构示例：

```json
{
  "type": "talk_stamp",
  "duration": 1.0,
  "auto_advance": true,
  "stamp": {
    "id": "image_mobile_stamp_001tom_01",
    "raw_id": "001tom_01",
    "speaker": "天ヶ瀬 冬馬",
    "chara_id": "001tom",
    "side": "1"
  }
}
```

- `StoryViewer.vue` 会让 `talk_stamp` 和普通 `talk` 共用 Mobile UI。
- `MobileUI.vue` 现在会把 `talk_stamp` 加进聊天历史，并使用 `public/assets/stamps` 下的真实贴纸图片。
- `talk_stamp` 会自动推进，但会进入 history stack，保证后续消息里仍然能看到刚发出的贴纸。

验收样本：

```text
001tom_301_2_3_001_01_09_b
step 11: talk_stamp, image_mobile_stamp_001tom_01
```

全量重编译后统计：

| 指标 | 数量 |
| --- | ---: |
| `talk_stamp` steps | 88 |
| 涉及根级 compiled 文件 | 68 |

验证：

- 编译器语法检查通过。
- 全量 `--compile-only` 通过，3398 个 scenario 已重新输出。
- 临时 smoke 构建通过：524 个前端模块转换成功。smoke 构建禁用了 public 大资产复制，只验证源码打包。

### 追加：`idol_neckanimation` / `idol_neckanimation_stop`

已把颈部/头部动作从普通 body 动作里拆出来：

- `idol_neckanimation` 现在注册为独立 handler。
- raw 参数按 `[chara_id, delay, neck_anim, ...]` 解析。
- `delay > 0` 时写入 timeline：

```json
{
  "time": 1.5,
  "type": "spine_neck_anim",
  "chara_id": "001tom",
  "value": "neck_question"
}
```

- `idol_neckanimation_stop` 现在注册为独立 handler。
- raw 参数按 `[chara_id, delay, ...]` 解析。
- `delay > 0` 时写入 `spine_neck_stop` timeline event。
- `delay = 0` 时写入一次性 `neck_anim_stop` state。
- 前端 `PixiStageManager.js` 新增 `playSpineNeckAnim()` / `stopSpineNeckAnim()`，使用独立 Track 3 播放/停止 neck 动作，不再覆盖 Track 0 的 body 动作。
- `SpineStage.vue` 会应用 `neck_anim` / `neck_anim_stop`。
- `StoryViewer.vue` 的 timeline 会在对白中途触发 neck 播放/停止。

验收样本：

```text
001tom_308_2_3_001_08_00
step 3 timeline:
  1.5s spine_neck_anim neck_question
  4.0s spine_neck_stop
  4.0s spine_anim hello
```

全量重编译后统计：

| 指标 | 数量 |
| --- | ---: |
| `spine_neck_anim` timeline events | 3833 |
| `spine_neck_stop` timeline events | 896 |
| 带 `neck_anim` state 的 steps | 11819 |
| 带 `neck_anim_stop` state 的 steps | 793 |

这一步解决的是 neck/head 动作与 body 动作抢同一轨道的问题。后续多人同屏连续对白时，未说话角色的 body idle/pose 更不容易被 neck 动作误重置。

### 追加：`idol_nobackanimation`

已接入官方“不回 idle/loop”的动作语义：

- 编译器现在注册 `idol_nobackanimation`。
- raw 参数按 `[chara_id, delay, anim_name, ...]` 解析。
- `delay > 0` 时写入带 `no_back` 标志的 timeline：

```json
{
  "time": 7.8,
  "type": "spine_anim",
  "chara_id": "010pie",
  "value": "joy",
  "no_back": true
}
```

- `delay = 0` 时写入 spine state：

```json
{
  "anim": "joy",
  "anim_no_back": true
}
```

- 普通 `idol_animation` 会清除 `anim_no_back`，避免 no-back 标志残留到后续普通动作。
- 前端 `playSpineAnim()` 新增 no-back 参数。no-back 动作只播放目标动作，不自动追加 `{anim}_loop` 或 `wait_loop`。
- timeline 中带 `no_back` 的 `spine_anim` 会直接调用 no-back 播放路径。

验收样本：

```text
010pie_202_2_2_010_02_00
step 2 timeline:
  7.8s spine_anim joy, no_back=true
```

全量重编译后统计：

| 指标 | 数量 |
| --- | ---: |
| no-back timeline events | 164 |
| 带 `anim_no_back` state 的 steps | 1329 |

验证：

- 编译器语法检查通过。
- 全量 `--compile-only` 通过，3398 个 scenario 已重新输出。
- 临时 smoke 构建通过：524 个前端模块转换成功。
### 追加：`idol_parts_on/off` / `image_icon`

本批次补上两类此前缺失或被 no-op 跳过的 Text Asset 命令。

`idol_parts_on/off`：
- 编译器现在注册 `idol_parts_on` / `idol_parts_off`。
- 状态写入角色 spine state：`parts_visible: true/false`。
- 若命令早于 `idol_model`，会暂存到 `_pending_parts_visible`，模型出现后自动套用。
- 前端 `SpineStage.vue` 每次应用 step 都会调用 `setSpinePartsVisible()`；未声明时按默认显示处理，避免从隐藏状态往回退时残留。
- `PixiStageManager.js` 在 Spine `state.apply()` 后按 slot/attachment 名称推断可选部件并覆盖透明度。当前只匹配配件类名称，如 `glasses`、`beard`、`badge`、`cat`、`chain`、`necklace`、`bracelet`、`_acc` 等，并显式排除 `mouth`、`tooth`、`tongue`、`lip`、`eye`、`face`、`blush`、`sweat` 等核心表情/嘴部部件。

`image_icon` / `image_Icon`：
- 编译器现在不再跳过，写入 `state.image_icon`：
```json
{
  "id": "mob",
  "display_id": "mob",
  "layer": ""
}
```
- 前端新增 `getCharaIconUrl()`，读取 `/assets/idols/icons/image_chara_icon_{id}.png`。
- `SpineStage.vue` 会在舞台左上角显示场景图标；若资源不存在，图片会自动隐藏。

抽样验证：
```text
1_1_002dra_01 / scenario_1_1_002_01_f.json
  parts_visible: 004ter = true

1_4_001_09 / scenario_1_4_001_09_j.json
  parts_visible: 025suz false -> true -> false

1_1_001jup_01 / scenario_1_1_001_01_i.json
  image_icon: mob
  parts_visible: 002sht = false
```

验证：
- `scenario_compiler.py` 语法检查通过。
- 临时 smoke Vite 构建通过，524 个模块成功转换。
- 完整 `npm run build` 本次仍因仓库大资源构建超时，实际源码验证改用 `publicDir:false` 的 smoke 构建。
补充全量重编译验证：
- 已运行 `batch_compile.py --compile-only`。
- 重新输出 3398 个 compiled scenario。
- compiled 产物统计：
  - `parts_visible`：487 steps / 20 files。
  - `image_icon`：5431 steps / 33 files。
