# Penlight 与原生 emitter 按需分片（2026-10-20）

输入 HEAD `aeda8a8d`，分支 `stage/20261020-native-followup`，已同步 master `5aab5644`。本批继续 [加载策略](STAGE_LOAD_STRATEGY_20261020.md)，在既有编舞和效果分片之上移除实际舞台对两份全局 Penlight/emitter 数据的读取。

## 消费与来源合同

- 新清单 `public/data/stage-consumer-shards.json` 绑定原始 Penlight 指令、模型、emitter、编舞和对象索引 SHA-256。公共文件保留完整 Penlight 模型、指令头、emitter 头及纹理表；118 份逐编排 Penlight 片、80 份按原始名称区分大小写的 emitter 模型片按实际歌曲引用加载。
- 原始模型、轨道、对象附件合同保持不变，使用已有原生校验器及保留 signed zero 的序列化器。局部 Penlight `eventCount` 只计当前轨道，`sourceEventCount=6697` 保留全局来源计数。未知的32种对象资源仍无 consumer，没有用全局回退掩盖缺口。
- 当前歌曲、加载代次和 lifetime signal 共同约束首次结果与晚到 refinement；A→B→A 也不会接收第一轮 A 的结果。缓存使 refinement 先于 base 返回时，保留最新完整快照，避免 base 覆盖已接入的内置对象/地板粒子等。Penlight 失败仍允许其他舞台层继续，保留警告和失败状态。
- 生成器 import 运行时同一编译逻辑；文件哈希、曲目身份、源绑定失败即拒绝，损坏缓存会失效后允许重试。原有未传 songId/song 的全局接口保留给其他检查工具。

## 实际 loader 固定序列

两侧均已使用编舞与效果分片；这里只切换 Penlight/emitter 的全局/按需入口。测量为原始索引字节，不是 Browser gzip、完整网络、堆或开播时间。

| 序列 | 原始读取字节：前→后 | 请求：前→后 | 缓存保留字节：前→后 |
| --- | --- | --- | --- |
| DRIVE | 6,259,250 → 1,793,954 | 18 → 19 | 5,855,432 → 1,282,361 |
| HND | 7,403,364 → 2,964,360 | 18 → 21 | 6,922,116 → 2,272,233 |

两组 selectedConsumerParity 均通过。按资产拆分增加请求数，不能据此断言开播更快。日志 `.analysis/consumer-shards-{drive,hnd}-comparison.json`。与上一批基线1字节差异来自 Penlight 输入换行统一为 Git LF blob，而非原生值变化。

## 验证

- `npm run verify:consumer-shards -- --published-assets`：118份 Penlight 和实际引用 emitter 的原始值/模型等价，完整对象索引和按需索引经过全部4种晚到附件后，所有选中对象条目 deepEqual；验证 uppercase 名称、signed zero、哈希污染重试、身份绑定、取消，以及 refinement 早到和 A→B→A。最终文件名/绑定守卫修改后已重跑通过。
- `node scripts/prepare-consumer-shards.mjs --check` 通过；既有 built-in objects、Penlight、stage intent 回归通过。
- `npm run verify:source-batch`：158/158。日志 `.analysis/consumer-shards-source-batch.log`；随后补充的两处身份守卫已单独重跑上述全语料 consumer 回归。
- 最终 `npm run build:check` 通过：2,971 modules / 24.86秒，启动 JS gzip estimate 204,713 / 204,800；固定 `.analysis/build-check`，不复制 public。首次构建期间源码变动导致 audit 拒绝，最终重跑日志 `.analysis/consumer-shards-final-build.log` 才是有效结果。生成的无关审计/翻译差异已恢复。
- 5213 为当前 checkout 的 Vite，PID21756，candidate `E:/Web_build/GS_Archive_Domain_Work/rm-release-20261015`；未操作5177/5212。公共文件、DRIVE/HND Penlight、大小写 emitter 示例4份 HTTP 返回 application/json 且 SHA 匹配；并非199份全量 HTTP 验收。

## Browser 实际旅程

使用 Codex In-app Browser / cua_repl，当前 dev 服务；bootstrap release `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`。

| 检查 | 结果 |
| --- | --- |
| K.now O.nly | ready=true，3个 Penlight group、143个 renderer |
| Time Before Time → HND → Time Before Time | TBT 5秒四个内置对象、161个原生粒子、83个 Penlight renderer；HND 27秒14个 Stagelight、83个 Penlight renderer；此刻 HND 粒子未活动，不算 emitter 可见性验收。回到 TBT 仍为上述对象和数量 |
| 实际播放 | TBT 时间轴推进到108,300ms后手动暂停、回拖5秒；不是全曲稳定性结论 |
| 1280×800 / 390×844 | 实际舞台及控制台载入；手机尺寸 scrollWidth=clientWidth=390。刷新后再次 ready=true，5秒仍161粒子、83应援棒；刷新是文档重载，不代表网络缓存清空 |
| 返回歌曲 | `/songs/knwonl/?maintainer=1`，无 stage/song/view 残留；K.now O.nly、成员、音频与难度/Combo表实际加载 |
| 控制台 | 捕获无 error；保留既有 Pixi/Spine tint/update warning。临时 viewport 已恢复 |

小型证据目录 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/`：`consumer-shards-tbt-{desktop,mobile}.png`、`consumer-shards-console.json`。本轮不构成生产包、原片逐帧或真机等价验收。

## 发布与剩余工作

清单65,202字节；ignored 派生文件共199份：公共239,886字节、118份 Penlight 共1,643,044字节、80份 emitter 共2,772,925字节。以后打包/发布必须运行 `npm run prepare:consumer-shards -- --write` 并包含清单引用的全部199份文件，连同前批118份编舞、119份效果及对应清单。源码 Git 提交不等于资源已上线；本批没有部署、上传或修改 release。

下一步是定义可开播条件、拆分必要/可晚到加载阶段、测量真实冷加载并设预算；另有 skel 缓存、资源发布以及32种无 consumer 对象、Sprite淡入、原片/设备对照。无关删除与未跟踪证据保持原样。
