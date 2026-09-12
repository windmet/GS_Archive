# SideM Growing Stars Archive — Claude Code 接手交接

> 2026-09-12 已核对新分支 `codex/p1-effect-texture-deps`：请先读
> [最新审计与交接](SIDEM_NEXT_WINDOW_HANDOFF_20260912.md)。本文件以下基线与待办保留为历史参考。

> 来源：Codex 完整会话导出整理。此文档是接手导航，不替代仓库本身。
> **仓库、Git diff、现有测试与仓库内最新文档始终是 source of truth。**

## 0. 接手后的第一件事

请先进入：

```text
E:\Web_build\SideM_Archived\web_viewer
```

不要立即修改代码。先执行并汇报：

```powershell
git status -sb
git branch --show-current
git log -8 --oneline
git rev-list --left-right --count 'HEAD...@{upstream}'
```

这份会话导出结束时的预期状态是：

- branch: `codex/archive-architecture-refactor`
- HEAD: `4bc5d7e` — `fix: load every Spine atlas page before constructing models`
- working tree: clean
- 已 push upstream

如果实际仓库已经前进，以实际仓库为准；不要 reset 回 `4bc5d7e`。

然后优先阅读这些仓库文档，按顺序建立上下文：

1. `docs/ARCHITECTURE_PHASE2_HANDOFF_20260909.md`
2. `docs/READER_PLAYER_NEXT_PHASE_20260909.md`
3. `docs/STORY_ASSET_PLAN_P1_20260909.md`
4. `docs/SPINE_ATLAS_PAGES_20260909.md`
5. `docs/READING_R3_MIGRATION_20260909.md`
6. `docs/STORY_PROJECTOR_CONTRACT_20260909.md`
7. `docs/PROJECTOR_SHADOW_ACCEPTANCE_20260909.md`
8. `docs/ARCHIVE_PRESENTATION_CONTRACT_20260909.md`
9. `docs/MOBILE_PORTAL_READING_ROADMAP_20260909.md`

同时查看 `package.json` 的当前 verify scripts；不要仅凭本文假定脚本名称没有变化。

---

## 1. 当前项目状态一句话

项目已经越过“门户 + Reader 原型”阶段：**移动门户、独立 Reader、Reader ↔ Full Player 定位往返、统一 playback controller、主线 Reading v2、展示层清理、E1 只读状态投影的多批覆盖均已落地；当前主线任务已经转到 Full Player 的 P1 资源计划、可信加载状态和预载执行链路。**

正式 pre-E 长稳仍按用户决定后置；不要把长稳重新提到当前 P1 之前，也不要因此阻塞当前开发。

---

## 2. 已完成且不要重做的主要工作

### 2.1 移动端迷你门户

已完成：

- 手机底栏从 8 个拥挤入口缩为“首页 / 门户”。
- 独立三列门户页承载 8 个入口。
- 使用游戏资源中的原版 `image_mobile_background_common.png`（315 Production 背景）。
- 门户往返可保留原页面及筛选条件，刷新与浏览器前进/后退恢复已验证。
- 320 / 390 / 430 手机宽度及桌面均做过真实浏览器验收。
- 门户冷启动不创建舞台 canvas，不主动加载舞台模型/剧情音频。

相关提交起点：`ea1135e`。

### 2.2 Reading / D1 数据层与独立 Reader

已完成：

- 建立 versioned ReadingDocument / ReadingRepository / manifest。
- Reader 正文按篇请求，而不是一次性载入全部剧情。
- 原文 / 译文 / 双语模式。
- 缺译回退、正文请求失败与重试。
- 刷新、history、门户往返可恢复分段、语言模式与阅读位置。
- Reader 冷启动不加载舞台和音频。
- 未可靠还原的剧情明确标为 unsupported，不把分支错误拼成连续正文。

关键历史提交：`60b141f`, `495ab55`。

### 2.3 Playback Controller / F

播放器的加载、预览、episode queue、范围和返回所有权已经从 `App.vue` 大幅收拢到统一 controller；不要重新把这些状态写回多个入口。

已验证：

- 同一剧情不同播放范围恢复。
- 下一话加载失败不会错误推进 queue cursor。
- 缺失剧情深链回到可用故事目录，而不是空白播放器。
- 播放器退出后舞台 canvas 释放。

关键提交：`6b3a52b`。

### 2.4 D2 Reader ↔ Full Player 往返

这一批已经完成，不再是 TODO。

核心契约：

- **播放范围**和**初始起播句**是两个不同概念。
- `startStep/endStep` 是完整可浏览范围；`initialStep` / `at_step` 只决定进入时落在哪一句。
- 从 Reader 某句进入演出后，仍可“上一段”回看前文。
- Player 返回后聚焦原 Reader row。
- Reader 深链携带 reading document、row、reading revision 与对应 scenario 范围；来源不一致时必须停在 Reader，不得先加载媒体。
- 迟到的 source verification / media request 不得在用户离开后重新打开播放器。

主线章节列表已经按 Reading manifest 只对 ready 的分段提供阅读入口。

关键提交：`4139ab1`。

### 2.5 主线 Reading 覆盖

主线 reading 产物已经扩展到两章公开主线：

- 共 204 份 ReadingDocument。
- 183 份 `ready`。
- 21 份明确 `unsupported`。

不要把 unsupported 文档伪装为可读。

关键提交：`7fea50a`。

### 2.6 Reader R1：产品界面收口

后续审阅认为 Reader 太“工具化”，已完成一轮收口：

- 普通界面撤下逐句“从这里演出”等高密度操作。
- 顶部保留“播放完整剧情（实验）”入口。
- 篇内搜索改为按需展开。
- 深链/返回锚点仍保留在数据与路由层，不因 UI 简化而丢失。
- 显式书签 UI 与 Reader 自动存储调用已撤下；深链、搜索与 Player 返回定位保留。旧 ReadingProgressStore 的存在不代表普通 UI 仍提供书签。

相关提交包括：`fa5af4e`（篇内搜索）、`1d52a25`（阅读进度）、`0292c8e`（R1 收口）。

### 2.7 Reader R2/R3：文本身份 / 表演主体 / 视觉身份分层

这是目前很重要的不可回退设计。

不要把以下概念重新合并：

```text
text identity / speaker label
    ↓
“？？？” —— 剧情文字尚未公开姓名

performance identity
    ↓
真实发言/表演主体，例如 047shu

visual identity / presence
    ↓
当前 step 的可见舞台证据决定是否能展示头像
```

典型样本：`1_4_001_00_a` 第 12 步。

- speaker 仍必须显示 `？？？`。
- compiled 中实际身份为 `047shu`。
- entry stage evidence 证明秀此刻可见，所以 Reader 可以显示秀头像。
- 头像 `alt/title/ARIA` 不得泄露“天峰秀”姓名。
- 搜索真实姓名也不能通过视觉身份把 `？？？` 这句命中为文本姓名。

ReadingDocument 已迁移到 **v2**：

- 204 份全部迁移。
- 原文、text refs、source SHA、speaker identity、row IDs、支持状态保持迁移前一致。
- v1 在读取边界明确拒绝，避免混用。
- 正式中文译文实际页面已验证。
- 真实头像 404 已验证：图片隐藏、无空白占位、正文和 `？？？` 不受影响。
- v2 → Full Player → 返回原 row 的真实往返已验证。

关键提交：`e4fca59`, `cc14b83`, `fc182b1`。

### 2.8 Archive 展示层清理 / Presentation Contract

这一轮不是当前 P1 主任务，但已经做完很多，不要重新把技术字段放回普通页面。

原则：

- 普通用户界面展示“产品语义”。
- 资源 ID、hash、来源/推导证据等技术信息放在 Technical Details / evidence 层。
- “已确认报酬”和“推导关联”不能因为隐藏 evidence 标签就变成同一种确定关系。

已覆盖 Songs、RelationList、Idol/Unit、Event、Gasha、Card、Story list / collection 等。

同时修复过：

- 313 条卡片剧情标题被误显示为“待确认”。
- card detail 资源键选择混入错误 canonical row，已对 826 张卡做来源一致性验证。
- 旧 story catalog snapshot 与现有 domain contract 不一致的问题。

重要提交：`fca33f1`, `86e86c8`, `7762aa3`, `78f016d`, `24e1cea`, `7a06913`。

### 2.9 E1 纯状态投影 / read-only shadow

E1 已经不是“尚未开始”。目前已有 pure projector + runtime read-only shadow，并扩过多轮覆盖。

已覆盖/验证的主要方向包括：

- background mix / settled background
- camera
- screen overlay/fade/wipe 首批范围
- background sprite geometry（桌面 + 手机真实视口）
- spine tint final state
- static background filter parameters
- filter transition 从显式 visual origin 投影
- step-owned filter origin 的实际运行时采集与累计时间 → step time 换算

约束：

- **E1 只能读、比对、报告；目前不拥有 renderer。**
- E2 尚未开始接管渲染。
- 不要为了“让 shadow 全绿”放宽容差或吞掉真实差异。
- spine tint 中间帧曾真实记录到约 7ms 的 projector/runtime timing 差异；结束态、下一步和回看恢复匹配。这个差异被有意保留为证据。

仍属于后续 E1 缺口/限制的典型项目：

- spine opacity / fade 等角色透明度状态
- body/face animation 的完整投影
- particles / 部分效果
- audio side effects
- 其他尚未纳入 contract 的命令域

相关提交包括：`c6659a3`, `dea4132`, `7029540`, `05faa2f`, `9bee872`, `513f458`, `961b7ea`, `d2a5d40`, `9097cd8`。

**当前不要切到 E2。** 当前最新优先级已经转到 Player loading P1。

---

## 3. 当前最新主线：Player P1 资源计划 / 加载链路

这是 Claude 应该从 `4bc5d7e` 往后继续的地方。

### 3.1 已完成：StoryAssetPlan 第一批“需求发现”

`shared/story/StoryAssetPlan.js` 已建立首版资源需求计划。

计划已经扫描/覆盖：

- entry / settled snapshots
- cues
- voice
- lip sync
- background
- audio
- Spine model
- 相关配置

已对 204 篇源数据做过验证。

但是目前它仍是 **requirements discovery**，不是完整可执行 preload plan。

当前计划会显式标记 unresolved dependencies，主要包括：

- atlas texture pages（这一项之后已经进一步修复，见下一节）
- effect mapping
- communication UI resources
- 其他运行时动态依赖

关键提交：`b01b875`。

### 3.2 已完成：Spine atlas 多纹理页加载修复

旧问题：Spine runtime 实际只主动加载 atlas 第一张纹理，其他页可能错误落到备用纹理，因此 `.skel` 下载完成并不代表模型 ready。

当前已修复：

- 新增共享 atlas page parser / manifest 逻辑。
- runtime 在创建模型之前等待 **全部 atlas pages**。
- 纹理按完整相对路径匹配。
- 任意页失败时停止创建模型。
- 现有单页 `comu.png` 兼容策略保留在适用范围；多页不能用同一备用图偷偷补齐。
- 纹理加载层原先的粉色 fallback 已关闭，缺页不能被误报为成功。

验证：

- synthetic multi-page atlas
- missing page
- delayed page
- scene switching
- 725 个本地 atlas 扫描（目前全部为单页）
- 真实序章秀模型渲染成功

浏览器中看到的两条 Pixi/Spine warning 是既有弃用/内部警告，不是这次新引入的应用错误；不要在没有新证据时把它们当作本批 blocker。

关键最新提交：`4bc5d7e`。

---

## 4. 现在真正未完成的工作（按优先级）

### P1-A. 补齐 StoryAssetPlan 的剩余真实依赖

先继续把“资源需求发现”做完整，不要立刻大改 UI。

优先核对：

1. effect mapping / effect texture dependencies
2. communication / phone / message presentation resources
3. 口型、表情、配置文件和动态派生 URL 是否全部进入 plan
4. atlas pages 已有共享 parser，确保 asset plan 与 runtime loader 使用同一份语义，不要各写一套解析

要求：

- 所有依赖必须可追溯到 canonical scene/cue/snapshot 或明确的 runtime derivation。
- unresolved 就明确 unresolved；不能为了让 progress 好看而假装 ready。

### P1-B. 从“需求计划”升级成可执行 Asset Plan

建立明确的资源生命周期，不再使用“任务 Promise settle 了就算成功”的旧思路。

至少区分：

```text
required
requested
loaded (bytes/network finished)
decoded / parsed
ready for runtime use
failed
```

不同资源的 ready 条件不同，例如：

- Spine：`.skel` + `.atlas` + 所有 atlas texture pages + 必要配置均成功并可被 runtime 构造。
- Audio：请求结束不等于 decode 后可播放。
- 图片/特效：下载结束不等于 Texture 可用。

**失败任务不得计入“已加载成功”的百分比。**

### P1-C. 替换旧 `Preloader.preloadScenario`

当前旧 Preloader 的核心缺陷曾被确认：

- 只扫 `step.state`，漏掉 strict-v2 / normalized snapshot / cue 中的资源需求。
- 预热范围主要是背景和 `.skel`，无法代表真实 scene ready。
- 失败 Promise 也可能被算进进度。

目标：让 playback controller 消费新的 asset plan executor，而不是继续堆 patch 到旧扫描器。

不要把 plan discovery 和 executor 混成一个大函数；保留清晰边界：

```text
canonical scenario
→ StoryAssetPlan (pure discovery / versioned requirements)
→ AssetPlan executor (I/O + lifecycle)
→ readiness/progress
→ playback controller
→ StoryViewer/runtime
```

### P2. 分层预载（buffering 属于 P3）

在 P1 ready contract 稳定之后再做：

```text
Critical → Near → Deferred
```

大方向：

- 首屏/当前 step 必须真正 ready 才进入演出。
- near-future 资源前瞻加载。
- deferred 资源不阻塞首屏。
- 播放追上尚未 ready 的资源时进入 buffering。
- buffering 结束只恢复“因 buffering 暂停”的播放；**不能清掉用户自己手动 pause 的状态。**

### P4 / P5. 缓存与网络故障验收

随后做：

- versioned URLs / stale asset 防护
- bounded audio cache
- 延迟请求
- 404 / 部分资源失败
- offline / reconnect 或可恢复失败路径
- 迟到响应不能污染已切走的 scenario

---

## 5. 暂时不要做的事情

除非用户显式改变优先级，否则：

- 不要重新把 pre-E 正式长稳放到 P1 前面。
- 不要开始 E2 renderer ownership migration。
- 不要引入 Pinia / Vue Router 之类大框架迁移来“顺便重构”。
- 不要做全库无目标重写。
- 不要用“扩大 schema / 大批重新编译所有内容”替代当前精确任务。
- 不要把 Reader visual identity 简化成 `unknown && entityId => show avatar`。
- 不要让视觉身份泄露进文本、译文、search index、alt/title/ARIA。
- 不要用假 fallback 让缺 atlas/effect 资源看起来成功。
- 不要修改 renderer 只为了让 E1 shadow 报告通过。

---

## 6. 正式长稳 / pre-E 的状态

用户多次明确要求 **继续后移**。

历史上曾计划在 E2 前做 2–4 小时真实音频混合长稳；后来因为用户长期使用已较稳定，以及外部 Browser 连接条件不足，决定不再阻塞当前开发。

因此当前正确表述是：

- formal pre-E soak **未正式 PASS**。
- 用户长期实际使用反馈良好，但不能替代正式验收。
- 它仍应在更后面的架构接管前补齐。
- 当前 P1/P2 不应等待它。

不要把“用户没遇到问题”写成 formal soak pass；也不要每次新会话都先要求做长稳。

---

## 7. 建议本次 Claude 接手的具体执行顺序

### Step 1 — 只读确认

1. Git 状态与最新 commit。
2. 阅读上面列出的 5 个最关键文档。
3. 查看：
   - `shared/story/StoryAssetPlan.js`
   - `shared/story/SpineAtlasPages.js`
   - `src/core/spineSpawnPipeline.js`
   - `src/core/PixiStageManager.js`
   - `src/utils/Preloader.js`
   - `src/core/useStoryPlaybackController.js`
   - `src/data/prepareScenario.js`
4. 查看 `package.json` 当前 P1 / atlas / playback 验证脚本。

先给用户一份不超过约 10 条的 current-state 报告，再改代码。

### Step 2 — 做 P1 的“依赖完整性差距审计”

针对 `StoryAssetPlan` 与真实 runtime loader 做双向 diff：

- runtime 实际可能请求什么？
- plan 是否全部枚举？
- plan 枚举的东西是否都有明确 ready condition？
- 哪些仍只能标 unresolved？

优先补 effect / communication resources；atlas pages 已完成，不要重写。

### Step 3 — 形成小批、可验证提交

建议第一批只做一个完整 command/resource domain，例如：

- effect textures，或
- communication UI resources。

要求：

- pure discovery test
- local real corpus test
- controlled failure/delay test（如适用）
- `git diff --check`
- 相关 build
- 浏览器仅做真实用户路径验收

通过后独立 commit + push 当前分支；不要默认创建 PR。

### Step 4 — 再开始 executor/readiness

只有 dependencies 足够闭合后，才开始替换旧 preloader。

---

## 8. 建议优先跑的回归（以当前 package.json 为准）

这些名称在 Codex 会话结束前存在或被使用过；先在 `package.json` 确认再执行：

```text
verify:story-asset-plan
verify:spine-atlas-pages
verify:reading
verify:reading-sources
verify:reading-visual-sources
verify:archive-async-navigation
verify:playback-controller
verify:story-projector
verify:archive-presentation
verify:archive-baseline:source-only
```

原则：

- 先跑与本次修改直接相关的 targeted tests。
- 再跑跨边界的 navigation/playback tests。
- 最后 build。
- 不要因为一个旧 snapshot 或旧 test expectation 失败，就直接修改生产代码；先判断它是不是已经被新的 named contract 合法取代。

---

## 9. 历史验收证据的位置

Codex 曾把大量浏览器证据写在：

```text
C:\Users\windm\.codex\evidence\...
C:\Users\windm\.codex\visualizations\...
```

这些是历史证据，可参考但不是运行依赖。Claude 不必为了接手复现每一张旧截图；如果当前代码或 docs 与旧证据冲突，以当前代码 + Git + 可重复测试为准。

`.analysis/` 下多次留有临时 build；此前 Codex 因本机策略不能自动删除。它们处于 Git ignore 范围，不要误加入 commit。

---

## 10. 与用户协作时需要保留的项目原则

1. **实事求是区分“代码测试通过”与“真实浏览器验收通过”。**
2. **不要把部分覆盖写成整体完成。**
3. **如果一个状态明确 unsupported，宁可保留 unsupported，也不要猜。**
4. **Reader 是轻量阅读入口；Full Player 是完整演出。二者共享 canonical story identity，但不应在 Reader 冷启动时加载重媒体。**
5. **剧情文本身份和视觉呈现分离。** 剧情没有公开姓名时，文字必须保密；视觉头像只能依据当时可见证据。
6. **当前重点是加载架构的真实性。** progress 必须表示真正 ready，而不是网络请求数量。
7. 代码要维持可维护性，避免再次把状态和 loader 逻辑堆回 `App.vue`。

---

## 11. 可直接给 Claude Code 的接手指令

```text
You are taking over the SideM Growing Stars Archive repository from an interrupted Codex session.

Repository:
E:\Web_build\SideM_Archived\web_viewer

The exported handoff expected branch codex/archive-architecture-refactor at commit 4bc5d7e with a clean worktree, but DO NOT assume that is still current. First inspect git status, current branch, recent log, upstream divergence, and the repository docs. The repository is the source of truth; never reset newer work to match this handoff.

Before editing, read:
- docs/ARCHITECTURE_PHASE2_HANDOFF_20260909.md
- docs/READER_PLAYER_NEXT_PHASE_20260909.md
- docs/STORY_ASSET_PLAN_P1_20260909.md
- docs/SPINE_ATLAS_PAGES_20260909.md
- docs/READING_R3_MIGRATION_20260909.md

Then inspect the current implementations of StoryAssetPlan, SpineAtlasPages, spineSpawnPipeline, PixiStageManager, Preloader, useStoryPlaybackController, and prepareScenario.

Do not redo completed Reader/portal/E1 work. The current priority is the Full Player P1 loading chain:
1. complete real resource dependency discovery, especially effect mappings and communication UI/runtime resources;
2. preserve shared atlas-page semantics already implemented in 4bc5d7e or later;
3. evolve the plan toward explicit required/requested/loaded/decoded-or-parsed/ready/failed states;
4. only after dependency coverage is credible, replace the legacy preloadScenario path with an executable plan and truthful progress;
5. later add Critical/Near/Deferred preloading and buffering without overriding user pause state;
6. then test cache/network delay/404/offline/late-response behavior.

Important contracts:
- ReadingDocument is v2; 204 docs, historically 183 ready / 21 unsupported.
- speaker/text identity, performance identity, and visual identity are separate. “???” must remain secret in text/search/accessibility even when a visible known idol avatar is allowed by entry-stage evidence.
- Reader must stay lightweight and must not cold-load the full stage/audio runtime.
- playback controller remains the owner of player loading/queue/range/return behavior.
- E1 shadow remains read-only; do not start E2 renderer ownership work unless the user changes priority.
- formal pre-E long soak is intentionally deferred and must not block the current P1/P2 work.
- failed assets must not count as successful loading progress, and missing multi-page atlas textures must never be hidden by a fallback.

Before making changes, give me a concise CURRENT STATE / COMPLETED / REMAINING / RISKS / NEXT ACTION report based on the actual checkout. Then continue with the smallest complete P1 resource-domain batch, verify it with targeted tests + build + real browser path where appropriate, commit it separately, and push the current branch. Do not create a PR unless asked.
```

---

## 12. 最后一个已知稳定点

会话导出的最后状态：

- 最新 commit: `4bc5d7e`
- commit message: `fix: load every Spine atlas page before constructing models`
- branch: `codex/archive-architecture-refactor`
- worktree: clean
- push: completed
- 下一任务：**继续补齐 StoryAssetPlan 剩余资源依赖，并逐步替换旧 Preloader；正式长稳继续后移。**
