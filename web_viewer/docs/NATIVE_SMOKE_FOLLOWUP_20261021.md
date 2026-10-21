# Multiple Entertainment Show / PROOF OF ONESELF 烟雾接入

2026-10-21，输入 `6d7538cb`，分支 `stage/20261020-native-followup`。四组既有 RAW 烟雾现已接入受限 Noise 预览消费者；没有改原始编舞、粒子数学、renderer 或歌曲显示逻辑。未部署。

## 来源与原始窗口

| 资源 | RAW bundle / SHA-256 | 系统与首段窗口 |
|---|---|---|
| `fx_in_mtples_smoke_1/2` | `song_mtples.unity3d` / `80984f4f71cecd5de575676684ab914a3aead0a9e1630dce693a91dca41b474c` | 各2系统；41850ms激活、56450ms停止并在1ms内退场；84800、121800ms重新激活 |
| `fx_in_pfofos_smoke_l/r` | `song_pfofos.unity3d` / `df476e543d448a3bd79faafa5431c0534d2d7f3e3019e815d5a1122052401a46` | 各2系统；9000ms激活、9900ms停止、10600ms退场；10700ms再次激活，后续保留原脚本节奏 |

八个系统均满足现有 `native-high-curl-v1` 消费范围，无新增未支持模块：高质量、单 octave、同轴、无 remap、常量 Noise 强度/滚速/位移，原始 positionAmount=1、rotationAmount=sizeAmount=0。`chibi-object-emitter-promotions.json.previewAssets` 追加四项来源，锁定 bundle hash、serialized file、64位PathID、parameter-tree hash、系统数和 `noise_preview`。完整晋升清单32项不变；不把 preview 注册说成完整 Unity 粒子还原。

两份 Texture2D 都名为 `fx_in_yivygr_smoke`，512×512，各222532 bytes。PNG像素与已接入的共享烟雾相同，PNG SHA为 `4e19b2f015339b94aa363ae90486cd2bbdab29f0f785f0def95c45ae76e1fcd8`，但原生来源不同，保留独立身份：

- mtples：`CAB-17d8b1feaa0ce1d0aebec4163212003f:-456654634331026395`，RAW object SHA `a0075ac24f4e0f8e4f838e81892d17bb80f4ad931a2ca33afb72f6643ecc5d70`，派生 `732271f8d5859572f2fa1ef1.png`。
- pfofos：`CAB-b35fe75805d7cc73f68dc2f6c9f56b98:-456654634331026395`，RAW object SHA `5c51df5e229f73f1cade4ef87e11297ae2dd4a8d5744ddaaf40c9fc89f3192d0`，派生 `e0cf2224571e1c8f2b7a5389.png`。

本地纹理晋升写入 publication v2 记录 `2026-10-21-native-smoke-followup-001`，不是 R2 上传记录。账本204 releases / 1368 stable IDs；受管PNG403张 / 72758488 bytes。两份新PNG合计445064 bytes，没有复制媒体包。

## 消费与覆盖

原有82组模型、95份纹理描述与输入逐值相等。现在86组 / 732系统 / 97纹理，0 deferred；40系统保留partial，其中32 Noise preview、7 stretch omitted、1 stretch preview。新消费者分片为1 common + 118 Penlight + 86 emitter，共205份。加上其余两类分片，发布闭包为4份索引 + 442份分片，共446个必需文件、32980327 bytes；旧失效分片保留在盘上，不进入当前闭包。

实际引用粒子137种，缺消费者30→26，相关事件413→369，涉及编排17→16；partial资源13→17，源索引缺失仍为0。PROOF OF ONESELF的火焰和其他未支持资源仍保留缺口，没有把整首歌标成完整。

## 验证

- `prepare-chibi-object-emitters.py --consume-deferred`：重新从挂载RAW提取并逐RGBA像素比对，86/732/0 deferred/97通过；source-only探测结果及前后模型对照保存在本机 `.analysis/stage-smoke-*20261021*`。
- `verify-chibi-object-emitters.mjs --published-assets`：来源、能力边界、原RED HOT BEAT参考窗口、全部六组烟雾的32个真实show/restart窗口、停止后寿命、回拖及冷seek通过。新增四组占其中24个窗口。
- consumer shards生成、实际闭包的路径/大小/SHA逐项核对、发布账本和受管PNG检查通过。
- `npm run verify:source-batch`：164/164通过。`npm run build:check`：2979 modules / 20.46s，入口gzip 206036 / 215040，源码输入为`6d7538cb`加本批改动；只输出固定`.analysis/build-check`，不复制public。日志及审计在`.analysis/smoke-followup-{source-batch.log,build.log,build-audit.json}`，不是完整媒体发布包。
- `verify-current-archive-baseline.mjs --source-only`通过。最初误用source-only重生成整份基线，清空了离线人口字段；已恢复原历史基线，只更新本批PNG计数。按既有门禁同步5份文档的账本摘要标记；没有据此声称当前整库RAW/剧情人口重新验收。

实际Browser dev 5213，候选仍为 `rm-release-20261015`、release `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`：

1. mtples完整模式45000ms：两组烟雾出现在加载资产列表，unsupported/deferred为空，1087个native粒子；56500ms烟雾从列表退出，倒回45000ms恢复1087。桌面1280×800、手机390×844均查看，手机文档无横向溢出；viewport已恢复。
2. 通过曲库切到pfofos：9500ms左右烟雾均载入，100粒子；10400ms停止后剩84；10600ms资产/粒子清空；11200ms下一段恢复100，回拖9500ms也为100。实际预载后播放推进至16000ms再暂停。
3. 整页刷新pfofos后再次seek9500ms恢复100；检查页console error为0，现有Pixi/Spine警告保留。返回 `/songs/pfofos/?maintainer=1`，标题、THE虎牙道成员、2:14音频和113/210/528/768 Combo表真实载入。

截图位于本机Codex visualizations：`mtples-smoke-45s-{desktop,mobile}.png`、`pfofos-smoke-9500-desktop.png`、`smoke-followup-console.json`。临时检查页结束已关闭。

新分片曾被原5213进程50348返回为HTML；核实进程后仅重启这一端口，保持候选，新PID74324，新分片/纹理实际加载通过。没有更改生产、测试站或R2绑定。

Web RNG、Noise轨迹、60Hz积分、原片和真实设备/GPU对照仍为预览边界。后续继续剩余26种未接入资源及其他公共语义，不将这四组接线作为全舞台完成。
