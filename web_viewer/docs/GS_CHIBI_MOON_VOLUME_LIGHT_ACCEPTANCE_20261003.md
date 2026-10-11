# Moon 原生贴图、体积粒子及后方灯束

输入 HEAD：`d060e47e`（共享 checkout 在执行中有其他窗口提交）；分支 `codex/chibi-stage-reconstruction-20261002`。

## 本批结果

- 月亮原图属于 `ASTC_HDR_4x4`（TextureFormat 66）。UnityPy 的 LDR 解码路径把 HDR 端点解成粉色错误块。采用官方 Arm astcenc 5.7.0 `-dh` 导出浮点 EXR，再交给 UnityPy 保留原 Sprite 的 UV、裁切、紧网格透明度及方向；没有重新绘制月亮。
- 新增 `continuous-masked-volume-floor-v1`：原生球体/盒体分布、出生速度、随机出生 atlas 帧、独立颜色及 alpha 生命周期。旧盒体接口和 Take 专用接口的限制保持不变。
- Moon 地面 panel_1 和圆弧内 panel_2/3 共 8 个发射器接入动态。密集发射器的原始容量 700 保留，没有被旧接口的 250 上限截断。
- 旧版悬灯此前完全没有消费者。本批从原生 `LiveObjectSuspensionlight`、`_2`、`_3`、`_5` 的序列化 PPtr 绑定到 `sidelight` Sprite、顶端 pivot、Mobile/Particles/Additive 材质、60° 基座及两条 2 秒的 streamed Animator 曲线（angle30、angle60）。
- Moon 旧悬灯全部 1,840 条原始指令保留，含基础指令 1,624 条及编号变体 216 条。按类型和实例 ID 重建生命周期，删除远端 value101/102 的 erase，支持回退及切歌清理。楼前光束保留原生 1024px 素材尺寸；125 等 value6 数字按动画速率候选投影，不能当作 125px 长度。后方投影的 Y 原点为 360；此前使用 720 会把后方灯束错误移到台前。
- 按用户补充图修正方向：左右镜像仅影响 Animator 的摆动，不再次反射 CSV 中已有的互补基座角（70/110、80/100）。顶灯以 240、地面发射灯以 270 为参考投影基准；原生 0..30/60 曲线居中为左右摆动，_3/_5 的 RAW offset 同时错开运动及渐亮渐暗。CSV 坐标使用半分辨率 fit，Sprite 像素保持原尺寸 fit。上述基准是 Moon 图像校准结果，不是恢复了导演方法体。

## 新体积接口影响范围

| 曲目 | 新增对象 | 原生发射器 |
| --- | --- | --- |
| FLASH LIGHT | panel_1 | 3 |
| Inner Dignity | panel_1、panel_2 | 5 |
| Legacy of Spirit | panel | 3 |
| MOON NIGHTのせいにして | panel_1、panel_2、panel_3 | 8 |
| precious love | panel_1 | 3 |
| Platinum MASK | panel_2 | 3 |
| String of Fate | panel_1、panel_2 | 9 |
| We're the one | panel_3 | 3 |

合计 **8 首 / 12 个对象 / 37 个发射器**。49 个地面候选中，目录从 8 增至 20 个对象，其中 19 个完整受限输入 profile，另一个是已有火焰部分 profile；29 个候选仍未接入。噪声、重力、复杂 burst、动画 UV 等不能因提高容量就自动放行。

扫描 46 个 Sprite 对象、423 个 Sprite 实例的格式，只有 Moon 此图是 ASTC HDR：该贴图修复实际影响 **1 个舞台**。旧悬灯目录涵盖 105 个编排 / 88,647 条指令；**目前仅 Moon 启用预览**，其余 104 个编排保留库存，尚未推广导演坐标参数。

## 验证与证据

日常构建使用 `npm run build:check`，输出固定 `.analysis/build-check`，`copyPublicDir:false`。没有制作完整媒体发布包。既有 5198 / PID 62924 的 `serve-player-qa-preview.mjs` 映射生产代码 bundle、已有 public 和 song-discovery readmodels；没有重启或清理其他服务。

回归：

```powershell
python scripts/verify-chibi-floor.py
node scripts/verify-chibi-floor.mjs --published-assets
python scripts/verify-chibi-old-suspension.py
node scripts/verify-chibi-old-suspension.mjs --published-assets
python scripts/verify-chibi-suspensionlight-parser.py
node scripts/verify-chibi-suspensionlights.mjs --published-assets
python scripts/verify-chibi-stagelight-prefabs.py
node scripts/verify-chibi-stagelights.mjs --published-assets
```

实际 Browser：Moon 6.0 / 6.3 秒地面、圆弧粒子变化，20 秒人物聚光、59.8 秒暗场月亮纹理。方向修正后重新检查 6 秒楼前后景灯、20 / 20.5 秒独立顶灯、105.1 秒互补灯位；切换“光束灯效”移除/恢复旧悬灯，切换“舞台物件”移除/恢复粒子；回退 105 秒 → 6 秒，粒子签名与原 6 秒一致。七首其他新增曲目在 5 秒（Inner Dignity 14 秒）逐曲截图，确认遮罩内渲染、资源加载及 Moon 灯束切歌清空。390×844 窄画布检查 Moon；临时 viewport 在验证结束时复原。这些截图验证渲染接线和方向修正，不等于完整录屏逐帧验收。

证据在 `.analysis/engineering-validation-20261002/`：

- `moon-native-floor-6s.png`、`moon-hdr-spotlight-20s.png`、`moon-hdr-spotlight-59-8s.png`
- `moon-background-sidelight-105s-wide.png`、`moon-volume-mobile-390.png`
- `moon-background-building-6s.png`、`moon-ceiling-sweep-20s.png`、`moon-ceiling-sweep-20-5s.png`
- `volume-floor-browser-contact.png`、`volume-floor-browser-checks.json`
- `moon-floor-catalog-expansion.json`、`volume-panels-native.json`、`object-sprite-hdr-inventory.json`
- `old-suspension-prefabs.json`、`sidelight-animator.json`、`old-suspension-metadata.json`

Browser error 记录为空，存在既有 Spine tint getter/setter 弃用 warn。原始媒体及 QA 图不提交；本批仅提交实现、再生成工具、合同 fixture 与文档。

## 再生成与边界

HDR 解码需要官方 astcenc 可执行文件以及 Python OpenEXR / numpy。默认不带 `--astcenc` 时，遇到 HDR Sprite 会明确拒绝错误解码，其他格式继续原路径。

```powershell
python scripts/prepare-live-chibi-object-layers.py --asset fx_in_montns_overlight_6 --force --astcenc .analysis/tools/astcenc-5.7.0/bin/astcenc-sse2.exe
python scripts/prepare-live-chibi-floor-catalog.py --report .analysis/engineering-validation-20261002/moon-floor-catalog-expansion.json
python scripts/prepare-live-chibi-stage-effects.py
```

投影仍有明确边界：体积粒子以 XY 投影、确定性浏览器随机种子运行，并非 Unity 3D、原生自动 RNG 或 NoiseModule 等价；HDR 导出是裁切至 0..1 的浏览器 RGBA，不是原生 HDR tone mapper。旧悬灯的 Sprite、基座及曲线已取得原始资源证据，但 CSV value6 的速率语义、clip 选择、360 Y 原点、alpha 强度、_3/_5 的渐变周期按 Moon 参考图校准，**没有宣称恢复 IL2CPP 方法体**；_2 多色列表抑制，复杂颜色/HSV 控制未恢复，_4 尚未支持。不能把这些限制算作全曲原片验收。

尝试读取方法体时，现有 iOS UnityFramework 的 LC_ENCRYPTION_INFO_64 显示 `cryptid=1`，Android metadata 使用非标准加扰头（`414549c422bf00c0`），Android库也未找到明文 Assembly-CSharp module 标识。本批可读取资源树和 iOS 类型字段、方法签名；未取得可验证的方法体解密结果，不把推断冒充反编译证据。

格式参考：[Arm astc-encoder 官方项目](https://github.com/ARM-software/astc-encoder)、[Unity Shape Module](https://docs.unity3d.com/Manual/PartSysShapeModule.html)。
