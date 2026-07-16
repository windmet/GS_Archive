# 舞台小人：静态舞台、灯光与歌词（2026-07-15）

## 本轮结论

歌曲 bundle 中没有被 `Image_layer` 动态引用的 `stage_<songCode>_<number>` 纹理，并不是废弃图片，而是 Unity 场景启动时常驻的舞台底图。Legacy of Spirit 的 `stage_lgcosr_01..03` 依次组成地板、钟表面板和大型齿轮背景；`stage_lgcosr_04` 仍由 CSV 以深度 1550 动态显示为圆台前景。

`scripts/prepare-live-chibi-stage-backgrounds.py` 会扫描全部 `song_*.unity3d`，排除 CSV 已引用的动态图片，按数字后缀顺序合成常驻 RGBA 舞台。输出位于 `public/assets/live-chibi/stage-backgrounds`。本轮共生成 55 首歌的底图，合计 90,760,580 bytes；另外 5 首歌的数字舞台层全部由 CSV 动态控制，因此不重复生成常驻底图。

运行命令：

```powershell
npm run chibi:stage-backgrounds
```

## Backmonitor 与镂空

Backmonitor 不是覆盖在舞台齿轮前的一整块矩形。正确的 Pixi 层级为：

1. Backmonitor 主视频与 alpha 转场；
2. 常驻静态舞台合成图；
3. CSV `Image_layer` 动态舞台层；
4. 角色及其余按 depth 排序的演出层。

Legacy 常驻舞台 RGBA 中存在两个不接触画布边界的透明连通区，源图坐标框分别约为 `(754,285)-(964,453)`（211×169）和 `(967,247)-(1095,354)`（129×108）。CSV 的 Backmonitor 初始参数为 `x=0, y=420, scale=900`，所以视频位置并非网页硬编码，也不应给 Legacy 单独写死偏移。

2026-07-16 对 54 首具有内部透明连通区且开场启用 Backmonitor 的舞台做了全库像素拟合。错误的 `Y origin = 360` 只覆盖 56.91% 的内部透明像素，完整覆盖舞台数为 0；候选原点在 `250` 达到最高总覆盖率 97.05%，34 首达到 98% 以上。Legacy 透明区中心单独反推约为 237，DRIVE A LIVE 约为 247，与全局 250 一致。因此运行时新增 `BACKMONITOR_Y_ORIGIN = 250`，所有背景视频统一上移 110 个舞台坐标，不再按歌曲打补丁。

运行时已把 Backmonitor container 放到静态舞台之后，由舞台 RGBA 自然充当遮罩。视频、舞台、人物和灯光仍共同位于 camera container，CSV 镜头缩放、平移和旋转不会破坏相对坐标。

## 灯光与歌词

编排索引升级为 schema 8，并新增：

- `lyricEvents`：时间、文本和显示时长；
- `wholeScreenColorEvents`：全屏颜色、透明度、补间时长、深度和隐藏指令；
- `characterLightEvents`：角色综合色、强度、补间时长和深度。

全库统计为 2,787 条歌词、1,273 条全屏颜色和 2,161 条角色灯光。角色颜色按白色到事件颜色的强度混合后写入 Spine tint；全屏颜色使用 1900×1060 Pixi Graphics，并按 CSV depth 与其他舞台对象交错。颜色变化按事件 duration 线性补间，隐藏事件会淡出至透明。

Legacy 在 27,600 ms 命中首句 `冴えない気分になってくんじゃ`，同时命中 `#221d23 / 600‰` 全屏颜色与角色灯光。歌词显示在舞台底部，但上移避开开发用站位轨道和播放控制条。文字描边改用 `-webkit-text-stroke` 与 `paint-order: stroke fill`，替代四方向位移阴影，避免日文曲线和斜线边缘出现破碎锯齿。

## 画面标定

以用户提供的 Legacy 存档约 10 秒画面为基准：

- 整体镜头仍使用 `STAGE_BASE_ZOOM = 1.10`；1900×1060 静态舞台与 Image layer 改按源像素尺度映射（`STAGE_TEXTURE_SCALE = 1`），让 overscan 自然裁出画面，恢复官方截图中左右齿轮被画框裁切、圆台横向铺满的构图；
- 人物脚底基线由画布高度 `0.82` 调整为 `0.66`，三名角色落在圆台表面/前缘，不再站到台座下方；
- 基础倍率施加在整个 camera container，而不是只放大背景，保证 Backmonitor 镂空、人物、Image layer 和灯光坐标保持一致；
- 10,000 ms 验证 `cyber_02_2` 视频位于镂空之后；17,000 ms 在全屏遮色隐藏时验证明场和台面接触；27,600 ms 验证歌词、暗场与角色 tint。

## 人物纵深与地面阴影

`Livechara_position` / motion 事件中的 Y 是舞台景深，不是从上向下增长的 DOM 坐标。Legacy 初始中心演员为 `y=170`，左右演员为 `y=190`；官方录像首帧也显示中心脚底更低、更靠前。因此运行时改为 `screenY = base + (180 - y) × viewportScale`，并用 `(360 - y)` 生成 zIndex。宽屏回归中中心位脚底比两侧低约 10–14 个显示像素，符合 20 个源坐标差经镜头缩放后的结果。

五套 setup skeleton 均有第 0 号 `tex_chara_shadow` slot，但 setup attachment 为 null；部分服装 atlas 含同名 241×241 半透明原始纹理。这说明阴影资源存在，只是由游戏运行时另行装配。`scripts/prepare-live-chibi-assets.py` 现在从冬马默认服装图集导出共享 `shared/character-shadow.png`，多人舞台为每个角色创建独立阴影 Sprite，跟随人物 X/Y、缩放、显隐与 zIndex。源纹理最高 alpha 仅 128，因此运行时不再二次降低透明度，并压扁为脚底横向椭圆。

## Object_layer SpriteRenderer（2026-07-16）

全库 4,795 条 `Object_layer` 指令引用 185 个对象：181 个能在 RAW bundle 中定位，4 个缺失；其中 46 个为纯 SpriteRenderer、135 个为真实 ParticleSystem，共 423 个 Sprite 实例和 992 个粒子系统。编排索引升级为 schema 9，并保留每条对象事件的 `time / asset / duration / x / y / scale / depth / hide`。

多人舞台现已支持 46 个纯 SpriteRenderer 对象：离线索引保存每个 Sprite 的原始 pivot、PPU、Transform、tint、alpha、sortingOrder 和材质混合模式；运行时按 CSV 根坐标和 depth 创建 Pixi Container，并消费显示/隐藏 duration 做透明度补间。Legacy 的 `fx_in_lgcosr_overlight` 由 8 个 additive Sprite 组成，在 11,400 ms、27,600 ms 等时间点按原始脚本显隐。ParticleSystem 对象会列入 `data-object-layer-unsupported` 诊断，不会被错误降级成静态 PNG。

## 尚未完成

完整 Live 仍需实现 ParticleSystem 类 `Object_layer`、Spotlight、Laserlight、Pinspotlight、Suspensionlight 和 Penlight。ParticleSystem 不能只导出首帧贴图；后续需要读取 prefab 的 emission、shape、velocity、size/color over lifetime、TextureSheetAnimation、材质和混合模式，再决定哪些能在 Pixi 粒子容器中等价复刻。

## Spotlight 时间轴与人物深度带（2026-07-16）

编排索引升级为 schema 10，完整保留 2,338 条 `Spotlight`、7,146 条 `Pinspotlight` 和 2,066 条 `Laserlight`。其中 Spotlight 已确认并使用灯号、目标演员、自由 X、补间/淡出时长、光束色、环境色/强度和 depth；Pinspotlight 的未证实 prefab 控制字段暂以 `parameter4/parameter6` 原样保留，避免错误命名；Laserlight 保存样式、扫动周期、初始角、方向、长度、根坐标、颜色、宽度和 depth。

Study Equal Magic! 的 96,400 ms 事件用 `#EE7800` 聚光灯指向 performer slot 2，映射为舞台 2 号位。浏览器回归显示灯号 10 正确落在左侧后排平台，并单独提亮目标角色。光锥使用柔边 alpha 纹理与 additive 混合，淡出服从 CSV duration；角色本身只做不透明 tint 提亮，避免把 Spine 变成半透明。

本次也修正了人物与舞台对象共用错误 z 公式的问题。全库动态对象常用 depth 为 1500–1850，明确前景对象则达到 2200–2400；旧公式 `(360-y)*10` 会把 Study Equal Magic! 的后排演员算到 900/1300，导致 depth 1500 的 `fx_in_steqmg_overlight_2/3` 直接切过身体。人物现在位于约 2000 的独立深度带，仅以 `(360-y)*0.5` 在演员之间排序；因此 1500 的 overlight 和 1800 的 Spotlight 位于人物后方，2200 以上的真实前景仍可遮挡人物。

舞台放大不再修改整台相机。`STAGE_BASE_ZOOM` 保持 1.10，静态舞台、Backmonitor、Image layer 与固定 Object layer 共同使用 `STAGE_TEXTURE_SCALE = 1.073`；这样平台和布景扩大约 7.3%，但人物继续保持官方全身构图，屏幕视频与舞台镂空仍处在同一环境坐标系。

尚未完成的灯光部分缩小为 Pinspotlight prefab 几何、Laserlight 扫动、Suspensionlight、Penlight，以及 ParticleSystem 类 Object_layer；Spotlight 的环境色叠加和多束交叉还需继续对照更多歌曲。
