# 网页翻译前准备：Studio Markdown Adapter v1

本批从文本身份收口 `f002371e` 新建 `codex/translation-ai-studio-v1`，只改翻译工具、Bible 文档和未评判试验样本。运行时、RAW、compiled、Reader 和正式译文均未改动。`codex/translation-strict-v2-prep` 尚未进入 `master`；因此在合并基线确定之前，本分支生成的 `source_commit` 与批次只能用于工具验收，正式上传包应在合并后重新生成。

## 来源绑定

`prepare-ai-studio-batches.mjs` 逐份核对 Reader manifest/document SHA、当前 compiled SHA、30,121 条 `text_ref` 的单位 ID、RAW 坐标及规范化原文 hash。1,288 份文档由 Reader `source.raw_hash` 提供整篇 RAW hash；其余 1,513 份从当前 publication release 的来源 SHA 取得，同时要求 release 所列 compiled artifact 与当前 Reader 来源字节相同。最后 4 份 target=0 的 Reader logical ID 与 release logical ID 表述不同，适配器按精确 `story:<scenario_id>` release 匹配，不改变 choice target。每篇的翻译目标是 Reader `text_catalog_id`；group 来源 unit ID 中的 aggregate/part 坐标保持原样。

每篇仍先调用现有 `createStoryTranslationDraft()`，得到严格 JSON Draft。`input.md` 只呈现批内 `T000001` 形式的短 ID、说话人、kind 和受保护原文；真实 `unit_id`、`source_hash`、RAW hash 与完整 Draft 留在同目录的本地 `batch-map.json`。模型输出仅需 `| ID | Chinese |` 两列表格。检查器按 ID 联接，核对漏行、重复、未知 ID、空译文和 Producer 槽，并重新读取当前 Reader/compiled 和来源证据。任何结构错误整包拒绝导入，缺行会生成 `repair.md`；日文残留、原文未变和过长选项只列人工 review。

`import-ai-studio-batch.mjs` 仅在结构全过时逐篇调用现有 `importStoryTranslationDraft()`；完成的 Draft 与 `status: draft` 的 strict overlay 写到该批 `.analysis` 文件夹，**不会自动写入 `public/translations`、标为 reviewed/final 或发布**。已有输出文件拒绝覆盖。每个批次的 `source_commit` 必须等于当前 HEAD；来源变化需重新装包。

## 装包与使用

实跑当前语料得到 **34 包 / 2,801 篇 / 30,121 行**，分为 main 4、unit_story 7、idol_story 6、event 6、birthday 1、extra 1、work 5、card_scenarios 4。按完整 Reader 文档装箱；目标上限为每包 1,000 行、30,000 源文字符，硬上限 1,300 行、40,000 字符。实测最大为 1,000 行、29,771 字符，最小包 130 行。输入没有真实 unit ID 或原始 Producer 黑点。

从已合并且验过的基线运行：

```powershell
npm run translation:studio:prepare
# 把某包 input.md 交给翻译网页，将完整两列表格答复保存为同目录 output.md
npm run translation:studio:check -- .analysis/translation-studio/RUN/B001-main
npm run translation:studio:import -- .analysis/translation-studio/RUN/B001-main
npm run translation:studio:report -- .analysis/translation-studio/RUN
```

生成器默认将 RUN 命名为 `run-<HEAD前12位>`，且拒绝覆盖现存运行。网页端真实译文、人工复核、正式 overlay 上架、Reader 双语体验与远端部署都尚未执行；不能把结构回导演练计为已翻译句数。

## Bible 与试验样本

[`translation/bible/README.md`](../translation/bible/README.md) 已从旧的“姓名语义未批准”状态更新，明确引用[已批准 Producer 宏规则](../translation/bible/verified/producer-addressing.md)。440 条人工 review 仍为 `unreviewed`；第三方呼称表尚未作为正式参考文件入库，角色口癖没有从机器频次推断。

[`translation/benchmarks/v1/cases.json`](../translation/benchmarks/v1/cases.json) 是 8 个域各 25 条、共 200 条的确定性**试验候选**，覆盖全部 7 种 Reader kind 和两类 Producer 槽。它没有金标准中文译文，也没有人工质量分数。先对这批做网页试译与人工评判，再冻结提示词、译名指导和语言 QA 阈值。

## 本批验证

`verify:translation-studio` 重验全库 2,801 篇 / 30,121 行来源，并在 group 与 target=0 独立剧情上验证 Draft 回导及 `draft` 状态。完整装包核对 34 包的文档/单位唯一性、域隔离、容量和模型输入泄漏。用明确标记的假译文对 B001 的 993 行演练了 check 与 import；再制造缺失/未知 ID，检查器拒收并生成补漏表。该测试运行已隔离为 `.analysis/translation-studio/TEST_ONLY_provisional_f002371e`，不是译文或正式生产包。
