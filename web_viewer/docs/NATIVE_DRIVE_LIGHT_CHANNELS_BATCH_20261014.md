# Drive 共用旧悬灯：执行通道与层级修正

后续：[原版灯光投影与暂停补绘](NATIVE_LIGHT_PROJECTION_BATCH_20261014.md) 已替换新旧悬灯的参考平面；其他层的镜头统一仍未完成。

2026-10-14；分支 `codex/stage-chibi-wiring-20261013`，输入 HEAD `fc0a99bb`。承接 [原版链路复查](NATIVE_DRIVE_LIGHT_CHAIN_RECHECK_20261014.md)，本批开始替换消费者中的截图猜测规则；没有将局部执行语义的恢复称为完整舞台复刻。

## 实现

1. 所有已绑定旧悬灯使用 controller 的默认 `angle60`，保留正在激活实例的 Animator 相位。重发周期改变速度，不重置动画；0.2 秒退场结束后重新激活才重新开始默认状态。极大周期继续极慢推进，不再用阈值冻结。
2. 按真实层级组合根节点 Z 旋转、LeftRightBase X 轴 0/180°、固定 +60° 基座、独立 Animator 旋转。二维结果使用 Y 轴反射，撤掉半幅居中、按 Y 值切换角度与按 hue 字段阻止旋转。value6 始终作为统一缩放，不再忽略 Moon 的该字段。
3. 基础 Show/Fade 使用原版 0.2 秒；旧悬灯 erase 不消费通用 value102 时长。退场期间 Animator 继续推进，颜色/show tween 停止；新的命令可取消尚未完成的退出。
4. `_5` 线性色相通道与 Animator 分开推进：value12 周期、value13 初始延迟、value14 方向，保留原 S/V；不再用 alpha 余弦代替换色。
5. `_2` 按 Show 时的 BPM 计算拍长，支持三色轮换、明暗分支及额外拍数等待。补查 SwitchColor ARM64 确认 `fmov s3,wzr`：换色时 alpha 被置零，不能假定保持旧透明度。等待分支也已据此修正。
6. `_3` 使用线性上升/下降，初始 delay 和循环后的等待分离；不再用余弦替代原版序列。
7. Vue 消费者在同一取消信号内加载轨道与校验后的初级谱面。当前仅将**所有 conductor tempo 相同**的谱面作为稳定 BPM 来源；Drive=140、Growing=136。取不到 BPM 时 `_2` 明确返回 `tempo_unavailable`，其余通道仍可用。变速谱面时钟接线继续保留，不捏造默认 BPM。

资源导出器新增 defaultState=0 / 默认 clip=angle60 / clip target path=0 的约束；测试注入默认状态或目标节点错误必须拒绝。没有重新导出 public 素材。

## 新增来源验证

- 使用 Ghidra `-readOnly -noanalysis` 补查 NoteManager.SetNoteObj `0x20ba968`、ConductorStep `0x20bae50`、CalcAbsoluteTime `0x20bb100`、GetFirstTempo `0x20ba9d4`，4 项全部成功。初始化将首个 conductor tempo 写入 curTempo，后续按 conductor 绝对时间更新。
- ELF `0x32d48d0/0x32d48d8` double 分别为 60/480，核实原生 tick 时间单位，仍未把未经验证的谱面 offset 当作原版时钟。
- 重新读取 XAPK 的 DOTweenSettings：resources.assets pathId `106549`，SHA-256 `8d3f9175321a1d928661ae86b00359c65a13883539adffb10bcf8807f0ba15d4`。其序列化 defaultEaseType=6，与 DOTween cctor 的 OutQuad 一致，避免仅检查库初始值却遗漏设置资源。
- Camera 原版 orthoSize=5/zoom；pixelToStagePos=.01，宽屏 stageScale=1.3888888359。实际 Camera / render-target / 最终视口仍需继续串联，不能将这些局部常量直接替换当前全部投影。

小型新增方法体和记录位于 `.analysis/native-chibi-wiring-audit/decompiled-drive-tempo/`、`drive-dotween-settings.json`；构建日志 `drive-channels-build-check.log`。

## 回归

- `verify-chibi-old-suspension.mjs --published-assets`：改为源代码行为回归，删除旧测试中固定 0.55、两秒 erase、固定编号灯不转等错误断言。覆盖中途改速连续相位、取消退出/重新激活、色相与 delay、BPM 三色轮换、未知 BPM、_3 线性等待、确定性 seek。
- 独立矩阵 oracle 在 2 种方向 × 4 个根角度 × 4 个时间 × 4 个角点检查三维层级投影的二维分解，避免只比中心射线却漏掉纹理镜像。
- 20 份 Drive 编排均核对 19 秒 `_5:1` 的 `#f133b4`、phase=.6，20 秒改速连续性，以及 28.385 秒基础灯已退出。105 份 / 88,647 行资源在四个时点检查有限状态；这不是 105 首视觉验收。
- Python 资源绑定、architecture/resource ownership、stage intent 58 项、verifier coverage 通过。最终 `build:check`：2900 modules / 12.16s，固定 `.analysis/build-check`、copyPublicDir=false，未复制 public。

## Browser

复用 5212 本工程 Vite PID39228；Browser plugin not available，使用 Playwright + Edge；完整加载模式，桌面 1440×1000、手机视口 390×844。

- Drive 10.8s：BPM=140，`_2:1` alpha=0.5877777778，与原版 OutQuad 单拍渐隐相符。
- 19s：`_5:1` tint=`#f133b4`、alpha=1、rotation=-0.3686135380rad，持续播放颜色变化，暂停后退19s恢复同一状态。
- 时间轴按50ms对齐，输入28.285s实际得到28.3s；检查实际时钟对应 alpha=0.180625，28.4s基本灯1已不可见。没有拿输入值当作实际渲染时间。
- 手机视口同路径；Growing / Moon 6s 均有真实光束消费者和正常页面截图。另将 Drive tempo 请求挂起，切到 Growing 后才放行；当前歌曲与 Growing BPM 保持正确，过时结果未污染新曲。
- 无 pageerror/console error、无 Vite 遮罩。原有 Spine/Pixi tint deprecation 警告不等于本批运行错误。

脚本、截图、`drive-native-light-channels-receipt.json` 在本聊天 QA 目录。截图已查看；Moon 局部亮区明显，不能据“正常绘制”推断亮度或灯形已与原片一致。Drive 的 `_5` 消费者 tint 得到确认，但当前参考投影可能将部分发光点/灯束放在画面外，不将 runtime.visible 升级为屏幕颜色匹配证明。

## 尚未完成

屏幕坐标仍保留登记的 stage-rig / legacy 平面，Camera 父容器当时仍用参考镜头插值（更正：基础缩放已是 1，非 .82）；本批没有声称恢复最终投影。负时间初始化、预载状态开始时刻和源游戏暂停的完整 Animator 时钟仍待验证。`_4` 的 prefab 模型未补齐；变速谱面与其余灯具家族也未完成。预览范围仍为原有42/105，不自动放开剩余编排。

本批未部署、未发布媒体包，人物动作速度不变。下一步重点是将原版 Camera、Base、viewport/渲染目标与共用灯具矩阵串通，再用原片核对最终位置、尺寸和亮度。
