# Producer 姓名宏：共享文本入口接线

2026-09-29，输入基线为 `codex/gs-architecture-rebuild` 的 `93fbe4e03a477409804074e8c50cc9dad2e50291`。交接包 `GS_Producer_Addressing_PR45_Delivery_20260928.zip` 的 SHA-256 为 `2595598092c8c5d85825a33848aadfb2ededa8730db90e31b6e582493a90316a`。包内独立实现、测试和执行说明作为候选材料；本次接线及验收针对当前 checkout。

## 运行时合同

`StoryTextResolver` 是唯一的正文显示解析入口。它在原文或已选翻译进入显示模型时调用 `ProducerAddressing`，不修改源句、`text_ref`、来源 hash、overlay 或缓存。`StoryLocalizationContext` 的剧情正文、选项、时间字幕和回看，以及 Reader 的行显示，均使用这个入口；旧式 `TextHelper` 也传入同一姓名设置。姓名通过现有播放器偏好键持久化，Reader 工具栏和播放器菜单可以修改；留空时保留原宏。显示始终经 Vue 文本插值，不把姓名当 HTML。

批准的两类宏按最大连续黑点串匹配：恰好十个 `●` 展开成姓名；恰好四个 `●` **紧接** `プロデューサー` 作为一个槽展开成姓名加 `P`。紧随其后的 `さん`、`ちゃん`、`師匠` 等是原句文本，不额外添加。其他长度、单独四黑点及字面 `監督`、`師匠`、`下僕` 保持原样。姓名含 `P` 时仍按第二类宏再加 `P`。这些是用户批准的屏幕语义，不声称已复原原游戏内部算法。

首笔运行时提交只提供独立的翻译槽函数，尚未接入正式导出/导入链；下节记录后续封口。没有 `text_ref` 的 Reader 行不因显示修复获得翻译发布资格。包内工作簿和 HTML 参考未导入 canonical Bible，导入数为 0；人物关系与固定称呼的译法仍按既有人工审核流程处理。

## PR45 最终封口（2026-09-29）

后续提交把 `verify:producer-addressing-runtime` 纳入 Web Viewer Source Gate。正式翻译草稿现在可用 `npm run translation:export-draft -- --evidence <compiled.json> --out <draft.json>` 导出，再用 `npm run translation:import-draft -- --evidence <同一证据> --draft <完成的草稿> --out <新 overlay.json>` 导入。导出只接受有稳定 `unit_id`、`source_hash` 和 RAW hash 的 compiled 证据；每个姓名宏单独编号，四黑点与职业词为一个槽。导入重新从证据计算槽位并检查全部 ID、类型、重复、增删和原文 hash，恢复原宏后才生成现有 strict overlay 格式。输出文件不得已存在，导入不会自动发布。

`TranslationDiagnostics` 对照源句检查 overlay 的两类宏数量；RAW story promotion 也拒绝槽位与 authoritative 候选不符的 overlay。运行时 `StoryTextResolver` 对漏槽译文回退原文。纯 overlay JSON 的结构校验仍只负责无源句时能判断的字段，不能单独证明槽位正确；正式发布须带证据运行诊断。用真实 `1_4_001_01.json` 导出 209 个单元，并从一条含宏单元回导 1 条演练 overlay；诊断结果为有效 1、缺译 208、其他错误 0。这条演练保留原日文，不是已完成的中文译文，也未发布。

旁路扫描确认 Reader manifest 2,801 项中 347 个展示标题含黑点，story catalog 1,394 项中 347 个标题含黑点，卡片来源有 92 条 Home cue 含黑点。它们现在在 Reader 标题/分段选择、故事目录及详情、Home 台词、卡片预览等可见呈现点使用同一 display-only 宏规则；原 manifest、card index 和来源 hash 不变。Reader 的 front-matter 合并判断继续比较未展开的原始标题，避免显示名改变行合并结果。Home 与 Reader 的本机 Edge 浏览器复查分别显示 `甲P、` 和 `甲P？`；这不是生产站点或真实设备验收。

## 验收边界

包内 54 项独立测试通过。仓库的 `verify:producer-addressing-runtime`、`verify:producer-addressing-bible`、`verify:story-localization`、`verify:story-translations`、`verify:reading`、`verify:player-immersive` 和 `build:check` 通过。`build:check` 完整编译前端代码，但不复制 `public` 语料，不是可发布媒体包。

Browser 插件在本会话不可用；使用 Playwright 控制本机 Edge，对 `.analysis/build-check` 代码配合当前 `public` 的静态映射服务（`127.0.0.1:5178`）验收。核对了アスラン的 `我が主叶絵理奈`、柏木翼的 `叶絵理奈さん`、四黑点 `森蜥Pちゃん`、固定 `監督`、姓名变更及刷新保持、Reader 与播放器菜单共用偏好，以及 HTML 样式姓名只作字面文本。390×844 Reader 也验证姓名替换及无横向溢出。截图保存在 `E:/GS_ReadModels_QA/producer-addressing-*.png`；这不是生产 Pages、真实设备或媒体播放验收。5176 是已有静态预览进程，未由本次改动替换。

受保护文件检查使用改动前 `.analysis/producer-addressing-pr45-before.json`，3954 个文件一致、变更 0，覆盖 RAW、compiled、Reader、翻译数据和人工审核队列。历史审计见 [PRODUCER_ADDRESSING_EXACT_AUDIT_20260928.md](PRODUCER_ADDRESSING_EXACT_AUDIT_20260928.md)；其当时“尚未批准全局渲染规则”的结论描述的是之前的证据状态，不应覆盖本轮用户批准的两类屏幕语义。
