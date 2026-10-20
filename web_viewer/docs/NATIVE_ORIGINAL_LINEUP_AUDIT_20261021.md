# 原曲成员载入与站位链路复核（2026-10-21）

输入 `3a357bd0`，分支 `stage/20261020-native-followup`。本批只核对来源、消费者和现有行为，没有修改阵容实现、公共数据、read-model、端口或部署。

## 结论

“只有 13 首有原曲顺序”准确描述了 **SongData 的显式记录数量**，但没有覆盖原客户端的组合默认编队规则。原生自动编队在显式原曲名单为空、Singer 类别为 Unit 时，通过 `AutoDeckBuilder.GetSortedIdolList` 按 **IdolData.IdolUnitSortOrder（表 2 字段 37）升序**取成员；不是按偶像编号。当前网页没有把这条来源接入原曲成员排列。

| 当前 61 首目录的范围 | 数量 | 结论 |
|---|---:|---|
| 有逐曲显式顺序 | 13 | 表 46 字段 30–34，继续优先保留 |
| Unit selector | 47 | 其中 6 首有显式顺序，其余 41 首可取得原生组合默认序 |
| 上述 41 首中默认序不同于编号序 | 24 | 当前网页会排出不同的成员槽序 |
| 上述 41 首中现有 helper 可生成阵容 | 40 | `yknkmh` 另受隐藏槽位 guard 阻挡，见下文 |
| 无显式顺序且非固定 Unit | 7 | 不能补成一个固定原曲阵容；包括全体/自由编成、特殊版本 |

13 首逐曲记录中 6 首组合曲的顺序 **全部不同于对应组合默认序**：`jfhtmk`、`mtples`、`pavetl`、`psblts`、`steqmg`、`tibeti`。因此字段 37 只能补默认分支，不能覆盖显式逐曲顺序。

## 原生证据链

来源 ELF SHA-256 `9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e`；挂载 PB SHA-256 `25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1`。使用本机已有只读 Ghidra 工程重新反编译相关函数，并对照 dump 字段和泛型实例 RVA；没有运行原 Unity Player。

1. `SongData.GetSongOriginalMemberIdolIds` 的迭代器 `MoveNext`，RVA `0x1cd45a4`，顺序读取对象 `0xd0/0xd8/0xe0/0xe8/0xf0`，即 SongOriginalMemberIdolId1–5。`get_originalMembers` (`0x25ca348`) 构造该名单。
2. `AutoDeckBuilder.SelectCardByOriginalMember` (`0x2095158`) 先取 originalMembers；通过 `IListExtensions.IsNullOrEmpty` (`0x1be3e6c`) 判断空名单。为空且 Singer.Category 为 2 时调用 `GetSortedIdolList(Singer.Id)`，再交给 `SelectCardByIdolUnit`。不是任意空名单都按某个组合补齐，类别 1/其他分支不能混用。
3. `GetSortedIdolList` (`0x2094a60`) → `IdolUnitData.GetIdolDataList` (`0x1fc6600`) → `IdolData.GetDataListByIdolUnitId` (`0x2245dcc`)，随后 `Enumerable.OrderBy<IdolData,long>` (`0x1bc728c`)。排序 lambda (`0x1f00664`) 读取 `IdolData + 0x30`；`get_IdolUnitSortOrder` (`0x224324c`) 与 dump 均确认该字段。不是通用 SortOrder (`+0x100`)，也不是显示名或资源编号。
4. `SelectCardByIdolUnit` (`0x2094be8`) 从持有卡组选择成员并按输入 idol list 中的位置排序；lambda (`0x1f007cc`) 取 `List.IndexOf(idolData)`，随后 `Enumerable.OrderBy<...,int>` (`0x1bc7218`)。卡片能力/稀有度选择和不足人数补卡是原游戏库存分支，网页不应凭此补造成员。
5. `BuildLiveDeck` (`0x20947b4`) 依序把结果写入 `UserDeckData.slotDataList`；`LiveDeckData.Setup` (`0x1d68ab8`) 顺序投影为 liveDeckSlots。`LiveObjectIdol.LoadFigure.MoveNext` (`0x1bbe610`) 用序列化 `_slotIndex` (`+0x48`) 索引 `liveData.liveDeckData.liveDeckSlots`，读取该槽成员和衣装。它没有再按偶像编号排序。

本机反编译及 census 在 `.analysis/lineup-audit/`；已有载入函数证据同时见 `.analysis/ghidra-il2cpp/decompiled_pass3_annotated/LiveObjectIdol._LoadFigure_d__46.c`。泛型函数仅凭反编译形状容易认错，本批另对 dump.cs 的实例 RVA 核实 OrderBy、Select 和 IsNullOrEmpty，不能沿用临时猜测的函数标签。

## 组合默认槽序

挂载表 2 的 49 人、16 个组合，字段 37 均为各组合内唯一连续的 1..N。

| 组合 | 字段 37 升序（偶像资源编号） |
|---|---|
| Jupiter | 001、002、003 |
| DRAMATIC STARS | 004、005、006 |
| Altessimo | 008、007 |
| Beit | 010、009、011 |
| W | 013、012 |
| FRAME | 014、015、016 |
| 彩 | 017、019、018 |
| High×Joker | 024、020、022、021、023 |
| 神速一魂 | 026、025 |
| Café Parade | 029、027、028、030、031 |
| もふもふえん | 032、033、034 |
| S.E.M | 036、037、035 |
| THE 虎牙道 | 038、039、040 |
| F-LAGS | 041、043、042 |
| Legenders | 045、044、046 |
| C.FIRST | 047、048、049 |

这张表是 **编队/performer 槽序**，不能直接当画面从左到右的排列。

## 网页消费者与当前缺口

当前链路为 `music_catalog.performer_slot_order` → `generate-song-catalog.py` → `performance_mapping.performer_slot_idol_codes` → songs.detail read-model → `useStageSongProjection` → `ChibiStageViewer` → `buildOriginalStageLineup` → `applyStageLineup`。

- 固定组合曲从歌曲目录的 performer_idol_codes 取得成员，缺显式槽序时目前为编号序；48 个全体曲 Unit 编排则从 idolDirectory 按 unitCode 取成员并排序编号。这是两条不同的消费者分支，不能把“47 首固定组合曲”与“48 个 Unit 编排”混为一个计数。
- 当前 5213 候选 release `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3` 的实际 detail JSON 复查：Café 的显式槽序为空，jfhtmk/psblts 保留逐曲顺序。不是 Browser 没刷新导致字段丢失。
- `buildOriginalStageLineup` 按 performerSlot 升序关联成员，再用 stagePositionMap 映射画面位置。Café 的映射为槽 1→位3、2→位2、3→位4、4→位1、5→位5。当前画面位置1..5为卷绪、庄一郎、幸广、阿斯兰、咲；代入原生默认序后应为卷绪、幸广、阿斯兰、庄一郎、咲。这是当前脚本映射下的计算结果，尚非原片逐帧对照验收。
- `yknkmh`（FRAME）有 5 个脚本槽、3 个在场槽。它走固定曲分支，该分支要求 map.length 与 positions.length 相等，所以当前和默认序候选都返回 null。要同时处理完整 5 槽映射与 3 个有效出演槽，不能通过删除隐藏槽伪造通过。
- 切歌保留用户编队；“原曲成员”按钮才应用候选阵容。曲名正确但仍看到上一首成员并不等于原曲名单源错误。

7 首非 Unit 且无逐曲名单为 `byndtd`、`drv999`、`drvalv`、`grwsml`、`reason`、`tkstp1`、`tkstp2`。它们的已选 Unit 编排可以取得对应组合默认序，但原生 VocalSettingIdolUnitEditData 另有“调整已有卡组”的路径；本批没有把该路径与 MV 自动原曲编队视为等价，也没有给自由编成或特殊单人版本造固定阵容。

## 验证与后续实现边界

- 挂载原始 PB 清点：99 条 SongData / 61 首资源、20 条带成员字段记录 / 13 首独立歌曲；49 个 IdolData 的字段 37 完整。
- 代入现有真实 helper、角色 manifest 和 bootstrap 目录：41 首固定 Unit 回退中 40 首生成候选，24 首位置数组改变，1 首被上述隐藏槽 guard 阻挡；48 个 Unit 编排均可生成默认序候选。这是候选计算，不是已经接入页面。
- `python scripts/verify-song-masterdata-mappings.py` 和 `node scripts/verify-chibi-panel-presentation.mjs` 通过。后者目前仍验证旧编号回退，**通过不表示原生默认序已实现**。
- 本批纯审计文档，不重建应用；前一批 master 同步编译和 Browser 记录见 [同步记录](STAGE_MASTER_SYNC_20261021.md)。本批没有原设备、原片或新阵容 Browser 验收。

后续实现需要在派生数据中保留字段 37 的来源，采用“逐曲显式序优先、固定/已选 Unit 的原生默认序其次、无可靠来源则保持未知”的规则；同步处理固定曲隐藏槽 guard、来源标识、read-model 重建与实际 Browser 原曲成员应用。不能仅改前端排序或把默认序写进 table46 显式字段，也不能声称修改本地 JSON 就更新了 5213 的冻结候选。
