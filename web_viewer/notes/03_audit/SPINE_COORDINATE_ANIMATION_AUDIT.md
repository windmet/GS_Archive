# Spine 坐标、缩放与动画资源审计

最后更新：2026-06-30

本文记录 Spine 渲染相关的数据链路和当前实现。历史错误路线已移到 `PITFALLS_AND_DEBUGGING.md`。

## 审计范围

- ADV 角色模型加载。
- 角色站位、缩放、出入场和移动。
- 表情、动作、neck animation、mouth animation。
- 口腔、牙齿、舌头、嘴部附件层级。
- atlas、skel、prefab、motion setting 等资源关系。

## 当前数据入口

编译结果：

```text
E:\Web_build\SideM_Archived\web_viewer\public\data\compiled\{scenario_id}.json
```

原始资源：

```text
E:\BaiduNetdiskDownload\SideM\scripts\scenariodata
E:\BaiduNetdiskDownload\SideM\scripts\lipsyncdata\adxlip
E:\BaiduNetdiskDownload\SideM\scripts\idolfigure
E:\BaiduNetdiskDownload\SideM\scripts\idolothersetting
E:\BaiduNetdiskDownload\SideM\scripts\livecharacter
```

前端消费：

```text
src/components/SpineStage.vue
src/core/PixiStageManager.js
src/utils/AssetResolver.js
```

## 编译后 Spine state

典型字段：

```json
{
  "id": "004ter",
  "model": "004ter_105_00",
  "pos_x": 640,
  "pos_y": 0,
  "face": "face_default",
  "anim": "wait_loop",
  "neck_anim": null,
  "idol_zoom": null,
  "idol_color": null,
  "priority": 0,
  "visible": true
}
```

约定：

- `id` 是角色 ID。
- `model` 是具体 Spine 模型/服装目录。
- `pos_x / pos_y` 来自剧情命令。
- `idol_zoom` 是演出缩放，不是默认身高。
- `idol_color` 用于心声压暗、恢复等演出。
- `priority` 控制同屏层级。
- 编译器内部可以保留不可见角色，但输出给前端的 `state.spines[]` 应只包含当前可见角色。

## 出入场状态

- `idol_model`：准备或切换模型。
- `idol_position`：更新站位。
- `idol_face`：更新表情/表情附件。
- `idol_animation`：更新身体动作。
- `idol_neckanimation`：更新颈部或头部相关动作。
- `idol_fadein`：可见。
- `idol_fadeout`：不可见，但不删除状态。
- `idol_delete`：删除角色状态。

多人同屏时，非说话角色只要没有收到 fadeout/delete，就应继续留在画面里。连续几步只有一方说话时，另一方不应反复从 `wait_loop` 切动作，也不应被隐藏。

## 镜头与缩放

当前目标：

- `camera_zoom` 同时影响背景和角色。
- `camera_resetzoom` 支持 duration，不能硬切。
- `idol_zoom` 只作用于单个角色。
- 心声场景 0.8 缩放需要配合 Y 轴抬高，避免角色视觉下沉。

重点样本：

```text
1_1_013the_02_1_1_013_02
```

第 25、26、27 步应表现为：

1. 慢慢拉大。
2. 停顿。
3. 用同样节奏慢慢拉回。

## 嘴部与附件

当前已确认：

- 官方口型数据来自 `adxlip`，不是音量曲线。
- 不同模型的嘴部结构可能不同，不能只按固定 slot 名判断。
- 牙齿、舌头、内口腔正常应显示，但不应被嘴巴开口曲线同幅度拉伸到嘴外。
- atlas 可能有二进制或额外头部，`comu.atlas` 后才是正式声明。

重点异常样本：

```text
1_4_001_00
1_4_001_01
001tom
004ter
047shu
```

现象：

- `047shu` 嘴部表现较正常。
- `001tom`、`004ter` 仍可见上牙、内口腔随开口拉伸并穿出嘴部。

后续排查顺序：

1. 对比三者 atlas 中嘴、牙、舌、内口腔相关 attachment 命名。
2. 对比 skel 中这些 attachment 所属 slot/bone。
3. 确认前端 mouth opening 只作用到真正嘴部开口控制，不作用到牙齿/舌头/内口腔整体。
4. 如 prefab 中有 mask、pivot、scale 或裁剪信息，优先接入原始 prefab 约束。

## 动画资源

需要继续确认的资源：

- `idolmotionsetting`：动作名、loop、back animation 映射。
- Spine skeleton 动画列表：确认 `wait_loop`、表情、mouth、neck 动作真实存在。
- prefab：确认 Unity 侧是否存在 mask、RectTransform、localScale、pivot。

## 验证清单

- 普通对话：角色站位、表情、嘴部开合正常。
- 多人同屏：非说话角色不消失、不重复切 wait。
- 心声：背景、说话人、旁边角色同步变暗/恢复。
- 镜头：背景和角色同步缩放，reset 有 duration。
- 快速前进/后退：无旧 Spine、旧 tween、旧颜色残留。
