# 通用资料 Gemini 翻译与校对流程

本流程处理背景、卡面标题、衣装、道具、称号、技能与摄影素材的名称和说明。剧情台词、组合剧情、工作通讯和首页对话继续走现有剧情 batch；不要把通用原文拿去按对白口吻续写。本轮只建立流程，不自动向 AI Studio 上传或代替用户确认译文。

## 交给 AI Studio

本次导出为 `.analysis/general-translation-batches-20261002-ready`，5,596 个不同资料字段、9,952 次来源使用，分为 60 批。每批最多 100 项、原文正文约 6,000 字符；长单项保留完整，不拆断技能条件。一个键在同一资料域与字段内共用译文。不同资料域即使字面相同，也不强行共用。

1. 新建 AI Studio 会话，先给 `glossary-reference.json`，说明这是项目暂用人名，并非官方中文译名。
2. 每次给一个批次目录里的 `input.md`。里面有全部日文原文、稳定键、哈希及使用位置。可以一次一个批次，以免 Gemini 漏行。
3. 保存 Gemini 返回为该目录的 `return.json`。只接收模板规定的 JSON；若包含代码围栏或解释文字，先去掉围栏/解释。`previous-draft.json` 是旧初译对照，独立保存，默认无需提供给 Gemini。
4. 原文、source_hash、key、batch_id、source_digest 必须原样保留；只改 translation、decision、notes。不确定的术语填 uncertain 并说明，无法确认的资源键填 keep-source 并原样保留。

## 检查、导入和发布草稿

在本仓库 PowerShell 执行（示例批次可替换）：

```powershell
$batchDir = '.analysis/general-translation-batches-20261002-ready/G-items-001'
node scripts/general-translation-workflow.mjs check "$batchDir/batch-map.json" "$batchDir/return.json"
node scripts/general-translation-workflow.mjs import "$batchDir/batch-map.json" "$batchDir/return.json" 'Gemini / 实际模型名称'
node scripts/generate-archive-general-translations.mjs
node scripts/generate-translation-audit.mjs
node scripts/verify-general-translation-workflow.mjs
node scripts/verify-archive-general-texts.mjs
```

检查会拒绝：漏行、重复键、错批次、改原文、错哈希、来源变化、未知键、空译文、数字/参数/图标占位符变化和危险 HTML。结构通过不代表翻译自然或准确。导入只写 `translation/studio/general/revisions` 中的草稿记录；生成器才将该记录写入公共翻译主索引与六个页面分片。以后重新生成初译也会保留已导入的有效修订。默认不覆盖已有修订；要替换旧批次，先明确归档旧记录，再导入新的整批，防止多个批次重叠覆盖。

审计页在「资源 → 数据与资源状态」的「翻译与校对进度」。通用初译与已校对分别统计，点资料域展开日/中对照，按状态、批次、原文、译文、ID 或使用位置搜索。相同字段重复使用不重复计校对量。剧情按当前 Reader 文本单元与原文哈希统计；文档详情可进入阅读页。

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

仅该批次提升到 reviewed，仍为 not_final。uncertain 尚未解决的批次不能提升；keep-source 可以作为明确保留原文的校对决定。原文变化时旧修订无法再次生成，须重新导出。需要新一轮包时运行 `node scripts/general-translation-workflow.mjs export <新的输出目录>`，不会覆盖现有导出。

## 全馆审计边界

现有主线 B001 的 993 项保留 reviewed；B002 的 999 项保留 draft。统计读取当前 Reader、compiled、publication 和 overlay 身份，不沿用历史比例。缺译与原文变化分开；没有进入 Reader 的 RAW、图片中文字、首页对话、歌词、未提取的界面文案和部分活动/歌曲专名列为未统计/待处理。语言开关目前影响已接入的资料名称、说明和播放器词条，剧情正文仍由原文/译文/双语阅读设置决定。

代码改动后执行相关回归、`npm run build:check` 并在 Browser 检查实际中/日展示、搜索和移动布局，再显式提交本批文件；不要把模型回传自动提升为终稿或直接生产发布。

## 资源与翻译审计随更新重算

`npm run build:check` 与实际打包 `npm run build` 均先执行翻译/资源审计生成器。单独刷新可用 `npm run audit:translations` 和 `npm run audit:resources`。本地目录和文件变化会更新资源计数、大小与来源指纹；输入不变时保留上次核对日期。源清单或 Reader 身份不一致会报错，不默默沿用过期译文；修订来源变化须重新导出。

R2 属于远端状态，执行 `npm run audit:resources:r2` 独立查询并保存核对时间，普通构建不会冒充实时远端检查。旧 July 快照默认折叠，仅作为历史；音频/图像/设备可用性仍须实际验收。当前谱面 248 个源文件包含 4 个未分配轨，正常可选难度文件为 244 个。
