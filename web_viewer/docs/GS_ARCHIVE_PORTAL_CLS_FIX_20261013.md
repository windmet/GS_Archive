# Portal 布局偏移修复记录（决策建议 ②）

日期：2026-10-13。输入 HEAD：`1a74a855`；分支 `claude/portal-static-route-20261012`。来源：[L3 基线](GS_ARCHIVE_PORTAL_PERF_BASELINE_20261013.md) 发现正式站 Portal 手机 CLS 0.679、桌面 0.365；[实验报告](GS_ARCHIVE_PORTAL_SSG_EXPERIMENT_20261013.md) §5 选项 ②。

## 定位

用 CDP 记录 `layout-shift` 条目及其 `sources`（本地生产包，`scripts/serve-archive-build.mjs` + 候选包，模拟手机限速）。本地复现了与正式站相同的数值，且两档都只有**一次**偏移，发生在门户资料到达时（手机约 2.7 s，桌面约 0.6 s）：

| 档 | 位移的元素（previous → current，y/高） |
|---|---|
| 手机 | `nav.overview-directory` 160/190 → 260/190；`section.overview-unit-hub` 427/65 → 482/288；`div.overview-content-grid` 被推出视口 |
| 桌面 | `section.overview-featured` 238/90 → 661/279；`div.overview-content-grid` 被推出视口 |

原因（`src/components/archive/ArchivePortalOverview.vue`）：

1. 足迹数量行 `<p v-if="footprints.length" class="overview-footprint">` 在资料到达前完全不渲染，到达后插入栏目导航上方（手机高 88 px）。
2. “找到你的组合”区块在资料到达前只有标题（65 px），16 个组合块到达后变为手机 524 px / 桌面 424 px 的网格。
3. “正在读取门户资料…”提示位于导航与组合区之间，资料到达后移除，又带来一次上移。

加载完成后的几何（实测）：足迹行恒为 4 个按钮；组合块高度由 CSS 固定（桌面 100 px、≤760 px 时 84 px），16 块，手机 3 列、桌面 4 列。

## 改动

- `src/presentation/ArchivePortalPresentation.js`：足迹标签表抽成导出的 `PORTAL_FOOTPRINT_IDS` / `portalFootprintLabel(id, preferred)`，`buildPortal…` 内部改用它（输出不变）。
- `ArchivePortalOverview.vue`：
  - 足迹行始终渲染；资料未到时用同样 4 个槽位（标签同上，数值显示“—”、按钮禁用），`aria-busy` 标记加载中。
  - 组合网格在资料未到且没有错误时，渲染与 bootstrap 组合数相同的空组合块（`.overview-unit-tile.is-placeholder`，沿用固定高度，底色用 `--gs-ink-3` 的 12% 混色）；标题数量先显示占位数。出错时不显示占位网格。
  - 加载提示加 `overview-visually-hidden`：仍由 `role="status"` 播报，不再占位。
- `scripts/verify-portal-loading-layout.mjs`（新增，进 CI batch）：真实 SFC SSR 渲染加载中/出错/已加载/偶像视角四种状态，断言槽位、占位块数量、提示隐藏、出错不显示占位、数据到达后占位消失。临时把足迹行改回 `v-if` 时该脚本失败（已验证后恢复）。

## 结果

| 测量 | 修复前 | 修复后 |
|---|---:|---:|
| 手机 CLS（`cls-sources` 单次） | 0.679 | **0.000** |
| 桌面 CLS（`cls-sources` 单次） | 0.365 | **0.043** |
| 手机 CLS（`measure-portal-cold-load`，3 次中位数） | 0.679（正式站） | **0.000** |
| 桌面 CLS（同上） | 0.365（正式站） | **0.043** |

桌面剩余 0.043：内容网格随精选卡片区域高度变化被下推一次，低于 0.1 阈值，本轮不处理。

加载态截图：`.analysis/portal-cls/after/loading-mobile.png`（数量显示“—”，16 个灰色占位块），完成态 `final-mobile.png`，两者布局一致。

## 命令与结果

| 命令 | 结果 |
|---|---|
| `node scripts/verify-portal-loading-layout.mjs` | 通过 |
| `node scripts/verify-archive-portal-presentation.mjs` | 通过 |
| `node scripts/verify-portal-bento.mjs E:/GS_readmodels_candidate_20261012_age`、`verify-portal-directory-navigation.mjs`、`verify-portal-projections.mjs`（同参数） | 通过（这三项必须带候选包路径，不带时改动前后都会失败） |
| `node scripts/verify-archive-motion.mjs`、`npm run verify:archive-presentation` | 通过 |
| `npm run build:check`、`npm run verify:entry` | 通过 |
| `npm run verify:source-batch` | 127/127 通过（新增 verifier 登记后为 128 项） |
| `node scripts/capture-gallery.mjs portal-cls --only=app-portal,app-onboarding,app-idol-path` | 9/9 干净（本地生产包） |

浏览器均为 headless Playwright Chromium + 原生 CDP；未做真机。所有本地服务已关闭。
