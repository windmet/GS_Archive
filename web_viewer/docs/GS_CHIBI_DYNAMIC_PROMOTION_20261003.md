# 舞台灯与动态地面逐曲推广

2026-10-03，输入 HEAD `a3e4fdbe`，工作分支 `codex/chibi-stage-reconstruction-20261002`。本批接续 Take 地灯、星灯与地板；同工作区其它窗口的 UI、翻译审计改动保留。

## 范围与实际覆盖

全库按真实资源绑定遍历，不能将 Take 的纹理、颜色、遮罩或灯数套用到其它歌曲。

| 来源范围 | 结果 | 含义 |
| --- | --- | --- |
| 118 个歌曲编排 | 全部生成逐曲覆盖记录 | 来源清点，不是 118 首 Browser 或录屏验收 |
| 419 个独立固定灯预制体名称 | 414 个可生成绘制描述，3293 个有序 Sprite 绑定 | 保留图集矩形、平面旋转、翻转、排序、原生初始 RGB/alpha；不等于全部指令模式复刻 |
| 30 个 RAW Stagelight 曲目轨道 | 全部登记命令、源行与缺口 | 支持已接入的 alpha/color 模式；空模式的不同指令版本及颜色模式 3/4/6/7 等仍待解析 |
| 49 个粒子 panel 候选对象 | 7 个接线，42 个明确 deferred | 本批新增 6 个独立对象，不替换未支持对象为假静态地板 |
| 135 个带粒子对象、992 个 ParticleSystem | 已读取完整模块树 | 是粒子总资源调查；49 个 panel 是其中本批分类子集 |

五个不能生成固定灯描述的资源：`fx_in_itowks_stagelight_1/2` 有同名实例，尚需精确 director PPtr；`fx_in_infoct_stagelight_1/2/3` 不满足当前 Sprite/material 绘制合同。未知命令不生成白色常亮替代灯，也不让旧灯状态持续到未知模式之后。

七个动态地面对象：

| 对象 | 曲目 | 本轮状态 |
| --- | --- | --- |
| fx_in_tkstp1_panel_1 | Take a StuMp! 01 / 02 | 保留既有 244 Sprite 参考预览及严格源校验 |
| fx_in_cgtocc_panel_3 | Change to Chance | 独立遮罩；原生预热 1 秒、容量 200 |
| fx_in_mtples_panel_1 | Multiple Entertainment Show! | 独立遮罩与容量 150 |
| fx_in_ometny_panel | 想いはETERNITY | 三个原生 emitter、容量 165；含大尺寸渐变云层 |
| fx_in_trhorz_panel_1 | True Horizon | 三个原生 emitter、容量 165 |
| fx_in_unmikn_panel_1 / 2 | 運命光年 | 两个独立对象、分别容量 286 / 175；不同原生遮罩 |

通用 profile 限于持续发射、零速度、原生世界坐标遮罩的 box 粒子，保留各自出生颜色、生命周期 RGB/alpha、尺寸/旋转曲线、固定图集帧、预热与容量。全部 emitter 同时满足合同才接线，不静默丢弃同一对象中复杂的 emitter。其余 42 个对象的首个拒绝原因：非 box/3D shape 15、非持续发射 12、velocity/noise/clamping 8、renderer/system 3、移动速度 3、shape-local transform 1。首个原因不是对象全部缺口的穷尽列表。

随机 seed、三维投影、Unity Noise 与原生 Tween 方法体未闭合。当前是原生输入驱动的二维预览；原生等效、逐帧整曲与实体手机验收均未完成。

## 实现与可复现输出

`prepare-live-chibi-stage-effects.py` 导出 schema 6 灯光索引，使用自定义 renderer 数组顺序而非子节点顺序。图集使用原完整纹理与 Unity rect 到 PNG y-down 的转换，避免裁切后改变透明边距。新增平面旋转、flip、初始 tint，纹理 wrapper 独立释放，不销毁共享 baseTexture。

`prepare-live-chibi-floor-catalog.py` 导出 schema 2 多对象目录；每个 mask 由原生 masker 的 mainTex PPtr、尺寸与世界变换确认。原 Take 描述与重新读取来源逐字段相等后才复用。consumer 使用共享演出时钟、固定 Sprite 池，暂停与向后定位确定性重算；这不是原 Unity 自动随机种子。

```powershell
python scripts/audit-live-chibi-stage-objects.py --all-indexed-particles --include-module-data --dependency shaders_and_materials.unity3d --output .analysis/engineering-validation-20261002/chibi-stage-objects-all-modules.json
python scripts/prepare-live-chibi-stage-effects.py
python scripts/prepare-live-chibi-floor-catalog.py --report .analysis/engineering-validation-20261002/chibi-floor-catalog-report.json
node scripts/audit-chibi-dynamic-coverage.mjs --output .analysis/engineering-validation-20261002/all-song-dynamic-coverage.json
```

生成资源位于已忽略的 `public/assets/live-chibi/stage-effects/` 和 `floor-particles/`。本批导出灯光范围共 60 张 stage-effects 原生纹理，不复制全语料或参考视频。逐曲报告记录各输入索引 SHA、已支持/未解析灯光、原生 floor profile 与尚未实现粒子对象；状态明确为 `source_inventory_not_visual_acceptance`。小型源 fixture 入库，PNG 与 9MB 灯光索引不入库。

## 验证结果

通过 Python floor/source 与 lamp/prefab 检查、Node published-assets floor 与 stagelight 回归。覆盖原生数组重排、PPtr/材质/packing 损坏拒绝、原图集坐标、平面旋转、原生 opacity、各自 mask、预热、RGB/alpha 梯度、容量、回退重现、迟到纹理与失败加载释放。未支持 shape、burst、移动速度、noise、随机图集不会进入通用 profile。既有粒子、舞台坐标与 118 编排 VFX 覆盖检查通过；后者仍标记 111 个 partial，不作全曲通过声明。

`npm run build:check`：2781 modules / 17.25s，固定 `.analysis/build-check`，`copyPublicDir:false`，没有完整媒体打包。5198 PID 62924 的既有映射服务提供该生产 bundle，并映射本地 public 与外部 readmodels，未启动第二服务。

实际 Browser 1280×720：ETERNITY 5000→5300ms 地面出生/透明度/尺寸持续更新，播放后再向后定位恢复确定状态；Change to Chance 的预热地面和運命光年的两个独立地面均可见；ANYWHERE 26100ms 使用原图集灯，当前色 `#008e74`，高级栏保留 67 条未解析命令。最终构建 reload 后复核 ETERNITY、ANYWHERE、Take02 22400ms，Take 原灯与四组地面仍接线，无 console error。390×844 最终画布约357×201，document scrollWidth=clientWidth=390；结束恢复默认视口。它是 Browser 响应式模拟，不能写成实体设备通过。

小型截图保留在 `.analysis/engineering-validation-20261002/take-reference/`：`expansion-final-eternity.png`、`expansion-final-anywhere.png`、`expansion-final-take02.png`、`expansion-final-mobile.png`。本批两组 on/off 截图因控件滚动/画布采样位置变化，**不能用于声称隔离像素差分**；未采纳这些差分数字，也不替换前一批有效 Take 遮罩验收。

## 下一批

### K.now O.nly 前沿火焰补录

输入 HEAD `dd65541b`。`fx_in_knwonl_panel` 的两个一秒循环 burst 使用原生 4×2 火焰图集、世界坐标 AlphaTex 遮罩、0 / 100ms 启动延迟与普通透明混合（源 shader SrcAlpha / OneMinusSrcAlpha）。不是将整面地板染成橙色，也没有复制 ANYWHERE 的同名纹理。第三个 emitter 带移动速度及 Noise，仍 deferred；此对象明确标为部分实现。目录当前为 49 个候选、7 个完整地面 profile、1 个部分火焰 profile、41 个未接线对象。

Python 原始模块 fixture、Node 原图集帧/透明混合/暂停回退/资源释放回归通过；`python -S scripts/verify-chibi-floor.py` 同样通过。CI 首次运行暴露纯 fixture 校验过早导入 UnityPy，已将 bundle 提取依赖延后到实际提取函数；本地原始 bundle 重新导出成功。此前失败运行 `37095031556` 不能记作通过。

`build:check` 2782 modules / 13.26s，无 public 复制。5198 既有映射服务加载最终 bundle；Browser 1280×720 的完整舞台视图可见贴合前沿的四段火焰带。390×844 画布约357×201，页面宽390无横向溢出，火焰仍在前沿；是模拟窄屏验收。截图 `take-reference/knwonl-fire-final-desktop.png`、`knwonl-fire-final-mobile.png`。噪声火星、三维投影及整曲录屏等效尚未验收。

用户另补 Take 结尾的上方光源及纵轴旋转315标志参考。[通用层审计](GS_CHIBI_COMMON_LAYER_AUDIT_20261003.md)已定位原生光束Sprite、背屏RotateSprite与streamed旋转clip，并清点118编排的原始指令族。第二批已有NewSuspensionlight基础显示消费者，Take01/02结尾通过Browser验证；其它控制与旋转标志仍有缺口，不能把有背景视频视作标志已接入。98c2c788的GitHub门禁37096017872通过，仅涵盖此前已实现批次。

Study Equal Magic! 使用 `Suspensionlight` 多个系列与 `fx_in_steqmg_overlight_1/2/3`、共享入射光粒子，而非本批的固定 Stagelight/box panel 模式。Take 上方打光则还有大量 `NewSuspensionlight_*` 与 `Searchlight_*` 新指令。它们是独立消费者缺口，不能按当前注册数视作完成。

继续按当前41个未接线floor对象及K.now O.nly剩余Noise emitter的真实模块分组，以及Suspensionlight/新director指令逐类实现；已有Take地灯的用户确认只适用于该部分。资源上传/生产发布、全曲录屏核对、Study第二目标及最终master PR尚未收口。
