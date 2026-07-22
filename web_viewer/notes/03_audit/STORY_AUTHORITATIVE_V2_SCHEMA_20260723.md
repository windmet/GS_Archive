# Authoritative Compiled Scenario v2 Schema 审计（2026-07-23）

## 结论

Runtime 兼容输入与 compiler authoritative output 现已拥有不同契约：

- `compiled-scenario-v2.schema.json` 是迁移期 compatibility input，继续允许 `ScenarioNormalizer` 接收 legacy/混合结构；
- `compiled-scenario-v2-authoritative.schema.json` 是严格 compiler output，顶层、step、dialogue、choice option、flow、cue、evidence 与文本身份均关闭未知字段；
- 首个正式文本身份迁移集合 `1_4_001_01` 仍被验证为 compatibility input，不能称为 authoritative Runtime v2。

实现提交：

- `7c1f1b211d1577b3a6baebe07576a08341d23d96`：退役未使用的 `text_speed` 偏好；
- `816d5847e7a8066e3a3f2e90b68a3390cbc68efb`：authoritative v2 schema、fixture 与验证门禁。
- `85983ee6e1c1e0a2d45560d093700a4f4caeae27`：strict v2 candidate compiler stage、source speaker 字段与 a–j 等价性 gate。

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

Snapshot 与 cue payload 暂时仍允许 action-specific object 内容；它们的 owner 已唯一，但若要进一步关闭内部未知字段，应按 channel 分别增加 `$defs`，不能用一次性全局删除破坏现有演出数据。

## 验证门禁

新增：

```powershell
npm run verify:story-schema
```

该命令使用 JSON Schema 2020-12 validator：

- 验证最小 authoritative fixture 可以通过；
- 验证 compat runtime contract、未知顶层字段、legacy state/timeline、legacy dialogue 文本和缺失 text_ref 均失败；
- 验证 compatibility schema 仍保持宽容；
- 本机挂载 `1_4_001_01` a–j 时，先确认原文件不符合 authoritative schema，再编译 strict candidate；
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

## 尚未完成

- Python `ScenarioCompiler` 尚未原生生成 `runtime_contract: story-runtime-v2`；当前由独立、可审计的 post-compile stage 生成 strict candidate；
- 正式 corpus 尚未切换严格输出；
- snapshot/payload 内部仍需按 Runtime channel 逐项 schema 化；
- 正式发布前仍须执行 source-only checkout、完整 neck/Spine 加载和长时间 release acceptance。

下一步应为 a–j 建立可发布 manifest/atomic backup 流程，并在正式加载条件下补 neck/Spine 与 source-only 验收；通过后再决定是否发布。不得直接用 schema 变更覆盖全量 corpus。
