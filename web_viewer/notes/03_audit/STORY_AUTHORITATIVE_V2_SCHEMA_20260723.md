# Authoritative Compiled Scenario v2 Schema 审计（2026-07-23）

## 结论

Runtime 兼容输入与 compiler authoritative output 现已拥有不同契约：

- `compiled-scenario-v2.schema.json` 是迁移期 compatibility input，继续允许 `ScenarioNormalizer` 接收 legacy/混合结构；
- `compiled-scenario-v2-authoritative.schema.json` 是严格 compiler output，顶层、step、dialogue、choice option、flow、cue、evidence 与文本身份均关闭未知字段；
- 首个正式文本身份迁移集合 `1_4_001_01` 仍被验证为 compatibility input，不能称为 authoritative Runtime v2。

实现提交：

- `7c1f1b211d1577b3a6baebe07576a08341d23d96`：退役未使用的 `text_speed` 偏好；
- `816d5847e7a8066e3a3f2e90b68a3390cbc68efb`：authoritative v2 schema、fixture 与验证门禁。

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
- 本机挂载 `1_4_001_01_a` 时，确认它不符合 authoritative schema，并输出预期分类。

`npm run verify:story-text` 也会检查两份 schema 的 strictness 边界，防止后续误把 compatibility schema 收紧或把 authoritative schema 放宽。

## Preferences 技术债

`text_speed` 已从默认值和归一化输出删除。repository 读取含该键的旧 v2 localStorage 时，会保留其他偏好并将清理后的 payload 写回；不提升 schema version，因为这是删除从未生效、也未暴露 UI 的未知兼容字段。

## 尚未完成

- Python compiler 尚未直接生成 `runtime_contract: story-runtime-v2` 的 authoritative candidate；
- 正式 corpus 尚未切换严格输出；
- snapshot/payload 内部仍需按 Runtime channel 逐项 schema 化；
- authoritative candidate 发布前仍须经过非文本零差异、voice、episode boundary、choice target 与浏览器固定锚点验收。

下一步应选择一个最小 collection，在临时目录生成 authoritative candidate，通过 `verify:story-schema` 与现有 migration diff 后再决定是否发布；不得直接用 schema 变更覆盖全量 corpus。
