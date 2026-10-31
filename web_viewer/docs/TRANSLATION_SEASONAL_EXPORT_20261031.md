# 季节企划缺译导出 · 2026-10-31

承接[覆盖审计](TRANSLATION_COVERAGE_AUDIT_20261031.md)，先补 Reader 剩余季节企划，不混入通信、语音或草稿重译。当前 i18n 线已用普通 merge 同步 master `0df3becc`（#154），合并提交 `3cea33b1`；新增门户改动不改变这批翻译源。原审计 `a2c07d16` 是历史快照。

## 选择范围

[选择计划](../translation/studio/plans/seasonal-missing-20261031.json)逐篇列出 255 个 Reader document ID；这 255 篇全部完整缺译，共 2,228 个唯一单元。已有 411 条 B036 草稿不在范围内。2022 白色情人节按角色序号 000–025 / 026–102 分批，同一角色的 a/b 两段不拆开。

| 批次 | 内容 | 文档 | 待译行 | 原文字数（Unicode code point） |
|---|---|---:|---:|---:|
| B037-seasonal-valentine-2022-rest | 2022 情人节剩余 | 50 | 380 | 10,348 |
| B038-seasonal-white-day-2022-1 | 2022 白色情人节前半 | 51 | 401 | 10,854 |
| B039-seasonal-white-day-2022-2 | 2022 白色情人节后半 | 50 | 385 | 10,786 |
| B040-seasonal-valentine-2023 | 2023 情人节 | 52 | 538 | 15,031 |
| B041-seasonal-white-day-2023 | 2023 白色情人节 | 52 | 524 | 14,755 |
| 合计 | | 255 | 2,228 | 61,774 |

编号用于本轮新的明确批次名；不能与本机 10-10 的三批 `B036/B037/B038-seasonal` 旧拆法混用，也不能假定旧六批文件仍存在。

## 导出与固定源提交

本轮沿用 `scripts/prepare-ai-studio-batches.mjs` 的 targeted 模式、projection v3，使用 R3.3、trial-policy v2.3、人物口吻 v1.1 和当前姓名策略。它们的试用 / 已确认范围不变，没有新增译名决策。

先提交本说明与选择计划，再在该固定 HEAD 逐批生成文件，使 `batch-map.json.source_commit` 绑定最终准备提交。实际 source_commit、MD 字节摘要、行数及预检结果记录在生成目录的 `local/preflight.json`；本说明不预写尚未生成的提交哈希。生成后在模型结果回收前保留该提交作为校验基线，不 rebase、不随意更新该工作树 HEAD。

本工作树的交付目录为 `.analysis/translation-studio/seasonal-missing-20261031/`：

- `for-ai-studio/B037-….md` 至 `B041-….md`：各批正式 input.md 的逐字节副本，给模型使用。每份已自带说明、规则、说话人、人物线索和完整原文；不用另外上传 glossary 或规范文件。
- `local/<批次>/<批次>/input.md`、`batch-map.json`：现有导出器的正式输出。`local/<批次>/plan.json` 保留原生成计划。
- `local/preflight.json`：导出预检与文件摘要；只在本地留存。
- `GS_Archive_seasonal_missing_20261031.zip`：只收录五份给模型的 MD，方便交付；不含本地身份映射。

核心生成调用（`<文档ID列表>` 来自选择计划对应批次）：

```powershell
node scripts/prepare-ai-studio-batches.mjs --documents <文档ID列表> --batch <批次ID> --out .analysis/translation-studio/seasonal-missing-20261031/local/<批次ID>
```

预检必须核对：全部 2,228 个 unit_id 不重复且恰好等于当前缺译集合、255 篇不重叠、每批 source_commit 等于固定 HEAD、Reader / compiled / RAW 来源合同通过、input_sha256 及 canonical render 一致、ID 表格可解析、保护槽往返一致，以及交付 MD 与正式 input.md 字节相同。原文回显仅用于本地解析与保护槽测试，不保存成模型输出，不算翻译完成或质量审校通过。

## 给 AI Studio 的操作

1. 从 B037 开始；每批单开一个对话，只上传该批 `.md`。不要上传 local 文件夹、batch-map、plan 或 preflight。
2. 让模型遵照 MD 输出完整的 `ID | Chinese` 两列表格。T ID 保留六位数字，不改号；`{{GS_ADDRESS:...}}` 原样保留；单元格换行用 `<br>`，竖线用 `\|`。
3. 一批完成后将完整结果保存为该批的 `output.md`。若模型截断，不要把不完整结果当作完成稿，交回后按原 RID 补齐。
4. 返回文件时注明批次名。检查和草稿导入由本地工具完成，模型不决定 reviewed / final。

回收位置：`.analysis/translation-studio/seasonal-missing-20261031/local/<批次ID>/<批次ID>/output.md`。固定源 HEAD 下执行：

```powershell
node scripts/check-ai-studio-batch.mjs .analysis/translation-studio/seasonal-missing-20261031/local/<批次ID>/<批次ID>
node scripts/import-ai-studio-batch.mjs .analysis/translation-studio/seasonal-missing-20261031/local/<批次ID>/<批次ID>
```

import 只生成本地 completed-drafts / draft-overlays，不自动发布到 public。覆盖审计、受影响回归和真正的译文质量审校另做；结构 PASS 不代表整批人工校对通过。若回收时工作树 HEAD 已变化，先检查源绑定并在固定提交处校验，不能只改 map 的 source_commit 绕过检查。

本轮只准备文本批次，不运行全量应用打包，不启动服务，不上传 AI Studio、不导入译文或部署。交付 MD 和映射是小型本地文本产物，不复制媒体语料。
