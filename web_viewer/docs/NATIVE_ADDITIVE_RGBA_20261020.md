# 共用原生光平面：RGBA 混合因子纠正

输入HEAD `6c195f09`，分支 `stage/20261020-native-followup`。承接 [Time Before Time内置材质检查](NATIVE_TIBETI_BUILT_IN_OBJECTS_20261020.md) 中已确认的公共缺口。本批只改原生加色光平面的混合接线，没有新增源图、逐歌参数或发布绑定。

## 问题与公共修复

APK Shader950的 [原始fixture](../scripts/fixtures/chibi-laser-shader.json) 明确RGB与alpha均为SrcAlpha/One：片段输出`texture × clamp(vertexColor)`，两条通道都使用源alpha因子。当前Pixi库 `mapWebGLBlendModesToPixi.mjs` 把ADD_NPM映射成 `[SRC_ALPHA, ONE, ONE, ONE]`，因此RGB因子符合来源，alpha却变成One/One。旧文档和只检查uniform的测试不能证明真实RGBA混合正确。

例如纹理alpha=128/255、物件alpha=.5，在透明RGBA8目标上绘制一次，原生目标alpha约16；旧ADD_NPM为64。RGB可以看起来相同，所以不透明背景截图不足以识别此错误。

[NativeLightQuad](../src/core/chibiLightQuad.js) 现在要求当前WebGL renderer，按renderer注册显式 `[SRC_ALPHA, ONE]`；只有两个因子时WebGL对RGB和alpha使用相同值。弱引用缓存让同一renderer的所有光平面共享一个模式，contextChange在原编号恢复。缺renderer会明确拒绝创建，不回落成错误模式。

所有实际构造入口已接通renderer：旧悬灯、Spotlight、粒子激光、Sprite激光、Searchlight、Whole_screen粒子，以及上一批的APK内置Sprite。Searchlight/Whole_screen在真正创建网格时从回调获取app.renderer，避免组件setup早于app创建的问题。内置Sprite原有重复注册逻辑已移入公共助手。

几何、纹理、命令时间轴、颜色、脚本排序和alpha clamp未改；保留PMA纹理进入straight颜色方程前的还原。上一批native object emitter与AlphaTex批渲染已有独立正确混合，本批不改它们。

## GPU 对照

使用实际工作区模块、当前Pixi和Codex In-app Browser WebGL，在透明RGBA8 RenderTexture上实际draw/readPixels。参考方程来自上述原生shader和blend fixture，不以Pixi旧实现作oracle。

- 128组：NPM与已经PMA的纹理、4个纹理alpha、2个tint、4个物件alpha（含1.6原生clamp）、单层/双层重叠。
- 初次128组及真实`WEBGL_lose_context`丢失/恢复后再128组均通过：最大RGBA delta=2/255，无GL error；阈值2在运行前设置，覆盖两层RGBA8逐次量化。
- 旧ADD_NPM作为反例：RGB读回23/43/58与源方程一致，但alpha64对expected16，delta48，稳定失败。证明本测试能识别原缺陷。
- 首轮PMA夹具把已预乘数据又设成PREMULTIPLY_ON_UPLOAD，产生重复预乘的RGB错误；改为PMA（枚举2）后重跑。未据该夹具错误调整应用亮度或放宽阈值。
- 实际上下文恢复由页面按钮触发；恢复后同一renderer重新创建并绘制测试网格。此项不冒充完整舞台所有历史网格、播放器或设备恢复验收。

小型测试HTML/Node本地服务位于聊天visualizations目录，临时5214只服务该测试页，完成后其Tab和本轮进程已关闭；正式验收端口5213未变。没有在C盘复制应用或媒体包。

测试源`chibiLightQuad.js`工作区SHA256：`4cf6cc495bdb7dc4650822cedfb80e3e7076e8edf1dd35ffd7cb9054db91595f`。GPU结果、截图与可重放脚本：`native-additive-gpu-result.json`、`native-additive-gpu.png`、`native-additive-gpu.html`、`native-additive-gpu-server.mjs`。

## 回归与构建

- `verify-chibi-laser-particles.mjs --published-assets`：实际Sprite激光构造、源RGBA模式、缺renderer拒绝、一次注册与context恢复；并保留60源平面/1,440几何点、1,083条粒子命令和K.now O.nly回放。
- `verify-chibi-spotlight-sprites.mjs --published-assets`：实际SFC factory的renderer接线、原生模式、逐纹理归属，以及118份编排预备链通过。
- `verify-chibi-built-in-objects.mjs --published-assets`、`verify-chibi-whole-screen.mjs`、`verify-chibi-searchlights.mjs`通过；没有将默认PMA ADD或独立alpha因子当作等价实现。
- `npm run verify:source-batch`：152/152；`npm run build:check`：2,961 modules / Vite27.66秒，固定`.analysis/build-check`，不复制public。保留既有大chunk提示，不是完整发布包验收。

## 真实舞台 Browser

5213/PID67480，候选`rm-release-20261015`，实际bootstrap release仍为 `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`。

| 旅程 | 本轮证据 |
| --- | --- |
| HND / 27秒，1280×800 | ready=true、3组Spotlight、18个Sprite激光、Whole_screen类型3/4共38粒子；实际画面，无框架错误覆盖层 |
| HND实播 | 从27秒实际推进到38.5秒后手动暂停；不是全曲稳定性验收 |
| Take 01 / 8秒 | ready=true，6组Searchlight实际存在；renderer延迟获取链有效 |
| MOON / 6秒，390×844 | ready=true，18个正常旧悬灯实例，原有201..204未决代次继续受限；scrollWidth=innerWidth=390 |
| K.now O.nly / 2.5秒 | ready=true，8个粒子激光、无unresolved；旧HND Sprite激光计数为0，跨家族切歌清退正常 |
| 返回歌曲 | `/songs/knwonl/?maintainer=1`，无song/stage/view残留，标题/歌曲内容与难度表实际加载 |
| 控制台 | 本轮验收时间窗error=0、warn=0；更早会话中已有Spine弃用warning与HMR历史错误，未混入本轮成功结论，也未声称已修复那些历史栈 |

证据目录：`C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/`，舞台图`native-additive-hnd-desktop.png`、`native-additive-moon-mobile.png`，日志`native-additive-stage-console.json`。临时viewport已恢复。

这证明明确的RGBA因子缺陷已修正，并有实际WebGL读回与消费者接线证据；不代表Unity原片逐帧、HDR/景深、深度、真实设备色彩管理或完整舞台等价。32种无consumer粒子、缺家族、随机持续调度、Sprite淡入和旧悬灯非有限Transform等仍保留在路线中。未合并master、未部署。
