# GS Archive Card Semantic Dictionaries P1（2026-08-03）

## 边界

本批只补齐卡片详情页已经存在、但过去仅显示裸 ID 或名称的三条 masterdata 硬关系：

- CardData 表 1 字段 23 `limitbreak_item_id` → ItemData 表 16；
- SkillData 表 20 字段 8 → SkillCategoryData 表 75；
- CardCenterSkillData 表 23 字段 9 → CardCenterSkillCategoryData 表 130。

不修改卡片数值、技能效果计算、播放器、音频、搜索、publication 或资源迁移。

## 产品投影

`card_detail_index.json` 继续作为去重详情索引，并新增：

- `items_by_id`：当前卡片实际引用的 5 种突破素材；
- `skills_by_id.*.category`：普通技能的正式分类名、色值与图标语义；
- `center_skills_by_id.*.category`：中心技能的正式分类名。

页面在 selector 层按卡片的 `limitbreak_item_id` 组装素材对象。卡片详情显示正式素材名与说明，普通技能和中心效果显示分类标签；卡池关系也优先显示素材名，不再只显示 `10503` 一类裸 ID。

已知交叉验证：卡片 `1338001`（`038tak_sr01`）映射 `10503`，正式名称为「彩光の欠片 SR」；技能分类为「コンボボーナス」，中心技能分类为「フィジカルグリッター」。

## 生成与验证

完整提取器需显式使用 decoded 输入，并向候选目录生成后只发布本批索引：

```powershell
python ..\data_pipeline\masterdata_extract.py `
  .analysis\masterdata\client_master_data.xor_DefaultPassPhrase.pb `
  --input-state decoded `
  --out-dir .analysis\card-semantic-backfill-candidate `
  --compiled-dir public\data\compiled `
  --voice-dir public\assets\voice `
  --spines-index public\spines-index.json `
  --prefab-meta public\data\idolsetting\costume_prefab_meta.json `
  --bg-dir public\assets\bg

npm run verify:card-semantic-dictionaries
```

长稳与真实音频不属于本批，P2-B 仍为 `NOT EXECUTED`。

## 5174 实际消费验收

验收路由：

`http://127.0.0.1:5174/?view=card_detail&card=038tak_sr01`

2026-08-03 已在实际 Vite 页面完成下列核对：

- 页面身份为 `SideM Story Viewer`，路由归一化后仍指向 `038tak_sr01`；
- 详情页显示突破素材「彩光の欠片 SR」及 `card_limitbreak_003`、正式说明；
- 普通技能显示分类「コンボボーナス」；
- 中心效果显示分类「フィジカルグリッター」；
- 技能等级由 Lv.1 切换至 Lv.10 后，说明中的触发率由 27% 更新为 45%；
- 1366×768 桌面与 390×844 窄屏均正常渲染；窄屏
  `documentElement.scrollWidth === innerWidth === 390`，无横向溢出；
- 两种尺寸均未出现框架错误遮罩，控制台 error/warn 为 0。

机器验证：

- `npm run verify:card-semantic-dictionaries`：836 cards / 5 items / 160 skills /
  53 center skills；
- `npm run verify:archive`：卡片详情 826/826；该命令会重写运行报告，因此
  本批不提交其时间戳与当前本地媒体覆盖变化；
- `npm run verify:archive-baseline:source-only`：通过；
- `npm run build`：2449 modules，生产构建通过。

候选发布前还将新增语义字段剥离后与现行 `card_detail_index.json` 比较，
SHA-256 完全一致，证明本批没有夹带卡片数值、衣装或音频候选变化。

## 下一窗口起点

本批功能与实际页面消费验收已经收口。不继续展开表 33/34、播放器、音频或
其他 masterdata 表。全表消费状态的旧盘点不能因“表已解码”就写成“产品已消费”；
后续从 `MASTERDATA_UNUSED_TABLES_AUDIT_20260802.md` 的 TODO consumer-check
清单开始，逐项补齐生成物、selector/组件或 verifier 证据后才能升级状态。
