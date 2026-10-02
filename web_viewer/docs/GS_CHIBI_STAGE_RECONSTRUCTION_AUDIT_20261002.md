# Chibi 舞台复刻：RAW 来源与实现缺口审计

日期：2026-10-02。输入 HEAD：`c975d36e57b2dee9ed10bdc4317f6f3ba2767502`。
研究分支：`codex/chibi-stage-reconstruction-20261002`。

## 结论与范围

用户确认多人站位、歌词、口型、歌曲接线已稳定。本轮保留这些链路，核查粒子特效和舞台装置的来源与缺口，不修改播放器、站位、资源发布索引或歌曲接线。

现有索引中的 135 个粒子对象、992 个 ParticleSystem 均能从对应 RAW prefab 精确读取。986 个已赋值材质的 shader 与 1,244 个纹理属性引用均已解析，包括跨 bundle 的独立 alpha 遮罩 shader。主要问题是导出与运行时尚未消费这些数据；不能据此宣称资源缺失，也不能据此宣称已经完成视觉复刻。

完整复刻仍需实现 Unity 曲线、粒子模拟、透明混合、遮罩、变换及指令语义，并对照原始演出验收。适合先实现 `ANYWHERE` 的两个 window 对象，验证较小的 UV 动画与 additive 材质链，随后逐类扩展。此结论是来源与实现可行性判断，不是完整舞台、像素一致性或真机性能验收。

此前 UI 工作已在 [PR #46](https://github.com/windmet/GS_Archive/pull/46) 收口，head 为输入 HEAD；本研究不扩入该 UI PR。UI 的当前验收边界见 [工程验收记录](GS_ARCHIVE_ENGINEERING_ACCEPTANCE_20261002.md)。

## 来源合同与精确身份

使用仓库 `archive_paths` 来源配置和 UnityPy 1.25.0，读取 `RAW/asset` 下现有索引指定的确切 bundle。shader bundle 的 Unity 版本为 2019.4.2f1。

- 主索引：`public/assets/live-chibi/object-layers/index.json`。
- 编排索引：`public/assets/live-chibi/choreography/index.json`。
- 本地 RAW 为配置项，不在脚本中硬编码机器盘符。
- 同 bundle 引用必须按 serialized file + PathID + 对象类型解析，不能把不同文件的数值 PathID 合并为全局索引。
- 外部引用仅按其 CAB 身份与 PathID 解析明确指定的依赖 bundle；未解析引用保留 fileID、PathID、外部路径和 GUID。
- 64 位 PathID 输出为字符串，避免 JavaScript Number 丢精度。变换保留完整 xyz、四元数、缩放与父链，不预先扁平化为 2D。
- RAW keeper 必须唯一精确匹配 `LiveObjectObjectLayer_<asset>`，粒子数必须与索引相符，否则失败。

研究工具不向 RAW 或 published assets 写入，不导出媒体副本、不覆盖现有资源。默认报告保留模块摘要、曲线模式及参数树 SHA；`--include-module-data` 才保留选定样本的完整模块曲线和切线。

## 粒子与材质全量结果

读取 48 个索引指定 bundle，另外显式读取 1 个 shader 依赖 bundle；不是对整个 RAW 库的无界扫描。

| 维度 | 当前证据 |
| --- | --- |
| 原索引引用 / 已定位 | 185 / 181 |
| Sprite 对象 / 实例 | 46 / 423 |
| 粒子对象 / 已解析 ParticleSystem | 135 / 992 |
| 混合 Sprite + Particle 对象 | 0 |
| Billboard / Stretch | 970 / 22 |
| 已赋值材质引用 / 无材质 renderer | 986 / 6 |
| `_MainTex` / `_AlphaTex` 引用 | 986 / 258，全部在对应 bundle 内解析 |
| 本地 shader / 外部依赖 shader | 728 / 258，全部已解析 |

六个未赋值材质 renderer 是当前 RAW 中的状态；保留未知，不擅自补默认 shader。原索引未定位的四项为 `fx_in_tibeti_overlight_1`、`fx_in_tibeti_overlight_2`、`fx_in_tibeti_water_1`、`fx_in_tibeti_water_2`。本轮没有对这四项做全库反向搜索，因此仅能标记“索引未定位”，不能标记“RAW 不存在”。

| 启用模块 | ParticleSystem 数 |
| --- | ---: |
| Initial | 992 |
| Emission | 983 |
| Color | 957 |
| UV | 907 |
| Shape | 576 |
| Size | 264 |
| ClampVelocity | 111 |
| Noise | 109 |
| Rotation | 34 |
| Velocity | 18 |

992 个系统均为 `autoRandomSeed=true`。Unity 官方说明此设置会在每次播放时生成新种子，见 [useAutoRandomSeed](https://docs.unity3d.com/cn/2021.3/ScriptReference/ParticleSystem-useAutoRandomSeed.html)。因此可为 Web 时间轴设计可重复的研究种子，但不能把任意固定种子宣称为原作的固定随机序列；对照录屏应分开验收视觉分布与逐像素位置。

### 外部 shader 并未缺失

外部引用均指向 `CAB-47338db636fbf628b5ec28a3f5a34103`。`shaders_and_materials.unity3d` 包含该精确 serialized file 身份，118,109 字节，SHA256 为 `c7f9c35ab744d08a932602c96efeb1261242c6b9a8d82a6589ec5db038f64623`。

| Shader | 材质引用数 |
| --- | ---: |
| Mobile/Particles/Additive | 662 |
| Mobile/Particles/Alpha Blended | 66 |
| Alpha Masked/Particles/Additive | 240 |
| Alpha Masked/Unlit Alpha Masked - World Coords | 18 |

诊断导出的 shader 子程序包含 `_AlphaTex`、`_ClampHoriz`、`_ClampVert`、`_ClampBorder`、`_UseAlphaChannel`。遮罩读取红色或 alpha 通道，并参与最终 alpha；不能把所有材质统一成一个单纹理 additive Sprite。世界坐标遮罩类应独立验收。UnityPy 的诊断导出不是可直接编译的原始 ShaderLab 文件。

## 舞台装置：另有编排指令未接入

从索引的 118 份编排源，读取 60 个歌曲 bundle 中精确命名的 RAW TextAsset；118 份全部找到。报告绑定 bundle SHA、serialized file、PathID、文本 SHA 与首条原始指令行。

| RAW 指令 | 行数 | 涉及编排 |
| --- | ---: | ---: |
| Suspensionlight | 42,263 | 103 / 118 |
| Penlight | 4,379 | 90 / 118 |

现有编排导出与播放器没有接入这两类指令。舞台灯具和观众灯光问题不能仅靠补一个粒子 PNG 修复。RAW 中有指令是已确认事实；列含义、触发与持续时间、灯具资源映射仍需验证，不能从名字推定最终绘制行为。

## 当前运行时与窄屏基线

`src/components/ChibiStageViewer.vue` 的 `syncObjectLayers` 目前消费 Sprite/mixed 分支，粒子对象只记录 unsupported。现有提取工具导出 SpriteRenderer 图层和粒子计数，没有完整粒子模块、材质及跨 bundle shader 数据。laserlight / spotlight 的部分效果为 Pixi Graphics 近似实现；不能将其等同于原 shader 复刻。

本地 Browser 使用既有 5198 生产代码映射服务，代码仍为输入 HEAD，资源为既有 public 与已验证 readmodels。实际打开 DRIVE A LIVE 多人舞台，五名角色加载完成；播放时间、歌词与当前演唱者状态推进，随后暂停并跳至 30 秒。此旅程证明现有接线仍可运行，没有做听觉音质、全曲口型或真机长稳验收。

| Browser 视口 | 实际观察 |
| --- | --- |
| 1280 × 800 | 五名角色与当前背景可见；粒子仍未恢复 |
| 390 × 844 | 画布约 375.17 × 390，角色明显放大并裁切；五名均已加载 |

源码中桌面 `.performance-shell` 使用 16:9，620px 以下改为 `min-height:390px; aspect-ratio:auto`。角色基准线使用高度比例，而环境使用另一套宽高适配。这与窄屏裁切现象一致，但属于布局/坐标推断，尚未通过变换修复验证。

下一步应在共同的逻辑舞台平面和 letterbox 容器上保持环境、对象与角色统一适配，保留原编排相机与站位；不针对手机单独改演员 Y 值或逐人偏移。此轮只记录现有窄屏债务，没有修改稳定链路。

## 首个实现试点与验收顺序

1. `fx_in_anwhre_window_1` / `_2`：共 9 个 Billboard 系统，只有 Initial、Emission、UV 模块启用，初速度为零；使用 4×4 UV 图集、单粒子 burst 与 additive 材质。先做完整参数读取和时间轴 UV 动画，不能用静态 PNG 代替。
2. 验证原始 keeper 根变换、混合模式、UV 曲线切线、透明度、起始时间与循环；包括首次播放、暂停、前后 seek、恢复播放、切歌与释放对象。
3. 对照原作参考画面，并在桌面与 390px/360px 视口检查同一逻辑舞台平面。Browser 响应式验收仍与真实设备/GPU性能验收分开。
4. 逐类扩展 Color、Shape、Size、Stretch、Noise、遮罩材质；缺少语义证据时保留 unsupported，不伪造“全部支持”。
5. 单独解析 Suspensionlight / Penlight 指令及其资源映射，之后再做原舞台装置组合验收。

## 可重复验证与证据

```powershell
python -X utf8 scripts/verify-live-chibi-stage-object-audit.py
python -X utf8 scripts/audit-live-chibi-stage-objects.py --all-indexed-particles --dependency shaders_and_materials.unity3d --output .analysis/engineering-validation-20261002/chibi-stage-objects-all.json
python -X utf8 scripts/audit-live-chibi-stage-objects.py --asset fx_in_anwhre_window_1 --asset fx_in_anwhre_window_2 --include-module-data --output .analysis/engineering-validation-20261002/chibi-window-parameters.json
python -X utf8 scripts/audit-live-chibi-stage-command-coverage.py --output .analysis/engineering-validation-20261002/chibi-unsupported-command-census.json
```

五项身份/参数回归通过：文件作用域隔离、对象类型、外部 CAB + PathID、64 位 ID、曲线切线变化绑定。完整 RAW 扫描结果为 992/992；986 个已赋值 shader、1,244 个纹理引用全部解析。未知 asset 与 public 输出路径负向检查均 exit 2，未创建输出。

报告固定复用本工程 E 盘 `.analysis/engineering-validation-20261002`，未创建全库媒体或时间戳构建副本。纯 Python 研究工具不影响前端依赖，按 [构建政策](BUILD_ACCEPTANCE_POLICY.md) 不重复运行 Vite。此前 UI Source Gate 为 92/92，PR 与 push CI 均在输入 HEAD 成功；这不代表本研究已渲染粒子。

| 本地证据 | SHA256 |
| --- | --- |
| chibi-stage-objects-all.json | `670314997ba6dc45b6add356c08d75936eacbcd2104cd388dfdef404c3ec6bc9` |
| chibi-window-parameters.json | `150c9f2ba248134774adfec8fdb61ab885f6bd759dcb1685f6dbb4ebcc16b47a` |
| chibi-unsupported-command-census.json | `6fae326368c8cded103a97ee6d04dafb3b07fda285935e1e867f3773c6d6e838` |

截图：同目录 `chibi-before-desktop.jpg`、`chibi-before-mobile.jpg`。报告与截图为本地证据，未提交媒体；提交内容为三份研究/验证脚本与本记录。
