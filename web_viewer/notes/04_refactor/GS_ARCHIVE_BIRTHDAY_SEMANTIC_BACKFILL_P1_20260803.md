# GS Archive Birthday Semantic Backfill P1（2026-08-03）

## 结论

本批把生日剧情从“根据资源文件名前缀推测归属”提升为 masterdata 硬关联：

- 表 76：4 个生日章节族（制作人／偶像生日 × 第 1／2 期）；
- 表 77：181 个 section 与正式标题；
- 表 78：181 个 episode 与剧情资源；
- 表 80：episode → 角色集合；
- 表 86：78 条生日公告及月／日。

派生结果写入：

`public/data/masterdata/birthday_story_semantic_index.json`

生成入口：

```powershell
python ..\data_pipeline\masterdata_extract.py `
  .analysis\masterdata\client_master_data.xor_DefaultPassPhrase.pb `
  --input-state decoded `
  --birthday-semantic-only `
  --out-dir .analysis\masterdata-semantic-backfill-candidate `
  --public-out-dir public\data\masterdata
```

## 关键勘误：山村贤与制作人生日公共篇

旧页面按资源名 `1_8_101_*` 推测角色，因此把下列两条归入山村贤：

- episode `51110001` / section `511100` / `1_8_101_00_a`；
- episode `52110002` / section `521100` / `1_8_101_00_b`。

这两条剧情确实由山村贤登场引导，但表 77 的 section 标题没有角色名，表 80 的对应记录也没有角色字段。它们是未绑定单一角色的制作人生日公共篇，不是山村贤个人生日剧情。

因此当前语义为：

- 176 条偶像归属；
- 3 条山村贤归属；
- 2 条制作人生日公共篇；
- 共 51 个集合、181 条 episode，数量不变；
- 29 条第二期偶像生日剧情继续以 Idol Episode 为 canonical，不在生日域重复定义章节。

页面会单列“制作人生日公共篇”，并在边界说明中明确“登场角色不等于 masterdata 归属”。

## 页面增量

- 正式使用表 76 的“第 1／2 期”和“制作人／偶像生日”语义，不再从发布时间或资源后缀猜标签；
- 生日集合显示表 86 反查的官方生日月／日；
- 个人故事共享文件继续显示 `Idol Episode` 关系入口；
- 公共篇不复制到山村贤集合；
- 旧数据缺少新索引时仍保留资源名前缀 fallback，仅用于兼容，不作为当前权威。

## 验证

```powershell
npm run verify:birthday-story-semantics
npm run verify:birthday-story-domain-landing
npm run verify:story-domain-identity
npm run verify:story-collections
npm run verify:idol-story-interface
```

核心契约：4 chapters / 181 sections / 181 episodes / 179 已指定角色 / 2 明确未指定 / 78 announcements；section、chapter 与角色记录均无缺失。

## 边界与后续

- 本批不修改播放器、音频、搜索、publication 或 RAW；
- `MASTERDATA_UNUSED_TABLES_AUDIT_20260802.md` 仍是本地探索稿，不随本批提交；
- 审计稿中的 `158 - 69` 应为 **89**，不是 90；
- 表 178 已由 `extra_story_visual_index.json` 消费，后续 Extra 只补表 143 campaign 语义，不重复视觉资产链；
- 下一批候选：表 16 限凸道具名与表 75/130 技能分类，随后再评估 Photo Studio 目录。
- P2-B 2–4 小时长稳仍为 **NOT EXECUTED**。
