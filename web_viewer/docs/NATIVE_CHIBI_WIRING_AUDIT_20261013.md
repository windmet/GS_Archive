# 2D 舞台：现有反编译与当前接线审计

日期：2026-10-13。输入分支 `claude/native-runtime-fidelity-20261013`，输入 HEAD `39a9d89d`。

本轮按“查看是否有可直接优化的地方”进行源码审计，没有修改运行时、导出资源或发布索引。结论：有，而且既有漏接，也有已接入但字段含义错误的情况。此前 RAW / prefab 审计保留的若干“方法体未知”边界，现在可以用工作区中的 IL2CPP 方法体进一步收窄。

## 来源及验证边界

- 当前消费者：`src/components/ChibiStageViewer.vue`、`src/utils/liveChibiSpine.js`、`src/core/chibi*.js`。
- 当前数据：`public/assets/live-chibi/choreography/index.json`，118 份编排；SHA256 `76705ce7b7600d1f4fc0da6ec89ec340fe05486907dd984cccaaba4eef2960e8`。另检查 stage-effects 索引与全部 19 份新悬灯 sidecar。
- 原版方法体：本 checkout 的 `.analysis/ghidra-il2cpp/decompiled_pass1_annotated/`、`decompiled_pass3_annotated/`。下文使用具体方法和 RVA 标识，不把 Ghidra 推断的形参类型视为可靠 C# 签名；浮点寄存器丢失处保留进一步核查边界。
- 复用既有 `chibi-stage-command-coverage.json` 的 RAW 指令提取结果；本轮重新校验其 **60 个 bundle 的大小与 SHA256**，并确认其 118 个 `(songId, source)` 与当前索引完全一致。没有声称重新执行 UnityPy 解码。旧报告的“未消费”状态不能沿用，覆盖现状以当前消费者为准。
- 读取 ELF program headers，按 RVA `0x317a3bc` 解析浮点常量，确认 `LiveEffectData` 各 `AsFloat` 的除数为 **1000**。ELF SHA256 `9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e`。
- 本地可复核脚本与收据：[audit.py](../.analysis/native-chibi-wiring-audit/audit.py)、[receipt.json](../.analysis/native-chibi-wiring-audit/receipt.json)。这些是本地证据，不随文档提交分发。

本轮是反编译 / 数据 / 消费者检查，没有应用改动，因此没有构建、启动服务或 Browser 视觉验收。以下数量表示来源或接线影响范围，不等同于逐曲可见故障数量，也不等同于原版逐帧验收。

## 可以直接纠正的接线

| 优先级 | 问题与现状 | 原版依据 | 当前覆盖及建议 |
| --- | --- | --- | --- |
| P1 | **站位第四参数误接为缩放**。导出器将 value4 写为 `scale`；布局再乘 `sourceScale / 1700`，排序则从 Y 推导。另强制加 350ms 平滑过渡。 | `LiveObjectIdol.SetPosition` `0x221bea0`：value2/3 用于坐标，value4 写入 `+0x68` 后调用 `UpdateSortOrder`；直接设置 localPosition。`UpdateSortOrder` `0x221ab58` 将 `+0x68 + +0x6c` 用于人物排序，影子为其 -10。没有该位置命令的 scale 或 tween 调用。 | **1,178 条 / 118 份编排**。将 value4 正名为排序，固定角色自身尺度；原版模式即时设置位置。兼容过渡如需保留，应明确作为预览选项。例：2600 被当成缩放会得到约 1.53 倍，而原版此处是排序值。 |
| P1 | **动作模式 2/3 被播成 dance → loop**。`playLiveChibiMotion` 总是先选 `_3dance`，再排 `_4loop`；mode 主要影响 reset。 | `LiveObjectIdol.PlayMotion` `0x221bf6c`：value9 为 2 或 3 时传入直接 loop 标志；`PlayMotionInner` `0x221c094` 的该分支选 `{0}_4loop_` 并循环。其他分支选 `_3dance_`，缺失时退回 `_2after_`。mode 3 另控制即时执行，不能仅等同于清轨道。 | **21,657 条 mode 2/3，涉及 118 份编排**；mode 1 为 203 条。可直接修正片段选择与 fallback；mode 2 的原生随机延迟、BPM 基准速度应单独补齐，不能以此宣称完整动作等价。 |
| P1 | **脚光已留接口但始终无效果，第四参数也被误名为 depth**。`footLightingAt` 总是返回 `height: 0`，`syncFootLighting` 不启用过滤器；opacity 没有进入最终渐变强度。 | `Livechara_Foot_Color.PlayEffect` `0x1f331a4`：value1 是颜色，value2AsFloat 是颜色 alpha，value3AsFloat 是渐变时间，`1000/value4AsInt` 是高度倒数。`ChangeFootColor` `0x221b678` 写入颜色与高度倒数；`.cctor` `0x221cc18` 绑定 `_SrcColor`、`_DstColor`、`_RcpHeightCutOff`。现有 costume shader fixture 也保留了确切梯度公式。 | **2,161 条 / 112 份编排**。字段与 uniform 链已经可确定，应该替换旧的 unresolved 结论；实现局部 mesh Y 渐变、颜色 alpha、清除事件。第四参数常见 1250（1,558 条），不是排序深度。需核对 Unity mesh 单位与 Web skeleton 单位，不能直接将 1250 当屏幕像素高度。 |
| P1 | **新悬灯基础显示的第六参数误接为重复次数**。当前 `normal_show` 将 value6 读成 `repeats`，只循环有限次数；遇到 fade/rotate/color 等后设置 unresolved，后续 normal_show 也不能恢复该实例。 | `LiveObjectNewSuspensionLight.NormalShow` `0x221f118` + 回调 `0x1bbfa6c`：value2 是首次延迟；value3/4/5 是亮起、保持、熄灭时间；value6 是熄灭后的等待时间。sequence 依次 append 这四段并无限循环。 | **17,323 条 normal_show / 19 份编排**。value6=0 有 10,794 条，当前近似只播一个周期，原版则持续循环。先纠正已有 normal_show 与控制轨道，再补 RotateAnim/ScaleAnim/Fade/ColorAnim/BeatShow；剩余五类有 **9,021 条**。不能仅去掉 unresolved 后静态显示来冒充控制完成。 |
| P1 | **Backmonitor 排序和指定 Logo 素材未导出；value7 还被用于 Logo 淡变时长**。解析器只保留到 value7，runtime 固定父容器与子层排序，Logo 仅对指定歌曲/素材开放。 | `LiveObjectBackmonitor.PlayEffect` `0x22186e0`：value7AsFloat 写入 `+0x40` 所指 SpriteRenderer 的 alpha；value8AsInt 进入 `SetSortOrder` `0x2218938`，空/0 默认 1000；value9 字符串进入 `SetLogoSpriteIfNeeded` `0x2218a74`。`PlayMovie.MoveNext` `0x1bbcc0c` 的 value6==1 控制 Logo 显隐；其 FadeAlpha 路径使用固定时长寄存器值，不能将 value7 当通用毫秒时长。 | **932 条 / 117 份编排**。其中 value8 显式 1250 有 19 条、1000 有 43 条；value9 指定 `live_backmonitor_movie_logo_passion` 有 3 条。可先完整导出并正确分配字段、按真实材质消费者应用 alpha / 排序。value7 不能直接施加到 movie：反编译证明的是特定 SpriteRenderer，需要关联 prefab 字段。 |
| P1 | **人物身体染色使用乘法 tint，和原 shader 的颜色替换不同**。当前 `bodyColorsAt` 先从白色插值得到 tint，再 `multiplyBodyTint`；对黑色压暗近似成立，对有色染色不能得到原效果。 | `ChangeBodyColor` `0x221bb58` 写入 `_BodyColor`；当前已有 `chibi-costume-shader.json` 的 fragment：`mix(texture.rgb, BodyColor.rgb * texture.a, BodyColor.a)`，后续再叠加脚光。 | **1,188 条 / 15 份编排**。改为 premultiplied 颜色替换，并和脚光组成同一公式；保留按 performer 寻址和 seek 重建。应覆盖有色目标、半透明边缘、染色与脚光叠加，不能只验证黑色。 |

以上六项都有当前数据和消费者证据，适合直接进入小批修复。建议先处理站位/排序与动作分支，再处理人物 shader，之后处理新悬灯和 Backmonitor。人物排序与舞台层级必须一起回归，否则会继续以错误的缩放和 Y 排序补偿原本的穿层问题。

## 真正漏接，但需要新增消费者的项目

| 项目 | 已确认来源 / 当前状态 | 可推进范围 |
| --- | --- | --- |
| **Penlight 全家族** | RAW **6,697 条 / 118 份编排**：Penlight 4,379、unit 743、unit_color 1,575。已经有 `prepare-live-chibi-penlights.py`、native sprite mesh / Animator descriptor，当前 Viewer 和 `stageVfxCoverage` 都没有 Penlight 消费者。原版 `LiveObjectPenlight` 的 `SetAnimation`、`SetTransform`、`PlayEffect`、`PlayEffectUnitAndMain`、`SetSpriteDisplayUnitInner` 方法体已在 pass3。 | 不再以“指令语义完全未知”搁置；先做 named CSV 投影和状态/单位颜色映射，再接 sprite/Animator、坐标和渲染。需要实测新增绘制数量和帧耗，不能把资源导出当成渲染完成。 |
| **Searchlight 全家族** | RAW **10,583 条 / 23 份编排**。现有 Viewer 无 Searchlight 消费者；pass3 已有 `LiveObjectSearchLight`，pass1 有各 executer。 | 可按 show/transform/color/fade 独立状态轨道推进；仍需精确绑定资源、透视与坐标。不是改一个 import 就能完成。 |
| **旧悬灯大范围受预览白名单限制** | RAW **88,647 条 / 105 份编排**。已导出 old-suspension sidecar；生成器 `previewEnabled` 只放行 Moon、Growing Smile、Drive。`chibiOldSuspensionlights.js` 仍按录屏近似并抑制部分多颜色模式。 | pass3 已有 Suspensionlight 各变体方法体，可逐项替换近似。不能把旧 census 的 88,647 条全部写成“当前完全未接”；也不能无条件去掉白名单，把未经核对的 director plane 推广到所有歌曲。 |
| **固定嘴型 / 单人脚光 / 动作 Offset** | 已有 `Livechara_mouth_shape_fix`、`Livechara_foot_color_solo`、`Livechara_Offset` 反编译；主 choreography 导出器没有对应分支，Viewer 没有对应事件消费者。 | 固定嘴型的 play/erase 与普通 lip-sync 的优先级、solo 脚光寻址均可追到原版调用；Offset 写入 liveStage `+0x50` 对象的 `+0x1c`，在人物 Update 中参与时间条件，不能误当空间偏移。**本轮没有这些类型的完整 RAW 行数 census**，不能宣称全部 118 编排均受影响。 |

## 为什么旧审计容易继续漏项

1. `audit-live-chibi-stage-command-coverage.py` 只统计四个灯光家族及部分 Backmonitor 字段，无法证明整套舞台指令覆盖完整。人物、固定嘴型、Underlight、Smoke 等需要独立 census；不能将“脚本通过”理解为所有舞台指令已覆盖。
2. `buildStageVfxCoverage` 只基于已导出/已加载事件计数。Penlight、Searchlight 没有出现在 `sourceEvents`；没有导出的指令在 UI 里也就不显示为缺口。其 Logo 状态仍写为 unimplemented，而 Viewer 已有部分限定歌曲消费者。
3. 源码中“字段语义未知 / 方法体未恢复”的注释，需要按新反编译重新核对。比如脚光倒数高度、新悬灯 normal_show 的无限循环、身体颜色替换、Backmonitor 的 value8/value9，现在已有更强依据。
4. 建议补一张原始指令 → named 字段 → 导出事件 → runtime 消费者 → 资源绑定 → 实际验证的矩阵。原始命令缺少消费者必须显式报出；fixture 和现有解析器不能相互作为唯一正确性依据。

## 后续修复的验收要求

- 站位：至少覆盖 value4=1700/1850/2600、同坐标不同排序、负时间初始化、瞬时切换和 seek；确认人物尺度不被排序值改变，影子和灯光层级跟随原排序。
- 动作：mode 1/2/3、缺少 dance 时的 after fallback、暂停/seek/变速；把片段选择与原版随机延迟、BPM 时间基准分开记录。
- shader：颜色 alpha、局部高度、半透明边缘、body + foot 叠加、erase、solo 寻址；保留缩放与镜头后的局部坐标一致性。
- 新悬灯：value6=0 和长间隔、无限循环、同 ID 重建、控制交叠、erase；所有曲目先跑纯状态回归，再选原录屏能核对的曲目做 Browser。
- Backmonitor：value8 缺省/1000/1250、指定 Logo 素材、value7 对应 SpriteRenderer alpha、movie/transition/Logo 的独立排序；不以录屏近似时长替代已解出的字段。
- 前端改动运行 `npm run build:check` 和实际 Browser 目标旅程；构建不复制 public，不打完整资源包，不部署。视觉验收仍需与原演出对照，不能仅凭状态计数宣布复刻完成。

本批仅提交本审计文档。无关未跟踪文件与现有 `.analysis` 证据均保留。
