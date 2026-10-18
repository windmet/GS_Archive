# Noise 消费顺序：附加速度、限速与位置反馈

输入 HEAD `9d486e53`，舞台工作树 `stage-native-fidelity-20261014`。接续 [Curl 内核校准](NATIVE_NOISE_CURL_KERNEL_20261018.md)，本批解决“内核值直接加到出生位置”的错误，仍保留 Noise preview。

## 真正漏掉的消费步骤

同一 libunity SHA `acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0`，Ghidra base `0x100000`：

1. `0x6e4880` 的序列化模块表明确：VelocityModule 位于参数块 `+0x8f8`，ClampVelocityModule `+0xbf0`，NoiseModule `+0xca8`。不能凭函数地址相近或相同结构偏移给模块命名。
2. 主更新 `0x6dc784` 依次调用模块更新 `0x6db88c`、位置积分 `0x6d1e9c`、后处理 `0x6dbaec`，之后才做后续发射/出生处理。
3. `0x70dae8` 更新基础速度的重力项，并把粒子附加速度缓冲（成员偏移 `+0xc0/+0xe0/+0x100`）清零。`0x6db88c` 随后按 Velocity → Noise `0x841400` → ClampVelocity `0x6f8e28` 的顺序调用。
4. 上一批确认的 Noise worker `0x85444c` 将输出累加进上述附加速度。它读取 XYZ 位置缓冲 `+0/+0x20/+0x40`，不是固定出生位置。
5. `0x6d1e9c` 的普通积分路径直接执行 `position += (baseVelocity + animatedVelocity) * dt`。新位置又成为下一步 Noise 的采样坐标，形成反馈。

旧 Web 路径却执行 `shapePosition += noiseVector`，再按整段 age 合成速度/重力。它既漏掉 dt 积分，也丢失沿运动轨迹重新采样的反馈；出生瞬间就会发生不该有的位置偏移。

## ClampVelocity 的共同作用

原生 `0x6f8e28` 在本剖面中对基础速度和附加速度的**总向量**求长度。超过 limit 时：

```text
blend = 1 - (1 - dampen) ^ (abs(dt) * 30)
scale = 1 + (limit / length(total) - 1) * blend
total *= scale
baseVelocity = total - animatedVelocity
```

之后积分仍使用 base + animated。不能只衰减初速，再在末尾另加 Noise；修正后的基础速度还必须进入下一帧。常量 30 来自原生指令 `0x6f8e9c`，本批不再把它当作经验值。

## 本批实现

- `stepNoiseMotion` 执行重力/基础速度、附加速度、Curl、总向量限速、位置积分及基础速度回写。
- 对象粒子的 Noise 路径从真实形状位置及初速出发，以确定性 Web 60 Hz 网格重建轨迹；当前位置参与下一步 Curl 采样。重力通过当前平面逆矩阵换回局部坐标，避免随后又在世界坐标重复加一次。
- 仅缓存完整网格步，分数帧从网格状态临时计算；回拖重置轨迹。每系统缓存上限为 max(32, capacity×2)，WeakMap 不持有舞台容器或纹理，切歌不增加第二套显示对象。
- 无 Noise 的既有路径保持原有合同。没有新增曲目条件、纹理或共享 public/assets 改动。

60 Hz 是明确的 Web 可回放积分边界，不是已取得 Unity 原录屏的每帧 dt。当前提取合同只接受常量/双色常量的 Velocity，未冒充完整曲线、轨道速度或其它力模块。

## 原生多步验证

扩展已有 `prepare-chibi-noise-kernel-fixture.py`：继续直接执行原生 Noise worker，并串入 `0x6f8e28` 与 `0x6d1e9c`；合成粒子寿命设为不会退场的范围，检查粒子数不变。12 组样例覆盖两种初始位置/速度、限速开关，以及 1/10/60 个步长。它们使用相同的给定 dt、初始相位和附加恒速；无重力模块。

ClampVelocity 的 ELF 导入 `powf` 通过 C ABI 适配为 host pow 后 float32 舍入；仅提供这一个外部数学函数，没有替换 Noise、限速或积分函数的指令。fixture 明确记录该边界，不能把它称为不含任何适配的原机执行。

JS 结果相对原生多步输出最大绝对误差约 `8.22e-6`，测试容差 `2e-5`，同时保留上一批 12 组导数及 48 组单 worker 验证。新增真实 `sampleObjectEmitter` 的出生无跳位、回拖、缓存与冷计算一致性回归。

独立数学回归还用旋转 90° 且非均匀缩放的发射器，关闭 Noise 强度但保留同一积分路径，核对世界重力仍竖直、60 个半隐式步的总位移符合解析级数，且投影后没有重复加入重力。它是 Web 坐标/积分合同验证，不冒充原生有重力 trajectory fixture。

## 构建与 5212 验收

- 原生 fixture 不带 --write 重放通过：12 导数 / 48 worker / 12 多步轨迹。
- 对象粒子 published-assets、距离证明五项边界回归通过；RAW 提取器不带 --write 重解仍为 78 / 709 / 0 deferred / 91 纹理，没有素材变更。
- `npm run build:check`：2957 模块，15.32 秒，固定 `.analysis/build-check`，copyPublicDir:false；既有大 chunk 提示保留。无关生成审计/翻译文件已恢复，没有完整媒体打包。
- 源码门禁 147/147 通过；追加世界重力数学断言后单独重跑对象粒子回归通过。
- 5212 继续复用当前舞台工作树 Vite PID 61564。Browser 插件冷页 1280×720，ROUTE77 49s 为 160 个对象粒子、六个本曲对象层，unsupported/deferred 空、lightingIncompleteFrames=0。实际播放至 2:18 曲末自动暂停，回拖 49s 仍为 160。390×844 同时刻无横向溢出，scrollWidth=390。
- 同一播放器经曲目搜索切 Swing Your Leaves，70s 为 143 个粒子，leaf/panel/共享入射光激活，叶片可见；无 ROUTE77 资产残留。77s（RAW 74s Hide 后）leaf 资产消失，剩 85 个其它对象粒子；回拖 70s 恢复 leaf 与 143。console error 0，无框架遮罩。临时 viewport 已恢复、临时标签已关闭。
- 截图 `.analysis/noise-motion-route77-49s.png`、`noise-motion-route77-mobile.png`、`noise-motion-leaf-70s.png`。Browser 证明 Web 呈现、播放与生命周期，不是原片或 Unity 真机同帧等价。

## 仍需继续的硬边界

- **相位时钟**：`0x6db88c` 仅在粒子范围非空时调用 Noise；无存活粒子的空档不一定累计 scroll。Web 当前按系统相位重建，首次出生前及后续空档需要继续校准。
- 原生实际帧步长、出生批次边界、simulation space/缩放的完整三维路径、Unity RNG 身份仍未等价；本批逆矩阵重力路径没有纳入上述无重力原生 trajectory fixture。
- 因此 20 个 noise_preview 继续保留。8 个 stretch omitted、Whole_screen Noise/type 6 和全库 33 个无消费者资源也没有因本批完成。

局部反编译在 `.analysis/native-engine/noise-pipeline-{callers,update,integrate}.c`、`module-layout.c`、`limit-velocity-native.c`。后续应优先完成相位时钟，再判断公共 Noise 能否推广到 Whole_screen；Stretch 仍需沿 renderer 调用图定位顶点入口。
