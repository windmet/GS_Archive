# GS_Archive 剧情与门户本地化技术契约

> 状态：设计冻结候选（implementation-ready）  
> 日期：2026-07-19  
> 适用范围：剧情 compiler、Compiled Scenario IR v2、播放器、Backlog、Choice、门户实体与 UI 国际化  
> 当前阶段：只冻结契约与验收标准；本文完成前后均不授权批量翻译、翻译后台或无关 Runtime 改造

---

## 1. 文档目的

本文把此前分散在运行时重构设计、WebGAL 方向评估、现有语言代码审计和两轮本地化评审中的结论，收敛为一份可实施、可验证、可分批提交的正式技术契约。

本文解决以下问题：

1. UI 国际化和剧情正文翻译是否使用同一套机制；
2. 翻译如何在不复制演出脚本的情况下绑定原文；
3. compiler 如何为 dialogue、choice、title 等文本生成来源证据；
4. 多 raw part 合并、step 重新编号和 raw 命令插入后如何识别译文；
5. Dialogue、Choice、Backlog 和门户如何共享同一解析结果；
6. 用户切换语言时，哪些 Runtime 状态绝对不能受到影响；
7. 从当前 `text_jp/text_cn` 兼容格式迁移到 v2 的顺序；
8. 第一阶段应实现什么，以及明确不实现什么。

本文不是翻译规范、术语表或翻译管理后台设计。它定义的是“原文身份—译文覆盖—显示视图”之间的工程契约。

---

## 2. 执行摘要与最终方向

### 2.1 接受的方向

GS_Archive 使用两套彼此隔离但共享用户偏好的语言系统：

```text
UI 文案
  └─ UiI18n / vue-i18n（键值字典）

剧情与资料正文
  └─ Source Text + Translation Overlay + StoryTextResolver
```

剧情永远只播放一份演出 IR：

```text
Raw Scenario
    ↓
Scenario Compiler
    ├─ Runtime IR：step / snapshot / cue / flow
    └─ Text Evidence：text_ref / source_hash / speaker identity
                          ↓
                  TranslationRepository
                          ↓
                    StoryTextResolver
                          ↓
             Dialogue / Choice / Backlog / Portal
```

### 2.2 明确拒绝的方向

以下方案不进入 GS_Archive：

- 每种语言复制一份完整 scenario；
- 切换语言时跳转到另一 scene；
- 将剧情正文塞入 UI i18n 字典；
- 将译文写回 raw、masterdata 或演出 cue；
- 让 Runtime、Scheduler、Spine 或 Audio 根据语言分流；
- 在 HistoryNode 中只保存已经渲染好的本地化字符串；
- 仅靠 `step_id`、原文字符串或 `source_hash` 作为永久翻译键；
- 运行时自动猜测并迁移译文。

### 2.3 第一阶段的最小闭环

第一阶段只需要完成：

1. v2 文本身份与来源证据；
2. compiler/normalizer 兼容契约；
3. 一话静态 `zh-CN` overlay；
4. 纯函数 `StoryTextResolver`；
5. Dialogue、Choice、Backlog 共用 resolver；
6. Player Preferences schema v2；
7. missing/stale/collision verifier；
8. 假译文与超长文本压力测试。

不建设在线编辑器、翻译协作后台、数据库、全自动迁移平台或多语言管理系统。

### 2.4 目标目录与模块所有权

建议最终目录：

```text
schemas/
  compiled-scenario-v2.schema.json
  story-translation-overlay-v1.schema.json
  entity-translation-overlay-v1.schema.json

src/localization/
  ui/
    UiLocaleStore.js
    UiTextResolver.js
    locales/
      ja-JP.js
      zh-CN.js
  story/
    StoryLanguagePreferences.js
    TranslationRepository.js
    EntityTranslationRepository.js
    StoryTextResolver.js
    LegacyDialogueAdapter.js
    TranslationDiagnostics.js

public/translations/
  zh-CN/
    scenarios/
    entities/

fixtures/localization/
  source-hash-v1.json
  scenario-text-evidence.json
  scenario-overlay-zh-CN.json

scripts/
  verify-story-text-evidence.mjs
  verify-story-translations.mjs
  report-story-translation-migration.mjs
```

模块职责：

| 模块 | 允许拥有 | 禁止拥有 |
|---|---|---|
| Compiler | source text、evidence、hash、identity | 译文、用户偏好、UI locale |
| Normalizer | v1/v2 兼容和内部文本模型 | fetch、DOM、翻译迁移猜测 |
| TranslationRepository | overlay 加载、校验、缓存 | primary/secondary 选择、Runtime state |
| StoryTextResolver | fallback、双语顺序、显示 View Model | 网络、localStorage、cue/snapshot |
| UiI18n | 按钮、菜单、错误文案 | 剧情正文、演出结构 |
| History/Backlog | text/choice identity、source fallback | 固化当前 locale 的显示字符串 |
| Portal | entity/story resolver 的消费 | 重复维护同一实体译文 |

---

## 3. 与既有文档的关系

本文不是对运行时设计的替代，而是它的本地化补充契约。发生冲突时按以下优先级解释：

1. 本文负责文本身份、翻译覆盖、语言偏好、Choice/History 文本引用；
2. [STORY_VIEWER_RUNTIME_REFACTOR_DESIGN_20260718.md](./STORY_VIEWER_RUNTIME_REFACTOR_DESIGN_20260718.md) 负责 step、cue、clock、scheduler、snapshot、adapter 和播放语义；
3. [compiled-scenario-v2.schema.json](../../schemas/compiled-scenario-v2.schema.json) 是当前 Runtime IR 草案；后续必须按本文扩充 text definitions，不能只依赖 `additionalProperties`；
4. [ARCHIVE_STORY_NEXT_WINDOW_HANDOFF_20260716.md](./ARCHIVE_STORY_NEXT_WINDOW_HANDOFF_20260716.md) 负责门户与剧情集合后续范围；其中门户实体名称显示应改由本文的 EntityTranslationRepository 解释；
5. [STORY_COLLECTION_INTERFACE_20260715.md](./STORY_COLLECTION_INTERFACE_20260715.md) 负责故事集合路由和边界；本地化不得改变 collection/scenario/episode identity。

### 3.1 既有未完成定义的接管表

| 既有位置 | 原定义 | 本文接管后的结论 |
|---|---|---|
| Runtime §7.2 | `dialogue.text_jp/text_cn` | v1 可读；v2 compiler 只输出 source text + `text_ref`，译文进入 overlay |
| Runtime §10.2 | HistoryNode 保存 `dialogue` 和 `selected_choices` | 保存 source dialogue/text identity；Choice 保存 identity，不保存显示文本作为事实 |
| Runtime §10.4 | Backlog 展示日文/中文 | Backlog 每次渲染都经过 `StoryTextResolver`，切换语言即时重算 |
| Runtime §12.4 | 已读 key 使用 scenario/source hash/step | 保持运行时已读 identity；不得与长期翻译 `text_unit_id` 混为一谈 |
| Runtime §13.1 | `language_mode` | Preferences schema v2 拆为 `ui_locale`、`story_content_mode`、`bilingual_primary` |
| Runtime §17 | Runtime Phase 0–8 | 在 Audio Phase 之前插入独立 Localization Contract 批次，不改变 Scheduler 顺序 |
| Runtime §22 | 文本视为不可信输入 | overlay 同样视为不可信静态输入；禁止未经清理的 HTML |
| Runtime §25.5 | read state 迁移 | 文本译文迁移另走离线 evidence matcher，不复用 read-state 规则 |

### 3.2 尚未实现但必须保留的 Runtime 前提

本文依赖以下 Runtime 目标继续成立：

- v1/v2 scenario 通过 Normalizer 进入统一内部模型；
- HistoryNode 和 SceneSnapshot 分离；
- Backlog 是 History 的视图，不拥有舞台状态；
- cue 可追溯 raw evidence；
- 语言切换不是 InputIntent，不触发 step generation；
- URL 范围与 scenario identity 不因 locale 改变。

---

## 4. 当前代码审计

### 4.1 已有可复用基础

当前实现具备以下正向基础：

- `src/utils/TextHelper.js` 能读取 legacy `text` 与 `text_jp/text_cn`；
- 中文缺失时已经会回退日文；
- `SceneSnapshotStore` 保存原始 `step.dialogue`，不是 DOM 或渲染结果；
- Player Preferences 已使用版本化 repository；
- Backlog 已基于 HistoryNode，而不是另建剧情状态；
- Runtime 的 cue/snapshot 架构天然允许语言层保持纯展示。

### 4.2 已确认的分叉

当前存在至少四套不完全一致的语义：

```text
LanguageStore
  └─ JP / CN / BILINGUAL

TextHelper
  └─ dialogue 文本解析并拼接双语字符串

StoryBacklog
  └─ 自行重复 JP/CN/BILINGUAL 判断

selectedChoices
  └─ 直接保存用户当时看到的 option 字符串
```

此外：

- compiler 为每条 dialogue 写空 `text_cn`；
- UI 文案同时存在中文、英文和日文硬编码；
- `speaker` 仍是未经分类的显示字符串；
- 当前 compiler 循环没有把 raw command index 传入 emitted step；
- v2 设计文档出现 `command_start/command_end`，但当前编译产物尚未提供；
- schema 中 evidence 只定义单个 `command_index`，与文档的 command range 仍需统一。

### 4.3 当前风险

如果现在直接开始批量汉化，会快速出现：

- Dialogue 与 Backlog 双语顺序不同；
- Choice 历史无法随语言切换；
- silent step 修复导致 step_id 变化后译文错位；
- 多 part 合并后 command index 冲突；
- `？？？`、`<P>`、NPC 被错误映射为偶像；
- 原文修改后已审校译文仍被当作有效；
- 门户实体名与剧情 speaker 名重复维护；
- 翻译文件复制 voice/cue/snapshot，最终形成双份演出数据。

因此冻结本文契约应早于批量翻译。

---

## 5. 术语与身份边界

| 术语 | 含义 | 是否长期稳定 |
|---|---|---|
| `scenario_id` | 一份可播放 compiled scenario 的规范身份 | 应稳定 |
| `source_part_id` | scenario 内某个 raw 文件/part 的规范身份 | 应稳定 |
| `step_id` | Runtime 导航节点身份 | compiler 改变时可能移动 |
| `text_unit_id` | 当前 source evidence 下可确定性重建的文本定位键 | 可重建，但不承诺永久不变 |
| `source_hash` | 规范化原文的内容指纹 | 原文改变即改变 |
| `source_evidence` | 文件、命令、字段和邻近上下文证据 | 用于审计与迁移 |
| `translation entry` | 某 locale 对某 text unit 的译文记录 | 独立于 compiled IR |
| `localized view model` | Resolver 为当前偏好生成的展示数据 | 临时、可重算 |
| `UI locale` | 按钮、菜单、错误信息所用语言 | 用户偏好 |
| `story content mode` | 原文、译文或双语显示模式 | 用户偏好 |

本文中的 `text_unit_id` 是概念名；序列化字段统一写作 `text_ref.unit_id`。实现中不得再并列增加一个含义相同的 `text_unit_id` 字段。

### 5.1 三种身份绝不能混用

```text
step_id
  → 播放、导航、快照、已读

text_unit_id
  → 原文与译文的当前定位

entity_id
  → 偶像、NPC、卡片、活动等资料实体
```

一次 dialogue 可以同时拥有三者，但三者生命周期不同。

---

## 6. 不可破坏约束

以下使用 RFC 风格措辞：MUST 为必须，MUST NOT 为禁止，SHOULD 为强烈建议。

1. Runtime MUST 只播放一份 scenario IR。
2. 语言切换 MUST NOT 改变 current step、generation、cue、voice、Spine、camera 或 snapshot。
3. Translation Overlay MUST NOT 包含或覆盖演出字段。
4. compiler MUST 保留 source text 与 source evidence。
5. source evidence MUST NOT 写入本机绝对路径。
6. `text_unit_id` MUST 可由相同 raw 输入确定性重建。
7. `text_unit_id` MUST NOT 被宣传为永不变化的数据库主键。
8. `source_hash` MUST 逐文本字段计算，不能只使用整话 raw hash。
9. 译文迁移 MUST 离线执行并生成报告。
10. 模糊或多候选迁移 MUST NOT 自动写回正式 overlay。
11. speaker raw name MUST 永远保留。
12. 空 speaker MUST NOT 自动等同 narrator。
13. Backlog 和 Choice MUST 通过统一 resolver 渲染。
14. Vue MUST 将文本作为文本节点渲染；未清理 overlay 禁止 `v-html`。
15. 中文 overlay 缺失或损坏 MUST NOT 阻止日文原文播放。
16. UI i18n 与 story translation MUST 使用不同 repository/schema。

---

## 7. Compiled Scenario IR v2 文本契约

### 7.1 Dialogue 推荐结构

```js
{
  step_id: 12,
  type: "adv",

  dialogue: {
    speaker: {
      kind: "unknown",
      entity_type: null,
      entity_id: null,
      source_name: "？？？"
    },

    source_text: "しかも、男性アイドル。\nなら、躍動感を強めたいね。",

    text_ref: {
      unit_id: "story-text:v1:1_4_001_01:1_4_001_01_d:cmd-000138:dialogue:000",
      source: {
        scenario_id: "1_4_001_01",
        part_id: "1_4_001_01_d",
        file: "episodes/1_4_001_01_d.json",
        command_index: 138,
        field_kind: "dialogue",
        field_ordinal: 0
      },
      source_hash: "sha256:..."
    },

    voice: "...",
    lip: { "path": "...", "source": "compiled" }
  }
}
```

### 7.2 兼容字段策略

迁移期间允许 Normalizer 读取：

```js
dialogue.text
dialogue.text_jp
dialogue.text_cn
dialogue.source_text
```

规范化后的内部 source text 选择顺序：

```text
source_text
→ text_jp
→ legacy text
→ ""
```

规则：

- v1 compiler 暂时可继续输出 `text/text_jp/text_cn`；
- v2 compiler MUST 输出 `source_text + text_ref`；
- v2 compiler SHOULD NOT 输出空 `text_cn`；
- legacy `text_cn` 只作为临时 inline overlay 适配来源；
- 正式 UI 不得继续直接读取 `text_cn`。

### 7.3 TextRef 必需字段

```js
text_ref: {
  unit_id: string,
  source: {
    scenario_id: string,
    part_id: string,
    file: string,
    command_index: integer,
    field_kind: string,
    field_ordinal: integer
  },
  source_hash: "sha256:<hex>"
}
```

可选诊断字段：

```js
{
  raw_type: "text",
  parser_rule: "ScenarioCompiler._text",
  confidence: "exact",
  previous_source_hash: null,
  next_source_hash: null
}
```

`raw_values` 可在 debug fixture 中保存，但生产 compiled JSON SHOULD 避免重复整段原文和无关 raw 参数造成体积膨胀。

### 7.4 Field kind 初始枚举

第一版 schema 至少预留：

```text
dialogue
narration
choice_short
choice_detail
title
synopsis
time_caption
mobile_message
phone_message
scene_icon_label
system_caption
```

角色名、卡片名、活动名、组合名原则上属于 Entity Translation，不重复写入每话 overlay。

### 7.5 Field ordinal

`field_ordinal` 是同一 raw command 和同一 field kind 下的零基序号：

- 普通 dialogue：`0`；
- choice 第一个 option：`0`；
- choice 第二个 option：`1`；
- 同一命令同时产生 short/detail 时，用不同 field kind，而不是共用 ordinal；
- ordinal 表示来源结构，不表示 UI 当前排序。

### 7.6 Command index 规则

- 使用 raw `Command` 数组的零基 local index；
- 多 part compile 时每个 part 独立计数；
- compiled 合并后的全局 command 序号不能作为唯一来源坐标；
- synthetic step 若无单一 raw command，必须记录 command range 或 `confidence: derived`；
- 一个 step 吞入多个 raw command 时，step evidence 可保留 `command_start/end`，每个 text_ref 仍指向真正承载文本的 local command。

### 7.7 Source file 规范化

生产 JSON 只允许仓库/归档相对路径：

```text
episodes/1_4_001_01_d.json
```

禁止：

```text
C:\Users\...\raw\episodes\1_4_001_01_d.json
E:\BaiduNetdiskDownload\...
```

路径规则：

- 分隔符统一 `/`；
- 不含 `.`、`..` 段；
- 大小写按归档规范保存，不在 hash 阶段擅自 lower-case；
- `part_id` 从规范资源 identity 获取，不依赖机器路径。

---

## 8. `text_unit_id` 规范

### 8.1 格式

推荐 v1 格式：

```text
story-text:v1:<scenario_id>:<part_id>:cmd-<6位index>:<field_kind>:<3位ordinal>
```

示例：

```text
story-text:v1:1_4_001_01:1_4_001_01_d:cmd-000138:dialogue:000
story-text:v1:1_4_001_01:1_4_001_01_d:cmd-000146:choice_short:000
story-text:v1:1_4_001_01:1_4_001_01_d:cmd-000146:choice_short:001
```

### 8.2 编码

- `scenario_id`、`part_id`、`field_kind` 使用 compiler 认可的 ASCII canonical token；
- 不直接把任意文件路径或原文拼入 ID；
- 如果将来出现不满足 token 规则的 source identity，应先建立 canonical alias，不临时 URL encode 各处字符串；
- ID format 自带 `v1`，格式变化时提升 ID 版本，不静默改变生成规则。

### 8.3 保证范围

相同的：

```text
scenario identity
+ part identity
+ raw Command 顺序
+ field extraction rule
```

必须生成相同 `text_unit_id`。

以下变更可能导致 ID 改变：

- 在当前命令之前插入/删除 raw command；
- raw part 拆分或合并；
- parser 将一个字段拆成多个字段；
- choice 来源结构改变；
- canonical scenario/part identity 修正。

这不是异常，因此必须有第 16 节的离线迁移流程。

### 8.4 冲突检测

compiler/verifier MUST 检查：

- 同一 compiled scenario 内 unit_id 是否唯一；
- 同一 unit_id 是否出现不同 source_hash；
- 相同 source coordinate 是否生成多个相同 field ordinal；
- overlay 是否含有当前 scenario 不认识的重复 key；
- entity text 与 story text 是否错误共用 identity namespace。

---

## 9. Source text 规范化与 hash

### 9.1 规范化算法 v1

```js
function normalizeSourceTextV1(input) {
  return String(input ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .normalize('NFC')
}
```

然后对 UTF-8 bytes 计算 SHA-256：

```text
source_hash = "sha256:" + hex(sha256(utf8(normalizedText)))
```

### 9.2 明确不做的归一化

v1 MUST NOT 默认执行：

- `trim()`；
- 连续空白折叠；
- 全角/半角转换；
- 标点替换；
- 假名、汉字或大小写转换；
- 删除换行；
- 替换玩家名占位符；
- Ruby/control marker 的无证据清理。

如果 raw parser 已经有确定的控制码清理规则，应在进入 hash 前完成，并记录 `parser_rule`；不能由翻译层偷偷修改。

### 9.3 Hash 边界

以下分别计算，不混在一个 hash 中：

- speaker source name；
- dialogue body；
- choice short text；
- choice detail；
- title；
- synopsis。

以下不进入 source text hash：

- voice cue；
- lip path；
- step_id；
- camera/Spine/screen cue；
- translation status；
- compiler build timestamp。

### 9.4 Scenario raw hash

顶层 `source.raw_hash` 继续保留，用于证明整份 raw 输入；它不能替代逐 text unit hash。

---

## 10. Speaker identity

### 10.1 数据结构

```js
speaker: {
  kind:
    | "idol"
    | "producer"
    | "named"
    | "unknown"
    | "narrator"
    | "none",

  entity_type: "idol" | "npc" | "system" | null,
  entity_id: string | null,
  source_name: string
}
```

### 10.2 映射原则

- `source_name` MUST 保存 raw 显示值；
- 能精确映射偶像时，`kind=idol` 并填 `entity_id`；
- `<P>` 可映射为 `producer`，但 source token 仍保留；
- `？？？` 使用 `unknown`；
- 有名字但无实体表记录的 NPC 使用 `named`；
- 空名字默认 `none`，除非 raw type 明确证明是 narration；
- 映射不足时宁可 `entity_id=null`，不得猜测人物。

### 10.3 Speaker 显示解析

优先级：

```text
EntityTranslationRepository 中目标 locale 名称
→ story overlay 中显式 speaker override（只允许特殊剧情语境）
→ speaker.source_name
```

大多数角色名不应重复存入每话 overlay。

---

## 11. Choice identity 与历史记录

### 11.1 编译结构

```js
{
  choice_id: "choice:v1:1_4_001_01:1_4_001_01_d:cmd-000146",
  options: [
    {
      option_id: "choice-option:v1:1_4_001_01:1_4_001_01_d:cmd-000146:000",
      target_step_id: 40,
      short_text: "...",
      short_text_ref: { ... },
      detail_text: "...",
      detail_text_ref: { ... }
    }
  ]
}
```

`target_step_id` 属于 Runtime flow；`option_id/text_ref` 属于选择身份与显示。翻译不得覆盖 target。

`choice_id/option_id` 与 text unit 一样由 source coordinate 确定性生成，不得以可移动的 `step_id` 作为长期选择身份；Runtime 可以另外保留 step-local `flow.choice_id` 兼容映射。

### 11.2 selected choice 记录

History/session 中保存：

```js
{
  choice_id: "...",
  option_id: "...",
  text_unit_id: "...",
  source_hash_at_selection: "sha256:..."
}
```

可以额外保存 source text 作为灾难恢复/诊断 fallback，但它不是当前显示文字。

禁止只保存：

```js
{ selectedText: "当时界面显示的字符串" }
```

### 11.3 Backlog 渲染

Backlog 根据 `text_unit_id` 和当前 story preferences 重新解析选项文字。语言切换后，旧选择立即更新显示，但 `option_id`、分支结果和 snapshot 不改变。

---

## 12. Translation Overlay schema

### 12.1 文件布局

```text
public/translations/
  zh-CN/
    scenarios/
      1_4_001_01.json
    entities/
      idols.json
      npcs.json
      units.json
      cards.json
      events.json
```

scenario 文件按 canonical compiled scenario identity 命名，不按当前路由 query 临时拼接。

### 12.2 Scenario overlay

```json
{
  "schema_version": 1,
  "locale": "zh-CN",
  "scenario_id": "1_4_001_01",
  "source_raw_hash": "sha256:...",
  "entries": {
    "story-text:v1:1_4_001_01:1_4_001_01_d:cmd-000138:dialogue:000": {
      "source_hash": "sha256:...",
      "text": "……",
      "status": "reviewed",
      "translator": null,
      "reviewer": null,
      "notes": []
    }
  }
}
```

### 12.3 Entry status

首版只冻结三个可写状态：

```text
draft
reviewed
final
```

以下是运行时/验证器推导状态，不写回 entry：

```text
missing
stale
invalid
orphaned
```

因此以下组合有效：

```text
status = reviewed
stale = true
```

它表示译文曾审校，但当前 source hash 已改变。

`terminology_checked`、`character_checked` 等流程信息以后可作为 checks 数组扩展，不在首版制造互斥状态爆炸。

### 12.4 Metadata

- `translator/reviewer` 首版允许 null；
- 若公开展示贡献者，必须使用明确同意公开的稳定署名，不把账户邮件或本机用户名写入产物；
- `notes` 是人工工作流信息，不允许携带 HTML；
- production bundle 可以在构建时剥离内部 notes，但不得改变 text/status/source_hash。

### 12.5 Overlay 不能拥有的字段

overlay schema MUST 拒绝：

```text
step_id override
target_step_id override
voice
lip
timeline/cues
snapshot/state
resource path
auto/skip behavior
```

翻译文件只影响显示文本和翻译元数据。

---

## 13. TranslationRepository

### 13.1 职责

Repository 只负责：

- 按 `scenario_id + locale` 加载静态 overlay；
- schema 校验；
- 缓存；
- 缺失文件降级为空 overlay；
- 暴露 entry 查询；
- 提供调试诊断。

它不负责：

- 选择 primary/secondary；
- 修改 Runtime step；
- 猜测迁移旧译文；
- 在线写回翻译；
- 渲染 DOM。

### 13.2 推荐接口

```js
class TranslationRepository {
  async loadScenario({ scenarioId, locale, signal }) {}
  getEntry({ scenarioId, locale, unitId }) {}
  getDiagnostics({ scenarioId, locale }) {}
  invalidate({ scenarioId, locale }) {}
  clear() {}
}
```

### 13.3 加载规则

- 404：返回空 overlay，记录 `translation_missing`，不报 fatal；
- JSON/schema 损坏：忽略该 overlay，记录 `translation_invalid`；
- locale 不匹配：拒绝 overlay；
- scenario_id 不匹配：拒绝 overlay；
- 重复 unit_id：构建期失败；
- 旧异步请求完成时如果 scenario generation 已变化，不得覆盖当前 repository view。

### 13.4 缓存 key

```text
translation:<schema_version>:<locale>:<scenario_id>:<asset_revision>
```

不要把 story display mode 放入资源缓存 key；同一 overlay 可服务 zh-only 和 bilingual。

---

## 14. StoryTextResolver

### 14.1 纯函数边界

Resolver 输入：

```js
resolveStoryText({
  source,
  textRef,
  speaker,
  overlayEntry,
  entityNames,
  preferences
})
```

Resolver 不 fetch、不读 localStorage、不操作 Runtime、不写 History。

### 14.2 输出 View Model

```js
{
  unitId: "...",
  speaker: {
    kind: "unknown",
    entityId: null,
    source: "？？？",
    display: "？？？"
  },
  primary: {
    locale: "zh-CN",
    text: "中文译文",
    source: "translation"
  },
  secondary: {
    locale: "ja-JP",
    text: "日本語原文",
    source: "original"
  },
  translation: {
    available: true,
    status: "reviewed",
    stale: false,
    fallbackUsed: false
  }
}
```

### 14.3 模式规则

#### Original

```text
primary = ja-JP source
secondary = null
```

#### Translation

有有效译文：

```text
primary = requested locale translation
secondary = null
```

缺译或默认不允许 stale：

```text
primary = ja-JP source
fallbackUsed = true
```

#### Bilingual

```text
primary = bilingual_primary 对应文本
secondary = 另一文本
```

如果译文缺失，不能重复显示两遍日文：

```text
primary = ja-JP source
secondary = null
fallbackUsed = true
```

### 14.4 Stale 策略

正式生产默认：

- stale entry 不作为有效译文；
- 回退原文；
- debug 模式可显示 stale 译文及徽标用于审校；
- 后续可增加显式用户偏好，但不能默认悄悄展示过期译文。

### 14.5 兼容 adapter

迁移期保留 `TextHelper`：

```text
Legacy dialogue
→ normalizeLegacyDialogue()
→ StoryTextResolver
→ 旧组件所需 { speaker, text }
```

正式 Dialogue/Choice/Backlog 改造完成后，禁止新增直接读取 `text_cn` 的代码。

---

## 15. 用户偏好与 UI i18n

### 15.1 Preferences schema v2

```js
{
  schema_version: 2,
  ui_locale: "zh-CN",
  story_content_mode: "original" | "translation" | "bilingual",
  story_translation_locale: "zh-CN",
  bilingual_primary: "original" | "translation",
  missing_translation_policy: "fallback-source",
  // 其余 auto/skip/volume 字段保持
}
```

UI locale 使用 BCP 47 字符串，不使用 `JP/CN` 作为正式 locale code。

### 15.2 v1 → v2 迁移

| v1 `language_mode` | v2 content mode | bilingual primary |
|---|---|---|
| `JP` | `original` | `original` |
| `CN` | `translation` | `translation` |
| `BILINGUAL` | `bilingual` | `original`（保持当前 JP→CN 顺序） |

`ui_locale` 首次迁移采用产品默认值或浏览器 locale 的受支持映射，不从旧 `language_mode` 武断推导。

### 15.3 UI i18n

UI key 示例：

```text
player.controls.auto
player.controls.skip
player.controls.backlog
player.settings.uiLanguage
player.settings.storyLanguage
player.errors.translationInvalid
archive.filters.storyType
archive.states.assetMissing
```

当前阶段可以用简单 resolver；当门户进入全面双语时 SHOULD 迁移到 `vue-i18n`。无论使用何种库，都必须保持 UI 字典和 TranslationRepository 分离。

### 15.4 切换语言的 Runtime 不变量

用户切换 UI locale 或 story content mode 时：

```text
currentStep           不变
currentStepIndex      不变
runtime generation    不变
active performance    不变
voice playback        不变
lip sync              不变
Spine tracks          不变
camera/background     不变
SceneSnapshot         不变
HistoryNode count     不变
read state            不变
```

只允许 computed view model 和 UI labels 更新。

---

## 16. 译文迁移与重新编译

### 16.1 迁移位置

迁移是离线工具：

```text
old compiled + old overlay
new compiled
    ↓
translation migration report
    ↓
人工确认
    ↓
new overlay
```

生产网站运行时不执行迁移。

### 16.2 匹配优先级

1. unit_id 仍存在且 source_hash 相同：`matched_exact`；
2. unit_id 仍存在但 source_hash 不同：`stale_same_coordinate`；
3. part、field kind、speaker、source_hash、邻近上下文共同唯一匹配：`moved_high_confidence`；
4. 存在多个候选：`ambiguous`；
5. 旧译文无新目标：`orphaned`；
6. 新文本无旧译文：`new`。

### 16.3 禁止只按 hash 自动迁移

以下文本高度重复：

```text
はい
……
えっ？
プロデューサー
そうですね
```

因此 `source_hash` 相同只是证据之一。高置信迁移至少结合：

- source part；
- field kind；
- speaker identity/source name；
- previous/next text hash；
- command 相对位置；
- 候选唯一性。

### 16.4 写回策略

- `matched_exact` 可自动复制到候选输出；
- `moved_high_confidence` 首版仍应进入人工确认清单；
- `ambiguous` MUST NOT 自动写回；
- `stale_same_coordinate` 保留旧译文与旧 source_hash，供审校，不将 stale 改写为新 source_hash；
- 工具必须输出机器可读 JSON 和人类可读摘要。

### 16.5 报告格式

```js
{
  schema_version: 1,
  scenario_id: "...",
  old_source_raw_hash: "...",
  new_source_raw_hash: "...",
  counts: {
    matched_exact: 0,
    moved_high_confidence: 0,
    stale_same_coordinate: 0,
    ambiguous: 0,
    orphaned: 0,
    new: 0
  },
  records: []
}
```

---

## 17. Entity Translation 与门户

### 17.1 为什么单独存储

以下名称会跨页面、剧情和资料重复出现：

- idols；
- units；
- NPC；
- cards；
- events；
- skills；
- story collection titles。

它们应按 entity identity 翻译，不应重复写入每个 scenario overlay。

### 17.2 Entity overlay 示例

```json
{
  "schema_version": 1,
  "locale": "zh-CN",
  "entity_type": "idol",
  "entries": {
    "001tom": {
      "source_hash": "sha256:...",
      "name": "天道辉",
      "status": "reviewed"
    }
  }
}
```

### 17.3 门户解析优先级

```text
Entity translation
→ masterdata source name
→ resource/scenario fallback label
```

搜索索引可同时包含原文与译文，但 route、resource ID、collection identity 不随 locale 改变。

### 17.4 第一阶段边界

第一阶段只需为测试话涉及的少量 speaker/entity 建 fixture；不要求全量门户实体翻译。

---

## 18. 安全、完整性与失败降级

1. compiled scenario、overlay 和 entity translation 都视为不可信静态输入。
2. 所有文件必须 schema 校验。
3. 文本默认作为 Vue text node 渲染。
4. 翻译文本不得解析为命令、cue、URL 或资源路径。
5. overlay 不得改变 choice target。
6. 文件加载失败必须回退 source，不阻止播放器。
7. 诊断不得泄漏本机绝对路径。
8. translator/reviewer metadata 不得泄漏邮件、token 或操作系统账户名。
9. 超长文本必须由布局处理，不能用截断数据规避。
10. Unicode bidi/control 字符需要 verifier 报告，但不能在无依据时静默删除原文字符。

---

## 19. 验证器与测试策略

### 19.1 Compiler verifier

检查：

- 每个可翻译字段都有 text_ref；
- unit_id 唯一且可重建；
- command index 在对应 part 范围内；
- source_hash 与规范化算法一致；
- speaker mapping 不丢 source_name；
- choice option identity 唯一；
- production evidence 不含绝对路径。

### 19.2 Overlay verifier

检查：

- schema/locale/scenario_id；
- unknown unit_id；
- duplicate/collision；
- missing/stale/orphaned；
- 非法 status；
- 空译文和仅空白译文；
- overlay 中出现禁止演出字段；
- 目标 locale 字体/控制字符风险。

### 19.3 Resolver unit tests

至少覆盖：

1. original 模式；
2. translation 有译文；
3. translation 缺译回退；
4. bilingual original-primary；
5. bilingual translation-primary；
6. bilingual 缺译不重复原文；
7. stale 默认回退；
8. unknown speaker；
9. entity speaker 翻译；
10. legacy `text/text_jp/text_cn` adapter；
11. 空文本与 narration；
12. Unicode/换行保持。

### 19.4 集成测试

固定一话至少包含：

- 正常短句；
- 超长中文；
- 缺译；
- stale；
- 双语；
- unknown speaker；
- `<P>`；
- choice short/detail；
- Mobile/Phone；
- title/synopsis；
- voice 正在播放时切换语言；
- Backlog 打开时切换语言；
- 回退后切换语言。

### 19.5 Runtime 不变量测试

切换语言前后断言：

```text
step_id 相同
generation 相同
active cue ids 相同
voice handle 相同且播放位置连续
snapshot hash 相同
history length 相同
selected option_id 相同
```

### 19.6 UI 压力测试

- 200% 中文长度；
- 中日双语四行以上；
- 小屏幕和窄屏；
- 字体 fallback；
- speaker 超长名称；
- Backlog 大量条目；
- Portal card/title 长文本；
- 缺译/stale debug badge 不挤压正文。

---

## 20. 实施阶段与 Git 边界

### Phase L0：文档与 schema

范围：

- 本文；
- v2 schema text definitions 草案；
- overlay schema 草案；
- 最小 fixture 约定。

不改运行行为。

建议提交：

```text
docs(story): define localization contract
```

### Phase L1：compiler 文本证据

- raw loop 暴露 part/local command index；
- text_ref/unit_id/hash；
- speaker classification；
- choice identity；
- verifier。

建议提交：

```text
feat(story): compile stable text evidence
```

不得混入 Spine、screen fade、audio 修复。

### Phase L2：repository 与 resolver

- 静态 overlay schema；
- 一话 fixture；
- TranslationRepository；
- StoryTextResolver；
- legacy adapter tests。

建议提交：

```text
feat(story): resolve scenario translation overlays
```

### Phase L3：播放器统一消费

- Dialogue；
- Choice；
- Backlog；
- Mobile/Call/Title/Synopsis；
- 删除组件内重复语言判断。

建议提交：

```text
refactor(story): unify localized text rendering
```

### Phase L4：Preferences schema v2 与 UI 字典

- 拆分 UI locale/content mode；
- v1 preferences migration；
- 播放器 UI keys；
- 切换语言 Runtime invariant test。

建议提交：

```text
feat(story): separate ui and content language preferences
```

### Phase L5：迁移报告与门户实体

- missing/stale/collision verifier；
- conservative migration report；
- 小规模 EntityTranslationRepository；
- 门户搜索双语言索引验证。

建议拆成两个提交，不与 L4 混合。

### 与 Runtime Phase 的相对顺序

```text
已完成/进行中的 Runtime Scheduler 与 Spine timeline 收敛
→ L0 文档
→ L1–L4 本地化最小闭环
→ Runtime Audio Phase
→ Runtime legacy cleanup
→ L5 迁移与门户扩展
→ 批量翻译
```

若 Runtime 当前仍有阻断播放的高优先级回归，可先修复回归；但不得在修复提交中顺手实现 Localization Contract。

---

## 21. 验收标准

### 21.1 数据契约

- v2 每个 story text field 有可追溯 text_ref；
- unit_id 确定性验证通过；
- source hash 规范有测试向量；
- speaker raw name 不丢失；
- choice identity 与 target 分离；
- overlay 无演出字段。

### 21.2 播放行为

- 切语言不重播或打断 voice；
- 不重建 Spine、不取消 camera/SE cue；
- current step/history/snapshot 不变；
- 中文缺失时只回退该文本单元；
- 双语可分别布局，不再依赖换行拼接字符串。

### 21.3 Backlog 与选择

- 语言切换后历史 dialogue 和 choice 同步更新；
- Choice 分支身份不依赖显示语言；
- voice replay 和 snapshot restore 不受语言影响；
- 旧 HistoryNode 有兼容 fallback。

### 21.4 工程

- compiler、overlay、resolver verifier 全部通过；
- build 通过；
- 一话压力 fixture 完成浏览器验收；
- 文档、schema、fixture、实现同步；
- 每批 Git commit 可独立回滚；
- 未引入翻译管理后台或无关 Runtime 改造。

---

## 22. 风险登记

| 风险 | 影响 | 缓解 |
|---|---|---|
| 把 unit_id 当永久主键 | raw 插入后大量错位 | 明确可重建定位键 + 离线迁移 |
| 只按 source_hash 迁移 | 重复短句串译 | part/kind/speaker/邻近证据 + ambiguous 人工确认 |
| speaker 强制映射 idol | NPC/未知角色伪造身份 | kind/entity 可空 + 永留 source_name |
| Choice 保存显示字符串 | 切语言后历史混杂 | 保存 option/text identity |
| stale 作为人工字段 | 状态与 source 脱节 | 根据 hash 动态推导 |
| UI i18n 与正文混库 | 数万文本、加载与职责混乱 | 两个 repository/schema |
| overlay 覆盖 flow/cue | 翻译改变演出 | schema 拒绝演出字段 |
| 一次做全量门户翻译 | 范围爆炸、拖慢 Runtime | 一话 fixture + 少量 entity 起步 |
| 双语继续拼接字符串 | 布局不可控 | primary/secondary View Model |
| source path 写绝对路径 | 隐私与不可复现 | canonical archive-relative path |

---

## 23. 明确延后

- 在线翻译编辑器；
- 多人协作权限系统；
- 翻译数据库/API；
- 自动机器翻译；
- TMS 对接；
- 全自动 fuzzy migration 写回；
- 翻译贡献者公开档案；
- 复数、性别等复杂 UI message format 的全面迁移；
- 繁中、英文等第三语言的正式内容发布；
- 全量 card/event/entity 翻译；
- stale 译文生产环境可见性设置；
- 翻译内容的在线热更新。

契约预留这些能力，但第一阶段不实现。

---

## 24. 实施前仍需确认的开放问题

以下不阻塞文档成立，但进入对应代码批次前必须回答：

1. canonical `scenario_id` 对多 part 合并文件采用现有 compiled file base，还是新增逻辑 group identity？
2. overlay 是按合并 scenario 一个文件，还是按 raw part 多文件加载后合并？本文默认按 compiled scenario 一个文件。
3. speaker name 是否作为独立 story text unit；本文默认常规角色名走 entity，特殊剧情 override 才走 story overlay。
4. choice short/detail 在不同 raw 类型中的精确来源坐标如何归一；需 raw fixture 审计。
5. 玩家名占位符的 source hash 与显示替换顺序；本文默认先 hash 原始占位符，显示阶段再替换。
6. Ruby/控制码是否已由 compiler 可靠解析；若没有，不能在本地化层擅自删除。
7. production overlay 是否保留 translator/reviewer/notes；需部署体积与署名策略决定。
8. UI locale 初次默认取站点默认还是浏览器语言；需要产品决定。

---

## 25. 第一批实现清单

获得代码实施授权后，第一批只做：

1. 扩充 v2 schema 的 `speaker/textRef/choiceTextRef` definitions；
2. 新增 translation overlay schema；
3. 为 `1_4_001_01_d` 手工建立最小 text evidence fixture；
4. 编写 source normalization/hash 测试向量；
5. compiler 暴露 `source_part_id + local_command_index`；
6. 生成 unit_id 并验证重复；
7. 不接 UI、不改当前播放表现。

第一批完成后才能进入 Repository/Resolver。

---

## 26. 完成定义

本文对应的“Localization Contract 落实完成”不是“已经翻译完”，而是：

```text
原文身份已稳定生成
译文有独立 schema 与文件边界
所有剧情文本由同一 Resolver 解释
UI locale 与正文模式已经拆分
Backlog/Choice 不保存语言相关事实
missing/stale/collision 可验证
切换语言不改变 Runtime
一话压力测试通过
```

达到以上条件后，项目才适合恢复常规 Runtime 迭代并逐步开始真实翻译。

---

## 27. 最终决策记录

### 接受

- UI i18n 参考成熟引擎的键值与偏好体验；
- 正文采用单一 IR + translation overlay；
- `text_unit_id + source_hash + source_evidence` 三件套；
- 多 part 使用 part-local command coordinate；
- 迁移离线、保守、可审计；
- speaker identity 可空但 source name 永存；
- Choice 保存 identity；
- Resolver 输出结构化 primary/secondary；
- Language 切换保持 Runtime 完全不变；
- 分阶段、小提交、一话先验收。

### 拒绝

- WebGAL 式多语言 scene 复制；
- runtime translation branching；
- `step_id` 作为翻译键；
- hash-only 自动迁移；
- stale 人工布尔字段；
- compiler 正式 v2 继续写空 `text_cn`；
- 组件各自判断语言；
- 首阶段建设完整翻译平台。

### 延后

- 全量门户实体翻译；
- 第三语言；
- 在线协作工作流；
- 高级迁移工具；
- 全面引入 `vue-i18n`，直到 UI 国际化范围确认。
