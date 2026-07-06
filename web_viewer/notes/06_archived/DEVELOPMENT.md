# SideM Story Viewer 开发总览

最后更新：2026-06-30

本文是当前项目入口文档，只保留正在使用的架构、数据链路、运行方式和调试约定。历史试错和错误结论已经移到 `PITFALLS_AND_DEBUGGING.md`，专题实现细节见各专项文档。

## 项目目标

SideM Story Viewer 用 Web 前端还原游戏内 ADV 剧情演出：

- 从原始 `scenariodata`、`text asset`、`lipsyncdata`、Spine 资源编译出可播放的剧情步骤。
- 前端用 Vue + PixiJS 渲染背景、角色、镜头、转场、文本框、语音、环境音、SE 和唇形。
- 尽量贴近官方演出状态机，而不是用前端猜测补动画。

## 常用路径

```text
E:\Web_build\SideM_Archived\data_pipeline\scenario_compiler.py
E:\Web_build\SideM_Archived\data_pipeline\batch_compile.py
E:\Web_build\SideM_Archived\web_viewer
E:\Web_build\SideM_Archived\web_viewer\public\data\compiled
E:\BaiduNetdiskDownload\SideM\scripts\scenariodata
E:\BaiduNetdiskDownload\SideM\scripts\lipsyncdata\adxlip
E:\BaiduNetdiskDownload\SideM\scripts
```

## 运行与编译

前端开发：

```powershell
npm run dev -- --host 127.0.0.1
```

全量编译剧情数据：

```powershell
python E:\Web_build\SideM_Archived\data_pipeline\batch_compile.py --compile-only
```

快速检查前端打包时，注意 `public/assets` 很大。若只验证代码构建，可临时使用禁用 `publicDir` 的 smoke config，避免把全量资源复制进 `dist`。

## 当前数据链路

```text
raw scenariodata / text asset / lipsyncdata
        ↓
scenario_compiler.py
        ↓
public/data/compiled/{scenario_id}.json
        ↓
StoryViewer.vue
        ↓
SpineStage.vue / PixiStageManager.js / AudioManager.js / ADV UI
```

关键职责：

- `scenario_compiler.py`：ADV 状态机核心。解析 raw 命令，维护背景、角色、镜头、文本、声音、特效和唇形状态，并输出 step。
- `batch_compile.py`：批量编译所有剧情，负责分组、索引和编译结果落盘。
- `StoryViewer.vue`：播放控制、步进、自动前进、语音、时间线和当前 step 分发。
- `SpineStage.vue`：把 compiled state 转成 Pixi 舞台所需的角色、背景、镜头和过渡参数。
- `PixiStageManager.js`：Pixi 渲染管理，负责背景、Spine、遮罩、滤镜、镜头、过渡和部分调试能力。
- `AudioManager.js`：BGM、语音、SE、环境音播放与音量状态。
- `AssetResolver.js`：统一解析背景、Spine、语音、SE、text asset 等资源 URL。

## Step 类型约定

常见 step：

- `adv` / `text`：普通 ADV 对话。
- `talk` / `call`：短信、电话等特殊 UI。
- `stage`：无文本框的演出步，用于脚步、角色出现、镜头运动、纯视觉演出。
- `text_disable`：文本框消失的视觉过渡步，常用于心声切入/切出。
- `fadeout` / `fadein` / `fadecolor`：屏幕转场。
- `text_time` / `title` / `synopsis`：时间、标题、梗概类 UI。
- `choice`：选项。

重要原则：

- 角色是否在场由 `state.spines[]` 决定，不能只看当前说话人。
- `idol_model` 是准备模型，不等于出场。
- `idol_fadein` / `idol_fadeout` 只改变可见性，不等于删除角色。
- `idol_delete` 才是真正移除角色状态。
- `text_disable` 是独立演出步，不是挂在下一句台词上的 flag。
- 镜头和滤镜的 raw duration 需要保留，不能全部压成硬切。

## 当前已接入能力

- 角色多人物同屏状态保持。
- `idol_priority` 层级。
- `idol_position` / `idol_slide` / `idol_slidein` / `idol_slideout`。
- `idol_zoom` / `idol_zoom_reset`。
- `idol_color` 及心声场景的角色压暗/恢复。
- 背景切换、背景颜色叠加、背景景深/模糊。
- `camera_zoom` 与 `camera_resetzoom`，包含背景和角色同步缩放。
- `text_disable` 独立 step 以及文本框隐藏。
- `stage` 静默演出步。
- BGM、语音、环境音、SE 和多 SE 事件。
- 官方 `adxlip` 口型数据接入，替代旧音量驱动。

## 唇形系统

权威文档：`LIPSYNC_INTEGRATION.md`

当前方向：

- 优先使用官方 `E:\BaiduNetdiskDownload\SideM\scripts\lipsyncdata\adxlip`。
- 编译期把 voice 与 lip 数据关联进 step。
- 前端只消费编译后的官方曲线，不再用音量曲线猜开口。
- 牙齿、舌头、内口腔不能跟随嘴巴开口同幅度拉伸；这类问题优先排查 slot、attachment、bone 分类和 atlas/prefab 数据。

## ADV 状态机

权威文档：

- `ADV_STATE_MACHINE_NOTES.md`
- `TEXT_ASSET_STATE_MACHINE_AUDIT.md`
- `TEXT_ASSET_AUDIT.md`

当前重点：

- 保证无文本演出不被吞步，例如脚步声后角色出现、无对话动作、淡出，再进入下一句台词。
- 处理 `text_disable` 前后背景变暗、模糊、角色压暗的平滑过渡。
- 处理多人场景中心声角色正常显示，旁边角色与背景同步变暗。
- 继续审计 `camera_resetzoom`、`image_bg_view_type`、`effect_single`、`cameraflare` 等命令。

## Spine 坐标与镜头

权威文档：

- `SPINE_COORDINATE_ANIMATION_AUDIT.md`
- `Y_AXIS_EXPLORATION_LOG.md`

当前约定：

- 角色站位使用 scenario 坐标，不再用单角色手调。
- `idol_zoom` 是演出缩放，不是角色默认身高。
- Y 轴修正优先来自统一映射和 prefab/setting 数据，不从单个截图反推全局常数。
- 镜头缩放需要同时作用于背景和角色；只缩放角色会导致“人被拉出画框但背景不动”的假象。
- `camera_resetzoom` 必须支持 duration，官方常见“慢慢拉大、停顿、慢慢拉回”，不能硬切。

## 调试入口

常用方式：

- 浏览器控制台查看当前 step、state、spines。
- `showAnims("001tom")` 一类调试函数用于查看 Spine 动画和附件命中。
- 对照 `public/data/compiled/{scenario_id}.json` 确认编译结果是否真的更新。
- 遇到“刷新仍是旧表现”，先确认编译结果、开发服务、浏览器缓存三者是否都更新。

推荐核验样本：

- `1_1_013the_02_1_1_013_02`：无文本演出、脚步、双人出现、镜头拉近/拉远、心声切换。
- `1_1_015leg_04_1_1_015_04`：多人同屏、连续说话、非说话角色状态保持。
- `1_4_001_00` / `1_4_001_01`：官方 lip 命中、001tom/004ter/047shu 嘴部差异。

## 文档地图

- `DEVELOPMENT.md`：当前总览和入口。
- `PITFALLS_AND_DEBUGGING.md`：已踩坑、错误路线、排查顺序。
- `LIPSYNC_INTEGRATION.md`：唇形数据、命中率、编译和前端接入。
- `ADV_STATE_MACHINE_NOTES.md`：ADV 状态机实现过程和具体样本。
- `TEXT_ASSET_AUDIT.md`：text asset 资源类型、接入状态和待接入清单。
- `TEXT_ASSET_STATE_MACHINE_AUDIT.md`：text asset 与 ADV 状态机全量审计记录。
- `SPINE_COORDINATE_ANIMATION_AUDIT.md`：Spine 坐标、缩放、附件与动画资源链路。
- `Y_AXIS_EXPLORATION_LOG.md`：Y 轴定位探索过程和当前实现。
- `REFACTORING.md`：历史重构记录。
- `nextstep.md`：下一轮待办。

## 未决问题

- `cameraflare` 尚未找到可信的官方 shader/粒子组合，暂不建议用猜测光源替代。
- `image_bg_view_type`、`effect_single` 等 text asset 命令仍需继续做样本级验证。

## 最新闭环

- P0 唇部控制问题已解决。
- `1_1_013the_02_1_1_013_02` 开头无文本演出已补齐脚步声：raw `se` 第二参按 delay 解释，前端对 stage SE 做延迟调度，Vite/生产服务为缺失的脚步 cue 提供资源 alias。
- P1 `advbackground/json` 已接入编译期：compiled step 现在包含 `bg_profile`，并会在无显式剧情控制时补默认 ambience/BGM。
- P1 `idolmotionsetting` 已接入前端播放链路：动作播放优先使用官方 `poseAnimationName`，再降级到旧 `_loop` 推断。
