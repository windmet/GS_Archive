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
