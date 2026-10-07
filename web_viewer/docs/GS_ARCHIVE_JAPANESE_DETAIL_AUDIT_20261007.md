# 卡片与活动详情日文巡检（2026-10-07）

工程交接 4.5 的两个漏扫入口已修复。`audit-visible-japanese.mjs` 改用生产组件的 `data-archive-focus-id` 卡片/活动按钮，并在扫描前确认详情路由及内容根节点。错误入口仍报失败，不再产生“没有日文”的假阳性。新增 `--pages` 可仅扫描指定页面；每次 Chromium profile 在 E 盘本检出的 `.analysis/visible-japanese-profiles` 下创建，退出后清理。

## 实际验证

命令：`node scripts/audit-visible-japanese.mjs http://localhost:5175 --pages "card detail,event detail" --out <E盘审计目录>/visible-japanese-details.json`。

- 卡片：从卡片目录进入 `?view=card_detail&category=cards&card=001tom_n01`，成功扫描。
- 活动：从活动目录进入 `?view=event_detail&event=event%3A10020`，成功扫描。
- 两页无入口错误，工具退出 0；浏览器临时目录已清空。将卡片选择器改为不存在的候选后，隔离脚本退出 1，报告 `nothing to open`，且临时目录同样清理。
- 原始结果与日志：`E:\Web_build\GS_Archive_engineering_20261007\visible-japanese-details.json`、`visible-japanese-details.log`；反向结果 `visible-japanese-mutation.json`。

这次是 5175 的真实浏览器扫描，仅覆盖上述两个详情样本；假名检测不等于完整中日文识别，也不证明其他页面无遗漏。未修改译文、前端组件或在线资源。

## 扫描文字分类与交接

| 类别 | 卡片详情 | 活动详情 | 处理 |
| --- | --- | --- | --- |
| 原文对白/简介 | 3 处 `.authored-text` 卡片对白，包括 `あんたが●●●●プロデューサーだな？` | 活动简介以 `朝のニュース番組で1ヶ月間…` 开头 | 保留原始内容，不由工程窗口翻译 |
| 原题、专名或物品原名 | 关联标题 `スタートライン` | 标题 `届け、エール！`；素材名 `『7 in LIVE！』ステッカー` | 原文来源照录；是否提供译名留给翻译窗口，不推定为错译 |
| 资料小字段/标签 | 7 个选择器人名及当前 `天ヶ瀬 冬馬`；4 个语音标签，如 `スカウト・チェンジ！`、`ユニット編成 1/2` | 10 个 `エピソード1…` 标签；2 处 `スタージェム` | 记录为中文模式下仍显示原文的入口，交给翻译/展示窗口评估 |

工具保留其既有跳过规则（阅读正文、已标记日文的元素等），本次没有扩展排除范围来减少问题数。可见假名文本命中总数：卡片 16，活动 15。
