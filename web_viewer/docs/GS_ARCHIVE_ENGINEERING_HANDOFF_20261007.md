# GS Archive 工程交接（2026-10-07 晚）

接替 `GS_ARCHIVE_UI_HANDOFF_20261007.md`。那份讲的是 UI 轮的收尾，留作背景，**以本文件为准**。

本文件写给接手的工程 agent。下一阶段是**纯工程工作**：
- 修检查脚本；
- 拆分 App.vue；
- 补数据与逻辑上的小缺陷；
- 维护工具链。

**界面设计不在你的职责内。**第 1 节的边界请先读完，再动任何代码。

---

## 1. 职责边界（必读）

### 1.1 你可以做的
- `scripts/` 下的检查与工具：修脚本、补断言、把检查接进 CI。
- 不改变任何外观和行为的重构：从 App.vue 抽出 composable、把模块挪位置、消除重复定义。
- 数据与逻辑缺陷的修复：第 4 节逐项列出，每项都写明了边界。
- 文档：交接、记录、清单。

### 1.2 你不可以做的（需要用户或主窗口拍板）
- **任何会改变外观的修改**，包括：
  - 改 CSS（颜色、尺寸、间距、字号、圆角、断点、动画）；
  - 增删或挪动页面元素；
  - 改界面文案。

  唯一例外：重构时为了保持外观完全不变，必须同步挪动的样式。挪完要证明前后一致，方法见 3.2。
- **设计令牌债**（`verify-design-tokens` 里的写死颜色和字号）。清理它等于改外观，不是你的事。
- **新的界面功能**：反馈入口、按钮、页面、弹窗。
- **翻译内容**：
  - 剧情、标题、台词归剧情翻译窗口；
  - 资料小字段（偶像资料、组合简介、通信签名、工作名称、任务句式）归主窗口；
  - 你只可以修翻译流程的**工具和检查**，不改译文。
- **`index.html` 的 `lang`**：见 4.6，等用户决定。
- **对外动作**：推送、部署、R2 上传，见第 2 节。

### 1.3 拿不准时
先停下来问。尤其是看到类似「这里顺手美化一下」「这个按钮放这里更合理」的念头时，那就是越界了。

### 1.4 不要碰的别人的工作
- **剧情翻译窗口**在同一个检出里工作，它的地盘包括：
  - `translation/studio/reviews/`、`translation/studio/` 下与 B00x / R3 相关的文件；
  - `public/translations/zh-CN/scenarios/`；
  - `scripts/lib/ai-studio-*.mjs`、`scripts/verify-ai-studio-*.mjs`、`scripts/verify-reviewed-b001.mjs`。

  工作区里看到这些文件有未提交的改动，那是它的，**不要暂存、不要还原**。
- **发布窗口**负责 `.deploy/release-20261007/`、`docs/QA_RELEASE_20261007_STOP_REPORT.md`，以及外部 read-model 目录 `E:\Web_build\GS_Archive_release_20261007\`。
- **提交规矩**：每次提交都用 `git add <明确路径>`，绝不 `git add -A` 或 `git add .`。提交前看一眼 `git diff --cached --name-only`。

---

## 2. 当前状态

- 分支 `codex/portal-architecture-cleanup-20261004`。远端在 `39d79ba2`，本地领先约 12 个提交，都没推送。**用户没说就不推送。**
- **测试页还没部署。**R2 上传和 read-model 重建（release `c6e0c04c…`）已完成，绑定提交是 `7bb09f81`。之后的 Pages 打包和线上核验（清单第 4、5 步）没有做。部署时机由用户定，按 `docs/GS_ARCHIVE_RELEASE_CHECKLIST_20261007.md` 执行。
- **当前 HEAD 能通过的检查**：
  - `npm run build:check`；
  - `npm run verify:source-batch`（100/100）；
  - `npm run verify:reading`、`npm run verify:editorial-source`、`npm run verify:archive-presentation`。

  最近一次在 LF 干净检出里全量跑 CI 门，是在 `77a49180` 之后：115 步中 113 步通过，1 步是跳过的 `npm ci`。那次唯一的失败已经修好。之后又有一些提交，**还没再全量跑**，这是第 3.1 项任务。

### 2.1 本轮已完成（不要重做）

| 范围 | 提交 |
|---|---|
| CI 门修红（脚下灯光、外部剧情入口、基线、启动路由、事件消费者、三个白名单、两个读语料的门步骤、翻译流程行数） | `3b0ab9fd` `0a97fb0a` `9f574186` `e79ed93f` `0c21db1f` `43feac61` `8676ef98` `95db952a` `b21921bf` `77a49180` |
| CI 覆盖：`config/verifier-coverage.json` 名单、批量检查、守门检查 | `75d7ec14` `3d4fd97d` |
| 内核边界：`src/core` 不再引用资料馆组件和展示层 | `4e74bf5b` `e1b81854` |
| strict-v2 认可 09-30 的选项重发（用户同意） | `2e98357e` |
| 阅读器头像：按日文原名识别偶像和 NPC（用户决定） | `412b6309` |
| 剧情默认显示中文（设置 v3 迁移、阅读器与播放器共用一个选择） | `d8f2d113` |
| 关于页（内容在 `src/content/aboutContent.js`） | `862f8bd5` |
| 个人故事页改用剧情页统一的章节行（样式挪进共享的 `archive-story.css`） | `1047a8d6` |
| 侧栏在矮窗口下不再出现宽滚动条；通信签名排版 | `c240d709` `4a29f28b` |
| 小人舞台 F/H 合并；摄影台触屏提示；章节名中文化；个人剧情页令牌化；随机话题说明；担当卡 logo | `47aba28e` `2198077a` `f2755ca3` `f8d70f6d` `bab8c3ad` `bbe2e414` |
| 通信解锁条件句式翻译；首页故事标题与工作场景名接上现有译文；资料小字段翻译（profiles 分类） | `4e8b1365` `6cea54ae` `eacaec07` |
| 页面日文巡检工具 `scripts/audit-visible-japanese.mjs` | `f7bd4cc0` |

---

## 3. 必须遵守的验证方法

### 3.1 CI 门以 Linux 式的干净检出为准
本机主检出挂着 gitignore 的语料，文件又是 CRLF，在这里跑绿**不能**说明 CI 也绿。具体方法见记忆「CI clean-checkout recipe」：

1. 建 LF 工作树：`git -c core.autocrlf=false -c core.eol=lf worktree add --detach <scratch>/wtlf HEAD`（两个 `-c` 都要加）。
2. **不要**在工作树里执行 `git config`。工作树和主检出共用 `.git/config`，会把主检出的设置一起改掉。
3. `node_modules` 用 junction 链接回主检出。
4. Python 检查用 `python -S` 跑，模拟 CI 没装第三方包的环境。
5. 跑门的方法：从 `.github/workflows/web-viewer-source-gate.yml` 里逐个取出 `run:`，交给 `C:\Program Files\Git\usr\bin\bash.exe -c` 执行（不要用裸 `bash`，那会调到 WSL）。设置 `PYTHONIOENCODING=utf8`，否则输出里遇到 ✔ 这类字符会因 GBK 编码崩溃。
6. 跑完删掉工作树：先断开 junction，再 `git worktree remove --force`。

### 3.2 重构必须证明外观和行为不变
- **改之前**，在 390 和 1280 两个宽度下，给受影响的视图截图。截图方法见记忆「Browser acceptance recipe」，或复用 scratchpad 里的 `ui-check.mjs` 写法。
- **改之后**用同样的条件再截一次，逐像素或肉眼对比。有差异就要能解释，否则回退。
- **检查必须做反向测试**：把修复改回坏的版本，确认检查真的会失败；然后还原。没做反向测试的检查不算数。

### 3.3 开发服务器
- **5175 是用户起的，不要重启也不要关。**它只在启动时登记 `public` 下有哪些文件，之后新放进去的文件它读不到，请求时会返回一份 HTML 200，看起来像成功。
- 要验证新文件，另起一台：`SIDEM_READMODEL_CANDIDATE=E:/Web_build/GS_Archive_release_20261007/rm-20261007 node node_modules/vite/bin/vite.js --configLoader native --port 5177 --strictPort`，用完关掉。
- 编译检查只用 `npm run build:check`。**绝对不要** `vite build` 或 `npm run build`，那会把 8 GB 语料拷进 `dist/`。

### 3.4 检查名单
- 新写的 `verify-*.mjs` 必须登记进 `config/verifier-coverage.json`：要么进 `batch`（不依赖语料、不需要网络、Node 原生能跑），要么进 `localOnly` 的某个分组并写明原因。`verify-verifier-coverage` 会强制检查这一点。
- 分类、名单这类定义只能有一份。生成器、运行时、检查要从同一处导入，不要各写一份镜像。这一轮已经因为三处各写一份 shard 名单出过错。

---

## 4. 待办（按建议顺序）

### 4.1 在干净检出里全量跑 CI 门（先做）
- **做法**：按 3.1。
- **验收**：115 步中 114 步通过、1 步跳过（`npm ci`）。有失败就查清原因再修；修完单独复跑那一步，再全量跑一次。
- **注意**：剧情翻译窗口今天又提交过草稿（`422bec61` 等）。它每次发布草稿后，都要重新生成翻译审计、搜索本地化、`reader-titles`、发布清单，并更新 `scripts/verify-general-translation-workflow.mjs` 里写死的主线草稿行数（现在是 1990）。如果失败原因正是这类漏生成，你可以重新生成，提交时只暂存这几个生成文件，并在提交说明里写明「为翻译窗口的草稿补生成」。**不要改译文本身。**

### 4.2 把 5 个按源码文本断言的检查改成测行为
名单在 `config/verifier-coverage.json` 的 `localOnly.pending`：
`verify-archive-loading-copy` `verify-idol-communication-readiness` `verify-idol-navigation-ux` `verify-song-domain-landing` `verify-song-playback-audio`

- **问题**：它们用正则匹配 App.vue 的源码文本，App.vue 一改就失效。这也是拆分 App.vue 前必须先处理掉的护栏。
- **做法**：参照 `verify-archive-startup-route.mjs` 和 `verify-reading-navigation.mjs`：从 App.vue 里取出**真实的函数**放进沙盒执行，或者把逻辑抽成纯函数后直接导入测试。沙盒缺什么依赖，就补**真实模块**，不写镜像替身。
- **验收**：
  - 每个检查都通过，并且做过反向测试；
  - 挪进 `batch`；
  - 在干净检出里通过。

### 4.3 拆分 App.vue（4.2 完成后）
- **现状**：5181 行、219 个顶层函数、约 140 处 `ref`/`computed`。
- **顺序**：歌曲/舞台 → 摄影 → 故事 → 门户。每次只抽一个视图族，一次一个提交。
- **规则**：
  - 只抽逻辑（composable），**模板和样式不动**；
  - 每次抽完都按 3.2 截图对比，并跑 `build:check`、批量检查、阅读检查和相关的门步骤；
  - App.vue 只用 Read / Grep / Edit 修改，不要整文件重写；
  - 不要往 `archiveStats` … `idolPickerLabel` 那段插新代码，`verify-archive-home` 会在沙盒里执行它；
  - `src/core` 不得引用 `components/archive/**` 和 `presentation/**`，`verify-core-boundary` 会检查。
- **第一个可以抽的**：小人舞台的 `stagePerformanceMapping` 和 `stageOriginalSlotOrdered`，已经集中在一处。
- **验收**：每一步截图无差异、检查全绿，并且 App.vue 行数确实在减少。

### 4.4 个人故事连播时「下一段」显示剧集编号（数据 / 逻辑缺陷）
- **现象**：从个人故事页连播时，播放菜单里显示「下一段 · 2010102」，用的是剧集 id，而不是「EP02」。
- **原因**：个人故事的剧集记录没有 `label` 字段，`useStoryPlaybackController` 的 `nextTarget` 就退回用 `segment.label || segment.id`。剧集名其实在 `episode.name` 里（「エピソード2」）。
- **边界**：在**数据层**补上标签，在 read-model 投影或排队时把 `name` 映射成 `label`，不要改播放器的界面。
- **验收**：
  - 加一条检查，用个人故事的真实数据断言 `nextTarget.label` 的格式化结果是 `EP02` 这类；
  - 浏览器里从个人故事页点 ▶ 进播放器，菜单显示「下一段 · EP02」。

### 4.5 巡检工具补全（工具层）
- `scripts/audit-visible-japanese.mjs` 里，「card detail」和「event detail」两页一直报「nothing to open」：点击用的选择器不对，所以这两页从来没被扫过。
- **做法**：参照对应页面组件，改成真实的入口选择器，或者直接构造详情页的网址。
- **验收**：这两页能被扫描。扫出来的日文按它们现有的类别列进交接（本来就保留原文的 / 剧情文本 / 资料小字段），**不要自己去翻译**。

### 4.6 `index.html` 写死了 `<html lang="ja">`（等用户决定，你不要做）
- 整站被标成日文，影响屏幕阅读器，也影响中日共用汉字的字形。
- 改成跟随界面语言，要逐处给日文原文补上 `lang="ja"`，会改变全站的字体渲染，所以必须由用户决定。你只需要在交接里保留这一条。

### 4.7 38 个依赖语料、只能本地跑的检查做一次体检
- 名单在 `config/verifier-coverage.json` 的 `localOnly.corpus`。
- 在**主检出**（挂着语料）里逐个运行，每个限时 90 秒。记录哪些通过、哪些失败，失败的按原因分类（语料变化、断言过时、脚本本身出错）。
- **只修脚本本身的错**。凡是要改数据或基线的，先写进交接再问用户。
- 同时记录 `scripts/terminal/verify-terminal-contracts.mjs`：它期待新访客默认进入 `home`，但 10-05 起默认是 `portal`。它不在 CI 里，改正期望值即可，记得做反向测试。

### 4.8 反馈问卷接入（等用户给问卷链接；界面部分不归你）
- 用户会建好腾讯问卷或问卷星，题目设计见上一轮的对话记录：问题类型单选、描述、截图上传、设备、隐藏的来源页面、联系方式。
- **你能做的**：把链接写进 `src/content/aboutContent.js` 的 `contact.links`。这只是内容，不改布局。
- 「报告此页问题」入口要放在侧栏、阅读器和播放器的菜单里，涉及界面，**归主窗口做**。

---

## 5. 参考

- **记忆索引**：`C:\Users\windm\.claude\projects\E--Web-build-SideM-Archived\memory\MEMORY.md`。重点看这几条：
  - CI clean-checkout recipe；
  - Verifier must be mutation-tested；
  - Single source of truth rules；
  - Reuse existing systems；
  - No direct vite build；
  - Browser acceptance recipe。
- **发布流程**：`docs/GS_ARCHIVE_RELEASE_CHECKLIST_20261007.md`。
- **设计方向**（只供理解，不改）：`docs/GS_UI_CONSTITUTION.md`。
