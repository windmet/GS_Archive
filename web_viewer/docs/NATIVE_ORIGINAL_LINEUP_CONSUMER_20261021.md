# 固定曲原曲成员默认槽序接入（2026-10-21）

输入 `922bbf1e`，仍在 `stage/20261020-native-followup`。依据 [原生链路复核](NATIVE_ORIGINAL_LINEUP_AUDIT_20261021.md)，舞台已接入 13 首逐曲显式序和 41 首固定组合默认序，并修复 `yknkmh` 的隐藏槽校验。54 首固定阵容均可映射；24 首组合曲的编号回退被纠正，另 1 首原先不能应用的 FRAME 阵容已可用。

## 来源与消费者

`scripts/prepare-live-chibi-original-lineups.py` 从挂载 PB 的表 2、24、46 导出 `public/data/stage-original-lineups.json`。字段 37 只用于没有逐曲显式顺序的 Unit selector；字段 30–34 的显式顺序优先。资源级 SongData 身份采用既有 song_catalog 相同的最后一行，早期无名单的 alternate difficulty 行不会覆盖新行；冲突的非空名单拒绝导出。

新索引保留 PB / schema / 已审计 ELF 的 SHA-256、表字段来源、有效 SongData ID、成员及顺序 basis。11,307 bytes，SHA-256 `39f99d845b0f5ab20d77f346fca84d8843d5b608f16b509f850159404a64acb7`。没有手写逐曲排列。

加载链为 `fetchLiveChibiOriginalLineups` → source/row validator → SFC computed 选择来源 → `buildOriginalStageLineup` → 原曲成员按钮 → 实际人物重建。新索引与音乐/原生时钟并行读取，作为该阶段必需输入；未添加串行读取阶段。来源不合法或缺失会走现有初始化错误路径，不把错误来源标成原生名单。

这里采用舞台专用投影，而没有修改公共歌曲 `performance_mapping` 或 bootstrap 成员字段，因此不需要重建或切换冻结 read-model。5213 的候选仍为 `E:/Web_build/GS_Archive_Domain_Work/rm-release-20261015`、release `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`；其他页面的成员目录语义保持名单展示。

隐藏槽只对有原生固定组合默认来源的输入开放：完整映射全部保留且必须有效，出演槽须为原生自动编队填入的 1..N，不允许把成员平移到任意槽。`yknkmh` 保留五槽映射，取三个出演槽后映射至画面 2/3/4 位；1/5 位不造成员。

## 验证

- `python scripts/prepare-live-chibi-original-lineups.py --check --native-elf E:/Tools/ghidra_work/sidem/libil2cpp.decrypted.so`：与当前挂载 PB、schema 及审计 ELF 一致；13 首显式、41 首默认。
- 新 portable verifier 覆盖全部 54 首真实歌曲 metadata、成员集合/有效 SongData ID、24 个更正、隐藏槽及非法隐藏映射、非连续出演槽拒绝、逐曲显式优先、非固定曲/歌唱变体排除、实际 SFC computed 声明和真实 loader 的 URL/options 接线。不是只验证孤立排序函数。
- `npm run verify:source-batch`：164/164 通过。随后收紧“自动编队只填 1..N 槽”的保护并加入漏发新索引的负例，对新 verifier、既有 panel verifier 和发布依赖 verifier 重跑通过。
- 最终 `npm run build:check`：2979 modules / 20.25s；入口 gzip 206046 / 215040 bytes。源码输入为 `922bbf1e` 加本批未提交改动。输出 `.analysis/build-check` 不含 public 复制，不是完整媒体包。自动生成的资源/翻译审计元数据未纳入本批提交。
- 新索引加入舞台发布依赖闭包：4 份索引 + 438 份分片，共 442 个必需文件；漏掉新索引也会拒绝打包。没有新增分片或修改旧媒体。

实际 Browser dev 5213：

1. Café Parade 点击原曲成员并完成重建：画面 1..5 为卷绪、幸广、阿斯兰、庄一郎、咲；中心阿斯兰，提示“按组合默认槽序”。20s seek 后可播放至 23s 以上并暂停。1280×800、390×844 均检查，手机 scrollWidth/clientWidth 均 390。
2. `∞ Possibilities` 点击原曲成员：画面 2/3/4 为次郎、道夫、类，保留逐曲中心道夫，未采用组合默认中心类。
3. `勇敢なるキミへ` 点击原曲成员：实际完成三人重建，画面 2/3/4 为龙、英雄、诚司，1/5 位休息。退出后 `/songs/yknkmh/?maintainer=1` 真实详情、1:50 音频及 75/180/336/485 Combo 表已载入；再由详情按钮返回舞台。
4. 原 5213 进程 PID 66480 的 public 文件集合未包含新建索引，HTTP 实测返回 HTML，Browser 因而失败。本批只重启该已核实进程，保持同端口及显式候选；新 PID 50348。重启后新索引返回 application/json，合同正确。17:42:52 UTC 后捕获的 console error 为 0；保留了之前失败的历史日志，没有把它们抹成零错误。

日志/回执在 `.analysis/lineup-audit/implementation-*`；截图和 console 在本机 Codex visualizations 目录：`native-original-cafe-desktop.png`、`native-original-cafe-mobile.png`、`native-original-frame-hidden-slots.png`、`native-original-lineup-console.json`。viewport 已恢复默认。

## 保留的边界

48 个全体曲 Unit 编排继续走现有独立规则；原生选组调整已有卡组的路径还未完整复现，不把 MV 自动原曲编队规则直接套进去。自由编成、中心演唱和 `drv999` 不制造固定阵容。原片/真实设备的站位逐帧对照仍未完成。

本批没有 PR、master 合并、R2 上传或部署。后续发布必须携带新索引；本地 5213 dev 成功不等于冻结候选或线上已更新。
