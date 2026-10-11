# 音符贴图、315、中间节点与视觉配速

输入 HEAD `7777be63`，最终代码 HEAD `51a42e3a`。用户确认参考为《Café Parade!》EX；《K.now O.nly》EX 截图确认旧问号位置是绿色 315，并补充滑条中途绿色横条。两种视图现在共用原始 Sprite 映射，不再使用问号或 LARGE 的 1.45 倍绿色宽键。

## 映射与来源

| 原始类型／位置 | 本批显示 | 证据与边界 |
| --- | --- | --- |
| SMALL、普通长条头尾 | `live_notes_normal`、`live_notes_hold_line` | 保留原始 PNG、poly、尾端方向 |
| FLICK_LEFT／UP／RIGHT、END_FLICK_* | 三方向原始 Sprite 及原生提示 | 长轨、透视均接入；静态提示位置仍估计 |
| LARGE | 紫星 `live_notes_p_skill` | Café EX sourceIndex 239、tick 30720、第 5 轨，与用户截图匹配 |
| LARGE_HOLD／LARGE_VARIABLE_HOLD | 紫星头、原生条带 | 同源 LARGE 类型族；每个长条变体尚无运行截图 |
| SPECIAL | 绿色 315 `live_notes_sp` | K.now EX sourceIndex 610、tick 74400、第 3 轨，用户截图确认 |
| 滑条中间节点 | 绿色横条 `live_notes_middle` | 显示源 poly 内部点；自动判定生成／合并规则待核实 |

[来源清单](../config/song-note-rendering.v1.json)包含三套图集的 URL、Sprite pathID、完整 PNG 身份、主体显示范围、native enum 原始默认值和字节偏移、参考谱面哈希及原始对象。[生成／复核脚本](../scripts/audit-song-note-rendering.py)从 IPA、metadata 重新读取并逐项校验，不修改已有 PNG。

IPA 的 `Payload/BNEI0395.app/Data/data.unity3d` SHA-256 为 `fb28e28793e4f9d21e76dd96be2c776a71382cb607d98acd24f65f20bed8018a`；metadata SHA-256 为 `658f966af11aef965b541e093889056cafa61a7f7fcd4bbf38e1ca2eab6d6e00`。UnityFramework LC_ENCRYPTION_INFO_64 为 cryptid=1、cryptoff=16384、cryptsize=64503808，未取得运行时绘制方法体。

额外方向提示取 Texture pathID 618 `fx_in_flicknotes_effects` 的右／上两个 512×512 单元，左提示镜像右单元。Material pathID 48 `fx_in_flicknotes_effects_add` 引用该 Texture。三个 `NoteEffectFlick*_1` prefab 的 ParticleSystem startColor 为左 `(1,.582751989,0)`、上 `(1,0,.059916496)`、右 `(0,.6666666865,1)`。按原图 alpha 静态着色并保留白边；新增两张 PNG 共 25,846 字节。动态粒子、加法 Shader、光晕、动画帧和其他 prefab 变体的运行时选择未复刻。

侧划 PNG 的淡影覆盖整个原始方形。显示时采用 alpha≥128、最大 RGB≥180 的主体范围对齐，保留原始 PNG 全部字节。Note1 中间横条 Sprite pathID 2262，显示范围 `[9,127,263,140]`，维持原生细横条比例。

## 中间节点与配速

metadata 有 EventNoteType.HOLD_MIDDLE、NoteDrawType.HoldMiddle、NoteHitType.HoldMiddle，以及 HoldMesh.childMiddleNotes、NoteInfo.childHoldMiddleNotes、RhythmGameNoteManager.CheckHoldMiddle。原始 fumen 分区没有独立 HOLD_MIDDLE 事件。本次只将源 poly 中严格位于头尾之间的点画为横条，不按任意固定间隔补造节点，不因条带裁剪制造判定点。

K.now EX sourceIndex 994、tick 122880、duration 2400 的内部点为 `(124080,0)`、`(124320,1)`、`(124560,0)`、`(124680,1)`，轨位为原始零基坐标。两视图均显示这四个标记，支持「长条中间节点」定位。尚不证明所有中途 Combo 判定均已还原：“头＋尾＋全部 poly 内部点”仅与 160／244 档最大 Combo 相等，其余有差异，因此不修改主数据 Combo 或判定逻辑。

透视视图新增 1–20、步进 0.1 的视觉配速数字输入及滑杆，默认 10。相对刻度采用 `span=round(24000/speed)`：1＝24000、8＝3000、10＝2400、11＝2182、20＝1200 tick。越快窗口越短，同一未来音符离判定线越远。调节不移动判定线或改谱面。保留 3000／6000／12000 固定视野，调整配速会切回「跟随配速」。长轨仍用纵向缩放。

这是静态 tick 预览的相对刻度。用户反馈 11 仍比录像密，因此扩大可调范围，不再把目测 8 或 10 作为原版配速的校准证据。原版流速公式、BPM／tick 时间比例、offset 单位及音频同步仍待核实，不推算毫秒或标为原版速度。

## 验证与差异记录

- `python scripts/audit-song-note-rendering.py --ipa <本地 IPA> --check`：三套原 PNG、两个提示单元、三个 prefab 颜色、原始枚举和两首参考身份通过。
- `node scripts/verify-song-note-rendering.mjs`：244 档、742 LARGE 类型族头、11,470 尾；315 中轨、四个源节点、节点窗口裁剪、配速单调性、无效配速拒绝通过。
- `verify-song-chart-presentation.mjs`、`verify-song-track-presentation.mjs`：66,666 原始音符、3,839 滑条、1,585 Flick 尾、732 视野、6,108 纹理三角片回归通过。
- QA 工作区 `npm run build:check`、`verify:build-audit`、`verify:cutover-routes` progress 通过；两项既有背景路径编译警告保留。全局 partial／设备 pending 不变。

复用 `E:/Web_build/GS_Archive_Domain_Work/song-attribute-qa-20261001/web_viewer` 固定 `.analysis/build-check`，`copyPublicDir:false`。5200 服务挂载已有 public／外部资源和 `song-gameplay-readmodels-20261001`，release 保持 `17e0ab0b227d6f2bb433f0c1cfaf3934fcccbc2cd420387adc95af9fc4c7a907`。未复制 IPA、音频或公共语料，未覆盖主窗口构建目录。

Browser 插件不可用，按前端验收技能使用已有 bundled Playwright Chromium，未安装依赖。1440×1000、390×844 的页面身份、非空内容、无框架覆盖错误、控制台、截图与交互通过：

| 参考／旅程 | 渲染证据 | 保留差异 |
| --- | --- | --- |
| Café EX 三方向、方向尾、紫星 | 两视图显示 23520 右尾、24480 左尾、23160 上键、30720 紫星 | 粒子／光晕未还原 |
| K.now EX cursor 72015 | 74400 中轨绿色 315，无问号 | 相机／尺寸公式仍估计 |
| K.now EX cursor 123406 | 源 994 四个内部点绿色横条 | 判定生成／合并仍待办 |
| 配速 6／8／11、边界 1／20 | 相同 cursor 可见头尾数 19／13／7；边界窗口 24000／1200，滑杆更新通过 | 与原版数值对应待核实 |
| 窄屏两视图 | 五轨、节点、定位与配速可用，无页面横向溢出 | 非真实物理设备 |
| SVG 下载／离线 | 10 个原 PNG 去重嵌入，743,777 字节，file URL 打开零 HTTP 请求 | 静态预览 |
| 贴图完整性故障 | SHA-256 拒绝损坏字节，恢复后重试下载成功 | 本地注入 |

新原生旅程零控制台错误／警告、零 HTTP 失败。原六首歌、四档、懒加载、缩放、502／完整性重试和旧请求取消回归通过，仅一次预期 502。原五轨、普通／跨轨／小数滑条、三套贴图及视野裁剪回归通过；旧脚本默认假设 6000 tick，默认配速改变后明确选择原来的固定 6000 视野再回归，不放宽头尾断言。

证据在 `E:/Web_build/GS_Archive_Domain_Work/song-attribute-browser-20261001`：`verify-native-note-rendering.mjs`、`native-note-browser-receipt.json`、`native-know-315-desktop.png`、`native-know-middle-speed-desktop.png`、`native-know-middle-speed-mobile.png`、`native-know-middle-long-mobile.png`、`native-cafe-flick-perspective.png`、`native-cafe-long-mobile.png`、`native-cafe-EXPERT.svg` 及更新的两份原旅程 receipt。截图已人工查看。不授予部署、完整游戏一致性或真实设备通过状态。
