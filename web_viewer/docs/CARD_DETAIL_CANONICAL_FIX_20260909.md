# 卡片详情与正式卡身份一致性

2026-09-09，接续 `78f016d` 的卡片标题验收发现：`001tom_ssr01`
显示正式卡「瞳に映るその先に」，技能却是教学卡的コンボボーナス。

## 原因与修复

836 条 CardData 共用 826 个资源名。列表的 `canonical_cards` / `buildCardMap`
优先选正式卡；详情拆分原来按资源名最后写入覆盖，后出现的教学卡覆盖了正式卡。
详情现在与 Python 卡片选择共用 `card_preference_score`，同分保留首条。
全部源卡行和技能、中心技能、素材、服装字典保留。

修正来自本地解码 masterdata，未使用 Wiki 补录。使用正式 CLI 在
`.analysis/card-detail-canonical` 生成后，仅更新公共 `card_detail_index.json`。
差异核对：10 个详情资源改变，816 个未变；四个引用字典完全一致。
演出语音关联由 3457 恢复为 3509，服装关联由 2640 恢复为 2652。

受影响资源：`001tom_n01`、`001tom_ssr01`、`004ter_n01`、`004ter_ssr01`、
`010pie_n01`、`010pie_sr01`、`044ame_n01`、`044ame_sr01`、`047shu_r01`、`047shu_ssr01`。

## 验证

- `verify:masterdata-cards`，包括教学卡前后顺序、同分、保留字典、输入不变。
- 真实解码数据的全卡检查通过；完整卡、摘要、canonical 三个冻结 hash 未变，
  仅详情 hash 更新，fixture 保留旧 hash 和修正原因。逐正式卡核对源 offset、技能和语音。
- `verify:card-semantic-dictionaries` 对全部 826 个前端正式卡检查摘要与详情同源 offset。
- `verify:card-voice-preview`、`verify:archive-presentation`、`verify:masterdata-generation-jobs` 通过。
- 浏览器 URL：`http://127.0.0.1:5175/?view=card_detail&category=cards&idol=001tom&card=001tom_ssr01`。
  刷新后技能恢复「スコアアップ」，中心效果恢复「フィジカルグルーヴ」，衣装恢复
  「ミッドナイトプラネット」等；Lv.1 → Lv.10 概率由 32% → 50%；390px 无横向溢出。
  恢复的「スカウト・チェンジ！」入口实际载入单段演出，显示冬马与对应原文并可返回。
  详情页 error/warn 为空；演出预览产生两条 Pixi Spine update/tint warning 栈，未见 error。
  这不是听感或长稳验收。

## 尚待处理的校验差异

`verify:masterdata-output-io` 未通过：旧快照的空数据 `story_catalog.json` 为 3 个键，
当前为 9 个键，对应 hash/stdout 不一致。用 HEAD 旧详情拆分函数重跑 20 个临时 CLI
输出，与本次修正后的 20 个输出完全一致，确认该失败早于本次卡片修复。
下一批核对剧情目录结构演进并更新对应输出契约；本批不宣称整个生成门禁全绿。

长稳仍按用户要求后移。回滚本批应同时回滚详情生成规则、生成 JSON 与修正后的测试基线。
