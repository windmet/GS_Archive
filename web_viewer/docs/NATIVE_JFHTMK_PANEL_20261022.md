# JOYFUL HEART MAKER：倾斜父链与非等比尺寸面板

输入 `c2a5c99e`，继续 `stage/20261022-particle-gaps`，接续[倾斜父链面板](NATIVE_LOCAL_PARENT_PANELS_20261022.md)。本批接入 `fx_in_jfhtmk_panel_1` 的四个系统，未上传 R2、未部署。

## 非等比尺寸的原生分派

前批探针为非等比尺寸设置了多个输入，却仍直接调用等比二维 writer `0x81e2e0`；这个分支不能证明矩形粒子的正确几何。回查同一 Unity ELF 的真实分派：`0x809240` 检查粒子流的 `+0x7b4`，非等比分支经跳表进入 `0x809604`，最终 `0x809618` 调用 `0x815a1c`。本批没有通过修改原生期望值使旧错误探针通过。

新回放设置非等比标志，保留初始尺寸流 `+0x2a0/+0x2c0/+0x2e0`，执行正确的非等比二维 writer。四个实际 RAW 父链各取三种受控粒子角、三组局部 XYZ 出生点，共 36 例；两系统采用实际 5.5×7.5×1 尺寸，另两系统保留受控等比尺寸 2。真实层级构造、renderer context、顶点与 UV 均由原生代码执行；新增代码窗口和跳表字节绑定进 fixture。

36/36 与实际采样器相符。连同前批 90 例，共 126 例本地父链角点通过；旧二维父矩阵在其中 78 例丢失局部 Z，不能作为新资源的替代路径。旧 62 例旋转/父链回归及 17 份三维粒子来源覆盖继续通过。

没有回放整个分派器的分配/清理调用或 InitialModule 的 RAW→运行时转换；尺寸流是明确的受控输入，不是原游戏随机种子、出生或帧历史。非等比尺寸与三维粒子旋转的组合仍未准入。

## 准入与尺寸裁切范围

新增 `native-local-size-orthographic-v1`，复用前批完整父矩阵和已有二维矩形尺寸计算，仅对来源绑定的四系统开放。提取器锁定 bundle SHA、系统精确来源/参数树、父链、alignment、size3D 标志、证明 SHA 及完整编舞 SHA。

还直接读取了四份 RAW renderer 的尺寸限制，均为 min=0、max=50。该曲最大镜头 zoom=1700、物件 scale=1000、父链各轴尺度为1；源尺寸最大7.5。按原生宽舞台尺度的保守上界，世界尺寸至多约10.417，而最小视野下的最大尺寸界仍约294.118，故本来源范围不触发裁切。证明以该曲最小视野构造原生 context，源码门禁继续检查这组上界与编舞 SHA；没有据此给任意资源或镜头放开尺寸裁切。

## 字节哈希的跨平台修正

复核发现前批 local-parent fixture 在 Windows 本地由 Python 写成 CRLF，但 Git blob 为 LF，公开模型引用的是本地 CRLF 的 SHA；换行转换会使来源绑定失败。现在生成器明确写 LF，并只给 `chibi-local-parent-native.json`、`chibi-local-size-native.json` 两份按字节绑定的证明增加 `eol=lf`。

Git filtered checkout 与本地文件的字节/SHA 均已实测一致。旧90例的解析内容和期望值不变；運命光年/VIVA 两组仅更新证明哈希，原104组模型的几何/生命周期字段与117份纹理描述均不变。新36例也绑定同一 LF 合同。没有放宽成同时接受多个任意来源哈希。

## 资源与验证

- 晋升1资源/4系统、新增2张RAW RGBA纹理；公开105资源/844系统/119纹理，deferred0。既有105个partial系统保持原标记。
- 缺口8→7资源、124→121事件、5→4编排。
- 台账212 releases / 1,390 stable IDs；425 PNG / 74,896,306 bytes。本批PNG增量32,347 bytes。
- consumer目录72,383 bytes、common251,900 bytes、emitter3,381,747 bytes；来源/hash检查和全部4目录+461分片闭包通过，共465文件/33,541,367 bytes。后续发布仍须包含闭包，本批未发布。
- `npm run verify:source-batch`：167/167。随后LF元数据修正后，emitter、consumer、来源重提取及source-only基线补跑；未把字节变化当作新视觉数学。
- `npm run build:check`：2,974 modules / 25.73秒，固定`.analysis/build-check`且不复制public；生成的审计元数据已还原。
- 原生生成器的默认90例和`--nonuniform`36例不写入重放均通过；RAW像素与提取绑定亦通过。

日志：`.analysis/local-size-build-20261022.log`、`.analysis/local-size-source-20261022.log`；缺口报告`.analysis/local-size-coverage-20261022.json`。

## Browser

Codex In-app Browser，主checkout5213 / 最终PID21936（初次实播69656），`rm-release-20261015`候选、完整加载。沿用手工五人编队，不是原曲成员验收。桌面1280×720、手机390×844；手机document/scrollWidth均390。

10秒面板可见，唯一对象资源为`fx_in_jfhtmk_panel_1`，7个粒子；20秒退场为0，22.5秒重启为7，回拖10秒恢复7。实际从10秒起播，观测至76.5秒；暂停成功，时间轴84.5秒且DOM为已暂停。最终进程的冷加载定位10秒恢复7；实际舞台内切至VIVA先清空旧对象，随后ready=true、876粒子，验证前批LF哈希修正后的消费者仍可加载。

LF元数据修正后新增了哈希分片，旧Vite进程仍按启动时public快照返回HTML，冷加载曾出现对象索引不可用及一次seek error。已通过真实HTTP确认失败路径，重启同一5213后新分片返回application/json；独立最终Browser会话重新验收通过。旧日志保存在同截图目录的`local-size-stale-server-logs.json`，没有清空错误后冒充零错误会话。

最终会话采样窗口ready=true、unsupported/deferred为空、console error=0，不宣称warn=0；页面身份与内容正确，截图未见框架错误覆盖层。截图保存在本机`C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/`：`local-size-jfhtmk-10s-desktop.png`、`local-size-jfhtmk-10s-mobile.png`。

剩余shape17面板、pcuslv Bloom、tktkkt电弧和bnckgy火焰继续开放。上述证据不是动态父链、透视、Native RNG/Noise、原生时钟、原片或设备整场景验收。
