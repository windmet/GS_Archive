# SideM 本地存储与下一轮托管压缩审计（2026-09-24）

## 结论

下一轮优先做 **结构化数据的无损 gzip 部署派生物**，随后做 **语音 AAC 64/72k 听感与播放验证**。继续压 PNG、直接裁剪所谓 unused voice，优先级均较低。本次只审计 SideM；没有删除原件、修改 runtime/exporter、上传、部署或清理远端。

## 输入和证据边界

- 输入 HEAD：`9eb5afcb564f81e7147e6ec742980fd832c16d84`，分支 `codex/personal-about-page`，不是附件假定的 master。
- 已读 [构建与磁盘政策](BUILD_ACCEPTANCE_POLICY.md)。本轮仅新增报告，未构建或启动服务。
- 开始与结束检查 Git 状态；原有 `../.analysis/`、`docs/GS_ARCHIVE_PREVIEW_WEBP_R2_HANDOFF_DEEPSEEK.md`、`docs/sidem_title_fx_css_rebuild_v9.html` 未改。
- 本地 `.deploy/r2-manifest.json` 修改时间为 2026-09-14 18:31:46，98,032 对象、9,077,136,481 B（8.454 GiB）。逐条核查 staging 文件存在与大小，缺失 0、大小不符 0；本地 inventory 的 staging 总数、字节也相同。不是全量 hash 再验，也不是远端现状。
- 与当前 source 路径核查：缺失 0，**526 个源文件大小已变化**，主要是 data；没有检查所有同大小文件的内容变化。此旧 manifest 不能作为下一次上传的当前发布清单。
- [部署文档](PREVIEW_DEPLOYMENT.md) 记载 8.479 GiB 与远端旧快照；本轮未访问远端，未改写该历史数字。未验证线上对象、免费预算或账户费用。
- 旧 manifest 仍记录 82 个缺失外部音频（75 BGM、6 SE、1 ambient），它与本轮剧情语音未解析引用是不同统计。

## 本地磁盘占用

扫描 `E:/Web_build/SideM_Archived` 内文件，合计约 **31.691 GiB 逻辑文件长度**；不是 NTFS 实际分配空间，也不对硬链接去重。动态证据目录可能随扫描变化。配置中的外部 legacy root `E:/BaiduNetdiskDownload/SideM` 未递归盘点，因此这不是所有 SideM 历史副本总量。

| 位置 | GiB | 处理建议 |
| --- | ---: | --- |
| `web_viewer/.deploy/r2` | 8.454 | 当前旧 staging；建立新 manifest 后按发布批次替换，不累积整库副本 |
| `web_viewer/public/assets` | 6.697 | 本地运行时源，不覆盖压缩 |
| `web_viewer/public/data` | 0.417 | 当前运行时数据，与旧 staging 有漂移 |
| `RAW/asset` | 3.474 | 保留档案原件 |
| `RAW/audio` | 2.215 | 保留 ACB 等原件；未来优先由原件生成低码率派生物 |
| `RAW/movie` | 1.997 | 保留档案原件 |
| `web_viewer/.analysis` 总计 | 7.003 | 包括下列子项，不能再相加 |
| `.analysis/raw-migration` | 2.049 | 迁移来源与证据，不因名称自动删除 |
| `.analysis/edge-*` 与 `qa-edge-*` | 3.994 | 多套浏览器 profile；抽查包含 Default、组件、缓存。清理前逐目录查用途、在用进程并保留必要证据 |
| `.deploy/canary` | 0.780 | 666 个文件，多为渲染对照图与帧；不是可直接删的整库构建副本 |

扫描时 C 盘剩余约 70.2 GiB、E 盘约 479.6 GiB。没有清理任何目录；没有在 C 盘创建媒体输出。进程只做盘点，没有停止其他窗口或项目。

## 托管体积与压缩机会

### 1. 结构化数据：全量无损实测，优先级最高

以旧 staging 为输入，Python gzip level 9、mtime=0，逐文件在内存压缩，逐文件断言解压结果与原字节完全相同；没有持久化第二套压缩 corpus。

| 范围 | 文件数 | 原始 B | gzip B | 节省 |
| --- | ---: | ---: | ---: | ---: |
| `assets/lipsync/` | 24,472 | 762,449,799 | 112,957,170 | 85.18% |
| `assets/live-chibi/motions/` | 9,078 | 342,183,972 | 77,954,215 | 77.22% |
| `data/compiled/` | 10,420 | 344,043,886 | 21,677,569 | 93.70% |

合计 **43,970 文件：1,448,677,657 → 212,588,954 B，节省 1,236,088,703 B（1.151 GiB）**。应用到该旧 staging 的算术结果约为 **7.303 GiB**，不是已部署结果，也不包含更新的 data 内容。

这比先做有损背景更值得投入。需实际将 gzip 字节存入对象才能减少对象存储；仅网络传输压缩不会改变已存对象大小。

当前 `functions/_shared/r2-resource.js` 手动构建 Content-Type、Length、Range、ETag，**未设置 Content-Encoding**。R2 官方支持 `httpMetadata.contentEncoding` 及 `writeHttpMetadata`，但当前项目尚未接通：[Cloudflare R2 API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)。不能直接覆盖对象然后期待现有路由自动解压。

实现批次应同时处理：明确 JSON allowlist、稳定 logical URL、物理对象映射与 gzip 编码版本、source/encoded 双 hash 和双 size、上传 Content-Encoding、GET/HEAD/304/Range 与 Accept-Encoding 行为、缓存更新、旧对象回滚策略。验证 JS fetch 解码后数据与消费者使用的 source hash 一致，不能拿 encoded hash 验解码后内容。真实 Browser 覆盖剧情、口型、舞台动作和阅读。音频不要纳入此 gzip allowlist。

### 2. 语音：有损样本已量化，听感未验收

当前 `public/assets/voice`：**32,421 个 M4A、2,681,894,417 B（2.498 GiB）**。提取脚本 `data_pipeline/extract_voice.py` 使用 AAC 128k。

选取按文件大小排序的 24 个等距分位样本（含两端），生成 AAC 64k 与 72k；保留源文件，每个派生物 ffprobe 并完整 ffmpeg 解码，全部成功。

| 方案 | 24 个样本字节 | 相对原样本 | 对全库节省的粗略外推 |
| --- | ---: | ---: | ---: |
| 原 M4A | 2,268,293 | 100% | — |
| 64k AAC | 1,173,855 | 51.75% | 1.205 GiB |
| 72k AAC | 1,309,536 | 57.73% | 1.056 GiB |

样本为 AAC-LC、44.1kHz，其中 23 条单声道、1 条双声道；转码保留原声道数。大小分层不是随机总体估计，也未覆盖已标注的喊叫、气声、混音污染；**不代表听感、Safari 或真实播放通过**。样本容器时长最大增加约 0.023 秒，下一轮需检查对白切换、尾音和口型时序。

下一步扩展至 100–200 条按角色、时长、音量/表演类型选取的听感对照，保留 64/72k 两档；选定后只生成部署派生物。如果 RAW 可可靠映射，应从原音频解码生成，避免继续串联有损转码；本轮体积样本来自现有 M4A，必须标注这一差别。

2026-09-24 后续源文件预检：当前 32,421 个 M4A 全部在 `voice_index.json` 中，映射到 3,447 个不同 ACB 路径，全部存在；索引中也没有缺失的 M4A。证据为 `.analysis/storage-audit/voice-source-preflight.json`。一次 vgmstream 实测确认 `appeal/001tom/2_5_001_00.acb` 的 subsong 1 名称为 `2_5_001_00_04_01`，源编码为 CRI HCA、44.1 kHz、单声道。此预检仅证明路径闭包和一个 cue 样本，尚未证明全量 cue/subsong 身份、PCM 对齐或听感；正式样本必须逐条核对 cue 后从 ACB 解码，不沿用 AAC→AAC 估算样本作为发布字节。

### 3. 歌曲范围比“61 首”更大

旧 manifest 中 `assets/live-chibi/music` 有 **109 个 M4A、319,284,266 B（304.49 MiB）**，另有 index.json；61 是 song playback catalog 的 full-mix 条目数，不是目录全部文件数。

`assets/song-experiment` 另有 **250 个 M4A、710,522,439 B（677.61 MiB）**。App 和 ArchiveSongExperimentalPlayer 确实消费实验音轨，不可按目录名当 unused。两组共约 982 MiB。

两组各抽最小、中位、最大三个文件探测：music 样本为双声道约 190–193kbps，experiment 样本含单声道约 175kbps及双声道约 193kbps。不能给全组直接套“192→128 省三分之一”；需要把 full mix、个人声部、伴奏分别定质量政策，并做可听对照。当前仅探测，没有歌曲降码率实测。

### 4. live set：有必要做，但目前不能支持大量删语音

复用 `resolveVoiceFilenameCandidates`，扫描 13,596 个 public/data JSON，10,416 个 scenario、70,465 个 dialogue voice 出现项。对其他数据采用字符串/文件名保守匹配：

- 26,271 个现有语音可由 scenario 引用/候选匹配。
- 连同 card_index、card_detail_index、short_adv_profile_index 等，共匹配 **31,339 个**现有语音。
- **1,082 个、27,933,014 B（26.64 MiB）**未匹配。它们是待调查项，不是删除清单。
- 剧情中 183 个出现项未解析到现有候选，对应 68 个不同 voice 字符串；这不是 183 个不同缺文件，更不能用来裁剪。

字符串匹配可能包含目录索引、不可达条目，保留所有候选也可能高估使用量；尚未证明完整消费者可达性。未来正式图应覆盖 story/card/music/portal/chibi/communication，记录 required/optional、逻辑别名、候选回退、场景与页面根，输出 referenced / unresolved / not-yet-classified 三类。禁止以 grep 没找到作为 unused 结论。

### 5. 去重与图片

旧 manifest 的 SHA-256 分组有 **2,411 组重复对象**，理论可合并 **104,634,000 B（99.79 MiB）**。这使用既有 placement hashes，未重新对全部文件 hash；实施前必须重算、确保媒体类型和请求映射一致。跨路径案例包括 card-art/cards 的大图、不同 costume 的同一 skel。当前 URL→object key 为确定性规则，尚无任意 alias 表，因此不是删掉重复路径就完成。

背景当前 lossless staging 为 **514,753,670 B（490.91 MiB）**。附件的 q86 可作为以后样本方案，但本轮没有生成或视觉验收有损背景，不把“≤65%”目标当实测收益。Spine/UI 保留现有策略。

## 下一轮可执行批次

1. **基线更新**：只读重新枚举当前源与依赖，生成新审计清单，处理 526 个 size drift 与已知缺失，核对远端最新 inventory；不覆写当前可回滚 manifest。
2. **无损数据托管压缩**：先小型端到端 canary，补齐 exporter、Pages 响应、manifest、HTTP/hash 验证，再做上述三域全量派生物。相关回归 + build:check + 实际 Browser；完成前不能称发布成功。
3. **语音听感批次**：100–200 条听感与时序对照，选 64k/72k，再全量；和 gzip 分开提交，便于定位回归。
4. **歌曲分域评估**：109 条 music 与 250 条 experiment 分开估算和验收，不取消已有玩家功能。
5. **最后再考虑**精确去重、背景有损、严格可达集合裁剪。收益不能简单相加：去重/裁剪后基数会变化。

本地清理另开一批：profile 用途与进程核对后按白名单清理；保护 RAW、证据与正在使用的 profile。远端 GC 必须基于活跃版本/回滚版本 manifest 并集、远端差集报告与明确删除授权，不仅根据当前版本或文件年龄删除。

## 本地证据与复跑

证据固定放 `web_viewer/.analysis/storage-audit/`（Git ignored）：`inventory.json`、`analysis-directories.json`、`source-drift.json`、`voice-references.json`、`audio-samples.json`、`secondary-samples.json`、`gzip-full.json`。64/72k 的 48 个小样本在同目录两个子文件夹，约 2.37 MiB。

保留了 `inventory.py`、`voice-references.mjs`、`audio-samples.py`、`secondary-samples.py`、`gzip-full.py` 作为本机复跑记录；从 web_viewer 执行 Python/Node 脚本。它们是一次性审计工具，依赖当前本地 manifest、媒体工具和 ignored 语料，未作为稳定 CI 工具提交。inventory/source 检查只证明列出的范围，不证明完整 live-set 或实时远端。

验证：全量 staging 文件数/大小；全部 manifest source 的存在/大小；24×2 音频解码；43,970 个文件 gzip round-trip；报告数字及相对链接核查；git diff --check。未跑 build、Browser 或远端 HTTP，因为没有变更应用、资源映射或部署。
