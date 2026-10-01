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

后续已对 IPA Unity 内置资源完成 [原始音符贴图核实](GS_SONG_NATIVE_NOTE_SPRITES_20261001.md)，并新增 [五轨透视与长条预览](GS_SONG_FIVE_LANE_HOLD_PREVIEW_20261001.md)：透视视图使用原始音符与长条 PNG，保留本篇的长轨示意图。原生 LaneCount=5 已核实；默认皮肤编号、SP / P 技能映射、运行时相机 / Shader / UV 仍待核实。

附件仅为研究参考。核对 [pjsekai-scores-rs 项目仓库](https://github.com/Team-Haruki/pjsekai-scores-rs)和 MIT LICENSE 后，它是社区 SUS / JSON 渲染器，而非 SideM 官方工具；本实现不引入该项目、不转换为 SUS，也不根据附件推断资产授权。

## 验证记录

来源与结构验证：`python scripts/verify-song-gameplay.py` 对原始 PB、native enum 文件偏移字节、schema 字段、61 首歌对应的版本以及 Unity 原始谱面逐一重建对比。原始未知音符 / 控制点不支持时明确失败，不悄悄丢弃。

展示行为验证：`node scripts/verify-song-chart-presentation.mjs` 检查 244 档、滑条几何端点、全部控制点、Flick 尾部、BPM 变化、错误歌曲 / 难度、未知类型、重复源对象和损坏控制点拒绝。另运行歌曲目录来源检查及已有歌曲 Stage 投影回归。

以上检查均通过；`node scripts/verify-song-catalog.mjs --source-only`、`python scripts/verify-song-masterdata-mappings.py`、`node scripts/verify-song-timelines.mjs` 和 `node --test readmodels/tests/song_stage_projection.test.mjs` 也通过。展示检查覆盖 3,839 条滑条路径、1,585 个 Flick 尾部及各难度合计 36 处 BPM 变化。

只读模型从已提交输入 `0f1ebbd4` 生成，候选路径 `E:/Web_build/GS_Archive_Domain_Work/song-gameplay-readmodels-20261001`，release `17e0ab0b227d6f2bb433f0c1cfaf3934fcccbc2cd420387adc95af9fc4c7a907`。8,750 个模型、76,620,057 解码字节，bootstrap 14,344 字节；`verify_artifacts.mjs` 逐一通过。已绑定主仓库 bootstrap 和路线账本，原有全局 partial / 设备 pending 保持不变。

使用既有独立工作区 `E:/Web_build/GS_Archive_Domain_Work/song-attribute-qa-20261001/web_viewer`；代码 HEAD `e372d658`。`npm run build:check` 与 `npm run verify:build-audit` 通过（progress 模式）。首次截图显示手机前奏空轨较长，补上默认定位首个音符及返回按钮后，复用同一固定构建目录重建并完成复验。两次均 `copyPublicDir:false`，没有 public 语料副本，主工作区构建目录未覆盖。

Browser 插件在本任务不可用，按前端验收技能使用已有 bundled Playwright Chromium；未安装额外依赖。生产代码服务 `http://127.0.0.1:5200/` 映射上述候选及主仓库已有 public / 外部 RAW 资源。真实桌面 1440×1000、手机 390×844 已验证：

- BRAND NEW FIELD：打开前零谱面请求；四档切换、缩放、长轨滚动、首个音符定位与实际完整 SVG 文件下载。
- Growing Smiles！：剧情解锁；はるかぜバトン：难度差异处理；運命光年：普通曲日期待办；特殊版 DRIVE A LIVE：2022 首次日期及 PASSION；Infinite Octave!：多 BPM 展示。
- 注入一次 502 后重试成功；有效 JSON 篡改体被 SHA-256 / 字节数拒绝，恢复源文件后重试成功；在 EASY 延迟请求期间切换 HARD，旧请求不覆盖新难度。
- 手机五轨全部可见且无页面横向溢出；长轨独立滚动、首屏即见音符。桌面及手机截图已人工查看。

Browser receipt 中零非预期错误、零警告、零非预期 HTTP 失败；仅一次预期注入 502。脚本、截图、下载文件、HTTP 记录与 `gameplay-browser-receipt.json` 均在 `E:/Web_build/GS_Archive_Domain_Work/song-attribute-browser-20261001`，与此前属性批次的独立文件名并存。

谱面 JSON 使用窄范围 `text eol=lf`，避免 Windows checkout 换行转换破坏 descriptor 的 SHA-256。`npm run verify:cutover-routes` progress 检查通过；全局迁移、原游戏完整一致性、真实物理设备及部署均未获本次验收。
