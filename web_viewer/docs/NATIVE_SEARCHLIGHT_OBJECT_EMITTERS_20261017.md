# Searchlight 与 ROUTE77 对象粒子

输入 HEAD 99c07d21；工作树 stage-native-fidelity-20261014；5212 原进程复用。

## 消费链路

Searchlight 七族原先全部 missing。现在 118 编排的 10583 条 RAW 指令绑定到 APK/所属歌曲 bundle 的 16 张 Sprite 原图；不是曲名白名单。Show/Show_2 的角度读取差异、独立淡出/颜色/旋转/缩放、节奏闪烁、六种椭圆轨迹都来自 LiveObjectSearchLight。

补查被 Ghidra 误截断的 OvalMove：0x2227578 是回跳 0x222500c 的跳板。实际分支表位于 ELF 0x32d4d80 / 0x32d4d90，第一程分别 +180/-180/+180/-180，返程终点 +360/-360/0/0。1–4 双程无限循环，5–6 单程。原脚本、材质、Sprite、方法窗口、分支表 hash 都进入来源凭据。

ROUTE77 的圆圈和移动星星就是 Searchlight，星星资源为 fx_in_grwsml_pinspotlight。另将 meter、turbo_1/2、fire_1/2/3 的全部 32 个原始粒子系统建表：12 个消费，20 个逐系统保留 deferred（15 个 Noise，5 个 stretched billboard）。meter 两系统完整使用两秒 burst/UV 曲线；另外 10 个包含火焰 UV 和限速星屑。没有把未支持系统算作完成。

对象发射器支持原始 point/box、循环和一次 burst、连续发射、停止发射后的尾粒子、UV、RGBA/size 曲线、局部 affine 变换、每粒子 AlphaMask。限速阻尼沿用已反查的 libunity 30Hz 时间基，轨迹积分仍为可回放的 60Hz 离散边界。随机种子是 Web 的确定性种子，非 Unity 原随机流。Noise 和 stretch 的 20 个系统未渲染，喷气和火焰仍为明确 partial。

为避免新对象第一帧迟装，播放/回拖准备全曲已支持的对象发射器，再进入时钟；已有容器在异步安装前同步采样。切歌和卸载统一退役。修复上一批误把独立 Whole_screen 清理放入 object index 首次细化的生命周期交叉问题；资源细化现在不会清掉另一个公共层。

## 验证

- 两个 prepare 脚本均可无 --write 重解 RAW/APK/ELF/PNG，对照 sidecar 和 fixture。
- source-batch 147/147；新增 Searchlight 六种轨迹闭式样例、完整语料有限值抽样、独立淡出/节奏闪烁、来源绑定和原图 hash；对象 burst 循环、StopEmitting、affine 矩阵、UV 和回拖通过。
- stage-intent 69 个受控时序/协议案例；per-renderer planes/masks 回归通过。
- build:check 最后一次 22.69 秒，无 public 语料拷贝；生成的 audit/translation 元数据恢复为基线。
- Browser 插件，真实 5212：ROUTE77 10 秒仪表盘/喷气（8 个活粒子），46.5 秒双圆灯（2），49 秒移动星星（8）及对象粒子（14）；50 秒起实播到 2:18 结束，再回拖 50.6 秒可见移动星星与火焰。console error 为空。1440×900 原图截图保留在本任务 visualizations 目录。不是 Unity 全特效逐帧等价验收。

## 最新追加排查继续进行

Take a StuMp! 的 264 条 Searchlight 已进入同一消费者（包含 5/6 模式）。Platinum MASK 的 71 条也进入同一消费者，其中 3/4 椭圆模式经 ELF 跳板补查后支持。Platinum 两侧入射光还存在独立 Object_layer：incidentlight_1/2/3 共 12 个系统，包含独立 XY 尺寸和镜像变换，需要扩展发射器 profile。Take 的灯串应继续追 fx_in_tkstp1_linelight_1..7 的对象系统，不等同于已经逐 renderer 消费的 Stagelight 17..22。
