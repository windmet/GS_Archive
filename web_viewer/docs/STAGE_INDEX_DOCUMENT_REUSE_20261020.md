# 舞台索引：复用解析文档与来源哈希

输入 `ea7a5447`，分支 `stage/20261020-native-followup`，工作目录 `E:/Web_build/SideM_Archived/web_viewer`。本批推进 [加载策略](STAGE_LOAD_STRATEGY_20261020.md) 的重复读取/哈希问题；按歌曲分片、开播并行化和加载预算仍未完成。

## 改动

`StageIndexTransport.js` 在既有 bounded transport 的单次请求中解析 JSON，返回共享源文档。需要来源校验的消费者调用文档的惰性 `hash()`：并发与后续调用复用同一 Promise，哈希成功后释放文档闭包里的原始字符串；未使用的哈希不计算。失败可重试。文档与派生工作随原有 LRU 缓存淘汰，没有另建无限缓存。

`BoundedTextTransport` 新增可选 decode 步骤，默认仍返回文本/二进制。请求与 decode 完成后都检查请求代次及取消状态，晚到结果不能重新入缓存。上限仍为单文件12 MiB、累计16 MiB、16项（以源 UTF-8 字节计，不等于 JavaScript 堆上限），没有加大预算。

`liveChibiSpine.js` 的编舞、RAW inventory、Penlight、mouth fix、motion offset/clock、Stagelight、舞台效果和旧悬灯轨道均消费该文档。各自原有来源 hash/identity 校验保留。对象索引不再经过 `liveJson` 后重复读取；必需 emitter/APK 内置对象与后续 Bloom、Sprite 几何使用同一 source/hash，四条可选补充仍独立到达，并保留取消守卫。

## 固定调用序列对照

使用真实本地语料、实际生产 loader 函数，序列为：编舞；并发 inventory/Penlight/mouth/offset/clock/Stagelight；舞台效果；对象及四个可选补充。前版函数来自 `git show ea7a5447:web_viewer/src/utils/liveChibiSpine.js`，两边均使用同一12/16 MiB预算、磁盘响应适配器和数据文件。

| 项 | 前 | 后 |
| --- | ---: | ---: |
| SHA-256 调用 | 13 | 5 |
| 对象索引 loader 调用 | 4 | 1 |
| 对象索引实际读取 / 解析 / SHA-256 | 1 / 1 / 3 | 1 / 1 / 1 |
| 整个序列实际读取 / JSON.parse | 22 / 22 | 22 / 22 |
| 编舞索引实际读取 | 2 | 2 |
| 序列结束缓存源字节 / 项数 | 12,885,685 / 8 | 12,885,685 / 8 |

全部实际 loader 返回值及最终可选补充结果 deepEqual。后版还断言消费者没有修改共享源文档。此次改善的是重复哈希及对象加载链，不能写成网络请求减少或开播时间改善。编舞仍会因大文档挤占缓存而重读；分片问题已经由该序列复现。

小型证据留在本 checkout `.analysis/stage-index-compare.mjs`、`stage-index-before-source.js`、`stage-index-compare.json`、`stage-index-compare.log`。对照源码 SHA256：前 `2721370c0f2c424ad571d497fd1b48168f79b31f885eacc79aebbaa88c11638f`，后 `53151913e23793b19977e2439b26cf157123bcde1a3fd8f5da8b3d22b8c7b825`（实验读取的 LF 文本）。不将忽略目录的语料或构建包加入提交。

## 回归与构建

新增 `verify-stage-index-transport.mjs` 进入源码门禁：并发/顺序读取一次解析、惰性哈希、失败重试、同 URL 新代次绑定、取消单个订阅不伤及其他订阅、全部取消与 decode 期间失效不入缓存、非法 JSON/HTML、UTF-8 字节和 LRU 限额。

既有 loader 注入测试通过公共 harness 使用运行时同一文档 decoder，未复制解析或哈希实现。已运行实际对象、旧悬灯、Spotlight、Penlight、motion clock 和 RAW inventory 回归；`verify-architecture-cleanup` 的通用 transport 故障合同通过。

`npm run verify:source-batch`：155/155，通过，日志 `.analysis/stage-index-source-batch.log`；新增文档回归在此后补充同URL新代次、异步decode取消/失效分支，并再次单独执行通过。

`node scripts/verify-stage-index-transport.mjs --published-assets` 实际语料校验通过，日志 `.analysis/stage-index-corpus.log`。常规 `build:check` 2,967 modules / 19.25秒；`verify:build-audit` 通过，启动 JS gzip 204,721字节，未放宽204,800预算。构建 revision为 `ea7a5447`、sourceDirty=true，包含本批未提交修改；固定 `.analysis/build-check`，不复制 public。日志 `.analysis/stage-index-build.log`。

## 真实 Browser

沿用已核实的5213/PID50520、当前checkout，未重启其他端口。Codex In-app Browser / cua_repl；旅程：K.now O.nly详情冷刷新 → 进入舞台 → Time Before Time → 播放/暂停/回拖 → TBT冷刷新 → Change to Chance → 返回歌曲。

- TBT 5秒 ready=true，四个overlight/water对象均在，unsupported为空，native粒子161；预载动作后播放从5秒推进到30.3秒，暂停回拖5秒后仍为161。
- 桌面1280×800与手机尺寸390×844截图；手机scrollWidth=innerWidth=390。TBT冷刷新后仍为四对象就绪。
- Change to Chance 26.5秒 ready=true，灯具包含ID1401/1403，对象列表切到cgtocc，不残留TBT对象。
- bootstrap release为 `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`；返回URL `/songs/knwonl/?maintainer=1`，标题及完整难度/Combo表格载入。
- error列表为空；保留Pixi/Spine tint/update弃用警告。没有框架错误覆盖层，临时viewport已恢复。

截图 `stage-index-tbt-desktop.png`、`stage-index-tbt-mobile.png` 和控制台 `stage-index-console.json` 位于 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/`。这些是dev服务、普通桌面浏览器与模拟视口的集成证据，没有新增生产包、真机、冷网络测速或原片等价结论。无关文件保留，构建生成审计/翻译差异已恢复，没有部署。

## 后续分片输入

本批重新统计实际文件（不是旧交接数值）：编舞9,407,807字节；舞台效果9,295,640字节；Stagelight commands 7,502,146字节；object emitters 2,942,198字节。编舞118份 song 条目的紧凑序列化最大154,175字节；舞台效果30份 stagelightSongs 最大1,174,385字节；Stagelight commands单条目最大1,068,583字节。不能仅以文件分割替代消费者与来源绑定改造。

下一批先确定小清单和逐编排 shard 的 hash 合同，再调整生成器、共享解析/验证与选歌时加载；需保留完整编排身份、源文件/原始源 hash 及当前依赖校验。随后才能减少全局读取与首屏字节，并按相同曲目/视口/缓存状态重测开播。本文没有声称完成这部分。
