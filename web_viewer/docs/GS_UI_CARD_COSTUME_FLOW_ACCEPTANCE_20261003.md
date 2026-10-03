# GS 卡片服装风味与正文自然流验收（2026-10-03）

本批沿用[UI 宪章](GS_UI_CONSTITUTION.md)，限定卡片详情消费者内的服装风味合并与手机正文排版。真实SFC、code-only构建与独立tab15的最终Browser验收已通过；代码`667ac0c3`已独立commit / push。首候选失败与最终pin分目录保存，本文随独立文档批提交。

## Before / After / Why

| 范围 | Before — 实际Browser / 明确来源 | After — 最终实际Browser | Why |
| --- | --- | --- | --- |
| `040ren_ssr03`，390px服装区 | section393.89px；普通 / 突破两行161.62 / 160.70px，重复呈现同一风味正文。 | CN section288.72px，JA314.19px；两语言均1group / 2variants。模型、名称与Live / Story labels分别保留。 | 减少重复阅读，同时保留各款名称与原有条件。 |
| 手机正文，≤700px | 真实星座元素见下文；未补造其余旧页面测量。 | SSR03仅标题独立newline、正文自然流；Kanata完整引号段与段落间blank line保留；内部CJK排版断行合流。 | 保留星座元素 / 职业标题、完整成对引号段与空段；性格句不另加特判。 |
| 宽屏正文 | authored原文为资料来源。 | SSR03 CN / JA1280均section267.03px，authored inline / reflowed none，原四行与JP CRLF保留。 | 不把资料排版统一改写成新的正文。 |
| 卡面 / 主页 / 操作语音正文 | 本卡SSR03实际来源为JP，无CN overlay。 | source voice与globalArchiveText不改。 | 风味翻译与语音正文属于不同来源合同，不能称卡面语音双语验收。 |

## 共享风味的证据门槛

两种投影都须有同卡明确的 `live_initial / live_limitbreak` 或 `story_awakened / story_limitbreak` 配对、同模型stem `00 / 01`、原始名称base / `+`。这些槽位在raw资料中映射为field `45 / 47`或`49 / 50`。原JP风味非空且两者逐字相同，当前语言description也须两者逐字相同，才共享正文。

公开投影的[cards.detail生成链](../readmodels/lib/projections.mjs)实际调用`stripEvidence(card)`；[stripEvidence](../readmodels/lib/common.mjs)递归剥离`_source`而保留slot / model / name / description。因此公开模式按上述显式成对字段判定，不能要求已被正常剥离的`_source`。

完整raw模式仍校验`_source`的table1、field `45 / 47`或`49 / 50`及相同offset；局部缺损或坏source须拒绝共享。正常公开投影与损坏raw evidence不能混为一类。

保留模型、名称与Live / Story labels。dictionary的`relation_id`、`SortOrder`不作为变体ID；没有原始证据时不补造四次条件或图片缩略路径。

## 真实样本与Before证据

| 卡片 | 原JP星座元素 | CN星座元素 |
| --- | --- | --- |
| `040ren_ssr03` | おうし座：地のエレメント | 金牛座：土元素 |

[Before390收据](../.analysis/ui-card-costume-flow-20261003/before-040ren-ssr03-390.json)与[截图](../.analysis/ui-card-costume-flow-20261003/before-040ren-ssr03-390.jpg)来自实际Browser，记录服装区及两份重复正文。收据中的普通 / 突破模型分别显示“皇室崇高”和“皇室崇高+”，labels为“Live 普通 · 剧情特训”与“Live 突破 · 剧情突破”。

[首候选390收据](../.analysis/ui-card-costume-flow-20261003/candidate-040ren-ssr03-390.json)与[截图](../.analysis/ui-card-costume-flow-20261003/candidate-040ren-ssr03-390.jpg)保留实际失败：严格要求canonical `_source`不适配公开投影，仍有两组重复风味，section458.33px。该目录的build17.79s / PID68056只绑定首候选，不作为最终通过；最终证据另存`.analysis/ui-card-costume-flow-final-20261003`。

最终实际执行`node --experimental-vm-modules scripts/verify-card-costume-presentation.mjs` exit0（[脚本](../scripts/verify-card-costume-presentation.mjs)）：直接import实际`stripEvidence`，对5对真实pair的CN / JP canonical与public投影运行真实SFC，并按同一published identity切换中 / 日 / 中。缺值 / 异文、缺slot pair与partial坏`_source`为synthetic反例，不冒充生产样本。

代码代理只读核对实际外部SSR03 relations与`stripEvidence(canonical)` deepEqual通过；该核对使用实际公开投影，不是未知生产fixture。原语义 / 字典回归在首候选时exit0，修复后未重复运行未改区域；源码合同与以下Browser几何分开记录。

## 最终实际Browser覆盖

| 真实样本 / 宽度 | 实际结果与收据 | 已保存截图 |
| --- | --- | --- |
| SSR03，390 | [CN](../.analysis/ui-card-costume-flow-final-20261003/040ren-ssr03-cn-390.json)288.72px / [JA](../.analysis/ui-card-costume-flow-final-20261003/040ren-ssr03-ja-390.json)314.19px；1group / 2variants。 | [CN](../.analysis/ui-card-costume-flow-final-20261003/040ren-ssr03-cn-390.jpg) / [JA](../.analysis/ui-card-costume-flow-final-20261003/040ren-ssr03-ja-390.jpg) |
| SSR03，320 | [CN](../.analysis/ui-card-costume-flow-final-20261003/040ren-ssr03-cn-320.json)310.42px / [JA](../.analysis/ui-card-costume-flow-final-20261003/040ren-ssr03-ja-320.json)383.05px；1group / 2variants，正文自然流。 | [CN](../.analysis/ui-card-costume-flow-final-20261003/040ren-ssr03-cn-320.jpg) |
| SSR03，1280 | [CN](../.analysis/ui-card-costume-flow-final-20261003/040ren-ssr03-cn-1280.json) / [JA](../.analysis/ui-card-costume-flow-final-20261003/040ren-ssr03-ja-1280.json)均267.03px；authored原四行、JP CRLF保留。 | [CN](../.analysis/ui-card-costume-flow-final-20261003/040ren-ssr03-cn-1280.jpg) |
| `040ren_sr06` | [CN390](../.analysis/ui-card-costume-flow-final-20261003/040ren-sr06-cn-390.json) / [JA390](../.analysis/ui-card-costume-flow-final-20261003/040ren-sr06-ja-390.json)均288.72px，无heading、body自然流；[CN1280](../.analysis/ui-card-costume-flow-final-20261003/040ren-sr06-cn-1280.json)267.03px、原四行。 | 无新增截图 |
| `034kan_ssr02`，实际`034kan_104` | [CN390](../.analysis/ui-card-costume-flow-final-20261003/034kan-ssr02-cn-390.json)288.72px / [JA390](../.analysis/ui-card-costume-flow-final-20261003/034kan-ssr02-ja-390.json)332.11px；原跨两行quote为独立完整台词段，两语言段落间blank line保留。 | [JA390](../.analysis/ui-card-costume-flow-final-20261003/034kan-ssr02-ja-390.jpg) |
| `001tom` SSR01 / R03 | SSR01 [CN390](../.analysis/ui-card-costume-flow-final-20261003/001tom-ssr01-cn-390.json)267.03px / [JA390](../.analysis/ui-card-costume-flow-final-20261003/001tom-ssr01-ja-390.json)314.19px；R03 [JA390](../.analysis/ui-card-costume-flow-final-20261003/001tom-r03-ja-390.json)264.50px，1group / 1variant。 | 无新增截图 |

上述样本的body overflow均为false；最终[Browser warning / error](../.analysis/ui-card-costume-flow-final-20261003/browser-warnings-errors.json)为空。viewport已reset，tab15留在SSR03 CN衣装段作为交付页面，用户tab14未导航。SSR03卡面 / 主页 / 操作正文实际为JP，不能写成CN语音翻译或双语语音验收。

## 最终验收记录

[构建输入](../.analysis/ui-card-costume-flow-final-20261003/build-input.json)为HEAD `872ff5a62752c624837dddb4fe2baad8773996dc`；[构建日志](../.analysis/ui-card-costume-flow-final-20261003/build-check.log)记录`npm run build:check` exit0 / 13.12s，copyPublic false，复用`.analysis/build-check`。14个冻结来源sourceStable、App unchanged；[服务进程](../.analysis/ui-card-costume-flow-final-20261003/server-process.json)PID13768，[RAM pin](../.analysis/ui-card-costume-flow-final-20261003/pinned-code.json)190代码文件。

main `index-DCDD72Im.js` 534681bytes，SHA `95e5fb79caa775267e1b2e8f4082c214ef658b72ddba6d1c79f04bb5ec1bc133`；Detail `ArchiveCardDetail-CpmWcNVh.js` 333165bytes，SHA `2a0a90c5dde7bd167bc2cd4636808f28f97962347fb85915b2b54088ecab7fcb`。[最终完整性收据](../.analysis/ui-card-costume-flow-final-20261003/verification-receipt.json)记录224个成功`_app`请求全部SHA match，failures为空；mediaRequests为0表示本批未触发播放。

代码`667ac0c3`已独立commit / push；本文随独立文档批提交，不预填文档自身hash。没有codec、真机、完整release或Chibi验收，也不从正文 / SFC推论实际媒体播放。
