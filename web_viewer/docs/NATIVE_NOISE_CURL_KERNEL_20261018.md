# Noise 高质量 Curl 内核：原生 CPU 重放校准

输入 HEAD `cf6e2d8c`，舞台工作树 `stage-native-fidelity-20261014`。本批替换对象粒子 Noise 的旧经验位移，但保留整条更新链的 preview 边界；不宣称 Noise 完整收口。

后续 [速度积分链](NATIVE_NOISE_VELOCITY_PIPELINE_20261018.md) 已证实并修复“把 Noise 直接作为位置偏移”的接线错误；下述更新顺序边界保留为本提交当时的状态。相位/步长等限制继续保留。

## 旧实现的实际问题

旧代码虽然用了原生 Perlin 置换表，却把三个独立 Perlin 值当作 XYZ 位移，另加 31.4/47.2/13.7 等经验偏置；damping 未消费。提取器还把 RAW `octaves` 误读成不存在的 `octaveCount`，永远回落到 1。当前 20 个目标系统实际都为一 octave，因此此前目录计数没暴露这个错误。

RAW 的这 20 个系统均 quality=2、damping=true、separateAxes=false、remapEnabled=false、octaves=1，strength/scroll/amount 为常量。不能凭“存在 Perlin 表”认定向量场公式已经复刻。

## 新取到的原生证据

同一 libunity SHA-256 `acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0`，Ghidra base `0x100000`：

- 驱动 `0x841400` 按 quality、octaves、separateAxes 分派；`+0x74` 是 separateAxes，**`+0x75` 才是 damping**。此前按分派分支猜成 damping 不成立。
- 当前剖面进入调度器 `0x852c18`，再调用 worker **`0x85444c`**；`0x8528f4 → 0x852f3c` 是另一条 separateAxes 分支，不能混称为当前剖面。
- helper **`0x8406ec`** 接收 4-lane XYZ 和 frequency，返回 dN/dx、dN/dy 两组向量；AArch64 通过 x8 返回结构，实际输入是 x0/x1。
- helper 读取 `.rodata` VA `0xef8134` 的 256 项置换表和 `0xef7fc0` 的 16 个梯度向量。梯度索引 13/14 的排列与常见 compact grad() 不同，不能只复用常见函数。
- frequency 在 worker 夹到至少 1e-6；damping 开时强度再乘 frequency 的倒数，抵消导数链式法则中的频率倍率。
- 滚动状态 `noise+0x170` 由驱动累计 dt × scrollSpeed，属于系统相位，不是每个粒子的 age。

令 p 加上系统随机偏置 ×100 后为 (x,y,z)，系统 scroll 为 s，G 为上述带频率链式因子的二元导数：

```text
A = G(z,     y,     x+s)
B = G(x+100, z,     y+s)
C = G(y,     x+100, z+s)
offset = (C.x-B.y, A.x-C.y, B.x-A.y)
offset *= strength * (damping ? 1/frequency : 1)
```

worker 的三次 helper 调用及差分直接给出这个排列，不再使用经验偏置或三个噪声值冒充向量场。

## 校验方法与消费

新增 `prepare-chibi-noise-kernel-fixture.py`，用本地 Unicorn 2.1.4 映射 ELF PT_LOAD 段并直接执行上述 AArch64 函数。完整二进制 SHA 必须匹配；指令预算耗尽或未正常返回均拒绝。合成模块使用恒定 strength、positionAmount=1、rotation/size=0，给定点坐标、随机偏置、频率和 scroll，记录 worker 实际输出；不运行游戏场景或替换原生函数计算。

```text
python scripts/prepare-chibi-noise-kernel-fixture.py --native-engine .analysis/native-engine/libunity.so --unicorn-path .analysis/native-engine/python-runtime
```

不带 --write 重放验证 `scripts/fixtures/chibi-noise-kernel-native.json`。12 组导数、48 组完整 worker 样例包括负坐标、三种频率、零/非零偏置和 scroll，以及 damping 开/关。Web 数学使用 JS double，原生为 NEON float；所有样例以绝对容差 2e-5 通过。fixture 由二进制执行输出生成，不由 Web 公式生成。Unicorn 仅装在 E 盘忽略的分析目录，不加入应用依赖或 public。

`chibiParticleNoise.js` 实现并消费该内核。对象采样器改用系统 scroll 相位与每系统确定性偏置；保留 Web RNG，未声称恢复 Unity 原随机种子。提取器正确读 `octaves`，仅接受已验证的高质量、单 octave、无 remap、共享常量强度、positionAmount=1 且 rotation/size=0 剖面；其它配置拒绝，不退回旧经验 Perlin。

**20 个 noise_preview 标记继续保留**：当前对象采样器把 Noise 加在形状采样后、速度/重力组合前；原生输入坐标与完整模块调度/固定步长尚未逐链验证。kernel 数值一致不能替代更新顺序、系统相位或录屏同帧验收。Whole_screen 的 Noise、remap、多 octave、旋转/尺寸扰动也没有因本批自动完成。

## 验证与现状

- 原生 CPU replay 无 --write 与实际 JS 消费者回归通过；未知 quality 剖面拒绝。
- RAW 提取器无 --write：78 资源 / 709 系统 / 0 deferred / 91 纹理，像素和 fixture 一致。没有新增纹理或改共享 public/assets。
- `npm run build:check`：2957 模块、15.41 秒，固定 `.analysis/build-check`，copyPublicDir:false，只有既有大 chunk 提示；无完整素材包。无关生成审计/翻译文件已恢复。
- `node scripts/run-verifier-batch.mjs`：147/147，通过。
- 5212 复用 PID 61564，Browser 插件冷页 1280×720：ROUTE77 49s，6 个对象层、160 个对象粒子，unsupported/deferred 空、lightingIncompleteFrames=0；尾焰和火焰可见。连续实播至 2:18 曲末，回拖 49s 恢复 160。390×844 同时刻 scrollWidth=390。无 console error，保留原有 Spine tint/update 弃用警告。
- 同一播放器经曲目面板切 Take 01，再回拖 70s：444 个对象粒子、9 个当前对象层，unsupported/deferred 空，lightingIncompleteFrames=0；无 ROUTE77 资产残留。该回归没有证明原片的大四角星尺寸问题已解决。临时 viewport 已恢复，临时标签已关闭。
- 截图 `.analysis/noise-curl-route77-49s.png`、`.analysis/noise-curl-route77-mobile.png`、`.analysis/noise-curl-take-70s.png`。Web 播放验证与内核 CPU 数值验证分别记录，不冒充原机/原片验收。

目录仍有 20 Noise preview 和 8 stretch omitted；全库仍为 33 个无消费者资源、428 次事件、18 份编排、4 个缺源资源。Stretch 浮点搜索纠错见 [renderer 追踪记录](NATIVE_STRETCH_RENDERER_TRACE_20261017.md)，其顶点公式仍未取得。下一步先追 Noise 输入坐标和调度顺序，再决定是否推广到 Whole_screen；同时继续 Stretch 参数块/顶点入口。未部署、未合并主线。
