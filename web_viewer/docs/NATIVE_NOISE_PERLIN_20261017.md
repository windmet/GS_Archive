# 对象粒子 Noise：Perlin 置换表与 preview 位移

后续 [原生 Curl 内核校准](NATIVE_NOISE_CURL_KERNEL_20261018.md) 已纠正本页旧实现：原生高质量分支组合的是 Perlin 导数，不是三个 Perlin 值。damping 与原生梯度表已用 AArch64 CPU 重放验证；整条更新链仍保留 preview。本页为历史记录。

输入 HEAD `88b4e827`；工作树 `stage-native-fidelity-20261014`；9334 端口无 BFCache 的无头 Edge 验收。

## 一、反编译证据

- 噪声字符串 `Unexpected number of dimensions passed to particle noise` @ `0xef8080`，唯一引用 `0x7416c8`（ADRP+ADD）。
- 驱动 `FUN_00841400`：按维度/octave/damping 分支，读取 `NoiseModule` 的 strength/frequency/scroll/remap，累加到对象 `+0x170`。
- 调度器 `FUN_00846b8c`：把粒子区间切成 500 个一批，调用 worker `FUN_00848704`（5244 字节 SIMD）。
- worker 引用的只读全局 `DAT_00ef8134`（libunity `.rodata` RVA `0xdf8134`）是 **256 项 uint32 的 Ken Perlin 置换表**：`151,160,137,91,90,15,131,13,201,95,96,53,...`，与经典 Perlin/improved noise 表逐项一致（脚本校验 `sorted(table)==0..255`）。

结论：Unity 粒子噪声的核心是标准 Perlin；驱动层再做频率、滚动、octave 和强度映射。

## 二、实现

- `chibiObjectEmitters.js` 内嵌上述 512 项置换表（原表重复一次），实现经典 Perlin3：`fade` 五次曲线、12 个梯度、三线性插值。
- `NoiseModule` 位移：坐标 `p*frequency + scroll*age`，按 `octaveCount` 叠加 `octaveMultiplier/octaveScale`；X/Y/Z 各用固定偏移采样，形成向量场；乘 `strength` 后加到发射器局部坐标。
- 20 个带噪声的系统标记 `noise_preview`（不再是 `noise_omitted`），数据里保留 `noise` 参数。

严格边界：**damping 与 remap 曲线尚未复刻**；滚动方向/坐标偏置是按驱动语义做的文档化近似，不是逐位等价。因此标 preview，不计为原生完成。

## 三、目录与验证

- 44 个资源 / 394 个已消费系统 / 0 deferred / **28 preview**（20 noise + 8 stretch）/ 33 张原图。
- `verify-chibi-object-emitters.mjs` 两种模式通过（partial 断言改为 `noise_preview`）。
- `npm run build:check` 14.02 s；`node scripts/run-verifier-batch.mjs` 147/147。
- Browser ROUTE77 49s：6 个对象层、160 个对象粒子、`deferred=0`、`unsupported` 为空，火焰区正常；无 console error。

## 四、下一步

- Stretched Billboard（8 个系统）：renderer 的 `m_LengthScale/m_VelocityScale` 已从 RAW 读到，顶点求解器尚未定位。
- Noise 的 damping / remap：驱动函数里有对应分支，需要继续反编译 `+0x170` 累加与曲线映射。
- 当前 preview 已让火焰/叶片有空间扰动；后续对齐后再把 `noise_preview` 收敛为完整消费。
