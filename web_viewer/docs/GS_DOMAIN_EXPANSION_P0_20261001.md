# 档案域扩展：P0 技能字段与关联修复

输入 HEAD：`fe72c0dd`，B002 翻译已提交；保留现有未跟踪资料。依据
`GS_Archive_Domain_Expansion_7b1d4e0c.zip`，实际复核本地 schema、decoded PB
与 IL2CPP 元数据。

## 修复

- `generation_jobs.py` 完整卡片域选择 table74 SkillDetailEffects。
- `card_gameplay.py` 使用 Skill20.SkillDetailGroupId → SkillDetail21.GroupId
  → SkillDetailEffectGroupId → SkillDetailEffects74.GroupId；效果按字段8排序。
- 效果保留 Type、EffectGroupId、Param1–3 和来源。字段4不再冒充数值。
- 当前 PB 的 dXY 文案槽使用排序后的效果序号 X、参数序号 Y。
  支持本次观察到的类型/参数组合；未知组合或缺失效果保留原槽。
  这是当前配置的文案投影，不是客户端执行算法或完整育成模拟。
- 兼容门面、既有 wire API 和历史 snapshot 保留。

## 真实来源与验证

decoded PB SHA-256：`25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1`。
IL2CPP metadata SHA-256：`658f966af11aef965b541e093889056cafa61a7f7fcd4bbf38e1ca2eab6d6e00`。
333 个 Skill 中，327 个 SkillDetailGroupId 与自身 Id 不同。
本地元数据确认 SkillDetailEffectType，含 JudgementUp、LifeRecovery、ScoreUp、
ComboBonus 等类型；不以技能名猜枚举值。

通过的命令：

```powershell
python scripts/verify-masterdata-card-gameplay.py --decoded-masterdata .analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb
python scripts/verify-masterdata-generation-jobs.py
python scripts/verify-masterdata-cards.py
python scripts/verify-masterdata-entrypoint.py
python scripts/verify-masterdata-wire.py --decoded-masterdata .analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb
```

836 张原始卡片、2,672 条衣装关系经过回归。新回归明确覆盖同号
ProducerLevel 不参与技能、SkillId 与 GroupId 不同、效果顺序、多参数槽、
未知类型保留及数值缺省0。旧 wire 基线仍为83条启发式错误。

`generate-card-skill-repair.py` 在仓库外生成
`E:/Web_build/GS_Archive_Domain_Work/card-skill-repair-fe72c0dd/`。
只修改候选的 skills_by_id；其他字典与原始 mounted 数据逐项一致。
160 个技能、旧1,570条/新1,600条等级；1,383条既有说明改变，
323/324/335各补回10级。没有残留模板槽。

扩展包的42项Python、6项Node测试在本机通过；带本地完整schema重新导出
到 `E:/Web_build/GS_Archive_Domain_Work/verified-domains-25d48a55/`，
1,625份导出文件哈希/关联验证通过。schema验证状态为
verified-full-local-schema，publicationReady仍为false。

## 验证边界与接续

本提交仅修复Python生产逻辑和生成候选。尚未替换mounted卡片字典、
重建版本化read models或完成Browser技能旅程；以上均须在后续数据接入
中完成。纯Python改动不机械执行Vite构建。未部署、未改R2。
共用新域解析、活动/物品/称号闭环、拍照目录和实验台仍继续推进。
