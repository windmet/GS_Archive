# Take a StuMp! 星星层与延迟循环采样修复

用户对照原片指出 1:10 附近应有一层大四角星，当前没有。输入 HEAD `904a60b6`；工作树 `stage-native-fidelity-20261014`；5212 原进程复用。

## 一、找到的两个真实缺口

### 1. `fx_in_tkstp1_panel_1` 从未进入发射器目录

该资源就是星星/星云层：4 个 Alpha Masked 粒子系统，主纹理 `fx_in_particle_variation2`（1024 图集，含四角星）与 `fx_in_tkstp1_nebula`（512 星云），遮罩为 `fx_in_tkstp1_panel_1`。编排从 -2s 起一直激活，但此前选择器只收了 `linelight_` / `incidentlight_` 前缀，panel 落在目录外，运行时只建了一个空容器，所以整首歌都没有星云。

已加入目录：3 个系统消费，1 个 Noise 系统明确 deferred；新增 2 张原图（星云 + 粒子图集）。

### 2. 带 `startDelay` 的循环发射器会整段漏采

`sampleObjectEmitter` 计算循环窗口时用未扣延迟的时间：

```
first/last = floor((base - maxLife) / period)
```

但出生时间实际带 `+startDelay`，于是窗口偏移，每隔一段时间整轮被跳过。`fx_in_tfmvmt_Incidentlight` 的 glitter（1:08 激活，delay 1.2s，rate 25）在 69.5s 有 8 个粒子，70.0s 变成 **0**，70.5s 又回到 8——正好落在用户指出的时间点。修复为用 `probe = base - delay` 计算窗口；70.0s 恢复为 20 个粒子。

这条影响所有带延迟的循环系统，不止星星。

## 二、验证

- `python scripts/prepare-chibi-object-emitters.py --mode current`：44 / 365 / 29 / 29，逐像素与哈希一致。
- `node scripts/verify-chibi-object-emitters.mjs`（含 `--published-assets`）：通过；新增“延迟循环在 2.0–4.5s 连续窗口不得为空”回归。
- `npm run build:check` 与 `node scripts/run-verifier-batch.mjs`：通过（本轮结果见提交说明）。
- 离线采样（同一纯函数）：70.0s glitter = 20 个、尺寸 36–86px、alpha 0.24–0.42；修复前为 0。
- 5212 Browser：70s 截图无异常；星云 panel 容器可见（alpha 1，3 个系统共 159 个可见粒子）。

## 三、三首代表性 MV 的漏接审计

按编排的 `objectLayerEvents` 统计（sprite 走静态实例；particle 必须进发射器才算消费）：

| 歌曲 | 对象层资源 | native | sprite | particle 未接 | 其它层 |
| --- | --- | --- | --- | --- | --- |
| Take a StuMp! | 10 | 10 | 0 | 0 | 2 image layer；全屏 type 3/4/5 |
| ROUTE77 | 7 | 6 | 0 | 0（1 个仅 deferred：swyrlv_leaf 的 2 个 Noise） | 10 spotlight、6 pinspotlight、24 laser |
| FLASH LIGHT | 17 | 8 | 5 | **4** | 4 image layer |

FLASH LIGHT 的 4 个 particle 未接资源待下一批定位（与 start color 模式 117 个系统同源，需要先补渐变起始色剖面）。

## 四、仍未闭合的边界

- 原片 1:10 的大四角星更可能是全屏 `type 3/4/5`：离线采样显示 type 4 的 9 个粒子尺寸只有 11–27px 且 y 多为负（屏幕上方外），type 5 为 2000px 级但 alpha 0.00–0.17。当前全屏层的像素/坐标映射与参考图不一致，需要拿一帧做逐像素对齐后再动，不在本轮凭印象放大。
- glitter 修复后已在 70s 产生 20 个粒子，但发射器链在 y=+5 世界单位（屏幕上方），是否符合原片仍待同帧对照。
- `fx_in_tkstp1_panel_1` 的 1 个 Noise 系统、FLASH LIGHT 4 个 particle 资源、ROUTE77 的 noise leaf 均未消费；Noise/Stretch 的反编译仍在进行（libunity 已定位 `Unexpected number of dimensions passed to particle noise` 字符串与工程）。
- 随机种子仍为 Web 确定性种子；本批不宣称逐像素等价。
