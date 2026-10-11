# GS 衣装对齐与名称去复读验收（2026-10-03）

本批承接[服装风味与自然流验收](GS_UI_CARD_COSTUME_FLOW_ACCEPTANCE_20261003.md)，只调整Card Detail的衣装排列与标签呈现。真实SFC、code-only构建与实际Browser样本验收已完成；代码`0f6abd06`已commit / push，仅含`ArchiveCardDetail.vue`及既有回归脚本。Semantics / ArchiveText / data / voices不改；原pair raw / public身份判定、手机heading / quoted paragraph与桌面authored断行保留。

## Before / After / Why

| 范围 | Before — 实际Browser / 明确来源 | After — 最终实际Browser | Why |
| --- | --- | --- | --- |
| SSR03 CN，390px对齐 | group217.14 / section288.72px；group外x28.92，title / flavor外x68.91，lore宽277.35px。icon占整组一列。 | header / icon / flavor / rows外均x28.915，lore宽317.342px；icon仅在header与h5同行。group221.415 / section292.996px，实际高度略增。 | 标题保留识别图标，正文使用可用内容宽度；本轮记录对齐与阅读变化。 |
| 风味正文表面 | 位置见实际Before收据，不补造旧颜色 / padding测量。 | lore实测背景`rgb(243,248,246)`、13px / 1.6、padding10px 12px；局部表面配置为左线2px `#71b6aa`与右侧圆角。 | 用轻量正文表面组织资料，减少重复嵌套。 |
| 配对 / 单衣装名称 | SSR03完整名在group内可见3次。 | 完整名可见1次；paired两row显示“通常版” / “突破版（+）”，实际全名保留在`title` / `aria-label`及`role="group"`。实际single样本一组一row写用途。 | 保留可访问的真实名称，减少同一区域重复阅读。 |
| 来源用途标签 | 来源只证明用途 / 状态，不能推出全部解锁条件。 | 每个source label独立小徽标，不再join为中点字符串。 | 各标签保留自己的含义，不把来源状态扩写成解锁承诺。 |

## 来源与验证边界

本批来源统计为82个single“剧情特训”、98个single“剧情普通”、160个pair“普通 / 突破”。这不是全部解锁、四次条件或异色的证据；不得据此新增这些说明。

[Before390收据](../.analysis/ui-card-costume-alignment-20261003/before-040ren-ssr03-cn-390.json)与[截图](../.analysis/ui-card-costume-alignment-20261003/before-040ren-ssr03-cn-390.jpg)来自实际Browser，记录上述组高、section高、横向对齐与名称复读。

根代理已实际执行`node --experimental-vm-modules scripts/verify-card-costume-presentation.mjs` exit0（[真实SFC脚本](../scripts/verify-card-costume-presentation.mjs)）。受影响的呈现合同与以下实际Browser几何分别记录；host回归不代替真机或语音播放。

## 最终实际Browser覆盖

| 样本 | 实际结果 / JSON | 已保存截图 |
| --- | --- | --- |
| SSR03 CN390 | [收据](../.analysis/ui-card-costume-alignment-20261003/040ren-ssr03-cn-390.json)：上述对齐、lore宽度、完整名3→1与group / section高度。 | [CN390](../.analysis/ui-card-costume-alignment-20261003/040ren-ssr03-cn-390.jpg) |
| SSR03 CN / JA320 | [CN](../.analysis/ui-card-costume-alignment-20261003/040ren-ssr03-cn-320.json)section313.800px / [JA](../.analysis/ui-card-costume-alignment-20261003/040ren-ssr03-ja-320.json)334.605px，无overflow。 | [CN320](../.analysis/ui-card-costume-alignment-20261003/040ren-ssr03-cn-320.jpg) |
| SSR03 CN / JA1280 | [CN](../.analysis/ui-card-costume-alignment-20261003/040ren-ssr03-cn-1280.json) / [JA](../.analysis/ui-card-costume-alignment-20261003/040ren-ssr03-ja-1280.json)：authored可见 / reflowed隐藏，各保留4原逻辑行；lore宽854.167px、外x283.556。 | [CN1280](../.analysis/ui-card-costume-alignment-20261003/040ren-ssr03-cn-1280.jpg) / [JA1280](../.analysis/ui-card-costume-alignment-20261003/040ren-ssr03-ja-1280.jpg) |
| `001tom_sr04` CN390 | [收据](../.analysis/ui-card-costume-alignment-20261003/001tom-sr04-cn-390.json)：一组一row为用途 + Live普通 + 剧情普通，无虚构pair。 | [CN390](../.analysis/ui-card-costume-alignment-20261003/001tom-sr04-cn-390.jpg) |
| `034kan_ssr02` CN / JA390 | [CN](../.analysis/ui-card-costume-alignment-20261003/034kan-ssr02-cn-390.json) / [JA](../.analysis/ui-card-costume-alignment-20261003/034kan-ssr02-ja-390.json)：移动端独立引述仍为两个段落。 | [CN390](../.analysis/ui-card-costume-alignment-20261003/034kan-ssr02-cn-390.jpg) |

[Browser console](../.analysis/ui-card-costume-alignment-20261003/browser-console.json)的warnings / errors为空；没有音频启动。覆盖限定上述已访问真实样本，不扩写为全部衣装、真机、媒体、Chibi或release验收。

## 最终验收记录

[构建输入 / sources SHA](../.analysis/ui-card-costume-alignment-20261003/build-input.json)记录input HEAD `1791300c`与当时尚未提交的本批exact tested source；构建包含当时共享checkout状态，最终本批代码已提交为`0f6abd06`。[构建日志](../.analysis/ui-card-costume-alignment-20261003/build-check.log)记录`npm run build:check` exit0 / 21.83s，copyPublicDir false，复用`.analysis/build-check`；现有chunk size warning保留。

[服务进程](../.analysis/ui-card-costume-alignment-20261003/server-process.json)为5204 / PID48708；旧PID13768按精确pid / args停止，其他服务保留。[RAM pin](../.analysis/ui-card-costume-alignment-20261003/pinned-code.json)190代码文件，main `/_app/index-C-04g056.js` SHA `148dc6ebcb8fb6de9f53bc4354e5995bce4f952d7f9523dbc2bce5e230390710`；card JS `/_app/ArchiveCardDetail-jRnjMUuc.js` SHA `a150b3c0c1c85d17c107c9fc7364b9ec5307ee27fdab6602dfa426ccd558031d`，CSS SHA `4a871390af2e016740577e288ca702048edac20e185626acfb594db81158769b`。

[verify-receipts完整性收据](../.analysis/ui-card-costume-alignment-20261003/verification-receipt.json)exit0，sourcesStable只证明build-input列出的14个文件（card5 / song9）及独立App SHA稳定，不证明整个脏工作区。RAM pin190确认Browser实际代码请求来自固定bundle；128个successful code requests全部SHA匹配，HTTP ≥400为0、媒体音频request为0。零音频请求只说明本批未触发播放，共享checkout中的Chibi未验。代码`0f6abd06`已commit / push，本文随独立文档批提交，不预填文档自身hash。
