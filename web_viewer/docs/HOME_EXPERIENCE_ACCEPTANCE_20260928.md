# Home / Portal 修复与验收（2026-09-28）

基线：`codex/gs-architecture-rebuild` / `1b68e08`。新审阅以 `49c97a9` 为基线；新增的 `1b68e08` 为文本候选审计，本批保留。参考 `919b252` 的姓名牌 CSS，没有回退整个工作区。

## 修复结果

- “首页”导航始终进入 Home 或首页人物选择，Portal 保持资料入口。Welcome 提供卡牌首页 / 人物互动首页，两者都选择偶像；旧 `light → card`、`immersive → spine`，保留 startupIdol、preferredIdol、onboardingComplete。旧 light 缺偶像时优先复用“我的偶像”，否则选择一次后保存。
- 保留 `ArchiveImmersiveHome.vue` 的组件路径作为共享 Home owner，加入纯展示 `ArchiveCardHomeStage.vue`，不复制音频、台词、设置或路由。card 复用 `useVoicePlayer`，关闭口型/人物动画准备；人物模式保留原 SpineStage 的背景和服装合同。
- Home 的 `cardKey` 与 Terminal 的 `wallpaperKey` 独立。仅从当前偶像的成对 SSR 目录中选择，缺省按 ID 排序取确定性默认值；换偶像不显示前一个人的卡面。portrait/landscape 使用同一条目的配对资源。
- 姓名牌恢复透明底、白字阴影、偶像代表色色条；桌面和手机选择器使用 ArchiveIdolAvatar。修复手机旧 `> span` 规则误裁剪头像的问题。
- 删除 Home 活动浮窗及 App 事件接线；readmodel 中的 highlights 仍保留，本批不宣称减少该 JSON 体积。
- dialog 由 `settingsOpen` 控制挂载，内容与容器同生命周期，close/cancel/完成统一同步并恢复焦点。
- focus 为当前 Home 实例状态，隐藏 Shell 导航及 Home 控件，保留姓名、台词、退出按钮；支持 Esc，刷新恢复普通布局。额外修复加载提示层仍占第二列造成的 36px 白边。
- renderer 切换取消旧的台词点击操作与延迟自动语音，重新准备后续语音；卸载清除自动语音计时器。

## 验收环境

Browser plugin not available（本会话未提供 browser 技能），使用已有 Playwright Chromium，无新增依赖。实际页面：`http://127.0.0.1:5202/`，标题 `SideM Story Viewer`。尺寸：1440×900、390×844、1024×768。

最初本地 Vite 5200 的入口请求超时，未拿它作验收依据。最终服务映射：

- HTML / JS / CSS：本批 `.analysis/build-check`（最终编译通过）。
- `/data`、本地媒体：当前 `public`，card-art 可映射现有外部资源目录。
- `/_catalog`：已有 `.deploy/terminal-preview-2d3f1ce/dist/_catalog`，与本次构建内嵌的 bootstrap release `409c9f9e2f5f010da609a44c15f9b6f5bc15329c86d2969bf90b22f20d81cdd9` 相符，并经过现有 readmodel 客户端哈希校验。没有加载旧包的 HTML/JS/CSS。

没有复制 public corpus，没有创建新的完整媒体包。既有未跟踪 `public/data/terminal/`、v9 HTML 和其他无关文件保留原状。

## 浏览器结果

| 检查 | 结果 |
| --- | --- |
| 页面 URL/标题、正文非空、框架错误遮罩 | 通过 |
| 卡牌首次选择 → 神楽麗 → 保存“我的偶像” | 通过；v2/card/008rei 保存正确 |
| 桌面卡牌画面 | 横图正常；首次进入无 canvas、无 skel/atlas 请求 |
| dialog 连续 3 次打开/完成、Esc、原生 close | 通过；无残留 open dialog / 空白壳 |
| 切换 SSR A/B | 生效；只修改 Home 偏好，不写 Portal 壁纸偏好 |
| 专注进入/退出/Esc/刷新 | 通过；1440px 满宽、侧栏与控件隐藏，刷新不持续专注 |
| 真实语音 / 点击画面下一句 | 通过共享播放成功标识、cue/voice 更新；非人工听音验收 |
| 卡牌 → Spine → 卡牌 | 通过；真实人物和背景可见，台词 owner 保持一致 |
| 手机画面 | 配对竖图、头像可见、无横向溢出 |
| 手机 Portal → 底栏首页 | 进入 Home，不再原地停在 Portal |
| 旧 light 有 preferredIdol / 无任何偶像 | 分别直接进入 card Home / 选择后保存 startupIdol |
| 目录注入 503 → 重试 | 保留台词及重试按钮；恢复后加载真实横图 |
| 1024×768 横屏、换偶像 | 横图正常；卡面与姓名同步切到冬马 |

主流程 20 项、补充边界 4 项通过。未发现应用异常；控制台保留以下解释过的限制，不能写成“零错误”：切换人物模式后，神楽麗下一句的两条可选 lipsync 查找路径返回 404（`adxlip/008rei/2_2_008_01/2_2_008_01_00_09.json` 和 `adxlip/main/2_2_008/2_2_008_01/2_2_008_01_00/2_2_008_01_00_09.json`），**后续纠正：这些文件存在于配置的外部 lipsync 目录，之前仅检查 public 且临时预览服务漏了映射，不能据此认定素材缺失。映射和 Home 就绪竞态的修复见 [口型验收补充](HOME_LIPSYNC_ACCEPTANCE_20260928.md)。**另有 Chromium GPU ReadPixels 性能提示及 Pixi Spine update/tint 弃用提示；画面正常。card 模式不准备 lipsync。

QA 脚本、JSON、截图位于仓库外 `E:/Web_build/SideM_Archived/.analysis/home-experience-qa/`：`acceptance.mjs`、`edge-cases.mjs`、`results.json`、`edge-results.json`、`card-desktop.png`、`focus-desktop.png`、`spine-desktop.png`、`card-mobile.png`、`card-tablet.png`。截图已实际查看确认。

## 自动回归与边界

以下通过：`npm run verify:home`（含新增偏好/卡面合同回归）、`npm run verify:archive-startup-route`、`npm run verify:portal-navigation`、`node scripts/terminal/verify-terminal-contracts.mjs`（40 checks）、`npm run verify:home-neck-contract`（source-only）、`npm run build:check`、`git diff --check`。

尚未覆盖 iOS/Safari 真机、人工听音、长时间播放、所有偶像服装组合。此次为本地构建验收和源码提交，不是测试站或生产部署验收。
