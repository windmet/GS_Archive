# 衣装两批新译文回填 · 2026-10-02

输入 HEAD：`71c2653335f6dfd75b41e06c092f5a6716538590`。工作分支：`codex/costume-translation-20261002`。

用户在本聊天提供两批译文，随后明确确认：“直接采纳我这边给到的新译文回填即可，我检查过了”。本次据此回填并标记 `reviewed`，继续保留 `not_final: true`。没有进行额外措辞润色，也没有把其他资料或剧情提升为已校对。

| 批次 | 来源摘要前缀 | 名称 | 说明 | 来源使用次数 |
| --- | --- | --- | --- | --- |
| G-costumes-001 | b1f0d20ee7bf | 0 | 122 | 464 |
| G-costumes-002 | 5932a6cf56a0 | 326 | 48 | 732 |

合计 496 个不同字段，1,196 次来源使用。原始回传、实际导入文本和逐批确认回执保存在 [returns/costumes-20261002](../translation/studio/general/returns/costumes-20261002/)，完整原文、来源引用及修订身份保存在 [revisions](../translation/studio/general/revisions/)。用户没有声明生成模型，translator 如实记为“用户提供的新译文（未声明生成模型）”。

## 三处数字格式调整

现有导入合同要求保留原文中的阿拉伯数字。原始回传保持原样存档，实际导入仅修改 G-costumes-001 的以下三处；其他 493 项与用户回传一致：

- 026、036：`高贵的三位王子` → `高贵的3位王子`，对应原文 `3人`。
- 106：`愿大家度过美好的一天。` → `愿大家度过美好的1天。`，对应原文 `1日`。

批准回执记录了这些等值数字格式调整。导入后 return_sha256：

- G-costumes-001：`172cbf185a8f49f48fa96d3e8b727529962faaabd4b0666c25df5cdafdec9a70`
- G-costumes-002：`8f75eb961cf68cfa9eaf782cdaf159bc5b7c8256a92a8f0f730adb9f54cfe754`

## 公共数据与审计

通用资料主索引和衣装页面分片已重新生成，修订优先于初版默认译文。衣装审计现为 `reviewed: 496`、`draft: 0`、`final: 0`、`uncertain: 0`。

审计生成器原先用旧版 100 项分批规则给所有字段标注批次，导致紧凑版 G-costumes-002 的名称显示为 G-costumes-003 等旧批次。现在有修订的字段使用真实导入批次；未导入字段继续采用原先分批规则。回归核对修订批次与审计批次一致。

## 验证与边界

- 两批 check/import/review 均通过：来源哈希、引用位置、完整批次摘要、496 个编号、数字和占位符、无重叠修订、无 unresolved 条目。
- `node scripts/verify-general-translation-workflow.mjs`、`node scripts/verify-general-translation-markdown.mjs`、`node scripts/verify-archive-general-texts.mjs` 通过；原有 B001/B002 状态隔离回归通过。
- 逐项确认 496 个公共译文与对应修订一致，原始回传与实际导入的差异仅为上述 3 处数字写法。
- `npm run build:check` 通过，输出仅为本 checkout 的 `.analysis/build-check`，`copyPublicDir:false`，没有复制公共媒体库；保留现有大 chunk 提示。发现并修复审计批次标注后，重跑对应回归和构建。
- Browser 复用本工程已运行的 `http://127.0.0.1:5213/` 生产代码预览，静态资源直接映射本地 public，readmodels 使用 `E:/Web_build/GS_Archive_Domain_Work/song-gameplay-readmodels-20261001`。
- 资源审计页确认 `496 已校对 / 496 原文`；检索“雄心交响曲”显示普通及 + 名称，实际批次为 G-costumes-002。
- 卡片目录进入 `007kei_sr05`，关联衣装显示“雄心交响曲 / 雄心交响曲+”及用户提供的完整说明；日本語切回原文，中文恢复新译文。桌面 1440×900、手机模拟 390×844 检查多行布局通过，临时 viewport 已恢复。
- 验证途中曾用数据库数字 `1307005` 作为路由 card 参数，产生 Unavailable card；随后从真实目录进入正确的卡片键 `007kei_sr05`。正确入口刷新后的控制台无新增 error/warn、无框架错误遮罩。
- 小型证据位于 `.analysis/costume-translation-20261002/`：构建日志、原文/初译导出、`card-costumes-desktop.png`、`card-costumes-mobile.png`。原文和初译导出保留回填前快照。

本次验收是本地生产代码与映射资源的 Browser 展示验证，不代表真机、全媒体发布包或线上部署验收。未部署。
