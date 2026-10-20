# 编舞目录与逐编排分片

输入 `e86d2a00`，分支 `stage/20261020-native-followup`，目录 `E:/Web_build/SideM_Archived/web_viewer`；fetch 后 master 仍为 `5aab5644`。这是 [加载策略](STAGE_LOAD_STRATEGY_20261020.md) 的第一组实际分片，接续 [文档复用](STAGE_INDEX_DOCUMENT_REUSE_20261020.md)。舞台效果/Stagelight/emitter 分片、并行开播、真实加载时间预算仍开放。

## 来源与运行时合同

原全局编舞 `choreography/index.json` 保留为生成器和全语料审计的规范输入。其 SHA256 为 `c3e249f6afda4f7c4d4b05022d7fe778e3a1247378f679c58fa5ff8ead39ef0a`。新 `public/data/stage-choreography-shards.json` 是轻量目录，保留118份编排身份、标题、站位、变体/vocalSetting、动作目录、统计和原始来源绑定；不含全曲时序数组。

每片包含完整的一份原始 song 及对应 Spotlight、Whole_screen、Searchlight 原生轨道。片名包含完整内容SHA256；清单绑定片名、字节数、编排ID、songCode、source，运行时核对片的SHA256和身份，再复用原生 attach validators。坏哈希失效缓存，缺失/损坏不会回退全局编舞。

页面初始化读取目录后，只加载所选编排；切歌先停止并清退旧场景，等待新片验证，再准备音频、人物和时序。目录项本身不算 stage-ready；切歌异步返回还要匹配当前 buildSequence。页面保留完整曲库，但不长期保留每首已访问歌曲的时序数组。

依赖编舞来源的 inventory、Penlight、mouth fix、motion offset/clock、Stagelight 和 object emitter 从已验证目录接收明确的规范源绑定。它不是“已经下载并重新哈希了原全局文件”的声称：规范源 hash 由生成时读取实际原文件得到，发布前全语料验证证明每片与规范源一致；运行时验证目录/片的合同与片内容hash。原来的无binding全量loader仍供语料校验/对照使用，实际舞台显式走分片路径。

## 生成、检查与资源边界

- `npm run prepare:choreography-shards`：从规范编舞与三份原生sidecar生成目录和内容寻址分片。
- `node scripts/prepare-choreography-shards.mjs --check`：重算并逐文件比对，不写入。
- `npm run verify:choreography-shards -- --published-assets`：复用运行时同一编译/解析/校验函数，核对全部118片与旧消费者的逐字段输出、SHA256及字节数。
- 默认portable verifier无需忽略语料，校验合成两曲切换、只请求所需片、缓存重访、路径/身份/错源/坏哈希/404/取消，以及实际binding消费者不读取全局编舞。还核对已跟踪三份sidecar的真实hash与目录共同部分。清单与三份输入新增LF约束，避免跨平台字节hash漂移。

目录342,248字节；118片共11,482,820字节，最大293,665字节，均位于E盘现有 `public/assets/live-chibi/choreography/shards/`。这是派生JSON，不是完整媒体包。目录入Git；分片属于既有被忽略的public/assets语料，需用上述生成器重建。**将来打包/发布必须包含目录引用的全部118片**，单独推源码与目录不等于已发布这些资源。本轮没有R2上传、完整打包或部署。

## 同序列实际loader对照

`node scripts/measure-choreography-shard-loading.mjs drvalv_live_effect` 执行真实生产loader，磁盘响应适配器、相同12 MiB单文件/16 MiB累计预算；比较全量路径与分片路径。序列为编舞/选中歌曲、六项来源绑定输入、舞台效果、对象及四个后续补充。所有选中歌曲与消费者返回值deepEqual。

| 项 | 全量路径 | 分片路径 |
| --- | ---: | ---: |
| 该索引序列原始读取字节 | 43,576,234 | 22,861,054 |
| 该序列读取请求 | 22 | 19 |
| 全局编舞读取 | 2 | 0 |
| 三份全局原生灯光轨道读取 | 各1 | 0 |
| 结束时缓存源字节 / 项数 | 12,885,685 / 8 | 12,862,909 / 10 |

证据 `.analysis/choreography-shards-load-comparison.json`。这个序列减少20,715,180原始字节（约47.5%），不是Browser全部请求/gzip传输字节/开播时间的测量。其他全局大索引尚在。

## 回归与构建

`npm run verify:source-batch` 156/156通过，日志 `.analysis/choreography-shards-source-batch.log`。此后补充的binding消费者故障、损坏缓存重试分支单独再跑通过，全部118片重新验证通过，`--check`无写入重放通过。HTTP抽验TBT片93,475字节和Change to Chance片100,059字节，application/json且SHA256与目录一致；没有把两份HTTP抽验外推为118份HTTP测试。

首次 `build:check`：2,968 modules / 24.46秒，`verify:build-audit`启动JS gzip204,704字节，通过204,800预算；坏缓存重试修正后的最终构建2,968 modules / 27.89秒，audit为204,705字节。日志 `.analysis/choreography-shards-final-build.log`。构建输入revision `e86d2a00`、sourceDirty=true，包含本批未提交修改。均使用固定 `.analysis/build-check`、不复制public；不是完整发布包。

## Browser 与本机验收

继续用Codex In-app Browser / cua_repl。新增public文件在旧Vite的public映射下返回HTML，因此核实原PID50520后只重启5213为PID61468，候选仍是 `E:/Web_build/GS_Archive_Domain_Work/rm-release-20261015`；未动5177、5212。bootstrap实际release为 `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`。

| 旅程 | 实际结果 |
| --- | --- |
| K.now O.nly详情冷刷新后进入舞台 | 非空目录和实际舞台3/3就绪，无框架错误覆盖层 |
| TBT切歌、播放、回拖 | 5秒四个内置对象、161 native粒子、unsupported为空；动作预载后推进至44秒，暂停回拖5秒后粒子仍为161 |
| Change to Chance切歌 | 26.5秒ready=true，新悬灯包含1401/1403，Whole_screen类型3/5；对象清单切为cgtocc，无TBT残留 |
| 手机尺寸与冷刷新 | 390×844，scrollWidth=innerWidth=390；冷刷新Cgtocc后再次回拖26.5秒，同样就绪并含1401/1403 |
| DRIVE多编排 | 目录仍有20个编排选项，含完整组合名与Solo标签；选择Jupiter后实际ID为 `drvalv_live_effect_01jup`，2/3/4号位、ready=true |
| 返回歌曲 | URL `/songs/knwonl/?maintainer=1`，标题K.now O.nly与难度/Combo表格实际载入 |
| 控制台 | error列表为空，保留既有Pixi/Spine tint/update弃用警告；没有宣称零warning |

桌面1280×800 `choreography-shards-tbt-desktop.png`、手机 `choreography-shards-cgtocc-mobile.png`、控制台 `choreography-shards-console.json` 位于 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/`。临时viewport已恢复。这是dev服务与模拟手机视口的集成验收，没有原片/真机/生产包或Browser冷网络耗时结论。

构建生成的审计、翻译release/manifest差异核对后恢复；原有 `../040ren_child.txt` 删除及无关未跟踪文档/语料/脚本/证据保留，仅提交本组明确路径。
