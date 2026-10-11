# Growing / Drive 灯光接线与 FLASH LIGHT 镜像修正

输入 HEAD `7efd97e5`，分支 `codex/chibi-stage-reconstruction-20261002`。本批按用户的 Growing Smiles、DRIVE A LIVE、FLASH LIGHT 对照图以及绿灯四张顺序截图推进；首张原片时间约 0:16。原片播放器时间与脚本时钟不能直接认定相同。

## 已修接线与影响范围

- `Livechara_Foot_Color` 的 rate 曾被 legacy `characterLightEvents.opacity` 当成整个人物乘色，导致 Growing 开头的脸和身体过黑。移除该错误映射，保留独立的 Body_Color 与有明确人物目标的聚光明暗。无目标的环境灯不能把全员压黑。112 个编排、54 个曲码、2161 条 Foot 指令受此修正影响。
- 原生 Skeleton-Gradient 的局部高度替换色接口已拆出；**rate 到 shader uniform 的映射未恢复**。先前尝试的强脚部染色已撤回，当前 height=0，不启用推测的 GPU 渐变。接口的数学验证不代表原游戏脚部效果已经恢复。
- 旧悬灯原来仅启用 Moon Night；新放开 Growing 21 个、Drive 20 个编排，共新增 41、总计 42/105，剩余 63 个保留限制。增加显式的 `referenceProjection`，不把新坐标注册自动推广到所有曲目。
- Drive 蓝光固定竖直；黄光保持角度、只变亮度；绿光先保持 M 初始状态，再围绕各自发光点按上方 6000 ms / 下方 5000 ms 周期转动。左右角度镜像，局部发光点不随时间平移；整个舞台仍跟随原有 Camera。
- RAW 先给极大 `value4` 再给 6000/5000，之后另有 erase。将它作为旋转周期候选，撤回原来的寿命解释，避免在显式退场前提前丢灯。退场 `extraValues.value102=2000` 接入两秒渐隐。
- `value6` 作为新注册下的光束尺寸候选，不再当 Animator 速度。源点、尺寸各接受一次 viewport/environment 比例，Camera 父容器另应用一次镜头比例；没有重复叠乘环境缩放。离屏黄灯采用单独的参考注册，Moon 保留之前的平面注册。
- Drive 背屏 `live_backmonitor_movie_cool_01_2` 接入已有的原生两秒旋转曲线和固定中心 projective mesh。20 个编排的关闭行都提供 `value7=1000`：只在 Drive 标志接口解释为一秒 fade，保留原有电影/Take 控制边界。自定义 shader 增加 alpha uniform；隐藏期间旋转继续，支持 seek 和中途反向渐变。
- Drive 地面 `fx_in_drvalv_panel` 新增 directed-box 通用粒子类型：4 个发射器、2 个独立遮罩、400 上限。目录从 20 到 21/49，28 个仍 deferred；21 中有 20 个完整输入类型及 1 个部分火焰类型。新增物件被 20 个 Drive 编排引用，不能将此数与曲码混为一谈。

## FLASH LIGHT 的确定根因

16 秒附近的光束由 `Object_layer` 引用 `fx_in_ossshd_spotlight_4`，不是 Pinspotlight/Spotlight 指令。原生 child quaternion=(0,1,0,0)，绕 Y 轴半圈应产生水平反射。旧导出只求 Euler Z，输出平面 -180°，错误地同时翻转上下，造成上宽下尖及脚部宽度异常。

新的通用转换保留三维 quaternion、scale、translation，通过整个相对父链后再投影到既有 XY 预览。二维分解保留有符号 scaleY 与 skewX，消费者读取两者。`_4` 和 `_5` 的修正输出 rotation=-180°、scaleY=-1；合成结果只反射 X，竖直方向保留。原生纹理、PPU、pivot、CSV scale=1100 保留，没有另加加宽系数。

扫描现有 35 个源 bundle 的 Sprite 实例，9 个物件的投影值改变，关联 22 个曲码：

`anwhre, bnckgy, flslgt, hrkzbn, infoct, inndgn, jfhtmk, knwonl, ksktfg, ldyrdm, mainha, montns, ossshd, pcuslv, plmask, swyrlv, tnsdst, trhorz, unmikn, vctblv, wtstry, yknkmh`。

9 个物件为 bnckgy overlight 2/4、ksktfg kasumi、ossshd spotlight 4/5、vctblv overlight 1/2、yknkmh overlight 2/3。其余导出投影数值未改变。完整差异留在 `.analysis/engineering-validation-20261002/object-transform-reprojection.json`；小型原生光束父链 fixture 随源码提交。22 首仅是数据影响范围，不是 22 首录屏验收通过。

## 验证与证据边界

相关 native parser、foot/body 隔离、旧悬灯、logo fade/mesh、floor 双遮罩、object quaternion/真实 SFC signed scale、pinspotlight 生命周期回归通过。新增测试进入 source gate；此记录不声称远端 CI 已运行。

最终 `npm run build:check`：2796 modules，17.30 s，复用 `.analysis/build-check`，`copyPublicDir:false`，没有创建完整媒体包。既有 5198 服务 PID 62924，映射该生产 bundle、现有 public 与 `E:/Web_build/GS_Archive_Domain_Work/song-discovery-readmodels-20261002`。共享工作区另有舞台控制台/门户改动；本次 Browser bundle 包含它们，但提交只取本批灯光接线，不收整份混合 Vue diff。

真实 Browser：

- Drive 8 s 蓝灯、11.7/12.7 s 黄灯暗/亮、18 s M 起始、21/23 s 两侧交叉到压低；29.6/30.1/30.6 s logo alpha=1/.5/0。灯束图层关闭可清空可见 ID，恢复可重新出现。
- Growing 5.2 s 对应 Smile 句：脸/body 不再被 Foot 控制压黑，顶灯可见。
- Moon 6/20/105.1 s、Study 20.5 s 切歌/回退检查；Study 未启用未知脚部高度映射。
- FLASH LIGHT 16 s 修正后向地面展开的光束，底部宽度随原贴图恢复。最终 bundle 的 Drive 与 FLASH 实际截图已保存；最终改动后再抽查 Moon。
- 当前 QA 会话没有新增 console error。未覆盖实体手机、所有 22 首逐帧、完整录屏速度/起始相位、Unity 透视相机或加密脚本体的精确等价。

截图位于同一 `.analysis/engineering-validation-20261002`：`drive-final-8000.png`、`drive-final-18000.png`、`drive-final-21000.png`、`drive-final-23000.png`、`drive-final-29600.png`、`drive-final-30100.png`、`drive-final-30600.png`、`flash-final-16000.png`、`growing-final-5200.png`、`moon-final-6000.png`、`moon-final-20000.png`、`moon-final-105100.png`、`study-final-20500.png`。早期试验的 foot-light/旧固定 M 图片不作为最终结论。

坐标注册、旋转参数解释、黄灯两秒强度相位及粒子二维投影仍为来源/录屏约束下的预览实现；明确可证的修复是 Foot 与 Body 接线分离、三维 Y 半圈反射，以及 Drive 指令的持续显示/渐隐链路。
