# 強く尊き獣たち电弧接线（10-22启动，10-23验收）

输入HEAD `63993dd7`，分支 `stage/20261022-particle-gaps`；包含master `bc991170`。本批没有PR、R2上传或部署。

## 来源与分区

`fx_in_tktkkt_electric` 包含17个ParticleSystem：2个glitter、12个electric、3个electric_m/r/l容器。当前完整记录17节点，14个进入发射器，另外3个保留为 `nonEmitting`，不是裁掉不支持的系统。

三个容器的RAW `EmissionModule.enabled=false`、`SubModule.enabled=false`，仅InitialModule启用；Emission内仍保存一个burst，但模块关闭，不能把这个burst误播出来。夹具保留完整关闭模块及burst数据。54个组件来源/参数树SHA证明静态层级仅有Transform、ParticleSystem、ParticleSystemRenderer和RefKeeper。提取绑定完整bundle SHA，修改来源、增加组件或重新启用发射会拒绝晋升。

另复核本地IL2CPP dump：`LiveObjectObjectLayerRefKeeper`只有字段和构造器；`PlayEffect` RVA `0x2220db8` 对粒子使用回调 `0x1c9e17c`，后者SetActive、sortingOrder、ParticleSystem.Play，没有直接Emit。证据在本机 `.analysis/ghidra-il2cpp/decompiled_pass3/Growing.Live.LiveObjectObjectLayer.c` 与 `LiveObjectObjectLayer.__c__DisplayClass9_0.c`。这不扩展成动态脚本或任意禁用模块的通用豁免。

## 双渐变与原生颜色计算

12个electric使用ColorModule mode3、两条Blend渐变。源RGB为白色，alpha关键点在两条渐变中的时间不同。此前单渐变门槛会拒绝整个资源。

Unity ELF SHA256 `acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0`。新脚本 `prepare-chibi-color-pair-fixture.py` 将实际RAW Gradient结构注入原生代码，执行：

- `0x65a708`：真实梯度缓存编译，包含颜色/alpha时间合并、重复末端key、float32逆跨度及RGBA32量化；没有在夹具中手工重建烘焙结果。
- `0x6bd6b0`：双渐变缓存布局；`0x6ea298`：完整ColorModule更新；`0x6f77a8`：双渐变采样。
- 从控制seed生成的随机权重只观测、不替换；函数局部常量的8个ushort=128舍入偏置由夹具预初始化。
- 12系统/216批次/864个RGBA32结果逐字节一致，包含关键点、其前后1e-7、起终点及不同初始RGBA。新增Web路径保留两次8-bit权重插值和原生颜色乘法边界。关键点相等时选取后续段，避免终点多一档alpha。

原生缓存与实际来源在 `chibi-color-pair-native.json`，以LF字节SHA绑定到消费者。Web出生随机数仍使用已有确定性采样器的新独立通道23；不能将本批混合数学对照称为原生出生seed/RNG一致。

## Renderer尺寸上限

进一步核对发现所有14个发射器的renderer min=0/max=1、pivot/flip=0，源尺寸有8.3，放大镜头下确实会触发上限；只接颜色会把大电弧画得过大。

`prepare-chibi-uniform-size-fixture.py` 对实际unit-scale平面父链运行原生层级、renderer context及 `0x81e2e0` uniform billboard writer。14系统×3尺寸×3视野高度×2角度，共252组四角对照通过，包含View/Local和镜像父链。受控测试覆盖.1、源尺寸、16，以及视野高度3、7.2、10。`chibi-uniform-size-native.json` 绑定来源与renderer边界。

采样器仅为这些来源接受 `native-uniform-screen-size-v1`：按当前归一化视野高度夹取uniform尺寸；拒绝非零min、非unit max、独立尺寸、3D粒子旋转或Stretch组合。舞台消费者继续传入已有的视野高度，随环境缩放、对象scale和镜头缩放调整。其他110个模型没有增加该字段或改变行为。

这是受控正交视野和顶点证据，不是原生整段镜头历史、透视/遮挡或设备渲染等价。

## 数据与验证

总111资源/873发射系统/126纹理，另3个明确关闭发射节点，deferred=0。既有110个模型及123个纹理描述逐项不变。新增glitter的Noise沿用已有 `noise_preview`，因此partial总数105→106（90 Noise、9 Stretch preview、7 Stretch omitted）；没有改称完整原生还原。

新增3张PNG/867,370 bytes；合计432 PNG/76,349,315 bytes。receipt仍沿用启动批次ID `2026-10-22-native-tktkkt-electric-001`，共215 releases/1397 stable IDs。纹理parity仅指RAW RGBA像素一致。

consumer目录74,108 bytes、common255,271 bytes、emitter3,528,794 bytes。实际磁盘闭包4目录+467分片，共471文件/33,693,510 bytes，真实文件/hash/大小验证通过，未上传。无consumer缺口2→1资源、52→49事件，剩 `fx_in_bnckgy_fire`。

验收：`verify:source-batch` 167/167；`build:check` 2,979 modules/16.65秒，固定 `.analysis/build-check`、不复制public；两份新原生夹具无write重放；消费者回归含容器重新启用、重复身份、缺少证明的拒绝测试；旧数据逐项比对、分片check及闭包、publication台账、PNG清单、source-only基线通过。源码基线记录10420 compiled JSON、432 PNG；此前发现的本地剧情Runtime v2语料不一致仍未作为全库验收关闭。

日志 `.analysis/electric-source-20261022.log`、`.analysis/electric-build-20261023.log`；报告 `.analysis/electric-coverage-20261022.json`。构建生成审计元数据已还原。

## Browser

Codex In-app Browser，本地主checkout5213/PID66512，候选 `rm-release-20261015`，完整模式，继承手工3人编队（2/3/4号位），不作原曲成员验收。

桌面1280×720：11.2秒未触发/0对象粒子；11.6秒电弧可见/28；12.4秒电弧已隐藏/0；59秒再次载入/35；回拖11.6秒恢复28。实际从11.6秒播放，观察到50.2秒，随后手动暂停，DOM在57.9秒显示暂停。手机390×844，scrollWidth=390，电弧画面正常，28粒子。

初次QA页曾记录一条 `[SongReadModel] Failed to load catalog: Client disposed`，栈来自useSongNavigation/ReadModelClient及App；未修改这条门户链路，也未据此宣称整轮控制台零错误。构建元数据还原后，独立冷页正常载入，11.6秒28粒子、error=0；该页再次reload并定位仍28、error=0。切至VIVA先清空旧对象/0粒子，再ready=true/876粒子，资产仅VIVA面板，最终error=0。保留旧页disposed错误作为观察，不把未重现当成已修复。

采样窗口ready=true、unsupported/deferred为空，页面身份与内容正常，无框架错误覆盖层；不宣称warn=0。截图在 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/`：`electric-tktkkt-11s-desktop.png`（最终独立冷页）、`electric-tktkkt-11s-mobile.png`。临时页已关闭，视口覆盖已复原。

## master整合复验

舞台功能提交 `3607e8ac` 后，普通merge `83b1f99f` 同步master `f0a8be3a`（#81–#84）。唯一冲突为根.gitattributes：保留master的compiled目录治理规则，同时保留7条舞台证明文件LF规则；7份已提交证明的过滤字节与本地及消费者绑定再次一致。

整合检查发现新卡词分片32文件因Windows autocrlf检出为CRLF，`verify-card-line-translation` 判为stale；补一个窄目录LF规则并恢复精确HEAD字节后，分片check及该校验通过，没有任何译文JSON blob变化。首轮整合门禁166/167，失败仅此项；修复后的完整重跑日志为 `.analysis/electric-master-source-fixed-20261023.log`。

整合 `build:check`：2981 modules/15.98秒，日志 `.analysis/electric-master-build-20261023.log`，不复制public；生成元数据已还原。独立冷页11.6秒仍28电弧粒子、ready=true、unsupported为空、console error=0；手机390×844、scrollWidth390复验正常。图片 `electric-tktkkt-master-sync-11s.png` 与 `electric-tktkkt-master-sync-mobile.png`。卡词新分片真实HTTP返回application/json。

舞台功能提交范围 `63993dd7..3607e8ac` 的Git增长报告：28个新blob，原始17.5MiB、落盘2.3MiB；报告 `.analysis/electric-git-growth-20261023.log`。没有重编译或提交整套媒体/剧情语料。

修复后完整门禁重跑167/167通过。最终回执绑定整合提交的完整40位SHA。
