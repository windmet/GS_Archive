# Sprite tween 原生代码回放（2026-10-21）

输入 HEAD `3c423c67e0ac33750b0585874bec5dcb104e8e0c`，沿用 `stage/20261020-native-followup`。承接 [透明度诊断](NATIVE_OBJECT_SPRITE_FADE_AUDIT_20261020.md)，本轮把静态反编译结论推进为可复跑的 ARM64 代码样本。渲染器尚未修改，Sprite 透明度待办仍开放。

## 执行范围

`scripts/replay-chibi-object-sprite-tweens.py` 用 Unicorn 2.1.4 把固定的解密 ELF 的 PT_LOAD 段装入 ARM64 地址空间。ELF SHA 必须与已有 RAW 来源收据一致：`9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e`。不使用另写的缓动公式生成预期结果。

样本实际执行以下 15 个原生函数，fixture 记录各函数代码范围、SHA 和入口执行次数：

- TweenManager：AddActiveTween、Update、ReorganizeActiveTweens、MarkForKilling、DespawnTweens、RemoveActiveTween。
- Tween.DoGoto、Color 泛型 DoStartup、DOStartupDurationBased、ApplyTween。
- ColorPlugin：ConvertToStartValue、SetChangeValue、EvaluateAndApply；EaseManager.Evaluate。
- ObjectLayer 的 EraseSpriteComplete 回调（`0x1c9e114`）。

受控边界是 IL2CPP metadata/class 初始化、数组类型检查、托管 List.Add/Clear、对象池 Despawn、颜色 getter/setter 委托、完成委托分发和 Unity 的 Component.gameObject / GameObject.SetActive。泛型方法上下文和 vtable 指向已定位的 Color 具体函数。颜色捕获、差值、缓动、完成判定、活动槽位删除及压缩均由 ELF 中的原生指令执行；没有在宿主里重写这些算法。

对象池复用和 Unity Player 不在本轮执行范围。show 的激活由宿主按已核实的 PlaySprite 源码契约提供；hide 完成后则实际执行原生回调，再进入受控 Unity 接口。适用轮廓固定为正时长、单循环、alpha-only、默认 OutQuad，safe mode 开启。样本使用明确给定的合成帧 delta 和派发次序，不能冒充原游戏/Conductor/设备实际帧历史。

## 7 组样本与结果

| 样本 | 原生结果 |
|---|---|
| 首次 alpha=1，show 到 1 | 各次更新保持 1；支持上一批首次淡入反例 |
| 首次 alpha≈0.5882353，show 到 1 | tween 完成后 alpha=1；不是永久乘初始 alpha |
| 收到 show 后、首次更新前外部把 alpha 从 0.6 改为 0.2 | Startup 捕获 0.2，证明 getter 在首次更新时读取 |
| 长 show → 短 hide → 新 show | 短 hide 的 Startup 读到同一帧旧 show 刚更新的 alpha；hide 完成后旧 show 仍写颜色，但对象保持 inactive；短新 show 完成后旧 show 继续写 |
| 同帧派发两个 tween | 较早 tween 先更新，较晚 tween 的首次 getter 读到它刚写出的结果 |
| 较早 hide 尚未完成就派发 show | 旧 hide 的完成回调仍会停用对象；较晚 show 的颜色写入不恢复 active。此为合成回归，上一批 RAW 普查没有这类配对 |
| A/B/C 中 B 完成，再追加 D | 原生活动数组删除及压缩后顺序为 A/C/D，保留旧实例顺序 |

具体重叠样本的原生浮点结果：

| 合成时间（秒） | alpha | active | 说明 |
|---:|---:|---|---|
| 0.25 | 0.3874999881 | true | 长 show 正在播放；此后派发短 hide |
| 0.35 | 0 | false | 旧 show 本帧先写 0.4555000067，短 hide 捕获它后完成并停用 |
| 0.50 | 0.5500000119 | false | 旧 show 仍写颜色，对象不自动重现 |
| 0.60 | 0.8588800430 | true | 新 show 首次捕获旧 show 本帧的 0.6080000401 |
| 0.75 | 1 | true | 短的新 show 完成 |
| 0.85 | 0.7355000377 | true | 较长旧 show 仍存活，再次写入；不能只保存最后一条指令 |

所有颜色数学结果和轨迹保存在 `scripts/fixtures/chibi-object-sprite-tween-native.json`，包括派发动作、逐步状态、getter/setter/激活日志和活动数组顺序。这些数据由本轮原生执行导出，不是 Web 实现的自证数据。

## 验证与下一步

生成后使用同一 ELF 重新回放，7/7 样本逐值一致。执行计数包括 21 次原生 Update、14 次 Startup、31 次 ApplyTween、5 次活动数组压缩、7 次原生槽位删除、3 次原生退场完成回调；15 个声称执行的函数均有非零入口计数。原有 verifier 覆盖登记核对仍通过（本轮独立 replay 工具不进入无原生依赖的源码批次）。

```powershell
python scripts/replay-chibi-object-sprite-tweens.py --native-elf <本机解密后的libil2cpp.so> --python-deps .analysis/native-python-runtime
```

Unicorn 2.1.4 安装在 E 盘本 checkout 的 `.analysis/native-python-runtime`，没有修改项目依赖或全局 Python。`--python-deps` 可省略，前提是所用 Python 已有该版本；`--write` 用于明确更新 fixture。工具不下载二进制、不导出图片、不创建完整资产包。

下一批消费者必须同时维护每个 renderer 的颜色、active、全部尚存 tween，以及首次更新时的 getter 捕获；用这 7 组独立原生样本检验，而不是只换缓动曲线。还需明确 Web 的播放/seek 帧序列及其与原始 Conductor 的边界，复跑代表曲重叠轨道，并完成 Browser 的出现、退场、倒回、切歌与刷新验收。混合资源、CanvasGroup 和 APK built-in 仍需各自证据，不能从本轮轮廓外推。

本轮仅新增独立原生 replay 工具、fixture 和文档，按构建政策不重跑 Vite。没有生产包、Browser、真机或原片验收结论；没有修改服务、候选、release 或部署。
