# 剧情预览器：最新审计、进度与下一窗口交接（2026-07-22）

> 实现审计基线：PR #1 `codex/story-localization-contract`，最后一个非文档提交 `b03b164a159f0df0063cb318bd3a0834c5e84dbf`；本文提交后分支 HEAD 会继续前进
> 文档用途：给新窗口提供唯一的“现在做到哪里、什么还不能宣称完成、下一步如何验证”入口。
> 本文不是新的架构规范；发生冲突时，运行语义以 Runtime 设计文档为准，文本身份与翻译行为以 Localization Contract 为准。

## 1. 核心文档索引

### 1.1 前两轮规范文档

1. [剧情预览器运行时重构技术设计](./STORY_VIEWER_RUNTIME_REFACTOR_DESIGN_20260718.md)
   - 负责回答：snapshot/cue 为什么分离、StoryClock、EffectScheduler、PerformanceHandle、settle/cancel、回退、Auto/Skip、各 Runtime channel 应如何迁移。
   - 新窗口处理镜头、Spine、fade、音频、回退或旧 timer 时，先以此为规范。

2. [剧情与门户本地化技术契约](./STORY_LOCALIZATION_CONTRACT_20260719.md)
   - 负责回答：`text_ref`、`unit_id`、source hash、speaker/choice identity、overlay、Resolver、UI locale/正文语言分离、missing/stale 和迁移报告。
   - 新窗口处理翻译、双语 UI、正式 compiled 重编或实体译名时，先以此为规范。

### 1.2 补充背景

- [资料门户与剧情浏览交接](./ARCHIVE_STORY_NEXT_WINDOW_HANDOFF_20260716.md)：集合页、episode 边界、门户路由与档案证据边界。
- [Compiled Scenario v2 Schema](../../schemas/compiled-scenario-v2.schema.json)：迁移期 IR 结构；当前仍是宽容 schema，不代表正式 v2 已完成收紧。
- [剧情翻译 Overlay Schema](../../schemas/story-translation-overlay-v1.schema.json)：剧情译文静态格式。
- [实体翻译 Overlay Schema](../../schemas/entity-translation-overlay-v1.schema.json)：偶像/NPC/组合等实体译名格式。

### 1.3 阅读顺序

```text
本文（现状、优先级、验收入口）
  ├─ 演出或回退问题 → Runtime 设计文档对应 channel
  ├─ 文本、译文或角色名问题 → Localization Contract
  └─ 集合、episode、返回问题 → 资料门户与剧情浏览交接
```

## 2. 外部 GitHub 评估的复核结论

网页端评估对整体架构的判断大体成立：项目已经形成 raw/masterdata、Python 编译、版本化 JSON、Vue 门户、Pixi/Spine/Audio 播放器和 verifier/documentation 六层闭环；Runtime 正处于新旧路径交接期；本地化已形成可运行的纵向切片，而不是只有设计稿。

但新窗口必须采用以下修正，不能直接复述外部评估：

| 外部判断 | 仓库复核 | 新窗口采用的表述 |
| --- | --- | --- |
| PR 有 38 个提交、79 个文件、约 1.1 万新增行 | 正确：相对 `origin/master` 为 38 commits、79 files、+11269/-519 | 这是阶段性大 PR，下一步优先 release acceptance，不继续无边界扩功能 |
| 8,441 份剧情 JSON、26,849/26,912 语音可解析 | 与当前基线不一致 | 已跟踪的 `archive_verification.json` 记录 10,324 个 scenario 文件、157,550 steps、26,912/26,912 标准语音引用可用；引用数字必须带生成日期与文件来源 |
| 本地化纵向切片已经完成 | 数据/状态链成立，但只在 fixture 与少量实体上成立 | “基础设施纵向切片完成”；不等于正式剧情数据迁移或翻译覆盖完成 |
| Compiled Scenario IR v2 已正式落地 | Compiler 与 schema 已有 v2 能力，但正式 public corpus 仍是 legacy 产物 | v2 runtime compatibility 已落地；正式 compiler output 迁移尚未发布 |
| 双语已可用 | 当前通过 `joinDisplay()` 拼成一个字符串 | 功能可用，视觉层级未完成；组件还不能分别控制 primary/secondary |

### 2.1 GitHub 在线仓库的证据边界

生产用 `public/data/compiled/` 与大型媒体默认不进入 Git。当前分支只强制跟踪一个浏览器压力 fixture：

```text
public/data/compiled/fixtures/story_localization_stress.json
```

因此网页端只能根据代码、schema、fixture 和已提交的 verification summary 判断能力，不能直接证明本机完整 corpus 已迁移或所有媒体都存在。新窗口必须区分：

```text
Git 可复核事实
本机生成数据事实
浏览器实际播放事实
正式录屏对照事实
```

四者不得互相替代。

## 3. 当前完成状态

### 3.1 Runtime 已完成

- `ScenarioNormalizer` 能把 legacy scenario 转为 runtime v2 compatibility shape。
- `StoryClock`、`EffectScheduler`、`PerformanceRegistry`、`SceneSnapshotStore`、`PlaybackModeController` 和 `useStoryRuntimeCues` 已落地。
- Spine timeline channel 默认启用新调度，保留 `runtimeSpine=0` 回滚入口。
- Camera、SE、screen、background、snapshot 已有 cue/handler 基础和 feature flag。
- 回退使用 navigation snapshot，并取消当前 transient；Choice/History 保存稳定身份。
- Auto/Skip 会询问 Runtime 的 blocking/non-skippable 状态，不再只是裸增 step index。
- 已针对 Spine neck 动画、镜头延迟、fade overlay、背景 wipe、SE cue 等建立回归验证。

### 3.2 Localization 已完成

- Compiler 能生成 `text_catalog_id`、`text_ref`、source coordinate/hash、speaker identity、choice/option identity。
- `TranslationRepository` 支持严格 schema、缓存、并发合并、AbortSignal、404/invalid 降级和 asset revision。
- `StoryTextResolver` 是纯显示函数，支持 original/translation/bilingual、missing/stale fallback 与 entity speaker。
- `StoryLocalizationContext` 已接入 Dialogue、Title、Synopsis、Choice、Backlog、Mobile、Call 等展示路径。
- UI locale 与正文语言偏好已经分离并持久化。
- History/Choice 保存 source identity，语言切换后重新解析显示文本。
- `EntityTranslationRepository` 已接入门户双语检索和播放器 speaker 译名。
- missing/stale/orphaned/collision/invalid verifier 与保守 migration report 已落地。
- 浏览器压力话已经覆盖 11 个文本单元：9 valid、1 missing、1 stale。

### 3.3 已完成的浏览器压力验收

入口：

```text
http://127.0.0.1:5174/?view=player&scenario=fixtures%2Fstory_localization_stress.json&start_step=1&end_step=10
```

已确认：

- title/synopsis 中文显示；
- 512px 窄屏长中文可滚动；
- `中文 → JP+CN` 切换仍停留在第 4 步；
- 双语内容达到四行以上；
- unknown speaker 与 `<P>` 不被伪造为偶像；
- Mobile、Phone、Choice 能正常推进；
- 选项同时解析 short/detail identity；
- 第 9 步 missing 和第 10 步 stale 均回退来源日文。

## 4. 尚未完成：必须优先说明的事实

### 4.1 正式剧情 corpus 仅完成首个 collection

以下是首次迁移前的 2026-07-22 只读基线：

```text
public/data/compiled/**/*.json = 10,329
可解析                         = 10,329
包含 text_ref 的文件           = 1
包含 text_catalog_id 的文件     = 1
schema_version = 2             = 0
```

当时唯一包含 `text_ref` 的文件是合成压力 fixture。后续已将 `1_4_001_01` aggregate 与 a–j 十个 episode 发布到本机 mounted corpus，并发布 3 条 exact-matched draft overlay；详见 [首个正式 Story Collection 迁移发布](../03_audit/STORY_FORMAL_COLLECTION_MIGRATION_20260722.md)。

> 正式文本身份迁移已从 0% 进入首个 collection，但绝大多数 corpus 仍是 legacy 产物。

因此仍不能批量制作或替换全库 overlay；当前稳定命中结论只适用于已审计的 `1_4_001_01` 小范围发布。

### 4.2 不可直接单文件重编 episode

对 `scenario_1_4_001_01_d.json` 的只读试编已经暴露风险：直接单编会产出 49 steps，而当前 episode 产物是 48 steps，原因包括 synopsis 和跨 part 状态来源不同。这样会破坏现有第 6/12/17 等逐帧锚点。

正确迁移必须：

```text
按 a–j 使用一个 ScenarioCompiler state machine 执行 compile_group
→ 保留 aggregate episode boundary
→ 通过 split_compiled_episodes 生成独立 episode
→ 重新链接 voice
→ 与旧产物逐字段比较
→ 差异通过后才替换正式文件
```

禁止为了得到 `text_ref`，直接拿单个 raw part 覆盖正式 episode。

### 4.3 Runtime 仍有双路径

`StoryViewer.vue` 当前同时创建：

```text
useTimelineRunner          旧 Spine timeline runner
useStepSceneEffects        旧 scene/audio/auto timers
useStoryRuntimeCues        新 Clock/Scheduler/Registry
```

默认状态：

- Spine：新 Runtime 默认开启，`runtimeSpine=0` 可回退；
- camera/SE/screen/background/snapshot：除非 query flag 开启，否则仍由旧路径或现有组件承担；
- 两个 watcher 仍同时观察 `currentStep`，依靠 channel flag 避免重复执行。

所以“Runtime 核心存在”不等于“旧执行器已删除”。

### 4.4 音频尚未统一

- `useVoicePlayer` 负责 voice 与 lip-sync；
- `AudioManager` 负责 BGM、SE、ambient；
- 用户手势解锁仍需同时照顾两条音频路径；
- 尚未完成统一 AudioContext/Mixer、统一暂停/倍率与统一 capture/restore。

### 4.5 双语视觉层级尚未完成

`StoryTextResolver` 已返回结构化：

```text
primary
secondary
speaker
translation state
```

`StoryLocalizationContext.joinDisplay()` 仍为未迁移组件保留拼接兼容字段。2026-07-22 已新增共享 `LocalizedTextBlock`，ADV、Choice、Backlog 已直接渲染 `view.primary/view.secondary`；详细证据见 [结构化双语 UI 验收](../03_audit/STORY_STRUCTURED_BILINGUAL_UI_20260722.md)。其余未完成内容包括：

- Title/Synopsis/Mobile/Call 的 primary/secondary 独立 DOM；
- 这些未迁移组件的独立字号、颜色、字体和间距；
- 长 speaker 名与 bilingual 的布局约束；
- Mobile/Call 与已迁移区域的一致视觉语义；
- missing/stale debug badge 的非侵入式布局。

### 4.6 实体翻译只是最小样本

当前 `zh-CN/entities/idols.json` 只有 `001tom`、`007kei`、`047shu` 三个 draft 条目，用于契约和双语检索验收。尚未完成：

- 49 偶像正式译名覆盖与审校；
- NPC、unit、card、event、story collection；
- 门户所有标题/简介的 overlay；
- 术语表和人名表的正式治理流程。

### 4.7 Preferences 与 schema 技术债

- `PlayerPreferencesRepository` 仍保留未使用的 `text_speed`；下一轮应删除，或明确标记 `reserved/deprecated` 且不暴露 UI。
- v2 schema 仍允许 legacy `text/text_jp/text_cn`，多个结构仍为 `additionalProperties: true`。
- 迁移期宽容是有意行为，但正式 v2 发布前必须区分 compatibility input 与 authoritative compiler output。

### 4.8 Release acceptance 尚未完成

当前已有大量 verifier 与局部浏览器验收，但这个 38-commit PR 尚未完成统一发布验收：

- source-only checkout；
- 带完整本机 public/assets 的 full build；
- 1280×720、1920×1080、390×844；
- Chrome/Edge 的首次音频解锁；
- 跨 episode 连续播放；
- default flags 与 `runtimeCues=1` 的录屏对照；
- `runtimeSpine=0` 回滚路径；
- 长时间 Auto/Skip/Backlog/Choice 混合操作；
- 内存、重复 AudioContext、未释放 Spine/Timer 检查。

## 5. 进度估算

以下百分比是按本文列出的交付项估算，不是代码行数，也不是翻译覆盖率。

| 工作流 | 当前估算 | 说明 |
| --- | ---: | --- |
| Runtime 核心抽象 | 80% | Clock/Scheduler/Registry/Snapshot/PlaybackMode 已有 |
| Runtime channel 迁移 | 55% | Spine 已默认；其余 channel 尚未全部成为唯一 owner |
| Runtime 旧路径清理 | 20% | `useTimelineRunner`、旧 scene timer 与双 watcher 仍存在 |
| 音频统一 | 25% | voice 与 BGM/SE/ambient 仍分离 |
| Localization 契约与基础设施 | 90% | schema/compiler/repository/resolver/verifier 已形成纵向切片 |
| 正式剧情文本身份迁移 | <1% | 首个 `1_4_001_01` collection 已发布；其余 corpus 仍是 legacy |
| 双语结构化 UI | 65% | ADV、Choice、Backlog 已结构化；Title/Synopsis/Mobile/Call 待迁移 |
| 实体/门户翻译覆盖 | <10% | 仅 3 个偶像 draft 样本 |
| PR release acceptance | 40% | 自动验证较多，统一设备/flag/跨 episode 验收未完成 |

按“可安全发布基础架构、但不要求完成批量翻译”作为总目标，目前约为 **65%–70%**。最大剩余工作不是继续写新类，而是正式产物迁移、唯一 owner 收口和发布验收。

## 6. 下一窗口推荐执行顺序

### P0-A：先做 PR release acceptance，不改功能

目标：确认 `b03b164` 可以作为后续工作的稳定基线。

1. 从干净 source-only checkout 安装依赖并构建。
2. 在挂载完整本机数据后运行全部 verifier。
3. 对固定剧情锚点跑 default、`runtimeCues=1`、`runtimeSpine=0` 三组。
4. 记录失败属于代码、生成数据、媒体挂载还是正式演出差异。
5. 未通过前不开始批量重编。

### P0-B：实现“正式剧情重编差异审计”，先 dry-run

目标：证明新增文本证据不会改变既有演出语义。

建议新增独立脚本，例如：

```text
scripts/report-compiled-scenario-migration.mjs
```

当前实现入口：

```powershell
npm run verify:compiled-migration
npm run story:migration-candidate -- `
  --raw-group-dir <raw group 目录> `
  --group-id <group id> `
  --expected-parts <例如 a-j> `
  --output-dir <web_viewer 之外的空临时目录>
node scripts/report-compiled-scenario-migration.mjs `
  --old <旧 compiled.json> `
  --new <临时新 compiled.json> `
  --json-out <审计报告.json> `
  --summary-out <摘要.txt> `
  --check
```

`--check` 在 scenario identity、step 数量/类型、episode boundary、来源文本或任意非文本字段发生差异时返回失败。新增 `text_ref`、speaker identity、choice/option identity 作为文本证据单独报告，不计为非文本演出差异。正式迁移仍须使用真实的旧/新产物运行该命令；脚本自测通过不等于任何正式 episode 已获准替换。

2026-07-22 首次正式 group dry-run 已对 `1_4_001_01` 的 aggregate 与 a–j 十个 episode 全部通过：aggregate 432→432 steps，新增 209 个文本单元，十个 episode 均为 0 个非文本差异；voice relink 为 139/139。详细证据见 [正式剧情重编差异审计：首个 group dry-run](../03_audit/STORY_COMPILED_MIGRATION_DRY_RUN_20260722.md)。这只证明该 group 的候选重编语义稳定，尚未授权覆盖正式产物。

同日代表矩阵已扩展到一话 Card、Event `1_3_10001_01` 的 aggregate/a–k，以及一话 0 Spine entries 的简单剧情，均为 0 个非文本差异。P0-B 首批样本范围已满足；下一步仍是审查并选择一个最小正式 collection，而不是直接全量替换。

输入旧 compiled 与临时新 compiled，至少报告：

```text
scenario/episode identity
step count 与 step type 序列
episode boundary
choice target
dialogue voice/lip
entry/settled scene state
timeline/cue 数量与时间
新增 text_ref/speaker_identity/choice identity
非文本字段差异
```

通过条件：除明确批准的 compiler 修复外，文本证据迁移不得改变非文本演出字段。

首批只审计：

- `1_4_001_01_a`：黑屏 wipe、社长、镜头/SE、Choice 与尾部边界锚点；
- `1_4_001_01_d`：圭/秀 neck、fade 回退、Mobile/Phone/Choice；
- 再选一话 Card、一话 Event、一话只有文本/无 Spine 的简单剧情。

### P0-C：把 Runtime channel 逐一变成唯一 owner

推荐顺序：

```text
screen/fade
→ background transition
→ camera
→ SE
→ snapshot timer
→ 删除旧 timeline/scene 分支
```

每迁移一个 channel：

1. default 与 flag-on 行为对照；
2. settle/cancel/restore/resize 各测一次；
3. 删除该 channel 的旧 timer/RAF owner；
4. 保留一个明确回滚 commit；
5. 不在同一提交迁移下一个 channel。

### P1：结构化双语 UI

这是适合作为新窗口独立小闭环的 UI 工作：

1. `StoryLocalizationContext` 不再只返回拼接字符串；兼容字段可以暂留。
2. 先让 `AdvUI.vue` 分别渲染 primary/secondary。
3. 建立共享的 localized text block，再接 Title/Synopsis/Choice/Backlog/Mobile/Call。
4. 在 390×844 和 1280×720 检查长中文、四行双语、长 speaker 和字体 fallback。
5. 语言切换只改变 presentation，仍需断言 Runtime sentinel 不变。

不要在这一步同时批量写译文或重编正式 corpus。

2026-07-22：第一批已完成 ADV、Choice、Backlog 与共享 localized text block，390×844、1280×720 浏览器验收及结构化 DOM verifier 通过；Title/Synopsis/Mobile/Call 留待后续独立批次。

### P2：正式 compiled 迁移与小范围 overlay

只有 P0-B 的非文本 diff 为零或得到逐项批准后，才执行：

1. 按 group 编译并拆分 episode；
2. 重新链接 voice；
3. 运行 schema/text/voice/episode verifier；
4. 先发布一个固定集合，而不是 10,000 文件一次替换；
5. 用 migration report 生成 candidate overlay；
6. 人工确认 stale/moved/ambiguous，禁止自动写新 source hash。

2026-07-22：首批 `1_4_001_01` 已完成 group compile、a–j split、139/139 voice relink、11 份零非文本差异 gate、严格 overlay 与浏览器验收。后续 collection 必须继续逐批执行相同发布流程，不能由首批通过推导全库安全。

### P3：音频统一与遗留清理

- 明确 AudioContext 和 mixer 的唯一 owner；
- 统一 voice/BGM/SE/ambient 的 unlock、pause/resume、rate 与 dispose；
- 删除不再使用的 `text_speed` 或标记 deprecated；
- 收紧 authoritative v2 schema；
- 最后删除 feature flags 和 compatibility fields，而不是提前删除回滚入口。

## 7. 固定演出验收锚点

### 7.1 `1_4_001_01_a`

```text
http://127.0.0.1:5174/?view=player&category=cards&idol=001tom&story_type=main&story_section=101&scenario=episodes%2F1_4_001_01_a.json&start_step=2&end_step=42&return=story_collection
```

重点：

- 社长剪影比例、脚底/对话框遮挡和 Y 对齐；
- 315 事务所外→内：黑幕从左到右盖住旧背景，再从左到右揭示新背景；
- 不出现“两次相反方向黑屏”；
- `パパパ、パーッション！！` 位置才触发镜头放大；
- 放大同时触发 raw 对应的哇音 SE；
- 第 39 步 Choice 使用正式 option identity 和完整显示；
- 41 后仍能进入播放范围内剩余内容，不被错误截断。

### 7.2 `1_4_001_01_d`

```text
http://127.0.0.1:5174/?view=player&story_type=main&story_section=101&scenario=episodes%2F1_4_001_01_d.json&start_step=1&end_step=48&return=story_collection
```

重点：

- 第 6 步圭的 `neck_question` 结束后保持左倾，不闪回 Track 0；
- 第 12 步秀从偏右顺滑回中轴，不先卡回正再偏左；
- neck 结束后人物 root 不垂直下坠；
- 切黑前 neck 不弹回动作前姿态；
- 第 12 步黑屏后前进/回退均能正确清除 overlay；
- `effect_fade*` 与 `screen_fade*` 仍由同一屏幕遮罩语义结算；
- Mobile/Phone、Choice 和末尾范围保持可用。

### 7.3 Localization stress

```text
http://127.0.0.1:5174/?view=player&scenario=fixtures%2Fstory_localization_stress.json&start_step=1&end_step=10
```

重点：中文、JP+CN、长文本、Choice、Mobile/Phone、missing/stale；切换语言前后 step 不变。

## 8. 自动验证清单

### 8.1 每个小提交

```powershell
git diff --check
npm run verify:story-localization
npm run verify:story-translations
npm run verify:story-text
node scripts/verify-story-runtime-foundation.mjs
```

### 8.2 改 Runtime channel

```powershell
npm run verify:spine-motion
npm run verify:spine-fade
npm run verify:spine-blink
npm run verify:voice-cues
npm run verify:story-playback-range
node scripts/verify-story-runtime-foundation.mjs
```

并在浏览器检查：正常前进、快速二次点击 settle、Prev cancel/restore、Backlog restore、Auto、Skip、resize、切后台再恢复。

### 8.3 改 compiler 或正式 compiled

```powershell
npm run verify:episode-artifacts
npm run verify:voice-cues
npm run verify:story-text
npm run verify:story-presentation
npm run verify:story-collections
npm run verify:archive
```

注意：`verify:archive` 会重写 `public/data/archive_verification.json`。提交前必须核对生成差异，不能把环境差异当功能修改提交。

### 8.4 改门户/路由

```powershell
npm run verify:routes
npm run verify:story-presentation
npm run verify:story-collections
npm run verify:idol-story-interface
```

### 8.5 合并前

```powershell
npm run build
```

当前没有 `npm run verify:story-runtime` 别名；应直接运行 `node scripts/verify-story-runtime-foundation.mjs`，或另起一个纯 package-script 提交补别名。

## 9. 浏览器发布验收矩阵

| 维度 | 必测值 |
| --- | --- |
| Viewport | 1920×1080、1280×720、390×844 |
| Runtime | default、`runtimeCues=1`、`runtimeSpine=0` |
| 导航 | Next、快速二次 Next、Prev、Backlog restore、Choice、episode end/next |
| 播放模式 | 手动、Auto、Skip all、Skip read |
| 音频 | 首次解锁、voice、SE、BGM、ambient、切后台、恢复、结束 dispose |
| Localization | JP、CN、JP+CN、missing、stale、长文本、长 speaker |
| 数据 | source-only、完整本机挂载、缺资源 fallback |
| 观测 | console error、重复 cue、残留 overlay、重复 AudioContext、内存持续增长 |

人工验收必须记录：URL、query flags、viewport、commit、实际步骤、期望、结果、截图/录屏位置。只写“看起来正常”不足以作为发布证据。

## 10. Git 与工作边界

1. 保持小提交：Runtime channel、compiler、generated data、UI、文档分开。
2. 正式 compiled 批量变更必须单独提交，先附 diff report。
3. 不提交大型媒体；Git 中的 fixture 必须小且可重复生成/验证。
4. 不把 Chibi/粒子实验混入 Runtime/Localization PR。
5. 不在修双语 UI 时顺带删除 legacy runtime。
6. 不在迁移 Runtime channel 时顺带改 raw/compiled 数据。
7. 每次 push 后核对 local/remote SHA，并更新本文基线或新增后续交接。

## 11. 新窗口开场提示词

可将以下内容直接交给新窗口：

```text
请先完整阅读：
1. notes/04_refactor/STORY_VIEWER_NEXT_WINDOW_AUDIT_20260722.md
2. notes/04_refactor/STORY_VIEWER_RUNTIME_REFACTOR_DESIGN_20260718.md
3. notes/04_refactor/STORY_LOCALIZATION_CONTRACT_20260719.md

当前实现审计基线是 PR #1、branch codex/story-localization-contract、最后一个非文档提交 b03b164；请以实际远端 HEAD 为准。
先核对实际 HEAD 与干净工作区，并确认 b03b164 之后是否只有交接文档提交；不要假设正式 compiled 已有 text_ref。
优先执行 release acceptance 或正式重编 dry-run diff；不要直接覆盖 1_4_001_01_d，也不要批量翻译。
任何 Runtime channel 修改都必须证明唯一 owner，并分别验证 settle、cancel、restore 与 runtimeSpine=0 回滚。
分批提交并推送，每批说明已验证和仍未验证的内容。
```

## 12. 完成定义

下一阶段只有同时满足以下条件，才能宣称 Runtime/Localization 基础架构可合并：

- PR release matrix 通过；
- 固定 a/d 锚点在 default 与 flag matrix 下通过；
- 正式重编 dry-run 证明非文本演出字段无未批准差异；
- 至少一个正式 story collection 获得 text identity、overlay 与浏览器验收；
- 双语 primary/secondary 至少在 ADV、Choice、Backlog 中结构化渲染；
- 旧路径按 channel 删除，或明确列出仍保留的 owner 和回滚期限；
- source-only 与完整本机 build 都通过；
- 文档、schema、fixture、verifier 与实现同步。

批量翻译覆盖、完整实体翻译、Chibi 特效和翻译后台仍不属于这一完成定义。
