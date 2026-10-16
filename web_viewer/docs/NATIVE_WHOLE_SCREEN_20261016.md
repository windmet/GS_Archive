# Whole_screen 原生资源与公共消费者

输入 HEAD：c0c833a6，工作树 stage-native-fidelity-20261014，端口 5212。

此前只消费 Whole_screen_color；Whole_screen 整族未接。新增独立来源绑定 sidecar，118 编排、461 条 RAW 指令，APK 六种预制体，三张原始 PNG。所有编排共用消费者，没有 FLASH LIGHT 曲名特例。

## 已接行为

- Type 1/2：原始 4000×4000 白/黑 Sprite 遮罩、排序、OutQuad 淡入淡出。
- Type 3/4/5：连续 box 发射、原始 XYZ 变换和方向、容量、寿命、尺寸、颜色梯度、旋转、图集帧及 additive 材质。View billboard 跟随镜头位置并取消镜头旋转。
- 粒子 Show 不使用 value2 淡入。Hide 使用 StopEmitting，保留存活粒子，到 eraseDuration 后停用；再次 Show 不取消已有延迟停用回调。
- 播放/回拖预载纹理；切歌和卸载同步退役容器，异步旧请求受 generation 保护。轻量画质关闭此层。

## 明确边界

Type 3 的 NoiseModule 位移未复现；Type 3/4/5 使用可回拖的浏览器随机种子，非 Unity autoRandomSeed。Type 6 三维彩纸（局部朝向、重力、旋转和 Noise）保留来源、明确 unsupported。tfmvmt 的一行空类型解析为 0，原始缺失资源保留 unresolved，不替换成其他类型。现有二维镜头投影不证明 Unity 三维透明排序、HDR 或随机逐像素一致。

## 验收

- prepare-chibi-whole-screen.py 无 --write 重解 APK、60 个 RAW bundle、118 TextAsset、IL2CPP 方法窗口与 PNG 像素：通过，461 行。
- verify-chibi-whole-screen.mjs --published-assets：来源绑定、原图 hash、StopEmitting 尾粒子、重显后的旧停用回调、遮罩渐变、回拖确定性和几何闭式样例通过。
- source-batch：145/145 通过。build:check：2952 modules，最后一次 13.33 秒；无 public 语料拷贝。
- Browser 插件实际 5212：FLASH LIGHT 从开头实播到 1:42；回拖 10 秒 Type 3/4、40 秒 Type 3/4/5、65 秒星光。粒子计数分别 40、48、54。控制台 error 为空。1440×900 截图和 390×844 布局（scrollWidth=clientWidth=390）通过。实播与截图不构成原游戏逐帧等价验收。

## ROUTE77 后续在同一请求内继续

RAW 明确：meter 为 2 系统（burst/UV）；turbo_1/2 各 6 系统；fire_1/2/3 各 6 系统。大圆和彩色圈属于 Searchlight_show / scaleanim / fade / ovalmove；移动星星使用 Searchlight_show 的 fx_in_grwsml_pinspotlight Sprite，不能当成 Whole_screen 粒子。详细来源审计保留在 .analysis/native-screen-particles/route77.json。
