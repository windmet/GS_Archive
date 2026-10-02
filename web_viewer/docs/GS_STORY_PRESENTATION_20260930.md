# 剧情展示优化与验证（2026-09-30）

输入为用户提供的新审计文本；当前工作区基线 `67d986fe`，最新上一轮源码 `fa9334af`。继续分支 `codex/story-interaction-v2-before-b002`。本轮只改展示与数据消费接线，没有改 ChapterReadingPlan、播放控制器、queue ownership、ReadingRepository 或来源合同，没有写 compiled、Reader JSON、translations、B001 receipt，没有部署或推进B002。

## 展示改动

- STORY 简介：展开章节时只读取第一份可唯一对应的 Reader entry，调用原 ReadingRepository 做字节/身份校验，选择 source-bound front matter synopsis，再复用 StoryLocalization 按 exact unit/catalog 取译文；不用文本匹配，不编译新简介。原文、译文、双语为本组件局部显示选择。不存在绑定或加载失败时保留目录原文，无译文切换；失败可单独重试。generation 阻止旧章节请求提交新页面，不取消共享 repository 请求。
- StorySynopsisCard 统一简介引言样式：3px青绿线、浅背景、7px圆角；正文和目录均调用 ReadingTypography reflow，保留双语次级层次。
- 标签呈现分为 full=`EPISODE 01`、reader=`EP 01`、player=`EP01`。queue label 不改；SMALL TALK、PROLOGUE、未知标题保持原语义。目录/正文标题用full，Reader导航用reader，播放器位置/下一段/选集用player。
- Reader 导航改为等宽Grid：宽屏十列，窄屏五列。加载/失败状态用小点辅助，完整标签和状态仍在可访问名称中，避免状态文字挤乱网格。
- ReaderControlBar 是单篇和整话共用的工具栏，分组语言、Producer输入及查找；按钮和输入框最小44px。单篇关闭搜索继续恢复查找按钮焦点。
- ReadingTranscriptSection 是正文唯一样式所有者：普通对白为40px头像栏和正文栏、轻分隔；简介、标题、旁白/caption、choice及分支提示保留不同结构。不改row、text_ref、anchor或分支内容。头像复用ArchiveIdolAvatar，从App显式传递bootstrap身份目录与代表色；未知说话人仍按原有经验证的视觉证据显示头像，姓名不猜测、不泄露。
- 清理 ArchiveStoryReader 的失效/重复正文和工具栏CSS，单篇改用既有 useReadingPresentation；ChapterReadingSegment 继续保留正式段标题与播放入口。

## 验证

相关检查17项通过，完整命令与exit code在 `.analysis/story-presentation/checks/results.json`：reading、reading-sources、reviewed-b001、player-qa、player-immersive、player-repair、playback-controller、episode-queue、story-localization、producer-addressing-runtime、communication-presentation、archive-presentation、archive-navigation-state、archive-startup-route、archive-async-navigation、story-playback-range，以及直接运行的 `verify-archive-inline-presentation.mjs`。inline脚本没有npm同名alias；初次命令被纠正后直接脚本通过，保留初次runner错误日志。

增加实际B001简介的原/译/双SSR呈现、exact unit选择、旧source hash回退、无绑定不提供译文控制回归。491个实际标签及格式变体通过；既有SSR仍验证所有行锚点、合并标题、分支和PROLOGUE未知姓名保护。Reader来源仍2801份（2492 ready/309 unsupported），B001仍52 documents/42 catalogues/993 source-bound units。保护guard检查6551 tracked文件，无改动/缺失/新增；无关未跟踪项原样保留。

`npm run build:check` 与 `npm run verify:build-audit` 用本checkout可复用 `.analysis/build-check`，不复制public corpus。Browser使用已核实的5197 QA服务，public与外部models映射原资源；最终源码/构建绑定保存在 `.analysis/story-presentation/final-build-audit.json`，Browser记录与截图保存在同目录。

## Browser已运行的旅程

Codex IAB，真实界面操作；桌面1280×900、手机尺寸390×844，未缩小页面比例。窄屏按钮宽65.647–65.654 CSS px、桌面约88.003；五列/十列一致。按钮及输入测量约43.994 CSS px，CSS min-height=44px，小数舍入；Reader scrollWidth=clientWidth，无横向溢出。手机尺寸只证明布局与桌面输入，不是触摸或真机签收。

第一话简介实际原/译/双切换：doc=`1_4_001_01_a`，catalog=`1_4_001_01`，unit=`story-text:v1:1_4_001_01:1_4_001_01_a:cmd-000000:synopsis:000`，Reader revision=`sha256:90b8410a393383dda63fd71a8fa3e464f9a0bb70864cae7eab9bf42a2dbf963a`。日文已reflow；中文来自reviewed overlay。`synopsis-modes.json`记录三种状态。

冷开目录仅加载一份Reader简介文档；注入该文件503，其他目录入口可用、简介保留原文、译文控制为0，重试后恢复exact unit和三个语言控制。`synopsis-retry.json`和HTTP记录可核对。延迟第二话第一段后切第三话，旧响应不能替换第三话简介；旧单篇/搜索/Reader→Player→返回旅程另记 `browser-results.json`。

截图：`reader-after-desktop.png` / `reader-after-mobile.png`、`dialogue-after-mobile.png`、`collection-synopsis-desktop.png`。普通对白已经去除逐句大白卡，40px人物头像代表色与bootstrap一致。最终控制台按本轮新错误和既有Spine警告分开记录；注入503属预期故障。

边界：未重跑全库100项或声称两个旧数据gate已消除；本轮没有改其对象。未做真机、软键盘、触摸、200%或媒体发布验收。最终清除QA故障并恢复临时viewport，保留用户Browser阅读页。
