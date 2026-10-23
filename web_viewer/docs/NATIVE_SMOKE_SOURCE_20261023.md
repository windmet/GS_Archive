# 独立 Smoke：来源与原生四边形核对

2026-10-23，输入 HEAD `d4c23ee0`，分支 `stage/20261022-particle-gaps`，主 checkout。本批固化源证据和受控原生几何，`Smoke` 仍是缺少消费者；不把此证据批记成烟雾接线完成。

## 指令与工厂

全118编排 RAW 复查，独立 `Smoke` 共5行：

| 编排 | 时钟ms | 命令 |
|---|---:|---|
| strclb_live_effect | 1072 | Show，value1=1、value2=1、value3=1500 |
| strclb_live_effect | 6944 | Erase，value1=1、value102=100 |
| tnsdst_live_effect | -2000 | Show，value1=1、value2=10000、value3=1900 |
| tnsdst_live_effect | 18000 | Erase，value1=1、value102=1800 |
| tnsdst_live_effect | 120000 | Show，value1=1、value2=10000、value3=1900 |

`SmokeLiveEffectTypeExecuter.PlayEffect/EraseEffect` RVA `0x25c16c4/0x25c1720` 走虚调用。类型声明和 `GetTargetObject 0x1d6f858`、`GetTargetObjectByPrefabNameSuffix 0x1d6f904` 确认走共享 `LiveObjectContainer.GetOrCreate 0x221a2d0 / Create 0x221a470`，按类型与id缓存，Create重新设置父节点并归一根TRS。已绑定既有common context中的container `resources.assets:123890`、parent `resources.assets:10178`。

`LiveObjectSmoke.PlayEffect 0x2225df4` 按value1启用down(1)或side(2)，按value3给六个粒子Renderer排序，再逐个调用Play（回调 `0x1c9ec74`）。value2没有在此消费，不能把10000当作寿命或渐入时长。`EraseEffect 0x2225f88` 的回调 `0x1c9ec90` 调用 `ParticleSystem.Stop(true,1)`，即停止发射并保留在世粒子；此路径不读取value102，不应照搬Object_layer的Sprite渐退。

## 内置源绑定

- XAPK unityData SHA256 `d35231c0b00a09f6941f47f7ffedde9e9b35701f5b66d6f432517da860e1a500`；managed ELF SHA256 `9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e`。
- `resources.assets:132564` 是唯一LiveObjectSmoke，132 bytes。序列化offset32/44分别引用down/side根GameObject，offset56开始的列表含6个ParticleSystem；两组分别2与4个系统。这5条来源行都只选择group1，但保留全部六个系统证据。
- 组1为 `smoke02 / smoke02_front`，非等比size3D为20×3.3×1，rendererBounds为0…50；不能挪用其他资产0…1的尺寸夹取约束。
- 六系统均alignment=1、moveWithTransform=1、Shape.type=12且速度非零。当前通用采样器首先拒绝alignment；解除单一guard不足以接线。
- 材质都引用 `resources.assets:951 / Mobile/Particles/Alpha Blended`。两个Texture2D分别为 `fx_stage_smoke_02`（171×1024）和 `fx_stage_smoke_01`（256×256）；记录源对象、decoded RGBA、采样设置和shader哈希，没有导出新的public图片。

来源、全部模块、链条、Renderer bounds、5条CSV原值及11个managed指令窗口存于 [chibi-smoke-source.json](../scripts/fixtures/chibi-smoke-source.json)。字段`status=source_audited_consumer_missing`，与现有注册表的missing保持一致。

## 原生几何探针

[prepare-chibi-smoke-billboard-fixture.py](../scripts/prepare-chibi-smoke-billboard-fixture.py) 复用原生Transform/renderer context构建器 `0x6cf028/0x6c505c`，按源size3D标志分别执行scalar writer `0x81e2e0` 或nonuniform writer `0x815a1c`。没有把普通系统改走nonuniform分支。仅free(NULL)做ABI适配；镜头矩阵、粒子位置、尺寸和角度是明确的受控输入。

6系统的尺寸/角度端点与-10/0/+10度镜头组成42个用例，全部原生运行和无写入重放通过。alignment1的world-space四边形在镜头Z旋转下保持不变；另3个alignment0反事实对照随镜头变化，排除了镜头输入未生效的假阳性。组1宽高保持20×3.3。结果见 [chibi-smoke-billboard-native.json](../scripts/fixtures/chibi-smoke-billboard-native.json)。

两份fixture以LF检出以保护字节哈希。旧Noise核与9个billboard角度/53个父链用例在复用时仍通过；没有改写旧fixture、前端消费者或公开资源。此批执行源/工具与原生重放验证，不增加应用构建或Browser验收结论。

## 可重放命令与下一步

`python scripts/audit-chibi-smoke.py` 比较完整RAW/资源/当前guard证据；加 `--native-il2cpp <原始decrypted ELF>` 还会核对完整二进制身份与全部11个指令窗口。初始化可用 `--write --native-il2cpp <ELF>`，不依赖本地Ghidra导出文件。

`python scripts/prepare-chibi-smoke-billboard-fixture.py --native-engine <libunity.so> --unicorn-path <runtime>` 重放受控原生几何；初始化追加 `--write`。本机两个命令均执行通过。

待闭合：moving-edge初始位置/速度、本地模拟的粒子位置更新、运行时container/舞台比例/实际镜头桥接、生命周期与UV/材质消费。原生RNG、逐帧与设备证据仍不具备。本批没有放宽现有采样器guard或增加一个只显示“已接入”的空消费者。

## 移动边缘出生补证

输入 HEAD `91f61d32`。进一步调用完整Shape分发器 `0x855d64` 时，发现此前受控环境未执行静态初始化，BSS `0x126fed0/0x126fee0` 为零，源中的−90°旋转退化为单位矩阵。只读追踪WRITE引用定位到 `_INIT_184 0x1c3d68`，由原生入口初始化其SIMD常量；没有在Python里代填猜测的旋转矩阵或跳过Shape计算。

[prepare-chibi-smoke-edge-fixture.py](../scripts/prepare-chibi-smoke-edge-fixture.py) 先保留未初始化的失败对照，再实际运行该initializer，记录 `0x126fe50…0x126ff10` 的前后字节。6个源系统各5组受控种子，共30批/120个粒子，完整经过分发器、random-edge worker `0x860774` 与方向归一化 `0x8611d8`。保留原始位置/方向、原生矩阵、输出位置/方向以及RNG最终状态，结果绑定源fixture和引擎SHA。每批确认为一次四通道xorshift128抽样；这只是受控输入，不是原机种子/时钟还原。

新增 [chibi-smoke-edge-native.json](../scripts/fixtures/chibi-smoke-edge-native.json) 与 [verify-chibi-smoke-edge.mjs](../scripts/verify-chibi-smoke-edge.mjs)。回归直接执行现有 `sampleEmitterShape` 和从同一源码提取的私有 `euler`，没有复制另一套旋转实现。120个原生位置/单位方向、随机状态及源绑定对照通过，已纳入既有object-emitter验证入口。组1的−90°把原始+Y方向变成+X；源两组均与当前JS的Z→X→Y旋转一致，因此本批不改网页方向公式。

重放命令：`python scripts/prepare-chibi-smoke-edge-fixture.py --native-engine <libunity.so> --unicorn-path <runtime>`；初始化fixture追加 `--write`。JS对照：`node scripts/verify-chibi-smoke-edge.mjs`。无写入原生重放、来源审计均通过。仅新增独立工具/fixture/回归，不影响前端运行依赖，不跑Vite或新增Browser结论。

Shape输出仍是单位方向，给分发器传入speed缓冲区不等于执行了初始模块的速度缩放。此次只闭合受控moving-edge出生位置/方向；初始速度、本地模拟、side组重力/限速、实际场景桥接和渲染消费者仍待完成，`Smoke`保持missing。

本次 `npm run verify:source-batch` 为167/167，verifier coverage确认新增检查随object-emitter入口进入CI。fetch后当前分支已包含 `origin/master 8e748036`，无新增master提交待合并；未创建PR或部署。

## 初速度与down组积分补证

输入 HEAD `8290ec28`。只读反编译完整Shape分发器的上层调用：正常发射 `0x6d34f8` 先运行初始模块 `0x70a9cc`，然后Shape，再调用 `0x6d846c` 应用startSpeed。另两条路径 `0x6d77d0/0x6dcc60` 分别经过 `0x70c12c/0x70e3d8`，没有把三条路径混作一个初始化入口。`0x70facc`的序列化映射与 `0x6d846c` 的读取共同确认startSpeed位于InitialModule runtime-cache偏移0x30，mode在0x34、constant scalar在0x3c。

[prepare-chibi-smoke-motion-fixture.py](../scripts/prepare-chibi-smoke-motion-fixture.py) 先无写入重放既有edge探针，再把真实原生出生输出传给 `0x6d846c`。六系统的源速度均为Constant，覆盖+1.5、+7和−7；方向乘速度完全由原生函数完成。保留完整1664-byte速度函数窗口、引擎与两份来源fixture哈希。此探针提供源缓存布局作为受控输入，没有声称运行完整初始模块/种子分配。

两个down系统无重力、Noise、Velocity或ClampVelocity，继续把原生缩放后的速度送入积分核 `0x6d1e9c`：分别12/90步@60Hz、45步@30Hz，6条轨迹、24个粒子终点，均在源3秒寿命内。实际JS私有 `distance` 的直线位移与原生结果误差小于1e−5 Unity单位。local enum、零animated velocity和固定步长是明确的受控输入；不把这个积分核测试提升为移动父节点或整个本地模拟调度器已验证。

结果在 [chibi-smoke-motion-native.json](../scripts/fixtures/chibi-smoke-motion-native.json)，JS验证并入既有 [verify-chibi-smoke-edge.mjs](../scripts/verify-chibi-smoke-edge.mjs)。原生生成及无写入重放、JS目标回归与object-emitter回归通过；不影响前端运行依赖，本批没有构建或Browser渲染声明。重放命令为 `python scripts/prepare-chibi-smoke-motion-fixture.py --native-engine <libunity.so> --unicorn-path <runtime>`，生成fixture追加 `--write`。

side四系统只验证了初速度缩放，其TwoConstants重力和非0/1端点的lifetime限速曲线仍未闭合，不能用down组的直线积分取代。独立Smoke仍缺完整场景/生命周期/UV/材质消费者，保持missing。

本批完整源码门禁167/167通过；最新fixture已无写入重放，stage分支包含fetch后的 `origin/master 8e748036`，无master增量待合并。仅提交本批明确路径，不纳入既有删除/未跟踪文件，未PR或部署。

## side组重力、通用曲线与联动积分补证

输入 HEAD `84350bde`。`0x6deb6c` 调用快速缓存构建器 `0x66334c`，后者明确要求首/末关键帧位于0/1附近；Smoke源关键帧位于0.00478363037109375与0.9856480360031128，实际返回false。因此本组不能套用Bloom的快速缓存。改用完整源AnimationCurve关键帧、weightedMode与pre/post infinity输入，实际执行 `0x6e1838 → 0x65e98c`，由原生求值器构建Hermite缓存；没有在Python中代算系数。首帧前/末帧后、两个端点及两侧、区间内部及倒序共64个源曲线输出与现有JS匹配。源weights保留，weightedMode=0仍走未加权分支。

[prepare-chibi-smoke-side-fixture.py](../scripts/prepare-chibi-smoke-side-fixture.py) 对4个side系统使用两组明确的四通道种子，执行源TwoConstants重力 `0x70dae8`；单独保存加重力前后速度，以验证Native使用的seed hash及标量插值。PhysicsManager getter仅做“返回null”ABI适配，重力向量来自引擎内置fallback，标记此前已发出诊断；没有用host函数代替重力或限速。

联动部分直接运行既有原生模块调度器 `0x6db88c`（重力→限速）及 `0x6d1e9c`（位置更新），保留源负速度、双常量重力、dampen=1与非0/1端点曲线。两个固定步长1/60与1/30均运行到8秒，早于源寿命8.80000019秒，共16条轨迹、5760个四粒子批更新（23040粒子步），在320个粒子检查点记录位置与速度。各轨迹的起点来自前批重新原生重放的有符号速度结果。

新增 [chibi-smoke-side-native.json](../scripts/fixtures/chibi-smoke-side-native.json)；[verify-chibi-smoke-edge.mjs](../scripts/verify-chibi-smoke-edge.mjs) 验证source/motion/hash绑定、快速缓存确实拒绝、64个曲线输出、单步重力及320个轨迹检查点。`chibiParticleLimit.js`新增 `stepLifetimeLimitMotion`，先在模拟空间加加速度，再沿更新后的向量做幅值限速，最后积分；既有force-free标量距离缓存保持原行为。实际JS与原生位置/速度最大误差0.000010565630748970989，阈值2e−5 Unity单位。生产者的既有入场guard尚未放宽，不把新增运动核当作Smoke消费者已接入。

重放命令：`python scripts/prepare-chibi-smoke-side-fixture.py --native-engine <libunity.so> --unicorn-path <runtime>`，生成fixture追加 `--write`；该命令还会无写入重放既有edge/motion/Noise证据。

边界：local inverse为受控单位矩阵，phase为明确传入的post-step寿命分数，种子与帧步长均非原机记录；不含完整发射/退休调度、移动父链或运行时container/镜头桥接，也未消费尺寸/颜色/UV/材质。原生libm powf继续使用既有ABI适配。此次闭合的是side受控运动数学，Smoke在完整场景消费者落地前继续missing。

本批原生生成及无写入重放、object-emitter目标回归通过；`build:check`通过（16.18s，固定E盘代码输出、不复制public），完整源码门禁167/167。构建产生的资源/翻译审计元数据已恢复输入HEAD。本批无可见渲染改动，未新增Browser或完整媒体包验收结论；fetch后无master增量待合并（`origin/master 8e748036`），未PR或部署。

## down组UV布局补证

输入 HEAD `f5f174a7`。源down两系统的UV均为Grid/Lifetime/WholeSheet、1列12行、cycles=1、startFrame=0，frameOverTime为线性0→1乘0.9998999834060669；同一纹理为171×1024，单行高度1024/12不是整数。side四系统没有UV模块，且looping=false、发射时长10秒，不能套用down组3秒循环。源Emission rate依次为2、1、30、30、10、10粒子/秒，均无burst和距离发射；这里只记录来源差异，未据此宣称原生发射时钟已重放。

[prepare-chibi-smoke-uv-fixture.py](../scripts/prepare-chibi-smoke-uv-fixture.py) 复用原生source hierarchy与renderer context `0x6cf028/0x6c505c`，在UVModule真实cache偏移0x830写入源enabled、mode、tiles与channel mask。`0x6d8fe0`提供源网格数量，context将1/12分别打包到bit0…9/10…18，tileCount=12；随后真实执行UV写入器 `0x813330`。两系统各4个四通道批次，覆盖全部12个帧号与边界内的受控小数帧输入，共32个UV四边形。仅free(NULL)适配ABI，未替换UV计算。

结果 [chibi-smoke-uv-native.json](../scripts/fixtures/chibi-smoke-uv-native.json) 绑定引擎和源fixture哈希。[verify-chibi-smoke-edge.mjs](../scripts/verify-chibi-smoke-edge.mjs) 实际调用现有 `loadObjectEmitters`，以最小PIXI边界记录它分配的12个Rectangle；确认帧高保留1024/12，PNG Y翻转后的归一化UV与32个原生四边形匹配。现有renderer的布局分配无需修改。本次fake PIXI只观察真实分配函数，不是GPU上传、纹理过滤、shader或Browser验收。

重放命令：`python scripts/prepare-chibi-smoke-uv-fixture.py --native-engine <libunity.so> --unicorn-path <runtime>`，生成fixture追加 `--write`。生成和无写入重放、目标JS检查通过；还会重放既有42个Smoke几何、9个billboard角度/53个父链与Noise证据。本批仅新增工具/证据/检查，不改前端运行逻辑，不重复Vite构建。

帧号是受控输入，没有执行完整UV动画更新/cache生成器或发射时钟；尚未验证发射/停止/退休、源尺寸颜色的完整消费和container/镜头桥接。Smoke继续missing。

本批完整源码门禁167/167通过。fetch发现master已前进至 `6048cb13`（门户#87–#92等21个提交）；先提交UV证据，再按分支策略普通merge同步，合并后的构建与回归另记。

同步已完成：UV提交 `703180ed`，普通merge提交 `d73d493a`，包含 `origin/master 6048cb13`。合并后 `build:check` 16.23s通过（无public拷贝），本地 `verify:source-batch` 再次167/167通过，verifier coverage为472脚本（上游新增1个外部Browser检查归local-only）。生成审计元数据恢复merge HEAD；未宣称执行该外部Browser验收。既有5213仍由PID62484的主checkout Vite服务，无新端口或部署；无关删除/未跟踪文件保持原样。
