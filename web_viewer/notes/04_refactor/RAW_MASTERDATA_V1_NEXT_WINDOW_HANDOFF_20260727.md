# RAW + Masterdata v1 基线：新窗口完整交接

更新时间：2026-07-27
仓库：`E:\Web_build\SideM_Archived`
应用目录：`E:\Web_build\SideM_Archived\web_viewer`
基线提交：`0ba566ffa6e24442c177279f3429115846e6821c`
当前分支：`codex/post-merge-story-handoff`
远端：`https://github.com/windmet/GS_Archive.git`
当前 PR：Draft PR #2，`codex/post-merge-story-handoff -> master`

## 0. 新窗口先读这里

`0ba566f` 可以作为 RAW + masterdata 迁移阶段的 v1 基线。它已经在
GitHub 上，且该提交对应的 `Web Viewer Source Gate` 已于 2026-07-27
成功完成。

但“v1 基线”目前是项目约定，不是 Git tag：

- `0ba566f` 是后续源契约和文档提交的祖先，不再等同于当前 HEAD；
- 当前没有指向 `0ba566f` 的 tag；
- Draft PR #2 仍然打开，尚未合并；
- 不应把 `master` 当成这个迁移基线。

新窗口开始后，不要立即提取或发布资源。先在仓库根目录执行：

```powershell
Set-Location E:\Web_build\SideM_Archived

git status -sb
git rev-parse HEAD
git rev-parse origin/codex/post-merge-story-handoff
git log --oneline --decorate --max-count=8
git branch --show-current
git merge-base --is-ancestor 0ba566f HEAD

try {
  $response = Invoke-WebRequest -UseBasicParsing `
    'http://127.0.0.1:5174/?view=event_detail&event=410011&noAudio=1&runtimeDebug=1' `
    -TimeoutSec 10
  "5174=$($response.StatusCode) bytes=$($response.RawContentLength)"
} catch {
  "5174 unavailable: $($_.Exception.Message)"
}
```

接受继续工作的最低条件：

1. 当前提交、远端提交和预期基线已核对；
2. 工作区中的任何未提交文件都已辨明归属，不能覆盖用户改动；
3. 知道本次工作属于下面哪一个有界阶段；
4. 如果需要浏览器验收，5174 已启动且目标页面返回 200；
5. 如果需要真实音频验收，先确认 IDM 或其他下载接管工具不会拦截媒体。

### 0.1 源契约第一小批已经落地

以下能力已经实现，不再只是规划：

- `data_pipeline/archive_paths.py`：统一加载 source config；
- `web_viewer/config/archive_sources.example.json`：无个人路径的提交示例；
- `web_viewer/config/archive_sources.local.json`：本机配置，已被 Git 忽略；
- 配置优先级：
  explicit tool argument -> `--sources-config` -> environment -> local ->
  repository defaults；
- `raw_source_manifest.py` 已接入配置，同时保留 `--raw-root` 最终覆盖；
- manifest 输出禁止位于 RAW 内部；
- manifest schema 升到 v2，并记录 section bytes、manifest hash、
  content identity、大小写路径冲突、非法派生文件和 masterdata hash；
- `masterdata_extract.py` 新增显式 `--input-state xor|decoded`，默认行为仍是
  `xor`；
- source-only fixture 会验证 CLI override、RAW 只读边界、两个 masterdata
  状态、hash mismatch 拒绝和 decoded 不被二次 XOR；
- GitHub Source Gate 已增加 `verify:archive-sources`。

真实 RAW 重建结果：

```text
file_count: 13,000
total_size: 8,232,049,221
old/new relative_path + size + SHA-256 identity: equal
case-insensitive duplicate paths: 0
unexpected files: 0
RAW WAV: 0
manifest SHA-256:
b1bcccfd89b31cf06e255ab8f65be7029ff114502b9a492e56a98cd904f60a1c
content identity SHA-256:
911de151d6ced2259c8065047da3ea20d9f5795c2f5a09bb109174a30d256e24
```

masterdata CLI 双路径回归也已通过：

- XOR source + `--input-state xor`；
- decoded PB + `--input-state decoded`；
- 两条路径输出的 decoded PB hash 都是 `25D48A...F0EA1`；
- 两条路径输出的 base `music_catalog.json` hash 都是
  `4B31F278...F9E7`。

### 0.2 首组三个资源域也已接入

以下六个工具已不再各自定义 RAW/public/inventory 默认根：

```text
audit_raw_card_coverage.py
extract_raw_card_candidate.py
audit_raw_background_coverage.py
extract_raw_background_candidate.py
audit_raw_character_resources.py
extract_raw_character_image_candidate.py
```

它们统一通过 `archive_paths.py` 取得：

- RAW root；
- `public/data/masterdata`；
- `public/data/compiled`；
- `public/assets`；
- `.analysis/raw-migration` inventory/candidate root。

所有原有显式参数仍是最终覆盖。真实无参数回归结果：

- card：836 master rows、826/826 唯一资源，旧/新报告除时间外相同；
- background：394 RAW bundles，catalog 192/192、story 356/356；
- character：57 image bundles、485 unique paths，旧/新报告除时间外相同；
- card candidate `001tom_r01`：8 textures、8 sprites、8 resolved；
- background candidate `bg001_315pro_in_01`：
  2 textures、2 sprites，resolved SHA-256
  `a2ae5b2637082928b30da11c824c2259623aec3f07bbc4c590632b311f340d65`；
- event visual candidate `002sht`：`475x783`，SHA-256
  `a83344e535e4292a8f0b1dac5d3c3b9951d0a05c32c5fc225dc5eea501fc0631`。

旧 background 报告生成于 2026-07-26。和当前报告相比，唯一非时间差异是
`bg091_315prolounge_in_01` 的 compiled reference count 从 6,730 变为
6,768；所有 ID 集合、覆盖率和缺口不变。这是当前 compiled corpus 相对旧
报告的计数变化，不是配置路径改变。

### 0.3 RAW 音频来源契约批次已接入

提交 `8f94e64` 已把以下六个音频工具接入 `archive_paths.py`：

```text
audit_raw_audio_coverage.py
index_raw_audio_cues.py
compare_raw_audio_cue_variants.py
extract_raw_audio_candidate.py
extract_raw_acb_sequence_candidate.py
audit_master_bgm_selector_mapping.py
```

本机忽略配置现在同时保存 `vgmstream`、`ffmpeg`、`ffprobe` 路径；提交的
example 均为 `null`，没有个人可执行文件路径。所有原显式 CLI 参数仍是最终
覆盖。`audit_master_bgm_selector_mapping.py` 另外增加
`--master-data-state xor|decoded`，默认仍是 `xor`。

真实无路径回归结果：

- RAW audio：4,098 files = 4,055 ACB + 43 AWB；
- compiled JSON：10,329；
- story SE：435/435 classified，433 waveform + 2 control-only；
- cue index：4,055 banks，本轮复用缓存、0 newly indexed；
- ambiguity：13 cues，12 equivalent，`waribashi` 是唯一 distinct sequence；
- master table 133：56 rows，92 BGM 全部分类，0 unresolved，0 anomalies；
- XOR source 和 decoded PB 显式双路得到相同的表 133 分类结论；
- `usual_day` 必须通过 cue index 关联到 `usual_day.awb`，不能把同名
  `usual_day.acb#1` 当成可解码波形；
- `usual_day` candidate SHA-256：
  `04c03f225747e651fd6554ad44f898241f6ca1dd43027c65f0c19439c584cbc1`；
- `waribashi` composite SHA-256：
  `5ac8038ad35e7afd0ecf632301661c128ebf3f4d466fb5508d03dbd3942cc521`；
- RAW 最终仍为 13,000 files，WAV 0。

5174 上两条 M4A candidate 与两条 JSON manifest 均为 HTTP 200。首页正常
渲染，活动轮播从 1/36 前进到 2/36；观察到两条既有 Pixi Spine warning，
无错误 overlay。浏览器客户端阻止了把 M4A 作为顶层页面直接打开，因此媒体
HTTP 证据与页面交互证据分开记录。本批没有 publish，也没有修改稳定音频 URL。

### 0.4 RAW story 来源契约批次已接入

提交 `33d84b7` 已把以下三个 story 工具接入 `archive_paths.py`：

```text
audit_raw_story_coverage.py
audit_raw_story_voice_gaps.py
extract_raw_story_candidate.py
```

默认来源现在是：

- configured RAW；
- `.analysis/raw-migration/source/files.jsonl`；
- `.analysis/raw-migration/audio/cue-index/cue_index.json`；
- `public/data/compiled`；
- `public/assets/voice`；
- `.analysis/raw-migration/story` 或 scenario-specific candidate 目录。

旧整理 `story_viewer/voice_ogg` 不进入默认来源链，只保留显式
`--legacy-voice-root` parity check。真实回归结果：

- coverage size 4,268,890 bytes，SHA-256
  `347d92db9aadde5205413873e8c023b05234fadee0550256147a64d006c9582b`，
  与改前逐字节相同；
- 1,435 bundles、4,942 TextAssets、3,398/3,398 groups、70,652 steps；
- public identity 覆盖 4,939/4,939 valid RAW parts；
- voice 26,890/26,902 resolved，3,234/3,234 banks 有 lipsync；
- 12 unresolved 在不读旧包和显式读取旧包时都为
  `raw_authored_dangling`；
- standalone candidate `1_x_001tom_2_1_2_001_12`：20 steps、1 episode、
  3 ACB、3 lipsync、15/15 voices；
- candidate 与当前 public story 忽略 provenance 后语义相同，零差异；
- RAW 最终仍为 13,000 files，WAV 0。

5174 candidate JSON 为 HTTP 200。实际 player 显示 EP01、两个 Spine
（`002sht`、`003hok`）和日文台词；点击 `次へ` 后 3/18 前进到 4/18，
Shota 台词切换到 Hokuto 台词。无 blank page、无 framework overlay；
仍只有两条既有 Pixi Spine warning。本批没有 publish，也没有修改稳定剧情。

### 0.5 Vite legacy 来源路径已退出 tracked 个人盘符

提交 `1aab133` 新增 JS source-config loader，并接入：

```text
vite.config.js
scripts/generate-archive-manifest.mjs
```

过去 tracked 的四条 `E:/BaiduNetdiskDownload/SideM/...` 默认路径已经删除。
现在从忽略配置中的 `legacy_root` 派生：

- `scripts/lipsyncdata/adxlip`；
- `GS_Res/Audio`；
- `story_viewer/voice_ogg`；
- `GS_Res/ALL_PHOTOS/assets/resources/image/image_card`。

这些目录仍是 `legacy-reference`/当前浏览器格式依赖，不是 RAW authority。
`SIDEM_LIPSYNC_ROOT`、`SIDEM_AUDIO_ROOT`、`SIDEM_LEGACY_AUDIO_ROOT` 和
`SIDEM_CARD_ART_ROOT` 仍可最终覆盖。`legacy_root: null` 时只使用仓库内
未配置占位路径，不会退回任何个人盘符。

验证结果：

- Python + JS source fixture 都通过；
- 四个本机派生目录存在；
- production build 通过；
- lipsync、BGM、legacy voice、card portrait 四类代理均 HTTP 200；
- 5174 首页正常渲染，控制台零 warning/error，活动轮播 1/36→2/36；
- 未运行会重写 public manifest 的命令；
- 未修改 public 资源或稳定 URL。

### 0.6 live-chibi 音频构建器已切换到权威 RAW

提交 `4f69af1` 已将 `scripts/prepare-live-chibi-audio.py` 接入统一来源契约。
默认输入从旧整理目录改为配置中的 `RAW/audio`，`vgmstream` 与 FFmpeg
默认从忽略的本机配置读取；显式 CLI 和原有环境变量仍可最终覆盖。
默认稳定输出仍为 `public/assets/live-chibi/music`，新增 `--output-root`
只用于隔离候选。

`song3_drvalv.acb` 的旧副本和权威 RAW 文件均为 32,540,736 bytes，SHA-256
同为
`B655D57D8A7AEC20C73E39B823AB9296D28AAF0766CC954A026AFF7CF96450D2`。
无 `--force` 回归后，稳定 `drvalv.m4a` 和 `index.json` 哈希均未变化。
隔离强制提取的 `drv999.m4a` 与当前稳定文件逐字节相同，SHA-256 为
`7BAE68F7E5033D5320BD7082FB3CC0CE6E4B7D44247123EA0B7A446FF34481E9`。

5174 的 `view=chibi_stage` 达到 5/5 人就绪；真实点击播放后共享音频时钟
从 0:00 前进到 0:02，动作预载完成，舞台与歌词正常显示，并可在 0:07
暂停。本批未改写任何稳定 M4A、索引或 URL。

### 0.7 live Backmonitor 已切换到权威 RAW/movie

提交 `f20d014` 已将 `prepare-live-chibi-backmonitor.py` 接入统一来源契约。
物理 USM 默认来自 `RAW/movie`。该提交当时仍使用 `legacy_root` 下的 119
份 `liveeffectscript` CSV；后续 `f73faa7` 已将这项语义读取切换到 RAW
song bundle 内的 TextAsset。FFmpeg、FFprobe 和 WannaCRI 根目录由忽略的
本机配置提供，显式 CLI 仍可最终覆盖。

260 个 RAW USM 中，CSV 实际引用 73 个循环视频和 4 个 alpha 转场。
77/77 引用文件在旧副本与权威 RAW 间 SHA-256 相同、零缺失。其余 183 个
USM 尚未完成 card/event/announcement 等业务分类，因此不能把本批写成
“260 个 movie 全部完成关联”。

有界候选同时覆盖了主视频与双路转场：

- `ballade_01.mp4` 候选与稳定文件哈希同为
  `2ED4F36CA90AA86AAD9C80E2BB44055F753C365AB935DF02EDAD0EC33612E31F`；
- `alpha_blackout.color.mp4` 两边同为
  `DA7CF4629F3F8418FAAB333CB7CC99C78FE4DDE5B2A84B68833F97395E5C3610`；
- `alpha_blackout.alpha.mp4` 两边同为
  `0ABC9C762BF5C7339FE8E03BC3B186B4BC7A6C54173B8A873889FC2169F871DD`；
- 合并回归保留完整 73/4 索引及稳定 index 哈希
  `E0E386F617700EFD5C6EF6B0511ECB344596627C2B9B9E99358A4202F6131064`。

5174 实播跨过 DRIVE A LIVE 的 2,500 ms 切换点后，页面报告
`ballade_01` ready、`alpha_blackout` active；转场结束后 active 自动归
false，而主视频继续 ready。四条 index/video URL 均 HTTP 200，没有
Backmonitor 错误。本批未改写稳定 MP4、index 或 URL。

### 0.8 live Image_layer 已切换到权威 RAW/asset

提交 `7860377` 已将 `prepare-live-chibi-image-layers.py` 接入统一来源契约。
该提交当时仍从 `legacy_root` 读取 119 份 `liveeffectscript` CSV；后续
`4c67bd1` 已将这项语义读取切换到 RAW song bundle 内的 TextAsset。
101 条 `Image_layer / Image_layer_2` 事件引用 57 个唯一资源，物理内容
仍默认从 `RAW/asset` 下 24 个 `song_<code>.unity3d` 读取。

24/24 权威 RAW bundle 与整理包副本 SHA-256 相同、零缺失，总计
88,372,604 bytes。`stage_flslgt_01` 的有界强制导出与稳定 PNG 哈希同为
`748696222912908185A608F2034E01C0B38093B24F37325F796CA036316EB0C1`；
在完整索引镜像中单项重建后，57 项 index 哈希仍为
`0A8FCFD6C32EDD847C327B4AF95AE9B9405BB6971CE3643DC80FE4DAAD7DB783`。

5174 的真实 FLASH LIGHT 舞台达到 4/4 图片层 ready，资源 ID 为
`stage_flslgt_01` 至 `_04`，depth 为 1550/1575/1600/1725。关闭
“图片布景”后计数归零，再开启后四层及 depth 完整恢复；没有图片层加载或
同步错误。本批未改写稳定 PNG、index 或 URL。

### 0.9 live Object_layer 已切换到权威 RAW/asset

提交 `59a442d` 已将 `prepare-live-chibi-object-layers.py` 接入统一来源契约。
119 份 CSV 提供 185 个唯一对象引用；物理 bundle 查找默认来自
`RAW/asset`。稳定清单定位 181 个，四个 `tibeti` ID 因候选 bundle 内没有
预期 keeper 而继续保留为 missing，不能写成 185/185 完成。

181 个已定位引用使用 77 个 RAW bundle，共 141,251,540 bytes；77/77 与
整理包副本 SHA-256 相同。`fx_in_bnckgy_overlight_1` 隔离导出与稳定 PNG
哈希同为
`D29F424CCCBC84EDCC46AABF7FDAB2DF947C0B7A2450CC581CB192F72D253B75`。
完整索引镜像单项重建后仍保持稳定哈希
`D0794B72D0B31C094DD557DB2B317B92A8412B1EB9D577721685B249FA3CDCE7`
及 185/181/4 统计。

5174 实播バーニン・クールで輝いて跨过 12,000 ms 后报告四个
`fx_in_bnckgy_overlight_1..4` 对象、空 unsupported 列表；关闭舞台物件后
计数归零，重新开启后四项恢复。本批未改写稳定 sprite、index 或 URL。

### 0.10 live 静态舞台已切换到权威 RAW/asset

提交 `c3ff8e1` 已将 `prepare-live-chibi-stage-backgrounds.py` 接入统一
来源契约。119 份 CSV 仍作为排除动态 Image_layer 的语义参考；物理
`song_*.unity3d` 默认从 `RAW/asset` 读取。

稳定索引的 55 首静态舞台共 90,760,580 bytes，对应 55 个实际 RAW bundle，
共 169,437,444 bytes；55/55 与整理包副本 SHA-256 相同。
`bnckgy` 的 `_01/_02/_03` 三层隔离合成与稳定 PNG 哈希同为
`E07675E0D752FA26CE3E072C859180D874D85ECA1F40CFFA364A792AA0C7FFEF`。
完整索引镜像单项重建后仍保持稳定哈希
`B042183DE423C67D570A21CC5AA30D39F288F28FA3275BFCCDA5B2F51356AA3D`。

5174 的真实バーニン・クールで輝いて舞台报告背景 ready、song=`bnckgy`；
关闭静态舞台后 enabled=false，再开启恢复 true。页面无框架错误覆盖或
应用错误，仅保留两条既有 Pixi Spine warning。本批未改写稳定 PNG、index
或 URL。

### 0.11 live-chibi 角色核心物理资源已切换到权威 RAW/asset

提交 `a9c8342` 已将 `prepare-live-chibi-assets.py` 的物理资源链重新接到
统一来源契约。现在直接读取：

- `live_character_info_data_list.unity3d`；
- 5 个 `live_costume_setup_<body>.unity3d`；
- 当前稳定 `inventory.json` 限定的 549 个 `costume_<model>.unity3d`；
- 57 个 `live_costume_animation_*.unity3d`。

5/5 setup skeleton 与旧导出逐字节一致。57 个 animation bundle 提供的
7,135 个动作 TextAsset 与旧 `.bytes` 为 7,135/7,135 逐字节一致、零缺失。
549 个服装 bundle 共 770,801,073 bytes；549/549 序列化 `cos.atlas` 对象
逐字节一致，549/549 `cos` Texture2D 解码像素一致。

完整 ignored 候选重建出 8,517 个文件、592,667,731 bytes；与稳定产物逐项
SHA-256 比较为 8,517/8,517 一致。5174 的 DRIVE A LIVE 达到 5/5 人 ready，
动作预载完成，共享时钟前进到 0:03，歌词和编排正常；仅有两条既有 Pixi
Spine warning。本批未改写稳定资源或 URL。

边界必须保留：

- 当前 549 套是具有 `cos` payload 的 live-chibi 稳定兼容集合；
- masterdata 的另外 141 个 model 是已发布的 `comu` 交流 Spine，不应加入
  live 下拉框；
- RAW 还另有 38 个 master 外的 NPC/guest costume bundle；
- `a9c8342` 当时仍使用的 119 份 choreography CSV 与 60 条 lip-sync 源
  JSON，已由后续 `bee7970` 改为直接读取 RAW TextAsset；Backmonitor
  与 Image_layer 辅助构建器也已由 `f73faa7`、`4c67bd1` 跟进，剩余两个
  CSV 消费者待后续小批迁移。

### 0.12 舞台内置灯效已建立外部 XAPK 来源契约

代码提交 `aeeec1c` 已将 `prepare-live-chibi-stage-effects.py` 接入统一来源
契约的可选 `xapk_file` 字段，并保留 `--xapk` 为最终覆盖。这个域不能写成
RAW 迁移：十张 Laserlight/Pinspotlight 纹理来自客户端 XAPK 中主 APK 的
`assets/bin/Data/data.unity3d`；在 `RAW/asset` 中未找到
`laserlight_1` / `pinspotlight_back` 同名物理来源。

原始 XAPK 保留在以下下载路径，未移动、未修改：

```text
E:\BaiduNetdiskDownload\SideM\サイスタ - 副本\アイドルマスター+SideM+GROWING+STARS_2.6.10_APKPure.xapk
```

三级来源身份如下：

- XAPK：122,533,902 bytes，
  SHA-256 `517B907602C2667B6F1CAA7D1DF2623D49D082CD27F89E44163765E1EA61BDA2`；
- 主 APK：86,094,372 bytes，
  SHA-256 `1EA98330804F5E869C9F45F5C98897DF5A94BF6A8A2A8DDAED6B5D62E4B03CBB`；
- `assets/bin/Data/data.unity3d`：64,559,050 bytes，
  SHA-256 `D35231C0B00A09F6941F47F7FFEDDE9E9B35701F5B66D6F432517DA860E1A500`。

ignored 候选包含十张 PNG 和一个 `index.json`，与稳定目录 11/11
逐字节一致；index SHA-256 为
`2147817434A896C4727FD08E378B389B607F18F3D339A173D58929DC5C4207F4`。
5174 的真实 K.now O.nly 消费者在播放后报告 2 个 Pinspotlight（ID 1/2）
和 8 个 Laserlight（ID 1–8）；关闭“光束灯效”后两组均归零，再开启后按
当前时刻恢复 2/8。无框架错误覆盖或应用错误，仅有两条既有 Pixi Spine
warning。本批未改写稳定资源。

### 0.13 已纠正 690/549/141 的 costume 消费域边界

代码提交 `6e73eaa` 新增只读命令：

```powershell
npm run audit:live-chibi-costume-boundary
```

它证明此前“另 141 套 master costume 待扩入 live”的工作假设是错误的。
690 与 549 的差值确为 141，但 141/141 RAW bundle 都只包含独立交流 Spine
的 `comu.atlas`、`comu.skel`、`comu` Texture2D；0/141 包含 live-chibi
要求的 `cos.atlas` / `cos` Texture2D。因此这 141 个 model 不得写入稳定
live `inventory.json`。

这 141 个 bundle 覆盖全部 49 位角色，总计 124,516,197 bytes。稳定
`public/assets/spines` 已有 141/141 完整的 `comu.atlas/.skel/.png` 和
`faces/`。全量 RAW 回归结果：

- 141/141 `comu.atlas` Unity 序列化对象逐字节一致；
- 141/141 `comu.skel` Unity 序列化对象逐字节一致；
- 141/141 `comu` 主贴图解码像素一致；
- 1,655/1,655 表情贴图解码像素一致。

masterdata 中恰有 49 条非空名称，全部是 `ベーシックウェア`；另 92 条名称
为空。5174 按 body type 1–5 抽查了 `001tom_002_00`、
`006tsu_002_00`、`002sht_002_00`、`032nao_002_00`、
`031sak_002_00`：主页均选中正确 model 和服装名、Canvas 正常、无错误覆盖，
15 个代表性 `comu.atlas/.skel/.png` URL 全部 HTTP 200，水嶋 咲画面完整
可见。本批没有稳定资源替换。

### 0.14 live 编舞与口型语义源已切换到权威 RAW

代码提交 `bee7970` 新增 RAW 语义读取器与可重复审计命令：

```powershell
npm run audit:live-chibi-semantic-sources
```

主 `prepare-live-chibi-assets.py` 现在直接读取 61 个
`RAW/asset/song_*.unity3d` 内的 choreography 和 live lip-sync
TextAsset。显式 `--effect-script-root` / `--live-lip-sync-root` 仅保留为
整理包回归覆盖，不再是默认源。

全量来源核对结果：

- 119/119 choreography TextAsset 与整理 CSV 逐字节一致，总 payload
  21,964,117 bytes；
- 60/60 live lip-sync TextAsset 与整理 JSON 逐字节一致，总 payload
  39,549,272 bytes；
- RAW-only、legacy-only 均为 0；
- 61 个 song bundle 全有 choreography；只有 `song_drv999.unity3d`
  不含 lip-sync TextAsset，恰好解释 61/60 差异；
- `anwhre_live_effect`：178,049 bytes，
  SHA-256 `56eed4233fd48bde400f54807710a8946a3b00a260e85d1ba0ab21910ec5d7de`；
- `anwhre_for_lipsync`：652,906 bytes，
  SHA-256 `1c74d440c7c2d58bba442cae2939c5b22567803829ee7c3cc518e700502ec93f`。

隔离完整候选仍为 8,517 个文件、592,667,731 bytes，与稳定输出
8,517/8,517 逐字节一致。5174 的 DRIVE A LIVE 达到 5/5 ready，读取
`lipsync/drvalv.json` 的 7,817 帧；播放推进到 14,600 ms 时 singer 已从
位置 3 切换到 1、4，10,800 ms camera event 和歌词均正常。两个语义 URL
均 HTTP 200，无 Vite 错误覆盖，稳定资源未改写。

边界：Backmonitor 已由 `f73faa7` 迁移，Image_layer 已由 `4c67bd1`
迁移。以下两个专项构建器仍各自读取 choreography CSV，必须下一批逐个
迁移和回归，不能把本节写成“所有 CSV 消费者都已迁移”：

- `prepare-live-chibi-object-layers.py`；
- `prepare-live-chibi-stage-backgrounds.py`。

### 0.15 Backmonitor 语义消费者已切换到 RAW TextAsset

代码提交 `f73faa7` 只修改 `prepare-live-chibi-backmonitor.py`。默认输入
复用 61 个 RAW song bundle 的 choreography TextAsset；`--script-root`
只保留为整理 CSV 回归覆盖。物理视频仍来自 `RAW/movie`；Image_layer 已在
后续 `4c67bd1` 迁移，其余两个专项构建器仍未动。

RAW 与整理包分别解析均得到 73 个主视频 ID、4 个 alpha 转场 ID，两类集合
差异都为 0。隔离候选重建：

- `ballade_01.mp4`：109,246 bytes，候选/稳定 SHA-256 都是
  `2ED4F36CA90AA86AAD9C80E2BB44055F753C365AB935DF02EDAD0EC33612E31F`；
- `alpha_star.color.mp4`：6,318 bytes，两边 SHA-256 都是
  `F9205D93CB107D8A734AD327657710AF85DB48C39C18564D54F7254065C08F7B`；
- `alpha_star.alpha.mp4`：6,502 bytes，两边 SHA-256 都是
  `7AF852DA8C896A64D2D6C8B2E8FCACD6CC8E041AD6B83D2A0A4E7EEF194DB1B4`。

候选两个 index entry 与稳定记录结构一致；稳定全量 index 未改写，SHA-256
仍为 `E0E386F617700EFD5C6EF6B0511ECB344596627C2B9B9E99358A4202F6131064`。
5174 实播 DRIVE A LIVE 在 2,500 ms 显示 `ballade_01` ready、
`alpha_blackout` active；转场结束后 active 自动变为 false，主视频继续
ready。index、主视频、color 和 alpha 四个 URL 均 HTTP 200，无 Vite
错误覆盖。

### 0.16 Image_layer 语义消费者已切换到 RAW TextAsset

代码提交 `4c67bd1` 只修改 `prepare-live-chibi-image-layers.py`。默认输入
复用 RAW choreography TextAsset；`--script-root` 只保留为整理 CSV 回归
覆盖。Sprite 物理来源仍是 `RAW/asset/song_<code>.unity3d`，Object_layer
和静态舞台两个构建器未动。

RAW 与整理包分别解析都得到 101 条 Image_layer 事件、57 个唯一资源，集合
差异为 0。隔离重建 `stage_flslgt_01.png` 得到 775,367 bytes，候选与稳定
SHA-256 均为
`748696222912908185A608F2034E01C0B38093B24F37325F796CA036316EB0C1`；
index entry 结构一致。稳定 57 项 index 未改写，SHA-256 仍为
`0A8FCFD6C32EDD847C327B4AF95AE9B9405BB6971CE3643DC80FE4DAAD7DB783`。

5174 的真实 FLASH LIGHT 消费者显示 `stage_flslgt_01` 至 `_04` 共 4/4
层，depth 为 1550/1575/1600/1725。关闭“图片布景”后计数归零，再开启后
四层与 depth 完整恢复。index 与四张 PNG 共五个 URL 均 HTTP 200，无 Vite
错误覆盖。

## 1. 当前已确认的事实

### 1.1 RAW 的真实边界和数量

当前本地 RAW 根目录是：

```text
E:\Web_build\SideM_Archived\RAW
```

它来自 `RAW.7z.001`、`RAW.7z.002` 的直接解压结果，并已加入仓库根
`.gitignore`。当前递归文件总数是 13,000：

| 位置 | 文件数 | 格式 | 字节数 |
| --- | ---: | --- | ---: |
| `RAW/asset` | 8,639 | `.unity3d` | 3,729,824,259 |
| `RAW/audio` | 4,098 | 4,055 `.acb` + 43 `.awb` | 2,356,781,289 |
| `RAW/movie` | 260 | `.usm` | 2,143,803,200 |
| `RAW/` 根目录 | 3 | `asset_url.txt`、`audio_url.txt`、`movie_url.txt` | 1,640,473 |
| 合计 | 13,000 |  | 8,232,049,221 |

因此，“RAW 只有 asset/audio/movie 三个分类”可以作为**内容域概括**，
但不能被实现成“根目录只允许三个子目录”。三份 URL TXT 是原备份随附的
archive metadata，也在 13,000 文件基线内。

当前完整文件 manifest 位于忽略目录：

```text
web_viewer/.analysis/raw-migration/source/files.jsonl
web_viewer/.analysis/raw-migration/source/summary.json
```

当前文件哈希：

```text
files.jsonl
5E04D058670497A35C61DAB0EFD70B4C3C71142EF61BCD7890AE806466E7851B

summary.json
D7011E75646C223028B0752B543B85F5A3C7E6BA8686A98F31F60BCC84CB4B3D
```

manifest 是本机生成证据，不在 Git 中。`summary.json` 当前记录了本机
绝对路径，且 `archive_volumes` 为空；它还没有 masterdata 哈希、manifest
整体契约哈希或非法派生文件分类字段。

此前误进入 `RAW/audio` 的 271 个 WAV 已被移到可恢复的忽略目录：

```text
web_viewer/.analysis/raw-migration/generated-wav-quarantine/
```

当前 RAW 内 WAV 数量为零。不要删除 quarantine，也不要把 WAV 重新写回
RAW。

### 1.2 masterdata 的真实现状

站点当前提交并消费的是：

```text
web_viewer/public/data/masterdata/*.json
```

这里有 21 个规范化产品，包括背景、卡片、活动、偶像、剧情、音乐、季节
活动等索引。这些文件是从 masterdata 生成的**语义投影**，不是原始物理
资源，也不是原始 protobuf 的替代备份。

提取器是：

```text
data_pipeline/masterdata_extract.py
```

它接受一个外部 XOR 状态的 `client_master_data` 文件，进行
`DefaultPassPhrase` XOR 解码。本机原始容器是：

```text
E:\BaiduNetdiskDownload\SideM\サイスタ - 副本\Container\Documents\client_master_data
```

本机已有的解码结果是：

```text
E:\Web_build\SideM_Archived\web_viewer\.analysis\masterdata\client_master_data.xor_DefaultPassPhrase.pb
```

核对结果：

| 项目 | 值 |
| --- | --- |
| XOR 状态原始容器大小 | 3,053,002 bytes |
| XOR 状态原始容器 SHA-256 | `D57F76040C56C5CE0E80910C76328F528D47915C63A040516B470A538CCCDC0E` |
| decoded PB 大小 | 3,053,002 bytes |
| decoded PB SHA-256 | `25D48A557C50AC2429F0F55E5D0B766B490B37711EECE4BAA720CF47570F0EA1` |
| protobuf 顶层 records | 47,204 |
| 实际出现的顶层 table IDs | 158 |
| table ID 范围 | 1-183，范围内并非每个 ID 都存在 |
| decoded PB Git 状态 | 由 `web_viewer/.analysis/` 规则忽略 |

该 PB 可作为本机 masterdata 语义重建的 decoded authoritative input。
`masterdata_extract.py` 的解析结果与既有审计记录一致：47,204 条顶层记录、
158 个实际表 ID。

2026-07-27 的内存解码复核确认：

```text
XOR source --DefaultPassPhrase--> decoded PB
decoded bytes: 3,053,002
decoded SHA-256: 25D48A557C50AC2429F0F55E5D0B766B490B37711EECE4BAA720CF47570F0EA1
byte-for-byte equal to the existing .analysis PB: true
```

不要直接把该 decoded PB 传给当前 `masterdata_extract.py` 命令行。该脚本
目前会对 `input` 无条件执行一次 XOR；decoded PB 是它的输出形态，再输入
会被二次 XOR。完整重跑 extractor 需要满足其一：

1. 找到 XOR 状态的原始 `client_master_data` 并作为现有 CLI 输入；
2. 先为脚本增加显式 `--input-state xor|decoded` 契约和 fixture，再允许
   decoded PB 直接进入解析阶段。

当前 `public/data/masterdata` 的 22 个 JSON 中：

- 19 个与 `.analysis/masterdata` 中的同名输出逐字节一致；
- `music_catalog.json` 不一致，因为公开版本后来加入了 RAW/ACB 关系扩展；
- `story_presentation_index.json` 和
  `ssr_portraits_migration_report.json` 没有同名 `.analysis` 初始输出，它们是
  后续站点管线产品。

重要边界：

- XOR 前原始容器位于仓库外的百度网盘资料目录；
- decoded PB 不是 RAW 物理资源，也不应放入 `RAW/`；
- Git 中的 masterdata JSON 是站点投影，不能反向伪装成 protobuf；
- 不需要现在移动 decoded PB。它已处于安全的 ignored 路径；
- 原始容器也不应直接从资料目录移走。若未来固定到
  `sources/masterdata/`，采用复制、SHA-256 复核、切换配置和回归验证，
  完成前保留原位置副本。

### 1.3 已完成的覆盖与 promotion

当前全量审计确认：

| 域 | 当前证据 |
| --- | --- |
| 剧情 | 1,435 个 RAW scenario bundle；3,398 个逻辑剧情组；4,939/4,939 部件可编译并匹配公开 identity |
| 卡片 | 836 master 行，826 个唯一 `resource_id`，RAW 826/826 |
| ADV 背景 | catalog 192/192；剧情引用 ID 356/356 |
| 歌曲 | 61/61 master song code 与 cue |
| 剧情 BGM | 105/105 引用 ID 有容器 |
| ambient | 83/83 非 sentinel cue 有容器 |
| 剧情 SE | 435/435 已分类，`waribashi` 组合 cue 有代表性重建证据 |
| 角色图片 | 57 个 `image_chara*` bundle、485 条逻辑路径已分类 |
| live 图片布景 | 101 条 CSV 事件、57 个唯一资源、24 个 RAW song bundle，已全量映射并验证 |
| live 舞台对象 | 185 个唯一引用；181 个已定位到 77 个 RAW bundle，4 个 `tibeti` keeper 仍缺失 |
| live 静态舞台 | 55 首稳定合成图、55 个 RAW song bundle，已全量映射并验证 |
| live 角色核心 | 5 套 setup、549 套含 `cos` payload 的 costume、7,135 个动作片段已直接映射 RAW；master 差集 141/141 是已发布 `comu` 交流 Spine，不属于 live 扩容 |
| movie | 260 个 USM；77 个 live Backmonitor 引用已映射并验证，剩余 183 个仍为文件名级 inventory |
| 一般 UI 图片 | 1,271 个一般 `image_*` bundle，尚无完整关系表 |

注意：3,398 是**逻辑剧情组数**，不是 RAW 文件数。相关的物理层还有
1,435 个 Unity bundle 和 4,939 个剧情部件。后续文档和提交信息必须使用
正确名词。

当前稳定角色图片 registry：

```text
web_viewer/public/data/assets/raw_character_image_promotions.json
```

共有 52 条 identity：

- 50 条 `birthday_visual` identity；
- 其中 `012yus`、`013kys` 共用一个物理 PNG，所以生日域是 50 个身份、
  49 个物理 URL；
- 包含 NPC `101ken`；
- 2 条 `event_story_visual`：`001tom`、`002sht`；
- 事件视觉全集是 51 个身份，仍有 49 个回退到 icon。

Git 当前跟踪的稳定 promoted visual 物理文件共 51 个：

- 49 个生日视觉 PNG；
- 2 个事件视觉 PNG。

### 1.4 当前发布机制的边界

角色图片已有：

- 单 identity 发布/回滚；
- shared group 发布；
- 多 identity batch 发布/回滚；
- 临时文件替换和 registry 验证；
- Source Gate fixture；
- 浏览器 candidate 参数；
- 稳定 URL 消费。

剧情已有：

- 单剧情 RAW promotion candidate；
- 单剧情严格发布和备份；
- authoritative collection 的既有工具；
- 但 RAW promotion gate 仍然是
  `candidate_kind: raw-story-single-promotion`；
- 尚未建立 RAW multi-part aggregate promotion contract。

当前不存在统一的：

```text
publish/manifest.json
```

门户实际直接读取：

```text
/data/assets/raw_character_image_promotions.json
```

并消费 `public/assets` 下的稳定 URL。不能把“门户只读取 publish manifest”
写成当前事实；它是下一阶段的目标。

## 2. 对网页端指导的核对结论

| 网页端表述 | 核对结果 | 新窗口采用的准确说法 |
| --- | --- | --- |
| `0ba566f` 是 v1 基线 | 可采用，但属于项目约定 | 远端分支与 Draft PR #2 指向该提交；暂无 tag，尚未合并 master |
| RAW 约 13,000 文件 | 正确 | 精确为 13,000，总字节 8,232,049,221 |
| RAW 只有 asset/audio/movie | 需要修正 | 三个物理资源域外，还有三份根目录 URL TXT archive metadata |
| 3,398 个剧情文件 | 名词错误 | 应为 3,398 个逻辑剧情组；另有 1,435 bundle、4,939 parts |
| birthday visual 完整 | 正确 | 50 个身份、49 个物理 URL，包含 `101ken` |
| event visual 完成 2、剩 49 | 正确 | 稳定 `001tom`、`002sht`，其余 icon fallback |
| 260 USM 和 1,271 `image_*` 待审计 | 需要更新 | USM 中 77 个 live Backmonitor 已有完整引用/转码/5174 证据，剩余 183 个待分类；一般图片仍无完整 relation table |
| Source Gate 已通过 | 正确 | GitHub run `30232788385` 对 `0ba566f` 成功 |
| 已有完整统一 publish manifest | 不正确 | 只有域级 registry/candidate manifest；无统一 publish manifest |
| 已有统一 archive root 配置 | 现在正确 | Python/JS loader、RAW 审计器、Vite、live audio、Backmonitor、Image/Object layer、静态舞台、角色核心与外部 XAPK stage-effects 均已接入；外部容器通过 ignored `xapk_file` 精确指定 |
| 可用 masterdata 链 | 已完整核对 | 外部 XOR 容器 `D57F76...CDC0E` 可确定性解码为 `.analysis` PB `25D48A...F0EA1`，逐字节一致 |
| ACB/AWB 已是整个站点唯一音频上游 | 目标合理，现状不能这样概括 | RAW 音频审计很强，但现有公开音频仍可能来自旧整理/转码链；需逐域收束 |
| batch publisher 已存在 | 正确 | 已有 publish/rollback batch 和 fixture；下一批需补真正的三项事件视觉原子证据 |
| `noAudio=1` 没有副作用 | 不正确 | 当前仍可触发 null AudioContext `decodeAudioData` 错误，是明确待修缺陷 |
| 门户只识别 stable URL、不识别 RAW | 基本正确 | 正式页面读 registry 和 stable URL；candidate 调试参数是有意保留的开发入口 |

网页端提出的四阶段方向总体可采用，但必须把“建议创建的配置、inventory、
publish manifest、统一 audio catalog”当作未来实现，不得在交接中写成已经
存在。

## 3. 权威层与文件政策

后续统一使用以下来源等级：

| 等级 | 权限和用途 |
| --- | --- |
| `raw-authoritative` | `RAW/asset`、`RAW/audio`、`RAW/movie` 的原始 payload，以及三份根目录 archive metadata |
| `master-authoritative` | 外部 XOR 容器及其逐字节验证一致的 decoded PB；两者哈希均已记录 |
| `master-projection` | `public/data/masterdata/*.json`；用于站点和回归，保留 `_source` 证据 |
| `legacy-reference` | 发布者整理的图片包、歌曲包、转码音频、旧 scenariodata；只做 parity、浏览器格式参考或缺口证明 |
| `derived` | PNG、WAV、M4A、JSON、WebP、compiled scenario、candidate report |
| `stable-published` | 已通过 gate、发布/回滚/重发布和浏览器验收的少量稳定 URL |

不要删除发布者整理包。只有某一域同时满足以下条件，才能另开任务讨论冷备份：

```text
RAW 重建覆盖完整
+ 内容 parity 已验证
+ 映射关系已保存
+ 没有 supplemental-only 资源
```

Git 政策：

```text
允许跟踪
- 源码、schema、registry、manifest
- 小型 fixture
- 审计和交接文档
- 少量正式 UI 直接需要且已过 gate 的稳定资产

默认不跟踪
- RAW
- .analysis 候选与备份
- 全量图片导出
- WAV 解码缓存
- 全量转码音频
- 大量 Spine
- USM 或视频解码物
- 完整发布镜像
```

注意 `web_viewer/public/assets/` 当前整体被 `.gitignore` 忽略。正式 promotion
脚本生成的新稳定资产若要提交，需要先检查范围，再使用精确路径
`git add -f <file>`；绝不能 `git add -f public/assets`。

## 4. 下一阶段的建议拆分

顺序采用：

```text
PR A：源契约与二进制政策
  -> PR B：RAW multi-part 剧情 gate
  -> PR C：ACB/AWB 音频来源 identity
  -> PR D：三项 event visual 原子批次
  -> USM 与一般 image bundle 只读 catalog
```

这些是逻辑阶段。是否真的创建四个 GitHub PR，由新窗口先核对 Draft PR #2
的合并策略后决定。不要未经用户确认关闭、合并或重定向现有 PR #2。

### 4.1 PR A：源契约与二进制政策

建议分支（仅在决定拆 PR 后创建）：

```text
codex/raw-source-contract
```

建议新增：

```text
web_viewer/config/archive_sources.example.json
web_viewer/config/archive_sources.local.json   # ignored
data_pipeline/archive_paths.py
```

本机路径示例不能照抄网页端虚构目录。先定位真实文件，再生成 local 配置。
建议 schema：

```json
{
  "schema_version": 1,
  "archive_root": "E:/Web_build/SideM_Archived",
  "raw_root": "RAW",
  "masterdata_source_file": "E:/BaiduNetdiskDownload/SideM/サイスタ - 副本/Container/Documents/client_master_data",
  "masterdata_source_sha256": "d57f76040c56c5ce0e80910c76328f528d47915c63a040516b470a538cccdc0e",
  "masterdata_decoded_file": "web_viewer/.analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb",
  "masterdata_decoded_sha256": "25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1",
  "legacy_root": null,
  "inventory_root": "web_viewer/.analysis/raw-migration",
  "workspace_root": "web_viewer/.analysis/workspace",
  "derived_root": "web_viewer/.analysis/derived",
  "publish_root": "web_viewer/public"
}
```

以上是本机 local 配置，不应原样写入提交的 example。example 应使用
占位相对路径，local 文件才记录日文绝对路径。
`masterdata_decoded_file` 指向现有 decoded PB，`masterdata_source_file`
指向已核对的 XOR 状态原始容器。`legacy_root` 只有在找到真实整理包路径后
才填写。路径解析层必须根据字段区分输入状态，不能把 decoded 文件交给当前
无条件 XOR 的 extractor。不要因为目录设计而立即移动大文件。

迁移脚本时按小批进行：

1. 先给 `raw_source_manifest.py` 接入统一配置；
2. 保留现有 `--raw-root` 显式覆盖；
3. 加临时目录 fixture，证明相对路径和 CLI override；
4. 运行 manifest，并比较 13,000 数量、总字节和 section counts；
5. 再逐个迁移 RAW card/background/story/character/audio 审计器；
6. 最后处理仍含个人绝对路径的 live/chibi 辅助脚本；
7. 每次只迁移一组同类脚本，不做全仓机械替换。

PR A 必须新增或固定：

- versioned raw manifest schema；
- XOR source 与 decoded masterdata 的 SHA-256，以及各自状态字段
  `xor-source-local` 和
  `decoded-authoritative-local`；
- 两者的确定性解码关系和 byte-for-byte equality；
- masterdata 输入状态 fixture，证明 decoded 文件不会被二次 XOR；
- manifest 内容的确定性整体哈希；
- 三域及根 metadata 的数量/容量；
- `.wav/.png/.json` 等派生文件进入 RAW 的违规报告；
- 重复相对路径和缺失基线检测；
- 来源等级字段；
- 二进制入库政策文档。

完成标准：

- 单一 local 配置可运行选定的全部 RAW 审计器；
- CLI 参数仍能安全覆盖；
- fixture 不依赖本机 `E:` 盘；
- `0ba566f` 的 registry、稳定 PNG 和页面结果不变；
- Source Gate 在 Linux runner 通过；
- 不提交 local 配置、RAW、PB 或 `.analysis`。

### 4.2 PR B：RAW multi-part 剧情 gate

建议分支：

```text
codex/raw-story-aggregate-gate
```

目标不是重新证明“单文件能播放”，而是从 RAW 确定性构建一个完整 aggregate：

```text
RAW scenario bundle
-> 原始 scenario JSON
-> episode/part 聚合
-> ScenarioCompiler
-> authoritative Runtime v2 candidate
-> candidate/stable 结构比较
-> 原子发布
-> 精确回滚
-> 最终重发布
```

候选 manifest 至少记录：

```json
{
  "collection_id": "1_4_001_01",
  "raw_scenario_bundles": [],
  "raw_lipsync_bundles": [],
  "raw_audio_containers": [],
  "master_records": [],
  "compiled_outputs": [],
  "verification": {}
}
```

三个回归集合已在公开 compiled 目录中确认存在：

| 集合 | 当前部件 | 目的 |
| --- | ---: | --- |
| `1_4_001_01` | A-J，10 个 | 大型多段、语音、Spine、Runtime v2、文本 identity |
| `1_3_10011_01` | A-K，11 个 | event master、Jupiter cast、事件视觉、播放入口 |
| `5_01_101_22` | A、E，2 个 | 小型且部件字母不连续的回归 |

不要假设所有 aggregate 都是连续 A-J。`5_01_101_22` 正是防止这种错误假设的
样本。

结构验收至少比较：

- source bundle SHA-256；
- 原始命令数和顺序；
- part/episode 边界；
- dialogue/text identity；
- snapshot 数；
- cue 数；
- voice 引用；
- 背景和模型引用；
- authoritative schema；
- candidate/stable diff；
- 浏览器 route；
- rollback 前后文件和 registry/manifest hash。

至少一个真正 multi-part collection 必须完成：

```text
candidate -> publish -> 5174 -> rollback -> exact old hash
          -> republish -> 5174 -> commit
```

不要一次迁移 3,398 个逻辑剧情组。

### 4.3 PR C：ACB/AWB 来源 identity

建议分支：

```text
codex/raw-audio-source-identity
```

这一阶段先建立可追溯 catalog，不做全量转码：

```text
scenario/masterdata 引用
-> ACB container
-> cue
-> selector/sequence/waveform
-> internal/external AWB
-> 确定源 wave
-> 浏览器派生音频
```

先覆盖四个代表样本：

- 一段 story voice；
- 一个 BGM；
- 一个 ambient；
- 一个 SE。

每条都保存 container hash、cue identity、selector/sequence、waveform、
输出 hash、时长、声道和 5174 播放证据。多个候选时不得默认取第一项；不能
确定就标为 unresolved，不发布。

WAV 只允许进入忽略的 decode cache，例如：

```text
web_viewer/.analysis/workspace/audio_decode_cache/
```

同时修复：

```text
noAudio=1
-> 不请求音频
-> 不创建或解锁 AudioContext
-> 不调用 decodeAudioData
-> 控制台没有相关错误
```

不能只跑 source-only test 就宣称音频完成。必须另外保留真实浏览器、真实媒体
时长和声道证据。

### 4.4 PR D：三项 event visual 原子批次

建议分支：

```text
codex/raw-promotion-batch-1
```

第一项固定为：

```text
event_story_visual:003hok
```

它会补齐 `410011 / 10011` 的 Jupiter 三人 cast。其余两项从报告中选择：

- 覆盖不同事件；
- master evidence 明确；
- 没有 shared identity 冲突；
- Sprite crop 正常；
- 至少一个尺寸或布局显著不同。

“一点点替换”和“三项原子批次”这样兼容：

1. 三个候选逐个提取；
2. 每个候选逐个在 5174 candidate route 验证；
3. 每个候选都记录 PathID、尺寸、PNG hash、master 事件；
4. 只有三者都通过，才调用一次 batch publisher；
5. 对整批做 rollback；
6. rollback 必须保留既有 `001tom`、`002sht`；
7. 再整批发布并逐页验收；
8. 最后用一个有界 commit 提交三项。

`003hok` 的候选起步命令：

```powershell
Set-Location E:\Web_build\SideM_Archived\web_viewer

python ..\data_pipeline\extract_raw_character_image_candidate.py `
  event_story_visual 003hok

npm run verify:raw-character-candidate
```

候选页面：

```text
http://127.0.0.1:5174/?view=event_detail&event=410011&raw_character_candidate=event_story_visual%3A003hok&noAudio=1&runtimeDebug=1
```

候选验收：

- `001tom`、`002sht` 仍走 stable URL；
- `003hok` 只走 candidate URL；
- 三个人物完整显示、无错误裁切；
- tall layout 正常；
- 精确点击 `003hok` 能进入正确 idol detail；
- 其他 fallback 不变化；
- 除已知 `noAudio=1` 缺陷外，没有新增本地错误或 Vue overlay。

不要在只验完 `003hok` 后立刻批量发布另外两个未看过的候选。

## 5. 只读 catalog 工作

PR A 稳定后可以开展两个只读任务：

### 5.1 USM

为 260 个 USM 生成 movie catalog。先导入已证明的 77 个 live
Backmonitor 关系，再分类剩余 183 个：

```text
文件名
-> masterdata 记录
-> live/card/event/announcement/tutorial/system/unknown
-> 业务消费者
-> 置信度
```

本阶段不批量解码剩余 183 个 USM。已有 77 个 Backmonitor 派生物继续作为
浏览器格式回归基线，不需要重新全量转码。

### 5.2 一般 `image_*`

为 1,271 个一般 bundle 生成：

```text
bundle
Unity 对象类型
对象名
PathID
尺寸
推测业务域
masterdata 消费者
置信度
```

本阶段不批量导出 PNG；目标是降低 unknown bucket。

## 6. 每次修改后的验证顺序

### 6.1 source-only

根据变更域选择相关命令，最低集合：

```powershell
Set-Location E:\Web_build\SideM_Archived\web_viewer

npm run verify:raw-character-candidate
npm run verify:raw-character-promotion
npm run verify:story-raw-promotion
npm run verify:story-authoritative-publish
npm run verify:story-schema
npm run build
```

若改到剧情编译、翻译或 Runtime，再加：

```powershell
npm run verify:compiled-migration
npm run verify:story-localization
npm run verify:story-translations
npm run verify:story-text
npm run verify:story-audio
```

`npm run verify:archive` 可能刷新 mounted-data report。运行后必须先看
`git diff`，不能把其副作用自动并入不相关提交。

### 6.2 5174

每一项 promotion 都要保留三段证据：

1. candidate；
2. stable publish；
3. rollback 后旧 stable/fallback；
4. 最终 republish。

检查内容：

- HTTP 200；
- 页面标题和目标实体；
- 图片 natural width/height；
- 实际 URL 是 candidate、stable 还是 fallback；
- 人物点击导航；
- 控制台错误；
- Vue/框架错误 overlay；
- publish/rollback 前后 exact SHA-256。

`noAudio=1` 视觉测试不能证明真实音频。真实音频验收另开步骤，并确认 IDM
不会接管。

### 6.3 Git

每个提交前：

```powershell
Set-Location E:\Web_build\SideM_Archived

git status -sb
git diff --stat
git diff --check
git diff --cached --stat
git diff --cached --check
```

只暂存本批文件。推荐提交拆分：

1. source/config/schema/test；
2. domain implementation；
3. 小型稳定资源 + registry；
4. 审计和交接文档。

如果实现和文档必须同一原子变化，也可以同一提交，但要在 commit message 中
明确域和批次。

推送前：

```powershell
git status -sb
git log --oneline --decorate --max-count=8
git push origin <当前分支>
git rev-parse HEAD
git rev-parse origin/<当前分支>
```

只有两者相同才能报告“已推送”。

## 7. 明确暂缓

本轮不做：

- 新门户大页面或视觉重构；
- 全量 3,398 逻辑剧情迁移；
- 全量音频转码；
- 一次补完 49 个 event visual；
- USM 批量解码；
- 全量一般图片导出；
- 删除发布者旧整理包；
- 把全量派生二进制塞入 Git；
- R2 正式上传或生产部署；
- 未经确认合并/关闭 Draft PR #2；
- 未经确认创建或推送基线 tag。

## 8. 新窗口的第一项实际工作

PR A 的配置核心、RAW manifest、card/background/character 六个工具、
RAW audio 六个工具、RAW story 三个工具、Vite/manifest JS loader，
以及 live-chibi 音频、Backmonitor、Image_layer、Object_layer、静态舞台、
角色核心和外部 XAPK stage-effects 构建器已经接入；690/549/141 的 costume
消费域边界也已纠正并完成全量稳定回归。主 live-chibi 构建器的 choreography
与 lip-sync 语义输入、Backmonitor 和 Image_layer 辅助消费者也已直接读取
RAW。下一批逐个迁移两个仍独立读取 CSV 的专项辅助构建器，不从 `003hok`
开始发布：

1. 核对 `0ba566f`、PR #2、worktree、5174；
2. 复核 XOR source 与 decoded PB 的两个 SHA-256 和逐字节解码一致性；
3. 复核 decoded PB 的 47,204 records 和 158 table IDs；
4. 列出所有硬编码个人绝对路径；
5. 下一批逐个收束其余 live/chibi Python 辅助脚本的旧整理包路径；
6. 每批运行 fixture 和原域 audit，比较结果；
7. 对其余 masterdata 专项工具继续区分 XOR source 与 decoded PB；
8. 每个脚本先用隔离 `--output-root` 或等价候选目录验证，再决定稳定输出；
9. 完成 PR A 的二进制政策和 source schema 文档；
10. 再进入 multi-part story gate。

当前仍有三个明确目标，必须继续分批：

1. Object_layer、静态舞台两个辅助构建器：改读已验证的 RAW choreography
   TextAsset，并逐个做候选 parity 和 5174 消费者回归；
2. 其余 183 个非 Backmonitor USM：结合 masterdata 消费者进行分类；
3. multi-part story promotion gate：从单剧情原子契约扩展到集合。

下一批首选 `prepare-live-chibi-object-layers.py`，只替换它的 CSV 来源，
复用已验证的 RAW TextAsset 映射；先跑隔离候选与稳定 parity，再在 5174
复验实际 Object_layer，不要同时修改静态舞台构建器。

只有用户明确要求跳过供应链收束、继续视觉内容批次时，才直接转到
`event_story_visual:003hok`。

## 9. 必读索引

新窗口按顺序阅读：

1. 本文；
2. `notes/03_audit/RAW_MASTERDATA_FULL_AUDIT_20260726.md`；
3. `notes/05_exploration/RAW_MASTERDATA_MIGRATION_20260726.md`；
4. `notes/04_refactor/STORY_POST_MERGE_HANDOFF_20260723.md`；
5. 与本次修改域直接相关的脚本和 test，不要只读文档；
6. 若涉及 Runtime，再读
   `notes/03_audit/STORY_AUTHORITATIVE_V2_SCHEMA_20260723.md` 和
   `notes/03_audit/STORY_FORMAL_COLLECTION_MIGRATION_20260722.md`。

## 10. 新窗口最终报告模板

每个有界阶段结束时报告：

```text
基线
- branch
- HEAD
- origin HEAD
- worktree

本批范围
- 改了什么
- 明确没改什么

来源证据
- RAW 路径与 SHA-256
- Unity PathID / ACB cue / master table evidence
- derived 输出 SHA-256

验证
- source-only 命令
- build
- 5174 candidate
- publish
- rollback exact hash
- final republish
- 真实音频（如适用）

Git
- commits
- push 结果
- PR/CI 状态

未完成
- 下一项
- 风险
- 需要用户决定的边界
```

不要用“测试都通过”替代具体命令，不要用“页面能打开”替代资源 URL、尺寸、
点击导航和回滚 hash，也不要用 source-only CI 代替真实媒体验收。
