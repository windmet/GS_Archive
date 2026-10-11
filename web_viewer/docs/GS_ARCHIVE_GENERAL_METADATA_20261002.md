# 通用元数据中文与衣装来源：首批

输入 HEAD：`8cd9b4b7`。此批只改元数据展示和对应审计工具，谱面、音乐实现、剧情译文及审阅状态保持原状。

## 来源反查

- 读取本地解码 PB，验证 SHA-256 `25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1`，按本地 IL2CPP 字段名投影 StoryCostumeData / LiveCostumeData，再查 CardData 的 StoryCostumeId 字段及 compiled 的模型引用。
- `040ren_004_00`：表 28、偏移 1455569、Id 1040001、IdolId 40。Name / Description 未记录，无 CardData 衣装关联；5 个 compiled 文件引用该模型。保留原编号，不借剧情标题或外观造一个正式名称。
- 92 套字典未命名衣装均有剧情引用，原始衣装行没有非空白名称，CardData 的剧情衣装关联未命中它们。此结论限于本地 PB / compiled，不证明其他历史客户端也没有名称。
- 旧字典中的 `relation_id` 字段实际映射原表的 SortOrder；本批不会把它作为卡面关联证据，也不改写既有原始字典。

## 翻译边界与覆盖

`scripts/lib/archive-general-text-corpus.mjs` 明确列出允许提取的元数据字段。9766 条来源行，按领域、字段、精确原文去重。`translation/studio/general/metadata-drafts.mjs` 为可维护的中文草稿及有限句式，生成 `public/translations/zh-CN/archive-general.json`。

| 领域 | 已绑定的不同文本 |
| --- | ---: |
| 普通技能名称与说明 | 1561 |
| 技能分类 | 19 |
| 中心效果名称与说明 | 77 |
| 羁绊称号名称与通用说明 | 99 |
| 常用道具名称与说明 | 64 |
| 摄影地点名称与说明 | 109 |
| 摄影场景名称 | 25 |
| 滤镜名称与说明 | 5 |
| 相框名称与说明 | 24 |
| 背景名称 | 108 |
| 合计 | 2091 |

这 2091 条草稿覆盖 4820 个来源行，不等于全部元数据已经翻译完。其余 3466 条不同领域/字段/文本待继续处理，包含卡面标题、衣装、活动道具、普通/活动称号和贴纸；未收录译文精确回退日文。英文组合名等有意保留项也会先出现在待处理清单，下一批区分保留与待译。

共有展示层 `ArchiveGeneralText.mjs`，Vue 接口 `useArchiveGeneralText.js`。只匹配领域 + 字段 + 完整原文，日文界面返回原文，原文变化也回退，不做全站字符串替换。中文与日文均可搜索。原始字段、资源 ID、构图文件、剧情单位及原文全部保留。

本批实际接入：摄影工作台地点/场景/相框/滤镜；摄影资料相同名称及搜索；藏品目录/详情；卡片普通技能与中心效果。卡片突破素材、奖励表等消费点在后续批次继续接入，不能把目录翻译误报成所有页面已覆盖。

排除：单元剧情、工作通讯、首页对话及其他人称敏感台词。不改变 B001 reviewed / B002 draft，不声明本批为官方译名或已获用户语言审阅。

## 羁绊称号来源

逐一核对 49 位偶像的两组 `honorType=2` / `honor_idol_*` 记录，共 98 条。`honor-bonds.json` 保留每条原名和资源键；匹配失败时不套用来源。

用户在 2026-10-02 转述朋友：两组对应羁绊等级 50 / 100。本批标为 `user-reported`，不是 PB 任务表验证。用户尚未分别确认“担当”和“专属称号”哪个等级，单项 `level:null`，详情显示等级对应待确认。其余未知称号不增加推断来源。已发出一次可异步回答的等级对应问题，后续工作不依赖它。

中文名沿用项目既有偶像显示写法；例如阿斯兰的称号原文缩写与偶像全名不同，使用明确的同偶像别名映射，不修改其源名。

## 审计问题同步修复

- 藏品说明安全分段显示体力符号，停止裸露 `[stamina]`。只有来源中实际存在的 stamina 键进入组件，其他文本作为纯文本显示，不使用 v-html。
- 配置期使用生产者的 `termInfo.*.sentinelCandidate`；两端均占位显示“未限定配置期”，单端占位显示“某日起/至某日”。没有把占位日期当活动截止时间。
- 摄影资料列表采用地点名或表情/动作语义标签，编号和脚本键收进“来源与资源”。目录复用摄影工作台的姿势/表情标签，并移除目录中的语音试听。

## 验收

- `python scripts/audit-unnamed-costumes.py`：92 套未命名来源审计，输出小型 JSON 到 `.analysis/archive-general-localization`，不改源资源。
- `node scripts/verify-archive-general-texts.mjs`：2091 个源文绑定、普通/中心技能全覆盖、所有数值与未解析参数保持、日文/改变源文/未命名服装回退、98 个来源身份绑定、安全体力分段、占位期合同通过。
- `node scripts/verify-archive-inline-presentation.mjs`：通过；修正旧回归只依赖未解析 level 的假设，改为同时验证真实原始 description_template。实际发布 level 的数字已被前批修复，不为满足测试重新引入占位符。
- `npm run verify:studio-composition`：通过，构图保存/载入与 source ID 合同不变。
- `npm run build:check`：最终 2682 modules，10.49 秒，固定 `.analysis/build-check`，无 public 媒体复制；共用元数据 chunk 为 355.49 kB / gzip 27.71 kB，按页面依赖加载。
- Browser 插件，`127.0.0.1:5213`，生产代码 + 已有本地 corpus 映射，readmodel release `17e0ab0b227d6f2bb433f0c1cfaf3934fcccbc2cd420387adc95af9fc4c7a907`。
- 1280×800：中文“冷静”搜索得到 1 条 20922001，译名与详情一致；实际滚动查看用户补充的羁绊来源；摄影资料中文“音乐厅”搜索/选择、默认折叠资源编号；工作台选择同名地点，保留 spot ID 7，画布实际换成音乐厅。
- 390×844：Go Go 果冻详情显示中文说明、体力图标、未限定配置期；document scrollWidth=390，没有 `[stamina]`。
- 001tom_ssr01：中心效果“体能律动”90%；普通技能从 Lv.1 的 32% 切至 Lv.10 的 50%，12 秒间隔、6 秒持续、30% 增幅保持。对话仍显示原文。
- 页面身份/非空/无 Vite overlay/交互/截图及 error logs 检查通过；测试 tab 的 error logs 为空。桌面截图有 Browser 缩放模糊，语义和数值结论同时用 DOM 复核。

截图：`.analysis/ux-productization-20261001/39` 至 `44`。此批未做实体手机验证、R2 上传或 Pages 部署。后续仍需补余下译文、门户审计整合，以及按实际桶总量严格小于 8,600,000,000 字节的条件决定上传测试页。
