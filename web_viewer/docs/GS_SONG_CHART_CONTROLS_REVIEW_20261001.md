# 谱面菜单二次审阅与配速 30（2026-10-01）

输入代码 `935cabfe`，同窗后续首页提交 `3932a22f` 保留。谱面代码验收版本 `e9e259f65453c177925ec0a0f715ed3325b3acf2`。本记录更新 [播放与分栏记录](GS_SONG_CHART_PLAYER_LAYOUT_20261001.md) 的菜单与配速部分，不变更源谱面、歌曲数据或原生贴图映射。

外部审阅作为设计参考；按用户本轮补充明确删除可见区间和首个音符按钮。审阅中的示例等级／音符数量不用于本地数据。默认仍为透视轨道，视觉配速默认 10。

## 实施与取舍

| 审阅项 | 本地实现 | 验收边界 |
| --- | --- | --- |
| 统一顶栏 | 难度为单行标签，外部控件／分段组统一 36px 高、6px 圆角 | 分段组内部按钮 32px；手机顶栏保留 44px 点击面积 |
| 设置不推动画布 | 固定浮层跟随设置按钮定位，Teleport 到 body，窄屏限宽／限高 | 下方放不下且上方更宽裕时向上展开；必要时内部滚动；锚点移出视口则关闭 |
| 浮层交互 | 打开聚焦首个选项，Escape／关闭按钮收起并归还焦点；外部点击收起 | 外部点击不抢回焦点；可继续操作背景画布，不做模态焦点锁定 |
| 统计信息 | 透视画布左上角显示难度与最大 Combo；对象数及计数说明移入谱面信息 | 长轨用画布内部窄条，避免压住分栏时间标签或音符；信息放在播控后方 |
| 播控主次 | 主色播放键、图标首尾／步进、分组定位与下一长条 | 开头仍为 0 秒，末尾含音频尾奏；用户明确删除首个音符按钮 |
| 精确位置 | tick 平时为轻量文本，点击才进入小型输入 | Enter 确认，Escape 取消并归还焦点；失焦提交；保持时间轴直接拖动 |
| 视觉配速 | 上限由 20 扩到 30，步进 0.1，保留 `span=round(24000/speed)` | 1–20 的映射不变；20 为 1200、30 为 800 tick；旧可见区间选项及状态已删除 |

视觉配速只影响透视视野长度，调节不跳位置、不修改音频速度。实际播放速度仍在设置中单独控制。1–30 是相对刻度，未宣称对应游戏原版配速公式。

## 验收

Browser 插件／browser 技能不在本轮可用列表，按前端验收技能使用现有 bundled Playwright Chromium，未安装依赖。生产代码 QA 为 `E:/Web_build/GS_Archive_Domain_Work/song-attribute-qa-20261001/web_viewer` 的固定 `.analysis/build-check`，`copyPublicDir:false`，5200 服务挂载既有资源及 readmodel，release 仍为 `17e0ab0b227d6f2bb433f0c1cfaf3934fcccbc2cd420387adc95af9fc4c7a907`。

| 项目 | 结果 |
| --- | --- |
| 页面身份、非空、无构建覆盖错误、控制台与 HTTP | K.now O.nly 正确；正常交互零错误／警告、零 HTTP 失败 |
| 桌面 1440×1050 | 紧凑顶栏、Combo HUD、弱化 tick、主播放键、长轨分栏；已查看截图 |
| 设置浮层 | 桌面／390px 开关前后画布位置／高度不变；Escape、外部点击、关闭焦点正确 |
| 手机 390×844 与 320×740 | 无页面横向溢出，浮层在视口内；390px 向上展开后保留下方轨道；播控点击目标 ≥44px |
| 配速／定位 | 同一 123406 tick 下配速 1／8／20／30 可见头尾数 53／13／3／1；滑杆 25.5、越界 31 归到 30；位置和音频 playbackRate 不变 |
| 真音频 | 媒体时钟驱动 tick、播放／暂停、0.5× 速度、切视图继续播放；时间轴、快捷键首尾／步进可用 |
| 保留功能 | 315 贴图、SVG 实际下载并嵌入原 PNG、桌面分栏、手机单栏、栏内点击定位通过 |
| 异常恢复 | 谱面 502／SHA 拒绝与重试、延迟旧难度取消、音频失败恢复播放通过 |
| 音频互斥 | 完整混音播放器与谱面双向互斥；DRIVE A LIVE 的组合单轨、中心声部＋伴奏、五槽编成均通过 |

专项脚本 `verify-song-note-rendering.mjs`、`verify-song-track-presentation.mjs`、`verify-song-chart-presentation.mjs`、`verify-song-chart-timing.mjs` 通过，覆盖 244 档原数据。源码 `npm run build:check` 与 QA `verify:build-audit` progress 通过，初始 JS gzip 127,358 字节，无禁止初始模块／生产 legacy 模块；沿用两项既有背景路径警告。初次构建发现错误图标包名，已修正为仓库现有 `@lucide/vue` 并重新编译，未增加依赖。

`verify:cutover-routes` progress 保留全局 partial、设备 pending。未复制媒体语料或生成完整发布包；未更改另一窗口的首页／启动文件。旧通用检查的失败边界沿用上一批记录，不列为通过项。

证据目录 `E:/Web_build/GS_Archive_Domain_Work/song-attribute-browser-20261001`：

- `verify-chart-controls.mjs`、`chart-controls-browser-receipt.json`、`verify-chart-controls-recovery.mjs`、`chart-controls-recovery-receipt.json`。
- `verify-chart-experimental-handoff.mjs`、`chart-experimental-handoff-receipt.json`。
- `chart-controls-perspective-desktop.png`、`chart-controls-settings-desktop.png`、`chart-controls-columns-desktop.png`。
- `chart-controls-perspective-mobile.png`、`chart-controls-settings-mobile.png`、`chart-controls-settings-320.png`、`chart-controls-transport-mobile.png`。
- `chart-controls-columns.svg`、`chart-controls-build.log`。

本次只覆盖本地 Chromium 桌面与模拟窄屏。原版相机／配速公式、长条运行时中途判定生成、完整录像逐帧对齐和物理设备验收仍未完成；沿用此前事实边界。
