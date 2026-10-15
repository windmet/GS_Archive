# 通用翻译流程（翻译记忆版，2026-10-15）

通用流程处理“按原文翻译、一句对一句”的文本：资料名称与说明、卡面台词、触摸语音、首页通用语音、电话标题、通信聊天。剧情正文（含季节企划）仍走剧情 Studio 批次，按 Reader 文本单元 `unit_id + source_hash` 绑定，见文末。

## 模型：一条原文 = 一条记忆

- **翻译记忆** `translation/tm/zh-CN/<分片>.json`：键为 `metadata:v1:<kind>:<field>:<原文 SHA-256>`，每条记原文、译文、状态（draft / reviewed / final）、决定（translated / uncertain / keep-source）、疑义说明、译者、校对者、来源批次。
- **身份只看原文**。使用位置（哪张卡、哪段聊天）、批次、语料顺序都只是上下文，每次从语料重算，不进身份。所以新增卡片、复用同一句、重新提取导致顺序变化，都不影响已有译文。
- 原文改了 → 新键，状态为缺译；旧条目成为 orphan，保留不发布，`prune --confirm` 才删除。
- **改动记录交给 git**。人工确认记在 `translation/tm/reviews.json`（批次、条数、校对者、原话、日期）。不再有整批哈希、批准绑定、amendment 链。
- 2026-10-15 前的 `translation/studio/general/revisions/` 18 个批次（7,647 条，全部 reviewed）已原样迁入；批准原话和旧回执哈希在 reviews.json 的 `legacy` 字段，旧文件见 git 历史。

## 新增一类语料

1. 在 `scripts/lib/archive-general-text-corpus.mjs` 里加提取（`add(kind, id, field, 原文, 说话人, 所属)`）。
2. 在 `scripts/lib/translation-domains.mjs` 的 `KINDS` 里加一行：审计标签、给模型的小标题、发布分片、提示词类型（general / character / chat）。没登记的 kind 会直接报错。
3. 页面用 `useArchiveNamedText.js` 的 `archiveLineText(分片, [[kind, field]], 原文)` 显示（台词类），或 `archiveNamedText`（资料类）。

分片、批次分组、提示词、审计分组都从注册表派生，无需改其他脚本。

## 一轮翻译

在 `web_viewer` 下：

```powershell
# 1. 导出：默认只导出既无记忆、也无规则初译的条目；批次号带波次，不会和旧批次重名
node scripts/general-translation-workflow.mjs export .analysis/general-translation-batches/<新目录> --domains chats,card-lines --wave 20261015 --max-rows 999 --max-chars 56000
# 2. AI Studio：先贴 glossary.md，再逐批贴 input.md；回答原样存为该批 output.md（local 文件夹不上传）
# 3. 检查并导入（逐条写入记忆，状态 draft）
$b = '.analysis/general-translation-batches/<目录>/G-chats-20261015-001'
node scripts/general-translation-workflow.mjs check  "$b/local/batch-map.json" "$b/output.md"
node scripts/general-translation-workflow.mjs import "$b/local/batch-map.json" "$b/output.md" 'Gemini / 实际模型名'
# 4. 发布到 public/translations，并刷新审计
node scripts/generate-archive-general-translations.mjs
node scripts/generate-translation-audit.mjs
# 5. 人工逐批读完后
node scripts/general-translation-workflow.mjs review G-chats-20261015-001 --reviewer '实际校对者' --statement '校对者原话'
```

- `--with-drafts` 把只有规则初译（`translation/studio/general/*-drafts.*`）的条目也导出；`--all` 连已有译文一起导出，供整批重修，旧译文放在 `local/current-translations.json` 对照。
- 回传格式：首行原样复制批次标记；`[001]译文`、`[002?]候选译文` 加下一行 `! 理由`、`[003=]` 保留原文（只限资源键或内部标签）。
- `check` 校验：批次标记、漏条、重复、未知编号、原文被改、空译文、数字 / 参数 / 图标 / 占位符、技能数值顺序、制作人宏、危险 HTML、道具与称号里的偶像定名。它还报告导出后原文已离开语料的条目（orphans，仍可导入）。
- `import`：译文相同的条目跳过；已有**不同**译文的条目默认拒绝，加 `--replace` 才覆盖（覆盖后变回 draft，旧文本在 git 里）。
- `review`：该批全部条目升为 reviewed；仍有 uncertain 的批次不能升级。模型自称“已检查”不算校对。
- `amend producer-slot-restore [--batch ID]`：机械修复 `●●●●制作人` → 原文宏，其余措辞和状态不动。
- `status` 列出每类的总数、draft、reviewed、缺译数，以及 orphans 和无效条目；`verify` 是严格检查（任何记忆条目不合规则即失败）。

## 与构建的关系

- `generate-archive-general-translations.mjs` 和审计**不会因语料或记忆变化失败**：无效条目跳过并警告（回落原文），orphan 不发布，记忆里有但没发布的条目计入审计 `general.unpublished`。
- `npm run build:check` / `prebuild` 仍会刷新审计，因为资源页的「翻译与校对进度」读的是 `config/translation-audit/`；但它只汇报状态，不做翻译的严格检查。
- 严格检查放在翻译相关的提交里跑：`general-translation-workflow.mjs verify` 和 `npm run verify:general-translation-workflow`。

## 制作人称呼占位

原文的 `●●●●プロデューサー`（名字+P）与 `●●●●●●●●●●`（名字）是程序宏，译文必须原样保留，显示时由 `renderProducerAddressing` 按玩家 P 名和显示语言替换。导出时宏换成 `{{GS_ADDRESS:编号:类型}}`，模型看不到原始圆点；导入时还原，标记被改、删、重复或新造都拒绝。剧情 overlay 用的是同一套 `validateProducerAddressingOverlay`。

## 页面上的唯一通路

卡面台词、触摸语音、首页通用语音、偶像自我介绍、电话标题和聊天都经 `archiveLineText`：按资料语言选译文；分片加载中隐藏，不闪日文；无译文回落原文；最后替换制作人宏。首页通用语音（`cue.source === 'idol'`）查 `home-voice/text`，偶像资料页的自我介绍查 `home-voice/self-intro`。`verify-character-line-text.mjs` 覆盖这条通路。

## 剧情正文（含季节企划）

剧情按 Reader 文档导出：`node scripts/prepare-ai-studio-batches.mjs --documents <ID,...> --batch B0NN-<名称> --out .analysis/translation-studio/<目录>`，回传走 `translation:studio:check` / `translation:studio:import`。季节企划 306 篇、2,639 句的批次见 `TRANSLATION_WAVE2_INVENTORY_20261009.md` §6。
