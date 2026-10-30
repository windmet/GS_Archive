# 季节企划标题绑定与空格修正（2026-10-31）

输入 HEAD：`4516dce6`；分支 `i18n/20261031-coverage-audit`。本批只提交翻译、索引和文案接线，未部署。

## 标题与消费索引

直接翻译 304 个独立原文标题，覆盖 306 段季节企划（2022/2023 情人节及白色情人节）。通过 General 正式 export/check/import 管线入 profiles TM，保持 draft、not_final，未冒充人工 reviewed。

- [原文译文表](../translation/studio/general/returns/G-profiles-20261031titles-001/titles.md)
- [来源与输出凭据](../translation/studio/general/returns/G-profiles-20261031titles-001/receipt.json)

General 审计新增 seasonal-title；Reader 标题索引按原始标题 SHA-256 与 document revision 绑定。旧标题末尾 CR 保留在身份中。目录和 Reader 选集只传 document_id、sha256，因此允许这些精简投影按精确原文及版本解析；调用者有 domain/title 时仍检查。标题或版本变更即回退原文。原有 1,930 个非季节企划绑定未改变；根索引 116,895 bytes，保持 128 KiB 预算，季节标题放入既有 16 个分片。目录不再把译文强制标为 lang=ja。

## 空格排查

全量扫描已发布剧情译文，确认 265 处异常 ASCII 空格，均来自旧 B036 的 26 个 catalogue；逐条匹配原始模型回传。删除中文字/中文标点之间的空格，不改语义，不改 reviewed/draft 状态。英文词间空格、宏、段落、全角分隔和 3 处旧主线有意标题分隔保留。

[逐条修正记录](../translation/studio/amendments/20261031-b036-spacing.json)保存 unit_id、source_hash、before/after、修改前后文件 SHA。历史模型输出和审校凭据不变；verifier 只在重放旧凭据时逆转已登记的格式修正，要求恢复原字节与原 SHA，不放宽历史校验。

## 验证

- General 正式 check、严格 TM 校验及 workflow 回归通过；304 标题已发布为 draft，missing/orphan/invalid 为 0。未回传的 14 个 General 批次仍绑定原来的 13,053 条来源。
- Reader 标题生成 --check、精简目录/选集投影、原文及版本失配回退、分片完整性/预算/重试回归通过。
- verify:b002-draft（含 265 条格式修正和历史凭据重放）、verify:reviewed-b001、verify:reading-typography、季节导航和 Reader controls 通过。
- npm run build:check 通过（最终 19.31s）；仅固定 .analysis/build-check，不复制 public 语料。既有背景资源和 chunk 大小警告仍保留。resource-audit 的构建环境差异已还原。
- 实际 Browser 使用本 worktree 的 127.0.0.1:5251 dev 服务，候选 rm-release-20261030b。1440×900 目录总表 → 天濑冬马抽屉 → 2023 情人节「美味的理由」 → 顶栏选集，显示中文；390×844 顶栏选集同样中文，点击「御手洗翔太 · 努力的源泉」后加载完成显示中文，并可返回 2023 情人节中文目录。采集时 console error 为空。
- 桌面/手机截图保存在 E:/Web_build/GS_Archive_Domain_Work/translation-titles-qa-20261031，含 catalog-titles-desktop.png、catalog-titles-mobile.png、chapter-picker-desktop.png、chapter-picker-mobile.png。此为 dev Browser 验收，不是生产部署或物理手机验收。

Reader 正文仍为 32,760 条；本批新增元数据标题，不改变正文单位。后续继续 draft 质量审校和待回传批次，不把本批视作全站人工校对完成。
