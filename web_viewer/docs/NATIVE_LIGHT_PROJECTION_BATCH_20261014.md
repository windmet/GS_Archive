# 新旧悬灯：原版舞台投影与暂停补绘

日期 2026-10-14；分支 `codex/stage-chibi-wiring-20261013`；输入 HEAD `e96b40aa`。承接 [执行通道批次](NATIVE_DRIVE_LIGHT_CHANNELS_BATCH_20261014.md)。本批使新旧悬灯脱离截图校准的投影规则；其他舞台层仍待迁移，不声称全场一致。

## 补全的原版链路

- prefab 的 LiveStage scale=1 只是序列化初值。`LiveStage.<Prepare>d__57.MoveNext`（`0x1cb07c0`）调用 get_stageScale，再设置 **LiveStage 本身**的 XY scale；不是仅修改某个背景或 Base。
- 在网页使用的 1280×720 虚拟宽屏平面，stageScale 为约1.3888889。结合 ScriptPosToStagePos 的 .01、原点(0,360,0)、Camera 默认 orthoSize=5：`720/(2×5)×.01×1.3888889≈1`。因此不能遗漏运行时 scale，也不能保留 Moon 的半坐标比例。
- 新悬灯 Create → LiveObjectComponentEx.SetPosition（`0x221a0f8`）同样调用 ScriptPosToStagePos；其 Y 原点也是360，原消费者的250没有原版依据。
- Camera.PlayAnimation（`0x2219960`）对 **orthoSize=5/zoom** 做 tween，而不是直接对 zoom 插值；普通 tween 使用已核对的 OutQuad。镜头 Z 旋转进入 view 的逆矩阵，再转换屏幕 Y 轴，屏幕旋转符号与旧参考父容器不同。
- 跟随人物时，get_targetIdolPos 经过父层级矩阵转换，并增加150 camera pixels的上偏移；镜头整个 sequence 完成后才由 Update 持续跟随。不能将所有人物焦点 Y 固定360，也不能一收到新站位就打断尚未完成的镜头移动。
- GetTargetIdolObj（`0x1f29b84`）检查列表范围，越界返回null。实际两份 LiveStage 都绑定六个人物根。真实 jfhtmk 有四条超大 focus ID，必须走 free camera，不能因此隐藏灯束。

新增 `chibiNativeLightProjection.js` 负责灯光镜头状态与屏幕矩阵。新旧悬灯共同使用它；将屏幕矩阵转回原父容器局部空间，抵消当时父容器的参考 easing、pivot 和 rotation（更正：当前基础缩放已是 1，非 .82），保留现有 sortingOrder 与层间排序。每次采样先刷新父容器 localTransform，避免使用上一帧 worldTransform 导致 seek 抖动。

该模型对应网页的16:9虚拟舞台，手机视口仍展示同一平面；不把它等同于原生应用竖屏布局。环境与查看缩放继续作为网页用户控制，默认值下执行原版舞台计算。

## 材质核实：没有增加猜测亮度系数

直接提取配置 XAPK 中实际 shader 的编译后 GLSL 与 pass 状态：

| Shader | resources.assets pathId | SHA-256 |
| --- | --- | --- |
| Mobile/Particles/Additive | 950 | 7251f5c686e43bf50d0b4f470c83cc84af5774f867802d249388331ccbc4e4f5 |
| ohashi/SimpleAdd | 1014 | dd6c494ec8ac210c877cb204955473956e766bd80c4dd38356a0574f00eaac5d |

两者实际 fragment 均为 `texture × vertexColor`，rtBlend0 均为 SrcAlpha/One、Add；没有按 shader 名字猜测额外2倍强度。PlayerSettings.m_ActiveColorSpace=0（Gamma）。Pixi 对图片和 tint 做预乘，再以One/One相加，与该原版 **RGB** 公式相符。

Browser 用实际 sidelight PNG 的三个像素位置、两种 tint、四个 alpha，在不透明背景上检查24个GPU输出；与独立原版公式逐字节比较，最大RGB差为0。本证明不涵盖透明目标的 alpha 累积、HDR中间缓冲与所有后处理，不能作为整场颜色一致的结论。

实际绑定的 StageCamera 是正交相机、viewport为完整矩形、targetTexture=null、HDR=true；除 LiveObjectCamera 外还绑定 PostProcessLayer。其 Stage 层全局 volume 指向 LiveStage Profile（106548），包含一个 DepthOfField设置（106534），不是凭“亮”就推断Bloom。本批未复原景深/HDR中间链，也未人为降低alpha。

小型源证据位于 `.analysis/native-chibi-wiring-audit/drive-render-chain.json`、`drive-light-blend-state.json`、`drive-native-color-space.json`、`drive-postprocess-profile.json`，以及两份 shader 文本导出；没有导出完整媒体包。

## Browser 暴露并修复的真实漏接

暂停时 Pixi ticker 停止，异步轨道/贴图就绪回调原来只更新visible与位置，没有补绘。检查真实 worldTransform 时，新建灯束仍为单位矩阵，表明它尚未进入已绘制的画面；以前的 runtime.visible 断言不足以验收。

新旧悬灯轨道加载完成和纹理onReady均请求合并的暂停重绘。微任务按应用实例归属检查，播放开始、应用替换或舞台释放后不会补绘旧场景。受控回归直接执行实际SFC函数，检查合并、播放切换、owner替换和释放；并在Browser重新验证首次暂停跳转后的真实世界矩阵。

## 验证与边界

- 旧悬灯 verifier 新增 orthoSize 插值、聚焦150偏移、等待整个镜头序列、越界ID、world/view/Y翻转独立矩阵与父矩阵抵消。118份编排全部 camera cue 在三个时点检查有限状态；20份 Drive 的通道回归仍通过。
- 新悬灯 verifier 新增Y原点360断言；两类真实资源回归通过。resource ownership为8项，stage intent为58项，verifier coverage通过。
- 最终 `build:check` 通过，2901 modules / 18.49s，固定 `.analysis/build-check`、copyPublicDir=false。
- Browser plugin not available，使用 Playwright+Edge，复用本工程5212。Drive 19s灯5:1的真实世界位置/反射矩阵，与独立RAW镜头计算相符；连续播放、后退恢复、手机390×844通过。Platinum MASK112.9s首次暂停跳转的新灯70001，世界矩阵亦与独立镜头/发光点计算相符。
- Growing/Moon6s页面与截图已检查；无pageerror/console error、无Vite遮罩。QA目录保存 `native-light-projection-receipt.json`（含24项GPU像素）、`native-light-projection-qa.cjs` 与截图。

新旧悬灯发光点可能按脚本位于画面外，这不等于灯被隐藏；本批没有用“对象visible”声称屏幕内存在对应颜色。人物、背景和其他灯具仍使用旧参考镜头，暂时存在层间镜头/尺度不一致，须继续统一；不能将这批局部迁移当作全场复刻完成。原片对时、完整全曲观感、原生景深/HDR、变速BPM、未绑定灯具与剩余编排仍待完成。未推送、未部署。
