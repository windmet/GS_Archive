# E1 纯状态投影契约

状态：纯函数与无 GPU 管理器对照已实现；不接管 renderer，不替代 scheduler。
实际运行时按需采样和差异记录现已接入，见
[只读对照验收](PROJECTOR_SHADOW_ACCEPTANCE_20260909.md)。仍保留本文的首批范围限制。

`projectStoryState(normalizedScenario, { stepIndex, time, viewport, context })`：
输入须为 normalized schema v2；stepIndex 是数组位置，time 是当前访问本 step
之后的逻辑秒，非 scenario 累计时间。时间不得为负或非有限数，视口必须显式提供。
不读取真实时钟、manager、资源、Vue 或 Pixi，不执行任何一次性音频/截图副作用。

默认从该 step 的 entry_snapshot 开始；分支、回看或重复访问若采用其它起点，调用方
必须传 context.entrySnapshot 与非空 context.historyId，标识已解析的访问历史。
函数不从之前调用推断状态，也不擅自沿数组遍历选择路径。跨步保持状态由这个
显式 entry 输入承担；这不代表隐藏历史无关。

语义模式假定资产就绪、cue 在 at 精确开始；cue 按开始时间排序，同刻保持输入
数组顺序。边界 time=at 已启动；零时长立即结束。末尾时间不自动切换 step。
可用 context.startedAt 按 cue_id 提供实测逻辑起点（不得早于 at），以描述派发/
资源等待后的开始时间。未给出的 cue 仍采用语义起点；它不是资源加载模拟器。
本函数不模拟 skip/settle 操作；稳定恢复须传显式 entrySnapshot/historyId 和
cuePolicy=suppressed，保持该状态并禁止重放 cue。普通分支入口使用 replay（默认）。

首批输出背景混合层、镜头舞台仿射变换、独立 fade/wipe 屏幕平面。背景线性混合；
镜头/fade/wipe 为 easeOutCubic。镜头输出为 stage 位置，背景几何裁切不在本批。
同一镜头目标被覆盖时从覆盖时刻的计算位置重新插值；屏幕每次 cue 使用其协议
定义的起点。两个屏幕平面可同时存在，不能压成一个最后写入的 overlay。
重叠背景切换目前显式标为不可投影，不伪造多纹理取消行为。

spines/filters/effects 返回 `status: not-projected` 与独立克隆的 entry 数据，绝不
称为采样结果。未支持 cue、normalizer 未映射字段、背景非 dissolve 类型均进入
coverage；即使 supported channels 完成，整体仍是 partial，不代表像素 parity。

验证：纯函数输入不可变、重复/逆序查询一致；边界/零时长/同刻/覆盖/显式历史；
与生产 CameraController/屏幕 tween 的多时间点 shadow 对照。对照使用无 GPU 的
生产方法，不等同真实媒体/浏览器验收。E2 仍须 E1 对照及 pre-E 冻结基线。


## 本批证据

`npm run verify:story-projector` 可在 source-only CI 运行：不可变输入、查询顺序、
同刻和零时长、显式历史、跨步 overlay、双屏幕平面、覆盖镜头、延迟起点、
未支持状态以及 36 组生产管理器多时间点比较。使用实际 CameraController、
PixiStageManager 的 fade/wipe 方法和 BackgroundManager，合成纹理，无 GPU。

`node scripts/verify-story-projector.mjs --local-sources` 另读五份本地发布产物，
strict-v2 与 compatibility 经原 normalizer 输入；共 215 步的 cue 前/中/后、entry
与最终 camera/bg snapshot 核对通过。没有重编译、写入或发布这些源文件。
这些真实源查询证明输入适配和快照边界，不能冒充浏览器真实帧比较。

后续已接只读的运行时 shadow 采样及差异报告，显式记录纹理等待/派发起点、
snapshot restore 和 settle 的适用范围。E2 前仍需独立 pre-E 基线。

## 主线全量离线对照扩展

起点 `7fea50a`。`--local-sources` 现从 Story Catalog 的 main 集合枚举全部已发布
分段，不再硬编码五个样本，也不依赖阅读 manifest。未公开章节没有分段，不生成
虚拟输入。验证读取真实 compiled，经生产 normalizer 后执行纯查询，不修改运行时。

本机实测 204 个分段、6,817 步、17,973 个时间点；每个时间点重复查询并按逆序
重查，结果一致，输入保持不变。结束点的 camera scale 与可投影 background
标识均与 settled snapshot 一致。原 36 组生产管理器对照及 shadow 验证仍通过。
时间点数量不含重复和逆序重查；这不是 17,973 次浏览器帧验收。

最终时间点查询中 background/screen 的 not-projected 步数均为 0。该数值不表示
整个场景完整投影，也不表示已验证背景裁切或全部 screen 像素。
未支持 cue 按实际 action 汇总（每步去重 cue_id 后计数）：

| 动作 | 数量 |
| --- | ---: |
| se.play | 1047 |
| spine.face.set | 3368 |
| spine.body.play | 1615 |
| spine.neck.play | 314 |
| spine.visual.tint | 6 |
| spine.neck.stop | 66 |

normalizer 尚未映射字段按角色路径合并：`state.spines.*.fade` 2790 条，
`state.spines.*.idol_color_transition` 48 条，`state.screen_effects` 6 条。
它们是字段出现次数，不是不同动作或受影响步骤数。全体步骤仍保留 animation、
filters、particles、background geometry 与 audio side effects 的 partial 限制。

下一步优先核对角色 fade/tint 的源字段、管理器语义与只读可观察状态，再决定
投影扩展；不先删除 unmapped 标记。音频仍是副作用，不纳入纯状态执行。
本批只扩验证覆盖和报告，未更改播放器行为，未启动长稳或 E2。

## E1 角色 tint 纯查询

起点 `7029540`。新增独立输出 `spineTints.entries`，包含角色 id、status 和整数 RGB
tint；原 `spines` 仍为 not-projected，不能把颜色结果称为骨骼姿势或整角色情况。
此增量不修改 normalizer、SpineStage 或管理器执行路径。运行时 shadow 面板仍只
比较原三个通道，新 tint 输出尚未完成浏览器实际帧对照。

初始颜色来自显式 entry 的 idol_color；仅接受六位 RGB 或默认白色。标准化
spine.visual.tint 使用生产方法的 easeOutCubic 与逐通道整数四舍五入。
同刻保持 cue 顺序，覆盖时从覆盖时间的已计算颜色开始；实测起点沿用 startedAt，
suppressed 恢复不重放。未知角色、非法颜色保持 unsupported cue；已有角色的
非法颜色或 unmapped idol_color_transition 使该角色输出 not-projected/null。
不删除或假装消费那 48 条未标准化颜色过渡。

验证新增生产 setSpineColor 方法的 6 个边界/中间时间点和 3 个覆盖时间点，
连同原通道共 45 组无 GPU 对照通过。覆盖未知目标、非法颜色、未映射过渡、
延迟与禁止重放；全主线正序/逆序查询及可投影角色的最终 tint 与 settled snapshot
一致。主线 6 个标准化 tint cue 已不再列为 unsupported，其他限制计数不变。

透明度暂不投影：生产方法使用整体 AlphaFilter，起点取决于新建/复用模型、
可见性与资源就绪；零 duration 实际也使用默认淡入时间。不能直接按剧情中的
fade duration 当作线性透明度输入。后续须补显式视觉 entry/实际开始时刻的
读取契约与浏览器对照；这不影响当前播放器继续工作。

## E1 背景局部几何（接续 `7a06913`）

新增 `backgroundGeometry`，显式标注 `space: background-container-local`。
调用方通过 `context.backgroundTextures[bg] = {width, height}` 提供纹理原始尺寸；
纯投影不加载纹理，不读取 renderer。输出各混合层的 x/y、width/height、
scaleX/scaleY、anchorX/anchorY，背景层身份仍由原背景状态投影决定。

生产 `_applyBgCover` 实际按视口高度等比缩放，水平居中且 x 四舍五入、y=0、
anchor=0；不能替换成常见的 max(widthRatio,heightRatio) cover 公式。
这里只投影局部 Sprite 几何，不宣称滤镜、相机叠加后的屏幕像素或完整画面 parity。
缺失/无效尺寸、不可投影的背景切换仍返回 not-projected；无背景时为空列表。
只有尺寸充分时才移除本次查询的 background-geometry limitation。

只读 shadow 从当前及过渡 Sprite 的 `texture.orig` 读取尺寸作为输入，并独立
读取 Sprite 的实际变换作对照。不会将实际 x/scale 当作预期值；人为偏移 x 的
测试能报告差异。纹理等待、显式 settlement、失败/取消等沿用背景通道的不可比较规则。
旧 renderer、normalizer、背景加载与 resize 执行逻辑均未改变，E2 仍未接管。

验证：12 组真实 PIXI Sprite / 生产 `_applyBgCover` 比较，包含四种纹理比例及
桌面、390×844、非整比例视口的重复 resize；已有 45 组生产管理器对照通过。
缺尺寸、无效尺寸、空背景、过渡双层、只读不变及故意几何偏差验证通过。
全主线 204 分段/6817 步/17973 查询回归通过；离线未提供纹理尺寸，因此
6795 步仍有 background-geometry 限制，另 22 步为空背景，不能称全库几何验收。

浏览器实际 URL：
`http://127.0.0.1:5175/?view=player&scenario=episodes%2F1_4_001_05_j.json&start_step=3&runtimeDebug=1`。
step_id=3、纹理 bg083_ringstage_out_03（1800×960）：桌面 1280.453125×720.453125
及手机 390.34375×844.125 均得到 backgroundGeometry match，error 日志为空。
两份完整报告保存在 `C:/Users/windm/.codex/evidence/sidem-background-geometry/2026-09-09/`。
未启动 START/长稳；未声称真实浏览器背景过渡中途或所有纹理已验证。
source-only Vite build 通过，既有主包超过 500kB 提示仍在。

## E1 静态背景滤镜参数（接续 `513f458`）

新增独立 `backgroundFilters`，投影静态 blur 数值及背景乘色叠层的可见性、
RGB tint、alpha=0.85 和 multiply 模式。沿用生产场景适配器规则：非空且不等于
`#FFFFFF` 的颜色才保留 dof×6 模糊，非正及不大于 0.01 的值归零；白色叠层清除。
生产代码对白色大小写的 blur/overlay 判断不同，测试保留这一实际差异，不暗中修 renderer。

`bg_color_transition/bg_dof_transition` 仍通过 applyStepSceneState 直接调用管理器，
缺少标准 cue 和初始视觉值。因此任一字段含正 delay/duration 时，即使查询时间很大，
也返回 unresolved-filter-transition；不能假设历史起点、将目标冒充中途样本。
非法颜色和非有限 blur 返回 invalid-filter-state。shadow 只读管理器 blur 参数和
真实 overlay 的 tint/alpha/blendMode；尚存活动滤镜 tween 时不可比较。
这是参数对照，不证明 BlurFilter 挂载、GPU 像素、滤镜顺序或 camera filter 完整性；
总 coverage 的 filters limitation 与原 filters.entry 输出继续保留。

6 组生产 applyStepSceneState/BackgroundManager 静态对照、过渡拒绝、非法输入、
故意偏移与活动 tween 排除通过。原 projector/shadow 检查及全主线查询回归通过；
6817 步中 6609 步可投影静态参数，208 步未支持。没有修改 normalizer 或执行路径。

真实浏览器沿用上述主线 URL，step_id=3：blur=4.800000000000001，tint=11184810，
alpha=0.85，backgroundFilters match，error 日志为空。完整报告位于
`C:/Users/windm/.codex/evidence/sidem-background-filters/2026-09-09/static-step3.json`。
尝试 start_step=2 时自动前进到 3，第二份报告按实际步骤命名为 second-static-step3；
没有得到真实过渡中途采样，不将其写成过渡通过。source-only build 通过，既有大包提示保留。
下一步需解决滤镜过渡的显式起始视觉状态及读取契约，再扩展这 208 步；长稳继续后移。

## E1 滤镜过渡的显式起点契约（接续 `961b7ea`）

纯查询现可接收 `context.backgroundFilterOrigins`，每个通道必须属于本次实际调用：

```js
{
  blur: { from: 2.4, startedAt: 0.5 },
  overlay: { from: { visible: true, tint: 0xAA4422, alpha: 0.85 }, startedAt: 0.6 }
}
```

startedAt 使用当前步骤逻辑秒，表示 setter 调用/tween 开始，尚未加源字段 delay。
from 表示调用前的实际状态；未挂载 overlay 用 `{visible:false}`，新建乘色层从白色
开始。不接受用目标值、任意前一步 settled 或采样时当前值充当起点。blur 与 overlay
可以不同步开始。非法起点拒绝，缺失记录保留 unresolved-filter-transition。

延迟前保留 blur 初值；有色 overlay 在调用时立即变为 alpha=0.85，delay 后颜色
按 easeOutCubic/整数 RGB 插值。白色目标以原 tint 淡出 alpha，完成后清除；没有
初始 overlay 则始终为空。白色目标且 duration=0 时，生产 setter 忽略 delay 并立即
清除；已用实际管理器确认，不能统一套用所有过渡的 delay。零时长颜色切换仍等待 delay。

30 个生产 applyStepSceneState/BackgroundManager/runRafTween 对照点通过，覆盖新建、
已有彩色层切换、白色淡出、空层、零 duration 和 delay；输入冻结、重复/逆序查询、
开始前查询、两个独立起点、非法起点拒绝通过。原静态/几何/45 组管理器对照和
204 分段/6817 步/17973 查询回归保持通过。

本批仅补纯计算契约，未增加生产起点采集；runtime shadow 仍拒绝活动滤镜过渡，
离线真实主线的 208 步仍未支持。未重编译/发布剧情，未新增浏览器过渡或长稳证据。
下一批将实际调用前状态与开始时刻绑定到当前步骤/恢复上下文，再接只读 shadow；
不能跨步复用旧 tween 的起点记录。
