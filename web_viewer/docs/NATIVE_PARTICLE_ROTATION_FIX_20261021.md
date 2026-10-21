# 粒子旋转方向修复

输入 HEAD `aa8dfc5e`，分支 `stage/20261020-native-followup`。已通过普通 merge 同步最新 `origin/master` / `2e115f68`（#66–#68），没有改动其他工作树。

前批 [方向审计](NATIVE_PARTICLE_ROTATION_AUDIT_20261021.md) 的 Unity 原生顶点显示正粒子角为屏幕顺时针，而共享采样器输出逆时针。此次在渲染坐标转换处修复，RAW 舞台角度及纹理保持原值。

## 改动

- 对象普通 2D billboard：仅对粒子初始角与角速度积分所得角作 native→屏幕约定转换，发射器 Transform、位置、速度、父链和相机没有统一反号。
- 3D billboard：X/Y/Z 粒子角采用同一原生约定，并补齐 PNG/native UV 与屏幕的两次 Y 转换。零角的纹理 Y 基也由反向改为相符。
- Floor、Whole_screen 与 Bloom：直接交给 Pixi 的粒子角改为原生屏幕顺时针。
- 最新 master 的 ADV 天气已调用该共享采样器，因此同时删除生成器的负值补偿，重新从 APK 生成 5 个 prefab / 8 个系统的模型。保留原来的常量/双色常量、无3D ADV准入边界；模型标记 `source-rotation-preserved-native-clockwise`，来源fixture、2张纹理及其他适配不变。
- 激光、Spotbeam 和 Classic Stretch 的运行时未改。它们的已有方向、镜像、时钟及 UV 回归独立执行，防止把其他路径重复反号。

## 证据与回归

原有 native fixture 不改期望值。`audit-chibi-billboard-rotation.mjs` 的同一组 2D/3D 顶点与 UV 对照，由 **1/9→9/9**；新增 `verify-chibi-particle-rotation.mjs` 强制全部相符，并覆盖初始角、正角速度、回拖、冷定位、局部父旋转/镜像，以及 Floor/Whole_screen/Bloom 的角度输出。

源数据与几何门禁：

- emitter published-assets、Floor、Whole_screen、Bloom均通过；修正旧 angularVelocity 断言的方向，未改变积分时序或角速度大小。
- Laser / TurnLaser / Spotbeam通过，其中60份来源平面、1,440个独立四元数角点及1,083条实际粒子命令检查仍通过。
- ADV模型与APK重新提取一致；其门禁继续验证雨丝落向/长轴对齐、原始旋转字段、pivot/flip、前后层与alpha。补偿取消后又补跑该门禁通过。
- `npm run verify:source-batch` **168/168** 通过。
- `npm run build:check`：2,984 modules / 20.32秒；入口 gzip **206,060 / 215,040 bytes**。固定 `.analysis/build-check`，没有复制public语料；构建改写的审计元数据已还原。

## Browser边界

本地5213，主checkout、`rm-release-20261015`候选，最终进程56064。桌面1280×720，另做390×844尺寸检查。截图位于本机 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/`。

| 样本 | 实测 |
|---|---|
| ROUTE77 37.5秒 | leaf可见，4个对象层/85粒子；41.6秒leaf移除，98.5秒恢复，回拖恢复85 |
| FLASH LIGHT 3秒 | Floor面板、Bloom97粒子、Whole_screen类型3/4共38粒子均加载；桌面/手机尺寸检查 |
| いとをかし 76秒 | 三路樱花可见，共563对象粒子；实际播放至109.9秒结尾后回拖76秒，恢复563 |

舞台采样窗口 unsupported/deferred 为空，控制台 error=0，不宣称 warn=0。样本截图：`rotation-route77-leaf-37500.png`、`rotation-route77-leaf-mobile.png`、`rotation-flslgt-3s-desktop.png`、`rotation-flslgt-3s-mobile.png`、`rotation-itowks-sakura-76s.png`。

ADV另在本地 `.analysis/adv-particle-rotation-qa.html` 独立场景直接调用实际 `BackgroundEffectManager` 与 `loadImageTexture`，没有复刻一份渲染算法。普通雨2000ms为7粒子、暴雨为149；左镜头光效2100ms为2粒子、右镜头光效2000ms为1；冷加载及手机尺寸检查。最终冷加载会话 console error/warn均为空。截图 `rotation-adv-rain-normal.png`、`rotation-adv-rain-heavy.png`、`rotation-adv-rain-mobile.png`、`rotation-adv-flare-left.png`。

该独立场景最初遗漏HTML head导致开发服务报错，随后又误用PIXI.Assets加载器；均已修复QA场景，改用实际图片加载器并重启同端口服务、冷加载重验。没有通过关闭错误覆盖层或产品降级来掩盖失败。它只是ADV消费者回归，**不是完整剧情、原片或真机验收**。

后续：[父链渲染基](NATIVE_BILLBOARD_PARENT_BASIS_20261021.md)已把样例扩大到61例，并补齐本页之后发现的局部父矩阵/带符号尺度；以下保留本批验收边界。

## 保留边界

9个原生样例证明单位上下文的粒子角与纹理基，不能推定所有3D父链/非等比缩放/相机投影均已原生等价；这些更广的上下文仍需扩展原生样例。随机种子、Web60Hz参考积分及未消费21种粒子仍开放。没有修改RAW角度或逐曲调参，没有部署。
