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
