# 舞台加载策略：下一轮交接（2026-10-20）

舞台线下一轮以加载策略为主，MV 消费检查为辅，不再逐首修补。本页是起点；数据来自 2026-10-19 在 `stage/20261014-native-fidelity`（已并入 master，PR #55）上的冷缓存 CDP 实测。

10-20 舞台线更新：新分支 `stage/20261020-native-followup` 已完成新悬灯 Sprite、Time Before Time 内置对象、公共 RGBA 接线，并同步 #53。下文 MV 旧待办以 [最新续批入口](STAGE_FOLLOWUP_20261020.md)及[合并验证](STAGE_MASTER_SYNC_20261020.md)校正；本页加载测量仍保留历史输入，没有宣称重测。

10-20 加载续批：[共享解析文档与惰性来源哈希](STAGE_INDEX_DOCUMENT_REUSE_20261020.md)已接入。真实loader固定序列SHA-256从13次降至5次、对象索引调用从4次降至1次，返回值完全一致；读取/解析仍各22次，编舞因LRU挤占仍读两次。下文第2项已推进，分片和加载时间/字节预算仍开放。

## 实测基线（drvalv 默认曲，1280×800，冷缓存，dev 服务）

10-20进一步落地 [编舞逐编排分片](STAGE_CHOREOGRAPHY_SHARDS_20261020.md)：342KB目录、118份按需片；实际舞台不再读取全局编舞及Spotlight/Whole_screen/Searchlight三份全局轨道。默认DRIVE的固定loader序列原始字节43.58MB→22.86MB、请求22→19、输出一致。它不是本节Browser冷加载测量的重跑；stage-effects、Stagelight、emitter全局数据和后续预算仍待推进。

- 2504 个请求，0 个错误，堆 157 MB。除开发态代码外约 51 MiB。
- 全局索引 34.4 MB 原始 / 1.95 MB gzip，其中约 26 MB 按歌曲键组织，可以分片：
  - `live-chibi/choreography/index.json` 9.4 MB（`songs` 8.74 MB）
  - `live-chibi/stage-effects/index.json` 9.3 MB（`stagelightSongs` 7.47 MB）
  - `data/stage-stagelight-commands.json` 7.5 MB（`songs` 6.85 MB）
  - `data/stage-object-emitters.json` 2.9 MB（`assets` 2.63 MB）
  - searchlights 1.75 MB，penlight-commands 1.66 MB
- 每首歌：`body-1.skel` 3.1 MB、`body-3.skel` 2.65 MB（gzip 只省约 30%），m4a 2.97 MB，舞台背景/组件约 3 MB，每套服装 `cos.png` 约 0.4 MB。
- 舞台代码 chunk 只有 211 KiB（66 KiB gzip），瓶颈不在代码。

## 已经是风险的两点

1. `liveChibiSpine.js` 的 `indexTransport` 单文件上限 `maxBytes` 12 MB。choreography 已 9.4 MB，每批 MV 都在长；超过就整台舞台打不开。
2. 同一 transport 的缓存 `cacheBytes` 16 MB，而 choreography + stage-effects 两个就有 18.7 MB，LRU 互相挤掉。实测 `object-layers/index.json` 被下载两次，多半就是这个原因（未单独证实）。

## 建议顺序

10-20续进 [舞台效果/Stagelight成对分片](STAGE_EFFECT_SHARDS_20261020.md)：实际舞台改为41KB清单、244KB公共文件和逐编排片，保留原生合同与signed zero。默认DRIVE固定索引序列22.86MB→6.26MB、HND22.94MB→7.40MB，所选消费者一致。stage-effects/Stagelight两份全局读取已移除；emitter/Penlight索引、加载并行、真实开播预算继续开放。

1. **按歌曲分片全局索引。** 一个小清单记每首歌的分片文件和 sha256。现在若干 sidecar 用「整个 choreography 文件的哈希」绑定（`choreographyIndexSha256`、`objectIndexSha256` 等，见 `attachNativeSpotlights`、`attachObjectEmitters`、`attachNativeOldSuspension`），分片后改为绑定分片哈希。这是先要定的设计。生成器和 verifier 必须 import 运行时同一个解析函数，不写镜像。
2. **每个索引只读一次、只哈希一次。** `fetchLiveChibiObjectLayerIndex` 现在同一个文件读 4 次、哈希 3 次。整个开场主线程上有 13 次 SHA-256 和约 34 MB 的 JSON.parse；分片后大部分会消失。
3. **加载阶段并行。** 现在严格串行：索引 → 歌曲 → skel → 服装 → 粒子（`ChibiStageViewer.vue` 选歌初始化约 1268–1325 行）。歌曲一确定，音频、skel、服装就可以同时开始，灯光和粒子之后到。前提是写清「可开播」的定义：哪些必须到齐，哪些可以在播放中补上并有可见状态。
4. **每首歌的大文件。** 两个 skel 能否跨歌共享、按哈希长期缓存；10-19 并入的 115 张舞台 PNG（+10.6 MB）是否像其他资源一样移到 R2。
5. **把测量变成预算。** 用 CDP 冷加载测量做 verifier，给「可开播时间、首帧前字节、请求数」设预算，像 `verify:build-audit` 的启动 JS 预算一样。

## MV 消费检查（辅线）

每批新 MV 跑一次覆盖清单，而不是逐首修补。当前未完成项见 [STAGE_LAYER_AUDIT_TODO_20261014.md](STAGE_LAYER_AUDIT_TODO_20261014.md)：

- Time Before Time（tibeti）：4 个 APK keeper 已定位未接线。
- Change to Chance（cgtocc）：只定位到 24.4 秒的原指令，未修。
- 32 个粒子资源（18 首编排中的 427 个事件）还没有消费者。

## 注意

- CI 没有语料。读 `public/assets/**` 或其他 gitignore 语料的检查只能在 `--published-assets` 下运行；合并前在 LF worktree 里把门步骤拆成单条命令逐个跑，链式步骤会把后面的失败藏住。

## Penlight与emitter加载续批

舞台线已继续接入 [Penlight与emitter按需分片](STAGE_CONSUMER_SHARDS_20261020.md)：118份应援棒轨道、80份原生模型按歌曲引用读取，并修复缓存refinement早到与切歌代次归属。固定索引序列DRIVE降至1.79MB、HND降至2.96MB；请求18→19/21。158项源码门禁、build:check与桌面/手机尺寸Browser通过；后续发布另需199份派生文件，本轮未部署。真实开播预算与原片/设备对照仍开放。
