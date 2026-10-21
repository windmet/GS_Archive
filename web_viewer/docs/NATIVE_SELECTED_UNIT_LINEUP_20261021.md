# 所选 Unit 的原生成员槽序（2026-10-21）

输入 `78dfeb29`，分支 `stage/20261020-native-followup`。已进一步核实独立选组路径并接入三首全体曲的 48 个 Unit 编排：16 个组合均按原生 `IdolUnitSortOrder` 排列，其中 30 个编排纠正了编号排序。固定曲的 13 首显式序与 41 首默认序保留。

## 原生调用链

只读 Ghidra 重新反编译同一 ELF，SHA-256 `9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e`。

1. `Growing.VocalSettingUnitListPopupContent.OnClickButton` (`0x238551c`) 确认已解锁 Unit 后，取当前 UserDeckData 与选中 SongRemixIdolUnitData，构造 `VocalSettingIdolUnitEditData`。若前 N 张库存卡改变，会先展示原生编队调整确认，再把 editData 回交；不是一段未使用的辅助逻辑。
2. `VocalSettingIdolUnitEditData.ctor` (`0x238255c`) 从所选 remix 取得 IdolUnitData，读取组合成员，再调用 `BuildDeckFromIdolUnitData` (`0x2382604`)。
3. `SplitCards` (`0x2382944`) 将已有卡组分成组合内、组合外。同一组合成员有重复卡时保留 totalAppeal 更高的一张，另一张移到其他卡列表；它不以该卡片编号决定最终成员顺序。
4. `FillIdolUnitCards` (`0x2382f70`) 检查组合内每个成员，缺少时通过 `UserCardData.GetDataByIdolId` 补入。随后明确调用 `List.Sort` (`0x30977e0`)，委托指向 `<FillIdolUnitCards>b__7_0` (`0x228d200`)。
5. 该 comparator 对左右卡片取 idolData，读取 `IdolData + 0x30`，返回 `Math.Sign(leftOrder - rightOrder)`：对应已核实的表2字段37 `IdolUnitSortOrder` 升序。不是通用 SortOrder (`+0x100`)，也不是 totalAppeal。字段及 ELF 身份与[固定曲来源复核](NATIVE_ORIGINAL_LINEUP_AUDIT_20261021.md)一致。
6. 组合外卡片另按 totalAppeal 降序，`FillNoneIdolUnitCards` (`0x23832dc`) 仅追加至原 deck 长度，不打乱前面的组合成员。`CompareDeck` (`0x23827e8`) 比较前 min(组合人数, 原deck长度) 张卡的字符串 `UserCardData.Id`（`+0x18`），不是 idol ID；同一偶像换了一张库存卡也会触发确认。外层 `VocalSettingPopupContent.OnClickButton` (`0x2384054`) 提交输出 deck，并设置 UnitSwitchSinger。

因此，无论同一偶像选用哪张库存卡，只要组合成员完整，演出成员前 N 槽的顺序均由字段37决定。网页这次只落实可由现有 49 人模型目录表达的成员槽序；没有模拟库存、totalAppeal、卡片替换确认或 DeckService 网络写入。

本机证据位于 `.analysis/lineup-audit/decompiled-vocal-unit{,_annotated}`、`decompiled-unit-confirm`、`decompiled-vocal-apply`；额外检查了选组回调，但该回调只负责切换 toggle，真正构造 editData 的入口是 UnitList 确认按钮。未将静态反编译写成原设备执行证明。

## 导出与接入

沿用舞台专用 `stage-original-lineups.json`，升级为 `schemaVersion:2 / native-original-lineups-v2`，新增 `unitOrders`。16 个组合的 49 人都直接来自挂载 PB 表2字段3/37和表24资源码；`prepare-live-chibi-original-lineups.py --check --native-elf ...` 已重新核实。未手填组合顺序。

索引现为 12,526 bytes，SHA-256 `e0f1b52eeddfd2b98c8244d87e4e6fd272e5717f44e4c041f301c9263065c7db`。原有固定曲数据逐项继续验证，原发布依赖闭包仍包含本文件（4份索引+438份分片）。

`originalMemberSelection` 对 Unit 变体读取 **所选 unitCode** 的顺序，basis 为 `table2-selected-unit`；不读取歌曲本体的显式名单。helper 同时要求该顺序与当前正式成员目录完整匹配，缺失/重复/外来成员不能静默退回编号排序。页面提示“所选组合按原生槽序排列，可调整”。

切换 Unit 仍保留用户当前编队，点击“原曲成员”才应用来源阵容；这保留了网页原有操作约定，没有在切歌时擅自覆盖手选成员。自由编成、Center 和特殊版本继续不造固定原曲阵容。

## 验证

- 挂载源重导出检查：13首显式、41首固定默认、16组所选Unit顺序全部一致。
- 便携回归：全部48个Unit脚本、16组合正式成员集合、30项排列差异、原54首固定曲、缺失/非法顺序拒绝、歌唱变体隔离，以及实际SFC computed的Altessimo结果。既有panel回归亦通过。
- `npm run verify:source-batch`：164/164通过；随后增加的实际SFC Unit断言已单独重跑通过。
- `npm run build:check`：2979 modules / 19.34s，入口gzip 206056 / 215040。输出仅 `.analysis/build-check`，没有public全量复制。日志及审计副本：`.analysis/lineup-audit/unit-{source-batch.log,build.log,build-audit.json}`。
- 实际Browser 5213：DRIVE Unit S.E.M 的2/3/4位为次郎/类/道夫；同曲下拉切到Altessimo后应用为2/3位圭/丽，中心丽。390×844时文档与滚动宽度均390；播放推进至39秒后暂停。High×Joker五人应用后为旬/隼人/四季/夏来/春名，中心四季。
- 再从曲库切到固定曲 `∞ Possibilities` 应用成员，2/3/4位为次郎/道夫/类，中心道夫，basis恢复逐曲显式序。临时检查页console error为0（保留已有Pixi/Spine警告）。截图 `native-selected-unit-sem-desktop.png`、`native-selected-unit-alt-mobile.png`、`native-selected-unit-highjoker.png` 及console在本机Codex visualizations目录。

检查期间共享页切到了另一首固定曲，后续五人/固定曲验证在独立临时tab完成，结束已关闭。viewport恢复默认。5213进程仍为PID50348；read-model候选/release未切换，没有重启服务、R2上传、master合并或部署。

成员槽序的来源与消费者接线已闭合；原片/真实设备对照、库存卡选择及完整游戏编队交互仍不是本次验收范围。
