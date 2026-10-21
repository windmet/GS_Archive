# RED HOT BEAT!! 左右烟雾接入（2026-10-20）

输入 HEAD `d6e246193440c05d5ee79b96a149f531b68dd486`，分支 `stage/20261020-native-followup`。本批只接入这首歌的两组缺失烟雾，不改舞台数学、UI 或原始编舞指令；未部署。

## 原因与来源

`fx_in_rehobe_smoke_l` / `fx_in_rehobe_smoke_r` 原先有编舞命令，但不在 emitter 消费清单内，因 NoiseModule 留在缺失列表。两者均来自 `asset/song_rehobe.unity3d`，SHA-256 `1399e48e3ee667b2af3dad469386e4b26f15bf357b5e7e06f8b76b51a9ef685f`，各含两个系统。

第一段在 11000 ms 激活，24900 ms StopEmitting，27900 ms 对象退场；因此用户指出的 20 秒处应有烟雾。其余激活点为 66300、79000、93350 ms；对应前两段停止点为 73050、85700 ms。

使用已有 `native-high-curl-v1` Noise 消费者。新增独立 `previewAssets` 清单，锁定 bundle SHA、四个系统的 serialized file / PathID / parameter-tree SHA、系统数量及 `noise_preview` 标记。32 项完整晋升清单不变；来源或能力变化会拒绝生成。没有逐曲目手调参数。

共用纹理 `fx_in_yivygr_smoke`，512×512，标识 `CAB-2d181f4ecdef97c2f4b3cbb23201f889:-456654634331026395`；RAW object SHA `02cbec0e32c667508795cd526479e2220b5d84e75f7ff817b474c1ce3ac536a2`。派生 PNG 222532 字节，SHA `4e19b2f015339b94aa363ae90486cd2bbdab29f0f785f0def95c45ae76e1fcd8`。publication v2 账本记录的是本地公共纹理晋升，不代表 R2 上传或生产部署；64 位 PathID 在 semantic evidence 中以字符串保真记录，数字字段置空。

## 数据与边界

原有 80 组模型、94 张纹理与输入 HEAD 逐值一致。现在为 82 组、724 个系统、95 张纹理，其中 32 个系统保留 partial（24 个 Noise preview）；没有 deferred 系统。消费者分片为 1 common + 118 Penlight + 82 emitter，共 201 片；三类目录闭包共 438 片。旧分片仍在盘上，打包闭包排除失效路径。

全编排消费普查：137 种被引用粒子资源，无消费者 32→30，相关事件 427→413，编排 18→17；partial 资源 11→13。加入预览消费者不等于完整还原。Web RNG、60 Hz 积分网格、原片/真机/GPU 对照仍开放。

## 验证

- `python scripts/prepare-chibi-object-emitters.py --consume-deferred`：82 / 724 / 0 deferred / 95，RAW 参数和 RGBA 像素复核通过。
- `node scripts/verify-chibi-object-emitters.mjs --published-assets`：源绑定、20 秒存活、停止后消退、倒回/冷 seek 一致、后续重启通过。
- consumer-shards 生成复核、consumer 回归、分片闭包回归通过；真实 3 目录 + 438 片共 32923105 bytes 的路径、大小、SHA-256 逐项核对通过。
- `npm run build:check`：2974 modules，26.08 秒；输出 `.analysis/build-check`，不复制 public；构建 entry 审计通过，启动 JS 204703 / 204800 gzip bytes。
- `npm run verify:source-batch`：160/160 通过。
- binary inventory / archive baseline source-only / publication ledger 通过。新纹理按稳定晋升资源登记，401 张 tracked PNG / 72313424 bytes。

Browser 使用 Cua In-app Browser，Windows，本地 dev 5213，候选 `rm-release-20261015`。旅程：RED HOT BEAT 舞台 full → 20000 ms → 28000 ms → 倒回 → 播放 → BRAND NEW FIELD → 切回。20 秒模型包含左右烟雾，unsupported 为空，粒子 952→1134；28 秒对象清空。切回及整页刷新后重新 seek 20 秒，均恢复 1134 粒子。页面有正常人物/歌词/控制台，无框架错误遮罩。现有 Pixi Spine 弃用告警保留，检查的控制台无相关应用错误。桌面截图 `rehobe-smoke-fixed-20s.png` 为本机小型 QA 证据，不包含媒体包。

新分片生成后，旧 Vite 服务曾将新路径返回 HTML；核实原 PID/目录后仅重启 5213，保持相同候选，HTTP 复核返回 JSON。重启期间旧 Browser tab 进入连接失败页，在同一 Browser 新 tab 恢复；没有使用额外浏览器后端。

回退方式：回退本批源码/数据/纹理登记后重新生成 consumer shards。未执行生产回滚，未删除原始资源。部署时必须携带当前目录引用的全部分片及新 PNG。
