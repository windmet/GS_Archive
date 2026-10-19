# Noise 相位：只累计存活区间，空档保持，重置归零

输入 HEAD `503b06b4`；舞台工作树 `stage-native-fidelity-20261014`。接续 [速度积分链](NATIVE_NOISE_VELOCITY_PIPELINE_20261018.md)，本批校准共享 Noise 时钟与容量准入，仍保留整层 preview。

## 原生来源与实际错误

libunity SHA-256 `acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0`，Ghidra base `0x100000`：

- `0x6db88c` 仅在粒子范围 `start < end` 时调用 Noise。`0x841400` 又只在 update flag bit0 为 1 时累加 `noise+0x170 += dt * scrollSpeed`。没有存活粒子时不推进；不推进时钟的补算调用也不能再累计一次。
- `0x841e7c` 只有两条指令：将 `noise+0x170` 清零并返回。当前反编译中两处直接调用都在系统重置 `0x6d60fc`（自身及子系统），不是每次循环或每个粒子出生时重置。
- `0x6d6d40` 的普通 ringBufferMode=0 路径读取 InitialModule `+0x174` 的最大粒子数，按 `capacity - alive` 限制新发射数；池满时拒绝新粒子。不是画完以后删掉较旧的粒子。

ROUTE77 的 fire_1/2/3、turbo_1/2 各有一个 Noise 系统：duration=1，0s/0.05s 两次各 10 个 burst，lifetime≈0.2，capacity=20。按当前 Web 出生/寿命边界，存活区间约为每秒的 [0,0.25]。原先按整段 `born+age-delay` 推相位，把约 0.75s 的空档也算进去；这会持续改变后续爆发的 Curl 采样，不能靠调强度补偿。

## 通用消费

新增 `chibiParticleNoiseClock.js`：

1. 按时间排序出生计划，使用同一 Web 逐粒子寿命样本，并按容量准入；重叠存活区间取并集，只计一次时间。
2. 首次出生前相位为 0；全部退场后保持；后续出生从原有累计时间继续。StopEmitting 仅截断未来出生，尾粒子仍推进时钟。
3. 把这个系统共享时钟送入每个粒子的 Curl 积分，替换绝对经过时间。没有添加 ROUTE77 曲名判断。
4. 只保留当前周期及可能存活的出生记录；已过去的完整时钟区间折叠成前缀。回拖到更早周期或改变 StopEmitting 截点时重建，积分缓存同时换代，避免继续用错误旧相位。
5. 提取器要求 Noise 资源 ringBufferMode=0，burst 在 [0,duration] 内；未知环形缓冲/出生模式不借用该合同。当前 20 个 Noise 系统全部通过，不改正式 sidecar 或纹理。

这也修正 Noise 路径以前 `out.slice(-capacity)` 实际留下较新粒子的行为；满池拒绝的新粒子不会延长共享时钟。

## 原生 CPU 时钟证据

扩展 `prepare-chibi-noise-kernel-fixture.py`，在同一 ELF 中执行 `0x6db88c → 0x841400`，scrollSpeed=2：

| 调用 | dt | 原生累计 scroll |
| --- | ---: | ---: |
| 空范围 | 0.1 | 0 |
| 空范围 | 0.4 | 0 |
| 非空范围 | 0.1 | ≈0.2 |
| 非空范围 | 0.2 | ≈0.6 |
| 空范围 | 0.5 | ≈0.6 |
| 非空范围 | 0.3 | ≈1.2 |
| 非空但 advance flag=0 | 0.2 | ≈1.2 |
| 调用原生 reset | — | 0 |

时钟专用重放在写入时钟之后的 `0x852c18` worker dispatch 处使用 no-op，避免运行无关 Job/分配器环境；fixture 明确记录该跳过点。它证明真实时钟入口、范围/flag 分支与重置，**不证明一次完整游戏场景更新**。原有 12 组导数、48 组真实 worker、12 组真实限速/位置积分重放仍单独执行原始指令。ELF loader 增加 RELATIVE 重定位，不提供通用 Android/Unity 运行环境。

Web 回归覆盖原生时钟序列、空档、相位续接、历史裁剪、满容量拒绝、真实对象消费者的溢出出生拒绝、StopEmitting 尾粒子，以及已有的回拖/冷计算一致性。

## 未收口的边界

当前共享时钟以 Web 出生/寿命区间重建。原生按给定帧 dt 和帧开始的存活范围判断，可能在死亡边界多累计一个批次；真实帧序列及出生补算边界尚未复原。因此这里没有把连续区间模型写成原机逐帧等价。

20 个 Noise preview 继续保留，后续还须核对 simulation space / 缩放、出生批次、Unity RNG 及真实步长。8 个 Stretch omitted、Whole_screen Noise/type 6、33 个无消费者资源和四个缺源资源也仍在。无部署、无合并主线。

## 本批验收与交付边界

- 原生 fixture 无 --write 重放再次通过：12 导数、48 worker、12 多步轨迹及空范围/advance flag/重置时钟序列。
- 对象消费者 published-assets 回归通过：78 资源 / 709 系统 / 28 preview / 0 deferred。RAW current 重解保持 91 张纹理，未改 public 素材。
- build:check 通过（2958 模块，15.10 秒），固定 .analysis/build-check、copyPublicDir:false；源码门禁 147/147。日志 noise-clock-build-check.log、noise-clock-source-batch.log。后续仅补 fixture 非推进调用及对应断言，对象回归已重跑通过。
- 5212 复用舞台 Vite PID 61564；Browser 插件冷页 ROUTE77，1280×720、完整加载、49.1s：六个本曲对象资源、160 粒子、unsupported/deferred 空、lightingIncompleteFrames=0。实播至 138.1s 曲末自动暂停，回拖恢复 160。
- 同帧 390×844：scrollWidth=innerWidth=390，无横向溢出。随后同页经曲目搜索切 Platinum MASK，20s：七个对象资源、789 粒子，无 ROUTE77 资源残留；unsupported/deferred 空、缺灯帧 0、console error 空。临时 viewport 及标签已恢复/关闭。
- 小型截图：.analysis/noise-clock-route77-49100.png、noise-clock-route77-mobile.png、noise-clock-plmask-20s.png。以上为本批已有 Browser 旅程记录；收口时未重复播放，不把 Web 呈现视为原片同帧验收。
- 合并消费者审计仍为 135 引用资源、33 无消费者、428 事件、18 编排、11 partial 资源、4 缺源资源。计数口径不同，不与 28 preview 系统数相加。
