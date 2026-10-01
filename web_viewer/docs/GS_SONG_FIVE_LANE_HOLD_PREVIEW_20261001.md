# 五轨透视与长条预览核实

2026-10-01。以用户提供的五轨截图及后续长条截图为视觉参考，结合本地 IPA、native metadata 与已收录的真实谱面，实现歌曲详情的「透视轨道」视图。参考图片中的文字不是额外任务指令。原有「长轨图」及完整 SVG 导出保留。

## 已确定的来源

- IPA `サイスタ 2.6.10.ipa`，成员 `Payload/BNEI0395.app/Data/data.unity3d`，SHA-256 `fb28e28793e4f9d21e76dd96be2c776a71382cb607d98acd24f65f20bed8018a`。
- native metadata SHA-256 `658f966af11aef965b541e093889056cafa61a7f7fcd4bbf38e1ca2eab6d6e00`；`RhythmGameDef` typeDefinitionIndex 8775 的默认值字节确认 `LaneCount=5`。同时确认 `TopLaneWidth=21`、`TargetLaneWidth=880`、`NotePosZBaxk=200`、`NotePosZFront=100`、`NoteSizeAdjust=312`。字段编号、原始字节、绝对文件偏移和类型索引保存在 [来源清单](../config/song-track-reference.v1.json)。常量已读取，不代表已恢复这些值参与运行时计算的完整方法。
- 三套 Note 图集的 normal / swipe_left / swipe_up / swipe_right，以及 hold_line 使用 [前批核实的 PNG](GS_SONG_NATIVE_NOTE_SPRITES_20261001.md)。圆形 Note1 与截图中的外观相符，不据此宣称它是游戏全局默认皮肤。
- 新解码六张 Live 图集轨道资源，总计 9,460 PNG 字节；来源清单保留 Sprite pathID、atlas pathID、renderDataKey、像素哈希和 PNG 哈希。此版使用 `live_lane_gradation`、`live_target_line`、`live_target_line_gradation`；另外三张侧边渐变资源仅归档，当前边轨仍用向量线条重建。
- 长条两端为原生 normal 音符；若谱面尾端明确为 `END_FLICK_*`，使用对应方向图标。长条贴图四个原生版本像素一致，像素 SHA-256 `823a5fdb83392d067b265b719be6150927d1c860eaf663ce033f53f2ab98c2d4`。

前批 sprite 审计中的 `currentPreviewUsesNativeSprites=false` 是当时长轨示意图的状态；本批新增透视视图已经接入上述原图。长轨示意图仍使用其既有颜色图例。

## 实现与待办边界

入口：歌曲详情 → 打开长轨谱面预览 → 视图「透视轨道」。可选择三套贴图、3000 / 6000 / 12000 tick 视野，输入或拖动判定线 tick，定位首个音符及下一条长条。谱面仍按难度懒加载，并校验原始 SHA-256 与字节数。

六条边界围出五条轨道，判定线有五个光圈。SVG 基准 1280×720，判定线 y=570、顶部 y=8、中心 x=640、普通可见宽 148、条带比例 0.72，是根据 1920×864 截图中央游戏区域 x=192..1728 估计的参数。相机插值使用估计深度比 2，并非恢复的 Unity 相机矩阵。原生 `NoteSizeAdjust=312` 的完整尺寸公式仍未解释；此版 LARGE 的 1.45 倍宽度也是示意估计。

长条使用原始 PNG 纹理，通过三角片映射到透视条带，保留原始 poly 全部转折 tick、小数 posx 和 poly 实际终点。视野截掉头尾时，只裁剪可见几何与纹理区间，不制造新端点；同轨长按避免不必要的细分片。UV、透明合成、相机和 Shader 未达到原游戏运行时一致性。Special 最终对应 sp / p_skill 仍未确定，透视图用带问号的占位显示。

tick 与音频、offset 单位、原生速度曲线、判定规则、交互打歌、舞台背景 / 人物与特效仍未在此版复刻；不将静态预览描述为可玩游戏或音频同步播放。未分配第五轨块的既有待办保持原状。

## 本次验收

输入 HEAD `82b2ae5d`；最终代码 HEAD `a95c32b1`。复用独立工作区 `E:/Web_build/GS_Archive_Domain_Work/song-attribute-qa-20261001/web_viewer` 和固定 `.analysis/build-check`，主窗口构建目录未覆盖。QA 原有两项自有 readmodel 绑定改动先保存到证据目录，再快进至已包含同一绑定的主分支。只读模型 release 仍为 `17e0ab0b227d6f2bb433f0c1cfaf3934fcccbc2cd420387adc95af9fc4c7a907`，本批不改变模型内容。

- `python scripts/audit-song-track-reference.py --ipa <本地 IPA 路径> --check`：重新解码六张 PNG，并比较 metadata 常量字节及完整清单，通过。
- `node scripts/verify-song-track-presentation.mjs`：244 档、732 个视野、6,108 个纹理三角片；截断长条 UV、poly 小数转折和实际终点、方向尾端、五判定点和六边界均通过。
- `node scripts/verify-song-chart-presentation.mjs`：既有 244 档、66,666 个对象、3,839 滑条和 1,585 Flick 尾端通过。
- `npm run build:check`：最终代码编译通过。因修复浏览器发现的长条分片细缝，复用固定目录重建两次；均 `copyPublicDir:false`，未复制公共语料。仅两项既有背景路径编译时未解析警告，保留运行时资源映射。
- `npm run verify:build-audit`、`npm run verify:cutover-routes`：progress 检查通过，保留全局 partial 与设备 pending。

Browser 插件不可用，按既有前端验收技能使用 bundled Playwright Chromium。服务 `http://127.0.0.1:5200/` 读取上述生产代码与既有主仓库 public / 外部资源，未安装依赖、未复制 IPA / 音频 / 全量语料。桌面 1440×1000 和窄屏 390×844 实际验收：

- BRAND NEW FIELD Expert 普通长条 sourceIndex 22 / tick 15360：原贴图头尾、条带和方向 Flick 尾端；三套贴图切换；截掉头部后条带保留；难度切换后重新定位首个音符。
- 同曲 sourceIndex 3 的跨轨滑条；Beyond The Dream Expert sourceIndex 14 / tick 3600 的小数轨位滑条。
- 窄屏五个判定点都在轨道容器内，无页面横向溢出；桌面、手机和小数轨位截图已人工查看。
- 切回长轨示意图及实际 SVG 下载通过。原有六首歌、四档难度、BPM 变化、502 重试、完整性拒绝 / 重试、切换难度取消旧请求等旅程复验通过。旧测试在特殊曲切换时先读到了上首歌标题；补上等待目标标题后通过，未改歌曲切换逻辑。

新透视旅程零控制台错误 / 警告、零 HTTP 失败。既有长轨旅程仅有一次预期注入 502。证据与脚本保存在 `E:/Web_build/GS_Archive_Domain_Work/song-attribute-browser-20261001`：`track-browser-receipt.json`、`verify-track-perspective.mjs`、`track-build.log`、`track-hold-desktop.png`、`track-hold-mobile.png`、`track-slide-desktop.png`、`track-fractional-slide-desktop.png`、`track-long-regression.svg`，以及更新的 `gameplay-browser-receipt.json`。本次是本地生产代码和代表性 Browser 验收，未部署、未授予真实设备或完整原游戏一致性状态。
