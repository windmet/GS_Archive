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

## 后续实现：对象控制列修复

输入 HEAD `af454929`。窗景试点前发现 RAW CSV 有两种头部布局：旧格式 `value101/value102` 位于列 17/18，扩展格式位于列 19/20。ANYWHERE 使用扩展格式。原解析器固定读列 17/18，把列 19 当诊断/注释，导致本应退场的窗景与 Sprite 对象持续显示。

按明确的 `value101/value102` 字段名读取控制标记与渐隐时长；不把注释中的 `1` 当控制。主生成器共享该解析器，独立刷新工具只读取索引精确指向的 RAW TextAsset，拒绝改变控制字段之外的任何对象事件数据。118 份来源全部定位，91 条事件的 `hide/duration` 发生修正。

实际安装前逐项 deep-equal 验证所有非 `objectLayerEvents` 字段/数组及顶层统计不变；对象事件除 `hide/duration` 外也完全不变。原文件保留为本地证据 `chibi-controls-before.json`。新编排 SHA256：`e809aa8a5a66be9aa7c0cc36eef55722064f365a4deeaf5ec2dd41f9563e51f4`。receipt：`chibi-controls-receipt.json`，含每条变化与原 TextAsset/CAB/PathID/文本 SHA。

复现命令：

```powershell
python -X utf8 scripts/verify-live-chibi-object-controls.py
python -X utf8 scripts/prepare-live-chibi-object-controls.py --output .analysis/engineering-validation-20261002/chibi-controls-index.json --receipt .analysis/engineering-validation-20261002/chibi-controls-receipt.json
```

三项回归通过：旧/扩展头部共享控制含义、注释 `1` 不触发隐藏、缺失/重复控制字段失败。生成主编排时自动使用此修复；独立刷新工具输出需按 receipt 核对输入 SHA 再安装，不重导服装、动作、口型或音频。Source Gate 与 Browser 验收另行记录，不能仅凭数据校验声称视觉效果正确。

本地 Browser 验收：5198 既有生产代码映射服务，1280×800，ANYWHERE 暂停拖动时间轴。33.5s 的五组 spotlight Sprite 可激活；34.5s 窗景控制已退场、五组 Sprite 仍在；36.9s 五组 Sprite 已退场、窗景再次激活；9.5s 全部对象退场；回拖 3s 窗景恢复激活。五人仍就绪，口型资源保持 ready。窗景此轮仍为 unsupported，控制状态验证不等于粒子渲染验收。截图为 `chibi-controls-33500.png` 与 `chibi-controls-3000.png`。

对应回归：三项 Python 控制测试、118 份 VFX coverage、118 份 singer-slot / 2,868 条演唱指令检查均通过，`git diff --check` 通过。此批只有 Python 工具与文档，无前端依赖变化，未重复 Vite 编译。既有 UI Source Gate 的 92/92 不冒用为本批全门禁。

## 后续实现：窗景粒子试点与独立画布

输入 HEAD `77fc0bbb`，本地验收跨至 2026-10-03。仅接入 ANYWHERE 两组窗景的 9 个 RAW 系统。读取 keeper 根变换、局部位置、大小、寿命、系统循环周期、UV 起始帧和带切线的曲线；绑定 bundle SHA、CAB、64 位 PathID、粒子参数树 SHA、shader 参数树 SHA 与纹理文件 SHA。只允许已核实的单粒子 burst、4×4 图集、局部平面 Billboard、Mobile/Particles/Additive；其他模块、随机参数、未知材质与变换直接拒绝。

播放器按编排时间采样，不再用静态图代替这两组粒子，也没有另建粒子时钟。寿命 0.7 秒而系统周期 0.98 秒的系统保留每轮间隙。对象退场仍消费上一批修复的控制字段。加载失败清理成功加载的兄弟纹理，切歌和迟到结果释放保持幂等；可选索引缺失/无效时沿用原对象索引。RAW inventory 的 `kind` 与粒子总量不改写，覆盖状态仍为 partial。

复现：

```powershell
python -X utf8 scripts/prepare-live-chibi-particle-layers.py --output-root public/assets/live-chibi/particle-layers
npm run verify:chibi-particles
node scripts/verify-chibi-particle-timeline.mjs --published-assets
```

仅生成三张 PNG 与一份参数索引，共 123,038 字节。索引 SHA256：`519288343f6357c8bc75a5972bf02dccbc4673673120abb841b947d25dc6b724`。媒体与运行索引为本地资源，未提交；提交小型参数 fixture、提取器、运行时与回归。此试点使用现有 2D 对象平面，尚未验收 Unity 3D 深度投影、相机 Billboard 行为和全部粒子语义。

画布改为独立 16:9 窗口，歌曲状态、站位标记、播放条在窗口外；桌面操作台在右侧，窄屏在下方。大屏画布高度上限 620px，手机竖屏按同一比例缩放；手机横屏限制画布高度并收紧相邻状态栏，使完整舞台与播放条同时可见。保留当前角色 Y、动作、原编排相机和角色尺寸函数，未针对某首歌曲或设备逐人挪位。

本地 Browser 为既有 5198 服务、固定 `.analysis/build-check` 生产代码与原 public/readmodels 映射；不是独立媒体发布包。实际量测无横向页面溢出，画布与操作台无交叠：

| 视口 | 画布实测，约 | 操作台位置 |
| --- | --- | --- |
| 1280×800 | 869×489 | 右侧，与画布独立 |
| 1920×1080 | 1102×620 | 右侧，画布高度受限 |
| 390×844 | 357×201 | 播放条下方 |
| 360×800 | 327×184 | 播放条下方 |
| 844×390 | 321×180 | 首屏播放条结束于 y=354，下方是操作台 |

ANYWHERE 暂停前后拖动 8s、33.5s、34.5s、36.9s、9.5s：窗景与五组 Sprite 服从各自控制，9.5s 对象全部退场，回到 8s 恢复；8.5s UV 帧与 8s 不同，恢复播放至约 42s 后再次暂停仍正常。切到 Study / Take a StuMp! 后窗景帧诊断清空，没有把 ANYWHERE 窗景套给其他曲目。五人/三人加载与口型资源仍就绪。控制台记录 Pixi/Spine 的已有弃用警告，未观察到本轮资源加载 error；不据此声称真实设备长稳通过。

当前 93 项 Source Gate 命令全部 exit 0，包括新增粒子门禁、engineering、VFX inventory、歌唱站位、翻译/发布合同、build audit。`build:check` 通过，`copyPublicDir:false`；额外 published-assets 检查与 Python 编译通过。门禁明细在 `chibi-source-gate.json`，日志固定复用本工程 E 盘证据目录；源码门禁通过不等于下述原作视觉差异已经解决。

## 原作录屏参考：漏接指令与尚未验收的差异

用户提供 ANYWHERE 四张、Study Equal Magic! 两张、Take a StuMp! 三张参考图，均约 1920×864（20:9）。右下角为录屏钟表，不作为歌曲时间。当前窗口为 16:9；对照时先匹配歌词/动作，再检查相机与投影，不能把不同取景和不同服装直接判为资源缺失。没有完整录像文件，Study 的两张动作尚未确定精确编排时刻。

| 参考锚点 | 精确编排锚点 | 当前结论 |
| --- | --- | --- |
| ANYWHERE「宿る My Soul…」 | 9.45s 起 | 原编排有前两位白色 Spotlight；光束仍含现有 Graphics 近似，整体背景/舞台染色和观众蓝灯缺项 |
| ANYWHERE「今、超えて頂上…」 | 36.3s 起 | 窗景已进入试点；星点、灯具与舞台面颜色尚未完整还原；人物/舞台投影关系需独立对照 |
| Study Equal Magic! 三人高低台 | `steqmg_live_effect`，2/3/4 号位 | Browser 已选 S.E.M 三人建立 15s 基线，高低台可见；源 Sprite overlight 可激活，粉色舞台组合未完成原作验收 |
| Take a StuMp!「まだまだ通過点さ」 | 01 / 02 均 4.4s 起 | 仅此歌词不能区分版本 |
| Take a StuMp!「C.FIRST!…」「High×Joker!…」 | **01** 版 21.3s / 25.2s 起 | Browser 22s / 26s 词句与演唱位可定位；组合 Logo、角色明暗、场地灯海存在漏接，不是背屏视频全部缺失 |

重新读取这三份索引精确指定的 RAW TextAsset，并对照生成器分支，发现以下未被当前导出器消费的真实指令。此前 census 的 42,263 / 4,379 只统计精确名称 `Suspensionlight` / `Penlight`，**不含这些新格式族，不能代表全部漏接量**：

| 编排 | 未消费指令与实际行数 | 需要补的链路 |
| --- | --- | --- |
| ANYWHERE | `Whole_screen_color_2` 60、`Stagelight` 128、`Penlight_unit` 43；另有 `Suspensionlight_2/3/4/5` | 多 ID / 深度染色、地面灯、观众灯和吊灯新格式 |
| Study Equal Magic! | `Suspensionlight_2/3/4/5` | 粉色聚光周围的完整舞台灯具；已有 Sprite 不代表灯具全接完 |
| Take a StuMp! 01 | `ImageObject_create` 16、`ImageObject_show` 8、`Image_color` 115、`Livechara_body_color` 69、`Stagelight` 1,941、`Penlight_unit_color` 495；另有 `Searchlight_*` 与 `NewSuspensionlight_*` | 组合 Logo 对象、按角色染色、舞台图层染色、搜索灯/吊灯和按区块着色的观众灯 |

Take a StuMp! 的 C.FIRST Logo 来源已定位为 21.3s `ImageObject_create` 的 `stage_tkstp1_fx_in_imageobject_16b`，25.2s 控制其退场，同时创建 `stage_tkstp1_fx_in_imageobject_8b`；对应 `ImageObject_show` 也在 21.3s / 25.2s。需要解析资源身份、显示生命周期与坐标，不能把 Logo 烘焙进背屏视频或借用通用图替代。

证据 `chibi-reference-command-samples.json` 保留三份 TextAsset 的 CAB、PathID、文本 SHA、头部、命令计数与 Backmonitor 原行。首屏暂停时背屏曾出现白/黑占位，而实际播放后的画面可以显示；还需检查首帧、seek 完成和 ready 信号，不能先断言视频资源不存在。当前人物/镜头取景也未与完整录屏逐段同步，因此保持待验收，不擅自改已稳定的站位或 Y 基线。

后续顺序：ANYWHERE 多层染色 → 地面/观众灯及吊灯 → 相机和深度投影对照 → Take a StuMp! 的 ImageObject/角色染色 → Study 与 Take 跨曲目验收。三首均需补首次加载、暂停 seek、连续播放、切歌与多视口验收；上述两首本轮只建立对照基线，没有宣称已完整复刻。

本地截图：`chibi-pilot-desktop.png`、`chibi-pilot-mobile.png`、`chibi-pilot-landscape.png`、`chibi-study-baseline.png`、`chibi-take-stump-baseline.png`，位于 `.analysis/engineering-validation-20261002`，不提交图片。

## 2026-10-03：字幕随画布缩放

输入 HEAD `68b2cebe`。字幕字号改用 `.performance-screen` 的 container query 宽度，`clamp(8px, 2cqw, 24px)`；底部留白为画布高度的 3%，文字区为画布宽度的 94%。描边和阴影也随字体缩放。移除手机固定 14px 覆盖，避免短横屏的小画布沿用整屏字号。保留完整歌词，允许必要换行，不改歌词时间轴、原文或角色布局。

实际 Browser 使用既有 5198 服务与 `.analysis/build-check` 代码、原资源映射，验证歌曲下拉切换与暂停拖动：ANYWHERE 10s、Study Equal Magic! 85s、Take a StuMp! 01 8s 的长歌词均完整显示为一行。桌面 1280×900 的画布约 885×498，字体约 17.7px；390×844 画布约 357×201；360×800 画布约 327×184；844×390 横屏画布约 321×180。三个小画布字体为 8px，字幕顶部约位于画布高度的 91.7%～92.2%，均在画布边界内，未遮挡当前帧人物。截图 `chibi-lyrics-desktop/mobile/landscape.png`、`chibi-lyrics-study-mobile.png`、`chibi-lyrics-take-mobile.png` 位于原证据目录。

`npm run build:check`（12.17s，未复制 public）、`verify:chibi-particles`、`verify:live-chibi-singer-slots`、`verify:song-lyrics` 通过；Browser 未观察到 error，保留既有 Pixi/Spine 弃用警告。此为桌面浏览器模拟视口验收，未代替真实手机可读性、无障碍文字放大或全部 118 份歌词逐句验收；舞台复刻差异仍按上一节保持待修复。

## 2026-10-03：多层遮色接线与取消额外放大

输入 HEAD `1dcb6721`。解析 `Whole_screen_color_2` 的独立 ID、RGB、透明度、渐变时长与深度，控制字段按 CSV 头部 `value101/value102` 取值。兼容旧包没有新数组的情况。各 ID 独立重建时间轴，覆盖中断渐变、退场、倒退 seek 与切歌清理；渲染使用既有相机空间中的独立 Graphics 平面，不合并为一个全屏颜色，也不另设时钟。现有旧格式染色和人物光照逻辑保留。

补录只读取现有 118 份索引精确指定的 RAW TextAsset，不扫描 RAW 全目录、不重建角色与媒体库。33 份编排含此指令，共 975 条；新增 `wholeScreenColorLayerEvents` 与统计，schema 为 12。工具深度比较确认其他字段/数组不变，安装前核对原文件与候选 SHA256，保留原索引备份。候选 SHA256 `1d1ce5c037e3c0bfdff12fe6156b4b2e936b5e418aa36558f6d28fa59ab98e34`。复现：

```powershell
python -X utf8 scripts/prepare-live-chibi-color-layers.py --output .analysis/engineering-validation-20261002/chibi-colors-candidate.json --receipt .analysis/engineering-validation-20261002/chibi-colors-receipt.json
npm run verify:chibi-color-layers
node scripts/verify-chibi-color-layers.mjs --published-assets
```

来源异常保留：`syksai` 两条 hide 的无效颜色 `#71A4D10` 原值保留，但不参与退场着色；`unmikn` 16.2s hide 缺少 ID，标记 `missing_layer_identity`、暂不应用，覆盖面板显示待确认，不猜测是隐藏某层或全部层。CI 小型 fixture 保存 ANYWHERE 的 60 条原指令与 CAB、字符串 PathID、文本 SHA；RAW 媒体和完整运行索引不提交。

用户重新要求核对舞台大小。移除 `STAGE_BASE_ZOOM=1.1` 和环境 `1.073` 两层默认放大，均回到 1；保留原 CSV 镜头倍率、可选检查滑杆、角色 Y/尺寸函数、背屏定位与各图层注册关系。Take 22s 源镜头仍为约 1.1491×，不再额外乘到约 1.264×。同段 Browser 对照显示两侧人物留出空间、舞台前沿更完整。Study 17.5s（S.E.M 三人）原镜头 1.3×，高低台与完整落脚点可见；15s 的源镜头 1.55× 仍可能裁到中心人物脚部，保留为待匹配原片的近景，不能以参考图未同步为由改写源镜头。参考为 20:9，当前窗口为 16:9，服装也不同，本批不声称像素一致。

真实 Browser 5198：ANYWHERE 0s 三层透明度为 0.7/0.5/0.3，深度 1500/1600/1710；8.6s 为 0.5/0.5/0.15；9.4s 第三层退场；36.5s 后回到 8.6s 恢复同一状态。连续播放从 8.6s 推进超过 38s，暂停、关闭/开启染色、关闭/开启歌词均正确；切到 Study 没有 ANYWHERE 层残留。1280×800、390×844、844×390 实测无横向溢出，横屏操作台在画布/播放条下方、不交叠。未观察到 console error，已有 Pixi/Spine 弃用警告保留。截图 `chibi-framing-take-before/after.png`、`chibi-colors-anywhere-desktop/mobile.png`、`chibi-framing-study-desktop/mobile.png` 位于原 E 盘证据目录。

`build:check`（14.42s、copyPublicDir:false）、Python 编译、published-assets 实际索引比对与当前 **94/94 Source Gate** 命令通过，日志 `chibi-color-source-gates.log`、明细 `chibi-color-source-gate.json`。此为本地源码门禁和模拟视口验收，未声称 GitHub CI、真实设备长稳或完整 Unity 渲染通过。多层 Graphics 的几何/混合及 Unity 3D 深度仍需原片核对；地面/观众灯、吊灯、角色明暗、Logo 生命周期和首帧视频问题仍未关闭。

Take Logo 的精确资源身份现已确认：`song_tkstp1.unity3d`，CAB `CAB-122fef368c526e0aa5ee19d0c345d391`，C.FIRST `_16b` 是 Sprite PathID `-7402552036384742190`（同名 Texture2D 为 `4951555358588418733`）；High×Joker `_8b` 是 Sprite PathID `-6801097922327521876`（Texture2D 为 `-8032899029242260248`）。资源确实存在，但本批尚未接入 `ImageObject_create/show`，不能把找到纹理当成显示链路已完成。

## 2026-10-03：纠正 Study 的台面中心注册

输入 HEAD `aa0ba5b1`。用户指出三人虽然入镜，却站在台面前沿。上一节只检查完整入镜，未验证台面中心，不能作为 Study 落脚点正确的验收；将 15s 裁脚全归于源镜头的判断也不充分。本轮重新对照两张 S.E.M 参考图和当前背景图，确认人物与台面注册偏移，取消默认放大没有解决这个问题。

`stage-backgrounds/steqmg.png` 为 1900×1060，SHA256 `90cf714d4e81645892edde6b25093980956f3ce0f3ddd7732c404a15a6de6e37`。三个台面中心的图像量测近似值为左 `(600,620)`、中 `(950,750)`、右 `(1300,660)`；CSV 三个位置分别为 `(-350,270)`、`(0,140)`、`(350,230)`。背景居中于 1280×720 后，三组位置对应同一个地面基准 Y=540。原 `0.82×720=590.4` 基准将三组位置统一向前偏移 50.4 个基准像素，叠加镜头倍率后更显著。

新增 `chibiStageCoordinates.js`。用户随后要求核查其他舞台；对照 ANYWHERE 地板分块、Take 前沿及另三种背景后，将校正接入共用设计坐标基准，而不是给 Study 单独加偏移。1280×720 下原基准 590.4 改为 540；不同画布使用 `height/2 + (540-360) × fit`，与居中的背景同源缩放，消除高度比例基准在取整/留边画布上的漂移。角色根节点、脚底阴影和跟随角色的 Spotlight / Pinspotlight 共用投影函数，避免人物挪回去而灯光仍留在台边。保留原 CSV X/Y、位置插值、相机、角色大小和高低台深度差；没有按角色或设备单独加偏移。此注册是参考图与平面背景校准，**不是从 Unity 相机/地面模型提取的 3D 投影**。

回归 `npm run verify:chibi-stage-coordinates` 使用独立台面中心量测点，验证桌面、390/360 竖屏及 844 横屏画布的注册一致性；`node scripts/verify-chibi-stage-coordinates.mjs --published-assets` 另检查本地 118 份编排、1,178 条位置事件跨尺寸一致性。CI 默认仅用小型量测见证，不依赖未提交的完整资源库。55 份背景均为 1900×1060，但这不能证明它们的全部镜头都已视觉验收。

Browser 5198 使用固定 `.analysis/build-check` 和既有资源映射，以 S.E.M 三人暂停在 17.5s 保存修正前/后同镜头证据；修正后三个落脚点均位于台面中部。390×844 和 844×390 复验，未见横向溢出或操作台重叠；15s 源镜头 1.55× 保留，中央脚部在当前画布内可见。Study 连续播放至 1:11 后暂停/倒退定位通过。

追加可见验收：Take 01 4.4s 修正前/后使用同编队，ANYWHERE 36.5s、∞ Possibilities 17.5s、BRAND NEW FIELD 15s、DRIVE A LIVE 15s、Take 02 4.4s 检查台面与脚底；未见落脚点进入台面侧壁或台外。BRAND NEW FIELD 保留源镜头横向取景，左侧人物可能被画布边缘裁切，尚无该曲原片支持其镜头完全一致。ANYWHERE 390×844 的 9.5s 有两个角色聚光池，灯底与人物脚底共同注册；实际播放推进到 1:00，再暂停/倒退恢复。Take 02 390×844 画布约 357×201，无页面横向溢出。当前共检查 7 种背景的指定片段，另外 48 种背景及全曲镜头仍待逐段原片对照，不把 1,178 条坐标检查计为 118 份视觉验收。

`build:check` 通过（最终 14.95s、未复制 public），本地当前 95 项源码门禁中的 94 项首次通过；`verify:build-audit` 首次因其他窗口在构建后修改 `src/App.vue` 失败。保留其他窗口的 App/门户/偶像选择器改动后重建，单独复验此门禁通过，未回退共享工作。未观察到 Browser console error；既有 Pixi/Spine 弃用警告保留。本地门禁与模拟视口不代表 GitHub CI、真实设备或完整 Unity 渲染通过。

截图在本工程 E 盘原证据目录：`chibi-study-ground-before/after/mobile/landscape.png`、`chibi-take-ground-before/after.png`、`chibi-anywhere-ground-after/mobile.png`、`chibi-possibilities-ground-after.png`、`chibi-brand-new-ground-after.png`、`chibi-drive-ground-after.png`、`chibi-take02-ground-after/mobile.png`。源码日志 `chibi-common-ground-source-gates.log`，最终构建及补验日志 `chibi-common-ground-build-final.log`、`chibi-common-ground-build-audit-final.log`。本轮只验收落脚点注册，不将不同服装/动作时刻的截图当成像素一致复刻；人物相对大小、灯具、Logo、首帧视频和完整 Unity 投影仍待后续验证。

## 2026-10-03：Take 图片对象试点与追加台面检查

站位修正提交 `ee98190f` 后继续验证，保留同时推进的门户改动。本轮追加 Infinite Octave!、Café Parade!、スマイル・エンゲージ、LEADING YOUR DREAM 的 17s 台面检查，检查人数覆盖二人、三人、五人。落脚点在背景地板内，未见越过台沿；这些曲目没有收到原片对照，不能据此验收原作相机/人物大小或全曲。共检查的背景由 7 种扩至 11 种，其余 44 种仍待视觉核对。

新增独立 `image-objects/index.json` 试点，不改写现有 118 份编排和站位。精确读取已登记的 `tkstp1_live_effect`、`tkstp2_live_effect` RAW TextAsset，保留 CAB、字符串 PathID、bundle/text SHA256。两个版本各有 8 组 Logo、24 条 ImageObject 指令；第二版也引用 `song_tkstp1.unity3d` 的 Sprite。导出按 **Sprite → 指针 → Texture2D** 绑定，拒绝同名纹理猜测；16 张透明 PNG 共 5,157,695 B，保留 1200×800 完整逻辑画布、透明边距、中心 pivot 和输出 SHA256，不烘焙进背屏。

解析 create 的 ID、透明度、X/Y 缩放、旋转、坐标与深度，show 的延迟、淡入、停留、淡出；hide 仍按 `value101/value102` 命名字段取值。source show `value6=999999` 保留为 `rawValue6`，语义未证实，不猜为循环次数。第一版最后一组 Logo 在 50.85s 的显式 hide 早于 nominal show 结束，运行时服从该 hide。独立 ID 时间轴支持中断/倒退，资源加载后重新读取当前时间，切歌清理旧对象并对 pending 加载使用版本检查。图片布景检查开关同时控制 Logo；诊断计数只登记已建成且当前可见的 Sprite。

Logo 与背景共用居中的 1280×720 设计空间：source `(-10,460)` 投影为 `(630,260)`，250/1000 缩放保留为 0.25。资源、坐标、深度与镜头共同缩放，实际位于背屏中部。此为 2D 显示链路，尚未声明完整 Unity ImageObject/3D 投影语义。

复现候选导出及校验：

```powershell
python -X utf8 scripts/prepare-live-chibi-image-objects.py --output-root .analysis/engineering-validation-20261002/take-image-objects-candidate
npm run verify:chibi-image-objects
node scripts/verify-chibi-image-objects.mjs --published-assets
```

本地只安装 16 张哈希核对过的 PNG 和对应索引到既有 E 盘 public 资源映射；原 RAW 未改。源代码/小型 fixture 提交，完整 PNG/本地 public 不随源码提交；正式资源发布还需纳入媒体清单并验收目标托管，不把本地成功当成线上已发布。旧资源包无试点索引时返回空，保留已有舞台功能。

Browser 使用既有 5198 生产代码预览和资源映射：第一版 22s C.FIRST、26s High×Joker，21.4s 可见淡入；两版共 16 组 Logo 逐组定位，实际 Sprite 资源诊断均为一组，无加载遗漏。52s 无 Logo，倒退恢复前组；第一版从 22s 连续播放到 1:53 后自动结束，Logo 段落退出。切到第二版和 Study 时没有前曲 Logo 残留。桌面 1280×800、390×844 手机、844×390 横屏检查，手机画布约 357×201、横屏约 321×180，Logo 随画布缩放，无页面横向溢出。横屏 seek 会将滑杆滚入视窗，先用播放按钮上的 Control+Home 恢复顶部，再取最终截图；不把滚动中截到局部画布的图片作为布局通过证据。

截图和日志复用原 E 盘证据目录：`chibi-take-logo-cfirst-desktop.png`、`chibi-take-logo-high-desktop/mobile.png`、`chibi-take02-logo-sem-mobile/landscape.png`、`chibi-*-ground-check.png`。CI 新增 RAW 小型 fixture 的解析/命名列校验、生命周期与 ID 替换测试、跨画布布局及两版全部 Logo 的资源合同；默认门禁不依赖 RAW/未提交 PNG，`--published-assets` 另核对实际本地输出。

最终代码构建 `build:check` 14.49s、copyPublicDir:false；当前 96 项 Source Gate 最终通过。首次 `verify:build-audit` 因共享窗口提交后 HEAD 变化失败，保留原失败记录，在 HEAD `abeccf24` 重建后此项复验通过。日志 `chibi-take-logo-source-gates.log`、汇总 `chibi-take-logo-source-gate-final.json`、最终构建/补验 `chibi-take-logo-build-final.log`、`chibi-take-logo-build-audit-final.log`。最终 bundle 首载 Take 02，再定位 26s，图片开关实际 1→0→1，原 S.E.M Logo 恢复；未观察到 console error，既有 Pixi/Spine 弃用告警保留。这些是本地源码门禁及模拟视口验收，未声称 GitHub CI 或媒体发布通过。

角色明暗、地面/观众灯、吊灯、真实设备、相机与完整录像对齐仍未关闭，本轮没有把找到 Sprite 或门禁通过当成整首舞台已完整复刻。


## 2026-10-03：逐人身体染色接线与 RAW 全索引复核

输入 HEAD：`9a639371`。保留其他窗口的门户、摄影、故事与主题改动。上一轮推进已落地共用落脚点与 Take ImageObject；本轮继续修复录屏中独唱者明亮、其他角色变暗的缺口。

- 原始命令是 `Livechara_body_color`，不是已接线的 `Livechara_Foot_Color`。按命名字段读取 time、value1（performer slot）、value2（RGB）、value3（0–1000 混色强度）、value4（渐变毫秒）；退场使用 value101/value102。保留负时间初始化，注释命令不执行，无映射目标或非法值报错。
- 使用既有 `stagePositionMap` 转为左到右舞台位置。Take 两版原始 1 号 performer 在中央 3 号位；第一版 22.15 秒解除中央暗色、25.8 秒解除最右暗色，第二版分别在 22.2 秒解除左侧 2 号位、25.8 秒解除右侧 4 号位。不能直接把原始编号当屏幕顺序。
- 对全部 118 个已索引 TextAsset 做有界刷新，得到 **1,188 条命令、15 个含逐人染色的曲目／版本**。刷新只改 choreography 的 bodyColorEvents、相应统计和 schemaVersion（13）；其他字段保持完全相同。随后独立经完整 `read_choreography_scripts` 重读同一批 RAW，118 个 performer map 与全部新事件一致。Take 两版各 69 条原始命令及 CAB/pathId/hash 收入源码 fixture。
- 共用舞台时钟每次重建独立 tint 轨道；渐变被新事件打断时从当前采样颜色继续，hide 淡回白色。与已有灯光颜色相乘，不改变 Spine 透明度。灯光开关关闭时恢复白色，切歌采用新曲事件。此处采用线性 RGB tint 近似，仍不等于原 Unity 材质或局部脚部着色的完整复刻。

Browser：已核实本地 5198 属于固定 build-check 生产代码预览，使用现有资源映射。实际测试桌面 1280×800、竖屏 390×844、横屏 844×390：Take01 中央与最右独唱高亮、Take02 右侧独唱高亮、倒退到 21.3 秒渐变起点、21.4 秒中间态、灯光关／开、切到 Study 后没有 Take Logo／逐人轨道残留。最终构建中连续从 22 秒播放到 1:36，暂停后倒退到 26 秒和 22.4 秒，独唱明暗状态准确重建；浏览器无 error 日志。再检查 FLASH LIGHT 四人编排 17 秒，中央较亮而其他角色有独立 tint，和旧版整体灯光同时合成；该镜头包含原时间轴横向摄像机裁切，不将画面外角色当成丢失资源。

FLASH LIGHT 是第 12 个已查看落脚画面的曲目／版本条目，当前可见角色足点位于台面内；这只证明该帧的台面关系，不证明所有曲目、全曲镜头或原作人物比例已验收。

验证：新增 Python 命名字段／异常拒绝与两版 RAW fixture 回归，Node 独立目标位置／渐变中断／hide／倒退／旧包空字段／颜色合成回归；本地 published-assets 复核 1188 条与 15 个曲目。源码门禁共 97 项；首轮 96 项通过，build-audit 因其他窗口的 src/App.vue 在初次构建后变化而拒绝。重新 `build:check`（14.56 秒、copyPublicDir:false）后 build-audit 通过，原失败日志保留。相关 engineering 回归也已重跑。该门禁快照绑定当时的 dirty HEAD `9a639371`；之后其他窗口提交了 `f0de1db4` 并继续修改故事 UI，因此不能将它当作共享分支当前 HEAD 的干净发布门禁。没有全库资源复制，没有 GitHub CI、设备或线上媒体验收声明。

小型证据均在 `.analysis/engineering-validation-20261002/`：

- `body-colors-raw-receipt.json`、`body-colors-choreography-candidate.json`、`body-colors-choreography-before.json`：RAW 来源绑定、候选与回填前元数据。
- `chibi-body-colors-source-gate-final.json`、`chibi-body-colors-build-final.log`、`chibi-body-colors-build-audit-final.log`：最终验证及保留的首次失败。
- `chibi-take-body-central-desktop.png`、`chibi-take-body-right-mobile.png`、`chibi-take02-body-right-centre-landscape.png`、`chibi-flash-body-ground-desktop.png`：实际可见画面。

当前仅刷新本地 choreography JSON；正式媒体包／R2 仍需带上这些事件再验证。`Image_color`、Stagelight、Penlight_unit_color、Searchlight/NewSuspensionlight、原作完整舞台材质／投影与其他尚未查看的背景仍未收口。尤其 Take 背景比录屏亮，不能因角色高亮已正确而标记整个灯光复刻完成。

## 2026-10-03：图片组件染色与其余舞台首轮检查

本轮新增精确 `Image_color` 接线：重读全部 118 个已索引 RAW TextAsset，共 2,177 条、15 个曲目／版本。只刷新 imageColorEvents、相应统计和 schemaVersion（14），其余编排字段保持相同。Take 两版各 115 条收入小型源码 fixture，命名列重排、时间、渐变中断、隐藏及倒退均验证。源中保留 4 条异常（ominut 三条七位 RGB、plmask 一条目标／颜色／强度异常），不截短或猜测修复，审计显式标为未解析。

对于含此命令的十种静态背景，从已索引 bundle 的 Sprite→PPtr→Texture2D 导出 30 张原始透明画布（共 22,539,828 B）；保持 1900×1060 尺寸、中心 pivot 与层序，逐层复合与原背景的 RGBA 像素十组全部一致。运行时可分别染色；With...STORY 的三层确有不同颜色，不能给扁平背景套一个平均色。已有动态 Image_layer 同样按资源名寻址，Take Logo 未被场景色误染。可选组件缺失时回退原合成背景，异色需求显式提示，避免误称完整支持。静态舞台开关覆盖新组件；切歌释放纹理并拒绝旧加载回写。

本地资源安装了新事件及这些组件，RAW 不改。素材仍由 E 盘 public 映射提供，源码提交不包含 PNG 或完整媒体发布；正式打包需要先刷新 Image_color，再导出独立组件并纳入媒体清单。

Browser 首轮站位覆盖累计 **59 个非特殊歌曲／版本条目**：此前 12 个，本轮 Tone's Destiny、With...STORY，再逐一选择其余 45 个并定位 20 秒。覆盖 54 个有 Spine 人物的静态背景及 5 个完全动态背景；drv999 社长 2D 不纳入 Spine 足点结论。45 张新画面保存在 ground-<code>-20s.png，九张 contact sheet 全部目视复核，未再见这一批可见足点普遍越出台沿。Study 的三人分别在三块平台台面内。此为指定帧检查，不等于 59 首全曲或原作比例通过；MOON NIGHT 的上缘裁切、Multiple Entertainment Show 的底部足点／歌词关系、数首横向镜头裁切及部分阴影偏移仍需原片比对。最后 15 条批量截图操作超时重置了工具，但其中 14 张已写出；核对文件后补拍末项，丢失的文本诊断未补造，结果明确记录恢复边界。

染色旅程实际覆盖桌面 1280×800、手机 390×844、横屏 844×390：Take01 22.4 秒青色、26 秒红色，Take02 26 秒品红；灯光关／开与倒退恢复，With...STORY 独立颜色、Tone's Destiny 灰色、切回 Study 没有前曲 Logo 或 tint 残留。最终重建后 Take 三层静态开关实际关／开，保存 chibi-take-components-off/final.png；组件诊断为 3、冲突 false。模拟视口不是实际设备测试。

本地 98 项 Source Gate 命令快照首轮 97 项通过，唯一 archive-assets 初次因 OS 选择的 10080 端口被 Node fetch 拒绝（bad port），重跑该项实际 30 条 HTTP fixture 通过，保留首次日志。汇总 chibi-image-colors-source-gate-final.json 不将此快照写成 GitHub CI。之后共享窗口更新 HEAD，最终 build:check（copyPublicDir:false）与 build-audit、Image_color、body color、1178 站位／118 编排和 VFX coverage 补验通过；最新构建与其他窗口并行提交绑定 89278976。日志 chibi-image-colors-build-close.log；无全库复制。光束、粒子、观众棒、屏幕几何与完整 Unity 材质仍未整体验收。

用户随后提供 Take 01/02 本地完整录屏，共 328.37 秒、2340×1080。只读采样确认中间含选曲和加载，不能直接按总时长平分为歌曲起点。舞台透明屏幕开口两版均 [726,300,1160,542]（434×242）；现有 272×144 视频按 920/1000×2 投影为 500.48×264.96，而原共用偏移给出上边 307.52，开口顶端确有约 7.52 个设计像素没覆盖。此为新一轮屏幕配准的可复现问题，尚未在本批改写为已解决。

## 2026-10-03：Take 录屏对照与背屏开口配准

输入提交 f647ce4f。原片为用户指定的本地 328.37 秒、2340×1080 MP4；只读抽帧、源 SHA256 和 ffprobe 元数据在 take-reference/source-receipt.json。原片约 48–50 秒与 204–208 秒仍含片头／加载，71 秒为第一版 C.FIRST、231 秒为第二版 S.E.M，只作为对应演出段落的视觉证据，没有宣称音频时钟逐帧对齐。

两版原舞台透明开口相同：1900×1060 完整图的 [726,300,1160,542]，中心 (943,421)。原 Backmonitor 均为 x=-7、y=340、scale=920，所有引用视频 272×144；原画居中后屏幕应在 (-7,-109)，而旧共用 Y origin 250 给出 (-7,-90)，低了 19 个设计像素，虽视频大于开口，顶部仍漏出约 7.52 像素。新增 Take 专属、可追溯的 Y origin 231，保留原缩放和相对动画坐标；其余舞台仍采用原注册值。过场透明／彩色视频复制同一 Sprite transform，随此次调整一起贴合。未改写 CSV 或把观众席当成屏幕的一部分。

专门的几何回归证明两版的视频矩形覆盖整个开口，含 1280×720、869×489、357×201、321×180、800×500，以及环境缩放 1、1.073、0.85；published-assets 逐条核对两版所有屏幕指令与实际视频尺寸。build:check 21.34 秒、无 public 拷贝；build-audit、engineering 与新增回归通过，绑定本批修改中的 f647ce4f。CI 只增加源代码回归，未声明 GitHub CI 已执行。

Browser 最终 bundle：桌面 Take01 22.4 秒、手机 390×844 的 26 秒、横屏 844×390 的 Take02 26 秒实际观察，黑色细缝消失，完整舞台框保留；回到 Study 时配准回落到 legacy-content-plane，未串用 Take 修正。无 console error。截图 chibi-take-screen-after-desktop/mobile.png、chibi-take02-screen-after-landscape.png；修前截图及放大的 top-edge 对照保留。视口结束后重置。这是指定帧／模拟设备检查，不等于真实设备、原相机视野或人物比例完全复刻。

原片同时揭示尚未完成的效果：组合独唱时前景与看台 call 棒同步切换代表色、舞台装饰／地板有明暗与发光，当前仅背景和人物染色不足以表达这一层。精确重读两个 RAW TextAsset，Take01 有 **1,941 条 Stagelight、495 条 Penlight_unit_color**，Take02 有 **1,940 条 Stagelight、495 条 Penlight_unit_color**。原命令含独立编号、强度／时间／颜色集合等字段，完整命名行保留在 take-reference/raw-light-commands.json；当前尚未把这些源命令接到相应材质／观众棒，不能用整体 Image_color 冒充。原片截图中顶部装置、地板 glitter、观众席与粒子仍列为下一轮源语义／资源关联工作。屏幕修正未宣称消除这些缺口。

## 2026-10-03：Study 第二录屏目标与光束开关修复

输入 HEAD `89f61110`。用户补充的第二验收目标为本地 `E:/Program Files/yt-dlp/Media/【偶像大师SideM成长之星MV】Study Equal Magic!.mp4`：27,117,494 B、1600×720、114.733 秒，SHA256 `29396c33375c6d4c1e20339cdcd03e0a2dc62de77f211a14bb151b08ec8fde17`。与本地 `steqmg.m4a` 分别取歌曲 10–20 秒、90–100 秒的单声道波形作归一化互相关，录像起点偏移为 4.7275／4.73175 秒，相关度 0.88185／0.81699，两段差 0.00425 秒。初次长段比对因微小录制时钟漂移未达阈值，未沿用其低置信匹配。此证据确定歌曲时间与录像时间的对应，**不证明 CSV 动作时钟或视觉复刻已通过**。

新增只读 `audit-chibi-reference-video.py`：两段分离波形见证均须相关度至少 0.75、起点差不超过 40ms；失败就停止抽帧，不猜片头长度。只在内存解码低采样率音频，输出七张宽 960px 的 JPG 与来源／时间／SHA256 receipt，不复制录像或产生完整媒体包。回归 `verify-chibi-reference-video.py` 使用独立合成信号，实际覆盖增益、噪声、DC 偏移、片头裁去及无效输入拒绝。分析工具需要现有 Python NumPy／SciPy 与本地 ffmpeg／ffprobe，未增加前端依赖。复现命令如下（ffmpeg 路径按实际安装位置指定）：

```powershell
python -X utf8 scripts/verify-chibi-reference-video.py
python -X utf8 scripts/audit-chibi-reference-video.py --video "E:/Program Files/yt-dlp/Media/【偶像大师SideM成长之星MV】Study Equal Magic!.mp4" --song-audio public/assets/live-chibi/music/steqmg.m4a --ffmpeg "D:/Program Files/ffmpeg/bin/ffmpeg.exe" --ffprobe "D:/Program Files/ffmpeg/bin/ffprobe.exe" --output-root .analysis/engineering-validation-20261002/study-reference/aligned --times 2.9 13 17.5 32.174 54 75 92
```

Browser 5198 的 Study 基线使用 S.E.M 三人：2 号位山下次郎、3 号位硲道夫、4 号位舞田类，当前默认 005_00 服装与录屏粉色外套不同，人物比例不按像素一致验收。1440×900 指定帧 13／17.5／32.2／54／75／92 秒与音频配准后的录像比较；滑杆步长为 100ms，32.174 秒需取 32.2 秒，保留 26ms 误差。仍可见聚光与星形遮罩的尺寸／层次不符、观众粉色 call 棒缺失、台面光效与整体亮度不一致。暂停帧动作还需检查异步动作加载和源时钟，未凭不同姿势直接改写 CSV 或加臆测的两秒偏移。第二目标保持 **待完整视觉验收**。

本轮复现并修复实际交互 Bug：在 13 秒关闭“光束灯效”后，诊断计数已归零，但此前建成的 Spotlight 聚光池、Laserlight 斜线仍显示。两处同步函数遗漏开关判断，现将已有渲染对象的 visible 同时约束为开关开启和时间轴状态可见。1440×900 同段关／开可见验证通过：关闭后池／激光消失，开启后恢复；关闭后定位 17.5 秒仍保持隐藏。390×844 再验证关闭状态及恢复，计数与画面一致，无新 console error，已有 Spine tint 弃用警告保留。此开关只控制 Spotlight／Laserlight／Pinspotlight，舞台物件仍由自己的开关控制。截图 `study-reference/beams-off-before.png`、`beams-off-after.png`、`beams-on-after.png`、`beams-off-seek-after.png`、`beams-off-mobile-after.png`、`beams-on-mobile-after.png`；结束已重置视口。模拟窄屏不是实际手机验收。

补充资源证据工具 `audit-chibi-light-resources.py` 精确查验 Android XAPK 内 `resources.assets` 的 22 个 `fx_in_tkstp1_stagelight_*` 和 `LiveObjectPinspotlight`，保留 Transform、Sprite→PPtr→Texture2D、材质／shader 和脚本类名。未知 MonoBehaviour 自定义尾部显式保留 rawHex／SHA256／严格读取失败，不把公共字段当作完整解码。XAPK SHA256 `517b907602c2667b6f1caa7d1df2623d49d082cd27f89e44163765e1ea61bda2`，内部 Unity data SHA256 `d35231c0b00a09f6941f47f7ffedde9e9b35701f5b66d6f432517da860e1a500`；结果 `take-reference/typed-light-prefabs.json`。工具复现：

```powershell
$stageLightNames = 1..22 | ForEach-Object { "fx_in_tkstp1_stagelight_$_" }
python -X utf8 scripts/audit-chibi-light-resources.py --names $stageLightNames LiveObjectPinspotlight --output-file .analysis/engineering-validation-20261002/take-reference/typed-light-prefabs.json
```

确认 Stagelight 根脚本是 `LiveObjectLightSpriteEffect`，子灯片具有不同局部缩放，22 个 prefab 不等于 22 张独立纹理；材质为 `underlight_add`／`Mobile/Particles/Additive`。Pinspotlight 有 **MaskSprite 和 FlashSprite 两个角色**：前者使用 Sprites/Default 并关联 AlphaMaskSprite，后者初始为黑色、采用 TransparentAdd／ohashi/SimpleAdd。现有单 Sprite ADD 加全画布变暗尚未复刻遮罩链，但 ADD 确实是源 Flash 层材质，不能把 additive 本身判为错误。Study 原片确有地面星形光，待修的是投影位置／尺寸／遮罩作用，而非简单删掉星形。

旁证来自本地已解密 iOS metadata 的类字段／方法签名：Pinspotlight 包含 mask／flash renderer，Penlight 有 SetAnimation／SetTransform／SetSpriteDisplayUnitInner，Stagelight 有 AlphaWave／Rainbow／Gradient。此为另一个平台的元数据，无方法体，不能证明 Android 参数语义或完整渲染合同。Stagelight value3／4／5／7、观众棒排列／动画和 AlphaMaskSprite 行为仍需进一步解码；本轮未上线新的近似灯光模型。

Python 回归／编译、现有坐标、Image_color、背屏注册与 `verify:engineering` 通过；最终 `build:check` 14.10 秒、copyPublicDir:false，`verify:build-audit` progress 通过，绑定 dirty HEAD `89f61110`。首次 build-audit 因另一窗口在构建后修改 StoryDiscovery.vue 被拒，保留失败并在最新工作区重建通过，未回退共享工作。日志 `chibi-study-reference-build-final.log`、`chibi-study-reference-build-audit-final.log`。这是本地进度门禁与指定帧验收，不是当前分支干净发布、GitHub CI、全部交互／真实设备或舞台复刻的最终门禁。


## 2026-10-03：暂停时钟、循环定位与原生 Penlight 动画证据

本轮从 `6f59dea3` 开始；构建期间其他窗口正常提交到 `d0b6fc24`，保留其 UI／资源审计改动。真实 Browser 在 Study 17.5 秒暂停时，两次画面中的动作继续变化，虽然滑杆始终 17500。Spine 默认自动更新，旧 stopStage 只停 RAF／音频，没有停 AnimationState。现统一暂停、恢复及变速时的 motion timeScale；异步动作加载完成也按当前播放状态设置速度。启动期间只同步动作速度，避免触发 applyPlaybackSpeed 原有的取消准备逻辑。首次尝试的启动回归被 engineering 测试拒绝，已修复且保留失败日志。

另以实际 Spine 3.8 AnimationState 复现：一次大 delta 不会立即切换排队的主动作→循环，因为切换依赖前次 apply 写入的 trackLast。定位现以不大于 1/60 秒的 CPU pose 步进推进，再一次刷新渲染附件，恢复原速度；事件 speed 仍只乘一次。回归以独立 120Hz 连续播放比对 0／0.2／0.95／1.04／1.1／2.25／7.5 秒，包括循环和混合；80ms 混合区因步进分辨率允许 2° 差，其余骨骼旋转误差小于 0.01°。不把这一回归写成所有实际动作逐帧相同，也未给 CSV 统一加减偏移。

只读录像工具另采样歌曲 14.8／15.1／15.5／15.9／17.1／22.3／22.6 秒（`study-reference/clock-witness/`）。14.8／15.1 仍有三束粉色聚光，15.5 已关闭，与 CSV 15.2 秒隐藏相符，不支持把全部视觉时间统一平移两秒。Study 17.5 秒当前手势仍与同时间录屏不完全相同，默认 005_00 与原片服装也不同；此差异继续待查，不能由暂停修复推导整曲动作已验收。

新增资源检查选项 `--animation-controllers`，通过每个 Animator 的真实 PPtr 保留唯一 Controller／AnimationClip 完整 typetree，拒绝把 legacy curve 数组为空解释成无动画。实际 `LiveObjectPenlight_1` 有 Front 19、Middle 20、Back 21、Back2 22，共 82 个 Animator；`_2` 有 10／9／10，共 29 个。另各有 Shadow Sprite。111 个引用都指向 `resources.assets:1349` 的 Penlight 控制器，共十段：Beat1–3（0.833333s）、Yeah1–3（2s）、Wiper1–4（1s）。曲线实际存于 m_MuscleClip.m_Clip.data.m_StreamedClip，包含 6 或 9 个 scalar curves；控制器的 m_TOS 保留真实状态名。原生变换、底端 pivot、SpriteRenderer 层序、动画字流均已保留，但 RAW value3／4／5 到动画类型／编号／速度的映射尚未验证，未接入新近似观众棒。

```powershell
python -X utf8 scripts/audit-chibi-light-resources.py --names LiveObjectPenlight_1 LiveObjectPenlight_2 --animation-controllers --output-file .analysis/engineering-validation-20261002/take-reference/typed-penlight-animations.json
```

该证据 JSON 为 852,053 B，实际断言 82／29 个引用、唯一控制器、十个命名 clips 全部通过；Python 编译通过。无录像拷贝、素材包或未知参数强行解码。Android 同来源哈希沿用上一节，iOS metadata 仍只有签名旁证，不能当作方法体证明。

最终本地 `verify:engineering` 通过，stage timing／protocol 为 23 项；`build:check` 13.66 秒、copyPublicDir:false；`verify:build-audit` progress 通过，绑定 dirty HEAD `d0b6fc24`，不是干净发布门禁或 GitHub CI。日志 `chibi-motion-pause-engineering-final.log`、`chibi-motion-pause-build-final.log`、`chibi-motion-pause-build-audit-final.log`。最终 Bundle Browser 证据和剩余视觉差异见本节后续记录。


最终 Browser 旅程：复用 PID 62924 的 5198 build-check 生产 bundle／已有 public 资源映射；页面标题／路由正确、内容非空、无框架错误遮罩。1440×900 的 Study S.E.M 编队定位 17.5 秒、32.2 秒；从 32.2 实际播放到 64.7 秒，暂停定格于 65 秒；暂停下改 2× 倍速。17.5 秒暂停、播放后暂停和暂停变速的两次完整截图分别像素完全一致（seek-loop-final-desktop-a/b、final-play-pause-a/b、final-speed-pause-a/b）。390×844 的 Study 17.5 秒舞台／播放区同样像素一致，差异仅在底部控制台的加载点，不属于舞台；截图 final-mobile-pause-a/b。切 Take01 至 22.4 秒，五人中央高亮、背屏贴合及暂停画面实际查看，截图 take-reference/final-motion-pause-a/b；舞台区两次截图一致。没有 console error，已有 Spine tint 弃用 warning 保留。结束重置视口并返回 Study 入口。

上述为交互 Bug 的实际浏览器复验与源动画状态回归，不是录屏所有姿势、光效／观众席、真实手机或全曲一致性验收。Study 指定帧仍有手势、遮罩尺寸、台面亮度／发光、前景粉色棒等差异，下一轮应沿原生参数与角色动作来源继续核对。

## 2026-10-03：原生 Penlight 曲线解码与 Study 动作分歧复核

输入 HEAD `40ea551a`；其他窗口的 config/resource-audit.json、六个 archive Vue 文件及未跟踪交接文件均保留。本批仅新增独立 Python 审计／回归工具与此记录，不修改前端、RAW 或发布素材，因此按构建政策不机械重建 Vite。

`audit-chibi-streamed-animation.py` 从上一批通过真实 Animator PPtr 提取的 typetree 解读 uint32 字流。结构与 [AssetStudio 的 StreamedClip／FindBinding 源码](https://github.com/Perfare/AssetStudio/blob/master/AssetStudio/Classes/AnimationClip.cs) 对照：float time、int key count、每键 int curve index 与四个 float 三次多项式系数；Transform attribute 1／3／4 分别绑定位置、缩放、Euler 三个分量。本地十个 clips 的首帧是 float.MinValue（不是负无穷），末帧为正无穷且零键。输出将哨兵转为初始值与显式终止检查，所有 JSON 数字保持有限值。只接受根 Transform、已知绑定及完整 streamed 通道；遇到 dense／constant、未知 customType、legacy curve、事件或对象引用即拒绝部分导出。

实际十段原生动画全部解码，**117 个连续区间端点**与下一原生关键帧相符，最大误差约 1.91×10⁻⁶；常值／阶跃区间单独计数，不强迫跳变连续。Beat1–3 约 0.833333s、Wiper1–4 为 1s 且循环；Yeah1–3 为 2s且不循环。Wiper1 的 0.25s 原生值 x=1.5、y=-0.3、Euler z=-20° 再独立核对。输出 `take-reference/decoded-penlight-curves.json` 保留输入文件 SHA256、同一 Android XAPK／Unity data 来源哈希、每段原始 clip 身份与字流哈希、通道系数及采样范围。这里证明字流和曲线能读通，**不证明 RAW 编号／速度已映射到控制器，更不等于观众棒视觉验收**。

回归包含独立解析解 smoothstep、阶跃与稀疏关键帧；拒绝截断、缺哨兵、时间倒序、重复／越界曲线、非有限系数、非法 uint32、未知绑定及部分通道。故意把实际 Beat1 的常值 x 区间污染为 t³，端点检查确实拒绝。Python 编译、该回归和既有录屏音频配准回归通过。

另将十个 clips 的实际消费字段投影保存为 `scripts/fixtures/chibi-penlight-streamed-clips.json`（19,999 B），包含原字流／绑定／时间及来源身份，未合成值。完整输入与该小型 fixture 解码的十个 clip 输出逐项相同。回归不带参数即可用 fixture，已加入 Source Gate 工作流；这里只新增并本地执行回归，尚未声明 GitHub CI 运行。fixture 不含纹理、录像或完整资源包。

```powershell
python -X utf8 scripts/audit-chibi-streamed-animation.py --input-file .analysis/engineering-validation-20261002/take-reference/typed-penlight-animations.json --output-file .analysis/engineering-validation-20261002/take-reference/decoded-penlight-curves.json
python -X utf8 scripts/verify-chibi-streamed-animation.py .analysis/engineering-validation-20261002/take-reference/typed-penlight-animations.json
python -X utf8 scripts/verify-chibi-streamed-animation.py
```

Study 对照继续使用第二录屏与已验证的音频起点偏移。新增歌曲时间 17.5／18／18.5／28.4s 四张录屏帧及 receipt（`study-reference/pose-witness/`）。实际 Browser 5198、1440×900 的 S.E.M 编队，从 15.2s 连续播放后暂停在显示 28.4s，再拖动定位到 28.4s；另从 16s 连续播放约两秒后暂停于显示 18s，再定位同一刻。两组可见姿势接近，后者连续播放与定位都仍为向侧面伸手，录屏 18s 则手收于胸前。滑杆以 100ms 显示／定位，不能将连续暂停内部小数时间与截图严格像素等同；这里只排查可见大幅手势分歧，未声称全骨骼相等。截图 `continuous-pose.png`、`seek-pose.png`、`clap-continuous-pose.png`、`clap-seek-pose.png` 保留。上一批暂停冻结仍有效，无新 console error。

直接重读 `song_steqmg.unity3d` 的 `steqmg_live_effect` 命名列：17s 确实给三名 performer 下发 20012、speed=800，注释是“横に手を出して戻す（手のひら上向き）”；不是解析器误读成另一个动作。13–21s 原始行／CAB／pathID／包与 payload SHA256 保存在 `study-reference/raw-motion-segment.json`。实际 body-1 的 14010 和 20012 主段与循环段都是 1.5s（`motion-duration-witness.json`）。iOS metadata 字段默认值另确认 `LiveObjectIdol.MeasureAnimTime=1.5`、`MotionRandomDelayMax≈0.05`，以及 ColorPlaceType None=0、Random=1、Equally=2；字段索引、字节偏移、原始字节及 metadata SHA256 保存在 `native-motion-color-constants.json`。metadata 没有方法体，**不足以确定 get_baseTimeScale／PlayMotionInner 的计算公式或 Android 行为**。当前 speed/1000 换算、动画主段／循环选择与录像版本差异仍需核对，未凭这两个常量全局反转 speed 或偏移 CSV。

本批新增工具没有前端接线，Browser 是对已存在 40ea551a 生产代码预览的诊断，模拟桌面并非真实设备验收；结束恢复默认视口。完整 Study／Take 光效、call 棒、遮罩、舞台装置与全曲动作仍待收口。门禁、master PR 与最初 UI／审计目标也未由此次工具回归自动验收。

### Study 原动作逐相位核对：排除大倍率假设（2026-10-03）

输入 HEAD：9cbd1909。只修改诊断工具与此记录，未改播放器倍率、编排时点或渲染代码；其他窗口的目录接线工作保持独立。

`inspect-live-chibi-motion.mjs --pose` 读取实际 setup 的字符串表和指定 motion 中指定动画序号，输出骨骼世界坐标及当前附件身份。receipt 包含实际消费字节的 setup／motion SHA256、路径、动画序号及诊断 skin；明确标为 `native_pose_samples_not_player_or_render_acceptance`。坐标未经播放器缩放、镜头和服装渲染，不可直接作为画面像素验收。每个时间点新建 Skeleton：回归确实暴露了仅 setToSetupPose 后重复采样时部分原生约束的世界变换残留，因此不复用上一采样骨架。

本地 RAW 回归 `node scripts/verify-chibi-native-pose-samples.mjs` 通过 15 项：body-1／body-2 的 20012 主段伸手、换向、收回，循环段持姿，重复乱序采样一致，来源哈希吻合，以及空参数、非整数身份／动画序号、NaN、Infinity、负值／越界时间和超过 100 次采样拒绝。非法输入不会输出看似成功的 receipt。需要已有 prepared native assets，**没有加入缺少媒体的 Source Gate，也未把它称作 CI／实际渲染验收**。既有时长汇总与 transition CLI 另实际执行通过。纯独立工具按构建政策不机械运行 Vite。

`study-reference/motion-phase-witness/` 新增 16 张音频对齐录屏帧、receipt 和 contact.jpg：7／7.4／8／8.6、15.3／15.7／16.1／16.5、17.2／17.4／17.8／18.2／18.6／19／19.4／19.8 秒。两段独立音频配准仍为 4.7275／4.73175s，差 0.00425s。录屏在 17.4s 尚收手、17.8s 向右伸手、18.2／18.6s 向左伸手、19s 收回，说明上一批 18s 单张差异不能推广成整段动作完全错误。

原始 `steqmg_fumen` 另确认只有一个 tempo conductor：tick=0、164 BPM、4/4；bundle／TextAsset pathID／payload SHA256 保存在 `source-tempo-witness.json`。仅凭 MeasureAnimTime=1.5 与 BPM 推测 `1.5 × BPM / 60` 会得到 4.1；再乘 raw speed=0.8，20012 主段会在约 17.457s 完成、进入持姿循环，与录屏 17.8／18.6s 仍伸手相矛盾。**这个缺四倍倍率的假设被排除，没有接入全库**。更小的相位差、原生 baseTimeScale 公式和录像版本仍未确定。

实际 Browser：复用 5198 的既有 build-check bundle／public 映射，Study S.E.M 编队定位 18200ms，1440×900 定格为向左伸手，与录屏 18.2s 的方向一致。证据 `motion-phase-witness/browser-desktop-018.200.png`；不是服装、灯光、比例或全曲逐帧通过声明。Android lib 的段表和 metadata 为受保护输入、没有可直接可信映射的方法体；iOS UnityFramework 既有 cryptid=1 边界未突破，不把元数据名称当原生公式。完整动作／光效与最初门禁／PR 工作继续待验收。

### Penlight 原生数组、配对与控制器绑定闭合（2026-10-03）

本批输入 HEAD：5caf8be3。复用同一 Android XAPK 的 `typed-penlight-animations.json`（SHA256 `914834607a291c3795486d814d43dbea45710b0b6fe07b78044bc17f54c6c376`），不改前端、CSV 或媒体包。新增 `audit-chibi-penlight-bindings.py`，消费原始 MonoBehaviour 字节、typed descendant identities 和原生 AnimatorController 数据；输出 `take-reference/verified-penlight-bindings.json`，状态 `verified_native_penlight_bindings_not_command_mapping`。

两个 `LiveObjectPenlight` custom tail 均恰好是：32 字节 common header、SpriteRenderer PPtr 数组、Animator PPtr 数组、一个 int32，无剩余字节。header 的 GameObject／script PPtr、enabled／padding、空名长度与 typed common fields 一致，custom component 原始长度和 SHA256 另检查。全部 82／29 个 SpriteRenderer 与同序号 Animator 指向同一个 descendant GameObject；每个引用是本文件真实 typed component，拒绝外部／重复／越界指针，并覆盖全部 descendant Animators。各一个 Shadow Sprite 明确在数组之外，不能把它算成会动画的观众棒。字段名 `_sprites`／`_animators`／`_frontMiddleObjCount` 由既有 iOS metadata 字段顺序旁证；这是结构验证，不声称 Android custom typetree 已完整解码或原生方法体已恢复。

两个末尾 int32 分别为 **39／20**。第一种布局的 Front 19 + Middle 20 与 39 一致；第二种布局的 Front 10 + Middle 9 共 19，数组下标 19 已是 `Root/Back/02/Penlight`，末尾数仍为 20。输出严格保留原始 20，没有按可见组名重算，也没有判定原生循环使用 `<` 或 `<=`。这会影响之后的颜色分配边界，尚不可凭名字实现。

Controller 的 `m_TOS`、state NameID／PathID／FullPathID、单节点 ClipID、`m_AnimationClips` PPtr 以及 typed clip 身份逐项闭合：Beat1–3 对应 1244–1246；Yeah1–3 对应 1251–1253；Wiper1–4 对应 1247–1250。十个状态 speed=1、cycleOffset=0、无速度参数、无 transition／mirror；前两组中的 Beat 循环、Yeah 不循环，Wiper 循环，与 clip 的 native loop 标志一致。输出保存状态实际绑定，不用文件名顺序猜测。**仍没有证明 CSV type 1／2／3 到 Beat／Wiper／Yeah 的数字顺序、animId=0 的随机选择规则或 animSpeed 换算。**

小型 fixture `scripts/fixtures/chibi-penlight-bindings.json` 为实际消费字段的精确投影（125,969 B），保留原始字节、PPtr、路径、Sprite geometry／pivot／颜色及控制器字段，省略未消费的 transforms、curve streams 和其他 controller 字段；没有合成值或纹理。完整原生输入与 fixture 的 binding 输出逐项相同。`verify-chibi-penlight-bindings.py` 的 18 种故意污染全部拒绝：hash、额外尾部、数组长度／分界、外部／未知／重复／交换指针、状态 speed／参数／loop／name、clip 索引／引用、缺状态／controller、重复 prefab。无参数的媒体无关回归已加入 Source Gate，**尚未声称 GitHub CI 已运行**。

另交叉消费上一批 streamed clip fixture：两份 fixture 的 XAPK／Unity data／完整 typed 输入哈希一致，绑定状态的十个名称、clip 文件／pathID／原始 SHA256、duration／loop 与独立曲线解码结果逐项一致。传入完整证据时也检查它的实际字节 SHA256；关联、曲线与输入来源没有仅凭同名拼接。

实际验证命令：

```powershell
python -X utf8 scripts/audit-chibi-penlight-bindings.py --input-file .analysis/engineering-validation-20261002/take-reference/typed-penlight-animations.json --output-file .analysis/engineering-validation-20261002/take-reference/verified-penlight-bindings.json
python -X utf8 scripts/verify-chibi-penlight-bindings.py .analysis/engineering-validation-20261002/take-reference/typed-penlight-animations.json
python -X utf8 scripts/verify-chibi-penlight-bindings.py
python -X utf8 scripts/verify-chibi-streamed-animation.py
python -m py_compile scripts/audit-chibi-penlight-bindings.py scripts/verify-chibi-penlight-bindings.py
```

全部通过；纯独立工具按构建政策不运行 Vite，不产生新的 Browser 画面验收声明。原生 camera／舞台投影、CSV 动画与颜色算法、观众棒素材接入和录屏视觉验收继续待完成，不能把本次资源关联门禁视为全舞台或 master PR 验收。

### Study 广角镜头退场控制遗漏修复（2026-10-03）

输入 HEAD：fcd0a5e6。此前完整 [Source Gate 37070990646](https://github.com/windmet/GS_Archive/actions/runs/37070990646) 已在此 HEAD 成功，112 个步骤成功、无失败，包含原生 Penlight 绑定／streamed 回归。这是此前代码的 source gate，不能外推为下面新改动或全舞台验收。

Study 32.1 秒的 RAW Camera 命令 `value101=1/value102=1` 被旧主生成器丢弃，导出成全空参数。采样器继承前段 1.25 倍镜头，随后 32.2 秒的新镜头继续放大。音频配准录屏在该转场后回到广角，证据新增 `study-reference/transition32-witness/` 六帧及来源 receipt。32.2 秒附近录屏仍在上一歌词／手势，32.5 秒已经切到 ABCDEFG 与举手；这是边界附近约数百毫秒的相位差，不能依据 32.174 秒单帧宣称整段歌词／手势错位，亦没有全局偏移 CSV。

新增 `live_chibi_camera_controls.py` 按命名字段读取退场与时长；主生成器和 `prepare-live-chibi-camera-controls.py` 共享解析。独立刷新只补 `cameraEvents.reset/resetDuration`，核对原事件时间身份、不改其它字段，并检查读取后原 index 未被其他窗口写入。118 编排、8145 个 Camera 事件中，83 编排有 973 次退场；Take 01／02 无此控制。RAW 与输出身份／哈希保存于 `camera-controls-refresh.json`。published 媒体索引仍为本地派生产物，不把它作为受跟踪 source 输入；可用该工具复现更新。

实际 ChibiStageViewer 采样器为退场创建回到 zoom=1、X=0、Y=360、rotation=0 的过渡，并取消原 focus。倒退 seek 从事件重新计算；旧索引没有 reset 字段仍走旧路径。保留原先近似的 easeOutCubic，不声称这次恢复了 Unity 原生镜头投影或 easing 方法体。fixture 是三首实际 Camera 原行／已解析参数与 TextAsset identity；Python 回归覆盖重排字段、注释陷阱、非法 flag／时长／时间，Node 执行实际 SFC sampler 覆盖复位、中断 focus／pan／rotation、倒退重进及两首 Take 未改变结果。主生成器直接读完整 Study RAW 与刷新输出全部 Camera 事件相同。

本地 `npm run verify:engineering`、上述两项回归、Python 编译和 `npm run build:check` 通过；build-check 不复制 public。Browser 复用 5198 build-check／public 映射：1440×900、S.E.M 2/3/4 编队在 32.2 秒为 zoom=1、X=0、Y=360，倒退 30 秒后重进结果相同；32.5 秒为 zoom≈1.0521，广角后的新镜头开始推进。390×844 同一暂停时点，舞台与控制台上下排列，截图 `browser-desktop-032.500.png` 与 `browser-mobile-032.200.png`。这些是模拟视口，未验收真实手机；console 无 error，但仍有既有 SpineBase tint accessor 的弃用警告。

剩余差异明确保留：Spotlight 旧近似绘制残留中央／台前光斑，录屏单人聚光束更鲜明；粉色前景 call 棒未接线；动作相位、角色比例／遮罩／stage wash 尚未全曲逐帧验收。这里修复的是确切被丢弃的 Camera 退场，不把剩余视觉差异归为已通过。

## 2026-10-03：Spotlight 原生双纹理与绑定接线

输入 HEAD `23d51f1b`；期间其他窗口提交到 `fdd640bb`，保留其卡池／摄影 UI 工作。上一轮为实际 Camera 修复、Browser 与完整 CI 成功，本轮继续排查 Study 灯效。

从同一 XAPK 的 `resources.assets` 精确读取 `LiveObjectSpotlight`（GameObject 11425，script 106552，原始 72 B SHA256 `55038948738eea26551a2ef00be195b70c19cc95d60a93cd37b3598f4ab59cc1`）。iOS metadata 同名类序列化字段只有 `_flashSprites`，基类保留 targetIdol；从原始 PPtr 数组而非树顺序关联 SpriteRenderer 54159／55516、Sprite 2482／2495、Texture2D 791／799。两个 material 均为 `Mobile/Particles/Additive`。证据 `study-reference/typed-spotlight.json` 与小型 tracked fixture `scripts/fixtures/chibi-spotlight-prefab.json` 不含纹理或录像。

原资源是 `Spotlight1`（1024×1024，alpha 0–227）与 `Spotlight2`（512×512，alpha 0–129）；前者为边缘更亮的尖锥，后者为扁平柔光圈。原子节点光束局部 Y≈4.7、PPU=100，地面光圈 scale≈0.6，pivot 均为 0.5。导出工具添加这两张实际纹理及以原始 PPtr 校验的 `spotlight.layers`，保留 native Texture identity／原始 SHA 和导出 PNG SHA。浏览器仍用既有参考校准的 2D 落点投影，局部几何与 additive 接线**不等于 Unity 摄像机或移动语义已经复原**。

`ChibiStageViewer` 删除生成锥形 canvas 和 Graphics 椭圆，消费双原始 Sprite。共享贴图加载器通过 generation 拒绝切歌／卸载后的迟到结果，多个灯共享贴图；单张失败不安装半个灯、不逐帧重复请求，成功的兄弟资源在 release 时释放。没有在这一批更改 Spotlight 事件、自由灯状态、moveDuration 或整体洗色算法；旧 stage-effects 索引缺少新 descriptor 时不再冒充原生灯，需重新运行导出工具。PNG 与本地派生索引未提交；发布资源更新另需实际验收。

本地：native binding／子节点重排／10 种污染拒绝、实际 SFC Sprite factory、共享加载／迟到释放／失败处理、`verify:engineering` 均通过。`build:check` 完整编译 2780 modules，12.01s，固定 `.analysis/build-check`、未复制 public。HTTP 实测 Spotlight1 47,811 B、Spotlight2 6,118 B，响应 SHA 与导出清单一致。CI 新增 portable 原生绑定与异步生命周期 gate；此处尚未宣称它在 GitHub 跑过。

Browser：旧 tab 7 的截图接口多次超时，但 DOM／时间轴仍可访问；按工具恢复流程在同一 IAB 新建 tab 8，实际成功捕获，未改用其他自动化通道。生产 bundle `ChibiStageViewer-DZ9emiMg.js`，Study S.E.M 编队、005_00 衣装、13.7s 三束粉色光在桌面和 390×844 模拟视口可见；关闭后 seek 到 13.9s 保持消失，15.3s 退场计数 0，倒退 13.7s 恢复 3。无 console error，已有 Spine tint 弃用警告保留。结束重置 viewport。截图：`spotlight-native-desktop-013.700.png`、`spotlight-native-mobile-013.700.png`、`spotlight-native-off-mobile.png`。

**未通过的视觉要求**：32.5s 原生形状使旧自由灯错误更加明显，中央额外黄色束／台前光圈及右侧两束重叠仍存在（`spotlight-native-remaining-032.500.png`）；参考录屏该时刻主要是右台单束。需要继续验证 `Show(targetCharaIndex, scriptPos, moveDuration)` 的 CSV 字段映射、自由坐标与退场，不能凭 10000 数值直接假定 timeout 或补合成 hide。粉色前景 call 棒、激光形状、完整粒子和动作相位也未收口。本轮只证明原生资源链及指定交互，未宣称 Study 全曲验收、真实手机或发布通过。

后续门禁：GitHub Source Gate [37074703317](https://github.com/windmet/GS_Archive/actions/runs/37074703317) 在代码提交 `7361fcd16818441acf133aa6dd0fca142f67c2bc` 完成，结论 success，114 个步骤成功、无失败，含本轮原生绑定及异步生命周期回归。后续文档提交不冒充同一 HEAD 的 CI。

下一轮证据线索：直接解析 metadata 的 MethodDefinition／ParameterDefinition，并通过 byvalTypeIndex 关联 TypeDefinition，Spotlight 与 Pinspotlight 的 `Show` 都接收 `System.Int32 targetCharaIndex`、`UnityEngine.Vector3 scriptPos`、`System.Single moveDuration`。这证明 scriptPos 为三维向量，**未证明 CSV 具体哪一列对应 Y 或 duration**。现有派生索引 1,414 条 show、547 条自由灯中，争议列（目前名为 duration）分别有 505 个 10000、40 个 99999、一个 0、一个 1；多数非零目标的该列为 0。这是离场坐标解释的重要候选，仍应精确重读 RAW 并对照录屏。方法类型、metadata／索引 SHA、统计与证据边界保存在 `study-reference/spotlight-coordinate-candidate.json`；本轮未据此修改字段映射。

提交 `2800eae307c43f961a9ea9178df0946892508e92` 已推送；完整 [Source Gate 37072347273](https://github.com/windmet/GS_Archive/actions/runs/37072347273) 在此确切代码 revision **成功，113 个步骤成功、无失败**，包含新增 Camera 控制／实际 SFC sampler 回归、已有 Penlight 回归与 source-only 编译。之后的验收记录提交是文档更新，不借此宣称全媒体发布、真实手机、全曲光效或最初 master PR 目标完成。

## 2026-10-03：Study 未关联聚光的虚构台前坐标清理

复查 118 份精确索引到 RAW 的编排 TextAsset，逐条以 time＋lamp id 对齐 Spotlight：共 2,338 条（1,414 show／924 hide）；hide 标记与既有索引一致。547 条 show 没有角色站位关联，其中 value4 为 10000 的 505 条、99999 的 40 条，0／空值各 1 条。原始身份、bundle／TextAsset SHA 与全量统计保存在 `study-reference/spotlight-raw-census.json`；四首精确行和原解析事件保存在 tracked `scripts/fixtures/chibi-spotlight-timeline.json`。没有重写编排索引、卡牌或其他 UI 数据。

最初怀疑 value4 是 Y 而被读成 duration；复核发现部分有角色目标的指令同样使用 10000，且 native `Show(targetCharaIndex, scriptPos, moveDuration)` 类型签名不能证明 CSV 到 Vector3 的具体映射。因此 **不把这一字段改成 Y、不增加臆测退场时长**。仍保留既有 duration；自由位置／移动语义待解，当前不能称为 native 坐标复刻。

实际可确认的问题在渲染端：此前无 stagePosition 的指令一律补 `{x: event.x, y: 180}`，并继续显示先前绑定的 runtime。这在 Study 17.6 秒增加了中央黄色池，32.1 秒把旧灯光移到右侧与 32.15 秒新灯重复叠加。现在仅为已解析角色关联绘制双原生纹理；清除关联的 runtime 当帧隐藏，未关联灯仍参与原有环境状态，几何不臆造。新增 `data-spotlight-unresolved-ids` 保留未解析灯的可观察证据；visible ids/count 只计已安装并显示的 sprite，而不是包含未关联／资源未就绪的指令数。**这是一项明确的降级与去伪影修复，不证明所有 target=0 指令在原客户端都不可见。**

本地验证：新 `verify-chibi-spotlight-targets.mjs` 执行实际 SFC sampler、target resolver 和 synchronizer，覆盖 RAW time/id、字段保留、20.5→32.5 秒旧灯清退、回退重建、开关、原始 hide、资源缺失计数和释放；既有 native prefab／async textures／Camera reset 回归通过。`npm run build:check` 2,778 modules／11.76 秒，通过、无 public corpus copy。

实际 5198 Browser：S.E.M 2/3/4、005_00，1440×900 32.5 秒为灯 3，unresolved 1/2；画面只剩右侧黄色束，与音频对齐录屏该段的单人聚光一致，中央与重复池消失。390×844 同段 canvas CSS 357×201、backing 714×402，document scrollWidth=clientWidth=390；关闭灯效后回退 13.7 秒全隐藏，打开后恢复 20/21/22 三人粉色聚光。切换 Take 01／02 的 40 秒无 Study 残留（两首原 RAW 没有 Spotlight 指令，此处只验切歌清理）；ANYWHERE 11.4 秒为 1/3 两束白灯，旧 2 未关联并隐藏。console error 空。截图 `spotlight-unbound-before-032.500.png`、`spotlight-unbound-after-032.500.png`、`spotlight-unbound-mobile-032.500.png`、`spotlight-unbound-mobile-off.png`、`spotlight-unbound-mobile-013.700.png`、`spotlight-unbound-anywhere-011.400.png`。窄屏模拟不能代替实体手机；Take 的录屏精确光效、Study 动作相位、call 棒、粒子与自由灯光语义仍未完整验收。

本批代码 `bb35d2ad1219d27bce468b035602a424e4c5a3ce` 的完整 Source Gate 已终态 success，114 个成功步骤、无失败；[run 37076345523](https://github.com/windmet/GS_Archive/actions/runs/37076345523)。新增 target 清退回归与原生双纹理绑定／异步释放在门禁同一步执行。此结论绑定该代码提交；后续文档提交不扩大视觉验收范围。

下一层证据：`study-reference/spotlight-type-contracts.json` 精确记录同一 iOS metadata 的类型契约，确认 `SpotlightBackground` 独立于灯束，持有 `_spriteRenderer`、`_maskSystem`、`_targetAlpha`，提供 showingCount、SetColor、UpdateIfNeeded、Show／Hide／Clear。这说明后续环境压暗／遮罩应从原生背景组件链路继续查，不能用当前角色 tint 近似冒充原生背景遮罩；metadata 不包含可验证的 native 方法体，具体公式仍未证明。

## 2026-10-03：Spotlight 原生背景接线与 Pinspotlight 遮罩边界

继续从实际 Android XAPK 解析 `SpotlightBackground`：resources.assets GameObject 30569、MonoBehaviour 115454（60 B，SHA256 `61c81af21f074073cedab441cad84e4cf29a071668d2191056b342017c1d2c99`）。序列化 PPtr 精确指向 SpriteRenderer 54487 与 SpriteAlphaMaskSystem 109951；MaskedSprite 的 AlphaMaskedSprite 119984 又指向同一系统。Sprite 2064／Texture 573 是 `pinspotlight_back`，128×128 全白不透明；原 Transform scale=(20,20,1)、pivot=(0.5,0.5)、PPU=100、默认 sortingOrder=1900。`_targetAlpha≈0.8` 是 prefab 初值，不替换已解析的编排 environmentOpacity。小型 tracked fixture 与严格导出模型保留上述身份，拒绝错误 PPtr、材质、尺寸、变换和非有限 alpha。stage-effects 索引升级 schema 3，新增 spotlightBackground；12 张原生纹理仍由本地导出，不把整包媒体提交。

同时直接读取原 Material 122 指向的 Shader 970 `Custom/AlphaMaskedSprite`（原始 SHA256 `f3eaafb3e1943b6eec9c36ab2bb63ebfddb1259b54d4a6799ea41f83cdcae1f7`）。实际 GLES3 片段对屏幕遮罩 RGB 做 dot(0.299,0.587,0.114)，乘主纹理与 vertex color alpha，输出预乘 RGB／alpha；native blend 为 One／OneMinusSrcAlpha。原生 Pinspotlight 则有两个同纹理子节点：MaskSprite 用 Sprites/Default，FlashSprite 用 ohashi/SimpleAdd；AlphaMaskSprite 保留 SortingOrderInterval 1000–3000，与背景的专用 mask system 链相关。厂商 [SpriteAlphaMask 文档](https://gcaseres.gitlab.io/unity/documentation/spritealphamask/getting-started/) 也明确区分 AlphaMaskedSprite 与 AlphaMaskSprite、专用材质和相机隐藏 mask layer。完整本地证据为 `study-reference/typed-spotlight-background.json`、`spotlight-background-source-inventory.json` 与 `AlphaMaskedSprite.shader`／对应 typetree；UnityPy 导出的 shader wrapper 只作诊断，未作为可运行 GLSL 发布。mask system 的原始 `ff000000` 未凭字节形状强行解释为 Color32 或枚举。

本轮前端只接线**没有活动 Pinspotlight 遮罩时的 Spotlight 背景**：使用实际白纹理、native 局部 scale 与默认层序，在既有参考校准的舞台／镜头空间绘制正常混合 Sprite。颜色取当前有效编排，退场透明度使用既有 sampler；无状态、关闭灯光、切歌与释放均清理。按指令 time 选取最新环境值，不依赖 Map 的初次插入顺序。原生 Show/Hide 的内部 showingCount、SetSortOrder、相机投影和角色层序公式仍未确定，当前 fade 采样也不是原生方法体复刻。出现 active Pinspotlight 即排除此无孔背景，保留既有 Pinspotlight renderer，防止叠加压暗；**Pinspotlight 的专用孔洞遮罩仍未接入，不能声称本轮复原了 shader／mask system**。角色染色近似没有以背景接线为由改成未知层序。

本地 native background／既有双纹理绑定、实际 SFC seek/hide/toggle、未关联灯清理、共享加载释放、single-layer 迟到加载丢弃以及 `verify:engineering` 均通过。`build:check` 2,779 modules／12.18s，固定 `.analysis/build-check`、copyPublicDir:false。原生资源导出通过；新增 portable 两项回归已并入 Source Gate 的 Spotlight 步骤，尚需确切提交的 CI 终态。

实际 5198 Browser 生产 bundle `ChibiStageViewer-Celd3ZL3.js`：Study S.E.M 2/3/4、005_00，1440×900 的 32.5 秒只见右侧黄束，背景 alpha=0.400；关闭灯光变为 0，再打开／回退到 13.7 秒三束粉光与背景 alpha=0.500。390×844 的 canvas CSS≈357×201，document scrollWidth=clientWidth=390，没有横向溢出。49.4 秒原 hide 结束后 background=0／Spotlight ids 空；4.3 秒 Pinspotlight ids=1,2,3、新背景=0。切 Take01／02 同样背景=0，无 Study 残留；此处仅验清理，不替代两首录屏光效比对。console errors 为空，结束恢复默认视口并保留后续验收 tab。截图 `spotlight-background-032.500.png`、`spotlight-background-off-032.500.png`、`spotlight-background-mobile-013.700.png`。

仍待完整验收：Study 的动作相位、前景 call 棒、粒子、Pinspotlight 原生遮罩、原生背景动态层序与自由灯移动，以及 Take 两半音频精确配准和全曲视觉。窄屏模拟不是实体手机，代码／本地来源检查不是全媒体发布或 master PR 收口。另一个窗口的资料页／审计修改继续保留，本批只提交舞台接线与回归。

本批代码提交 `4bcc37d72d9efa3cbcb75c7192a383838c5032b9` 的完整 [Source Gate 37078486828](https://github.com/windmet/GS_Archive/actions/runs/37078486828) 已终态 success，114 个步骤成功、无失败，包含新增背景 PPtr 与实际 SFC／single-layer 异步释放回归。HTTP 复核 schema 3 与 renderer script 115454，`pinspotlight_back.png` 为 294 B，响应 SHA256 `1391fa34295e4eb7ae8070c7c90f8aa7a06cd1920cabed8c885ee95c4b2f2c14` 与派生索引一致。此 CI 绑定该确切代码提交，后续文档提交不冒充同一 revision 的门禁。

## 2026-10-03：Study 第二验收目标的 Pinspotlight 双层遮罩接线

输入 HEAD `077e3128`。用户指定同目录的 Study 录屏继续作为第二验收目标，复用已核实音频 offset=4.7275s；本轮仅抽取 4.3、4.8、7 秒的 960px 对齐帧，不复制录屏或 public 全库。其他窗口的 UI／翻译审计工作保留，以下只描述舞台改动。

原生 `LiveObjectPinspotlight` script 109188（80 B，SHA256 `1c8d0159da147d6dcaef37a9b3d8bee250b56a1772f2b1d65df3acf18580d6dc`）的三个 PPtr 分别关联 AlphaMaskSprite 129274、MaskSpriteRenderer 54042、FlashSpriteRenderer 52550。Mask 与 Flash 共享 Sprite 2353／Texture 717；pivot=(0.5,0.5)、PPU=100、512px、局部 Transform 单位矩阵、初始黑色 alpha=1。AlphaMaskSprite 原始 52 B 校验后读取 sorting interval=[1000,3000]，包含背景默认 sortingOrder=1900。严格导出新增 schema 4 的 pinspotlight 双层模型与 portable 精确 fixture；数组顺序不决定角色，错误 PPtr／材质／颜色／Transform 拒绝。

Flash 原材质 TransparentAdd 120 指向 `ohashi/SimpleAdd` Shader 1014，原始 SHA256 `dd6c494ec8ac210c877cb204955473956e766bd80c4dd38356a0574f00eaac5d`。实际 GLES3 输出 texture×vertexColor，混合 SrcAlpha／One；没有旧代码额外乘的 0.34。该常量已移除，Flash 使用加亮混合、Mask 单独隐藏为 filter 输入，不直接涂在舞台上。黑色 Mask 在白色 mask RT 上普通混合得到 product(1−maskAlpha)，背景 shader 用其 RGB luminance 乘背景 alpha。本轮 Pixi 用 atlas-aware SpriteMaskFilter 的反 alpha shader 顺序实现此黑色遮罩的等效背景孔洞，filterArea 限制为实际画布；不声称完整移植原生 mask registry／多相机 RT 架构或所有颜色输入的通用等效。

Pin 与 Spotlight 共用一个背景消费者，按既有事件采样选环境状态；所需 mask 未就绪时不发布实心压暗。双层使用同一投影与 alpha，灯光染色开关控制遮罩、光束开关控制 Flash；同灯号换素材按 id:asset 隔离，旧实例隐藏。共享异步纹理 store 按 generation 清退迟到请求，释放前从背景摘除 filters。缺 beamColor 保留 native 初始黑色而非默认白色；**序列化初值不能证明 PlayEffect 对 CSV NULL 字段的内部行为**。保留现有目标地面减 135×fit、scale=0.62／自由 scale=0.7 的参考近似，未用 prefab 的 identity Transform 冒充已解出原生投影。CSV 注释也纠正为不能仅凭 prefab 证明 duration／target 字段语义。

本地通过：native Pin PPtr／污染拒绝、实际 SFC 双层同步／独立开关／同 id 素材切换／hide／释放，background 实际 SFC 的 pending mask、sorting interval、filter detach／画布范围与共享环境回归，既有 Spotlight prefab／target／异步释放，Python 编译与 `npm run verify:engineering`。`npm run build:check` 2,780 modules／14.98s，固定输出 `.analysis/build-check`、不复制 public。两个新 portable verifier 加入 Source Gate；本段尚不声称新提交 CI 终态。

实际 5198 Browser 新生产 bundle：Study、S.E.M 2/3/4、005_00、暂停 4.8s，背景 alpha=0.700，mask count=3（含原始离屏 id1）而屏内两孔，能透出 ABC 布景及台面。1440×900 与 390×844 的孔洞均跟随镜头和缩放；手机模拟 canvas≈357×201、scrollWidth=clientWidth=390。关闭光束后 Flash=0、mask=3／背景=0.700；再关灯光为 mask=0／背景=0。重开、前进到13.7s变 Spotlight 20/21/22、mask=0／背景=0.500，倒退4.8s恢复两孔。Take 01／02 的40s检查无 Study 遮罩残留。这仅是切歌清理，不能代替 Take 两半录屏光效验收。截图保存 `study-reference/pinspotlight-native-004.800.png`、`pinspotlight-native-007.000.png`、`pinspotlight-mobile-004.800.png`；窄屏模拟不是真实设备测试。

对齐录屏差异账本：4.3s 指令边界附近，录屏仍仅左孔，Web 已开始第二孔；4.8s 两边均有左／中孔，右侧暗；7s 录屏右孔照亮 ABC，Web 同区域可透出，但人物动作相位仍不同。参考黑色裤装在 Web 当前005_00编队中呈浅色；直接查看 `costumes/035mco_005_00/cos.png` 可见裤装原纹理本身浅灰，录屏服装身份／原生分部位颜色机制还需确认，不能据此直接认定为 tint 错误。角色比例与孔洞范围仍存在差异，不能把“GPU shader 工作”和“录屏完全复刻”混为一谈。下一步继续查动作／Spine 颜色、原生镜头与投影、call 棒、粒子和全曲灯光；尚不具备全舞台或 master PR 收口结论。

本批确切代码提交 `ea418ca4d754876347dadb6b24dd39cb286de27f` 的完整 [Source Gate 37080592028](https://github.com/windmet/GS_Archive/actions/runs/37080592028) 已终态 success，114 个步骤成功、无失败，包含 Pinspotlight 两项新 portable 回归。期间其他窗口提交 `39ed7770` 的歌曲返回／展开定位修复，保留其成果；上述 CI 仅绑定 ea418ca4，并非对后续 HEAD 的整体验收。Browser console error 空，结束恢复默认视口、保留 Study 验收入口。

## 2026-10-03：Study 衣装颜色差异的原生 shader 来源契约

输入 HEAD `b8edb7bb`，未修改舞台 renderer、服装索引或其它窗口 UI 工作。新增 `audit-chibi-costume-shader.py`，直接加载 RAW costume 与 shared shader bundle，按实际 Material PPtr 解析 external serialized file 和 live Texture；没有从同名 shader 或 atlas 猜测关联。S.E.M 的 `035mco_005_00`、`036rui_005_00`、`037jir_005_00` 三份 `cos_Material` 均指向 shared `CAB-47338db636fbf628b5ec28a3f5a34103` pathID `-677326362337354521`、`Growing/Skeleton-Gradient`。Shader 原始 SHA256 `31b0f000c2a80d9b60dc62bbc44491f2ea7f47c22a08042b166a16e7c2859d47`，每份 bundle、material、texture 身份及原始 SHA 均保存在 fixture／本地 `study-reference/costume-shader-contract.json`。fixture 只投影实际消费字段与一个 GLES3 subprogram，未附带纹理、完整 Shader binary 或视频。

真实 Normal／GLES3／`_BLEND_ALPHA` 顶点程序将 **native local mesh position.xy** 传到 `vs_COLOR1`；不是纹理 UV、screen Y、变形后屏幕包围盒或角色高度百分比。片段先令 `t=clamp(localY * _RcpHeightCutOff,0,1)`，以 t 插值 Src／Dst 的 RGBA；再以 BodyColor.a 将 texture.rgb 替换混合到 BodyColor.rgb×texture.a，最后以 gradient.a 替换混合到 gradient.rgb×texture.a。输出 texture.a 不受这两次颜色替换影响，最后整份 RGBA 乘 vertexColor；native blend 是 One／OneMinusSrcAlpha。它与当前 `multiplyBodyTint` 的 RGB 乘色不同。源码 token digest 锁定此实际 compiled variant，不能将 additive／multiply／outline 变体的公式混用。

三人材质的 `_RcpHeightCutOff=0.5`，显式颜色默认白色 alpha=1。**舞田类没有保存 `_BodyColor` override**，应区分从 Shader property 继承的白色默认，而不是当作缺失色／黑色；工具保留 override 与 inherited default 的来源。CPU 参考测试证明直接套用这些白色 alpha=1 默认会将 atlas 洗成白色；因此 native 初始化／ChangeBodyColor／ChangeFootColor 的运行期 uniform、局部单位／转换、重置与 tween 仍必须解出，本批没有把静态默认值接进 Web。iOS metadata 方法与 uniform id 字段只是线索，不包含可验的方法体。

对照裤装：`035mco_005_00` 实际 live texture 本身有浅灰裤装和白手套，与参考黑裤差异不能直接归为 bodyColor 指令；Study 已解析 bodyColorEvents 为空。另查 `035mco_004_00` 与 `035mco_005_01`：都只有 comu 模型，没有 cos Texture／atlas／Material。此前“RAW 存在而不在舞台选择器”的候选因此**不能认定为 live 衣装漏录**，也未将交流资源误加到舞台。参考录屏的精确衣装身份仍未闭合。

验证：实际五份 RAW bundle 重抽取成功，三份 live material、两份 comu-only 记录；portable fixture 与完整重抽取 JSON 逐项相同。九个手算像素 witness 覆盖部分替换、gradient RGBA 插值、两端 clamp、透明纹理、vertex alpha 与默认洗白；错误 external／texture PPtr、UV 来源、颜色通道、blend／straight-alpha 与重复 material 均拒绝。Python 编译通过，portable verifier 加入 Source Gate；本段尚未声明新提交的 CI 结果。纯独立工具按构建政策不重复 Vite，不产生新的 Browser 或视频画面通过声明。原生 runtime 配色、Study 衣装／动作相位、call 棒／粒子、投影和 Take 两半录屏配准仍待完成，master PR 尚未收口。

复现命令：

```powershell
python -X utf8 scripts/audit-chibi-costume-shader.py --raw-asset-root ../RAW/asset --costume 035mco_005_00 --costume 036rui_005_00 --costume 037jir_005_00 --costume 035mco_004_00 --costume 035mco_005_01 --output .analysis/engineering-validation-20261002/study-reference/costume-shader-contract.json
python -X utf8 scripts/verify-chibi-costume-shader.py .analysis/engineering-validation-20261002/study-reference/costume-shader-contract.json
python -X utf8 scripts/verify-chibi-costume-shader.py
```

后续门禁：代码 `86909ac23246b1efdf71c7b6c0e72d98e965e927` 的完整 [Source Gate 37082087402](https://github.com/windmet/GS_Archive/actions/runs/37082087402) 已终态 success，115 个成功步骤、无失败，包含新增 portable shader 契约。期间其它窗口的卡片 UI／歌曲验收提交 `0b413ef7`、`81707aa1` 保留；此 CI 绑定 86909ac2，而不是后续文档 revision。

进一步定位了现有消费者偏差：`prepare-live-chibi-assets.py` 把 `Livechara_Foot_Color` 输出为 characterLightEvents，`characterLightAt` 再以 opacity／1000 混白并对整个 Spine 设置 tint。实际 Study RAW `steqmg_live_effect`（song bundle SHA256 `c8ac69f6c08f0dcac5dfd397cb4a72e8409927e1e1f5f5ed3bc784121645f1c8`）有 **29 条 Foot_Color、0 条已解析 Body_Color**，首条 time=-2000、color=#221d23、value2=600、value3=1、value4=1250。原始行、TextAsset 身份／SHA、当前派生事件与 metadata 方法 witness 保存 `study-reference/foot-color-mapping-candidate.json`。第19列的 #cc6b8c 属于原表“コメント”，不是第二个运行期颜色参数。结合原生局部高度渐变 shader 与 `ChangeFootColor(color,rate,transitionDuration)` 方法签名，现有“整身乘色”缺少 Foot 渐变维度，不能作为原生等效；但方法体缺失，**value2 是否直接 rate、除1000、如何换算 cutoff／角色高度仍待证明**。暂未把该列强行重命名成高度或套用新的数值公式。下一批应优先闭合 Foot 命令到 runtime uniform，而不是仅从衣装纹理差异推断换装。

## 2026-10-03：Study 录屏衣装核准与动作切换点定位修复

输入 HEAD `b3295fb4`。沿既有 audio offset=4.7275s 复核录屏，并以实际导出纹理、衣装名称和 Browser 换装确认：录屏使用 **チアーズトゥフューチャー／敬向未来**，2号位次郎 `037jir_102_00`、3号位道夫 `035mco_101_00`、4号位类 `036rui_101_00`。同组同名衣装的数字 ID 并不一致，不能全部套用101。此前005_00验收的浅灰裤、白手套、粉色眼镜差异来自选错衣装；换装后的黑裤、裸手、粉色鞋及蓝黄衣尾已与参考对应。**撤回用这组裤装差异推测运行期配色的依据**；Foot_Color整身乘色缺少局部高度维度的独立源码证据仍成立。三份正确衣装 RAW material 再抽取成功，仍精确关联同一 Growing/Skeleton-Gradient shader；来源保存在本地 `study-reference/reference-outfit-shader-contract.json`，没有提交纹理或录屏。

动作比对也需避开错误结论：6.5s录屏与Web都是道夫举手、类向右指，7s是RAW三人 motion23001 的切换边界。旧 `syncSlotAtTime(reset=true)` 只从setup重建最新动作，使暂停定位7s立即跳成双臂平举；连续播放则有既有0.12s骨骼混合。现在定位在混合窗口内时，先重建最近过渡链及其前驱，再依次按原time／speed／mode采样，保留出动作姿态。mode3仍重置，窗口外仍只采样最新事件；不回放全曲、不修改CSV时间、速度或原生未证实的混合公式。每次异步步骤核对intent、runtime和换装loadSequence，取消、卸载或快速切歌不继续安装后续动作。该批修复Web暂停定位与Web连续播放一致性，**并不证明Unity原生混合时长就是0.12s**。

验证：`verify-stage-intent.mjs` 执行实际SFC sampler／playSlotEvent和Spine AnimationState，对比逐帧连续播放，包含不同速度、连续短间隔handoff、mode3、倒退、旧跳变witness以及intent／runtime／换装中断；35项控制时序回归通过。`npm run verify:engineering`通过，`npm run build:check` 2,779 modules／14.81s，固定 `.analysis/build-check`、无public corpus copy。编译包含同工作区其它窗口尚未提交的资料页修改，但本批只提交舞台与自身回归，不将它们计作本批验收。

实际5198生产bundle `ChibiStageViewer-C9ZSZfEW.js`：1280×720，正确S.E.M衣装、3/3就绪，定位7s已保持道夫举手、类向右指；与音频对齐参考7s动作对应。390×844在13.7→7s倒退后仍保留该姿态，canvas CSS≈357×201，document scrollWidth=clientWidth=390。快速Study→Take01→Study期间取消尚在加载的站位，最后Study 3/3就绪、无console error；此处不算Take40s已完成演出或灯光验收。证据 `study-seek-handoff-fixed-007.000.png`、`study-seek-handoff-mobile-007.000.png`，对照 `study-reference-outfits-007.000.png` 与录屏 `song-007.000s.jpg`／`song-006.500s.jpg`。结束恢复默认视口并保留后续验收tab。

同时读到RAW五份 `live_costume_setup_1..5` 的SkeletonDataAsset `scale=0.003333332948386669`（约1/300），TextAsset PPtr可直接读取。这是原生骨架单位线索，不能把当前pixel-space Spine.scale直接设成1/300：原生相机／mesh世界单位到浏览器投影、Foot rate到cutoff仍未闭合，本批未改比例。完整Study还需处理call棒、粒子、投影／灯光范围与全曲动作；Take两半配准和完整门禁／master PR也仍未收口。当前没有全舞台、实体手机或发布通过声明。

补充验收：直接读五种body setup和Study实际motion fragment，以实际SFC方法比较2/3/4号位在7000／7030／7100ms的全部bone x/y/rotation/scale，45组均与逐帧连续播放一致，最大浮点差3.553e−15（`study-reference/seek-native-pose-comparison.json`）；它验证原始动作数据在Web两种采样路径一致，不等于原客户端整曲验收。另按SkeletonDataAsset→TextAsset精确PPtr验证五份导出setup payload与RAW逐字节相等，单位证据保存 `skeleton-native-unit-witness.json`。

本批代码 `bcf1978f` 已推送。包含该代码及其它窗口资料页提交的 HEAD `5f2e5e42e88588f1987b2214a3a0a5ce4fd33845` 完整 [Source Gate 37084267260](https://github.com/windmet/GS_Archive/actions/runs/37084267260) 已终态success，115项成功、无失败，含本轮handoff／倒退／取消回归。后续文档revision不冒充相同HEAD门禁。
