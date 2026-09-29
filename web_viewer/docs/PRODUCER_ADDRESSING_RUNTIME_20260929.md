# Producer 姓名宏：共享文本入口接线

2026-09-29，输入基线为 `codex/gs-architecture-rebuild` 的 `93fbe4e03a477409804074e8c50cc9dad2e50291`。交接包 `GS_Producer_Addressing_PR45_Delivery_20260928.zip` 的 SHA-256 为 `2595598092c8c5d85825a33848aadfb2ededa8730db90e31b6e582493a90316a`。包内独立实现、测试和执行说明作为候选材料；本次接线及验收针对当前 checkout。

## 运行时合同

`StoryTextResolver` 是唯一的正文显示解析入口。它在原文或已选翻译进入显示模型时调用 `ProducerAddressing`，不修改源句、`text_ref`、来源 hash、overlay 或缓存。`StoryLocalizationContext` 的剧情正文、选项、时间字幕和回看，以及 Reader 的行显示，均使用这个入口；旧式 `TextHelper` 也传入同一姓名设置。姓名通过现有播放器偏好键持久化，Reader 工具栏和播放器菜单可以修改；留空时保留原宏。显示始终经 Vue 文本插值，不把姓名当 HTML。

批准的两类宏按最大连续黑点串匹配：恰好十个 `●` 展开成姓名；恰好四个 `●` **紧接** `プロデューサー` 作为一个槽展开成姓名加 `P`。紧随其后的 `さん`、`ちゃん`、`師匠` 等是原句文本，不额外添加。其他长度、单独四黑点及字面 `監督`、`師匠`、`下僕` 保持原样。姓名含 `P` 时仍按第二类宏再加 `P`。这些是用户批准的屏幕语义，不声称已复原原游戏内部算法。

翻译准备函数可以给每处宏分配独立槽 ID，再从翻译草稿恢复原宏，并拒绝槽位丢失、重复、换型和未知 ID。当前仓库尚未把该函数接到正式翻译导出/导入或发布链；因此本次不把“槽位工具的单元测试通过”写作翻译批量导入验收。没有 `text_ref` 的 Reader 行也没有因显示修复获得翻译发布资格。包内工作簿和 HTML 参考未导入 canonical Bible，导入数为 0；人物关系与固定称呼的译法仍按既有人工审核流程处理。

## 验收边界

包内 54 项独立测试通过。仓库的 `verify:producer-addressing-runtime`、`verify:producer-addressing-bible`、`verify:story-localization`、`verify:story-translations`、`verify:reading`、`verify:player-immersive` 和 `build:check` 通过。`build:check` 完整编译前端代码，但不复制 `public` 语料，不是可发布媒体包。

Browser 插件在本会话不可用；使用 Playwright 控制本机 Edge，对 `.analysis/build-check` 代码配合当前 `public` 的静态映射服务（`127.0.0.1:5178`）验收。核对了アスラン的 `我が主叶絵理奈`、柏木翼的 `叶絵理奈さん`、四黑点 `森蜥Pちゃん`、固定 `監督`、姓名变更及刷新保持、Reader 与播放器菜单共用偏好，以及 HTML 样式姓名只作字面文本。390×844 Reader 也验证姓名替换及无横向溢出。截图保存在 `E:/GS_ReadModels_QA/producer-addressing-*.png`；这不是生产 Pages、真实设备或媒体播放验收。5176 是已有静态预览进程，未由本次改动替换。

受保护文件检查使用改动前 `.analysis/producer-addressing-pr45-before.json`，3954 个文件一致、变更 0，覆盖 RAW、compiled、Reader、翻译数据和人工审核队列。历史审计见 [PRODUCER_ADDRESSING_EXACT_AUDIT_20260928.md](PRODUCER_ADDRESSING_EXACT_AUDIT_20260928.md)；其当时“尚未批准全局渲染规则”的结论描述的是之前的证据状态，不应覆盖本轮用户批准的两类屏幕语义。
