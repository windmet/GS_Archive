# 启动引导、演唱试听与实验室改造验收

2026-10-01。输入 HEAD `1e4f20e46e84971bdf398da41670e6901b0713ef`，分支 `codex/story-interaction-v2-before-b002`。沿用已合并的谱面菜单、时钟及 PNG 导出工作，不回退并行提交。用户提供的修复指南是审阅参考；本批按最新请求撤掉人物首页「打开资料馆」文字入口，而非照搬指南的新增 CTA 建议。

## 完成行为

- 第一批提交 `49e69fad`：启动页明确提供 P 名字输入与即时预览，共用 Reader 的 `LanguageStore` 和 producer-addressing 解析。首页设置、资料馆设置和 Reader 修改同一名字。留空显示原文，不修改来源字符串或声音。补齐卡片普通、觉醒与附加文本替换。人物首页重复文字入口删除，既有导航保留。
- 引导记住启动页和所选偶像，已完成引导后第二、第三次根地址进入不重复弹出；显式深链仍优先。首页设置里主动换偶像也记为下次首页人物，临时 URL 不替用户更改启动页或「我的偶像」。
- 演唱试听按真实资源能力显示模式；组合采用下拉，49 位 Solo 放入可搜索、按组合筛选的抽屉。五槽编成、规则、音量平衡和音频归档按需展开，普通固定组合保持简洁。保留「分轨试听与原游戏混音可能不同」的资料边界。
- 歌曲详情桌面使用试听/档案双列；手机缩小封面，隐藏工具详情底栏。歌词有有限高度窗口与全文开关。进入谱面或舞台时静默暂停歌曲页试听。
- 增加实验室目录 `view=experiments`；歌曲原「打开谱面预览」入口进入 `view=chart_lab&song=…` 独立页。谱面沿用现有渲染、播放时钟、专业设置与导出，手机初始长轨，桌面初始透视；画布使用工具栏和控制台之间的空间。刷新保留歌曲，返回恢复来源查询。
- 摄影工作台移出资料馆壳，独立视口内保留素材/对象/保存菜单。默认竖屏不做 CSS 旋转；只有「横屏全屏」尝试系统全屏与方向锁定，不支持锁定时提示继续竖屏或自行旋转。「退出全屏」与「返回来源页」分开。
- 舞台小人加入实验室索引，沿用已有独立舞台与 Spine 入口，未改动其素材、渲染或播放算法。
- 按用户追加反馈，桌面长轨不再限制为固定高度内嵌窗口：竖直单栏完整撑开，改用实验页外层滚动，播放条固定在底部。新增「跟随播放」，默认关闭，暂停浏览和普通播放都不抢回手动位置；主动跳音符/时间轴定位仍移动到目标。

## 自动验证

通过：`npm run build:check`、`npm run verify:build-audit`（progress 模式）、`npm run verify:archive-startup-route`、`npm run verify:producer-addressing-runtime`、`node scripts/verify-home-experience.mjs`、`npm run verify:archive-navigation-state`、`node scripts/verify-archive-experiments.mjs`、`npm run verify:song-lyrics`、`npm run verify:song-stage-handoff`、`npm run verify:song-chart-png`、`npm run verify:media-element-clock`、`npm run verify:studio-composition`、`npm run verify:studio-gestures`、`git diff --check`。

新增实验路线回归实际投影 `useArchiveNavigationState`，覆盖刷新歌曲身份、来源筛选恢复、缺歌曲回退、摄影来源及有界工具嵌套。导航既有旧路线 oracle 保持 1792 个用例，新路线另由该回归覆盖。

额外尝试的旧检查没有通过：`verify:routes` 仍期待缺 event 的详情回退至 story_catalog，而输入基线已为 event_catalog；`verify:song-experimental-audio` 仍期待旧 `songExperimentalAudioData?.songs || {}` App 接线，而 `49e69fad` 已使用 `stageAudioExperiments`。已核对基线对应源码，不以这些陈旧断言宣称全套门禁通过，也未改写它们。构建审计仍明确 `allPublicRoutesMigrated:false`、`deviceReviewAccepted:false`。

## Browser 实际验收

使用 Browser 插件的 Codex In-app Browser，没有 Playwright 外部浏览器替代。DOM 实测 1440×900、390×844、320×740、844×390；截图工具的桌面裁切区域不冒充完整视口。

| 旅程 | 实际结果 |
| --- | --- |
| 首次启动填 windmet，选择冬马，再从根地址进入/刷新 | 引导不重复，人物沿用；首页真实台词显示 `windmetP、いつもありがとな！` |
| Reader 改成 windmetQA，回首页，再恢复 windmet | 同一缓存响应；首页显示 windmetQAP，恢复后 windmetP；清空名字返回原占位文本 |
| 冬马 N「スタートライン」 | 普通/觉醒卡片台词及首页语音文本显示 windmetP |
| 首页主动选择翔太，再从根地址进入/刷新 | 翔太保持；末尾已恢复冬马与 windmet |
| DRIVE A LIVE 组合 Legenders、Solo 抽屉组合筛选加「クリス」搜索 | 对应试听可播放；Solo 搜索剩 1 项，选择后回播放条，切换停止先前音轨 |
| 自由编成五槽、音量/规则折叠 | 既有编成操作保留；参数交接合同通过 |
| K.now O.nly、歌词全文开关 | 固定三人成员与单轨试听；全文能展开/收起；歌曲播放时进入谱面，原 audio 已暂停 |
| 资料馆导航点击实验室，再点谱面/摄影/舞台 | 实验室三个入口均到达对应页面；导航允许列表遗漏已修复并重测 |
| 歌曲入口进谱面，刷新，再返回 | song 保留，原歌曲及查询条件恢复；设置包含贴图、缩放、布局、配速、音量等原控件 |
| 手机与横屏全屏长轨 | 无页面水平溢出；390×844 控制台下缘约 832px，320×740 约 728px；844×390 调整后约 382px，工具栏可横向滚动 |
| 桌面竖直长轨手动下翻后播放 | DRIVE A LIVE 单栏画布与内层均高 12785px，内层不再裁切；PageDown 后外层位置 6824.8px，播放游标从 tick 7753 到 47539，外层位置仍保持 6824.8px。主动跳至开头/下一个音符恢复定位；320px 仍使用有限高度窗口。Browser 原生 scroll 调用无位移，改用真实界面 PageDown 完成滚动旅程，未把该无效调用记作滚轮验收 |
| 摄影独立页打开菜单、显式全屏、退出、返回 | 默认 rotation=0、transform=none；不自动请求全屏；显式操作后的方向锁定回退提示可见，返回恢复实验室 |
| 舞台小人 | 5 人编成、118 个服装候选与独立舞台载入可见；播放尝试停在动作预载，未记为演出播放通过 |

上述旅程页面身份与正文可见，没有框架错误覆盖层，控制台 error 为空；人物资源初始化存在既有 Pixi/Spine 弃用 warning。未把这些短旅程等同于全站、音质或长稳验证。

关键截图在 [本地证据目录](../.analysis/ux-productization-20261001/)：`01-startup-p-name.jpg`、`03-card-name.jpg`、`04-home-ready.jpg`、`06-solo-mobile-filter.jpg`、`18-chart-landscape-final.jpg`、`19-studio-portrait-menu.jpg`、`22-drive-desktop-long-scroll.jpg`、`23-chart-mobile-follow-toggle.jpg`。`02`、`07`、`08`、`09`、`13`、`14`、`15` 是未载入或中间布局问题证据，不作为最终通过截图；`20` 先于追加跟随开关。

## 环境与边界

```text
Browser QA: http://127.0.0.1:5213/
用户原入口: http://127.0.0.1:5198/
code: E:/Web_build/SideM_Archived/web_viewer/.analysis/build-check
models: E:/Web_build/GS_Archive_Domain_Work/song-gameplay-readmodels-20261001
release: 17e0ab0b227d6f2bb433f0c1cfaf3934fcccbc2cd420387adc95af9fc4c7a907
media: 现存 public 和 archive asset resolver 映射
```

构建为完整 Vite 代码编译，2674 模块，`copyPublicDir:false`；复用唯一 build-check，不生成完整资产包。验收基于 `49e69fad` 加本批改动，审计如实记录 sourceDirty。未发布部署，未做真机触摸、原生方向锁定、冷缓存性能、完整演出或长音频验收。

本批不等于指南 UX-01～UX-08 全部闭环。Reader→Player 语言桥接/fallback、藏品 sentinel/emoji 语料、摄影目录内部资源标签和全站 pending 反馈仍属后续范围；保留原 StudioDocument 多人物/多贴纸及 Event 单一 view 架构。
