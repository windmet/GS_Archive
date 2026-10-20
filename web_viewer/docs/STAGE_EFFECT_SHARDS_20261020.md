# 舞台效果与 Stagelight 成对分片

输入 `f77f89ad`，分支 `stage/20261020-native-followup`，工作目录 `E:/Web_build/SideM_Archived/web_viewer`。fetch后master仍为 `5aab5644`。接续 [编舞分片](STAGE_CHOREOGRAPHY_SHARDS_20261020.md)，本批移除实际舞台对全局 `stage-effects/index.json` 和 `stage-stagelight-commands.json` 的读取。emitter/Penlight等索引、加载并行和真实开播预算仍开放。

## 合同与接线

清单 `public/data/stage-effect-shards.json` 绑定四份规范输入：stage-effects、Stagelight commands、旧悬灯sidecar和自定义Sprite sidecar。规范stage-effects SHA256为 `20ffab45aebbc6ebbbb8013dc11a3d48dee79c8dfae9e6cd0e6c54d1addaf499`；编舞来源仍为 `c3e249f6afda4f7c4d4b05022d7fe778e3a1247378f679c58fa5ff8ead39ef0a`。

- 公共文件保留光束、Spotlight、背屏、人物影子、旧/新悬灯及其原生来源数据；使用既有native attach validators，不重新定义其能力或partial边界。
- 每份编排片保留本曲Stagelight原始指令、旧按songCode轨道及两者引用的现有模型。未引用模型不加载；本来缺失/不支持的模型没有伪造为支持。
- 清单与common/片均有schema、来源hash、身份与内容寻址路径合同；运行时核对common与片SHA256，错误使准备失败，无全局文件回退。坏缓存失效后可重试；单个调用方取消不影响仍在等待的同源调用方。
- `ChibiStageViewer` 首次准备和切歌使用成对的 `{effects,commands}`。切歌时先清退，再并行请求编舞片和灯光片，匹配buildSequence后同时安装，之后加载音频/人物；移除旧的全局效果与全局Stagelight异步接线。
- 局部 `commands.eventCount` 是本片行数，另保留 `sourceEventCount=29661`，不把局部数据伪装为全局轨道。coverage仍按当前编排的真实事件/模型判断。

严格对照发现规范JSON含少量 `-0`。默认JSON.stringify会丢失符号，因此公共序列化保留signed zero，并拒绝保留标记碰撞；没有放宽deepEqual或改写黄金源数据。全部118份实际loader输出在公共字段、所选原生轨道、旧轨道和引用模型上与原消费者逐字段一致，包含该数值边界。

## 生成与发布边界

`npm run prepare:stage-effect-shards` 生成；`node scripts/prepare-stage-effect-shards.mjs --check` 无写入重放；`npm run verify:stage-effect-shards -- --published-assets` 核对全部118片、公共文件、原生来源和实际loader。生成器与verifier直接使用运行时同一编译/解析/校验模块。

清单41,149字节，common243,521字节，118片合计16,070,029字节，最大单片2,251,580字节。DRIVE片704字节，HND1,067,388字节，MOON45,070字节。输出复用E盘 `public/assets/live-chibi/stage-effects/shards/`，没有全媒体包或C盘资产副本。

清单入Git，common与片属于忽略语料；发布前必须生成并纳入清单引用的 **119份效果文件**，另需前批118份编舞片及两份清单。本轮没有上传R2、打完整发布包或部署。新增清单及三个输入使用LF约束，避免跨平台字节hash漂移。发现工作区三份输入仍为CRLF后，核对去CRLF后的字节与HEAD的Git blob完全相同，再规范化并重放生成；未改内容或规范舞台索引hash。以下为LF合同下重跑的计数，不沿用早期CRLF输入数字。

## 同序列loader测量

`node scripts/measure-stage-effect-shard-loading.mjs <编排ID>` 使用真实生产loader、相同12 MiB单文件/16 MiB源字节/16项缓存预算、磁盘响应适配器；两边均已使用编舞分片。序列包含选曲、五项来源绑定输入、灯光、对象和四个后续补充。所选原生轨道、引用模型、公共字段与其他消费者deepEqual。

| 曲目 | 前/后原始读取字节 | 前/后请求 | 前/后缓存源字节 |
| --- | ---: | ---: | ---: |
| DRIVE默认 | 22,860,890 / 6,259,251 | 19 / 18 | 10,980,023 / 5,855,433 |
| HND | 22,938,320 / 7,403,365 | 19 / 18 | 10,980,023 / 6,922,117 |

新路径不读全局编舞、全局stage-effects或全局Stagelight commands；旧全量API保留给规范语料审计/对照。证据 `.analysis/stage-effect-shards-{drive,hnd}-comparison.json`。这是固定索引序列的原始字节和调用计数，不是Browser全请求、gzip传输、JavaScript堆或开播时间测量。

## 验证

- `verify:stage-effect-shards -- --published-assets` 通过：118份规范源与实际loader对照，日志 `.analysis/stage-effect-shards-corpus.log`；`--check`重放通过。
- portable回归覆盖空轨道切换/模型范围、来源/身份/路径、common与片坏哈希重试、共享取消、signed zero、完整目录身份与跟踪输入hash。已进入源码门禁。
- `npm run verify:source-batch`：157/157通过，日志 `.analysis/stage-effect-shards-source-batch.log`。
- LF规范化并重放后再次完整门禁157/157通过，最终日志 `.analysis/stage-effect-shards-final-source-batch.log`；byte/hash合同按最终LF输入验收。
- `build:check`：2,969 modules / 26.00秒，audit启动JS gzip204,699字节，通过204,800预算。输入revision `f77f89ad`、sourceDirty=true，含本批未提交修改。日志 `.analysis/stage-effect-shards-build.log`；固定 `.analysis/build-check`，copyPublicDir:false。
- HTTP抽验common、DRIVE、HND、MOON、Change to Chance五份文件，均application/json且SHA256吻合；不是119份HTTP全检。

## Browser 旅程

Codex In-app Browser / cua_repl，dev服务5213、同一checkout和 `rm-release-20261015` 候选。新增public文件在旧Vite映射下返回HTML，因此核实原PID61468后重启本轮服务；LF重放后再次只重启5213，最终PID40120，日志 `.analysis/stage-effect-shards-final-vite.log`。未触碰5177/5212。

| 旅程 | 实际结果 |
| --- | --- |
| K.now O.nly冷刷新→舞台 | 3/3就绪、非空页面，无框架错误覆盖层 |
| HND 27秒 | ready=true，Stagelight14、Spotlight3、Sprite激光18、Whole_screen粒子38；预载后播放推进至72.4秒，暂停回拖27秒仍为14组固定灯 |
| HND→TBT | ready=true，Stagelight清为0；5秒四个内置对象与161 native粒子仍在 |
| LF后的MOON冷刷新 | 6秒ready=true，旧悬灯18个正常实例，201–204四个未决实例保留；capability=partial，没有改写完整还原状态 |
| LF后的MOON→HND | 27秒再次14/3/18/38，模型与指令正常同批切换，更新桌面截图 |
| 手机尺寸390×844 | scrollWidth=innerWidth=390，MOON画面/控制台载入；不是手机真机 |
| 返回歌曲 | `/songs/knwonl/?maintainer=1`，标题K.now O.nly与完整难度/Combo表格实际载入；无残留舞台参数 |
| 控制台 | error列表为空，保留既有Pixi/Spine tint/update弃用警告 |

HND播放/TBT清退旅程在首轮完成，LF重放只改变原始换行/hash与片名，原生值已逐字段重验，并重新做MOON冷载和HND回切。前端代码与上述构建输入一致；LF重放后的数据验收使用最终全门禁、HTTP和Browser，未冒充重新打包。

截图 `stage-effect-shards-hnd-desktop.png`（1280×800）、`stage-effect-shards-moon-mobile.png` 与 `stage-effect-shards-console.json` 位于 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/`。临时viewport已恢复，bootstrap实际release仍为 `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`。没有生产包/原片/真机/冷网络耗时结论。

构建生成审计/翻译差异已核对恢复；无关删除、未跟踪文档、语料、脚本和证据保留。下一批继续emitter/Penlight索引及加载预算。
