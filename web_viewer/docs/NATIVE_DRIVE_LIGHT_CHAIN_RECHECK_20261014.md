# DRIVE A LIVE 灯光：原版链路复查

输入 HEAD `76eccb83`，分支 `codex/stage-chibi-wiring-20261013`，日期 2026-10-14。

用户指出旧复刻主要依靠截图，要求先追溯原版。本记录区分已恢复的执行语义、资源绑定和仍需验证的屏幕投影；没有把截图校准测试升级为原版验收。**当前旧悬灯消费者尚未按下述结果替换。** 本轮已完成的新悬灯代码另见本批记录。

## 来源与调度

直接读取 `RAW/asset/song_drvalv.unity3d`：SHA-256 `f48457befbf7be3b35384230184725ee82d3ddb7ce2eceb092730a1baf7a37f6`，20 份演出脚本。

标准 `drvalv_live_effect` TextAsset pathId `2525908965094360385`，脚本 SHA-256 `fe27ee870c2b7c3905041ecbad2ec051bf35f7a5e93028414d890eb1af963981`。包含旧悬灯 169 行（基础 137、_2 16、_5 16，含 erase）；20 份共 3,380 行。另有 Spotlight 35、Underlight/2/4 合计 19、Laserlight 4、Penlight 72、Backmonitor 6；这些不是旧悬灯的别名，不能用一套包络覆盖全部灯具。

正常播放链路：

`LiveEffectPlayer.OnUpdate` → `LiveEffectData.DoEffect` → `LiveEffectTypeExecuter.DoEffect` → 对应灯具 executer → `LiveObjectContainer.GetOrCreate(类型名, value1)` → 灯具 `PlayEffect` / `EraseEffect`。

- `LiveEffectData.isErase`（`0x1d6d034`）只比较 **value101=="1"**；value102 是 eraseDuration，不能拿它当删除开关。
- `LiveEffectTypeExecuter.DoEffect`（`0x1d6d984`）按 isErase 分派虚方法。`SkipEffect`（`0x1d6da3c`）才传 skip=true。
- `Suspensionlight.PlayEffect`（`0x2226fec`）正常路径 Kill 该灯的 DOTween → ApplyData → SetActive(true) → 虚方法 Show。skip 路径关闭对象，不能替代正常连续播放的姿势。
- Container（GetOrCreate `0x221a2d0`、Create `0x221a470`）按类型与编号复用实例，新建时放入 LiveStage 的 Base。正在激活的对象重发命令没有 Animator.Play/Rebind；因此不能每次命令都无条件把动画相位归零。

方法体在本地 `.analysis/ghidra-il2cpp/decompiled_pass1_annotated/`、`decompiled_pass3_annotated/`。本轮又检查 ELF ARM64 指令及常量，避免将 Ghidra 对 Vector3 的不完整签名当成标量实现。

## 基础旧悬灯：已经确认的字段

`LiveObjectSuspensionlight.ApplyData` RVA `0x22270d0`：

| 字段 | 原版消费者 | 当前复刻差异 |
| --- | --- | --- |
| value1 | 实例 ID，类型名也参与对象 key | 按类型和 ID 分离可保留。 |
| value4 | Float /1000 秒；Animator.speed = 2 / 周期秒 | 周期解释有原版依据；把大数视为完全停止只是一种近似，原版仍以极慢速度推进。 |
| value5 | `right` 时 LeftRightBase 绕 X 轴 0°，其他值 180° | 必须组合层级变换；不能随屏幕 Y 值切换镜像/基准角。 |
| value6 | 根节点 Vector3.one × Float /1000，统一缩放 | Moon 的忽略缩放与按曲目选择坐标比例缺少原版依据。 |
| value7 | 根节点绕 Z 轴旋转，整数角度 | 不能把 Animator 的曲线额外居中减去半幅。 |
| value8/9 | ScriptPosToStagePos 后设置根节点 localPosition | 位置本身不随摆灯相位移动。 |
| value10 | TryParseHtmlString 后写 SpriteRenderer.color | 固定 alpha=0.55 没有原版依据。 |
| value11 | SpriteRenderer.sortingOrder | 与人物、背屏、其他光束的排序需保留。 |

这条正常链不读取 value2/3 来关闭 Animator；当前要求它们都等于字符串 `1` 的门槛不能作为已恢复规则。

基础 Show（`0x2227328`）DOFade 到 1，时间 **0.2 秒**。基础 EraseEffect（`0x222738c`）Kill 旧 tween，再 DOFade 到 0，仍为 **0.2 秒**，完成后 SetActive(false)；这里没有读取通用 eraseDuration。ELF `0x317a31c` 的 float 为 0.20000000298。

因此，先前文档/测试把 Drive 28.185 秒的 value102=2000 判为两秒渐隐，是错误结论。按这条灯具实现，该次退出在约 28.385 秒完成，而不是 30.185 秒。需要替换旧验收中对应断言。

## Animator 与层级

从配置 XAPK 的 `data.unity3d` 重新读取四类旧悬灯的实际 Animator：resources.assets pathId `45931/45932/45934/45935`，均 enabled=1、cullingMode=0、keepAnimatorControllerStateOnDisable=false，绑定 controller `1350`。

controller 默认 state=0，对应 `angle60` / clip `1241`；`angle30` / `1240` 是另一个无自动 transition 的 state。两者均为两秒循环。当前按指令 value12 推测选 angle30/angle60、编号灯补半周期、value14/15 控制是否旋转，都不是这条原版执行链的行为。

_5 实际层级为：

`根节点（脚本位置/角度/缩放） → LeftRightBase（X 轴 0/180°） → fx_in_sidelight（固定 Z 轴 +60°） → sidelight（SpriteRenderer + Animator）`。

clip generic binding 的 path=0，旋转写在 Animator 自身的 sidelight Transform 上，和 +60° 基座是两个独立节点。不能覆盖或忽略其中一层。先前截图得到的 240°/300° 数值可能在某种二维分解中出现，但应由矩阵组合得到，不能再靠 Y 阈值、曲目白名单和半幅扣除维护。

同一激活实例重发周期时应保留已经走过的相位；关闭后再激活的状态重建还要考虑上面的 keepState=false。预载、负时间初始化、暂停与 Web 后退 seek 的完整时间基准仍须做独立回归。

## Drive 的两种编号灯

### `_2`：BPM 明暗与轮换颜色

Show `0x1c01c60` 从 `RhythmGameManager.noteManager.curTempo` 取当前 BPM；ELF 常量 60 已确认，单拍秒数为 60/BPM。value10/13/14 构成颜色列表，SwitchColor 切换颜色；value12 决定明暗分支，value15 决定额外拍数等待。FadeIn/FadeOut 是独立 tween，再在循环完成时换色。

当前 Drive 谱面资源的 tempo 为 140；与原版 NoteManager 运行时对应后，单拍应约 428.57ms，而不是当前写死 1000ms 的余弦。谱面字段存在本身不能代替 NoteManager 时间转换/运行时更新验证。

### `_5`：色相循环，不能当呼吸灯

Show `0x1c02850` / Apply `0x1c02b04`：

- 将 value10 转为 HSV，保留 S/V；value12 是 hue tween 时长，value13 是开始延迟。
- value14==0 时 hue offset 从 0 到 1；其他值从 1 到 0。线性循环，经 `(原 H + offset) % 1` 再 HSVToRGB 写颜色。
- **value14 是色相方向，不是 Animator 开关；该 Show 没有 alpha 呼吸。**
- Drive 17.5 秒的 `_5:1`：旋转周期 value4=5000、色相周期 value12=3000，两条通道并行。没有延迟时，19 秒处色相已走半圈：原 `#33f170` 对应约 `#f133b4`，不是维持绿色只改变透明度。这是按原版线性 hue 数学计算的例子，不是存档视频取色结果。

当前实现恰好把这类灯的 hue 周期变成 alpha 余弦，并根据 hue 方向阻止 Animator，足以改变 Drive 的动态观感。

## 舞台投影已追到的来源

- `ScriptPosToStagePos`（`0x2218894`）为 **(Vector3(x,y,z) − (0,360,0)) × 0.01**。已核对 ARM64 三个分量；BasePos 常量 `0x32d4d78` 和 pixelToStagePos `0x31734bc`，不是只看反编译器显示的单个 float。
- 通过 LiveStage 的实际 PPtr 绑定到 Base / LiveObjectCamera / StageCamera，核对 level4 场景及 resources prefab 两份：Base 的 XY 为零、局部缩放 1；Camera 是正交相机、序列化 size=5。这不是从 36 个相机里挑一个同名对象。
- Camera 正常指令仍会改变 orthoSize、位置与角度（PlayEffect `0x221985c` → PlayAnimation `0x2219960`），还可跟随人物；静态序列化 size=5 不能直接当整曲投影。
- 还需把 stageScale、演出 Camera、实际 viewport/渲染目标串完并验证最终矩阵。**当前没有据此直接更改旧投影，也没有声称恢复了完整原版摄像机。**

小型读取证据在 `.analysis/native-chibi-wiring-audit/drive-raw-command-census.json`、`drive-native-runtime-assets.json`、`drive-native-stage-bindings.json`、`drive-native-projection-bindings.json`；没有导出新的完整素材包。

## 共用修正顺序与验收边界

旧灯索引共 105 份编排、88,647 行（基础 42,263，_2 14,382，_3 25,269，_4 929，_5 5,804），目前仅 42 份开启预览。原版方法与资源绑定提供了替换白名单猜测的基础，但不能在摄像机与生命周期尚未验证时一次打开剩余 63 份。

接下来先实现统一层级变换和持续 Animator 相位，纠正基础显隐与 `_5` 色相通道，再接 `_2` 的 NoteManager 节拍。Drive 用 10.7s 黄色灯、17.1–20s 绿灯重发周期、17.5s `_5` 色相与 28.185s 退场做来源回归，随后抽查 Growing/Moon 及其余曲目。原片用于验证最终观感与对时，不再用于反推字段。

本次证实的是源码/资源层的误接及修正依据；没有取得新的完整存档对时、真实设备帧率或全曲视觉一致性验收。原有 `verify-chibi-old-suspension.mjs` 的截图规则通过，不能证明上述原生语义正确。
