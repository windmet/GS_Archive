# 星星图层与原生对象粒子剖面扩展

输入 HEAD `f325731a`；工作树 `stage-native-fidelity-20261014`；5212 原进程复用。本批先做对象层漏接审计，再补星星/星线与同族光效的消费者，并修复 stage 纹理未进入二进制策略的 CI 缺口。

## 一、审计：对象层漏接面

以 118 份编排的 `objectLayerEvents` 为准，共引用 185 个对象层资源：

| 类别 | 资源 | 事件 | 现状 |
| --- | --- | --- | --- |
| particle | 135 | 992 系统 | 只有 29 个进入原生发射器，709 个事件落在 106 个无消费者资源上 |
| sprite | 46 | 2757 | `overlight`/`spotlight` 等静态实例，走对象层 sprite 回退 |
| 索引缺失 | 4 | 4 | `fx_in_tibeti_*` 在对象层索引中记为 missing |

星星图层是其中一类：`fx_in_trhorz_star_1/2`、`starline_1/2`，以及 `fx_in_strclb_starlight`、`fx_in_wtstry_glitter`。trhorz 在 0:25 时 `nativeObjectParticleCount=0`，5 个激活对象层全部 `unsupported`（monitor、panel_2、star_1、starline_1/2），确认是静默漏接而不是路径错误。

## 二、原生剖面扩展

逐项按 RAW `ParticleSystem` typetree 接线，不按曲名或资源名放行：

- `main.prewarm`：原版在激活时已预演一整轮。采样器把系统内部时钟前移 `duration`，循环系统在 t=0 即为中段相位；这是星星、星线此前被挡的主因。
- `main.startDelay.minMaxState=3`：逐粒子在两个常量间取延迟。延迟进入粒子出生时间而不是系统级扣减，StopEmitting 截断随内部时钟一起平移。
- `RotationModule.curve`：角速度曲线按粒子寿命归一化，在 60 Hz 离散边界上积分（与已反查的 ClampVelocity 阻尼同一时间基），不再用“曲线起点 × 年龄”的常量近似。
- 修正一个真实判定 bug：`minMaxState in [0,3]` 被当成范围，实际只接受 0 和 3，导致所有 curve 模式（1/2）被静默 deferred。现明确为 `(0,1,3)`，并拒绝 `separateAxes`。
- 新增 `--mode all-particles` 与 `--report`：按编排引用筛选全部 particle 资源、逐系统输出延迟原因，不写盘；本批只把星星与同族资源纳入正式目录。

## 三、目录与覆盖

正式目录从 29 个资源扩到 **43 个资源 / 362 个已消费系统 / 28 个明确 deferred / 27 张原图**：

| 新增资源 | 系统 |
| --- | --- |
| trhorz `monitor`、`panel_1/2`、`star_1/2`、`starline_1/2` | 15（star_1 另有 3 deferred：2 stretch、1 sphere） |
| `fx_in_strclb_starlight` | 6 |
| `fx_in_wtstry_glitter` | 1 |
| `fx_in_swyrlv_incidentlight_1..5` | 20 |

纹理身份仍是 `序列化文件:pathId`，文件名取 SHA-256 前 24 位；本次写入后清理了 64 张全量试跑留下、当前目录未引用的残留。

## 四、二进制策略修复

`verify:tracked-binary-inventory` 此前对 `stage-searchlights/` 与 `stage-object-emitters/` 的 PNG 直接报 “no binary-policy classification”，上一批 Searchlight 纹理也会在 CI 失败。现在：

- 在 `scripts/lib/tracked-binary-inventory.mjs` 为 `stage-object-emitters`、`stage-searchlights`、`stage-whole-screen` 增加 `stable-promoted-asset` 分类，`force_add_allowed:false`，`owner_release:2026-10-17-native-stage-textures-001`；
- 重新生成 `policies/tracked-binary-assets.v1.json`：323 个 tracked PNG / 64,238,363 bytes；三个 stage 目录合计 3.83 MiB，低于 10 MiB 批次门槛；
- 未删除或改写任何已有素材。

## 五、验证

- `python scripts/prepare-chibi-object-emitters.py --mode current`（无 `--write`）：43 / 362 / 28 / 27，逐像素、逐哈希、fixture 与公开 JSON 完全一致。
- `node scripts/verify-chibi-object-emitters.mjs` 与 `--published-assets`：通过。新增断言覆盖 prewarm 激活即非空、随机 startDelay 在最小延迟前不发射、1 rad/s 角速度曲线积分、trhorz star 的 3 个 deferred 原因集合。
- `npm run build:check`：15.94 s 通过；`node scripts/run-verifier-batch.mjs`：147/147 PASS。
- `node scripts/verify-tracked-binary-inventory.mjs`：323 PNG / 64,238,363 bytes，通过。
- 5212 实际 Browser（1440×900，完整加载）：
  - trhorz 0:25：`nativeObjectParticleCount=1126`（修复前为 0），7 个可见对象层，含 `star_1`、`starline_1/2`；`unsupported` 为空；剩 4 条 deferred 明确记录。
  - tkstp1 0:12 回归：9 个可见对象层、153 个粒子，`unsupported` 为空；无异常。
  - console 仍只有已记录的 Spine tint/update 弃用 warning，没有新增 error 或 Vite 遮罩。

## 六、剩余缺口（本批未算完成）

- 92 个被编排引用的 particle 资源 / 659 个事件仍未进入目录。`--mode all-particles --report` 显示全量 135 资源 / 992 系统：567 可解析、425 明确 deferred。主因依次是 start color 模式 117、noise 109、shape 102（sphere/circle）、stretched billboard 22、initial curve 25、生命周期颜色 12、非平面 Transform 7、3D rotation 8、per-particle mask tint 6、velocity 积分 8、缺核心模块 9。
- `fx_in_trhorz_star_1` 的 2 个 stretch、1 个 sphere 仍 deferred；没有用 Sprite 拉伸或随机球面分布冒充。
- 46 个 sprite 对象层仍用 RAW 静态实例；其逐实例动画/材质时间轴尚未核对。
- `fx_in_tibeti_overlight_1/2`、`fx_in_tibeti_water_1/2` 在对象层索引中缺失，来源 bundle 未定位。
- 随机种子仍是 Web 确定性种子；不宣称 Unity 真机或原片逐帧等价。未部署、未合 master。
