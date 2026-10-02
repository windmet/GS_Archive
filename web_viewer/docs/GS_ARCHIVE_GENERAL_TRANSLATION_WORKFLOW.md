# 通用资料 Gemini 翻译与校对流程

本流程处理背景、卡面标题、衣装、道具、称号、技能与摄影素材的名称和说明。剧情台词、组合剧情、工作通讯和首页对话继续走现有剧情 batch；不要把通用原文拿去按对白口吻续写。本轮只建立流程，不自动向 AI Studio 上传或代替用户确认译文。

## 交给 AI Studio（紧凑版 v2）

当前新包为 `.analysis/general-translation-compact-20261002-ready`。同样的 5,596 个不同资料字段、9,952 次来源使用，分为 22 批。默认每批最多 400 项，**完整 input.md** 最多 16,000 UTF-16 字符，包含指引、原文、短编号和名称上下文；不是只算原文正文。按本轮实际文件对比，旧 60 批输入约 501 万字符，新包约 26.3 万字符，减少约 94.75%。这是字符量比较，不是 Gemini token 计费统计。

1. 新建 AI Studio 会话，先粘贴 `glossary.md`。它是“日文姓名 → 项目暂用中文名”的短表，不是官方中文译名。换新会话时再次提供即可。
2. 一次粘贴一个批次目录的 `input.md`。每份自带完整中文指引，只包含待译原文、三位短编号和必要名称上下文，不含完整系统键、SHA-256、数据库 ID 或重复使用位置。
3. 将 Gemini 回答原样保存为该批次的 `output.md`。无需手动补原文、键值、哈希，也无需让 Gemini 返回 JSON。`output-template.md` 只供本地对照，无需上传。
4. 每批的 `local/batch-map.json` 保留完整原文、键值、哈希和全部使用位置；`local/previous-draft.json` 为初译对照。包根 `local/plan.json` 保存版本和覆盖审计。**local 文件夹不要交给模型。**

每批第一行回传标记已在 input.md 中给出；原样复制该行。正常译文、疑义和保留原文分别使用以下形式（示例标记须换为实际批次）：

```text
# G-items-001 @实际短版本标记
[001]中文译文
[002?]中文候选译文
! 尚不确定的专名及理由
[003=]
```

`[003=]` 不填内容，本地会精确恢复原文；只用于纯资源键或无可靠语义的标记，不能跳过普通日语。正常/疑义译文可直接换行接续，下一条以 `[三位编号]` 开始；保留前导零，不复制原文、上下文、章节标题或检查过程。不用 Markdown 表格，不需要转义字面竖线。

## 检查、导入和发布草稿

在本仓库 PowerShell 执行（$batchDir 可指向解压后的批次绝对路径）：

```powershell
$batchDir = '.analysis/general-translation-compact-20261002-ready/G-items-001'
node scripts/general-translation-workflow.mjs check "$batchDir/local/batch-map.json" "$batchDir/output.md"
node scripts/general-translation-workflow.mjs import "$batchDir/local/batch-map.json" "$batchDir/output.md" 'Gemini / 实际模型名称'
node scripts/generate-archive-general-translations.mjs
node scripts/generate-translation-audit.mjs
node scripts/verify-general-translation-workflow.mjs
node scripts/verify-general-translation-markdown.mjs
node scripts/verify-archive-general-texts.mjs
```

本地工具从短编号恢复完整 source/key/hash/references，并验证批次短版本标记、漏行、重复、未知/错位编号、来源变化、空译文、数值/参数/图标占位符变化和危险 HTML。疑义条目必须带说明。短标记不是完整校验的替代物；内部仍校验完整批次摘要、每条原文哈希与当前来源引用。检查通过只代表格式和身份有效，不代表翻译自然或准确。

导入写入 `translation/studio/general/revisions` 的 draft/not_final 修订。内部继续使用旧 JSON 记录结构，因此公共翻译生成器和资源页校对状态仍可沿用；显示条目使用的是中文译文，疑义说明独立保存。生成器才将有效修订写入公共翻译主索引及页面分片，以后重新生成初译也会保留修订。

如需单独检查本地展开后的完整 JSON，可执行 `node scripts/general-translation-workflow.mjs normalize <local/batch-map.json> <output.md> <新的return.json>`；拒绝覆盖已有输出。此步骤不是普通导入的必需步骤。

旧 60 批 JSON 包保留原样，原 `check/import <batch-map.json> <return.json>` 仍兼容。**不能把旧包的回传放进新包同名批次，也不能将两个包的重叠字段重复导入。** 工具会拒绝批次/来源不匹配或修订重叠。默认不覆盖已有修订；替换前必须明确归档旧修订，不能默默覆盖。

审计页仍在「资源 → 数据与资源状态」的「翻译与校对进度」。同一字段多处使用不重复计校对量；按原文、译文、状态、批次、ID、使用位置检索仍读取完整本地映射。剧情继续保留自己的 Reader/compiled/source_hash 身份，使用原有剧情 batch。

## 人工确认后标记已校对

逐批读完或修订并重新导入后，记录用户对**这一个批次和确切回传版本**的确认。不能因为模型说“已检查”就提升状态，也不能沿用其他批次的确认。保存人工确认文件，例如：

```json
{
  "approved": true,
  "batch_id": "G-items-001",
  "return_sha256": "从对应 revision.json 的 return_sha256 原样复制",
  "reviewer": "实际校对者",
  "statement": "实际用户确认内容，明确这批译文已逐项校对"
}
```

```powershell
node scripts/general-translation-workflow.mjs review translation/studio/general/revisions/G-items-001.json path/to/human-approval.json
node scripts/generate-archive-general-translations.mjs
node scripts/generate-translation-audit.mjs
```

仅该批次提升到 reviewed，仍为 not_final。uncertain 尚未解决的批次不能提升；keep-source 可以作为明确保留原文的校对决定。原文变化时旧修订无法再次生成，须重新导出。需要新一轮包时运行 `node scripts/general-translation-workflow.mjs export <新的输出目录>`，默认生成紧凑版，按当前语料重新分批，不会覆盖现有导出。可显式指定 `--max-rows 400 --max-chars 16000`；单条原文超过完整输入上限会报错而非截断。批次数量随语料变化，不写死为 22。

## 全馆审计边界

现有主线 B001 的 993 项保留 reviewed；B002 的 999 项保留 draft。统计读取当前 Reader、compiled、publication 和 overlay 身份，不沿用历史比例。缺译与原文变化分开；没有进入 Reader 的 RAW、图片中文字、首页对话、歌词、未提取的界面文案和部分活动/歌曲专名列为未统计/待处理。语言开关目前影响已接入的资料名称、说明和播放器词条，剧情正文仍由原文/译文/双语阅读设置决定。

代码改动后执行相关回归、`npm run build:check` 并在 Browser 检查实际中/日展示、搜索和移动布局，再显式提交本批文件；不要把模型回传自动提升为终稿或直接生产发布。

## 资源与翻译审计随更新重算

`npm run build:check` 与实际打包 `npm run build` 均先执行翻译/资源审计生成器。单独刷新可用 `npm run audit:translations` 和 `npm run audit:resources`。本地目录和文件变化会更新资源计数、大小与来源指纹；输入不变时保留上次核对日期。源清单或 Reader 身份不一致会报错，不默默沿用过期译文；修订来源变化须重新导出。

R2 属于远端状态，执行 `npm run audit:resources:r2` 独立查询并保存核对时间，普通构建不会冒充实时远端检查。旧 July 快照默认折叠，仅作为历史；音频/图像/设备可用性仍须实际验收。当前谱面 248 个源文件包含 4 个未分配轨，正常可选难度文件为 244 个。

## 本轮验证边界

紧凑版新增回归遍历全部 5,596 字段的导出/本地身份还原、实际输入预算，以及漏项/重复/未知编号、错批次/版本、BOM/CRLF、多行、疑义、保留原文、参数/数字和映射漂移拒绝。旧 JSON 工作流回归继续通过。只验证本地工具，不上传 AI Studio、不伪造真实回传或人工批准、不修改现有译文状态。工具与文档变化未影响前端 bundle，无需再次构建或部署。
