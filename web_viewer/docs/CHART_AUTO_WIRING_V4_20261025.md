# Auto 原生模块接线与 V4 验收

输入：`chart/20261024-autoplay-timeline` / `8258b424`；实际工作目录 `E:/Web_build/GS_Archive_Domain_Work/chart-native-projection-20261023/web_viewer`。本批落实第二份审计中的资源消费缺口，并更正 [V3](CHART_AUTO_ACCEPTANCE_AUDIT_V3_20261025.md) 的过度验收结论。

## 实施结果

已将默认第 1 套七个 prefab 的启用模块接入实际 sampler，Canvas 消费原生贴图、颜色、独立粒子及投影轴。**这是来源模块接线通过；还不能称 Unity 引擎/GPU/原录屏逐帧等价。**

- `prepare-song-hit-effect-contracts.mjs` 从绑定 IPA 的 `source-assets.json` 生成运行合同，保留每个系统的 node ID、粒子原始字节 SHA256、根与节点 TRS、Initial/Size/Color/UV/Shape/Velocity/Force/ClampVelocity/Rotation 模块及 renderer 参数。数据仍来自既有 `fb28e287…` IPA；未新增媒体包或发布资源。
- 不再按 subName 手写固定效果尺寸/透明度/角度。消费出生数量、各次 burst 时间、寿命、尺寸/颜色曲线、随机区间、局部变换和伸展长度。普通 flash 确实发射 2 个粒子，speedline 为 20 个。
- 效果池按“最后 burst 出生时间＋粒子寿命”回收，修复 P 技能在0.5秒、Special在0.55秒被提前截断；新增0.60/0.66/0.71秒的池回归。
- 两个 circleframe_3 系统为 **26448、23264**，使用各自的 UV 和颜色/尺寸曲线，不再输出完全相同的指令。第二个节点不是 V3 写的 33264。
- flick 和 P 技能按来源 UV 曲线切换 cell；Special 的来源曲线本身保持第 2 格，因此保持该格，并非强制做动画，也不再画第 0 格。删除无来源的 `sp-ring`。
- hold 不再使用正弦脉冲和四个轨道点；五系统按 **3/2/2/20/10** 每秒发射，消费 Velocity、Force 和 ClampVelocity。世界空间粒子使用出生时的轨位；局部空间粒子跟随当前轨位。BPM/折线轨迹沿用已有秒域 knots。
- 使用确定种子的随机样本，固定 60Hz 积分并缓存轨迹；每个来源层最多缓存 64 个出生实例。曲线/渐变读取和暂停恢复不依赖实际 rAF 频率。**种子和数值积分是 Web 适配，不声称复刻 Unity 的随机序列/内部限速积分。**
- Auto 消费完整 AnimationClip 的 Hermite 切线、缩放、alpha、RGB 和 active 曲线。0.03 秒主图 scaleX 来源检查点为 **1.08709617718292**，旧线性输出为 1.0775000196509066。
- Auto 的两个效果 Image 材质为 `UI-Default-Screen` / Material 9，但不能根据名字推定 Screen 混合；实际 Shader 965 的 blend 为 **SrcAlpha(5)/One(1)**。Canvas 按该证据使用 lighter。
- 从固定 IPA 读取三个 Image 的原始 152 字节、材质/Sprite 指针、初始颜色和 RectTransform，保留 hash/hex；这是绑定版本的 UGUI 布局解析，不是通用 MonoBehaviour 反序列化器。初始 Sprite 为 PERFECT 2011；运行时 Auto 的 Sprite2068 选择沿用原生 EvaluationPanel 的已绑定字符串合同。
- Auto 位置由 EvaluationPanel `(9,-125)` 与子 Image `(0,36)` 合成。在 Web 1280×720 中为 **(649,449)**，替代原 `judgeY-45` 猜值。UIBackCanvas 仍通过 Web 的中心坐标适配。
- Canvas 真实执行贴图 RGB 乘色并保留源 alpha，移除 drop-shadow 替代方案。共享图片解码；着色 cell 使用 **16MiB** 上限的 LRU，不再随每个效果组件重新创建图片缓存。

## 验证记录

本地证据位于 `.analysis/chart-native/`，不纳入发布包。

| 项目 | 本批证据 | 边界 |
| --- | --- | --- |
| 来源再提取 | `wiring-v4-export.log`；22 textures / 22 materials / 7 默认 prefab，Auto Sprite2068 / Clip1090 | 只更新本地 QA 导出；无 public 全量拷贝 |
| 合同一致性 | `node scripts/prepare-song-hit-effect-contracts.mjs --check` 通过 | 依赖本地固定来源导出，CI 不持有私有 IPA |
| 媒体路径 | 10 张 PNG 的状态、MIME、字节 SHA256 通过显式 `--origin=http://127.0.0.1:5231` 校验 | dev 服务，非生产发布 |
| sampler | `verify-song-hit-effect-renderer.mjs`；零 burst、尺寸、TRS、颜色、寿命、伸展长度、hold rate/force/limit、世界空间出生位置、UV 与 Auto 曲线变异通过 | 能拒绝旧硬编码消费者；非 Unity 引擎 oracle |
| 事件/选择 | 244 playable 档 / 80,141 事件 / 2,722,796 采样 / 26,817 seek；96 ARM64 选择 / 224 lookup 回归通过 | 事件与分支选择 |
| flick connector | 200 档 / 2,859 条连接回归通过 | 有效网格不等于每个连接的原机截图验收 |
| Source batch | **184/184**，`wiring-v4-source-batch-final.log`；随后新增的 burst 池修正再跑 selection/renderer 专项 | 后续只修改 selection 并新增该专项断言，未机械重跑其余182项 |
| 构建 | 最终 `build:check` **3012 modules / 17.85s**，固定 `.analysis/build-check`，copyPublicDir=false | 有既有 chunk >500kB 警告；不能写“零警告”或“完整发布包” |
| Browser 组件 | 两首受控整曲与暂停/恢复、buffer、seek、切视图/难度回归，实际 Canvas 像素与乘色检查 | 受控媒体/rAF；结果见最终 `wiring-v4-component-result.json`；半透明贴图的实际乘色读回为 `[50,50,50,128]` |
| 实际整曲 | BRAND NEW FIELD EXPERT **130.650998秒，587/587，ended=true**，池清空；`wiring-v4-real-song.json` | 此回执为本批模块接线后、最终缓存/Auto 位置微调前的真实播放；最终代码另跑组件旅程 |
| CPU/回调 | Café Parade! EX，Auto 开启，实际视口 **481×455**，前台可见/聚焦，无等待或 ratechange 事件 | 下方说明；非 GPU FPS/真机 |

首次 20 秒：轨道 CPU median/P95 **6.2/17.2ms**，rAF 104.39Hz，6 次 >50ms。缓存后同一歌曲/窗口 20 秒：CPU **5.3/15.8ms**，rAF **106.48Hz**，轨道更新 **1150 次（约57.35Hz）**，7 次 >50ms、0 次 >250ms。音频前进约20秒，visibility 无异常。日志为 `wiring-v4-performance.json` / `wiring-v4-performance-cached.json`。不能用观察 rAF 频率宣称游戏稳定106 FPS；长帧数没有改善，仍需继续分析 Canvas 着色和轨道更新的峰值。

最后的 burst 池修正后再测同一窗口，见 `wiring-v4-performance-final.json`：CPU median/P95 **5.4/15.9ms**，track **1128次/20.0383秒（约56.29Hz）**，观察 rAF98.11Hz、回调间隔P95 **25ms**，3次>50ms、0次>250ms，音频前进约20秒，无缓冲/焦点警告。三轮长帧数量有波动，不能把差异单独归因于缓存或池寿命变化；**稳定60Hz性能验收仍不通过**。

最终组件回归的两首暂停画面分别有 **10,591/10,794** 个非透明像素，其中带颜色像素 **6,364/6,212**；暂停恢复最大单通道差均≤1/255。最终正式 App 另在1178×663沉浸视口验收并截图 `wiring-v4-final.png`，与上方481×455性能窗口分开记录；PNG pending/failed均0，控制台未见新error/warn。

## 仍保留的验收缺口

1. Unity 原生 Camera 的完整材质/色彩空间/粒子 billboard 与 Web 局部正交投影的逐帧对齐尚未完成。像素乘色和 Canvas 内 lighter 已接入，但透明 foreignObject 与场景的合成不自动等价于 Unity 对背景的 Additive。
2. 数值积分、sphere/box/box-edge 发射的固定随机样本是 Web 实现；没有 Unity 内部粒子循环的执行回执。不能把已有序列化 Force/Velocity 数据称为“缺 dump 的微扰动”，也不能称已经获得引擎完全等价。
3. Auto 三层的原生位置、曲线、初始颜色和效果材质已有绑定。Sprite 更新后的原生虚调用布局/SetNativeSize 与完整 UIBackCanvas runtime 缩放仍未在原机执行验证；Web 当前保留 Sprite 自然尺寸和中心画布适配。
4. 仅默认第 1 套实际消费；四套选择查表通过不等于四套渲染支持。图片失败/Canvas2D 不可用的完整降级 UX、WebGL context lost、后台恢复和物理手机仍未覆盖。
5. 两张参考截图能证明多色/多层/位置层次，不能提供完整时间曲线或设备设置。本批没有同一录屏时刻的原机逐像素差异回执，也未给整个画面/舞台/Chibi 作还原通过结论。

下一步先围绕普通命中和 hold 的相同时间点，绑定原机录屏逐帧与色彩/投影；并继续定位剩余 >50ms 峰值。不要继续用“184 项绿灯”代替视觉或帧率结论。

## V3 勘误与提交边界

V3 的“全部 4 项 P1 彻底修复”不成立：输入 8258b424 仍有 hold 正弦/轨道公式、flick/P/SP 首格、同指令双圈、Auto 线性插值和阴影替代乘色。上述消费者已在本批替换，但原机/GPU 对齐仍按上方保留。目标谱面的 **10 个多音符 flickgroup 实际包含32个音符、22条连接**，不是20个音符；另有单音符 group，不能混为连接组。

本批只提交列明的源码、工具、fixture、配置及本审计；`config/resource-audit.json` 保留原生成差异，不提交。无 PR 合并、部署、R2 上传或端口变更；5231 运行本 worktree 的 Vite，candidate 为 `rm-release-20261022`，public corpus fallback 为主 checkout。

模块语义参考 [Unity TextureSheetAnimationModule](https://docs.unity.com/en-us/engine/6000.0/script-reference/unityengine/particlesystem/texturesheetanimationmodule) 与 [LimitVelocityOverLifetimeModule](https://docs.unity.com/en-us/engine/7000.0/script-reference/unityengine/particlesystem/limitvelocityoverlifetimemodule)；这些 API 文档不提供原游戏的引擎逐帧回执。
