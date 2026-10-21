# Object_layer Sprite 透明度消费者（2026-10-21）

输入 HEAD `69b6f77a4db5945e0fce5a87165fd723014b8650`，分支 `stage/20261020-native-followup`。承接 [来源诊断](NATIVE_OBJECT_SPRITE_FADE_AUDIT_20261020.md) 和 [原生代码回放](NATIVE_OBJECT_SPRITE_TWEEN_REPLAY_20261021.md)。本批修复公共 object index 中 46 组纯 Sprite 的透明度消费；不把它写成整个舞台或设备帧历史等价。

## 改动与行为

新增 `chibiObjectSpriteTweens.js`：每个 renderer 保留自己的 alpha，tween 在首次更新时读取当前值，按创建顺序更新；完成的 tween 移除，仍存活的旧 tween 继续执行。退场回调的 active 状态独立于颜色，旧 tween 写回正 alpha 不会自动重新显示对象。新 show 重新激活子对象。

SFC 对本轮受限 Sprite 轮廓使用子 Sprite 自身 alpha，父层 alpha 固定为 1，不再从零对整组线性淡入，也不再永久乘着序列化初值。renderer plane 同步仍使用既有几何/排序链。资源异步到达后按当前时刻采样；切歌清除 timeline，倒回重放，重复采样同一帧不会再次推进。

适用条件为 `kind=sprite`、没有 particle/group、存在 instances，并排除独立 APK built-in shader 分支。RAW 来源收据已证明当前 46 组的 423 个 renderer 均 enabled、子 GameObject activeSelf 均为 true。粒子 Play/StopEmitting 与其他消费者继续走原分支。本批没有修改 RAW、公共语料、纹理、编舞、release 或端口。

## 时钟与精度边界

内核接受明确的帧 delta，使用原生单精度操作顺序、OutQuad、首次 getter、全部存活 tween 和完成回调语义。已用独立 ARM64 结果对照。

播放与 seek 共用 Web 60 Hz 参考帧：帧时间 `n*1000/60`，本帧命令先派发，再用 `1/60` 更新。帧间指令在下一参考帧处理；首个命令所在帧同样更新一次。缓存只推进完整参考帧；无存活 tween 的空闲区间可跳过，inactive 对象上仍存活的 tween 不可跳过。倒回重置后按相同参考帧重放。

这是明确的 Web 时钟选择，不是原设备帧历史。DOM 标记保留 `native-per-renderer-tweens-web-60hz-preview`，没有宣称原片/真机逐帧等价。现有公共索引初始 alpha 保持 6 位小数，RAW 收据仍保留原始单精度颜色；本批未重编全库以更改该输入精度。

## 原生对照与回归

实际数据存在零时长 erase，不能仅接受正时长。原生回放新增 zero-hide / zero-show：零时长在首次更新完成，并执行原生退场完成回调；内核按原生终点处理，不做除零。

- 原生内核样本从 7 扩至 9 组，共 25 次更新，包含零时长、同帧首次 getter、短 tween 完成后旧 tween 续写、active 与颜色分离、原生活动数组顺序。
- 新增 3 条 RAW 轨道的原生参考帧执行：Café Parade! 的两个 overlight（包含半透明 renderer）和 Growing Smiles 的 overlight，0–12 秒共 54 个探针。内核与原生 alpha 误差小于 `2e-7`，active 相等，倒回后的探针结果一致。这是相同受控参考帧下的代码对照。
- 回归直接执行实际 SFC 的 presentation/layout 函数，确认两个不同初始 alpha 的子 Sprite 分别渐变、父 alpha=1、renderer plane 接线取得该值；未用一个脱离 SFC 的替代函数当接线证据。
- `audit-chibi-object-sprite-fades.mjs` 改为读取实际 SFC presentation，避免继续只审计已不控制本轮 Sprite 的旧 fallback。来源范围仍为 46 / 423 / 129 条轨道 / 2757 事件；首次 show 隔离反例 50→0，完成后初始 alpha 限制反例 23→0。状态仍为 `full-parity-unverified`，不是覆盖率或完整还原声明。

命令结果：`verify-chibi-object-sprite-tweens`、particle-lifecycle、sprite-geometry、object-renderer-planes 通过；`npm run verify:source-batch` 为 161/161。新 verifier 已纳入源码批次。原生回放生成后再次读取同一 ELF 复跑通过。

`npm run build:check`：2975 modules，25.37 秒，固定 `.analysis/build-check`，不复制 public。构建 entry 审计通过：启动 JS 204711 / 204800 gzip bytes，没有禁入初始模块。既有大 chunk 提示保留。构建生成的 resource/translation 审计元数据核对后恢复，不混入提交。

## Browser 实测

Cua In-app Browser / Windows，归属已核实的本 checkout 5213 dev 服务（PID66480）；候选 `rm-release-20261015`，release `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`。没有使用外部 Browser 或 shell CDP。

| 旅程 | 观察 |
|---|---|
| 桌面 1280×800，Café Parade! 9.2 秒 | 首组所有子 alpha=1；第二组两个半透明子对象为 0.903807，其余为 1；不再是父层统一 0.5 |
| Café Parade! 9.8 秒，再倒回 9.2 秒 | 全部子 alpha 达到 1；回拖恢复 0.903807，与冷 seek 相同 |
| 15.1 秒退场 → 15.2 秒重现 | 先 off / alpha=0，再 on / alpha=1，活动资源列表同步清退和恢复 |
| 实际播放 | 完成动作预载后，时间轴从 15.2 秒实际推进到约 59.8 秒，随后暂停；不代表整曲稳定性验收 |
| 切至 Growing Smiles，7.7 秒后倒回 7.5 秒 | 7.7 秒 overlight 为 on / 0.922376；7.5 秒为 off / 0.766389，旧 tween 正 alpha 不使已退场对象重现；Café 资源不残留 |
| 手机尺寸 390×844 | Café 9.2 秒状态与桌面相同；页面 clientWidth=scrollWidth=390，无横向溢出。不是手机真机验收 |
| RED HOT BEAT 20 秒 | panel + 左右 smoke 正常，1134 个粒子，unsupported 为空；Sprite 修复未改变粒子分支 |
| 控制台 | 检查范围内无应用 error，保留既有 Pixi/Spine tint/update 弃用 warning |
| 整页刷新 | 重新关闭 full 模式选择窗并 seek 9.2 秒，状态恢复 0.903807 |
| 返回歌曲 | URL `/songs/cfprde/?maintainer=1`，无残留 song/stage/view 参数；详情的演唱成员、音频和最大 Combo 134 / 302 / 415 / 816 已加载 |

桌面与手机截图为本机小型证据 `sprite-tween-cafe-9200-desktop.png`、`sprite-tween-cafe-9200-mobile.png`，位于当前 Codex 可视化目录；不包含媒体包。页面身份、非空渲染、无框架错误遮罩已核对。原片、生产包、GPU 逐像素、原始 Conductor/设备帧历史，以及排除的 mixed / CanvasGroup / APK built-in alpha 仍有独立边界。

本批没有部署。工作区原有删除和无关未跟踪文件保留，提交只包含本批源码、回归/原生 fixture 和文档。
