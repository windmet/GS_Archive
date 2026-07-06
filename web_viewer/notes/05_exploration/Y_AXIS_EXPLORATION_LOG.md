# Y 轴定位探索日志

最后更新：2026-06-30

本文只保留 Y 轴定位的实现过程、资源来源和当前结论。踩坑和错误路线已集中到 `PITFALLS_AND_DEBUGGING.md`。

## 目标

让 ADV 站绘在不同角色、不同服装、不同多人场景中保持接近官方的位置：

- 脚底或视觉底线稳定。
- 多人同屏时不互相漂移。
- `idol_zoom`、心声 0.8 缩放、镜头缩放叠加后仍能维持合理位置。
- 快速前进/后退不残留上一帧角色位置。

## 已确认的数据来源

```text
E:\BaiduNetdiskDownload\SideM\scripts\scenariodata
E:\BaiduNetdiskDownload\SideM\scripts\idolothersetting
E:\BaiduNetdiskDownload\SideM\scripts\idolfigure
E:\Web_build\SideM_Archived\web_viewer\public\data\compiled
```

相关字段：

- `idol_position`：剧情站位，提供 `pos_x / pos_y`。
- `idol_slide` / `idol_slidein` / `idol_slideout`：移动目标和 duration。
- `idol_zoom` / `idol_zoom_reset`：演出缩放。
- `camera_zoom` / `camera_resetzoom`：镜头缩放和偏移。
- `idolothersetting.positionY`：可作为骨架/UI 原点参考，但不能直接当最终屏幕坐标。

## 当前实现原则

- 编译器保留 raw 的 `pos_x / pos_y / zoom / duration`，不在编译期做面向截图的魔法修正。
- 前端统一处理 Spine 模型的坐标映射、舞台缩放和镜头叠加。
- 角色自身缩放、镜头缩放、心声压暗缩放分层处理，避免把所有修正混进一个 y 常数。
- 切 step 时取消旧 tween，避免快速翻页时残留旧位置或旧缩放。

## 当前表现

已改善：

- 多人同屏的基础站位。
- 角色快速切换后的残留。
- 镜头拉大时背景和角色同步。
- 心声压暗 + 0.8 缩放场景中，通过额外抬高 Y 轴缓解人物下沉。

仍需继续验证：

- `1_1_013the_02_1_1_013_02` 第 25、26、27 步的镜头拉大、停顿、拉回。
- 心声切入/切出时，背景变暗、模糊、角色压暗是否同步。
- 同一角色不同 costume/prefab 的视觉底线差异。

## 验证样本

```text
1_1_013the_02_1_1_013_02
1_1_015leg_04_1_1_015_04
1_4_001_00
1_4_001_01
```

验证时优先对照官方视频，不只看单张截图。镜头运动、停顿和状态恢复都要看完整前后 step。

## 与其他文档的关系

- 状态机和 step 缺失问题见 `ADV_STATE_MACHINE_NOTES.md`。
- Spine 资源、骨架、缩放、附件问题见 `SPINE_COORDINATE_ANIMATION_AUDIT.md`。
- 错误尝试和排查顺序见 `PITFALLS_AND_DEBUGGING.md`。
