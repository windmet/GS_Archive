# 舞台小人多人舞台：新窗口开发交接（2026-07-16）

## 当前可用基线

- 入口：`http://127.0.0.1:5173/?view=chibi_stage`。
- 主要运行时：`src/components/ChibiStageViewer.vue`、`src/utils/liveChibiSpine.js`。
- 数据入口：`public/assets/live-chibi/manifest.json`、`choreography/index.json` 及各类离线生成索引。
- 构建验证：`npm run smoke`。
- 资源重建命令：`npm run chibi:audio`、`chibi:backmonitor`、`chibi:image-layers`、`chibi:stage-backgrounds`、`chibi:object-layers`、`chibi:stage-effects`。

当前页面是整宽 16:9 舞台，控制台位于画布下方。调试开关可独立启停静态舞台、背景屏幕、图片布景、舞台物件、灯光染色、光束灯效、人物、阴影和歌词。关闭 CSV 镜头后可用“整体视图缩放”在 `0.50×–1.50×` 间校准总览；该倍率作用于完整 camera container。“环境缩放”只作用于舞台、屏幕和环境图层，两者不可混用。

人物统一基线已恢复为 `height × 0.82`。CSV Y 只通过 `(180 - y) × viewportScale` 表达前后错落，不能再用修改基线的方式补偿舞台大小。人物阴影、Spotlight 光池和绑定人物的 Pinspotlight 已同步使用该基线。

## 已接入且可继续使用

### Spine、服装与动作

- 49 名角色、五种 body type、549 套服装；五套 setup skeleton 与角色服装 atlas/texture 运行时拼装。
- 1,403 个正式歌曲 motion 在五种体型上完整覆盖，共 7,015 个歌曲动作文件；通用动作和歌曲动作均按需载入。
- attachment 字符串表、optional attachment 残留、异步动作竞态、linked mesh 透明占位、角色身高校准及 `dress/skirt/kimono/...` 专属 skin 自动组合已修复。
- 动作切换复用同一 Spine 实例，骨骼混合约 `0.12s`；位置事件另有 `350ms` 平滑插值。

### 歌曲编排与人物驱动

- 118 份有效歌曲编排、21,860 条 `Livechara_motion` 事件。
- 一至五人站位规则：solo 使用 3 号位，三人曲使用 2/3/4 号位；每个站位共享歌曲时钟但拥有独立动作轨道。
- CSV 相机、演唱者切换、角色位置/比例、动作 speed/pause、歌曲音频与 `adxlip_for_live` 口型曲线已接入。
- 人物灯光 tint、目标人物提亮、非目标人物压暗和人物地面阴影已接入。

### 舞台与二维演出层

- Backmonitor 视频、转场 alpha、舞台镂空遮罩关系已接入；统一使用经像素拟合确认的 Y 原点。
- 55 首歌的常驻静态舞台底图、CSV `Image_layer`、纯 SpriteRenderer `Object_layer` 已接入。
- 歌词、全屏颜色、角色颜色、图层深度排序及调试开关已接入。
- Spotlight 时间轴已接入；Laserlight 九组 prefab 子束组合、反向 X/角度与扫描参数已做可用近似。
- Pinspotlight 已接入客户端原始纹理、自由/绑定人物两种状态、环境压暗、目标人物提亮，并修复快速拖动造成的孤儿 Sprite。

## 已接入但仍是近似实现

这些模块不是“没有数据”，而是网页端尚未完整复刻 Unity prefab、材质或 shader；新窗口不应把它们误判为已完成。

1. **Spotlight**：当前使用 Pixi 程序化锥形光束与椭圆光池。时间、目标、颜色、透明度和 depth 可用，但形状、柔边、光晕叠加、多束交叉与官方 shader 仍需逐帧校准。
2. **Laserlight**：已按 `LiveObjectLaserlight` 的九组 prefab 恢复子束数量和基础角度，扫描周期也已消费；束宽、衰减、噪声、顶部灯具旋转中心和 additive 材质仍是近似。
3. **Pinspotlight**：原始前后纹理和五种歌曲专用遮罩已导出，绑定 performer slot 的语义已确认；自由遮罩的缩放/锚点、环境色混合强度和部分歌曲专用 mask 的时序仍需官方录像复核。
4. **CSV 镜头**：位置、缩放、旋转、目标站位和补间已运行，但 Unity Camera 的视口、透视/正交参数、裁切和 easing 未完全复刻。“整体视图缩放”仅是调试乘数，不能写回 CSV。
5. **Backmonitor 转场**：已能播放主视频和 alpha 转场，但复杂过渡材质、遮罩动画、颜色空间和 Unity 混合模式尚未逐种验证。
6. **动作衔接**：Spine 骨骼混合可消除硬切，位置也会插值；是否存在歌曲/动作组专用 mix duration、曲线或事件仍未从客户端脚本完整确认。

## 完全未接入或只完成数据识别

### P0：直接影响多数歌曲的舞台还原

1. **ParticleSystem 类 `Object_layer`**
   - 全库 185 个 Object 资产中，46 个纯 SpriteRenderer 已支持；约 35 个是真实 ParticleSystem prefab，累计约 992 个粒子系统，当前只列入 `data-object-layer-unsupported`，不会渲染。
   - 需要读取并映射 emission、shape、velocity、size/color over lifetime、rotation、texture sheet animation、renderer material、sorting、additive/alpha blend。
   - 不要导出首帧 PNG 代替粒子；这会丢失寿命、速度、循环和材质动画。

2. **Suspensionlight**
   - CSV 命令存在，但索引 schema 和 Pixi runtime 尚未接入。
   - 需要先定位客户端 `LiveObjectSuspensionlight`/相关 prefab，确认灯号、位置、旋转、颜色、强度、补间、显隐和 depth，再决定复用 Laserlight 绘制器还是建立独立 renderer。

3. **Penlight / 观众席荧光棒**
   - 时间轴、观众分区、颜色变化、波浪/节奏动画和渲染层均未接入。
   - 官方画面底部的发光观众层是构图的重要组成，建议独立为 camera container 内的前景层，并提供单独调试开关。

### P1：画面精度与跨歌曲兼容

4. **Unity 材质与 shader 等价层**
   - 粒子噪声、软边、UV 动画、颜色空间、屏幕/加法混合、遮罩和多 pass 尚未形成统一材质适配器。
   - 建议先从 Study Equal Magic!、Legacy of Spirit 各选一个最明显的效果建立小型材质映射表，不要直接追求全 shader 翻译。

5. **全库逐曲视觉回归**
   - 目前重点核对过 DRIVE A LIVE、Legacy of Spirit、Study Equal Magic!；118 份编排尚未逐曲检查舞台底图、Backmonitor 镂空、角色落脚、景深、歌词、灯色和未支持对象数量。
   - 建议做自动诊断页：每首歌记录首帧/代表时间点、unsupported object、缺失视频/音频/纹理、异常坐标和控制台错误。

6. **逐曲环境标定**
   - `environmentScale = 1.073` 与 Backmonitor Y 原点来自全库像素拟合，是当前全局基线；少数舞台可能仍需要来自 prefab 的相机/Canvas/RectTransform 参数，而不是歌曲硬编码补丁。
   - 任何修正必须先区分：整体 camera、环境素材、人物基线、单个资源 pivot 四个层级。

### P2：产品化方向，尚未开始

7. **桌宠模式**：透明窗口、点击穿透、拖拽、待机/互动状态机、低功耗渲染、窗口边界和系统托盘均未实现。现有 Spine/动作/口型可复用，但舞台编排代码不应直接耦合到桌宠窗口。
8. **舞台编辑/导出**：自定义编队保存、时间轴编辑、截图/视频导出、音画离线渲染尚未实现。
9. **USM movie 资料库**：3DMV、SSR 演出、公告等加密 `.usm` 的索引、解密/转码和网页播放器未接入当前舞台模块；已知 HCA KEY 线索应另开数据管线，不与 Backmonitor 混在一起。

## 新窗口推荐执行顺序

1. 先在关闭 CSV 镜头、整体视图 `1.00×`、环境 `1.073×` 下复核 Study Equal Magic! 三人脚底与平台；若仍有偏差，优先查原始 position/prefab/pivot，不再调整全局 `0.82` 基线。
2. 扩展 choreography 索引以保留 Suspensionlight 与 Penlight 原始列，先输出数据统计和代表事件，不急于渲染。
3. 实现 Suspensionlight 的最小可见版本，并加入独立图层开关与 `data-*` 诊断。
4. 选一个 ParticleSystem 代表资产，完整还原单个 prefab 的生命周期，再推广到批量映射；避免一次性写泛化但无法对照的粒子引擎。
5. 最后补 Penlight 前景和全库逐曲回归工具。

## 验证与提交约束

- 每批代码先执行 `git diff --check` 和 `npm run smoke`。
- 浏览器至少验证：CSV 镜头开/关、整体缩放 `0.80×/1.00×/1.20×`、时间轴快速跳转、图层开关、歌曲切换后旧灯效是否清除。
- 代码、生成脚本、文档分批提交；`notes/stage-chibi-lab-concept.png` 已作为产品方向概念基线纳入版本库，但它不代表当前运行时完成度，视觉实现仍以本文件的已完成/近似/未接入清单为准。
- 资源构建产物体积很大，继续遵循现有 Git 忽略规则，只提交索引/生成逻辑需要的源码与文档。
