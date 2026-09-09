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
