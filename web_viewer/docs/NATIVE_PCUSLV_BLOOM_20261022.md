# precious love 四组 Bloom 原生接线（2026-10-22）

输入HEAD `79628853`，分支 `stage/20261022-particle-gaps`，已包含master `bc991170`。本批不是PR、R2上传或部署。

## RAW与实际缺口

`fx_in_pcuslv_bloom_1..4` 每个3个ParticleSystem，12系统全部接入，没有裁掉第三层。来源bundle、对象PathID、参数树SHA和父链记录在 `scripts/fixtures/chibi-limit-curve-native.json`，提取时逐一绑定。

重新读取RAW纠正了此前的缺口描述：12系统的ClampVelocity均 `separateAxis=false`、`inWorldSpace=false`，drag为常量0；两个multiplyDrag flags虽为true，但没有非零drag。前两层的magnitude为寿命曲线，第三层为常量1。实际未接原因是曲线上限和第三层的倾斜Local父链，而不是独立轴/非零拖曳组合。

仅四个实际资源通过promotion中的 `limitProfile` 选择新路径。绑定来源必须无Noise、Velocity、非零重力，初速非负且为常量或双常量；拒绝独立轴、world-space限速及非零drag。第三层初速严格为0，限速不产生位移，仍保留原模块和来源。

## 原生限速与顶点证据

Unity ELF SHA256 `acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0`。

- 真实ClampVelocity `0x6f8e28`、位置积分 `0x6d1e9c`。夹具给曲线槽注入RAW无权重Hermite系数，给particle `+0x3c0` 注入寿命百分比；原生数学指令照常执行，只有外部powf走已有float32 ABI适配。
- 4资源/12系统，108条受控轨迹/3312步，包括静止、单轴和有正负分量的三轴初速，1/60、1/30及0.1秒步长。Web逐步位置/速度最大差 `3.7822399674425355e-6`，门槛 `1e-5`。另验证实际对象采样器接收到正确寿命、缓存回拖及不足一帧的积分。
- 新增 `src/core/chibiParticleLimit.js`：每步先按寿命进度采样上限，再以 `1-(1-dampen)^(dt*30)` 阻尼超限速度，最后积分位置。采用可回拖的60Hz Web网格和有界缓存。旧常量限速路径不变。
- 四个倾斜Local系统另有36组原生层级/context/顶点用例，覆盖不同位置和角度；夹具为 `chibi-bloom-parent-native.json`，复用已验证的完整父链矩阵。
- RAW renderer尺寸上限前两层为1、第三层为10，min=0，pivot/flip=0。用无权重Hermite的Bezier控制点凸包给出生尺寸乘寿命尺寸求保守上界，结合该曲maxZoom=1900、对象scale=1000和舞台缩放上界，证明本来源不触发renderer尺寸夹取；编排hash变化会拒绝提取。

这不是曲线烘焙、原生age更新/调度、出生RNG、游戏场景、原片或设备回放。夹具显式给定步长和每步结束的寿命进度，不能据此宣称原生帧时钟一致。保留既有Noise、Stretch、mixed/CanvasGroup、投影/遮挡等边界。

## 消费与验证

完整资源106→110、系统847→859、纹理122→123，deferred仍为0。既有106模型与122纹理描述逐项不变。既有105个partial系统（89 Noise、9 Stretch preview、7 Stretch omitted）没有改标。普通promotion为41资源/209系统。

新增1张PNG，196,702 bytes；总429 PNG /75,481,945 bytes。receipt `2026-10-22-native-pcuslv-bloom-001`、publication共214 releases /1394 stable IDs；纹理parity仅指RAW RGBA一致。

consumer目录73,817 bytes，common253,826 bytes，emitter3,452,142 bytes。完整磁盘闭包4目录+466分片，共470文件/33,615,122 bytes，真实文件/hash/大小检查通过，未上传。无consumer缺口6→2资源、120→52事件、3→2编排，剩 `fx_in_tktkkt_electric` 与 `fx_in_bnckgy_fire`。

`npm run verify:source-batch` 167/167；`npm run build:check`通过，24.51秒，固定 `.analysis/build-check` 且不复制public。2,978 modules。构建生成审计元数据已还原。两份原生夹具无write重放、发布数据重新从RAW提取比对、分片check、台账与二进制清单检查均通过。源码基线verify-current-archive-baseline --source-only通过（10420 compiled JSON记录、429 PNG）。额外运行未加source-only的全库模式时，因本地public/data/compiled/5_01_101_22.json不是Runtime v2而失败；本批未修改该剧情语料，不能称全库验收通过。

日志 `.analysis/bloom-source-20261022.log`、`.analysis/bloom-build-20261022.log`，缺口报告 `.analysis/bloom-coverage-20261022.json`。

## Browser

Codex In-app Browser，主checkout5213/PID73284，候选 `rm-release-20261015`，完整模式；继承手工4人编队，不作原曲成员验收。全部数据生成后重载同一端口，新分片实际消费成功。

桌面1280×720：3.5秒尚无Bloom资源，总对象粒子120；4.5秒四组均载入，总粒子338，地板光斑可见；8秒重复触发342，65秒后段166；回拖4.5秒恢复338。实际从4.5秒起播，观察到61.2秒，之后手动暂停，DOM在71.2秒显示已暂停。

手机390×844，document/scrollWidth=390，4.5秒仍338。冷重载后关闭加载方式弹窗，定位4.5秒恢复四组Bloom/338。实际舞台内切歌至VIVA，先清空旧对象至0，再ready=true/876，资产仅VIVA面板。采样窗口ready=true、unsupported/deferred为空，console error=0；不宣称warn=0。页面身份、有效内容和截图正常，无框架错误覆盖层。

截图位于 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/`：`bloom-pcuslv-4s-desktop.png`、`bloom-pcuslv-4s-mobile.png`。临时Browser页已关闭、视口覆盖已复原。
