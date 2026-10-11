# 活动、剧情资源与已校对译文验收 — 2026-10-02

## 范围与基线

工作目录 `E:\Web_build\SideM_Archived\web_viewer`；分支 `codex/event-resource-navigation-20261002`；输入 HEAD `c1daf22b9bc1ef0848430512a4729f9a10e168e5`。本批未部署，保留原有非任务文件与证据。

## 翻译审计

用户明确确认前面回填译文整体已检查。本批仅将 G-costumes-001/002、G-cards-001/002、G-items-001..004、G-honors-001..005 共 13 批 3,416 个通用原文单元列为 reviewed：衣装 496、卡面标题 447、道具 857、称号 1,616。已存在的衣装校对收据保留；其他批次不提升，`not_final: true` 保留。

新收据绑定批次、用户确认原话、返回文本 SHA-256 和日期。偶像译名及“脚链”使用已落地的统一版本。由这些确切道具译文提取且没有冲突的 81 个卡池名称同步列为已校对；关联 273 种抽取道具、82 条目录记录，其中 25 条名称由道具补录。券名不证明开放时间或卡片范围。卡池详情的中文译名记录同步显示“已校对，非终稿”。

浏览器资源审计页面实测显示上述五类统计，展开道具清单可见 reviewed 批次；搜索“大河武”得到三条统一译名，脚链说明亦显示已校对。

## 资源和页面组织

- 59 个活动采用严格活动身份；剧情活动保留原有 410/430 系列身份，其余使用 `event:编号`。2 个复刻仅通过显式 original 关系复用资源。
- 活动目录显示主视觉、时间、类型、剧情与报酬数量，支持搜索、类型筛选、排序及分页。活动详情优先用完整运营宣传图。
- 剧情门户改为中等尺寸 16:9 清爽 KV 卡片，使用本地 1800×960 资源；展示系列、章数、真实编译剧情登场阵容及头像。未凭图片推定“全语音”或“全译文已就绪”。
- 门户上方采用主线专区与六个常用入口，卡片剧情提前展示；活动推荐收敛为六张，头像附姓名 Tooltip，不重复列出名字。16 组合前传使用单行横向吸附轨道及左右按钮。
- 系列、偶像与组合筛选仅放在全部检索。49 人按 16 组合分组多选，匹配任一已选偶像；组合过滤与其他条件取交集。搜索标题、现有简介和偶像姓名，不承诺正文全文检索。
- 检索使用实色固定标签栏与筛选栏、约 76px 列表 / 45px 表格、每页 40 条和命中标题高亮。手机筛选区随页面滚动，表格独立横向滚动。
- 翻译状态从当前 Reader manifest 与实际翻译审计的 SHA 绑定生成：12 篇完整已译、1 篇部分已译、1,379 篇原文未译、2 篇尚未核对。未将标题译文或来源缺失当成正文已译。
- 38 个剧情活动（含复刻）绑定确切父文档和可用的第一篇 Reader ID。剧情卡片与活动页主按钮直接阅读，Reader 提供轻量活动档案链接。返回剧情入口保留当前会话条件；关键词和排序通过 URL 保存，偶像、组合、系列、翻译状态和视图为会话状态，刷新重置。多次跨页返回不承诺保存 Reader 阅读位置。
- 剧情门户展开简介接入全局中日语言切换；专属 Reader 与 ADV 继续保留原文、译文、双语三模式。

同期卡池候选审查记录位于 `.analysis/event-resource-20261002/event-gasha-relationship-audit.json`：47 对同日记录中，30 对有故事角色集合，28 对没有共同偶像，2 对存在部分重合；候选报酬卡无共同项。卡池卡片范围本身是候选推导，不能因此断言所有活动与卡池绝无关系。本批移除活动↔卡池按同期建立的展示关联，保留有独立证据的额外剧情↔卡池和道具↔卡池关系。

## Carnival 全期补录

从 [Wikiwiki 历史活动目录](https://wikiwiki.jp/sidem-gstars/過去のイベント) 逐期核对 2021 年 11 月至 2023 年 3 月共 17 期，补录 51 张兑换卡及 312 条完整兑换表记录。示例：[2022 年 11 月](https://wikiwiki.jp/sidem-gstars/【イベント】「315カーニバル」（2022年11月）)。逐期具体 URL、核对日期和兑换截止原文保存于 [carnival-wiki-source.json](../public/data/editorial/carnival-wiki-source.json)。此处的完整指这 17 期兑换表，不含各期所有任务、攻略或全文。

卡片通过原文标题、稀有度、偶像及该期发布日期唯一匹配客户端记录；币种使用对应 EventCollection 的明确 rareItemId。仅阿斯兰姓名使用显式别名，没有模糊姓名或裸数字 ID 关联。

[event-exchange-evidence.json](../public/data/editorial/event-exchange-evidence.json) 独立存储社区兑换归属证据，不写成 PB 直接关系。界面明确标记 Wiki 补录，同时卡片身份和资源来自客户端。完整兑换表保留日文原文列以便核对，不当作新增已校对译文。

共享 `ArchiveSourceLink` 同时用于活动和卡池；仅允许 HTTP(S)，显示具体名称和“站外原始记录”，新标签跳转并带 `noopener noreferrer external`。

### PB 查证边界

扫描当前解码 Master PB 共 47,204 个记录、158 个非空表，找到 19 个候选引用；文件 3,053,002 字节，SHA-256 `25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1`。

2022 年 11 月三张卡存在稳定 Card 记录：1237003 / `037jir_r03`、1301007 / `001tom_sr07`、1325006 / `025suz_sr06`。Event 20013 的 EventType=2、EventDetailId=13；EventCollection 13 提供 normal/rare 材料 41625/41626，但没有兑换 Product 列表。schema 存在 EventExchangeData 和 ShopEventExchangeListReply 定义，当前仓库未找到实际兑换响应留档；schema 名称、发布日期和卡片存在不能单独证明兑换归属。

可重跑 [audit-carnival-pb-links.py](../scripts/audit-carnival-pb-links.py)，本地报告 `.analysis/event-resource-20261002/carnival-pb-reference-audit.json`。结论仅针对当前 PB 与仓库响应证据，未穷尽用户全部磁盘。

## 验证

按 [BUILD_ACCEPTANCE_POLICY.md](BUILD_ACCEPTANCE_POLICY.md) 执行 `npm run build:check`；完整 Vite 代码编译，`copyPublicDir:false`，复用 `.analysis/build-check`，没有生成完整素材包。日志 `.analysis/event-resource-20261002/build-final.log`。

相关回归通过：

- `verify-event-resource-graph.mjs`：59 活动、59 主图、57 短图、38 清爽封面、49 人与可读文档绑定，17 期 / 51 卡 / 312 兑换记录；来源 SHA、PNG 尺寸与 stale identity 拒绝。
- `verify-gasha-ticket-evidence.mjs`、`verify-general-translation-workflow.mjs`：用户批次身份、reviewed 状态与卡池提取关联。
- `verify-event-story-navigation.mjs`、`verify-event-readmodel-navigation.mjs`、`verify-event-view-consumer.mjs`。
- `verify-reading-navigation.mjs`、`verify-archive-routes.mjs`、`verify-archive-relation-navigation.mjs`。
- `verify-story-localization-runtime.mjs`、`verify-reader-titles.mjs`。
- `verify-story-search-localization.mjs`：1,394 个父文档与实际就绪译文状态绑定；`verify-archive-routes.mjs` 增加最新排序 URL 往返。

`verify-reading-render.mjs` 存在旧断言要求“Producer 显示名”，现有界面已是“P 名字”；本批未改其断言，不将它记为通过。

浏览器复用既有 5198 预览进程 PID 31712，以本批 build-check 及实际外部挂载资源验收；没有启动额外服务。实测 1440×1000 桌面与 390×844 手机视口：

- 剧情卡片桌面三列、手机一列，KV 正常加载，演员可读，无横向页面溢出。
- 硲道夫与握野英雄多选得到 83 篇；搜索硲道夫得到 45 篇，中日资料语言切换后结果不变。完整已译与部分已译分别得到 12 / 1 篇；SIGN@L 加关键词 precious 得到 1 篇，标题高亮正确。
- 列表单行高度约 76px，表格约 44.64px；1394 篇分 35 页。最新排序写入 URL。滚动后两个固定层均为实色白底，没有正文透字。
- 手机列表 document scrollWidth=390；680px 表格在约 351px 容器内滚动，不撑宽页面。门户六张活动推荐、16 组横向前传轨道；轨道翻页和 Jupiter 三篇可用章节入口有效，未公开第四话保留不可播放状态。
- precious love 卡片直接进入序章，11 话导航及三模式保留；Reader→活动→阅读主按钮往返有效，直接返回门户保留筛选。
- 门户第一章中文简介与全局日文切换；Reader/ADV 三种模式仍可选（非全篇长时播放验收）。
- 2022 年 11 月 Carnival 显示三卡中文标题和偶像、40/35/15 张贴纸及每卡限兑一次；展开 18 行完整兑换清单，手机 document scrollWidth=390，站外链接准确。
- 资源审计显示四批类共 3,416 已校对及 81 卡池名称已校对，其他草稿统计保留。
- 文具卡池详情显示实际具体来源链接与站外提示，`rel="noopener noreferrer external"`；券名关联与卡片候选范围的证据提示保留。

预览构建替换期间曾有旧分块加载失败，刷新后恢复；另一次 QA 手动输入错误裸 Event ID=20013 被拒绝，改从目录进入正确 `event:20013` 路由正常。这些不算成功页面验收。浏览器模拟视口不是实机；未做发布包、全媒体播放、冷启动缓存清除或线上部署验收。

截图均为小型本地证据，位于 `.analysis/event-resource-20261002`：`story-portal-final-desktop.png`、`story-portal-final-mobile.png`、`story-unit-rail-desktop.png`、`story-search-final-desktop.png`、`story-search-final-mobile.png`、`story-search-table-desktop.png`、`story-search-table-mobile.png`、`story-search-sticky-final.png`、`carnival-final-desktop.png`、`carnival-final-mobile.png`、`translation-reviewed-audit.png`。较早 compact / streaming 截图为被替换方案。桌面 Browser 截图存在比例裁边现象，DOM 边界验收采用实际 1440px 视口及 scrollWidth；手机截图与布局均可直接核对。

## 设计对照记录

参考用户提供的原页面截图及本轮明确文字规格，最终本地截图逐项核对：

| 项目 | 原页面问题 | 最终实现与证据 |
| --- | --- | --- |
| 门户骨架 | 2/3/4 列反复切换 | 主线与常用入口独立专区；推荐统一三列，前传单轨道 |
| 活动卡片 | 缩图太小或重复名字撑高 | 16:9 清爽 KV、真实头像 Tooltip、主体阅读与独立活动入口 |
| 前传 | 16 组铺四行 | 单行吸附、按钮翻页、查看全部 16 组 |
| 检索层级 | 正文透进固定栏 | 标签栏和筛选栏均实色白底，z-index 30 / 20 |
| 检索效率 | 高卡片与缺少角色筛选 | 49 人多选、16 组合、译文状态、40 条分页、76px / 45px 两种视图 |
