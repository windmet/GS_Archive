# 类型5/6转动激光粒子与Animator接线

输入舞台 HEAD `a07981d1`，分支 `codex/chibi-stage-reconstruction-20261002`。验收时其他窗口已提交歌曲歌词至 `50e581cc`。未修改其工作文件。

## 来源与问题

原生 `resources.assets` LiveObjectLaserlight / MonoBehaviour106566 九项数组的类型5/6分别是 `fx_in_laserlight_turn_front` / `fx_in_laserlight_turn_back`。各有四个粒子系统和四个Animator，脚本原始数组中二者一一配对；原有消费者只画平移的Graphics线段，丢失了Animator。

原生Controller1347 / Clip1242 `angle10` 与 Controller1348 / Clip1243 `angle30` 是各一个默认状态、无条件转移/参数/混合树的三秒循环。解码后的streamed cubic曲线在1.5秒分别为10°、30°；每个粒子的中间父节点另有0.5°或1.5°初始Z旋转，其中两组带Y180镜像。不能把这四个控制器解释成单一线性角速度。

粒子使用Texture885 `laserlight_3`、Shader950 `Mobile/Particles/Additive`、0.15秒寿命/循环、alpha包络及底端pivot。世界空间模拟的粒子保留出生时刻的Animator角度，下一次出生才接受新角度。消费者通过同一歌曲时钟采样；倒退、关闭图层和切歌都不依赖累积动画状态。

原生守卫及证据见 [提取器](../scripts/live_chibi_turnlaser.py)、[原生fixture](../scripts/fixtures/chibi-turnlaser-native.json)、[模型fixture](../scripts/fixtures/chibi-turnlaser-model.json)。Animator必须与粒子属于同一GameObject、并匹配原生数组顺序；不支持的控制器、3D曲线、位移、shader或粒子模块拒绝输出。

## 验证

- `python -S scripts/verify-chibi-turnlaser-parser.py`：源PPtr、粒子/Animator配对、10/30度独立见证、父节点镜像和不支持控制拒绝通过。
- `node scripts/verify-chibi-turnlaser-particles.mjs --published-assets`：cubic、原生往返角度、世界空间出生角度、颜色、倒退、固定出生点与实际索引一致通过。原有激光回归及streamed animation回归亦通过，CI加入新门禁。
- 原生提取仍为63种小纹理，复用既有激光贴图，没有复制完整媒体。首次build:check在生成翻译审计文件时报告一次文件写入UNKNOWN并退出；确认没有在运行的同类生成进程后重跑成功：2786 modules / 15.69s，固定 `.analysis/build-check`、copyPublicDir=false。
- 既有5198 PID62924映射服务，Browser1280×720：いとをかし7.8s与10.8s从固定左右源点出现不同角度的紫色扫光，共8个粒子；关闭光束图层8→0，开启恢复8。Inner Dignity35.8s类型6从同样固定两点投射紫色转动光束。切歌资源清理后再切回いとをかし成功。
- Browser390×844：いとをかし10.8s保持同样扫光、画布不溢出，document scrollWidth=390。无error；有既有Spine tint getter/setter弃用warning，未把警告写成全站console零警告。不是实体手机验收。

截图在 `.analysis/engineering-validation-20261002/`：`itowks-turn-laser-7-8s.png`、`itowks-turn-laser-10-8s.png`、`itowks-turn-laser-mobile.png`、`inner-dignity-turn-laser-35-8s.png`。

## 边界与待核对

二维CSV角度轴对齐、根位置覆盖、sweepDuration与脚本3秒defaultDuration的换算仍为原有录屏指导的导演预览解释，原生函数体未恢复；不能声称Unity3D等效。已有いとをかし紫色扫光截图作为样式对照，没有完整录屏的精确时间码，当前角度/时刻尚未完成逐帧验收。

当前调用类型6的曲目为はんどめいど・きみはーと！、Inner Dignity、BRAND NEW FIELD；类型5为いとをかし。消费者推广覆盖这些调用，不等于四曲都完成录屏验收。类型1还需Sprite/Animator接线，类型2无当前曲目调用。

用户新增指出Not Alone宽度/落点疑似不准，当前等待其补充参考截图；保留该曲参数，未盲目调宽或挪位置。此前[宽光带审计](GS_CHIBI_SPOTBEAM_AUDIT_20261003.md)仅证明消费者运行，精度复核继续待办。Take旋转315 Logo等通用层缺口仍见[通用层审计](GS_CHIBI_COMMON_LAYER_AUDIT_20261003.md)。
