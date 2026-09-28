# Producer 说话人与正文占位符审计（2026-09-28）

审计输入为 `codex/gs-architecture-rebuild@ee4725a418e11f48d15172c232bd6433f2e5cd81`。
用户提供的分析是待验证假设；下列数字来自本分支的 Reader manifest、逐份
Reader 文档和本地 mounted compiled 目录。没有改写 RAW、compiled、Reader、
`text_ref`、译文 overlay 或前端展示。

## 可复现的范围

从 `web_viewer` 运行：

```powershell
npm run verify:producer-placeholders
npm run audit:producer-placeholders
```

审计逐份核对 2,801 个 Reader 文档的 manifest SHA-256，并检查有身份的命中行的
`source_hash` 对原文哈希。详细逐行报告写入本地
`.analysis/producer-placeholder-audit.json`，含 domain、speaker、前后各 20 字、
row ID、unit ID、source hash 与来源文件；不把大段正文副本提交到仓库。
另扫描本地 `public/data/compiled` 的 10,420 个 JSON 文件，检查是否存在其他
黑点长度或 `○`、方块、全角 `<P>`、模板 token 候选。compiled 文件会重复存放
`text`/`text_jp`，并含父集与分集副本；其命中次数**不是文本单元数**。
其中只有 769 个 compiled JSON 由 Git 跟踪；干净 CI checkout 的 compiled
巡检仅覆盖该跟踪子集，不能冒充本机 10,420 文件的复测。Reader 文档的
2,801 份输入由仓库跟踪，Source Gate 会对其重新审计。

| Reader 正文现象 | 次数 | 文档数 | 已有 `text_ref` | 缺身份 |
| --- | ---: | ---: | ---: | ---: |
| `●●●●`，紧接 `プロデューサー` | 1,097 | 805 | 217 | 880 |
| `●●●●●●●●●●`，后接各类称呼或独立使用 | 195 | 139 | 42 | 153 |
| 其他连续黑点长度、`○`/方块、`＜P＞`、`<P>` 正文、模板 token | 0 | 0 | 0 | 0 |

两类合计 1,292 次命中，覆盖八个 Reader 域。四黑点在 Reader 与整个 mounted
compiled JSON 扫描中都只见于紧接 `プロデューサー` 的形式；十黑点并不固定接
`監督`。十黑点后还见 `師匠`、`ぴぃちゃん`、`番長さん`、`ボス`，以及
单独接 `さん` 或句号的实例。例：`1_1_002_02_j` 中为
`●●●●●●●●●●さん`；`1_2_029_01_e` 中为
`我が主●●●●●●●●●●。`。因此不能把十黑点连同后面的称谓视为一个
固定替换串。

Reader 的 2,942 行 `speaker.kind=producer` 均保留 canonical
`speaker.sourceName=<P>`，与黑点命中行交集为 0。正文另有 785 行包含
`プロデューサー` 而没有黑点。这证明当前语料中的**说话人身份、职业称谓字面量、
黑点姓名候选**至少是三个不同的字段/文本现象，不能用
`プロデューサー → {{producer_name}}` 一类全局词汇替换处理。

Reader manifest 的展示标题还含 347 处黑点（四黑点 298、十黑点 49）；
这是展示元数据，不在上述 1,292 个正文命中里。mounted compiled 的
3,591 个 JSON 文件含候选字面量，原始 JSON 命中四黑点 11,259 次、十黑点
1,842 次；没有检出其他连续黑点长度。这些数受重复序列化影响，不能用来推断
独立剧情数或翻译工作量。未做全量 RAW 字节对照，也未覆盖游戏 UI、卡名和未挂载来源。

## 当前消费者差异

- `shared/reading/ReadingDocument.js` 的 `readingPresentationSpeaker()` 在展示前
  把 Producer `<P>` 改为日文 `プロデューサー`，Reader canonical row 仍存 `<P>`。
- `StoryTextResolver.js` 默认把 canonical speaker source 原样作为 display；
  `verify-story-localization-stress.mjs` 当前要求翻译模式的 Producer 显示为 `<P>`。
- Mobile Chat 识别 `<P>` / `プロデューサー` / `Producer`，并给所选回复
  写入日文 `プロデューサー`；Mobile Call 的回复标签也是日文常量。
- Archive 用户偏好目前是 v2，只有首页模式、偶像和 onboarding 状态；没有
  `producerDisplayName`。本分支未发现 Producer 专用的翻译输入投影、token
  保真校验或跨 Reader/Player/Mobile 的单一展示 resolver。

## 翻译前冻结边界与待定项

1. **已确定**：canonical `source_text`、`unit_id`、`source_hash` 保持原样。
   有身份的 259 次占位命中按原文哈希验证；用户显示名不得进入这些来源字段。
   译文、纠错与 TM 应保存受控模板，而不是用户展开后的名字。
2. **已确定**：`<P>` 说话人、字面 `プロデューサー` 称谓和四/十黑点必须分别
   建模。当前不能把全部黑点无条件替换为一个 `{{producer_name}}` token，
   也不能直接把含黑点原文送入批量翻译。
3. **尚待来源核定**：四黑点与十黑点是否分别对应原游戏的“Producer 名”与
   “Story/Mobile 表示名”，以及 Archive 是否可用一个自定义显示名安全覆盖
   两者。附件所述注册页语义与语料模式相符，但本次没有注册页原始资源和全量
   RAW/UI 证据足以冻结这种映射。
4. **下一道门**：先为每种模板形态建立人工确认清单，核定姓名变量与后缀称谓
   的边界；再定义 exporter 的非破坏性输入投影和 validator 的 token 数量/保真
   规则。缺 `text_ref` 的 1,033 次命中还需先取得稳定身份，不能借展示投影
   补造 `unit_id`。随后才考虑单一偏好 owner、Reader/Player/Backlog/Mobile
   展示一致性与可选设置 UI。

本审计是翻译前的 source-only gate，不是 Producer 显示功能、译文、完整 RAW
验收或生产页面验收。具体称谓译法和“默认称呼”属于翻译风格/Bible 决策，
不由黑点长度自动推出。
