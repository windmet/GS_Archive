# Wikiwiki 获取途径核对（2026-10-14）

客户端 masterdata 里没有 GashaData（卡池内容由服务器下发），以前卡池与活动的「关联卡片」只能靠卡片 ID、开放时间推定。这一批用 wikiwiki 上的过往公告和活动页逐项核对这些推定，核对一致的改为「已核对」，并补上券专用卡池的开放记录。

## 来源

- `scripts/extract-wikiwiki-acquisition.py` 解析 14 个页面：过往公告（2021、2022 前半、2022 后半）、过往公告总页、过往活动，以及 9 个单独的活动页。每个页面记录 URL 与 HTML 的 SHA-256。
- 输出 `public/data/editorial/wiki-acquisition-evidence.json`（受版本控制，`checked_at` 2026-10-14）：
  - 79 个卡池：57 个对应公告 ID，22 个只对应抽卡券组；
  - 498 张卡池卡；
  - 53 个活动报酬列表，其中 60 张卡不在报酬表里（交换所或活动任务）；
  - 6 张限时任务卡。
- 提取时逐张对照本地卡片标题与偶像。对不上的条目会让提取失败，不会被跳过。

## 读模型（`readmodels/lib/wiki_acquisition.mjs`）

- `confirmGashaPickups`：wiki 列出的新卡必须与推定的 pickup 完全一致，系列池则核对「フォトN種類」数量。核对一致后，`relation_type` 改为 `wiki_gasha_listing`、`evidence_level` 改为 `curated`，并带上来源。复刻池共用首次开放时的卡表，卡片只记到首次开放的卡池。
- 券专用卡池的卡（15 张通常 + 147 张系列）关联到 `ticket-<hash>` 卡池，没有头图（`banner_url: null`）。
- `wikiEventRewards`：315 CARNIVAL 的额外卡必须与交换所证据一致；其他活动的额外卡必须有任务条件。
- `missionAcquisitions`：活动外的限时任务（以原版成员通关指定歌曲）。

结果：

- 498 条卡池关联全部是 curated；
- 169 张卡有活动获取途径（剧情 32、pt 报酬 200、交换 51、任务 9，同一张卡可以有多种途径）；
- 原先推定的活动关联全部得到确认；
- 只有开服卡（N 49、R 49、SR 49、SSR 6）没有任何获取来源。

## 页面

- **卡片页：** 显示「活动报酬 / 活动任务报酬 / 活动兑换报酬 / 限时任务报酬」并附来源链接。卡池项写作「卡池公告列出的新卡」。
- **卡池页：** 显示「已核对」徽标和「开放记录」；券专用卡池也显示关联卡片。
- **活动页：** 任务报酬显示旗帜图标，并附 wiki 核对说明。

## 未解决

- 没有关联到任何卡池的：1st Anniversary、各种 stamp 卡池、当日限定、10 回無料，以及身份不明确的 7th STAGE。
- 抽卡概率、卡池规则和公告正文没有收录（见下一步核对）。

## 验证

- `readmodels` 测试 68/68（含 `wiki_acquisition.test.mjs`）
- `verify-gasha-ticket-evidence`
- `verify-gasha-loading-boundary`
- 在 5177 上用 Browser 实际查看过
