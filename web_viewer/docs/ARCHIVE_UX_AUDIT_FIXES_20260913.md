# Archive UX 审计修复批次

审计附件以 `7c45746` 为基线；本轮从当前同一 HEAD 和 `codex/p1-effect-texture-deps` 出发。保留无关未跟踪 `docs/sidem_title_fx_css_rebuild_v9.html`。以下每批独立提交；build:check 只在本工程 `.analysis/build-check` 编译代码，不复制 public，不是发布包。

## UX-01：主导航偶像目的地

主导航“偶像”固定进入 49 人目录，清除上个列表的人物/搜索/组合筛选；Portal 的“我的偶像”人物卡片仍为个人资料快捷入口，不改变其他关系来源链。

验证：`verify-idol-navigation-ux`、`verify:archive-navigation-state`、`verify:portal-navigation`、`build:check` PASS。5175 本工程 Vite，Playwright Chromium（Browser 插件技能未提供），1280×850 与 390×850：Portal 有常用偶像 002sht 时，主入口变为 `?view=idols&category=idol`，人物快捷入口仍为 `?view=idol_detail&category=idol&idol=002sht`；title/内容正常、无相关 console error、无水平溢出。截图在本轮仓库外 visualizations 目录。未验证发布包、所有历史返回链和非零 safe-area 实机。

## UX-05：原始技能参数与通信 emoji 呈现

输入 HEAD `75d363f`。卡片技能说明通过窄的 presenter 处理未证实语义的 `<dXX>` 数值占位符；保留已知触发条件，未猜测效果百分比；原始 description 保留在技术详情证据。Mobile hero 与列表标题、随机话题标题共用 emoji inline 投影，真实 compiled group 标题中的 `<emoji>` 以素材呈现、图片有文本替代。编号标题归因仍待复现，不顺手改数据。

验证：`verify-archive-inline-presentation` 覆盖 570 个真实技能等级与带 emoji 的真实通信标题，`verify:archive-presentation`、`verify:communication-assets`、`build:check` PASS。5175 / Playwright 1280×850、390×850：`001tom_r01` 的技能显示“数值尚未解析”且保留 8 秒/18％/4 秒触发说明；`012yus` 的个人聊天列表显示 emoji 图片，页面不含原始 `<emoji>` 字样；无 console error、页面横向溢出。渲染截图在仓库外；未证明 `<dXX>` 到 effects 的精确语义或逐项核查所有图像。
