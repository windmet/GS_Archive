# Take 结尾暴露的通用灯光与背屏缺口

2026-10-03，首批输入 HEAD `98c2c788`，分支 `codex/chibi-stage-reconstruction-20261002`。下文先保留该批来源审计；第二批接线与验收结果见文末。新悬灯已有基础消费者，旋转标志仍未接入。

## 结论

用户指出的两处确实缺少消费者。当前固定 `Stagelight`、人物染色、已有聚光预览、动态地面与背屏视频，不能代表原生演出灯光和背屏组件树已经完整接入。上方光束与315标志是两条独立控制链；它们也不是由同一张缺失的背景图片承载。

## 精确 RAW 指令清点

以当前 choreography 索引登记的118个编排为范围，读取对应 RAW bundle 的同名 TextAsset。每条记录保留 bundle SHA、CAB、pathId、TextAsset SHA、精确指令名称、源文件首末行、全部 Backmonitor 原行。统计按编排计数；以下集合重叠，不能将涉及编排数相加。

| 指令族 | 指令行 | 涉及编排 | 当前缺口 |
| --- | ---: | ---: | --- |
| Suspensionlight 及下划线后缀 | 88647 | 105 | 旧版悬灯未进入 choreography 消费者 |
| NewSuspensionlight 及下划线后缀 | 60358 | 19 | 创建、显示、渐变、颜色、旋转等新悬灯控制未接入 |
| Searchlight 及下划线后缀 | 10583 | 23 | 显示、渐变、椭圆运动、旋转及缩放未接入 |
| Backmonitor 的 raw value6=1 | 66 | 44 | 原字段被解析为整块视频的 rotation，独立 logo 未接入 |

Backmonitor共932行，value6只出现 `0`（866行）和 `1`（66行）。统计本身不证明字段语义；最后一行的误命名应在原生 `PlayMovie` 参数解释闭合后改正。审计同时记录 Penlight族6697行/118编排，仅用于完整性清点，本批不展开荧光棒复刻。

Take01/02分别含2845/2850条 NewSuspensionlight、各264条 Searchlight。Study Equal Magic! 含1277条旧 Suspensionlight；K.now O.nly含1950条旧 Suspensionlight。这解释了为什么推广地灯和地板之后，上方打光仍然会缺失。

## Take 上方光束

Android 2.6.10 本体 `assets/bin/Data/data.unity3d` 内 `resources.assets`：

| 原生对象 | 绑定 |
| --- | --- |
| LiveObjectNewSuspensionLight | GameObject31745 → MonoBehaviour126439 |
| RotateBase / LightSprite | GameObject23335 / 18137；SpriteRenderer55421 |
| 光束 | Sprite2580 `new_suspension_light_sample` → Texture834；1024×1024，PPU100，pivot=(0.5,1) |
| 材质 | Material120 `TransparentAdd` → Shader1014；是原生加法光束材质 |
| LiveObjectSearchLight | GameObject31739 → MonoBehaviour129244；独立 LightSprite55420 |

Take两版在108350ms创建末尾五束光：ID10047/10049/10051/10053/10055，x=0/-210/210/-400/400，y=1300，色 `#ffff96`，深度1650，资源 `new_suspension_light_sample`。同刻有 normal_show，原字段包含2000/3650/3000ms时段。这里保留原参数；尚不将所有字段、重复次数或原生 Tween 曲线宣称为解码完成。

iOS v27 metadata证实 `LiveObjectNewSuspensionLight` 存在 Create、NormalShow、BeatShow、ColorAnim、RotateAnim、ScaleAnim、Fade、EraseEffect以及独立fade/rotate/scale序列；SearchLight另有OvalMove。这些是可持续、可移动的对象实例，不应只随当前演唱者画一个常亮白三角。

## 315标志的真实链路

实际读取的 `live_backmonitor_movie_trhorz_01` 约8秒视频，采样整圈为星云，没有内嵌315标志。正确组件来自背屏预制体，不是其它UI中的同名315Logo。

```text
LiveObjectBackmonitor (GO23467 / MonoBehaviour135504)
  Base (GO7269 / RectTransform104573)
    BackSprite / NoiseSprite / GrowSprite
    RotateSprite (GO30563 / Transform44407)
      RotateSprite脚本132450
        _sprite → Sprite1832 live_backmonitor_movie_logo_m → Texture463
        _refMaterial → Material104 RotateSprite
        _rotateAngle / _perspectiveAngle
      Animator46232 → Controller1275 RotateSpriteAnimator
        Clip1077 RotateSpriteAnim
```

Sprite1832纹理尺寸1200×800，PPU100，pivot=(0.5,0.5)。RotateSprite局部scale=(0.35,0.35,1)，序列化perspectiveAngle=10。脚本有CreateMeshFromSprite、CalcAngles、CalcRotatedMeshCenter、Rotate、OnDidApplyAnimationProperties，说明它是独立网格旋转，不能拿整块星云视频的平面rotation冒充。

Clip1077为2秒循环。旧版floatCurves数组为空，但streamedClip含一条曲线，0秒value0、slope180，2秒value360；binding指向RotateSprite脚本，attribute1172992736，等于CRC32(`_rotateAngle`)。只检查旧曲线数组会漏掉这段原生动画。原生透视网格算法、正反面材质、启用时的相位和PlayMovie字段解释仍待方法体及录屏核对。

Take两版95850ms的Backmonitor源行均为：

```csv
Backmonitor,95850,live_backmonitor_movie_trhorz_01,,-7,340,920,1,
```

当前 `prepare-live-chibi-assets.py` 把CSV索引7（value6）写成rotation；`ChibiStageViewer.vue` 将其作为1度视频平面旋转。此字段只有0/1，原生背屏确有logo组件，且与用户录屏标志出现的时段相符，**推断它与logo启用有关**。本批没有把这条推断升级为已证明的参数合同，也没有批量改写未知字段。

## 验证与产物

```powershell
python -S scripts/verify-chibi-stage-command-census.py
python scripts/audit-live-chibi-stage-command-coverage.py --output .analysis/engineering-validation-20261002/chibi-stage-command-coverage.json
```

纯stdlib回归通过：后缀族完整计数、相似非族名称不误计、源行顺序保持、原行不修改、空/缺失字段区分、未知后缀仍列入审计。实际118编排重新提取成功。本批只有独立Python审计工具及文档，未机械执行Vite构建。

本地证据在 `.analysis/engineering-validation-20261002/take-reference/`：`ending-native-complete.json`（含RectTransform子树）、`ending-native-bindings.json`、`ending-metadata.json`、`take-ending-raw-commands.json`、视频采样 `take-ending-screen-native-sheet.png`。metadata输入SHA256：`658f966af11aef965b541e093889056cafa61a7f7fcd4bbf38e1ca2eab6d6e00`。

5198既有映射服务使用98c2c788批次的build-check产物。Browser桌面1280×720定位Take01暂停111000ms，背屏公开诊断显示trhorz_01/eventTime95850/无transition；实际可见星云、人物染色与动态地面，没有315标志或原生末尾五束上方光。截图 `take-ending-missing-common-layers.png`。这是缺口复现，不能写成修复通过；完成后恢复默认视口。未增加完整媒体副本。

前一火焰批次98c2c788的[GitHub门禁37096017872](https://github.com/windmet/GS_Archive/actions/runs/37096017872)已通过；此前37095031556失败不计通过。门禁通过不改变此次发现的通用消费者缺口。

## 接线顺序与验收边界

1. 先核实Backmonitor的value6合同，导出独立logo及原生旋转clip，修正视频平面旋转的误用。logo用背屏坐标、独立网格与演出时钟；暂停、后退、再次进入同资源都要复算相位。
2. 新悬灯按对象ID、source row与事件时间保持稳定顺序，解析创建/擦除、pivot、色彩、深度及每实例show/fade/rotate/scale；用原生Sprite和材质绘制。Searchlight椭圆运动另建合同，不强塞进固定灯模型。
3. Take01/02先核对95850、108350ms前后及末尾淡出，再核对独唱段的角色明暗与上方光束。随后覆盖其余19/23个编排；Study旧悬灯另按105个编排的旧指令族推进。
4. 当前 `stageVfxCoverage` 只统计已进入read-model的事件，未穷尽上述原生指令族。因此 `source_mapped_unverified` 不能作为整曲完整门禁；后续门禁需绑定RAW清点，区分“来源没有该指令”和“解析器丢了该指令”。

全曲原生Tween、透视与随机种子、整曲录屏等效、实体设备、资源发布及最终master PR仍未完成。

## 第二批：新悬灯基础接线与背屏字段修正

输入 HEAD `bd2bc538`。`live_chibi_suspensionlight.py` 对原生 MonoBehaviour 字节 SHA、SpriteRenderer / RotateBase PPtr、Shader、Sprite pivot、矩形与预制体变换设置守卫。Sprite2580 / Texture834 使用原生 `ohashi/SimpleAdd` 加法光束、顶端锚点。资源检查器补上 RectTransform 子树遍历；此前仅检查 Transform 会漏背屏与新悬灯的子节点。

`prepare-live-chibi-stage-effects.py` 的 schema 7 保留19个新悬灯轨道、60358条原始指令及每轨 bundle/CAB/pathId/TextAsset SHA。每轨独立 JSON，当前曲目才加载；Take01轨约539KB，不在入场时加载所有曲目的指令。stage-effects 索引约9.18MB、61张原生纹理。高级覆盖栏明确显示未支持的控制数量与背屏标志缺口。

基础消费者按时间及 sourceRow 顺序重算对象实例，支持 create、normal_show、erase与复用ID。颜色、旋转、缩放和 fade 等未知后缀仍留在源轨；遇到未知控制就抑制该实例，不能让错误的静态光束一直亮着。normal_show 的线性包络、重复参数与二维投影目前是录屏指导的预览解释，原生 Tween 曲线和完整方法体仍未闭合。19轨来源接线不是19曲视觉验收。

Take01/02末尾108350ms的五束光已可见；111000ms时公开诊断包含10047/10049/10051/10053/10055。此外690～713是110900ms创建的另一组原始光束，不是额外复制的结尾五束。纹理按舞台画布同比缩放，复用演出时钟；每轨加载有 AbortController 与切歌代次检查，离开销毁资源。

Backmonitor CSV索引7改名为 `rawValue6`，choreography生成器升级schema 15。932行的原值保留，兼容旧索引的rotation字段，但取消把0/1值作为整块视频旋转角度。**它是否就是logo启用参数仍为推断**，此修正不能证明315标志已接线。

旋转标志继续追到原生 Shader `Growing/RotateSprite`：使用 UV3.xy / UV3.z 的透视采样、普通透明混合、Cull Off，不能以整块背屏旋转或仅横向压缩替代。另读取 iOS 2.6.10 的同一默认 Texture463：RGBA32 原图同样是蓝色M标志，排除了 Android ETC 解码导致色差的解释。iOS data.unity3d SHA256 为 `fb28e28793e4f9d21e76dd96be2c776a71382cb607d98acd24f65f20bed8018a`。录屏里的亮色315资源仍需核实 `LoadLogoSpriteIfNeeded / SetLogoSpriteIfNeeded` 的运行时选择，不能给默认贴图染白后宣称复刻完成。

### 第二批验证

纯stdlib新悬灯解析回归、原生预制体守卫、Node包络/后退/擦除/复用ID/未知控制抑制/比例投影回归均通过。published-assets验证实际19轨、60358条及两版Take结尾五束，源fixture逐字段一致。既有固定灯、原生指令清点及118编排VFX覆盖回归通过；111个编排仍为partial。

`npm run build:check` 最终2783 modules / 22.53s，固定 `.analysis/build-check`、没有public复制。5198 PID62924既有映射服务读取最终bundle，未再启动服务或打包完整语料。

实际Browser验收1280×720：Take01/02暂停111000ms出现末尾五束；光束开关关闭后清空、开启恢复；倒退108300ms消失、返回111000ms重现。Take02→Study→Take02快速切歌后最终资源归属正确。390×844模拟窄屏画布约357×201，光束随画布比例变化；不是实体设备验收。console无error，已有PixiSpine tint废弃警告仍存在。最终恢复默认视口。

截图在同一小型证据目录：`take01-ending-new-beams.png`、`take02-ending-new-beams.png`、`take02-ending-new-beams-mobile.png`。iOS原图与身份记录为 `ios-live_backmonitor_movie_logo_m.png`、`ios-logo-comparison.json`。构建及Browser通过仅覆盖本批基础消费者；旧Suspensionlight、Searchlight、NewSuspensionlight未知控制、背屏旋转标志与全曲录屏等效仍待完成。
