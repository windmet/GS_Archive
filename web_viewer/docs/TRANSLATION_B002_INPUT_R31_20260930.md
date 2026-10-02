# B002 输入补强 R3.1

基线：`codex/story-interaction-v2-before-b002`，输入 HEAD
`3bf501cc911a17690364b22be7775ffd31cd3e16`。
审计来源：用户附件 `a6dcb7b0-f1be-4f56-af27-18f5f7d219dc/已粘贴的文本.txt`。
本轮范围是输入优化；审计对外部 999 条译文的统计和质量判断不作为本地实测结果。

保留 V3 主体、两列输出合同和现有保护槽。新增版本化的试译政策，旧文件和旧批次留作对照：

- `trial-policy.v2.1.json`：猫的专名／昵称、315 Production、庄一郎、
  もふもふえん KeepLiteral、北斗粉丝称呼、阿斯兰称呼、恭二姓氏口误等 11 个词条。
- `voice-profiles.trial.v1.1.json`：新增阿斯兰、朱雀、玄武、花音四个简短档案，
  附当前 B002 原文 unit ID / source hash，保留原有九个档案。
- `translation-r3.1.md`：敬称按关系处理，已有道流／道夫规则继续保留；
  花音复数自称自然表达，不新增喝酒、亲属或世界观事实；ID 必须逐字复制六位数字。

非偶像词条仅是翻译提示，使用 `trial:` 名称空间；不修改原始 Speaker／Voice。
阿斯兰称呼、北斗粉丝称呼和恭二口误的逐句提示要求已解析且匹配的原始演员身份。
未知演员不从前句、立绘或词汇推断身份。旧演员与选择入口投影规则保留。
所有新增译法均为本轮编辑试译选择，不代表官方译名、人审通过或公开发布。

验证：

- `npm run verify:ai-studio-r3`：人物／术语提示、身份隔离、限定称呼、专名保留、
  六位 ID 边界及缩短 ID 拒绝、既有质量补丁绑定合同。
- `npm run verify:ai-studio-context`：未知身份、通信、选择入口、修复上下文。
- `npm run verify:translation-studio`：2801 Reader 文档、30121 源文单元绑定。
- `npm run verify:reviewed-b001`：既有 B001 reviewed 范围不变，仍非 final。
- 新输入在本轮提交完成后生成，B002 59 个完整文档、999 条原文单元及
  37 个 Producer 保护槽逐条与基线核对；Reader／compiled／RAW 身份和
  政策、上下文、input 哈希重新检查。实测摘要保存在新批次 `preflight-report.json`。

本轮仅变更独立 Studio 工具及政策，没有前端运行时／样式变更；依据
[构建验收政策](BUILD_ACCEPTANCE_POLICY.md)执行工具回归，无须 Vite 构建或 Browser 重验。
没有导入或改写现有译文，严格解析器没有增加容错补零；新输出收到后另行核验。

使用新提交对应的 `.analysis/translation-studio/run-<HEAD前12位>/B002-main/input.md`。
旧批次 source_commit／政策哈希不能手动改成新值，也不适合作为新输入继续翻译。
