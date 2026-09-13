# Archive 语义审计修复批次

以 `codex/p1-effect-texture-deps` 的 `5f3a1e3` 为输入 HEAD。仅处理 Archive presentation、relation 语义与 route identity；不改 Reader canonical、StoryAssetPlan 或播放器调度。日常代码验证只用本工程 `.analysis/build-check` 的 `build:check`，不复制 public；无关未跟踪 `docs/sidem_title_fx_css_rebuild_v9.html` 与仓库父级 `.analysis/` 保持原状。

## 01 · Mobile 偶像/组合身份不变量

个人聊天、电话、随机模式以 idol 为权威，通过 `archive_manifest.unit_membership_by_idol` 推导 unit；组合聊天允许用户独立选择 unit。无效 unit 不再静默取第一支组合 Jupiter；未知 idol/unit 呈明确空态。入口、人物选择、模式切换和 URL 恢复统一使用同一个 resolver。没有修改 master identity、Mobile 索引或历史语料。

验证：`verify-mobile-archive-identity` 覆盖真实 49 位偶像、16 支组合、三种 idol-owned 模式、过期 unit 与 Unit 独立选择；`verify:archive-navigation-state`、`build:check` PASS。5175 本工程 Vite / Playwright Chromium（Browser 插件未提供）1280×850、390×850：旧 URL `?view=mobile_archive&idol=038tak&unit=01jup&mobile_mode=personal` 规范化为 `unit=13the`；切组合聊天显示 THE 虎牙道，选 Jupiter 后切回个人聊天再次恢复 THE 虎牙道；无页面异常或横向溢出。截图在本轮仓库外 visualizations。未做真实设备/safe-area 或 Mobile 全语料验收。

## 02 · 剧情标签呈现

新增共享 `presentIdolEpisodeLabel`，优先接受明确 kind/ordinal；没有结构时仅匹配已知的「スモールトークN」「エピソードN」，投影成 `SMALL TALK 01` / `EPISODE 01`。个人故事、生日共享关系、Mobile 历史开放条件、剧情目录/详情及 Reader 顶部/分段下拉统一消费该展示函数。未改 `idol_episode_index.json`、ReadingDocument canonical 行、翻译 identity 或技术证据中的源名称。

验证：`verify-idol-episode-label-presentation` 覆盖 491 条真实标签、未知标签原样保留和 UI 接线；`verify:reading` 校验 2800 个真实阅读样本的 hash/锚点，`build:check` PASS。5175 / Playwright Chromium 1280×850、390×850：冬马个人故事显示 `EPISODE 01–05` 与 `SMALL TALK 01`；Reader `1_1_001_01_a` 顶部显示 `EPISODE 01`；生日共享关系显示 `SMALL TALK 01、02、03`，均无页面异常或横向溢出。截图仓库外；未逐页目视全部 491 条标签。
