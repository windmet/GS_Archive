# 30 个对象粒子资源进入通用消费者

输入 HEAD `20b83a55`；工作树 `stage-native-fidelity-20261014`；复用 5212 原 Vite 进程 PID 61564。本批解决资源未进入消费目录的问题；不宣称粒子求解器与 Unity 逐帧等价。

## 来源与接线

依据 [全库消费审计](NATIVE_OBJECT_CONSUMPTION_CENSUS_20261018.md) 的 RAW 试解析，新增 `scripts/fixtures/chibi-object-emitter-promotions.json`：30 个资源身份、各自系统数及原对象索引 SHA-256。没有新增曲目专用的颜色、尺寸、轨迹或速度参数。

提取器将这些身份加入 current 目录，并强制校验：全部系统通过当前剖面、没有 deferred、没有 Noise/Stretch partial，系统数与清单一致；来源改变或不再兼容时拒绝生成。清单是有界剖面接入记录，不是原生完成证明。

本批包含 `brndnf_ring`、`byndtd_wing`、`hrkzbn_bubble_l/r`、`grwsml_panel`、`stofft_string`、`yivygr_smoke` 等，完整 30 项以 fixture 为准。

- 通用目录：44 → **74 个资源**，394 → **549 个系统**，deferred 保持 0；原来的 **28 个显式 preview** 保持不变。
- 新增 55 张 RAW 解码 PNG / **6,091,571 bytes**；目录共 88 张纹理。继续用 `serializedFile:pathId` 身份及哈希文件名，未改共享 public/assets。
- 全库合并四条消费者后：无消费者资源 **67 → 37**，对应事件 **561 → 433**，受影响编排 **75 → 20**。4 个 tibeti 缺失源资源仍未解决。
- 新资源自动走现有预载、逐 renderer 排序、蒙版、StopEmitting、回拖和释放链路；没有增加第二套播放器或歌曲特例。

## 验证

- `python scripts/prepare-chibi-object-emitters.py --mode current --consume-deferred`（不带 --write）：74 / 549 / 0 / 88，逐像素、哈希及 RAW fixture 一致。
- `node scripts/verify-chibi-object-emitters.mjs --published-assets`：通过；新增 30 项必须实际发射、Stop 后寿命结束必须清空的回归，保留全目录确定性与容量检查。
- `node scripts/audit-chibi-object-consumption.mjs`：实际 attach 验证通过，37 missing / 433 events / 20 arrangements。
- 二进制 inventory：384 PNG / 70,599,536 bytes，通过。新增纹理最大单文件 632,617 bytes，未放宽策略阈值。
- `npm run build:check`：2956 模块 / 14.78 秒，通过；固定 `.analysis/build-check`，不复制 public。构建辅助生成的无关翻译与资源审计文件已恢复至本批前状态。
- 源码门禁 `node scripts/run-verifier-batch.mjs`：147/147，通过。

## 5212 Browser 插件回归

新建临时标签冷启动，选完整加载；实际沿曲目面板切歌，没有通过重载代替释放测试：

| 旅程 | 实测 |
| --- | --- |
| BRAND NEW FIELD 12s | ring 对象层激活，435 个对象粒子，unsupported/deferred 空 |
| BRAND NEW FIELD 连续播放 | 从 12s 预载后播放至至少 1:34，再暂停、切歌；无 error |
| → Beyond The Dream 12s | 仅 wing 对象层，34 个对象粒子；无上一首 ring 对象残留，lightingIncompleteFrames=0 |
| → はるかぜバトン 12s | 左右气泡实际可见；70 个对象粒子，unsupported/deferred 空 |
| 气泡回拖 | 12→30→12s，恢复为 70 个；RAW 在 28.05s Hide、28.28s 再 Show，因此 30s 仍有粒子是再次发射，不能判成未销毁 |
| 气泡最终退场 | RAW 61.75s Hide、78.3s 再 Show；70s 时对象层资产为空，粒子 0 |
| 390×844 | 气泡画面与控制台重排正常，scrollWidth=390，无横向溢出；临时 viewport 已恢复 |

console error 0，无 Vite 遮罩。截图保存在 `.analysis/promotion-{brndnf,byndtd,hrkzbn}-12s.png` 和 `.analysis/promotion-hrkzbn-mobile.png`。临时标签已关闭；用户原有标签未操作。

这是代表性运行回归，不能替代 30 项全部原片同帧验收。

## 仍需反查的硬缺口

1. **现有形状求解器含参考实现**：球/半球/圆/锥的分布与方向尚未完成 libunity 对照，尤其当前统一以局部 +Z 计算初速方向、锥形只采底面、球形 radiusThickness 的表面/体积判定需要复核。本批没有改这些数学语义，未把“无 Noise/Stretch 标记”写成原生等价。应优先完成这项反查，再评估 30 项的轨迹精度。
2. 正式目录仍有 20 Noise preview、8 stretch omitted；全屏粒子的 Noise 消费链也仍有缺口。
3. 37 个无消费者资源仍需按模块补齐：全量审计的首个拒绝原因以出生时刻起始曲线采样（80 系统）最多；其它包括非平面 Transform、速度限制、生命周期颜色等。应逐项反查后再放开合同。
4. Underlight 四族、Smoke 独立指令、单人脚光、全屏 type 6、缺失源 bundle 和 Sprite 逐实例动画仍未闭合。

本批已完成来源建表与通用链路接入；整体原生复刻继续进行，未部署、未合主线。
