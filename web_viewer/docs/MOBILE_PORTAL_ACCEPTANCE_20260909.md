# 移动门户首批交付与验收

日期：2026-09-09；起点 3b5f17f，分支 codex/archive-architecture-refactor。
本批交付 M，不包含 D Reading、E1/E2 或正式长稳。

## 实现

- ArchivePortalLauncher 用三列图标网格消费原有八个 ARCHIVE_NAVIGATION 入口。
  移动底栏仅首页/门户；桌面原有侧栏与八项分类保持不变。
- `?view=portal` 可独立打开。可选 `portal_from` 只保存规范化本地 archive query；
  复用 useArchiveNavigationState/ArchiveNavigationCoordinator。打开保存来源，返回恢复
  原实体、筛选和父级上下文。刷新/复制链接保留来源；无来源回首页。
  不允许外站、嵌套 portal 或直接跳入播放器/实验室作为返回目标。
- 入口恢复不加载播放模块，并释放可能由历史导航留下的 currentScenario 引用。
  门户不复用 mobile_archive，不建立第二套实体目录或媒体 owner。
- 页面语义标签、真实按钮、键盘焦点、减弱动画偏好、安全区和短屏滚动均纳入实现。

## 用户指定背景的来源

用户在实现期间提供游戏电话页截图，明确要求使用其中 315 Production 底图。
图像身份：`image_mobile_background_common`，688×736；来源
`RAW/asset/image_mobile_backgrounds.unity3d`，Texture2D PathID `3188813407174735134`，
container `assets/resources/image/image_mobile_background/image_mobile_background_common.png`。
已与 image_bundle_relation_catalog 中记录核对。未裁视频截图或生成替代商标。

- bundle SHA-256：`b9339c86689ad01a3c55a02b2ce6b0391562063f621dd02ff5530d4aa9ed4630`
- RGBA SHA-256：`92851ac6b34a9789df2aa110cf7c9c260b4b2d2f2fba435e0394b1f54ff30fac`
- PNG SHA-256：`f52aa88f225a16897f6d257c8f2416d4635908b3b57f18fc477512ac3305a7ec`
- 公共资源：`public/assets/portal/image_mobile_background_common.png`，22,886 bytes。

`python scripts/prepare-portal-background.py --output <path>` 只读取这一经摘要校验的
bundle/object，可重建输出。历史整理者 PNG 可用于视觉发现，但其像素和 RAW 解码
并非完全相等，本批以直接 RAW Texture2D 为准，不声称二者像素 parity。
新增一张 bounded portal PNG，已更新 binary inventory；archive_baseline_report
仅更新 tracked_binaries 为 184 / 49,146,383 bytes，其他历史证据不重写。

## 本批实际发现的边界修复

真实浏览器从有声首页快速切页，观察到旧 voice fetch 完成后尝试在已置 null 的
audioCtx 上 decodeAudioData，产生控制台错误。新增受控测试在未修源码上以同一
错误失败。prepareVoice 现在使用开始时的上下文引用，并在 fetch/decode/lip 等
异步边界与当前引用核对，过期结果返回 null；不另设导航状态。
fetch pending 和 decode pending 两种退出用例通过，修后首页→门户回归无 error。
这是该集成触发的局部修复，不作为 B28+ 主动审计或长稳 PASS。

## 验收证据

Browser/IAB 实际服务 5175 已核对为本 checkout 的 Vite；临时 5176 使用相同配置
并增加仓库外的请求记录，用于直达门户的实际网络检查。

- 八个入口均操作进入：home / story_catalog / song_catalog / idol_detail / cards /
  gashas / mobile_archive / archive_status；既有门户内容可见。
- 卡片 SSR 筛选→门户→刷新→返回，恢复 `cards/category=cards/idol=001tom/rarity=SSR`。
  浏览器后退恢复 portal，前进恢复同一筛选。键盘 Tab 从标题到首页图标且焦点环可见。
- 最终检查 320×740、390×844、430×932、1280×900 的真实 viewport 值。
  横向溢出均 false；最窄入口宽约 78px；门户 canvas 数为零。
  短屏允许纵向滚动；桌面显示原侧栏、隐藏移动 dock。
- 5176 直达 `?view=portal` 的服务端请求记录：1,921 个开发模式请求（包括模块请求
  和既有全站启动索引），舞台模型/atlas/voice/audio/lipsync/场景 bg 请求为零；
  原版 portal PNG 请求存在。无 SpineStage/StoryViewer/PixiStageManager 模块请求。
  不宣称已优化原 App 的全站启动索引加载，也不把开发模式请求数当生产性能指标。
- 独立门户控制台无 error/warn；有声首页往返修复后无 error。

本地通过：verify:portal-navigation、verify:routes、verify:archive-navigation-state
（原 1,792 组对照保持，新 portal 使用独立契约测试）、verify:archive-async-navigation、
verify:archive-startup-route、verify:story-audio、verify:home、verify:tracked-binary-inventory、
verify:archive-baseline:source-only。新增 portal verifier 接入现有 Source Gate workflow。
Vite source-only build 通过（copyPublicDir=false；2,478 modules）；未复制全部媒体、
部署或扩大 strict-v2 publication。未声称远端 CI 已执行。

## 设计对照

使用 Build Web Apps + built-in Image Gen 生成完整移动屏幕概念；代码实现为 Vue/CSS
及现有 Lucide 图标。概念不是打包进网站的背景图。
图像输出为 853×1844 的参考栅格，按约 390×844 CSS 视口阅读，不把栅格像素直接
当网页 CSS 宽度。最终使用 view_image 同时检查概念与 390/320 实际截图。

| 对照点 | 最终实现与调整 |
| --- | --- |
| 文案 | 标题、说明、八入口、返回、双项 dock 与概念一致，无新增首屏文案 |
| 布局 | 三列网格、顶部返回/品牌、底部署名；修复初版多余纵向溢出 |
| 字体 | 移动标题 34px（320 为 30px）、入口 16px（320 为 14px），保持层级 |
| 图标 | 统一原有 Lucide 线形体系及 pastel 圆角底；保留项目真实品牌图，不采用概念虚构标志 |
| 背景 | 按用户新要求由青色渐变改为原游戏灰蓝 315 底图，标志位于下方 |
| 响应式 | 320 保持三列和可读标签；桌面延续侧栏，无模拟机身挤压屏幕 |

以上背景/品牌/现有图标差异是用户参考和本项目设计系统的明确适配，其余无待修复
的重大布局差异。完成概念结构与用户追加参考的视觉核对，不声称整站视觉已验收。

仓库外证据：`C:/Users/windm/.codex/evidence/sidem-mobile-portal/2026-09-09/`
下 `portal-{320,390,430,1280}.png`、`viewport-checks.json`、`portal-cold-requests.json`。
概念原图：`C:/Users/windm/.codex/generated_images/01a0840a-f67a-7f61-9393-d8480d396fd7/exec-1b8159a7-7e96-42bb-a16c-65dc51eedb77.png`。
