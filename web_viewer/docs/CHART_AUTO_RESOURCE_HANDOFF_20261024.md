# Auto 资源缺口与开发交接

2026-10-24。工作目录：`E:/Web_build/GS_Archive_Domain_Work/chart-native-projection-20261023/web_viewer`；分支 `chart/20261024-autoplay-timeline`。起点 master `d0531dcc`，原生选择审计提交 `6030c56f`。本页交接的是可运行的调度／简化效果开发快照，**原生 Auto 动效还原尚未完成**。

## 接手先看

用户要求以提供的两张原版 Auto 录屏截图为视觉依据，指出当前明显缺资源接线。当前 `ArchiveSongTrackPreview.vue` 的新增效果仍然是手写 SVG 圆、矩形、箭头和文字；不是已经消费原生 prefab 的粒子渲染器。

`SongChartHitEffectSelection.js` 对 96 个 ARM64 选择分支及 224 个 prefab 查询的结果一致，只证明选择接线。`config/song-hit-effects.v1.json` 的 prefab 名、systems 列表、生命周期摘要也不等于按这些 systems 渲染。该配置没有完整保存下面的模块树，渲染组件更未消费这些数据。不要以已过逻辑测试为由，将当前画面称为原版 Auto 或完整还原。

继续开发前先读 [原生选择与生命周期审计](CHART_AUTO_EFFECT_WIRING_20261024.md)。下一批核心是恢复真实资源和行为，不是继续调整当前示意圆环的颜色、半径和 CSS。

## 已反查到的来源链

IPA `data.unity3d` SHA256：`fb28e28793e4f9d21e76dd96be2c776a71382cb607d98acd24f65f20bed8018a`。绑定 `resources.assets` 中四套 `LiveHitEffectPrefabsData`、51 个不同 prefab；沿每个子 GameObject → ParticleSystemRenderer → Material → Texture2D PPtr 读取引用。

新增可重放工具 [audit-song-hit-effect-assets.py](../scripts/audit-song-hit-effect-assets.py)；跟踪的小型清单 [song-hit-effect-assets.json](../scripts/fixtures/song-hit-effect-assets.json)。没有把纹理晋升到 public，没有上传 R2 或部署。

本地输出：`.analysis/chart-native/hit-effect-assets/`。

- 22 张效果 Texture2D 解码 PNG，合计 **6,606,815 字节**，覆盖四套资源；另有 Auto 裁切图和联系表。
- `asset-manifest.json`：纹理尺寸、原始对象／PNG SHA256、默认 7 个 prefab 的逐层材质／纹理引用，及 Auto 图集／动画绑定。已复制为上面的跟踪清单。
- `source-assets.json`：22 个材质原始属性；默认 7 个 Auto prefab 的完整启用粒子模块、曲线、burst、renderer 和局部 TRS；Auto Sprite／AnimationClip 原始树。约 2.1 MB，仅为本地来源证据，不是运行时配置。
- `contact-sheet.png`：22 张纹理和 Auto Sprite 的联系表。

同名文件检索未在 worktree 或主 checkout 的 public/assets 找到这些效果纹理；与当前 Git 跟踪 public/assets 的 246 张 PNG 比较编码 SHA256，没有匹配。这不是对任意重新编码／改名图片的像素级排重结论。当前消费者源码没有引用这些效果贴图，才是接线缺失的直接证据。

## 默认套装的实际纹理

默认 hit-effect 套装 index=1，与音符贴图皮肤和静态 flick 方向提示套装独立。录屏的已保存设置未知，不能由截图直接断言使用第几套。

| Texture2D | pathId | 尺寸 | 默认资源用途 | 本地 PNG |
| --- | --- | --- | --- | --- |
| tap_shine | 440 | 256×256 | flash／shine／glitter／speedline 共用 2×2 图集 | `440-tap_shine.png` |
| circleframe_3 | 339 | 1024×1024 | 两层圆环，4×4 图集 | `339-circleframe_3.png` |
| circleframe_2 | 461 | 1024×1024 | 另一层圆环，4×4 图集 | `461-circleframe_2.png` |
| circleframe_2_2 | 446 | 1024×1024 | 模糊圆环层，4×4 图集 | `446-circleframe_2_2.png` |
| flick_line | 935 | 2048×2048 | flick 的 line 层 | `935-flick_line.png` |
| sptap_M_mark | 346 | 1024×1024 | Special 的 M_mark；不是文字 SP | `346-sptap_M_mark.png` |
| starframe | 720 | 1024×1024 | P 技能的星形边框 | `720-starframe.png` |
| starframe2 | 889 | 1024×1024 | P 技能的边框／glitter | `889-starframe2.png` |
| starframe_2 | 943 | 1024×1024 | P 技能的模糊星形层 | `943-starframe_2.png` |

上述文件均位于本地输出目录。其余 13 张纹理供其他套装使用（squareframe 系列、fx_sheet_motion 系列等），完整清单见跟踪 JSON。初期应闭合第 1 套而不是同时近似实现四套。

默认套装这些材质使用 `Mobile/Particles/Additive`（shader pathId 950），材质名包括 `tap_shine_add`、`circleframe_3_add`、`circleframe_2_add`、`circleframe_2_2_add`、`flick_line_add`、`sptap_M_mark_add` 和 starframe 系列。全四套还出现 Legacy Additive／Standard Unlit。必须区分 RGB 叠加、alpha／顶点颜色、纹理颜色空间和 renderer 对齐；普通 SVG 描边／source-over 不是该混合模型。

## 比“少几张 PNG”更大的缺口

| 录屏／来源层次 | 当前 Web | 必须补的消费 |
| --- | --- | --- |
| 重叠的青白／黄绿环 | 普通命中仅手写 2 个 circle + 1 个白点 | 4 层实际 circle 图集、每层颜色／alpha／Size 曲线、局部旋转、加法混合 |
| 四角星芒与散射小星 | 没有真实星芒纹理与发射器 | tap_shine 的不同 atlas cell、Shape／Velocity／ClampVelocity；不是所有星芒都来自 P 技能 starframe |
| 持续长条接触点 | 5 个固定 SVG circle，没有循环出生和运动 | 5 个循环系统的发射率、force、速度限制、媒体年龄与移动 emitter 的空间语义 |
| flick 命中 | 彩色 SVG 箭头和圆环 | 对应 prefab 的 flash／shine／circle／glitter／line，各方向 TRS／参数；与既有静态方向提示分开 |
| Special／P 技能 | SP 文字／旋转方框 | M_mark／星形边框原贴图及独立 systems；普通尾不能继承 LARGE 首的 P 技能效果 |
| Auto 字样 | 青色 SVG 胶囊文字，固定 0.6 秒线性淡出 | 原版黄色 Auto Sprite、三层评价 UI、原 AnimationClip 曲线 |
| 瞬时退休 | 用 prefab 最大 lifetime 摘要裁掉整个实例 | burst 最后出生时间 + 单粒子寿命、停止／IsAlive 和池回收；5 秒为保护上限 |

具体来源例子（默认普通 PERFECT，prefab 14650）：

- flash、两个 shine 使用 2×2 `tap_shine`；原始 startFrame 标量分别为 0.5、0、0。glitter 为 0.25。UV 的标量到 cell／frame 映射应由共享 UV 函数核对，不能直接把整个 atlas 贴成一个方块。
- 四个 circle 使用 4×4 图集，frameOverTime 启用曲线；初始 X 旋转约 −35°，其他 flash／shine 为约 +30°。环的椭圆与朝向不是统一的屏幕正圆。
- 一个 circle 在 0 和 0.1 秒分别出生；glitter 在 0／0.1／0.2 秒各出生 4 个；speedline 在 0 秒出生 20 个，renderer mode=1（stretched billboard）。只看系统数 9 会漏掉实际粒子数和延迟叠层。
- 默认 hold（32265）flash／shine／shine／glitter／glitter 的 rateOverTime 分别为 3／2／2／20／10；两个 glitter 启用 ForceModule、VelocityModule、ClampVelocityModule。当前固定圆点完全没有消费这些模块。

完整参数以本地 `source-assets.json` 的对象 ID、曲线和 renderer 为准；JSON 中无穷斜率以 `{ "nonFinite": "inf" }` 记载，二进制字段以 bytesHex 保存，后续读者需要显式处理，不能当普通数字线性插值。

## Auto UI 的精确入口

Android 解密 metadata／ELF 的 `EvaluationPanel` 构造函数字符串引用：`0x4300e88` → `live_taptiming_auto`，`0x42ee628` → `EvalAnimationAuto`。原生 getter 在 Auto Live 下使用独立 `autoEvalInfo`，并不新增一个 AUTO 评价枚举；粒子仍选择 PERFECT(6)。

- Sprite：`resources.assets` pathId **2068**，解码裁切后 **136×63**，本地 `2068-live_taptiming_auto.png`。
- SpriteAtlas：`LiveSpriteAtlas` pathId **106487**；Texture2D pathId **325**，2048 图集，rect **(1520, 272, 136, 63)**，settingsRaw=67。Sprite 自身 m_RD.texture 为空，应解析 atlas renderDataMap，不能据空指针断言图片丢失。
- AnimationClip：pathId **1090**，`EvalAnimationAuto`。存在 `EvaluationImage`、`EvaluationEffectImage`、`EvaluationEffectImage2` 三个目标的 alpha／scale／颜色曲线。
- 主图 scale 从约 1.1 在 0.1333 秒到 1；alpha 在 0.1333 和 0.9167 秒为 1，到 1 秒为 0。两个效果层另有 0.1333／0.3333 秒退场及非等比缩放。不能用当前 0.6 秒线性淡出替代。

尚未完整提取评价面板 prefab 的 RectTransform 层级、两个 effect image 的初始 Sprite／材质和 animation speed 设置。这是明确剩余项，不能仅接主 Sprite 就宣布 Auto UI 完整。

## 已做的运行验证与修正

本次保留工作区原有调度／效果选择／SVG 示意改动，修正了三处运行接线：恢复播放不再重复 seek（避免清掉冻结效果）；瞬时效果用 targetLane 定位而不是连续 event.lane；删除独立透明度 transition，避免与媒体时间分离。

- `verify-song-chart-demonstration.mjs`：244 档 playable、80,141 个事件、2,722,796 个全曲采样、26,817 个区间／位置跳转通过。
- 原生选择回执和 selection/pool 回归通过：96 分支、224 查询、同刻独立实例、lane 衰减和 seek 清理。
- 新的 [组件回放 fixture](../scripts/fixtures/song-chart-demonstration-browser.html)：实际 Vue 组件，Café Parade! EXPERT 816 事件、Reversed Masquerade EXPERT 695 事件整曲受控回放；暂停恢复实例不丢、buffer 冻结、seek、切视图、切难度通过。受控媒体／rAF 不能冒充真实音频或实机 FPS。
- Browser 5231 的真实 DRIVE A LIVE（パッションMAX Ver.）PASSION 从 0 播至 ended **130.285011 秒**，统计 **445/445**，hits=0、holds=0，控制台 error/warn 为空。未重新测量本轮高频更新 CPU P95 或 GPU FPS。
- Browser 再切 EXPERT、tick9600，统计 9/430、两条持续 hold；确认两个效果 DOM 的轨位 x=288／992。截图 `.analysis/chart-native/autoplay-resource-gap-current.png`。实际可用视口宽 481；viewport override 未生效，因此不声称完成 1440 桌面验收；`autoplay-resource-gap-desktop.png` 也是同一实际视口，不作为桌面证明。
- `npm run verify:source-batch` **181/181** 通过，日志 `.analysis/chart-native/autoplay-source-batch.log`。
- 修正后的 `npm run build:check` **21.36 秒**通过，固定 `.analysis/build-check`，不复制 public；保留既有背景未解析／大 chunk warning，日志 `autoplay-build-final.log`。不代表完整媒体发布包。

**运行接线验证通过，原生视觉验收不通过。** 当前新增 SVG 视觉仅可作为开发占位，禁止在交接或 PR 中写成原生 Auto 效果完成。

## 下一批按此顺序接手

1. 固定第 1 套原始资源，建立 source → PNG/模块合同 → runtime consumer 的共享数据链，补来源 hash／PNG HTTP／模块支持度检查。不要把本地提取等同于 public 已可消费。
2. 先闭合普通 PERFECT 的 9 个 systems：贴图与 2×2／4×4 UV、颜色／尺寸曲线、分批 burst、局部 TRS、Additive 与 stretched billboard；以源参数确定性采样，而不是继续扩写手画 SVG 分支。
3. 再接 5 个持续 hold systems，处理媒体暂停／倍速／seek 后的 emitter 状态与 world/local 粒子空间，避免跳转补发沿途瞬时效果。
4. 单独恢复 Auto 三层 UI，先查全 prefab 层级和初始绑定，再消费上述 AnimationClip；接 flick／Special／P 技能对应资源并检查首中尾。
5. 对照同一录屏片段做逐帧复核，最后重跑整曲与性能采样／物理手机。当前只有两张原图静帧，不能完成时间曲线的录屏逐帧验收。

## 工作区与复现

验收服务复用 5231（实查 PID 86612，Vite `--configLoader native --host 127.0.0.1 --port 5231 --strictPort`），未改端口、未部署。bootstrap 继续沿用 release `1accd9d0…`，并非线上发布证明。

本批开发快照包含：两个 Vue 组件、`SongChartDemonstration.js`、`SongChartHitEffectSelection.js`、`config/song-hit-effects.v1.json`、相关 verifier／coverage、受控 Browser fixture；该代码尚有上述视觉缺口。`config/resource-audit.json` 在本轮开始前已有生成差异，后续构建也会重写，本批不提交、不擅自清掉。

复现资源反查：

```powershell
py -3.14 scripts/audit-song-hit-effect-assets.py --ipa 'E:/BaiduNetdiskDownload/SideM/サイスタ - 副本/サイスタ 2.6.10.ipa' --output .analysis/chart-native/hit-effect-assets
```

这只要求已有 UnityPy／Pillow 和绑定 IPA；原生 ARM64 选择回放另见前一审计的 Unicorn 命令。新工具不复制全量语料、不改 public、不修改发布记录。QA 图片／完整模块树留在 E 盘该 worktree；轻量来源清单和生产工具入 Git 以便下一位重放。
