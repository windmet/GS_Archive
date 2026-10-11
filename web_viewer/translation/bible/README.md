# 称呼证据 Bible

本目录将已批准的显示与翻译槽规则、第三方参考资料、待人工核实的剧情证据分开。翻译提示词只能把 [`verified/producer-addressing.md`](verified/producer-addressing.md) 当作规则；`review/` 中的机器抽样和将来的 `reference/` 资料不能自动升级为角色固定译法。

2026-09-29 的运行时合同批准了两类姓名宏：恰好十个连续 `●` 表示玩家姓名，恰好四个连续 `●` 紧接 `プロデューサー` 表示玩家姓名加 `P`。这项批准针对共享文本显示和翻译槽，并不证明已复原原游戏内部显示算法。固定字面称呼仍按原句处理。来源与验收见[共享文本入口记录](../../docs/PRODUCER_ADDRESSING_RUNTIME_20260929.md)。

`review/producer-addressing-review.csv` 现有 **440 条 `unreviewed` 抽样**，完整机器证据为 1,982 条、163 个汇总组。人工列仍未填写；这不是 440 条已确认的译法。机器文件通过下列命令在本地 `.analysis/translation-bible/` 重生成，不提交为人工结论：

```powershell
npm run generate:producer-addressing-bible
npm run verify:producer-addressing-bible
```

机器 evidence 保留 Reader 来源、说话人候选、前后文、链接及可精确匹配的语音 cue；`review` 工作表的状态和视频观察需要人工填写。待核验的角色口癖、敬称和第三方 SideM 呼称表应放在独立参考区并标注来源，不覆盖剧情实证。缺少参考文件时不以空目录冒充已入库资料。

翻译导出使用 `protectProducerAddressingForTranslation()` 将两类宏变成 `{{GS_ADDRESS:...}}` 槽；导入通过现有 `StoryTranslationDraft` 恢复并校验。字面 `監督`、`師匠`、`下僕` 不自动改成姓名。十黑点后紧接的 `さん` 等后缀是原句文本，不属于槽本身。
