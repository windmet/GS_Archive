# D1 独立 Reader 首批验收

2026-09-09；起点 60b141f；分支 codex/archive-architecture-refactor。
本批完成小样本独立直达阅读。D2/F 的目录入口、指定句演出及返回、E1/E2 和正式长稳仍未完成。

## 可使用的路径

- `?view=reader&reading=1_4_001_00_a`：序章，原文、梗概、标题与未知说话人。
- `?view=reader&reading=1_4_001_01_d&reading_mode=bilingual`：既有正式 overlay
  所覆盖的三处译文（对白与选项），其他行回退原文；译文仍保持来源的 draft 状态。
- `reading_row=1_4_001_01_d:step-8:text`：刷新定位同一行，门户往返保留行和模式。

当前共有五个 manifest 分段：00_a、01_a、01_d、02_a 可读，03_h 明示未支持。
新增 01_d 仅为了验收既有译文消费，不新增或改写译文。其余目录不自动宣称可阅读。
标题和 episode_label 从同一 Story Catalog 的章节/分段关系生成，不从字母序号猜测。

## 所有权与展示

ArchiveStoryReader 只消费 ReadingDocument、静态头像与既有 StoryLocalizationContext。
原文/译文/双语使用 resolveUnit，保留缺译、过期回退与主副语言独立 DOM。
未知说话人的规范身份仍在产物，但展示时不给 entity 名称解析器传入隐藏身份，
也不显示头像；`<P>` 仅在展示层显示为「プロデューサー」，不修改原文记录。

archiveRoute/useArchiveNavigationState 拥有 reading、reading_row、reading_mode。
ReadingSession 只原子发布加载/文档状态，沿用传入的 navigation intent；没有第二套
generation、播放器或队列。页面切换释放旧 scenario 引用，旧请求只可填 repository
缓存，不能覆盖新页面。显式选分段使用非恢复 intent，在加载中就更新 URL；历史
恢复仍抑制中途写入。语言切换不取消正文请求，也不改变文本/播放身份。

Reader 不调用 prepareScenario、preloadAssets 或 loadPlayer。尚不接受 Full Player
的 return=reader；待 D2/F 明确完整返回契约后接入，避免提前支持不完整往返。

## Browser/IAB 实测

正式预览使用本 checkout 启动的 Vite 5175；5176 使用同一配置并增加仓库外请求
记录和受控故障。最终页面无相关 console error/warn；503 测试属于刻意故障。

- 五个样本可选择；双语显示「刚才哼歌的人，是你吗？」、「……嗯，是我。」及
  选项「原来他这么有名……？」。未知说话人保持「？？？」。
- 多选样本显示未支持说明，没有将互斥正文串成连续剧情。
- 不在 manifest 的 ID 显示「尚未生成」，不显示旧正文。
- 正文请求返回 503 → 错误/重试页 → 恢复请求 → 重试成功。
- 12 秒受控正文延迟期间进入门户；旧请求结束后 URL 和标题仍为门户。
- 分段选择后 URL 正确；浏览器后退/前进恢复分段与双语模式。
- 指定行直达、刷新、门户返回均恢复 step-8 行的选中和键盘焦点。
- 320×740、390×844、430×844、1280×800；实际 viewport 和 PNG 尺寸逐一核对；
  均无横向溢出、无 canvas。手机正文 16px、桌面 17px；分段选择触摸高度 44px。
- 冷启动 1,935 个开发模式请求中，阅读数据仅 manifest + 00_a 正文两项；舞台模型、
  atlas、voice/audio、背景和口型请求为零，SpineStage/StoryViewer/PixiStageManager
  模块请求为零。包括既有 App 共享索引请求，不称为全站启动加载已最优化。

浏览器 viewport 调整后的即时截图有过缩放/截断；已丢弃并用稳定后、可完整截图
的高度重采。最终记录只对应上列实际 PNG 尺寸，不用旧截图支持验收。

## 设计对照

使用 Build Web Apps/Image Gen 完整移动屏幕概念；保留项目导航与图标体系，
正文全部使用真实 compiled 文本。原图 853×1844，按 390×844 CSS 设计尺度核对。
最终在同一 QA pass 用 view_image 查看概念与 390、320、1280 实际截图。

| 对照点 | 实现/明确适配 |
| --- | --- |
| 文案 | 返回、剧情阅读、分段、原文/译文/双语、首页/门户保持概念顺序；源文替换概念示意摘录 |
| 布局 | 开放正文栏，无聊天气泡或卡片；完整源文及换行使首屏下方内容比示意更长 |
| 字体 | 手机正文16px/1.9、标题24px；桌面17px、标题26px；控件独立指定字号 |
| 色彩 | 白底、墨色正文、青色说话人与选中控件；无额外背景图或染色层 |
| 图标 | 沿用 Lucide 返回/底栏及项目桌面品牌；不绘制概念中的模拟系统时间/电量 |
| 间距 | 修复320下分段标签换行；源文本行距与分区留白保持可读；控件至少44px |
| 资产 | 已确认人物才显示原静态头像；未知人物不拿生成图或身份头像代替 |

首屏 copy 差异限定为真实源文长度、原生产导航图标和去除模拟系统栏。
错误/缺译/未支持提示是要求的功能状态，未添加宣传文案。无待修复的重大视觉差异。

## 验证与边界

通过 verify:reading（产物、repository、真实 App 导航分支和 Vue 模板渲染）、
verify:reading-sources、verify:routes、verify:archive-navigation-state（原1792组）、
verify:archive-async-navigation、verify:archive-startup-route、verify:portal-navigation、
verify:story-localization、verify:archive-baseline:source-only。
空正文及加载/未生成/错误/未支持由实际 Vue SSR 模板验证；不为测试发布假空剧情。
过期译文回退沿用现有 resolver 的自动测试；不声称有真实过期译文浏览器样本。
Source-only Vite build 通过（2,484 modules，copyPublicDir=false）；主 chunk 约515kB
触发默认500kB提示，保留为性能后续项，未调高阈值掩盖。没有远端CI通过或部署声明。

证据目录：`C:/Users/windm/.codex/evidence/sidem-reader/2026-09-09/`，含
reader-{320,390,430,1280}.png、reader-bilingual.png、viewport-checks.json、cold-requests.json。
概念：`C:/Users/windm/.codex/generated_images/01a0840a-f67a-7f61-9393-d8480d396fd7/exec-0141e242-9c59-4fc4-b948-9d2e1d11686f.png`。

下一批 D2/F：接现有故事入口、验证 anchor→播放范围映射、完成指定句演出与返回，
整块收拢播放器打开/关闭/队列/范围/返回；不能另建平行队列或仅抽零散 helper。
