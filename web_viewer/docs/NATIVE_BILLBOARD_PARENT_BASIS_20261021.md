# 粒子父链：局部矩阵与带符号尺度

输入 HEAD `3031a006`，分支 `stage/20261020-native-followup`，已包含 `origin/master` / `2e115f68`。接续 [粒子方向修复](NATIVE_PARTICLE_ROTATION_FIX_20261021.md)；本批扩大原生上下文样例，并修复原3D分支漏乘父平面的错误。没有新增资源、纹理、名单或逐曲系数。

## 原生链路与发现

仍直接执行同一 Unity ELF（SHA-256 `acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0`，image base `0x100000`）。新 parent 样例先执行 `0x6cf028` 构造真实的层级矩阵、世界四元数及 particleScale，再通过 `0x6c505c` 构造 renderer context/参数块，最后进入普通 2D/3D 顶点 writer。没有独立猜一套矩阵填进顶点函数。

三项差异得到重放确认：

1. Local alignment=2 使用完整父层级矩阵，包含非等比缩放组合产生的剪切；不能只用 world rotation × 对角尺度替代。
2. View alignment=0 使用带符号的 native lossy scale，而不是矩阵两列的长度。原生尺度由 `inverse(worldRotation) × localToWorld` 的对角项得到。
3. 负缩放祖先会共轭子旋转。以父Z=30°/负X缩放、子Z=45°为例，缓存的原生世界Z角为−15°；直接把四元数相乘成75°会同时算错视图尺度。

原对象3D分支只画了粒子自身的旋转投影，没有把父基乘回四角，因此局部泡泡等虽然位置随父链移动，纹理方向却没跟随父旋转。新 `emitterRenderBasis` 把粒子位置与渲染基分开：位置仍使用完整层级矩阵；Local渲染基也保留完整矩阵，View基只保留带符号尺度。2D/3D使用同一父基规则，原生粒子角/UV修复继续保留。

该规则也纠正2D View的旧无符号/列长度近似；2D Local保留完整矩阵的行为不变。基只在每次系统采样时计算一次，不在逐粒子循环中重建父链。

## 扩展证据

`chibi-billboard-rotation-native.json` 保留原9个单位上下文样例，新增52个parent样例：

- 9份合成层级 × alignment0/2 × 2D/3D =36例，覆盖旋转、非等比缩放、剪切、单/双负轴、反射祖先和Y180父旋转。
- 10个当前资源、全部16个已准入3D系统的真实RAW父链 =16例。绑定bundle SHA、serialized file、精确PathID、参数树SHA、链和alignment；使用受控粒子角，而不是冒充原生RNG出生角。

同一UV顺序的顶点比较 **61/61** 相符；所有parent例另检查X/Y native particleScale。Native工具不带`--write`重放一致性通过。门禁还验证全部当前3D系统都有父链证据，后续新增3D资源不能静默绕过。

相机仍是单位正交上下文、无pivot/Flip；只适配`free(NULL)`，未替换层级、尺度、context或顶点计算。没有证明任意非平面父链、透视相机、移动父节点、出生/Noise时钟或原片场景等价；提取器的平面父链准入没有放宽。

## 验证

- emitter published-assets与ADV APK来源回归通过；公开91资源/762系统/105纹理未改，未消费粒子仍21种。
- `npm run verify:source-batch`：168/168通过。其后补齐Y/Z反射样例及证据覆盖/指令哈希断言，相关旋转门禁补跑61例通过。
- `npm run build:check`：2,984 modules / 21.28秒，入口gzip206,056 / 215,040 bytes。固定`.analysis/build-check`，未复制public语料，构建生成审计元数据已还原。

本地5213，主checkout、`rm-release-20261015`候选、进程56064。完整加载Browser：`はんどめいど・きみはーと！`45秒泡泡可见，共25对象粒子；77秒移除，85秒重启为6粒子，回拖/刷新45秒恢复25；实际起播/暂停通过。桌面1280×720、手机390×844，手机document宽度/scrollWidth均390；采样窗口unsupported/deferred为空，控制台error=0，不宣称warn=0。

`はるかぜバトン`冷加载后10秒左右泡泡同时可见，共69对象粒子；61.8秒移除为0，80秒重启为8，回拖10秒恢复69。采样窗口unsupported/deferred为空，控制台error=0。

截图在本机 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/billboard-parent-hndmkh-45s.png` 与同目录 `billboard-parent-hndmkh-mobile.png`、`billboard-parent-hrkzbn-10s.png`。未部署，没有改动其他工作树或无关文件。
