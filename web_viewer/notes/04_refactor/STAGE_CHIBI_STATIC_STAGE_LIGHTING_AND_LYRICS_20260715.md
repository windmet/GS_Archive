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

Legacy 常驻舞台 RGBA 中存在两个不接触画布边界的透明连通区，源图坐标框分别约为 `(754,285)-(964,453)`（211×169）和 `(967,247)-(1095,354)`（129×108）。CSV 的 Backmonitor 初始参数为 `x=0, y=420, scale=900`，所以视频位置并非网页硬编码，也不应给 Legacy 单独写死偏移。舞台纹理从错误的 `2/3` 缩放恢复为源像素尺度后，需要重新确认 CSV Y 原点；当前层级正确，但视频框与两个镂空的最终像素标定仍列为后续校准项。

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

## 尚未完成

完整 Live 仍需实现 `Object_layer`、Spotlight、Laserlight、Pinspotlight、Suspensionlight 和 Penlight。`Object_layer` 中有大量真实 Unity ParticleSystem、SpriteRenderer 和自定义分组，不能把所有对象伪装成静态 PNG；后续应先按 prefab 类型建立可复刻/可近似/暂缺三类清单，再逐类接入 Pixi。
