# Archive UX 审计修复批次

审计附件以 `7c45746` 为基线；本轮从当前同一 HEAD 和 `codex/p1-effect-texture-deps` 出发。保留无关未跟踪 `docs/sidem_title_fx_css_rebuild_v9.html`。以下每批独立提交；build:check 只在本工程 `.analysis/build-check` 编译代码，不复制 public，不是发布包。

## UX-01：主导航偶像目的地

主导航“偶像”固定进入 49 人目录，清除上个列表的人物/搜索/组合筛选；Portal 的“我的偶像”人物卡片仍为个人资料快捷入口，不改变其他关系来源链。

验证：`verify-idol-navigation-ux`、`verify:archive-navigation-state`、`verify:portal-navigation`、`build:check` PASS。5175 本工程 Vite，Playwright Chromium（Browser 插件技能未提供），1280×850 与 390×850：Portal 有常用偶像 002sht 时，主入口变为 `?view=idols&category=idol`，人物快捷入口仍为 `?view=idol_detail&category=idol&idol=002sht`；title/内容正常、无相关 console error、无水平溢出。截图在本轮仓库外 visualizations 目录。未验证发布包、所有历史返回链和非零 safe-area 实机。

## UX-05：原始技能参数与通信 emoji 呈现

输入 HEAD `75d363f`。卡片技能说明通过窄的 presenter 处理未证实语义的 `<dXX>` 数值占位符；保留已知触发条件，未猜测效果百分比；原始 description 保留在技术详情证据。Mobile hero 与列表标题、随机话题标题共用 emoji inline 投影，真实 compiled group 标题中的 `<emoji>` 以素材呈现、图片有文本替代。编号标题归因仍待复现，不顺手改数据。

验证：`verify-archive-inline-presentation` 覆盖 570 个真实技能等级与带 emoji 的真实通信标题，`verify:archive-presentation`、`verify:communication-assets`、`build:check` PASS。5175 / Playwright 1280×850、390×850：`001tom_r01` 的技能显示“数值尚未解析”且保留 8 秒/18％/4 秒触发说明；`012yus` 的个人聊天列表显示 emoji 图片，页面不含原始 `<emoji>` 字样；无 console error、页面横向溢出。渲染截图在仓库外；未证明 `<dXX>` 到 effects 的精确语义或逐项核查所有图像。

## UX-09：加载与译文状态语义

输入 HEAD `cec82d7`。Lab 在 manifest 未到时显示“正在读取动作库”，失败/真空结果分别表达；Reader 译文资源 invalid 时只报加载失败，避免叠加由 fallback 推出的“未译”数量；全局遮罩接显式资料/演出/舞台用途文案，既有播放画面等待提示保留。没有更改 Reader canonical 行或 Playback scheduler。

验证：`verify-archive-loading-copy`、`verify-reading-render`、`verify:archive-async-navigation`、`verify:reading-playback`、`verify:story-loading-safety`、`build:check` PASS。5175 / Playwright 1280×850、390×850：Lab manifest 受控延迟时无假 0，到达后为 60 动作；`1_4_001_01_d` 译文请求（实际 text catalog `1_4_001_01`）注入 503 时只显示“译文暂时无法载入”，正文原文可读；390px 冷卡片索引延迟时显示“正在读取资料馆数据”。无页面异常与横向溢出；桌面 headless WebGL 有 ReadPixels GPU stall 性能警告。截图仓库外，未做设备性能/完整媒体验收。

## UX-06：Archive 滚动容器与返回焦点

输入 HEAD `5401ed4`。沿用既有 `archiveViewRestoration` 的 session 位置/焦点协议，为独立滚动的卡/歌曲/人物/组合详情及目录、活动/剧情/卡池/Mobile 等根节点接入滚动标记；重要人物/组合/关联行补稳定焦点 ID。卡片列表、歌曲/剧情/卡池目录原已接入，审计对此部分的判断已过时。未改变试听控件状态；音频在跨页面离开后的恢复属于独立议题。

验证：`verify:archive-navigation-state`（包括 marker 断言）、`build:check` PASS。5175 / Playwright Chromium 1280×850、390×850：`brndnf` 歌曲详情中部→Jupiter 组合→返回，回到同一歌且 `scrollTop` 精确等于离开时记录值（桌面 516、窄屏 742），焦点为 `song-unit:01jup`；卡列表筛 `gasha_card` → `002sht_sr04` 卡详情中部→关联卡池→返回卡详情→返回卡列表，详情恢复 360，列表回到卡片所在位置并恢复 `card:002sht_sr04` 焦点。无页面 console error/横向溢出。截图仓库外；未覆盖所有页面和真实设备返回矩阵。

## UX-04 / UX-10：关联组合与历史开放条件

输入 HEAD `e4064a6`。歌曲 AUDIO 中的 `unit` 记录明确标为“收录组合 / 关联组合”，链接写“查看组合”，说明组合单轨试听在上方「演唱试听」选择 Unit；仍原样链接组合档案，不替换播放控件。Mobile 通信的历史解锁项在列表前解释“原游戏开放条件，不影响已收录内容浏览与播放”，逐项也注明历史性质；未改 unlock model、按钮或收录判定。

验证：`verify-archive-inline-presentation`、`verify:archive-presentation`、`build:check` PASS。5175 / Playwright Chromium 1280×850、390×850：`drvalv` 显示关联组合标题、试听说明与“查看组合 · Jupiter”；`012yus` 的个人聊天展示说明和逐行标签。无页面 console error/水平溢出，截图仓库外；未做播放器实际多轨听感和全部通信记录逐条核对。

## UX-07：手机选人确认区

输入 HEAD `990cd85`。手机偶像选择页使用受限高度的三段布局：搜索/数量、独立滚动的 49 人网格、网格外始终可见的操作区；较矮视口压缩非交互文案留足列表空间。桌面保持既有页面滚动。不改变随机选择、设置“我的偶像”或打开页面的行为。

验证：`verify:portal-navigation`、`build:check` PASS。5175 / Playwright Chromium 1280×850、390×850、390×650：从 Welcome 选择游戏风首页，网格滚到底时按钮仍在视口内；390×850 网格可视高 249px、390×650 高 147px，点击已选人物后导航到 `?view=home&home_idol=001tom`；无页面 console error/横向溢出。截图仓库外。顺带补足 UX-09 引入的 `loadingPurpose` 旧 Portal 测试桩，先前未跑该项、此次跑通；尚未做真实 safe-area/屏幕键盘覆盖验收。

## UX-08：Reader 前置信息与主线话目

输入 HEAD `f1bb0b7`。仅在 Reader presentation 投影连续开头的 title/synopsis：与页面 h1 同文本身份的两个原脚本 title 行不重复展示，保留原行节点 ID/锚点和原始 document；其他独立 title（例如“第1話”）及 synopsis 仍可见。旧 title 锚点定位时聚焦可见 h1。主线集合内部 chapterCount 展示为“话”，其他域仍用原有“章”称呼；没有修改 `ReadingDocument`、翻译 identity 或源数据。

验证：`verify:reading`（含 2734 份真实 ReadingDocument 的 hash/锚点校验与 Vue 渲染）、`build:check` PASS。5175 / Playwright Chromium 1280×850、390×850：`1_1_001_01_a` 原文 Reader 只显示一个页面标题，原 16 个行锚点仍在、两条重复标题成为无视觉重复的锚点、synopsis 和“第1話”仍可见；译文 URL 直达第一标题旧锚点时焦点落在可见 h1；主线集合显示“11 话”。无 console error/水平溢出，截图仓库外。未重新验收所有译文内容、全部 Reader 篇章的视觉效果。
