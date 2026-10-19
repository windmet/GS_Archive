# 新悬灯自定义 Sprite：Change to Chance 接线修复

输入 `9f0e42fb`，分支 `stage/20261020-native-followup`，主 checkout `E:/Web_build/SideM_Archived/web_viewer`。承接 [续批路线](STAGE_FOLLOWUP_20261020.md) 和 [10-19 定位记录](NATIVE_STAGE_FORMULA_CLOSEOUT_20261019.md)。本批只修可证实的公共资源选择缺口，不将截图中的全部灯光差异归为一个已解决的问题。

## 原生依据与根因

`LiveObjectNewSuspensionLight.Create`（`0x221ef5c`）从 value2 取资源名，经 `GetPreloadedSprite` 调用 `SpriteRenderer.set_sprite`；共用 `LiveObjectNewSuspensionLight` prefab 的材质与层级。`PrepareEffectCreate` 的异步实现（`0x1c9dc20`）同样把 value2 交给 `PreloadSprite`。因此这里不是按歌名选择另一种 prefab。

Web 此前仅导出并接受默认 `new_suspension_light_sample`；`syncSuspensionlights` 以 `state.asset !== model.layers[0].asset` 跳过所有其他名字。实际19条轨道中只有三种非空 Create 资源：

| Sprite | Create 行数 | 编排 |
| --- | ---: | --- |
| new_suspension_light_sample | 17,053 | 默认 APK Sprite，原有路径保持 |
| fx_in_inndgn_suspensionlight | 26 | cgtocc 4、inndgn 10、mtples 2、syksai 10 |
| fx_in_stofft_suspensionlight | 239 | gofrit 52、stofft 168、unmikn 19 |

这些是非 Erase Create 次数，不是同时可见灯数。公共修复覆盖7份编排的265条自定义 Create，不是逐歌条件。

两张自定义 Sprite 不在 APK 中，而在原始 `song_inndgn.unity3d` 与 `song_stofft.unity3d`。提取器扫描所有 RAW 歌曲包的 typed Sprite，要求唯一匹配，再沿 Sprite 的 PPtr 找 Texture2D；不按同名 Texture 或文件名前缀推断归属。

| Sprite | 原始 Sprite PathID | 导出 PNG | 裁切后屏幕 anchor |
| --- | --- | --- | --- |
| inndgn | 9215561136721348915 | 984×724 | (0.5000000078, 0.0241436188) |
| stofft | -5365632284687684417 | 123×987 | (0.5040650445, 0.0197365563) |

两者 PPU=100；使用原生 tight mesh bounds 与 UnityPy 裁切图推导 anchor，不能沿用默认的 `(0.5,0)`，也不能直接把未裁切 pivot.y=.98 写入 Web。bundle/Sprite/Texture SHA、序列化文件、PathID 和几何保存在 [来源 sidecar](../public/data/stage-new-suspension-sprites.json)。两张 PNG 共145,015 bytes，独立归属批次 `2026-10-20-native-suspension-sprites-001`。

## Change to Chance 的原始时序

24.4秒 RAW 第770/771行：ID1401 Create 使用 inndgn Sprite，opacity=.35、scale=(.35,1.4)、位置=(0,1130)、depth=1800。第774/775行：ID1403 使用默认 Sprite，opacity=1、scale=(2.5,1.3)、位置=(0,1350)、depth=1650。

两者 normal_show 均为空 delay、rise=0、hold=600000ms、fall=600000ms、wait=0。`NormalShow`（`0x221f118`）及其回调（`0x1bbfa6c`）明确串联 rise→hold→fall→wait 并循环；当前采样器在26.5秒分别给出alpha .35和1，符合这段原始参数，无需修改包络。被注释的 `#Spotlight` 保持注释。

## 实现与验证边界

- 新增独立、可不写入重放的 [提取器](../scripts/prepare-chibi-suspension-sprites.py)，不重新导出整个 stage-effects，也不修改 RAW。
- stage-effects 加载时校验 sidecar 的原索引 SHA，保留默认 prefab/材质，按 Sprite 建立原生裁切与PPU模型；未知名字不回退成默认灯。
- runtime key 包含 song、ID和asset，复用ID换图不继承旧纹理；切歌仍走共享 store 的 generation 清退。
- 逐曲资产表在 play/seek 前预载默认与自定义纹理，沿已有 `prepareStageLighting` 归属检查；缺资源不冒充就绪。
- 未变更 SimpleAdd 材质、灯具命令时间轴、经验亮度、镜头、被注释指令或其他舞台层。使用共享 prefab 材质是原生调用链的结果，非从自定义纹理名称猜材质。

验证记录和 Browser 结果见下节。本批证明 Sprite 来源、几何和实际消费者接通；没有原片逐帧、Unity随机/帧内更新、完整HDR/深度或真机视觉等价结论。

## 验证

- `python scripts/prepare-chibi-suspension-sprites.py`：重扫真实RAW，不写入重放；JSON与两张PNG逐字节一致。
- `python scripts/verify-chibi-suspensionlight-parser.py`：原始参数顺序、Erase及注释行回归通过。
- `node scripts/verify-chibi-suspensionlights.mjs --published-assets`：19轨道hash、全部非空Create资源绑定、真实SFC换图/隐藏旧代次/未知资源拒绝、逐曲预载和资源失败守卫通过；同时保留原有通道、HSV/BeatShow及Take回归。
- `node scripts/verify-chibi-old-suspension.mjs --published-assets`、`node scripts/verify-chibi-spotlight-sprites.mjs --published-assets`、`node scripts/verify-stage-resource-ownership.mjs`通过，包含真实加载器和118编排预备链回归。
- `npm run verify:source-batch`：150/150通过；最后的预载接线另运行上述受影响回归。源码门禁不是完整媒体验收。
- 二进制清单：394 PNG / 71,481,995 bytes；本批只增加上述两张源图，没有提高批次阈值。
- 最终 `npm run build:check` 通过：2,960 modules / Vite 18.67秒，固定 `.analysis/build-check`、不复制public；仍有既有大chunk提示。仅因后续增加预载接线重跑一次，不创建第二份输出树。

本轮复用5213，发现原进程忽略新建public文件、对sidecar返回HTML；核验PID67272后仅重启本轮进程。新PID59528、端口与候选均保持，HTTP已返回application/json。候选为 `rm-release-20261015`，release须以Browser实际bootstrap复核。5212、5177未重启。构建/回归日志均在本checkout `.analysis/stage-suspension-sprites-*`，不包含public全库副本。

## Browser 与资源 HTTP 验收

Codex In-app Browser / cua_repl，最终源码、5213/PID59528，实际 bootstrap release `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`。没有切换候选、发布或部署。

| 旅程 | 实际结果 |
| --- | --- |
| Change to Chance，完整模式，1280×800 / 26.5秒 | ready=true，ID1401与1403同时存在于实际可见列表，画面已保存；高级设置无框架错误覆盖层 |
| 26.5秒→0→26.5秒 | 0秒可见新悬灯ID为空，回拖前进后恢复1401/1403及原有灯具；不复用错误纹理 |
| 冷刷新，再从24秒实际播放 | 动作预载后进入播放，推进到65.7秒并手动暂停；这是跨过24.4秒的实播，不是全曲稳定性或原片逐帧验收 |
| 390×844 / 26.5秒 | 自定义灯与默认灯可见，scrollWidth=innerWidth=390；桌面Browser尺寸模拟，不是真机 |
| 切到String of Fate / 19.2秒 | 第二张stofft Sprite的800..811灯具实际可见；cgtocc的1401/1403已清退。冷刷新后ready=true并重新显示 |
| 返回歌曲 | `/songs/stofft/?maintainer=1`，无song/stage/view残留；String of Fate标题、Legenders、试听1:57、难度/Combo表实际加载 |
| 最终冷页控制台 | 无应用error，保留既有Spine tint/update弃用warning。首次旧进程HTML响应造成的失败另已在上节记录，未混入最终成功结论 |
| 真实PNG HTTP | 两张图均为image/png，HTTP字节数和SHA256与sidecar/磁盘完全一致 |

证据目录 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/`：`cgtocc-custom-suspension-desktop.png`、`cgtocc-custom-suspension-mobile.png`、`stofft-custom-suspension-desktop.png`、`custom-suspension-cold-console.json`。临时viewport已恢复。只实际验收上述两曲，不将全库资源绑定回归宣称为七曲全程视觉验收。

原有未提交删除、未跟踪资料与v9 HTML保留；构建生成的resource-audit及翻译元数据恢复，不纳入本批。未合并master、未部署。下一项仍为Time Before Time四个内置对象。
