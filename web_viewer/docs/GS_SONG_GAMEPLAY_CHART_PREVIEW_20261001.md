# 歌曲玩法信息补齐与长轨谱面预览

输入 HEAD：`584c837b`。范围为歌曲元数据及只读谱面预览；保留另一窗口的前端工作和称号收口状态。

## 已落实的来源与展示

- 61 个歌曲资源：保留既有 table 46 最后一条资源映射，连接对应 `SongDifficultyGroupId`，取得 244 档难度、等级与最大 Combo。99 条 SongData / 396 条 SongDifficultyData 的其他映射保留为 `alternateGroups`，不混用版本。
- 等级及最大 Combo 使用原始 PB table 47；字段含义和枚举用 iOS `global-metadata.dat` 与本地 IL2CPP schema 核对。审计见 `config/song-gameplay-native-audit.v1.json`。
- 首次实装日期及历史解锁来自 [Wiki 歌曲列表](https://wikiwiki.jp/sidem-gstars/楽曲一覧)，以 `config/song-release-evidence.v1.json` 留存。历史活动先行、加入普通歌曲日期与当前 PB 的 AlwaysReleased 分开，不把 2000/2100 哨兵或复刻日期当成首次实装。
- 三首主线解锁歌同时核对 PB 的 `ReadMainStorySection = 102`、章节及节 ID，并展示至 EPISODE10 的阅读要求。
- 特别版 DRIVE A LIVE 首次为 2022-04-01；当前 PB term 为 2023-04-01 复刻窗口。[2022 年愚人节页](https://wikiwiki.jp/sidem-gstars/エイプリルフール2022)明确两次窗口。第一轨组展示 PASSION / Lv ? / 最大 Combo 445，原始内部 level 21 保留在数据，不直接当作游戏显示等级。
- `はるかぜバトン` 列表 EASY 9 与 PB / [单曲页](https://wikiwiki.jp/sidem-gstars/はるかぜバトン) EASY 6 不一致，采用 PB 和单曲页；原列表值及解决依据同时保留。
- 唯一历史日期待办：《運命光年》首次实装 2023-03-20 已补；活动结束后加入普通歌曲，但确切普通曲开放日期未取得，明确标记待核实。

## 本地谱面与复刻边界

61 个 `RAW/asset/song_<code>.unity3d` 均有 `<code>_fumen` TextAsset。实际是 SideM 原生 JSON，含 track、tick、tempo、duration、start / end、endtype 及 poly 的 subtick / 浮点 posx。研究附件讨论的 Project SEKAI `.sus` 不能直接用于这些文件。

目前生成 244 档可展示谱面、另保留 4 个未映射轨组，共 248 个小 JSON 分片及一个 manifest，约 8.1 MB；没有复制音频或 Unity bundle。所有 67,850 原始音符对象均保留 sourceIndex。四档共有 66,666 个对象，额外轨组共 1,184 个对象。

轨道 1–20 按每五条轨道划分 Easy / Normal / Hard / Expert，特殊版第一组为 PASSION。所有对象满足 `start = (track - 1) % 5`。这是文件结构与四档主数据支持的适配规则；尚未完成原生运行方法的反汇编确认。Café Parade!、想いはETERNITY、Pavé Étoiles、Plus 1 Good Day! 另有 21–25 轨道，每组 296 个对象，未与任何第五档主数据对应，其用途保持待办，不虚构额外难度。

预览使用五轨 SVG、向下增长的原始 tick 纵轴。展示 Tap、宽音符、Flick、Special、长按和滑条、长条尾部 Flick、BPM 变化；滑条保留全部控制点，包括小数轨道位置。没有用 `end` 字段覆盖 poly 实际端点。支持懒加载、难度切换、三档纵向缩放、完整 SVG 导出及校验失败重试。

对象数与最大 Combo 计数不同，页面分别标明。此版尚不复刻原游戏判定规则、透视、速度参数、Shaders、原始 note 皮肤或动态播放。tick 每拍比例、offset 单位及音频对齐仍未验证，所以不推算毫秒，不声称与试听同步。

附件仅为研究参考。核对 [pjsekai-scores-rs 官方仓库](https://github.com/Team-Haruki/pjsekai-scores-rs)和 MIT LICENSE 后，它是社区 SUS / JSON 渲染器，而非 SideM 官方工具；本实现不引入该项目、不转换为 SUS，也不根据附件推断资产授权。

## 验证记录

来源与结构验证：`python scripts/verify-song-gameplay.py` 对原始 PB、native enum 文件偏移字节、schema 字段、61 首歌对应的版本以及 Unity 原始谱面逐一重建对比。原始未知音符 / 控制点不支持时明确失败，不悄悄丢弃。

展示行为验证：`node scripts/verify-song-chart-presentation.mjs` 检查 244 档、滑条几何端点、全部控制点、Flick 尾部、BPM 变化、错误歌曲 / 难度、未知类型、重复源对象和损坏控制点拒绝。另运行歌曲目录来源检查及已有歌曲 Stage 投影回归。

构建、只读模型绑定与 Browser 验收结果在完成后补记。日常构建固定 `.analysis/build-check`，不复制 public 语料；该验收不构成完整媒体包、部署或物理设备验收。
