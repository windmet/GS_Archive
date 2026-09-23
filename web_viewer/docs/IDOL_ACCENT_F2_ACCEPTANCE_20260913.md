# F2 代表色头像验收

2026-09-13；输入 HEAD `5ad9099`，分支 `codex/p1-effect-texture-deps`。本批只处理人物头像色环；无关未跟踪 `docs/sidem_title_fx_css_rebuild_v9.html` 保留。

- `IdolReferencePresentation` 从规范档案 `profile.color` 投影 `accentColor`；仅接受六位 hex，缺失/非法色用中性框。Card/Song/Unit/Story/Portal 共用此合同，不在各消费者硬编码。活动立绘不施加圆形边框；图像失败依次回退到 icon，再失败保留首字与人物姓名/可访问名称。Mobile、个人页头像复用同一校验 token。
- 49 人 148×148 icon 联系表（仓库外截图）全部加载，5% 内缩与圆形裁剪视觉扫描未见明显切脸/方框残留；色彩从亮黄、浅粉至深蓝均有样本，描边外有低调对比线。未改动原始 PNG。
- `verify:idol-reference`、`verify:idol-page`、`build:check` PASS；后者仅固定 E 盘代码产物，不含 public 全量媒体，既有大 chunk 提示。
- 本工程 5175 Vite / Playwright Chromium（Browser 插件技能未提供）：1280×850、390×850 的 Card、Song（`brndnf`）、Unit、Story、Portal（本地偏好 001tom）、Event、Mobile 实页检查。icon 色环使用人物色；Event 活动图为无边框的原比例视觉；活动图 404 后回退到色环 icon，icon 404 后首字仍可见且链接有完整可访问名称。可聚焦共享按钮 outline 为 solid，未见 pageerror 或页面横向溢出；Mobile 去遮罩截图可读。截图与测试脚本在本轮仓库外 visualizations 目录。
- 边界：联系表是 86px、1.05 缩放的 QA 模拟，实际组件抽样而非对 49 人逐个实页截图；非 390px 的设备 safe-area、全量路线组合和发布包未验收。
