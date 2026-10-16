# 随机动作持续调度：原生链与现有错误

输入 `stage/20261014-native-fidelity` / `e88f0471`。本批继续排除旧猜测，重读APK真实绑定、60个RAW歌曲bundle、原生控制器及随机池动画。只补取证工具/小型fixture和记录，尚未替换Viewer调度器；不能把下面的原生契约说成已经实现。

## 样本驱动共享动作，不能分位独立抽选

`LiveObjectIdol`的静态 `MotionManager.nextMotionNo` 初始为1。实例字段是三套不同状态：`currentRandomMotionNo` +0x70初始1；`isComplete` +0x74初始true；显示用 `currentMotionNo` +0x78初始1。不能将它们合并成“当前动作”。

APK resources.assets的LiveStage114160绑定六个LiveObjectIdol。前五个的 `_slotIndex` 为0..4；第六个MonoBehaviour109124名为 `LiveObjectIdol999`、`_slotIndex=0`。`get_isSample` 0x221b2f0按名字是否含999判断样本；`LoadFigure.MoveNext` 0x1bbe610按_slotIndex读取出演信息。因此样本使用第一名出演者的骨架，而不是默认body1或第六名偶像。

逐个重新读取118份RAW编排：21,860条Livechara_motion只指向1–5号，数量分别为5,146/5,133/4,805/3,412/3,364。没有指向样本的显式动作。目标查找 `LiveStage.GetTargetIdolObj` 0x1f29b84按charaNo-1索引六项列表；不能把value3=0解释成样本或广播。上述样本自由运行与显式脚本人物是两条状态链。

## 每帧更新的真实条件

| 原生步骤 | 方法/条件 | 当前Web缺口 |
| --- | --- | --- |
| 起跳门控 | `UpdateMotionIfNeeded` 0x221af68以 `1.5/baseTimeScale <= mainLoop.currentTime + danceStartOffset` 判断；用当前tempo，即四拍阈值 | 仍用tempo集合的上下界区间，未使用已经查明的conductor时间轴 |
| 推进共享号 | 仅样本且isComplete=true时，调用 `MotionManager.UpdateMotionIfNeeded` 0x1bbeb24；当共享号等于样本currentRandomMotionNo时取下一动作 | Viewer没有隐藏样本，也没有共享号状态 |
| 人物跟随 | 无播放中的_motionTween且自身currentRandomMotionNo不同于共享号：置isComplete=false、更新自身标记，安排随机延迟回调 | 现有每位置、每脚本独立派生一条group事件，没有持续跟随 |
| 随机回调 | `b__30_0` 0x221cd44在回调执行时重新读取共享号；速度为当时baseTimeScale；首段显式mix=.15动画秒，dance或before→after后排loop | 不能把抽到的动作、tempo永远固定成排队时的值 |
| 再次取号 | 回调给loop TrackEntry注册Complete；`b__30_1` 0x221d08c只置isComplete=true，下次更新再推进 | “每条脚本补一次、之后一直loop”不能替代这一环 |

`LiveObjectIdol.Update`按Unity组件Update进入这条链；不是LiveStage按六项数组手动依次更新。数组的序列化顺序不能据此证明Unity、Spine Complete与DOTween的帧内执行顺序。边界逐帧顺序仍需单独验证。

## 暂停期、随机延迟与两种RNG

`PlayMotionInner` 0x221c094首先Kill绑定人物和骨架的tween。它给显式命令建立的_motionTween为 `pauseTime + MotionRandomDelayMax`，期满回调 `b__1` 0x1bbe2d4把currentRandomMotionNo同步到当时共享号；不是期满即按所在group抽一条新动作。

ELF 0x317a310的float常量为 `0.05000000074505806`秒。可见人物普通动作/随机跟随用UnityEngine.Random.Range(0,此值)；样本延迟为0。当前Web没有这50ms的暂停尾部，且过滤掉pauseTime=0。真实语料有12条pause=0、10,052条普通正pause、11,796条长暂停值（>=999999），无负pause；mode1/2/3分别203/21,199/458条。

抽动作本身来自另一条随机源：`WeightedLottery<int>` ctor 0x2a21590创建System.Random，Draw 0x2a21380调用RandomExtensions.NextLong并累计字典权重；并非Unity的Range，也不是FNV按位置hash。Add 0x2a212a0对同motion ID累加权重；ItemCount是不同motion ID的字典数量。`GetNextMotionByMotionGroupId` 0x2211f14在ItemCount不等于1时反复抽到不同于上一个动作；单项池允许重复。系统随机种子与Unity全局随机流的历史状态未恢复，不能承诺同一首歌逐次抽中原机相同动作。

manager构造函数为group0放入motion1、weight10；group change erase会回group0，group add erase为空操作。本次RAW有545条group注册、90条group change、17种池动作，没有group change erase行；当前“没选group返回null”亦不等价于原生默认group0。`Init`存在Clear字典的实现，但本次读取的Prepare链没有证实调用它；不能假定每次group变化都清空池。

## 样本完成时间也不能继续猜

用实际SkeletonBinary解码当前17种池动作×五种body=85份动画payload；全部逐字节匹配RAW `live_costume_animation_2.unity3d`中的对应TextAsset。五种setup骨架也逐字节匹配RAW，避免用错误string table读出“可用”时长。

当前五种body的这些动画段名/时长相同，但仍保留逐body来源。14号 `heyhey` 的dance首段为float `1.2999999523162842`秒、loop为1.5秒；其他池动作相关段为1.5秒。样本首次Complete至少要算进首段与一次loop，并除以回调执行时锁存的baseTimeScale。不能只用loop长，也不能所有动作写死1.5秒。

`inspect-live-chibi-motion.mjs`现在额外输出未四舍五入的 `rawDurationSeconds`；原有展示用durationSeconds保留。`scripts/fixtures/chibi-native-random-motion.json`保存APK六槽、ELF方法窗口、60个歌曲bundle、5个setup与85个动画的hash及精确段长。

本地重新生成/校验：

```powershell
python scripts/verify-live-chibi-random-motion.py --native-elf E:/Tools/ghidra_work/sidem/libil2cpp.decrypted.so --write
python scripts/verify-live-chibi-random-motion.py --native-elf E:/Tools/ghidra_work/sidem/libil2cpp.decrypted.so
```

该工具验证完整ELF hash、choreography hash与118份身份覆盖，重读上述原始资源后比较fixture。没有生成新媒体、重导public/assets或修改舞台runtime。coverage登记为需本地APK/RAW的local-only检查。py_compile、verifier coverage、diff检查通过；本批无前端接线变更，不跑应用构建。

## 5212当前错误的实际见证

复用PID61564的stage工作树Vite，1440×900 In-app Browser，当前输入HEAD。DRIVE实际加载5/5，拖到37.3秒后，五个DOM动作依次为 **36、33、8、33、10**，source全为group，整首只有5条派生group事件。直接执行当前SFC的computed也确认这五条都在37,200ms，以位置参与hash独立选取。

截图/DOM JSON：当前任务visualizations目录的 `native-random-current-witness.*`。截图证明当前画面状态，原生共享号机制由上述方法体证明；没有用这张Web截图冒充原机对照。控制台无应用error，两条既有Spine warning。临时viewport已恢复；这是一项已复现的未修正发现，不能记成视觉通过。

## 下一步替换的边界

替换应一次串通：全局样本状态与抽选历史、各人物_motionTween与排队回调、当前tempo/Offset门控、精确动画完成回调、显式命令打断，以及播放/回拖共享同一历史。随机源需可注入以测试状态机；Web保留同一播放历史供seek重放，不伪称恢复了原机种子。必须先用同一随机输入带验证控制器状态，再用5212检查动作接替和回拖一致性。不要给旧per-position hash再加一个循环或逐歌时间补丁。
