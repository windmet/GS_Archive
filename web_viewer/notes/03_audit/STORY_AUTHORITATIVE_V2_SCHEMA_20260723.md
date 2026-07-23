# Authoritative Compiled Scenario v2 Schema 审计（2026-07-23）

## 结论

Runtime 兼容输入与 compiler authoritative output 现已拥有不同契约：

- `compiled-scenario-v2.schema.json` 是迁移期 compatibility input，继续允许 `ScenarioNormalizer` 接收 legacy/混合结构；
- `compiled-scenario-v2-authoritative.schema.json` 是严格 compiler output，顶层、step、dialogue、choice option、flow、cue、evidence 与文本身份均关闭未知字段；
- 首个正式文本身份迁移集合 `1_4_001_01` 的 aggregate 与 a–j 十个 episode 已于 2026-07-23 原子发布为 authoritative Runtime v2；其余绝大多数 corpus 仍是 compatibility input。

实现提交：

- `7c1f1b211d1577b3a6baebe07576a08341d23d96`：退役未使用的 `text_speed` 偏好；
- `816d5847e7a8066e3a3f2e90b68a3390cbc68efb`：authoritative v2 schema、fixture 与验证门禁。
- `85983ee6e1c1e0a2d45560d093700a4f4caeae27`：strict v2 candidate compiler stage、source speaker 字段与 a–j 等价性 gate。
- `8b31268`：mounted strict corpus 的 episode boundary、背景、Choice、presentation 与 verifier 消费兼容。
- `a065c22`：authoritative snapshot 顶层与 10 类 Runtime cue action/channel/payload 严格契约，以及全 mounted corpus shape verifier。
- `c6d57dd`：background/camera/screen/environmental/image icon/Spine snapshot 嵌套 `$defs`、递归 shape gate 与 source-only 正反例。
- `498ac8b`：authoritative lip evidence 契约、路径/帧数反例、48,073 条 mounted lip gate，并删除 compiler 不输出的 diagnostics。

## 严格输出边界

Authoritative output 必须包含：

```text
schema_version = 2
compiler_version
runtime_contract = story-runtime-v2
scenario_id / text_catalog_id / text_contract_version
source raw_path + raw_hash
steps[].entry_snapshot / settled_snapshot / cues / flow / evidence
dialogue/choice/text_time 的 source_text + text_ref
```

禁止把以下 compatibility 字段写入 authoritative output：

```text
step.state
step.timeline
step.normalization
dialogue.speaker
dialogue.text / text_jp / text_cn
choice.label / text / detail / step_id
runtime_contract = story-runtime-v2-compat
```

Snapshot 与 cue payload 已按 Runtime channel 收紧：snapshot 顶层及 background profile/effect/transition、camera、screen effect/overlay/slide、environmental、image icon、Spine/fade 等嵌套对象均禁止未知字段；cue 必须属于 10 个 compiler action 之一，并匹配对应 channel 与 payload `$defs`。`dialogue.lip` 也已固定为安全相对路径、正整数帧数与关闭未知字段的 evidence 对象；authoritative compiler 不输出的 `diagnostics` 已从 schema 删除。只剩无 mounted 样本、但 Python/JavaScript compiler 显式保留的 `resource_manifest` 与 evidence `raw_values` 尚不能凭空封闭。

## Runtime shape 全库门禁

`a065c22` 将 shape 验证并入 `npm run verify:story-schema`，也可单独执行：

```powershell
npm run verify:story-runtime-shapes
```

门禁从 `ScenarioNormalizer` 的实际输出检查：

- snapshot 顶层字段和类型；
- cue action 是否属于 `camera/background/se/screen/spine` 的 10 个已知动作；
- action 与 channel 是否匹配；
- action-specific payload 是否缺字段、多字段或类型错误；
- source-only 环境至少检查 tracked compatibility fixture；mounted 环境递归检查全部 scenario JSON。

2026-07-23 mounted 扫描结果为 10,326 scenarios（含 tracked fixture）、315,124 snapshots、175,600 cues、48,073 lip records、1214 snapshot shapes、488 nested snapshot shapes 与 37 action/payload shapes，10 类 action 和唯一 lip shape 全部通过。扫描器按递归“字段/类型/约束值签名”去重执行 AJV，同时仍遍历每条 cue 并检查 channel；完整嵌套验证约 20 秒。全库发现 1618 条 `spine.neck.stop` 使用空 `value` 表示停止当前 neck 动作，因此 stop payload 明确允许空字符串；`spine.neck.play` 等启动动作仍要求非空。Tracked fixture 同时证明 `bg_transition.color` 与 Spine `position` 是合法可选字段。

## 验证门禁

新增：

```powershell
npm run verify:story-schema
```

该命令使用 JSON Schema 2020-12 validator：

- 验证最小 authoritative fixture 可以通过；
- 验证 compat runtime contract、未知顶层字段、legacy state/timeline、legacy dialogue 文本和缺失 text_ref 均失败；
- 验证 compatibility schema 仍保持宽容；
- 本机挂载 `1_4_001_01` 时同时接受“整组 compatibility、可等价投影”为迁移前状态，或“aggregate 与 a–j 全部通过 authoritative schema”为发布后状态；禁止同一 collection 混用两种契约；
- 全 collection 432 steps 的 step/type、source hash、episode boundary、choice target、voice/lip、文本身份/原文、entry/settled snapshot、cue 与 flow 投影保持等价；
- strict candidate 不再含 step `state/timeline` 或 dialogue `text/text_jp/text_cn`。

`npm run verify:story-text` 也会检查两份 schema 的 strictness 边界，防止后续误把 compatibility schema 收紧或把 authoritative schema 放宽。

## Preferences 技术债

`text_speed` 已从默认值和归一化输出删除。repository 读取含该键的旧 v2 localStorage 时，会保留其他偏好并将清理后的 payload 写回；不提升 schema version，因为这是删除从未生效、也未暴露 UI 的未知兼容字段。

## Strict candidate compiler stage

新增：

```powershell
npm run story:authoritative-candidate -- `
  --input=<compatibility episode json> `
  --output=<workspace 外的 candidate json> `
  --compiler-version=<version>
```

输出路径强制位于 `web_viewer` 工作区之外，防止 dry-run 意外覆盖正式 corpus。2026-07-23 已在系统临时目录对 `1_4_001_01_a` 生成 42-step candidate；完整 a–j 则在 verifier 内逐 episode 编译并验证，共 432 steps。

Authoritative dialogue 使用 `speaker_source_text + speaker_text_ref` 表示 Title/Synopsis 的 source speaker 文本，避免为了删除 legacy `speaker` 而丢失标题来源。Resolver、translation diagnostics 与 migration report 均已接受该结构。

## 5174 受控临时挂载验收

为避免修改正式 corpus，验收只把生成的 a/d candidate 临时复制到 `public/data/compiled/fixtures/_authoritative_candidate_*.json`，浏览器完成后校验路径并立即删除；Git 工作区未留下 generated candidate。

始终只使用一个浏览器标签页：

- A step 38：Runtime 记录 4.0s `cloth_move_l01`、5.5s camera transform、5.6s `vibraslap_comical` 均启动，应用级 error 为 0；
- D step 12→14→Prev：Runtime 记录 restore，返回原对白；画面截图确认户外背景、两名角色与对白恢复，无残留黑色 overlay，应用级 error 为 0；
- 压缩加载过程中出现一次 `spine cue target unavailable` warning，因此本轮不把 step 12 neck 姿态记为完整通过，仍留给正式加载/长测；
- 验收后浏览器恢复正式 `episodes/1_4_001_01_d.json` step 1–48 地址，标签页数量为 1。

## Strict collection manifest 与原子发布门禁

`2702773` / `1fb426e` 已补齐首批 a–j strict collection 的批量候选、manifest 与原子发布器。2026-07-23 已使用同一门禁正式覆盖本机 mounted `1_4_001_01`：

- `npm run story:authoritative-collection` 会在工作区外生成 aggregate 加 a–j 共 11 份 strict candidate，并逐文件校验 authoritative schema、Runtime/文本投影等价性及 old/candidate SHA-256；
- 本机 mounted collection 的真实 dry-run 记录为 11 files、10 episodes、864 manifest step records、278 voice refs。后两项包含 aggregate 与 episode 两种表示的重复计数，对应唯一剧情内容仍是 432 steps、139 voice refs；
- `npm run story:authoritative-publish` 必须收到显式 collection group 确认，并在写入前复核当前文件 hash、candidate hash、schema 和等价性；
- 发布前完整备份至 compiled corpus 外，逐文件采用 temp + fsync + rename；中途失败会用精确备份回滚已写文件，成功后再验证最终 hash 并写 backup manifest；
- `npm run verify:story-authoritative-publish` 已覆盖确认门禁、hash 漂移、路径穿越、备份目录污染、原子替换、第二文件故障注入及首文件精确回滚；Windows 备份边界使用 `path.relative` 判定。

正式发布记录：

- 目标：`public/data/compiled/1_4_001_01.json` 与 `episodes/1_4_001_01_a.json` 至 `_j.json`，共 11 文件；
- compiler：`python-native-v1`；manifest 为 864 step records / 278 voice refs，即 aggregate 与 episode 双表示下的 432 unique steps / 139 unique voice refs；
- aggregate hash 从 `sha256:db5d33453a9a999b35455e0fa5ee9cfa242869f7d15c91e91db4d5c572379495` 切换为 `sha256:e3a4000b6af1d69ef7294320d89cb9cd725283e537b2e4f282c3199d7a7b1b06`；
- 完整旧产物与 backup manifest 保存在 `C:\Users\windm\AppData\Local\Temp\sidem-authoritative-formal-backup-4315bc2cf6454457a490aade7c9d36b2`，11 个 backup hash 均等于发布前 old hash；
- mounted corpus 属于本机生成数据，默认不由 Git 跟踪；代码提交记录 consumer/verifier 与文档，不能用远端 Git 内容替代本机 corpus 状态。

发布后发现并修复了三类仍依赖 compatibility 字段的消费边界：Runtime 锚点文本/`evidence`、episode artifact 边界与正文比较、播放器 `start_step_id/end_step_id`、`entry_snapshot.bg` 与 Choice `target_step_id`。presentation index 已从当前 corpus 重新生成，结果保持 1394 stories / 900 synopses / 1633 episode boundaries。

`1fb426e` 的 detached source-only checkout 已执行 `npm ci --ignore-scripts`、schema/publish/text/localization/structured UI/Runtime foundation 全套 verifier 与生产构建。挂载 corpus 锚点按预期显式 skip，2400 modules 构建通过，证明新门禁不依赖本机未纳管语料。

## Python ScenarioCompiler 原生 strict 输出

`e7a78d0` 已把 authoritative v2 投影实现为 Python compiler contract，而不再要求正式编译流程依赖 Node post-compile stage：

- `ScenarioCompiler.compile(..., output_contract="authoritative", source=...)` 与 `compile_group` 可直接返回 `runtime_contract: story-runtime-v2`；默认仍为 compatibility，现有调用不变；
- `npm run story:authoritative-native -- --raw-group-dir ...` 从 raw group 经同一 Python state machine 生成 strict aggregate 与 episode 文件；
- Python 只输出 authoritative schema 允许的 snapshot/cue/flow/evidence/text identity 字段，不写 legacy `state/timeline/text/text_jp/text_cn`；
- tracked compatibility fixture 在 source-only checkout 中逐字段对照 JavaScript 独立实现；本机 mounted a–j 共 432 unique steps 也逐文件、逐字段一致并通过 strict schema；
- 真实 raw `1_4_001_01` a–j native dry-run 生成 aggregate + 10 episodes，432 unique steps、139/139 voice refs，11 份文件与 JavaScript 投影完全一致；临时产物已删除，未覆盖 corpus。

JavaScript candidate stage 继续作为独立 oracle 与发布器输入，而不是 Python 正式输出的唯一实现。这样跨语言 parity gate 能阻止两套规范化规则静默漂移。

## 尚未完成

- 只有首个 `1_4_001_01` collection 完成严格输出，其余 corpus 尚未逐批迁移；
- Runtime snapshot/cue 与 `dialogue.lip` 已收紧，authoritative `diagnostics` 已删除；只剩无 mounted 样本的 `resource_manifest` 与 evidence `raw_values` 需要在出现权威来源契约后收口；
- Edge autoplay、操作系统级真实后台听感与数小时 heap/Spine soak 仍未完成；这些是应用 release stability，不是本次 11 文件 schema/text 等价发布的替代证据。

2026-07-23 正式 mounted `1_4_001_01_d` 单标签复核中，`007kei_002_00` 与 `047shu_001_00` 均加载完整 neck 动画表；step 6 显示 neck 姿态，debug 层为 `spine yes` 且 root 未下坠；step 12–14 黑幕链恢复户外背景。日志无 `spine cue target unavailable`、应用 error 为 0，之前 candidate 压缩加载 warning 已在正式加载条件下关闭。

本次发布后 `verify:story-schema`、authoritative publisher、Runtime foundation、text/localization、episode/voice、playback range、presentation、首页、100 轮 audio soak 与 2400-module production build 均通过。为避免再次触发 IDM 音频嗅探，本轮没有执行发布后的浏览器播放；此前 candidate 与正式 compatibility 锚点的单标签证据仍保留，但不得冒充发布后的长时间真实环境验收。下一步优先补 Edge/真实后台/数小时 soak，并为下一 collection 重复完整 manifest、备份与小批发布流程；禁止直接覆盖全量 corpus。
