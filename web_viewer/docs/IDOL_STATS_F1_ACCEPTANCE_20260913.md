# F1 个人统计 readiness 验收

2026-09-13；输入 HEAD `96c49a8`，分支 `codex/p1-effect-texture-deps`。本批只修个人页通信统计未知值与进入时加载状态；保留无关未跟踪 `docs/sidem_title_fx_css_rebuild_v9.html`。

- G0：交接所列 11 项命令全部 PASS。`build:check` 在本工程 `.analysis/build-check` 输出代码包，未复制 public；既有 500 kB chunk 提示，不是发布验收。
- F1：`buildIdolStats` 在索引缺失时返回 null，索引成功时保留真实 0。统一监听 `idol_detail` 与当前人物，进入后调用既有共享 lazy repository；失败可重试，切人/退出的过期完成不回写当前页状态。deep link 不再为计数阻塞整页进入。
- 回归：`verify:idol-page`、`verify-idol-communication-readiness`、`verify:archive-data`、`verify:archive-async-navigation`、`verify:archive-navigation-state` PASS；变更后 `build:check` PASS。
- 渲染：本工程 Vite `127.0.0.1:5175`，Playwright Chromium（Browser 插件技能未提供），1280×850 / 390×850，`?view=idol_detail&idol=045sor`。受控延迟时显示加载中且无假 0；完成后 13 篇、16 张卡、19 条聊天、5 条电话。390px 注入一次索引 503 时显示载入失败与重试，点击后恢复准确数量；页面 title 正常、无空白/框架错误、无 pageerror。截图在仓库外本轮 visualizations 目录。
- 边界：尚未逐条 Browser 覆盖 Portal/Card/Song/Unit/Event 来源返回链和快速切人/退出；竞争条件由独立状态回归覆盖。真实索引没有零通信样本，成功真 0 由合成索引投影回归覆盖。未验证发布包或其他设备。
