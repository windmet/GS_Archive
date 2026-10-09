# 第二波翻译：盘点与分批（2026-10-09）

第一波（B001–B034）覆盖了全部阅读文档的剧情正文。本文列出第二波要翻的内容：卡面文本、拆分后的生日 small talk，以及本轮接线时发现、目前没有任何译文来源的页面文字。数字由 `card_index.json`、`mobile_archive_index.json`、`random_talk_presentation_index.json` 和编译语料统计；「去重」按原文完全相同计。

## 1. 清单

| 类别 | 条目 | 去重 | 去重字数 | 已有译文 | 走哪条管线 |
|---|---:|---:|---:|---|---|
| 拆分后的生日 small talk（10 篇） | 59 行 | 59 | — | **59（B035 草稿，10-09 已载入）** | 剧情 Studio 批次 |
| 卡面台词·普通 | 594 | 584 | 55,606 | 0 | 卡面文本（新管线） |
| 卡面台词·特训 | 836 | 826 | 82,502 | 0 | 卡面文本 |
| 卡面台词·额外 | 124 | 124 | 2,287 | 0 | 卡面文本 |
| 首页触摸语音 | 2,564 | 2,356 | 88,877 | 0 | 卡面文本 |
| 电话标题 | 342 | 341 | 2,925 | 0 | 卡面文本（标题出自卡片主数据） |
| 个人聊天·台词 | 17,823 | 5,641 | 162,368 | 0 | 通信（新管线） |
| 个人聊天·标题/预览 | 830 | 718 | 17,152 | 0 | 通信 |
| 组合聊天·台词 | 1,962 | 995 | 28,515 | 0 | 通信 |
| 组合聊天·标题/预览 | 97 | 97 | 2,444 | 0 | 通信 |
| 随机话题（开场 343、话题 245） | 1,408 行 | 1,347 | 35,550 | 0 | 通信 |
| 额外剧情作品名与作品介绍 | 约 20 | — | 少量 | 0 | 通用资料（主窗口直接翻） |

已有覆盖：卡片**标题** 447 条（`translation/studio/general/card-drafts.json`），之前零星补过的只有这一类。卡片 `texts` 只有 `normal`、`awakened`、`extra` 三个字段，没有其他专属台词种类。组合聊天有 1 个编译文件缺失，需要单独核对。

不翻、保持原文的：组合名（もふもふえん 等）、活动副标题这类品牌名；源数据占位说话人 `#N/A`。

## 2. 卡面文本的规则（沿用交接 §4）

1. 按偶像分批：同一偶像的普通、特训、额外台词和触摸语音放在同一批，统一口吻。
2. 称呼以 B001 为基准；「プロデューサーさん」→ 制作人；「さん」一对一保留（女性用小姐/女士）；P 名占位 `●●●●` 原样保留。
3. 每条译文绑定卡片 `resource_id` + 字段 + 序号 + 原文哈希；原文变化时译文失效。
4. 状态分草稿 / 已校对；翻译审计里单列「卡面文本」一组。

建议批次：每批 4 位偶像，约 300–330 行、1.8 万字，共约 13 批。触摸语音跨卡重复的 208 条只翻一次。

## 3. 卡面文本：已接入通用翻译流程（10-09）

卡面台词、触摸语音、电话标题按「一句对一句、只绑说话人」处理，走通用资料流程（原文作键），不用剧情 Studio 的逐行回执：

- 语料新增 `card-line`（normal/awakened/extra）、`card-touch`（text）、`call-title`（title），每条引用记说话人（卡片所属偶像）。
- 分片 `card-lines`：只在卡片详情和电话页懒加载，**不进**打包的根文件 `archive-general.json`。
- 批次：`web_viewer/.analysis/general-translation-batches/card-lines-20261009/`，18 批（G-card-lines-001～018），按偶像排序，每组标题写明说话人；提示词是角色台词版（称呼规则、保留 ●●●●、内部标签用 `[编号=]`）。给模型的只有 `glossary.md` 和各批 `input.md`，回传按 `output-template.md` 的格式存为 `output.md`。
- 导入（在 web_viewer 下）：
  `node scripts/general-translation-workflow.mjs check <批次>/local/batch-map.json <批次>/output.md`
  `node scripts/general-translation-workflow.mjs import <批次>/local/batch-map.json <批次>/output.md '模型名'`
  然后 `node scripts/generate-archive-general-translations.mjs`、`generate-translation-release.mjs`、`generate-translation-audit.mjs`、`generate-story-search-localization.mjs`。
- 审计里单列三组：卡面文本·台词 / 触摸语音 / 电话标题。检查：`verify-card-line-translation.mjs`。

## 4. 还缺的工程

现有 Studio 管线以阅读文档为单位（`prepare-ai-studio-batches.mjs`），卡面文本、通信、随机话题都不是阅读文档，需要先做：

- 通信的同类投影（聊天编译文件的逐行单元）。量最大，建议放在卡面文本之后。

## 5. 现在就能翻的

- **B035-birthday-small-talk**：`web_viewer/.analysis/translation-studio/wave2-20261009/B035-birthday-small-talk/input.md`（10 篇、59 行）。生成方式：`node scripts/prepare-ai-studio-batches.mjs --documents <10 个文档 id> --batch B035-birthday-small-talk --out .analysis/translation-studio/wave2-20261009`。载入流程与 B031–B034 相同；旧合并稿的草稿可作参考，但不能直接套用（换行和键名都变了）。
