# 新悬灯显示、旋转、缩放与渐隐接线

后续共用旧悬灯实现见 [Drive 执行通道批次](NATIVE_DRIVE_LIGHT_CHANNELS_BATCH_20261014.md)。

2026-10-14；输入 HEAD `76eccb83`；分支 `codex/stage-chibi-wiring-20261013`。本批补齐已有 RAW sidecar 的消费者，不重写 public 语料。用户进一步指定重点反查 DRIVE A LIVE，旧悬灯复查见 [原版链路记录](NATIVE_DRIVE_LIGHT_CHAIN_RECHECK_20261014.md)；旧悬灯消费者尚未替换。

## 改动及来源

- NormalShow `0x221f118` → 回调 `0x1bbfa6c`：value2 初始延迟，value3/4/5 为上升/保持/下降，**value6 为熄灭等待**，整段无限重启。撤掉把 value6 当重复次数的逻辑。
- RotateAnim `0x221fc98`：mode1 单次、mode2 去程后等待并重启、mode3 去程/保持/回程/等待；value8 选择 Linear / InOutSine。独立更新旋转，不再隐藏整束灯。
- ScaleAnim `0x22200f8`：缩放单次与往返循环；Fade / FadeInner / FadeInnerLoop `0x2220414/0x2220530/0x2220764`：独立更新 opacity；单次完成回调停止 show，并保留完成时的 show multiplier。
- EraseEffect `0x2220960` 通过 FadeInner 到零再删除；重建同 ID 不继承旧退出回调。value101 是删除标记，value102 是时长。修正未来导出器，现有 sidecar 直接消费 extraValues。
- 普通 Float/DOScale tween 使用已检查的 DOTween 默认 OutQuad（cctor `0x13eff0c`，defaultEaseType=6），正常显示队列保持线性序列时间。enum4 是 InOutSine。
- 覆盖统计读取实际加载轨道中的未实现命令，避免沿用旧索引对新消费者的过时合计；加载前显示“待核对”。

来源为本地 `decompiled_pass3_annotated/Growing.Live.LiveObjectNewSuspensionLight.c` 及 DisplayClass10/25 回调。按命令时刻重放独立通道，支持后退 seek，不按帧累积 Tween。

## 验证

- `verify-chibi-suspensionlights.mjs --published-assets`：并发、打断时捕获中间值、熄灭等待、延迟显示、Fade 完成停止 show、删除/取消删除/ID 复用与后退采样通过。19 份、60,358 行真实 sidecar 做五个时点的有限值检查，另核对 GO FOR IT!! / Platinum MASK 的具体数值。
- parser、旧悬灯 Python 资源绑定、architecture/resource ownership、verifier coverage 检查通过。旧灯 Python 检查不作为旧截图规则的原生行为背书。
- `npm run build:check` 通过：2900 modules / 15.68s，固定 `.analysis/build-check`，copyPublicDir=false，未复制 public。
- 复用本工程 5212 Vite PID39228。Browser plugin not available，使用 Playwright + Edge；完整加载模式，桌面 1440×1000 / 手机视口 390×844。首次 QA 错选轻量模式，光束关闭导致等待失败；纠正加载方式后完成目标旅程。
- GO FOR IT!! 6s：灯410 alpha=1、旋转=-0.7501657829rad；连续播放到约7.16s角度推进，后退6s恢复同一角度。Platinum MASK 112.4→112.9s：灯70001保持可见并旋转/收缩，scale 比值与 RAW tween 计算一致；114.6s按显式退场消失。手机视口同路径通过；无 pageerror/console error、无 Vite 遮罩。

QA 目录 `C:/Users/windm/.codex/visualizations/2026/10/13/01a13599-5517-7113-9331-e6ac3c22279e` 保存 `lights-native-controls-receipt.json`、脚本与桌面/手机截图。Platinum MASK 截图可见灯束；GO FOR IT!! 6s 灯对象参与渲染，但当前参考投影下主要在画面外，不能据 runtime.visible 推断屏幕内已恢复原版灯形。

## 保留边界

颜色/HSV 循环 2,350 行与节拍显示 331 行仍未接入，遇到这些命令仍抑制该对象。本批接入 rotate/scale/fade 共 6,340 行，但不代表 6,340 个独立灯具或全曲视觉验收。专用贴图（如 inndgn/stofft）仍受现有资源模型限制。

坐标仍用旧参考投影，新旧悬灯都须继续追实际 Camera/viewport 链。未部署、未打包完整媒体库，没有新增动作/人物速度修改。
