# 对象粒子：Take 灯串、Platinum/INFOCT 入射光

输入 HEAD `97ab96c2`；工作树 `stage-native-fidelity-20261014`；5212 原进程复用。本批只把已反查的原生对象层资源接到统一发射器，不改动 Runtime 时钟、灯光或排序语义。

## 一、范围

从 `song_rote77` 扩到 12 个 bundle，共 29 个原生资源 / 320 个已消费粒子系统 / 25 个显式 deferred / 17 张原图：

| 家族 | 资源 | 系统 |
| --- | --- | --- |
| Take 灯串 `fx_in_tkstp1_linelight_1..7` | 7 | 247（35/49/44/33/22/35/29） |
| Platinum 入射光 `fx_in_plmask_incidentlight_1..3` | 3 | 12 |
| 共享入射光 `fx_in_infoct_Incidentlight_1..6` | 6 | 24 |
| Platinum 吊灯/面板 `chandelier`、`panel_1` | 2 | 13（另 2 deferred） |
| ROUTE77 `meter`、`turbo_1/2`、`fire_1/2/3` | 6 | 12（另 20 deferred） |
| Smoke/glitter/leaf/incident 补充 | 5 | 12（另 3 deferred） |

资源选择不是曲名白名单：`entries` 由对象层索引、`extra` 与四个资源前缀求交；每个 bundle 独立解析蒙版并按根 Transform 绑定。纹理身份改为 `序列化文件:pathId`，物理文件名取该身份的 SHA-256 前 24 位，避免同名 PathID 跨 bundle 覆盖；不再以裸 pathId 命名。

## 二、新增的原生语义

- 发射器 Transform 不再要求只有 Z 旋转：改为四元数正交性检查（`2(xz-wy)≈0`、`2(yz+wx)≈0`），保留原版平面内旋转与镜像；矩阵用完整四元数展开，镜像不再丢失。
- `ShapeModule.type=12`（锥/边）接入：半径、`m_Scale`、`m_Rotation` 与 `m_Position` 按原版组合，要求 edge 模式半径曲线为常量且初速为零，避免把移动边当静态边。
- `VelocityModule`：仅接受局部坐标、无非均匀缩放、无 ClampVelocity；X/Y/Z 曲线按出生时间采样并对年龄积分。
- `InitialModule.size3D` 的 Y 轴尺寸与 `SizeModule.separateAxes` 的 Y 曲线独立采样；矩形光束按 X/Y 两个尺寸渲染。
- `ColorModule` 只接受生命周期渐变；`startColor.minMaxState=4`（双色/渐变）按逐粒子种子取色，仍保留生命周期 RGBA。
- `Mobile/Particles/Alpha Blended` 必须命中原生 `srcBlend=5 / destBlend=10 / blendOp=0`，并从 Shader 代码断言 `SV_Target0 = u_xlat16_0 * vs_COLOR0` 与颜色钳制；不只凭名字判定混合。
- 延迟原因逐系统记录：`unity_noise_displacement`（19）、`native_stretched_billboard_solver`（6）；带原因的系统不进入 320，也不被算作完成。
- 资源细化不再清掉公共层：同一 bundle 的蒙版、纹理与系统各自归属，避免跨资源生命周期互相释放。

## 三、验证

- `python scripts/prepare-chibi-object-emitters.py`（无 `--write`）：29 resources / 320 systems / 25 deferred / 17 textures，逐像素、逐哈希、fixture 与公开 JSON 完全一致；`--write` 只在显式请求时落盘。
- `node scripts/verify-chibi-object-emitters.mjs` 与 `--published-assets`：通过。断言 247 盏独立灯、edge 矩形光束 X/Y、镜像矩阵、burst 循环、StopEmitting 尾粒子、UV 与回拖；每个延迟系统必须带原因。
- `node scripts/run-verifier-batch.mjs`：147/147 PASS。
- `npm run build:check`：通过（14.72 s，固定 `.analysis/build-check`，不复制 public）。
- 5212 实际 Browser（1440×900，完整加载）：
  - Take a StuMp! 在 0:12 暂停：`nativeObjectParticleCount=163`，8 个可见对象层（7 条 linelight + `fx_in_tkstp1_panel_1`），10 个运行时；无异常。
  - Platinum MASK 在 0:20 暂停：`nativeObjectParticleCount=509`，7 个可见对象层（chandelier、incidentlight 1–3、panel 1–2、共享 `fx_in_tfmvmt_Incidentlight`），16 个运行时（含共享 INFOCT 六组与 smoke）；无异常。
  - console 只有此前已记录的 Spine `set tint` / `update` 弃用 warning，没有新增 error 或 Vite 遮罩。

## 四、边界与下一批

- 25 个系统仍是明确 deferred：19 个 Unity Noise 位移、6 个 stretched billboard。没有用 Sprite 淡入或近似噪声冒充。
- `fx_in_tkstp1_panel_1` 仍走旧的 sprite instances 回退（对象层索引无原生粒子数据），本批没有把它算作已消费；这是下一个可直接补的缺口。
- 对象层索引另有 156 个被编排引用的资源未进入发射器数据，其中约九成是 particle kind（如 `pfofos_fire_1..8`、`pcuslv_bloom_1..4`、`drvalv_panel`、`grwsml_panel`、`swyrlv_incidentlight_1..5`）。下一批应先把同一 profile 能覆盖的 particle 资源全部建表，再处理 Noise/Stretch。
- 随机种子是 Web 端确定性种子，不是 Unity 原随机流；轨迹积分仍是 60 Hz 可回放离散边界。本批不宣称原片逐帧或真机等价。
- 未部署、未合 master、未改公共媒体边界；本批只提交 stage 线源码、数据与文档。
