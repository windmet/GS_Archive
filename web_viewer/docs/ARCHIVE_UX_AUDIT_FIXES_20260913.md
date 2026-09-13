# Archive UX 审计修复批次

审计附件以 `7c45746` 为基线；本轮从当前同一 HEAD 和 `codex/p1-effect-texture-deps` 出发。保留无关未跟踪 `docs/sidem_title_fx_css_rebuild_v9.html`。以下每批独立提交；build:check 只在本工程 `.analysis/build-check` 编译代码，不复制 public，不是发布包。

## UX-01：主导航偶像目的地

主导航“偶像”固定进入 49 人目录，清除上个列表的人物/搜索/组合筛选；Portal 的“我的偶像”人物卡片仍为个人资料快捷入口，不改变其他关系来源链。

验证：`verify-idol-navigation-ux`、`verify:archive-navigation-state`、`verify:portal-navigation`、`build:check` PASS。5175 本工程 Vite，Playwright Chromium（Browser 插件技能未提供），1280×850 与 390×850：Portal 有常用偶像 002sht 时，主入口变为 `?view=idols&category=idol`，人物快捷入口仍为 `?view=idol_detail&category=idol&idol=002sht`；title/内容正常、无相关 console error、无水平溢出。截图在本轮仓库外 visualizations 目录。未验证发布包、所有历史返回链和非零 safe-area 实机。
