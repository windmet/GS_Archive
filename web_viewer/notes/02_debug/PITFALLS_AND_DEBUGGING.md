# 排坑与调试索引

最后更新：2026-06-30

本文集中记录已经踩过的坑、错误路线和推荐排查顺序。其他文档只保留实现过程、资源和当前结论。

## 使用原则

- 先确认 compiled JSON 是否真的变化，再判断前端是否有 bug。
- 先看 raw 命令顺序，再看状态机输出 step。
- 先分清持久状态和 one-shot 状态，再决定什么时候清除。
- 先找官方 text asset / prefab / atlas / skel 证据，再调前端常数。

## 数据与编译

### 刷新后仍是旧表现

常见原因：

- 只改了编译器，没重新批量编译。
- 编译结果写到了另一份目录。
- 开发服务没有重启或浏览器缓存未刷新。
- 前端仍消费旧字段或旧 fallback。

推荐顺序：

1. 打开 `public/data/compiled/{scenario_id}.json`，确认目标 step 字段已变化。
2. 确认前端请求的正是这份 JSON。
3. 重启开发服务。
4. 再排查 Vue/Pixi 渲染逻辑。

### 命中率提升但前端表现没变

说明“数据命中”和“渲染消费”不是同一层问题。唇形、镜头、text_disable 都出现过这种情况。必须同时检查：

- 编译器是否写出新字段。
- 前端是否读取新字段。
- 旧 fallback 是否仍在覆盖新字段。

## ADV 状态机

### `text_disable` 不是下一句台词的 flag

错误理解：

- 把 `text_disable` 存成状态，等下一句台词再消费。

正确理解：

- `text_disable` 是独立演出 step。它负责文本框消失、背景变暗/模糊、角色压暗或恢复等过渡。

风险：

- 如果过早 emit，会丢掉同一段后续视觉命令。
- 如果过度贪婪收集，会吞掉 fadein、camera reset、角色恢复等下一段状态。

### 无文本演出不能被吞

样本：

```text
1_1_013the_02_1_1_013_02
```

官方在第一句 040ren 前有脚步声、039mcr/038tak 出现、无对话动作和淡出。若编译结果第一步就是 040ren 台词，说明状态机缺 step。

2026-06-30 复核状态：人物 Y 轴基线已上调 150，039mcr/038tak 的出现、动作、淡出流程已经正常。剩余风险是脚步声没有关联到该无文本 stage step，后续应优先检查 SE 是否只绑定在 dialogue step。

2026-06-30 修复状态：脚步声关联已解决。根因不是 stage step 缺失，而是 raw `se` 第二参被误写成 `volume`；它实际应作为 delay 使用。同时部分 raw cue 没有同名音频文件，需要在音频 middleware 中把 `step_*_conc_sneaker` alias 到 `group_step_*_conc_sneaker`，把缺失的 boot cue alias 到现有 boot 音频。

### 多人同屏角色不能按说话人重建

样本：

```text
1_1_015leg_04_1_1_015_04
```

045sor 连续说话时，046chr 动作不变；046chr 说话时，045sor 不应消失。角色是否显示应由 fadein/fadeout/delete 决定，不由当前 speaker 决定。

2026-06-30 复核状态：`1_1_015leg_04_1_1_015_04` 第 10 步已解决，046chr 说话时 045sor 不再消失或虚空讲话。后续作为多人同屏状态保持回归样本。

### `idol_fadeout` 不是 `idol_delete`

错误路线：

- fadeout 后直接删掉角色。

后果：

- 角色下一步需要继续保留状态时会消失。
- 往回退时也可能缺角色。

正确路线：

- fadeout 只设不可见。
- delete 才删除状态。
- 编译器内部可以保留隐藏角色，输出给前端时只输出可见角色。

### 状态清理不干净

已见风险：

- 心声变暗后回到普通对话，角色颜色没恢复。
- 背景 overlay、blur、color 残留。
- screen fade 或 slide 泄漏到下一步。
- camera zoom/reset 只清前端或只清编译端。

排查方式：

- 对每个字段标注是持久状态还是 one-shot。
- one-shot 在 emit 后清除。
- 持久状态必须有明确 raw 命令恢复或删除。

## 镜头与背景

### `camera_zoom` 不能只缩放角色

只缩放角色会出现“人物被拉出画框，但背景不动”的假效果。官方镜头应同时影响背景和角色。

### `camera_resetzoom` 不能硬切

样本：

```text
1_1_013the_02_1_1_013_02 第 25、26、27 步
```

官方表现是慢慢拉大、停顿、慢慢拉回。reset 命令里的 duration 必须进入前端 tween。

2026-06-30 复核状态：`1_1_013the_02_1_1_013_02` 第 25、26、27 步已解决。

### 心声变暗不要用单个猜测遮罩糊过去

多人心声场景里，背景、说话人、旁边角色可能有不同但同步的 raw transition。优先保留各自字段和 duration，再考虑前端统一调度时间轴。

2026-06-30 复核状态：同话第 13-18、30-32、55-57 步的 `text_disable` 心声切入/切出同步过渡已解决，后续作为回归样本保留。

## Y 轴与缩放

### `idol_zoom` 不是默认身高

它是剧情演出缩放。不能按出现频率反推角色默认比例。

### `idolothersetting.positionY` 不能直接当屏幕脚底线

它更像骨架/UI 原点参考。直接映射会造成不同模型漂移。

### 不要从单张截图反推全局 Y 常数

截图可能处在镜头缩放、角色缩放、心声缩放、slide tween、背景 view type 的叠加状态。应先还原 raw 状态，再判断 Y 轴。

### 心声 0.8 缩放需要补偿 Y

角色缩小时视觉底线会上移或下沉，需要按当前实现分层补偿，而不是改全局坐标。

## 唇形与嘴部

### 不要回退到音量驱动

旧音量曲线会让所有角色嘴型看起来有动，但会破坏官方口型命中。当前应以 `adxlip` 为权威。

2026-06-30 复核状态：P0 唇部控制问题已解决，后续将官方 lip 作为回归项保留。

### 口型命中不等于嘴部结构正确

`001tom`、`004ter` 的问题不是简单“没有口型数据”。它们能命中数据，但牙齿、内口腔随开口拉伸穿出嘴部，说明还要排查 slot、attachment、bone、mask、prefab。

### 牙齿、舌头、内口腔不能跟嘴巴同幅度拉伸

闭嘴贴图是一条线，张嘴时是挖空的洞。牙齿和内口腔应正常显示，但不能被当成嘴唇开口控制目标整体缩放。

### atlas 有额外头部

部分 atlas 用文本编辑器打开时，前面可能有 `comu.atlas` 和额外字节/头部，正式声明在后面。解析时不能只读文件开头几行就下结论。

## 前端渲染

### 快速前进/后退要取消旧 tween

否则会出现：

- 旧角色残留。
- 角色突然消失。
- 旧镜头继续跑。
- 颜色或 blur 从上一状态插值回来。

### 不要让旧 fallback 覆盖新官方数据

常见于：

- 唇形官方曲线命中后，音量 fallback 仍在写 mouthScale。
- motion setting 接入后，旧 `_loop` 拼接仍覆盖官方动作。
- camera reset 有 duration，但前端旧逻辑直接设默认值。

## 特效

### `cameraflare` 暂不猜

目前没有找到可信 shader/粒子资源。早期用简单光源组合的方向不可靠，容易做出“看似有光但不官方”的效果。继续追 text asset、prefab、shader、particle 引用后再实现。

## 推荐排查模板

遇到新问题时按这个顺序写记录：

```text
scenario_id:
官方表现:
当前表现:
涉及 step:
raw 命令片段:
compiled step 字段:
前端消费位置:
判断:
下一步:
```

这样可以避免在“数据没编译、编译没输出、前端没消费、渲染消费错”之间来回绕。
## `screen_fadein/out` 的第一个参数不是黑白模式

样本：`1_1_015leg_04_1_1_015_04` 第 72-78 步。

raw 片段：
```text
screen_fadein  ['0', '1', ...]
image_bg       ['bg001_315pro_in_01', ...]
screen_fadeout ['1', '1', ...]
```

错误路线：
- 把第一个参数 `0/1` 当成黑白模式。
- 把 `screen_fadeout ['1','1']` 编成 `#FFFFFF`，导致黑一下后白渐变到下一场景。

正确路线：
- 第一个参数是 delay。
- 第二个参数是 duration。
- 第三个参数才是显式颜色。
- 缺省颜色应为 `#000000`。
- `screen_fadein` 表示画面压到遮罩，前端状态为 `{ type: "out" }`。
- `screen_fadeout` 表示从遮罩回到画面，前端状态为 `{ type: "in" }`。

修正后该样本第 74-75 步应为：
```text
step 74 fadein  screen_fade = { type: out, color: #000000, delay: 0, duration: 1 }
step 75 fadeout screen_fade = { type: in,  color: #000000, delay: 1, duration: 1 }
```

## 场景滤镜不要等同于心声模糊

样本：`1_1_015leg_04_1_1_015_04` 第 88 步附近的 `sepia_light`、第 148 步附近的 `gray`。

raw 的 `camera_color` 主要是舞台/回忆/存档色调，不应默认叠加强背景模糊。心声切入/切出仍由 `image_bg_color + image_bg_dof` 表现，前端只在 `bg_color != #FFFFFF` 时保留 `bg_dof` 模糊，避免误伤心声。

滤镜强度也要保留服装可辨识度：
- `sepia_light`：偏暖、略压蓝，不要全褪成黄灰。
- `gray`：降低饱和但保留部分颜色，不要调用全黑白矩阵。

## 相机缩小不能让背景露黑框

样本：`1_1_015leg_04_1_1_015_04` 第 161-166 步。

`camera_zoom=0.9` 会让角色按官方构图缩小，但背景如果同步缩到 0.9 会露出一圈黑边。当前前端约定：
- 角色层按 raw camera zoom 缩放。
- 背景层只在 `zoom >= 1` 时跟随 zoom。
- `zoom < 1` 时背景保持 cover 铺满，避免黑框。

## 回退不能只依赖历史栈手速

自动推进的 `fadein/fadeout/text_disable/stage` 可能不会都进入历史栈。回退时如果栈顶或当前前一位是 transition step，需要继续向前扫到最近的普通剧情步，否则会出现“必须趁过场瞬间狂点才退得回去”的手感问题。

`stage` 只要 `auto_advance !== false`，也应视为过渡步。否则回退会落到自动 stage 上，然后被定时器再次推进回下一句对白，例如 `1_1_015leg_04_1_1_015_04` 的 EP08 -> EP09 过场，回退会从新话第一句弹回新话第一句，而不是回到上一话最后一句有语音文字的对白。

## `text_disable` 后的 `cut_end` 不能继续吞下一段演出

样本：`1_1_015leg_04_1_1_015_04` 中 046chr 单人发言后，进入 046chr / 045sor / 044ame 三人同屏，再三人同时下移坐下。

raw 结构：
```text
text_disable
idol_fadeout 046chr
cut_end
camera_zoom 0.9
idol_position 三人 y=0
idol_fadein 三人
cut_end
idol_slide 三人 y=-60
wait 2
text
```

错误路线：
- pending `text_disable` 遇到第一个 `cut_end` 时直接 return。
- 后续 `idol_position y=0`、`idol_fadein`、`idol_slide y=-60` 被继续吞进同一个 `text_disable` snapshot。
- 前端看到的第一帧已经是 y=-60 终点，丢失“三人出现后再下移”的中间状态。

正确路线：
- pending `text_disable` 期间，如果 `cut_end` 到来且已经有舞台演出，就先 flush `text_disable`。
- 后续 `cut_end` 再把三人 y=0 出现态 emit 成独立 `stage`。
- `idol_slide` 留到下一段 `stage`，由前端按 `slide_duration` 播放下移。
