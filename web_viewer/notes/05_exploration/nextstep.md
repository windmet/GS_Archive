# 下一步工作清单

最后更新：2026-06-30

## 当前已闭环

- P0 唇部控制问题已解决：官方 `adxlip` 已接回，嘴部控制不再回退到旧音量驱动。
- `1_1_013the_02_1_1_013_02` 第 25、26、27 步：镜头慢慢拉大、停顿、慢慢拉回，`camera_resetzoom` 已不再硬切。
- `1_1_013the_02_1_1_013_02` 第 13-18、30-32、55-57 步：`text_disable` 心声切入/切出时，背景变暗/模糊和角色压暗同步过渡已解决。
- `1_1_015leg_04_1_1_015_04` 第 10 步：046chr 说话时 045sor 不再消失或虚空讲话。
- `1_1_013the_02_1_1_013_02` 开头无文本演出：039mcr/038tak 出现、动作、淡出流程正常；当前 Y 轴基线已整体上调 150。
- `1_1_013the_02_1_1_013_02` 开头脚步声关联已修复：`se` 第二参按 delay 处理，stage step 会播放 SE；缺失的 sneaker/boot cue 通过音频 middleware alias 命中实际资源。

## P1：Text asset 资源接入

- 抽样解析 prefab，优先找 mask、pivot、localScale、localPosition。
- 继续追踪 `image_bg_view_type`、`effect_single`、`effect_bgstart`、`effect_bgend`。

## P1 已推进

- `advbackground/json` 已接入编译器：输出 `bg_profile`，并在没有显式剧情控制时补默认 ambience/BGM。
- 默认音频 cue 会先检查本地 `GS_Res/Audio` 是否存在，过滤 `-`、`no_bgm` 和错栏 cue，避免新增 404。
- 已全量重新编译 `public/data/compiled`。
- `idolmotionsetting` 已接入前端：生成 `public/data/idolsetting/motion/idol_motion_index.json`，播放动作时优先使用官方 `poseAnimationName`，没有映射时才回退到旧 `_loop` 规则。
- `backAnimationName` 已保留在索引中，后续需要结合样本确认是否要实现“离开 pose 时先播 back”的更完整状态机。

## P1：渲染状态清理回归

- 把已修复的 `camera_resetzoom`、`text_disable`、多人同屏保留加入回归样本。
- 快速前进/后退时继续观察旧 tween 是否取消干净。
- 新增状态字段时同步确认持久/one-shot 边界。

## 暂缓

- `cameraflare`：目前没有找到可信 shader/粒子数据，不做猜测实现。
- 全局重调 Y 常数：当前开头无文本演出的 Y 轴已基线上调 150；除非发现新的官方 transform 数据，否则不再用截图反推大范围常数。
