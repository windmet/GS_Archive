# 阅读主题与品牌色解耦

输入 HEAD `6d434172`，分支 `codex/story-interaction-v2-before-b002`。
此批落实用户提供的四套阅读配色指导，范围为整话与单段 Reader 的呈现及偏好。

## 行为

- 默认极简白；工具栏在“篇内查找”旁提供四个 20px 色点，每个按钮有 44px 点击区域、
  中文辅助名称、tooltip、键盘焦点和 `aria-pressed` 选中状态。手机工具栏按行排列。
- `ReaderTheme.js` 共享响应式偏好，仅持久化 `sidem_reader_theme`；刷新、重新进入、
  单段/整话切换保留选择。无效旧值回退到白色，存储被禁止或写入失败仍可切换。
- 通过 Reader 容器的 `data-theme` 和 CSS 变量切换画布、正文、译文、简介、选项、
  查找、按钮、标题和状态提示。手机底部导航在 Reader 存在期间同步主题，避免暗色底部亮白。
- 青绿作为角色名、激活按钮、细边线和焦点等局部强调；不作为正文的大面积底色。
  返回目录后主题变量退出，目录与其他资料馆页面继续使用原有配色。
- 主题操作不修改语言、Producer 显示名、来源 revision、行定位、文本身份或播放范围。

## 实际配色

| 主题 | Page | Card | 正文 | 译文/辅助 |
| --- | --- | --- | --- | --- |
| 极简白 | `#F8FAFC` | `#FFFFFF` | `#1E293B` | `#64748B` |
| 护眼暖阳 | `#F4EFE6` | `#FAF6EE` | `#3D352E` | `#746A60` |
| 深夜暗色 | `#111827` | `#1F2937` | `#E2E8F0` | `#94A3B8` |
| 315 事务所原版 | `#EBF3F5` | `#FFFFFF` | `#16333C` | `#526F77` |

背景与正文采用指导值；暖纸与原版的辅助字色小幅调深，以保持文字对比。
品牌细边线为 `#268579`，日间角色名为 `#23786E`，暗色角色名为 `#83C8BA`，
激活按钮为 `#247E73`。按相对亮度公式核对正文、辅助文字和角色名在 Page/Card 上的
最小对比度，四套分别为 4.55、4.60、5.72、4.69；激活按钮白字为 4.88。
这是颜色对比核对，不是健康效果验证。

## 验收与边界

- `npm run verify:reading`，包含新增 `verify:reading-theme`：阅读来源、视觉身份、
  导航、播放映射、Vue 模板与排版；主题默认值、重新加载、无效值及受限存储回归通过。
- 实际 Vue SSR 验证单段和整话四种 `data-theme`、工具栏辅助名称；原有 synopsis
  来源保护、真实长附文和 `appeal` 过滤继续通过。
- `verify:reading-sources`、`verify:reviewed-b001`、`verify:player-qa`、
  `verify:story-localization`、`verify:archive-presentation` 通过。
- `build:check` 与 `verify:build-audit` progress 检查：完整代码编译，复用
  `.analysis/build-check`，`copyPublicDir:false`，不创建完整媒体包。
- protected guard：6551 个受保护文件无改动；B001 的 52 文档、42 catalogues、993 单元保持身份。

实际 Browser 使用现有 `http://127.0.0.1:5197`，生产 bundle 由 build-check 提供，
public 与外部模型按原映射提供。保留用户原播放器，在独立 Reader 页验收。
默认窄窗口、390×844、1280×900：页面非空，无框架错误页，无横向溢出，Reader 控制台无 error/warn。
单段四套配色的 computed colors 与变量一致；整话继承、暗色刷新恢复、返回后退出主题、
语言状态与真实选项保留、篇内搜索 `appeal` 零命中均通过。暗色查找框、底部导航保持暗色。
临时 viewport 已恢复，验收页回到默认极简白。

小型证据在 `.analysis/reader-theme/`：`browser-colors.json`、`warm-desktop.png`、
`dark-desktop.png`、`light-mobile.png`、`warm-mobile.png`、`dark-mobile.png`、`game-mobile.png`。
没有执行部署、完整媒体打包或真实设备验收。
