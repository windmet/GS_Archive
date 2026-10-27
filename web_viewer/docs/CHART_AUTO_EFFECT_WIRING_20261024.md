# Auto 演示的原生动效接线核对

2026-10-24；从 master `d0531dcc`（#98 谱面、#99 组合/歌曲已合入）开启 `chart/20261024-autoplay-timeline`。用户提供两张存档录屏截图后，优先核对原生调用链和资源层次。截图只能证明所示画面；不能由两张静帧反推完整动画曲线、随机种子或确认录屏的设置套装。

## 结论与层次

Auto 使用游戏的命中与持续效果体系，不能用统一圆环或一次 CSS 闪光替代。Auto 字样属于独立评价 UI；粒子选择仍使用原生 PERFECT 评价。先前口头将数值 6 称为 AUTO 是错误的：`Evaluation` 为 NONE=0、MISS=1、SLOW=2、FAST=3、GOOD=4、GREAT=5、PERFECT=6。

| 层 | 已核对接线 | Web 当前边界 |
| --- | --- | --- |
| 瞬时命中 | `ShowHitEffect` → `HitEffectManager.Create` → `CreateInner` → `LiveHitEffectPrefabsData.GetPrefab` → 按 prefab 实例 ID 的池 → `EffectController.Play` | 尚无命中粒子消费者；现有 flick 静态方向提示是另一个系统 |
| 长条持续 | `FloatingTarget.Init` 实例化当前套装 `_hold`；`HoldMesh.UpdateFromGameHoldCreatePoints` 根据 `isHolding` 开关；触摸处理有 FloatingTarget 与固定 LanePanel 两条路径 | 现有长条几何不等于这层持续粒子；调度器必须保留持有区间与连续位置 |
| 评价提示 | `EvaluationPanel.get_currentEvalInfo` 在 Auto Live 下返回 `autoEvalInfo`；`Set` 重置位置、停止旧 Animation，再播放当前 EvalInfo 的 clip | Auto 图标／字样及动画应有独立消费者，不属于命中贴图 |
| 轨道反馈 | `LaneEffect.Flash` 把 alpha 设为 1；`Update` 每秒衰减 2 并 clamp；LanePanel 另有固定位置 hold particle | 仅查清独立入口，尚未把每个调用点与录屏帧逐一绑定 |

## 选择规则

原生 `ShowHitEffect`（`0x242a430`）先检查 `isResuming`，恢复期间不创建瞬时效果。随后 P 技能标志优先选择 hitType=5，Special 标志选择 6，否则调用 `GetNoteHitType`（`0x1f475b0`）。这是 **hitType**，不能与 **Evaluation** 的相同数值混用。

| 来源事件 | hitType | 资源选择 |
| --- | --- | --- |
| 普通 tap、hold 首、middle、普通尾 | 0 | 当前套装 touch + evaluation |
| 上／右／左 flick（含对应尾类型转换） | 1／2／3 | 当前套装 flickUp／flickRight／flickLeft + evaluation |
| P 技能标志 | 5 | `_touchPSkill`，独立选择分支 |
| Special 标志 | 6 | `_touchSpecial`，独立选择分支 |
| 未匹配类型／评价组合 | 回退 | `_nullTap`；本次四套来源均为空引用，不能自行补造空击闪光 |

`OverwriteAutoAndHitEffectIfNeeded`（`0x242a78c`）会在尾事件中转换 endtype 并取尾轨位，随后依据转换后的类型计算 large/Special 标志。不能让 LARGE hold 的普通尾自动继承首点的 P 技能效果。

`HitEffectManager.Create`（`0x21cea5c`）在 Auto Live 下将 evaluation 强制改为 PERFECT(6)。创建位置取四舍五入后的 lane 对应目标 Transform，转换到 effect manager 局部空间；这与沿滑条连续移动的 FloatingTarget 不是同一定位过程。

`LiveSettingsData.get_tapEffectData` 按 `tapEffectIndex - 1` 选择 `LiveHitEffectPrefabsData_{1..4}`；构造函数默认 index=1。它与 `NoteFlickEffectDebug` 默认第 2 套的静态 flick 方向资源设置相互独立，也不应与音符皮肤下拉框无依据绑定。录屏的已保存设置未知。

## 资源层次与生命周期

从已绑定 IPA 的 `resources.assets` 提取四套配置（pathId 106537–106540）、全部 24 个字段引用，共 51 个不同 prefab。默认第 1 套示例：

| prefab | pathId | ParticleSystem 层次 |
| --- | --- | --- |
| `fx_in_touch_circle_perfect` | 14650 | 9 系统：flash、shine×2、circle×4、glitter、speedline；非循环 |
| `fx_in_touch_circle_hold` | 32265 | 5 系统：flash、shine×2、glitter×2；循环 |
| `fx_in_touch_circle_sp` | 15053 | M_mark、flash、square、glitter、speedline |
| `fx_in_touch_square_pskill` | 11316 | 与普通命中分开的 P 技能资源；不可只换普通环颜色 |

默认普通 PERFECT 的粒子寿命分别有 0.3 秒（flash/shine/speedline）、0.6/0.7 秒（circle）、0.5 秒（glitter）；system duration=1 秒不能当成所有粒子的可见寿命。材质引用包含 `Legacy Shaders/Particles/Additive`、`Mobile/Particles/Additive`、`Particles/Standard Unlit`。只导出 PNG 不足以恢复叠加结果，仍需消费发射、曲线、UV、材质和 renderer 参数。

瞬时 `EffectController.Play`（`0x2047038`）设位置、当前 noteScale 及套装相机比例，然后激活对象，计时器设 5 秒。`Update`（`0x2047110`）在保护时间内检查各系统 `IsAlive`；全部不存活或保护计时到期时停用并调用回收回调。`Stop`（`0x2046c64`）清粒子、停用对象并清 used 状态。5 秒是保护上限，不是固定可见时长。

持续 `_hold` 在 `FloatingTarget` 下独立实例化，按持有状态激活／停用；`HoldMesh` 的持续定位与重建必须独立于首点的瞬时效果。暂停、缓冲、跳转、切歌／难度的 Web 时间控制仍需明确设计，不能把 Unity 自身 deltaTime 直接替换成任意自由运行的 CSS 动画。

## 回执与复现

生产工具：[audit-song-hit-effects.py](../scripts/audit-song-hit-effects.py)；回执：[song-hit-effects-wiring.json](../scripts/fixtures/song-hit-effects-wiring.json)；source-only 核对：[verify-song-hit-effects-wiring.mjs](../scripts/verify-song-hit-effects-wiring.mjs)。

- 来源绑定继续使用既有 ELF `9843113b…`、解密 Android metadata `dc257cb9…`、IPA data.unity3d `fb28e287…`，工具核对完整 SHA256 和 Android 字段顺序／iOS MonoScript。
- ARM64 实际执行 `GetNoteHitType` 与 96 组 `ShowHitEffect`：12 类型 × 4 标志组合 × 恢复／非恢复。Unity singleton、恢复状态 getter 和最终 Create 提交为显式受控服务；不是原机实时输入回放。
- 实际执行原生 prefab dictionary builder 与 224 次 `GetPrefab`（4 套 × 8 hitType × 7 evaluation），只控制分配和 managed Dictionary 操作；使用真实序列化 PPtr 验证每一结果。
- `Create` 的 Auto→PERFECT、粒子寿命／停止／池管理、Auto 评价 UI 和轨道反馈目前为方法体／序列化资源检查，未冒充这些生命周期均已 ARM64 动态执行。回执中的方法窗口 hash 用于绑定复核输入。
- 每个 prefab 记录子节点位置／旋转／缩放、ParticleSystem 和 renderer 原始对象 hash、启用模块、寿命、循环设置、材质／shader／纹理引用；完整模块树保留于本地 `.analysis/chart-native/hit-prefabs-inspection.json`，不提交完整解包素材。

本机重放（PowerShell；使用已有 UnityPy 和 Unicorn，不复制素材库）：

```powershell
$env:PYTHONPATH='E:/Web_build/SideM_Archived/web_viewer/.analysis/native-python-runtime'
py -3.14 scripts/audit-song-hit-effects.py --elf E:/Tools/ghidra_work/sidem/libil2cpp.decrypted.so --metadata E:/Web_build/SideM_Archived/web_viewer/.analysis/sidem_runtime_dump/global-metadata.android.decrypted.dat --ipa 'E:/BaiduNetdiskDownload/SideM/サイスタ - 副本/サイスタ 2.6.10.ipa' --output scripts/fixtures/song-hit-effects-wiring.json
node scripts/verify-song-hit-effects-wiring.mjs
```

source-only CI 读取跟踪回执，不具备私有 ELF／IPA，也不会重新提取原生资源。暂未声明 Web 视觉、录屏逐帧、物理手机或原机 GPU 等价验收。

## 接下来的接线顺序

1. 完成已开始的媒体时间事件调度与 seek 状态恢复；保留普通／flick／Special／P 技能及首中尾身份，不能仅输出一个事件总数就视为 Auto 完成。
2. 将命中效果选择与生命周期整理为共享函数，依据上述原生回执验收；独立实例化同刻多事件，避免后一事件覆盖前一事件。
3. 分别实现瞬时粒子、持续 hold 与评价 UI 消费者；沿用已有轨道高频／控制台低频隔离，粒子年龄以媒体秒数驱动。
4. 对照录屏验证组合层次、透明叠加、首中尾／方向差异与退场，再做整曲稳定性和真机性能。当前只提供两张静帧，尚不能完成录屏时间曲线的逐帧对照。

本批审计不代表这些 Web 消费者已实现，不部署、不上传 R2。
