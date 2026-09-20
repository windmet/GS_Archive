# UI 产品化审计执行记录（2026-09-20）

输入：用户提供的黑盒 UI-01～UI-09 与结合代码的审计；以本地 `codex/runtime-audit-closeout` / `6f67d21` 为基线。报告是参考，实际改动按代码职责归并。沿用电话视觉回退后的组件，本批没有电话样式改动。

## 执行分组

| 审计 | 本次处理 | 边界与理由 |
| --- | --- | --- |
| UI-01、03、07 | 舞台高级参数、来源动作统计、VFX 覆盖默认折叠；歌曲播放器提前、制作信息后移；卡面资源收录状态进入资料来源；个人故事/工作统计置于内容之后的折叠区；首页不显示 cue 编号 | 保留来源证据、真实可用性、声部混音限制及实验标签，不删除信息掩盖不完整实现。舞台播放错误仍在折叠区外显示。 |
| UI-04、05 | 新建纯展示 ArchiveMediaTransport，由三种歌曲播放器继续拥有时钟；卡片 ArchiveVoiceRow 点击才设置 src，未知时长显示待播放；错误可重试，切源/卸载释放媒体 | 未整合剧情、电话、舞台的运行时音频引擎，避免破坏暂停、回看和资源所有权。 |
| UI-02 | pendingEntry 记录异步准备阶段的返回目的地；取消使 navigation intent 失效、停止预载、清空播放器；LoadingScreen 显示 critical 预载完成/总数；原始错误放入详情 | 统计排除 excluded/deferred，只表示资源预载，全部完成仍提示画面与语音准备，不能当作 renderer ready。Reader 保留已有正文与返回行为。 |
| UI-06 | 当前触及界面使用组合、中心偶像、工作短剧情、回到开头；歌曲说明对应新的组合选项 | 渐进词表：组合对应 Unit，中心偶像对应 Center，舞台小人对应 Chibi；仅用户文案逐步采用，RAW 字段、资源 ID、实验室技术术语不全站替换。 |
| UI-09 | 语言选择旁明确已选择模式及当前原文回退；失败可重试，invalidate 后重新请求；并发代际检查阻止旧结果覆盖新篇 | 保留请求语言偏好，不因一次失败强制切换原文。没有生成或保证缺失的译文。 |
| UI-08 | 核查源码并复现同一三人场景的 390×844 / 1280×800 差异；本批不改坐标 | 需独立坐标合同和真实演出参考，见下节。 |

## UI-08 的本地证据与暂缓理由

- 样本：`1_3_30018_01.json`（GROWING SELECTION -運命光年-），`at_step=9`，UI 进度 8/287，翔太说话。Browser 中手机三人明显交叠，桌面三人分立，报告成立。
- `src/core/StoryStageFraming.js` 以高度 / 720 建立缩放；390×844 虚拟宽约 333。
- `src/core/SpineManager.js` 的游戏 X/Y 位移乘虚拟宽 / 1280；人物另有 `STORY_PORTRAIT_SCALE = 1.25`。窄屏位置间距缩小，但人物继续按高度取景。
- 直接改一个系数会同时改变 slide、镜头、resize 与回看恢复，且裁切全舞台也不自动保证说话者在屏幕内。因此本次不做魔法倍率修补，也不声称 UI-08 已解决。后续独立分支需先确立双人/三人、不同优先级、镜头缩放、滑入、竖屏/横屏/桌面的原始样本与断言。

## 验证

复用本工程 Vite 5175（PID 22692），Browser 真实页面验证：

- DRIVE A LIVE：390×844 播放、暂停、回到开头；桌面编成偶像模式同样验证；原音频 session 与编队交接保留。
- BRAND NEW FIELD：桌面单轨播放/暂停、键盘进度，音量仍可操作；时长只采用当前媒体时长，取消重复来源时长造成的取整差异。
- 卡片 `002sht_ssr01`：14 个 audio 初始均无 src；点击普通卡面语音后仅 1 个有 src，读到 15.700998 秒；暂停后 playing 数量为 0。移动端截图确认正文与控件可读，资源收录矩阵默认折叠。
- 舞台：由 DRIVE A LIVE 入口进入，手机歌曲、编队可见；桌面高级控制可展开/收起，图层调试在其中。
- 翔太个人故事、工作档案：手机首屏先显示章节/工作内容，统计折叠放在末尾。
- 从翔太工作档案进入短剧情：显示当前段落资源 0/1，点击取消返回原工作档案。另一条个人故事在点击取消前已自然加载完成，不把该次计作取消成功。
- 阅读器：从翔太 EPISODE 01 进入，选择译文，明确显示请求译文/当前原文与重试按钮；实际点击重试。源译文仍不可用，保持原文，没有假成功。手机与桌面截图核查。
- 相关页面未见框架错误遮罩；Browser error 日志检查为空。该验证是短程交互，不能代替音频听感校准或实机 GPU 性能验收。

通过：

- `npm run build:check`（最终代码编译；固定 `.analysis/build-check`，不复制 public；保留既有大 chunk 提示）。
- `node scripts/verify-ui-recovery.mjs`：critical 计数、译文失败重试/失效缓存、保留语言偏好、旧请求完成不覆盖新篇。
- `npm run verify:story-loading-safety`：包含新增 pending 取消返回 reader/card_detail/idol_story、拒绝旧结果发布，以及原有预载、当前段落就绪、背景、音频回归。
- `node scripts/verify-story-localization-runtime.mjs`。
- `node scripts/verify-media-element-clock.mjs`。
- `node scripts/verify-story-stage-resize.mjs`；`node scripts/verify-song-stage-handoff.mjs`。
- `git diff --check`。

未通过：`npm run verify:archive-presentation` 在 Vite SSR 读取 ArchiveTechnicalDetails.vue 的 scoped CSS 时 `transport invoke timed out after 60000ms`。这是实际运行结果，未跳过检查或修改断言绕过；本轮不能称完整 SSR 门禁通过。此次 Browser 与生产代码编译通过仅覆盖各自的验证边界。

未做完整发布打包、云资源上传、全库媒体验证，也未修改不相关未跟踪文件。

补充日志边界：最终 warn 检查仍返回 Pixi/Spine 的 tint、update 调用堆栈（舞台加载、剧情 spawn）；未见 error，但不能据此称零警告。本次没有修改相应渲染路径，也没有将这些警告判定为已经修复。
