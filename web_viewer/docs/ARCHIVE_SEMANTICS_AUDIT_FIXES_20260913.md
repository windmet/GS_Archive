# Archive 语义审计修复批次

以 `codex/p1-effect-texture-deps` 的 `5f3a1e3` 为输入 HEAD。仅处理 Archive presentation、relation 语义与 route identity；不改 Reader canonical、StoryAssetPlan 或播放器调度。日常代码验证只用本工程 `.analysis/build-check` 的 `build:check`，不复制 public；无关未跟踪 `docs/sidem_title_fx_css_rebuild_v9.html` 与仓库父级 `.analysis/` 保持原状。

## 01 · Mobile 偶像/组合身份不变量

个人聊天、电话、随机模式以 idol 为权威，通过 `archive_manifest.unit_membership_by_idol` 推导 unit；组合聊天允许用户独立选择 unit。无效 unit 不再静默取第一支组合 Jupiter；未知 idol/unit 呈明确空态。入口、人物选择、模式切换和 URL 恢复统一使用同一个 resolver。没有修改 master identity、Mobile 索引或历史语料。

验证：`verify-mobile-archive-identity` 覆盖真实 49 位偶像、16 支组合、三种 idol-owned 模式、过期 unit 与 Unit 独立选择；`verify:archive-navigation-state`、`build:check` PASS。5175 本工程 Vite / Playwright Chromium（Browser 插件未提供）1280×850、390×850：旧 URL `?view=mobile_archive&idol=038tak&unit=01jup&mobile_mode=personal` 规范化为 `unit=13the`；切组合聊天显示 THE 虎牙道，选 Jupiter 后切回个人聊天再次恢复 THE 虎牙道；无页面异常或横向溢出。截图在本轮仓库外 visualizations。未做真实设备/safe-area 或 Mobile 全语料验收。
