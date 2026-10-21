# 局部寿命速度曲线：原生采样与位移积分

输入 HEAD `11cfb3c5`，分支 `stage/20261020-native-followup`。本批补齐 `VelocityModule` 的单曲线位移积分；不晋升新的资源或纹理，现有目录仍为 90 资源 / 748 系统 / 101 纹理，缺消费者仍为 22 种。

## 缺口与原生证据

`fx_in_ossshd_panel` 的 14 个 RAW 系统中，8 个 `fx_in_ossshd_cloud_mask_1` 使用 `VelocityModule` 的 X/Y/Z mode=1 曲线，Y 有两键或三键的非线性段。旧提取器拒绝这些系统；旧消费者用“当前速度 × 粒子年龄”，若仅开放提取限制，位置会错误。

从实际 Unity ELF（SHA-256 `acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0`、Ghidra image base `0x100000`）重新核对：

- 已有模块表及 `0x6db88c` 调度把 `VelocityModule` 定位到模块块 `+0x8f8`；本次继续沿 `0x896ee4` 调度。
- 单曲线优化 worker `0x897f74` 读取粒子缓冲 `+0x3c0`，乘 0.01 后按寿命进度采样预烘焙多项式，并经局部基矩阵累加到附加速度 `+0xc0/+0xe0/+0x100`。
- 已核对的 `0x6d1e9c` 把 base + animated velocity 乘 dt 后加到位置。参见 [Noise 速度链](NATIVE_NOISE_VELOCITY_PIPELINE_20261018.md)。曲线不是只在出生时取一次，也不是位置曲线。

新 `scripts/prepare-chibi-velocity-curve-fixture.py` 对挂载 RAW 做目标提取，再直接执行该 ARM64 worker：8 个系统 × 4 个寿命进度 = 32 个原生 XYZ 采样点。fixture 绑定 bundle SHA、serialized file、精确 PathID、参数树 SHA、真实曲线及函数指令窗口。

证据边界：harness 将 RAW 无权重 Hermite 段展开成原生预烘焙系数，提供单位局部基；没有执行原生曲线烘焙、原游戏帧调度、出生/RNG 或场景回放。worker 内部没有替换函数。不能据此宣称原片轨迹或设备等价。

## 实现与准入

非 Noise 路径将速度曲线沿年龄积分，在每个 60 Hz Web 网格步的中点按 `age/lifetime` 采样，分数步也取自身中点。常量与双色常量保持原先直接乘年龄的结果。

每个不可变来源曲线以寿命为键缓存积分前缀，每曲线最多保留 8 个寿命项；缓存归属 WeakMap，不持有显示对象。回拖只读取对应前缀，避免每帧逐粒子从出生重算全部长寿命积分。该 60 Hz 网格沿用 Web 可回放边界，不是原游戏实际 dt。

提取器只增加单曲线 mode=1；保留局部坐标、单位链缩放、无轨道/径向附加速度、无 ClampVelocity 组合限制。曲线必须是有限、严格递增的无权重键。曲线 + Noise 继续明确拒绝，因为 Noise 回放目前接收的附加速度不是逐步曲线采样。

本地生成器还对实际 RAW 系统作 6 组反例检查：世界坐标、带缩放的基、轨道速度、双色曲线、带权重键、曲线与 Noise 组合均拒绝。修改后的目标提取已经得到 **14 系统 / 0 deferred**，但尚未把该资源加入晋升名单：它的完整生命周期、分片与真实显示验收留给下一批。

## 验证

- 新 native generator 写出后以不带 `--write` 的方式重放一致性检查通过；8 系统 / 32 原生采样点。
- 现有 `prepare-chibi-object-emitters.py --consume-deferred` 检查通过，90 / 748 / 0 / 101，公开数据和纹理没有变动。
- portable emitter verifier 对比原生速度采样；用独立 Hermite 反导数核对真实曲线的完整积分，误差小于 `2e-6`；线性速度检查精确二次位移。真实粒子消费者额外覆盖分数步、回拖、冷定位及 StopEmitting 后继续移动。
- `build:check` 通过：2,979 modules / 16.30 秒，入口 gzip 206,043 / 215,040 bytes。固定 `.analysis/build-check`，没有复制 public 语料，构建生成的审计元数据已还原。
- `npm run verify:source-batch`：164/164 通过；提交前 diff 检查通过。
- 本地 5213（进程 74716、主 checkout、`rm-release-20261015` 候选）的完整加载回归：Inner Dignity 10 秒有 smoke_1/2 等对象层，共 280 粒子，unsupported/deferred 为空；34.6 秒全部移除，回拖 10 秒恢复 280。控制台 error=0，不宣称 warn=0。桌面 1280×720 和手机尺寸 390×844，手机文档宽度/scrollWidth 都为 390。

Browser 仅回归现有常量速度消费者，不代表 ossshd 云雾已经接入。截图在本机 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/velocity-inndgn-10s-desktop.png`、同目录 `velocity-inndgn-10s-mobile.png`。没有上传、部署或改动 R2。

重放命令：

```powershell
python scripts/prepare-chibi-velocity-curve-fixture.py --native-engine E:/Web_build/GS_Archive_Domain_Work/stage-native-fidelity-20261014/web_viewer/.analysis/native-engine/libunity.so --unicorn-path E:/Web_build/GS_Archive_Domain_Work/stage-native-fidelity-20261014/web_viewer/.analysis/native-engine/python-runtime
```
