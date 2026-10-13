# 2026-10-13 晚间交接：整合分支、称号贴图排查、短链接进度

- 分支：`claude/native-relations-integrated-20261013`；worktree `E:/Web_build/GS_Archive_Domain_Work/native-relations-integrated-20261013`。
- 本文写入时的输入 HEAD 为 `de3e2f2d`；本文与 Vite 预警告在其后的一次提交中加入。全部只在本地，未推送、未部署。
- 本日实施细节见 [原版关联修正实施记录](NATIVE_RELATION_IMPLEMENTATION_20261013.md)。

## 一、分支关系（以后以本分支为准）

| 分支 | 状态 |
| --- | --- |
| `claude/native-relations-integrated-20261013` | **继续开发的分支**。基线是 `claude/portal-image-budget-20261013`（含 L0–L2 路径地址、head 外壳、门户 CLS 修复与图片延迟加载），合并了 `claude/native-runtime-fidelity-20261013`。 |
| `claude/native-runtime-fidelity-20261013` | 已并入。它仍带已撤回的首页「原版」抽选，不要再从它发版。 |
| `claude/portal-static-route-20261012` | 是 image-budget 的祖先，已包含在内。 |
| `claude/preview-image-edge-cache-20261013` | 实验分支，按其结论不合入。 |
| `claude/portal-ssg-experiment-20261013` | 实验分支，标注 not for merge。 |

read-model 候选：`E:/Web_build/GS_Archive_Domain_Work/rm-native-relations-integrated-20261013`，release `b3c1f13a32f5098e46b5aa793ee3f7f89a25fc65d03e2256c7d47f792bfde32b`（由 `47d518ae` 生成，此后只改了文档、Vite 开发警告和撤回原版抽选后的一处括号，数据产物不变）。正式发版仍需按发布清单重建候选并同步 `readmodels/bootstrap.inline.json`。

Codex 侧更新 5212：切到本分支，用 `SIDEM_READMODEL_CANDIDATE=<上面的候选>` 启动。

## 二、称号贴图「消失」排查

**结论：只发生在新 worktree 的本地预览（5177）上，代码、读模型与线上都正常。**

- 称号图片地址是 `/assets/domain-images/image/image_honor/...`。开发时它不在 `public/` 里，而是由 Vite 中间件 `sidem-domain-images` 从本机 `GS_Res/ALL_PHOTOS/assets/resources` 读取。
- 这个本机路径来自被 git 忽略的 `config/archive_sources.local.json`。新 worktree 没有这个文件，就回退到 example 配置，路径不存在，中间件放行，Vite 返回首页 HTML，图片显示为缺失。
- 同一配置还决定 `/assets/card-art`（卡面原图）、`/assets/audio`、`/assets/lipsync/adxlip` 和旧语音目录。这些在当时的 5177 上也一并失效。
- 修复：复制该配置后，从候选读模型中抽出的 7,349 个 `/assets` 引用里，按 1,508 个目录分组抽样 3,102 个，5177 与 5212 全部返回正确类型（含称号图）。线上 `gs-archive-preview.pages.dev` 与 `preview.gs-archive.com` 的称号图片均为 200 `image/webp`（由 R2 提供）。
- 防再犯：`vite.config.js` 启动时检查这些本机素材根目录，缺失时打印 `local media roots not found: ...`。

同类风险（下列文件都被 git 忽略，新 worktree 都要自己补齐）：

| 缺什么 | 表现 | 补法 |
| --- | --- | --- |
| `config/archive_sources.local.json` | 称号、卡面原图、音频、唇形同步失效 | 从主工作区复制 |
| `public/assets/{bg,cards,spines,voice,…}`、`public/data/compiled` 等语料 | 页面缺图，播放器无法载入剧本 | 整个目录不存在时用目录联接；目录里有被跟踪文件时（如 `compiled`、`events`）用 `cp -rln` 硬链接补缺，不复制 |
| `core.autocrlf=true` 把 LF 文件检出为 CRLF | 依赖字节哈希的校验失败（如 `verify-extra-story-visuals`、`verify-event-resource-graph`） | 按 `git cat-file` 的原字节改写，再 `git add -u` 刷新索引（暂存区应为空） |
| `node_modules` | 无法构建 | 依赖一致时联接主工作区的目录 |

另外：`build:check` 会按 worktree 里的本地素材重写 `config/resource-audit.json`。在素材不全的 worktree 里，这份结果不能提交，应恢复。

## 三、短链接（路径地址）推广进度

计划见 [门户静态化路线](GS_ARCHIVE_PORTAL_STATIC_ROUTE_PLAN_20261012.md)，各阶段记录 L0/L1/L2、[性能基线](GS_ARCHIVE_PORTAL_PERF_BASELINE_20261013.md)、[SSG 实验](GS_ARCHIVE_PORTAL_SSG_EXPERIMENT_20261013.md)、[测试站发布](GS_ARCHIVE_PORTAL_TEST_DEPLOY_20261013.md)、[图片预算](GS_ARCHIVE_PORTAL_IMAGE_BUDGET_20261013.md)。

### 已完成

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| L0 | 偶像、Unit 详情的地址只保留身份参数 | 完成 |
| L1 | `/idols/<id>/`、`/units/<code>/` 路径地址，可读、可写、可往返，旧 `?view=` 链接照常可用；全部 49 位偶像与 16 个 Unit 已逐一往返验证 | 完成 |
| L2 | 65 个实体 head 外壳（title、description、OG、canonical）与标签页标题；打包后生成，`/idols/*`、`/units/*` 不缓存 | 完成，已接入预览打包 |
| L3 | 冷加载基线（headless，模拟手机） | 完成；真机数据未补 |
| L4 | 两页 SSG 实验，结论是不迁 Astro | 完成 |
| L5 ① | 把 L1+L2 发布到测试站与 `preview.gs-archive.com` | 完成（用户授权）；正式站未动 |
| L5 ② | 门户 CLS 0.68 → 0 | 已上 preview |
| 图片预算 | 门户首屏以下图片延迟加载 | 已上 preview |

本分支在此基础上加入：资料页自我介绍；从资料页进播放器后，返回仍回到 `/idols/<id>/`（冷启动的播放器 URL 也能恢复）。

### 未完成（按建议顺序）

1. **用户确认项**
   - 在 X、Discord、LINE 粘贴 `https://preview.gs-archive.com/idols/001tom/`、`/units/05w00/`，看分享卡片。
   - iPhone、Android 真机走一遍。
   - 是否放开整站的 `X-Robots-Tag: noindex, nofollow`：不影响分享卡片，影响搜索收录。
   - 是否把正式站迁到 `gs-archive.com`。
2. **正式站发布**：用本分支重建 read-model 候选，按发布清单打包（`prepare-readmodel-preview` / `assemble_pages` 都要生成外壳），部署需用户授权。正式站目前还是 10-12 的 `?view=` 版本，**正式站发布前不要对外推广路径链接**。
3. **扩展路径地址**：现在只有偶像和 Unit 有路径。下一批建议是卡片 `/cards/<id>/`、歌曲 `/songs/<code>/`、活动 `/events/<id>/`。
   - 每扩一类，先把该视图加入 `ENFORCED_ROUTE_VIEWS`（路由 schema 审计的批次 F/G）。
   - 再在 `archiveRoute.js` 加路径读写，在 `verify-archive-path-locator.mjs` 里全量往返，在 `generate-entity-head-shells.mjs` 里加外壳。
   - Reader、Player、Home 按原计划不改格式。批次 E（Reader 链接默认不带 `reading_rev`）仍未做。
4. **大图分享卡**：现在 148px 头像只够 `summary` 小卡；要 `summary_large_image`，需要另备 1200×630 图。
5. **L5 ③ 缩短串行链**：在入口脚本里更早发起 read-model 请求，预计省 0.5–1 s，需要完整导航回归。
6. **缓存**：迁到自定义域名后，用 zone 的 Cache Rules 缓存 `/assets/voice/*`、`/assets/spines/*`、`/data/*`。这些 URL 不带数据版本，换 R2 快照时要清缓存。zone 浏览器 TTL 建议改为 “Respect Existing Headers”。这两项都需要控制台权限。

## 四、其他待办

- 首页「原版」抽选：已撤回，现在是待办（`src/data/homeVoiceDecider.js` 和测试保留，未接入）。接入前要先定下点舞台时如何离开当前时段、切到卡面语音。
- 卡池告知视频：27 条推定关联只显示文字；转码需要 CRI 密钥，上传 R2 需要授权。
- 交接第五节的运行时数据：trackTime 历史回填、空表情继承、cue 去重。
- 工作剧情投影读不了 runtime-v2 剧本格式：完整重生 `work_story_index.json` 会丢标题和背景。改造前只能做字段迁移。
- 自我介绍的方法体 `IdolProfileView.OnClickVoiceButton` 尚未反编译。目前结论来自字段与方法声明、表数据和脚本文本的一致。

## 五、本地服务

- 5212：用户的 Codex 预览，跑的是主工作区。
- 5177：本 worktree 的预览，用上面的候选启动，已带本机素材配置。用完关闭。

## 六、推送与 preview 部署（用户授权，同日 22:50 前后）

- 推送：`claude/native-relations-integrated-20261013` 推送到 `origin`，HEAD 为 `96294431`（release 绑定提交：`bootstrap.inline.json`、`contracts/routes.json`、`portal_card_facets.json`、`collection-browse.v1.json` 都改为 `b3c1f13a…`）。
- 打包：`node scripts/prepare-readmodel-preview.mjs --models E:/Web_build/GS_Archive_Domain_Work/rm-native-relations-integrated-20261013 --out .deploy/preview-20261013-96294431 --data-revision 854190ad… --origin https://preview.gs-archive.com`。共 10,972 个文件 / 163,115,796 字节；`verify-entity-head-shells --dist` 通过。
- 部署：Pages 项目 `gs-archive-preview` 的分支 `gs-architecture-device-test`，固定地址 <https://dcffcce5.gs-archive-preview.pages.dev>，`preview.gs-archive.com` 指向它。覆盖前的版本是 `9c136d94`，为本提交的祖先。正式站未动，R2 未改。
  - wrangler：项目里没有安装，`npx` 会去下载新版本，这次直接调用 npx 缓存里的 4.149.0（`npm-cache/_npx/32026684e21afda6`）。
- 线上核对：
  - 回执的 source 为 `96294431`，release 为 `b3c1f13a`，外壳指向 preview 域名。
  - `/idols/047shu/` 外壳标题为「天峰秀 · GS Archive」；自我介绍用到的剧本 `3_x_047shu_9_2_047.json`、语音 `9_2_047_00.m4a`、称号图片都是 200。
  - 本机到 `preview.gs-archive.com` 的 TLS 时通时断，这是本机网络问题，同样的内容改用 `pages.dev` 地址核对。
- **未闭环**：`verify-portal-path-locator-browser.mjs` 对新部署跑了三次，结果不一致：
  - 第 1 次未见失败（只看了末尾输出）。
  - 第 2 次 19/20，P8 失败。
  - 第 3 次 15/20，P5–P8 失败。
  - 失败的共同现象是：后退或冷启动之后落到 `/?view=home&home_idol=002sht…`。
  - 还没有用同一个脚本跑上一版部署做对照（那次运行被中止），所以还不能区分是本批引入的回归，还是原来就不稳定。**这是短链接分支的第一项工作。**

## 七、首页「变慢」与播放器语音晚到

### 首页（`?view=home&home_idol=045sor`）

读模型数据：cue 分页 3 页 → 5 页（46 → 67 句），解压后多约 62 KB；首句模型都是 `045sor_002_00`。另外多一张事务所背景（首句改成通用语音后，用它的背景，约 226 KB）。

无头浏览器冷加载实测，舞台就绪时间：

| 部署 | 第 1 轮 | 第 2 轮 |
| --- | --- | --- |
| 旧 `05fafaa1` | 10.7 s | 5.5 s |
| 新 `dcffcce5` | 8.7 s | 5.4 s |

差异在网络噪声范围内。新部署刚上线时，新文件名的读模型分页还没进边缘缓存，首访会慢。

可以优化的点：`useHomeNavigation.loadHomeIdol` 要等**全部** cue 分页到齐才显示首页。可以先显示首句所在的那一页，其余分页后台补齐。

### 播放器：动作先做完、语音后到、口型不动

复现地址：`/?view=player&…&scenario=3_x_004ter_9_2_004.json&return=idol_detail`。

根因：
- `src/core/useStepSceneEffects.js` 预留了 `takePreparedVoice`，但播放器里没有任何地方提供它，所以每一步的语音都是**进入该步才开始下载**。
- Spine 动作由剧情时钟照常推进，不等语音。首访冷缓存时语音要几秒，表现为动作做完才出声。刷新后语音已在缓存里，所以正常。
- 加载中只有 1.5 秒后才出现的「语音加载中」小字；重试按钮要等 20 秒超时、状态变成 unavailable 才出现。

口型没挂上的原因还没确认。口型曲线是和语音并行加载的（8 秒超时）。需要在限速网络下复现，确认是曲线超时、还是动作轨道已经结束。

建议的策略：
1. 打开剧本时预取前 N 步的语音与口型（自我介绍这类短剧本取全部）；播放过程中提前预取下一句。用 `prepareVoice` 填上 `takePreparedVoice`。
2. 进入有语音的一步时，如果语音还没就绪，剧情时钟（动作、表情）**等待语音，并设上限**（例如 3 s）。超过上限就按现在的方式无声推进，并显示明显的「重新播放语音」按钮，不再等 20 s。
3. 语音晚到时，从语音开始的时刻重放这一步的动作，或至少重新挂上口型。具体用哪种，以原版行为为准（待查 `StoryView` 的语音与动作同步逻辑）。
4. 回归：在限速 / 冷缓存条件下验证自我介绍、普通剧情首句、自动播放和跳过。

这一项会改播放器核心，和舞台小人接线、短链接都不是同一块，建议单独开一批（见下节分工）。

## 八、分支分工（基于 `96294431`）

| 分支 | 负责 | 范围 |
| --- | --- | --- |
| `codex/stage-chibi-wiring-20261013` | Codex | 舞台小人接线。改动集中在 chibi 舞台相关模块；不改 `archiveRoute.js`、路由 schema、head 外壳。 |
| `claude/short-link-paths-20261013` | Claude | 短链接：先查清第六节的路径定位不稳定，再把路径地址扩展到卡片、歌曲、活动（每类先进入 `ENFORCED_ROUTE_VIEWS`）。 |
| （另开）播放器语音预取与等待 | 待定 | 第七节的语音策略。 |

两边都会碰到的文件：`src/App.vue`、`readmodels/bootstrap.inline.json` 及 release 绑定的四个文件。约定如下：
- 只有需要发 preview 的一方重新生成候选并绑定 release，单独做一个 `chore: bind …` 提交。
- 合并时以后合入的一方为准，重新生成并绑定。
- preview 同一时间只部署一个分支；部署前在交接里登记来源提交。

## 九、语音预加载（分支 `claude/player-voice-preload-20261013`，基于 `0f711c9f`）

问题：首次访问时动作播完语音才到，口型也没挂上，刷新后正常。原因有三：
- 播放器没有预取。每句语音都是进入该句才开始下载。
- 9 月的「等语音就绪」门禁会无限等，已于 `1a4d9423` 撤掉，之后动作完全不等语音。
- 口型请求有 8 秒期限，从准备语音时开始计时。语音慢于 8 秒时，口型请求先超时，之后不再重试。

改动：
- **预取**：每句进入可播放状态后，下载并解码后面 3 句的语音，同时预热口型；同时最多 2 个请求。语音不超过 8 句的短剧本（如自我介绍）一次全取。换剧本时取消旧剧本的预取。预取不写入当前句的诊断信息。
  - 位置：`story-runtime/VoiceLookahead.js`、`useVoicePlayer.prefetchVoice`。
- **有上限的门禁**：动作最多等本句语音 2.5 秒（`VOICE_GATE_MS`），等待时显示「正在准备语音…」。超时后照常播放。语音缺失或失败不会阻塞画面，也不参与冻结画面（frame hold）。门禁里已经发出的请求直接交给播放（`playVoice({ pending })`），不重复下载。
- **口型共享请求**：同一路径只下载一次。调用方超时只是放弃等待，下载会继续并写入缓存；所有调用方都取消后才中止下载。语音开始播放时，如果口型此前超时，会重新取一次（`VoiceLipStore.js`、`playPreparedVoice`）。
- **对话框**：本句语音晚于门禁时，立即显示「正在准备语音…」，4 秒后出现「重新加载语音」。语音晚到并播放后，显示「重播本句语音」。

验证：
- 新增 `verify-story-voice-preload.mjs`，已并入 `verify:story-audio`。口型重试做过变异测试：删掉重试那一行，测试会失败。
- 旧断言「语音不得参与就绪」改为门禁上限检查：不超过 3 秒、不返回 failed、不进入 frame hold。
- 加载文案契约补上了语音文案。翻译审计新增 2 个 UI 词条（71→73）。
- `verify:source-batch` 133/133，`verify:story-loading-safety`、`verify:story-audio`、`player-*`、`verify:home` 通过。`verifier-coverage` 413 个脚本，`build:check` 通过。
- `verify:story-stage-loading` 在基线上已经失败（`applyStateBodyMotion is not defined`），与本批无关，未处理。
- 浏览器：5177，headless Chromium，禁用缓存，用 DevTools 拦截让语音和口型延迟返回。脚本在 scratchpad 的 `voice-preload.mjs`，截图在 `.analysis/voice-preload/`。
  - 延迟 300 ms：自我介绍的语音在开场淡入时已取到。进入台词后约 0.1 秒开始发声，口型张合。
  - 延迟 6 s：门禁等 2.5 秒后继续，对话框提示加载中。语音到达后有声且口型张合（音量 73/76），对话框显示「重播本句语音」。
  - 延迟 15 s：4 秒后出现「重新加载语音」。
  - 长剧情：后续语音在到达前已经请求。
  - 无控制台错误。
- 未做：真机和 iOS Safari 实测；preview 部署（需按第八节登记后再发）。

待定：要不要让晚到的语音连同动作一起重播本句（`replay step`）。现在只重播语音。重放动作需要回到进入本句时的画面快照，等确认原版行为后再做。
