# 卡面标题两批回填 · 2026-10-02

输入 HEAD：`5aa49089c106ca9575f9da8fc735cae290ad5abf`。分支：`codex/costume-translation-20261002`。

用户提供 G-cards-001 附件及 G-cards-002 聊天文本，并要求回填。本次使用这两批新译文替换初版默认译文，保存为 `draft`、`not_final: true`。此前衣装的人工确认仅对应衣装批次，本次卡面标题未提升为 reviewed。translator 记为“用户提供的新译文（未声明生成模型）”。

| 批次 | 来源摘要前缀 | 独立标题 | 来源引用次数 |
| --- | --- | --- | --- |
| G-cards-001 | 097d2b57bb8d | 400 | 737 |
| G-cards-002 | d9cbc77d4958 | 47 | 99 |

合计 447 个标题、836 次引用；368 个标题的显示文字发生变化，其余与初版一致。原文、完整引用及导入身份保存在 [G-cards-001 修订](../translation/studio/general/revisions/G-cards-001.json) 与 [G-cards-002 修订](../translation/studio/general/revisions/G-cards-002.json)。原始提交和实际导入文本保存在 [returns/cards-20261002](../translation/studio/general/returns/cards-20261002/)。

## 数字写法

现有保护数字合同要求保留原文中的阿拉伯数字。仅以下三处采用等值数字写法，其他 444 条与用户提交一致：

- G-cards-001 / 137：`冬日特别的一道美味` → `冬日特别的1道美味`，原文 `冬の特別な1皿`。
- G-cards-001 / 365：`珍藏的一张` → `珍藏的1张`，原文 `とっておきの1枚`。
- G-cards-002 / 032：`第二次新手教程用照片` → `第2次新手教程用照片`，原文 `チュートリアル2回目用フォト`。

## 验证

- 两批 import 通过，逐条校验来源摘要、哈希、编号、引用、数字和占位符；均无 uncertain 条目。
- `node scripts/verify-general-translation-workflow.mjs`、`node scripts/verify-general-translation-markdown.mjs`、`node scripts/verify-archive-general-texts.mjs` 通过；B001/B002 状态隔离通过。
- 逐项确认公共主索引及 cards 分片的 447 个译文等于实际导入修订；原始提交与导入差异仅为上述三处。其他资料域内容未变，衣装继续为 496 条 reviewed。
- 重新生成卡面标题审计，批次使用真实的紧凑版批次身份。
- `npm run build:check` 通过。标题数据通过静态 JSON import 进入前端 bundle，需要编译后进行展示验证。输出复用 `.analysis/build-check`，`copyPublicDir:false`，无公共媒体库复制；现有大 chunk 提示仍在。
- Browser 复用本工程 `http://127.0.0.1:5213/` 的生产代码预览，公共资源映射本地 public，readmodels 为 `E:/Web_build/GS_Archive_Domain_Work/song-gameplay-readmodels-20261001`。
- 重编译后刷新预览：列表检索“备受喜爱的自信家”并进入详情，标题和面包屑均更新；切到日本語显示 `愛される自信家`，中文恢复新译文。
- 列表检索第二批“迈向晴空万里的幸福路”，进入 `034kan_ssr02` 详情，页标题、卡面标题和相邻卡标题使用新译文。默认桌面 1280×720 与手机模拟 390×844 检查通过，长标题完整展示；临时 viewport 已恢复。控制台无 error/warn。
- 小型证据位于 `.analysis/card-title-translation-20261002/`：`verification.json`、`build-check.log`、`card-title-desktop.png`、`card-title-mobile.png`。先前导出的日文及初版译文继续作为回填前快照保留。

本次为本地来源、代码与 Browser 展示验证，未进行真机验收、全媒体发布打包或线上部署。
