# R1：按节阅读的首批交付

日期：2026-09-09；实施基线 `841cc79`，承接
[Reader / Player 下一阶段计划](READER_PLAYER_NEXT_PHASE_20260909.md)。

## 当前行为

- 正文使用最大 1000px 的白色卡片区域，台词、旁白/场景说明、选项保留各自样式和全部行锚点。
- 普通正文撤下“从这里演出”和“记住此处”；顶部唯一“播放完整剧情（实验）”。
- 分段选择收进折叠区域。搜索默认关闭；展开聚焦输入，关闭或输入中按 Esc 后清空匹配并返回查找按钮焦点，保留 reading_row。
- Reader 不再读写 ReadingProgressStore，也不删除用户原 localStorage。旧 store 和独立兼容性测试暂留，当前生产组件已无引用。
- 全篇播放使用 source.file 和 step_count，起点是数组位置 0，包含开场；reading_row 只保存返回位置。旧逐行深链仍按其 target 校验。
- v1 URL 的 at_step=1 表示完整开场播放；恢复时仍严格校验 scenario/start/end、阅读版本、来源 SHA 和总步数。未增加路由字段或修改已发布产物。
- 不新增预载调用；媒体仍只在触发演出后经唯一 playback controller 载入。此项经代码路径核对，未另做网络请求计数。

## 验收

实际页面：`http://localhost:5175/?view=reader&reading=1_4_001_01_d`，同一工作区 Vite；Browser 插件，无备用浏览器。

| 检查 | 结果 |
| --- | --- |
| 页面身份/正文 | 正确标题与 Episode 4，全部原行锚点保留 |
| 桌面 1280、移动 390/320 | 截图检查，页面及 Reader 无水平溢出，查找按钮窄屏换行 |
| 查找“天才”→下一处→关闭 | 定位 step-24，匹配高亮清除，锚点保留，焦点回到查找按钮 |
| 输入中 Esc | 搜索关闭，焦点返回；原文/双语切换保留锚点 |
| 全篇播放→返回 | URL at_step=1、range=1..48；实际进入第一段台词 6/48；返回仍选中并聚焦 step-24 |
| 控制台 | 无 error；进入 Player 后有既存 Pixi Spine update/tint 弃用警告 |
| 初次页面空白 | 开发页首次未挂载，无 console error；重新导航后恢复并完成上述交互，未对其根因作结论 |
| 自动校验 | verify:reading 全套、verify:archive-async-navigation、本地 source playback 校验通过 |
| 构建 | source-only Vite 构建通过；主包 524.17 kB，既有 500 kB 阈值警告仍在 |

新增测试覆盖全篇起点、来源损坏拒绝、带返回行的全篇 URL 恢复与往返；SSR 验证唯一整篇动作、默认折叠搜索及全量行锚点。

本批未改 unknown 头像策略、ReadingDocument v2、资源计划/缓存/缓冲，未完成正式长稳或发布验收。
接下来按 R2 的三层身份模型准备投影与正反例，再结合 R3 完成产物迁移；不把 unknown 改为 named。
