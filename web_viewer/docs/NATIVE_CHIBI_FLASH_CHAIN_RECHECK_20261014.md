# FLASH LIGHT：动作调用链复查与回归修正

日期：2026-10-14（前夜开始复查）。分支 `codex/stage-chibi-wiring-20261013`；输入 HEAD `5d73443c`。

用户反馈新版 FLASH LIGHT 动作不如旧复刻接近存档。反查确认首批的模式判断错误：**将 isLoop 与 skip 混为一谈，遗漏正常播放的延迟回调，导致模式 2 跳过主动作。** 本批暂停新悬灯实现，先纠正该回归。工作区既有未跟踪文件保留，没有回退整条分支或改写资源库。

## 完整调用链及依据

| 环节 | 原版行为与证据 |
| --- | --- |
| CSV → LiveEffectData | `Parse` RVA `0x1d6d110` 按 value1/value2/... 命名读取；当前导出 motion=value1、speed=value2、mode=value9，索引没有把列顺序交换。 |
| 正常调度 | `LiveEffectPlayer.OnUpdate` `0x1d6f1d4` → `LiveEffectData.DoEffect` `0x1d6d860` → executer，传入 skip=false。 |
| 原生跳转 | `LiveEffectPlayer.Seek` `0x1d6f488` → `LiveEffectData.SkipEffect` `0x1d6d9f4`，传入 skip=true。这和正常播放是不同路径。 |
| 执行动作 | `Livechara_motion.PlayEffect` `0x1f33668` 按 value3 找人物，再透传 skip 给 `LiveObjectIdol.PlayMotion` `0x221bf6c`。 |
| 分离两个布尔量 | PlayMotion 令 isLoop=(mode==2 或 mode==3)，但 skip=(外层 skip 或 mode==3)。C# metadata 明确 `PlayMotionInner(int motionId, bool isLoop, Vector3 actualPos, float speed, float pauseTime, bool skip)`；不能将 loop 标志当成立即选 loop 的标志。 |
| 正常路径 | `PlayMotionInner` `0x221c094` 的 skip=false 分支通过 DelayedCall 调用 `b__0` `0x1bbe040`：先 SetAnimation(dance, loop=false)，再在 isLoop 时 AddAnimation(loop, loop=true)。没有 dance 时先 before，再 after，最后才是可选 loop。 |
| 立即路径 | 同一 PlayMotionInner 的 skip=true 分支：isLoop 时直接 SetAnimation(loop,true)；非 loop 则 dance，缺失时 after。上一批只实现了这一分支，并错误推广到正常 mode 2。 |
| 混合与排队 | 正常回调写 TrackEntry `+0xa4 = 0.15`；metadata 对应字段确为 mixDuration。`AddAnimationByPrefix` `0x2080aa4` 将 delay=0 透传原版 Spine；`Spine.AnimationState.AddAnimation` `0x1683958` 的 delay<=0 分支按前项时长减 GetMix 计算开始时间。不能用强制完整 main 时长代替这个规则。 |

上述已有方法体在本地 `.analysis/ghidra-il2cpp/decompiled_pass1_annotated/`、`decompiled_pass3_annotated/`。本次另外以 `-readOnly -noanalysis` 补充反编译 Set/AddAnimationByPrefix 两项，以及 Spine.AddAnimation 两个重载和 GetMix 三项，全部成功；小型结果位于 `.analysis/native-chibi-wiring-audit/decompiled-flash/` 和 `decompiled-flash-add/`，没有保存 Ghidra 工程改动。

## FLASH LIGHT 的具体影响

当前 `flslgt_live_effect` 有 84 条人物动作：4 条负时间初始化 mode 3，后续 80 条 mode 2（四个人的 20 组动作）。上一批对后面 80 条都错误地直接选 loop。

- 2.8 秒的动作 55001：实际 `3dance` 长 10 秒，`4loop` 长约 2.666667 秒，脚本 speed=1600。跳过 main 会将整段大动作替换为短尾段重复，而不是单纯调整帧率。
- 10.1 秒的动作 55002：main 长约 7.4 秒，loop 同样约 2.666667 秒，speed=1400。第二组也受相同错误影响。
- 使用真实 setup、skin、motion 文件，将旧基线 `96294431`、回归提交 `5d73443c`、正常回调 oracle 放入同一 Spine 引擎比较。第一组开始后 0.5 秒，旧版与正常回调的本地骨骼姿势一致，回归版则明显不同；五种体型结果一致。这支持用户对“旧版在该段更接近”的反馈，但不是全曲原版录像逐帧验收。

## 本批修正

1. nativeCommand 的 mode 2 改为正常 main → loop，mode 3 / 显式 skip 才直接 loop；mode 1 正常路径不排 loop。无 dance 的正常路径补 before → after；立即路径仍允许直接 after。
2. 正常命令之间使用已证实的 0.15 秒 main 混合；native 后续队列使用 delay=0，保留其 GetMix 规则。动作实验室的演示路径保持原有独立行为。
3. seek 的重建窗口覆盖 0.15 秒，并纳入相互打断的连续混合链。补充回归暴露过“只看当前时间窗口仍漏掉上一层 mixingFrom”的情况，已修正为重建连接的切换链及其前项。
4. 维护属性读取真实当前 TrackEntry 的片段，并另列排队计划，避免将最初 mainName 当作永远不变的当前片段。
5. 首批验收文档已显式标记错误结论及本次纠正。删除原有“mode 2/3 都在零时刻直接 loop”的错误测试断言，新增正常/skip 独立路径与真实 FLASH LIGHT 骨骼回归。

## 验证

| 检查 | 结果及边界 |
| --- | --- |
| `verify-stage-intent.mjs` | 58 项受控播放/暂停、正常/skip、before/after、混合打断、首条 mode 2、后退 seek 与资源取消检查通过。 |
| `verify-chibi-native-motion-chain.mjs --compare-history` | 五种体型 × 84 条命令，共 420 项片段链核对；第一段 35 个真实骨骼姿势抽样与独立 native callback oracle 一致。三版本历史对照能复现回归。本地资源检查已注册为 corpus verifier。 |
| `verify-chibi-placement-shadows.mjs --published-assets` | 通过，保留首批与动作片段无关的排序/尺寸修正。 |
| `verify:architecture-cleanup` / `verify-verifier-coverage.mjs` | 通过，资源所有权和异步取消保护仍有效。 |
| `npm run build:check` | 最终代码编译通过；固定 `.analysis/build-check`、`copyPublicDir:false`，不是完整媒体包。 |

Browser 继续复用 5212，Playwright + Edge，桌面 1440×1000 与手机视口 390×844。使用相同入口搜索 FLASH LIGHT 并连续播放，而不是只看初始化或用跳转替代播放：

- 修正前约 3.3 秒：四名角色当前为 `55001_4loop`，next 为空。
- 修正后约 3.5–4 秒：四名角色当前为 `55001_3dance`，next 为 `55001_4loop`，mixDuration=0.15。
- 连续播放跨过 10.1 秒：约 11 秒为 `55002_3dance`，next 为 `55002_4loop`，脚本速度为 1.4。
- 暂停后跳到 14 秒：重建 `55002_3dance` 的中间姿势，timeScale=0，next loop 保留。手机视口正常显示；没有 pageerror/console error 或框架遮罩。

浏览器与本地姿势证据保存在本聊天 QA 目录的 `flash-before-receipt.json`、`flash-after-receipt.json`、`flash-after-next-command.json`、`flash-after-paused-seek.json` 及对应截图。构建日志为本地 `.analysis/native-chibi-wiring-audit/flash-build-check.log`。

## 仍不能声称完成的部分

- 原版会在正常路径调用 Unity Random 产生微小延迟，Web 当前仍是确定性时间轴，没有复原原版随机序列。
- 原版 baseTimeScale 读取 `RhythmGameManager.noteManager.curTempo`（NoteManager `+0x48`），再乘 CSV speed；当前 Web 仍只使用 CSV speed。此链路已定位，但每首 tempo 的真实来源与变化尚未全部接入。
- native 的 main 混合 0.15 秒已确认；queued entry 的 GetMix 数据来自原版 SkeletonDataAsset。Web 默认 0.12 秒尚不能宣称是原版资产的精确默认值。姿势 oracle 在同一受控 mix 数据下验证分支与队列，不把它升级为原版 mix 资产等价证据。
- Web seek 有意重建所选时刻的连续播放姿势；原版 Seek 走 SkipEffect 快速重建。两者语义明确区分，没有将 Web seek 宣称为原版 Seek 实现。
- 本轮没有取得并重新同步用户所对照的完整存档视频，也没有测出帧率退化比例。已证实的是主动作被跳过的语义回归及其修正；全曲动作、帧耗和逐帧原版一致性仍未完成。

本批不部署、不改资源包、不继续叠加新灯光实现。后续接线必须同时检查上游调用场景、延迟/协程回调和终端消费者，不能再从一个分支推断完整演出行为。
