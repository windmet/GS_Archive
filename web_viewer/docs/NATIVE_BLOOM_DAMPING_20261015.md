# FLASH LIGHT 扩散距离：原生阻尼核对

输入 HEAD：`bc11c209`，分支 `stage/20261014-native-fidelity`。用户确认方向正确但扩散稍小；修正后用户确认视觉效果正确。

## 来源和定位

同一存档 XAPK 的 `config.arm64_v8a.apk!/lib/arm64-v8a/libunity.so`，17,675,384 bytes，SHA256 `acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0`。`.note.unity` 标识 `2020.3.34f1_9a4c9c70452b`。二进制和 Ghidra 工程仅保留 E 盘本地分析目录，不提交引擎。

下面地址均为 ELF RVA。Ghidra 自动 imageBase 为 `0x100000`，其显示地址需减去该基址。

- 序列化模块名 `0xddd367`：`ClampVelocityModule`。`0x5e4b58` / `0x5e5224` 将模块结构定位到系统数据 `+0xbf0`。
- `0x5fbd1c` 序列化函数在 `0x5fbdd4` 将字段 `+0xb4` 与字符串 `0xde0f34`（`dampen`）绑定。
- 粒子更新调用点 `0x5dba48` 检查模块 enabled (`+0xbf8`)，`0x5dba50` 传入模块 `+0xbf0`，`0x5dba6c` 调用限速计算 `0x5f8e28`。
- `0x5f8e44` 读取 `+0xb4`；`0x5f8e94` 算 `1-dampen`；`0x5f8e98` 对逐粒子 timestep 取绝对值；`0x5f8e9c` 常数 **30**；`0x5f8ea0` 相乘。随后四个 SIMD lane 各调用 `0xaed80`。
- ELF `.rela.plt` 将 `0xaed80` PLT 所用 GOT `0x10d2128` 绑定到 **powf**。`0x5f8f04` 算 `1-powf(...)`，该结果用于速度超过限值时的插值（例如常量限值分支 `0x5f9034..0x5f904c`）。曲线分支共享相同阻尼比例。

因此原生比例为 `1 - (1 - dampen) ** (abs(dt) * 30)`。旧 preview 使用 `dampen * dt * 60`，在 60fps / dampen=.12 时每步减速比例 .12；原生是 `1-sqrt(.88)` ≈ .06191685。旧值过强，压小扩散距离。这里的 **30 是阻尼时间基准，不是游戏目标帧率**；此前已查到启动目标为 60fps。

Ghidra 首次全程序分析到超时，不能称全引擎分析完成；随后以保存工程、修正 imageBase、`-noanalysis` 导出目标函数。结论同时用原始 AArch64 指令及 ELF 动态重定位验证，不依赖 SIMD 反编译中的不完整 powf 参数显示。

## 修正与验证

`chibiBloomParticles.js` 共用求解器接入上述公式，三个 prefab 的全部移动 emitter 同时消费；零速 disk shimmer 保持零速，不增加半径倍率。仍用可回放的 60Hz 曲线/位移积分；没有宣称原机随机种子、实际设备 timestep、摄像机和积分顺序完全等价。

- `verify-chibi-bloom.mjs --published-assets` 通过。新增零限速、恒速出生探针，以六步几何级数的闭式距离验证指数时间基准，可捕获旧的 60 倍线性阻尼。
- particle lifecycle、renderer planes、floor、particle timeline 相关回归通过。
- `npm run build:check` 通过，13.45s，固定 `.analysis/build-check`，不复制 public；既有大 chunk 提示。生成审计元数据已恢复。
- 5212 本 worktree Vite PID61564，未重启。Browser 检查首次发射 2.1/2.6s、回拖、结尾 93.8s、播放至曲末，以及开头实际播放 2.1/2.2/2.3s 连续帧。无新增控制台 error/warn。小型截图 `flash-light-native-damping-2100.png` / `-2600.png` / `-93800.png` 保留在本任务 visualizations 目录。未部署或修改 master。
