# 旧悬灯零周期：Unity引擎取证（2026-10-16）

输入HEAD `d2e65175`，分支 `stage/20261014-native-fidelity`。本批是原生边界取证和可重放校验，不改变前端渲染、105份能力判定或媒体。承接[96/105能力批次](NATIVE_OLD_SUSPENSION_CAPABILITY_20261016.md)，9份受限编排仍未完成。

## 新证据

从本地配置XAPK的 `config.arm64_v8a.apk/lib/arm64-v8a/libunity.so` 读取17,675,384字节，SHA256 `acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0`，与当前worktree `.analysis/native-engine/libunity.so`完全相同。只保留已有二进制，删除了本轮重复提取的同哈希副本；没有提取或复制完整媒体包。

1. `UnityEngine.Animator::set_speed`字符串VA为 `0xd4ee4e`，注册函数 `0x1c924c` 用ADRP/ADD明确绑定wrapper `0x1c6fc0`，wrapper在 `0x1c7058` 调用实际setter `0xfb8cc`。不是通过相似字段或相邻函数猜出的setter。
2. setter `0xfb8cc..0xfb93c` 对普通模式仅将不大于0的输入改成0；`+Infinity > 0`成立。`0xfb8f8`原样写Animator成员 `+0x47c`，如果controller已绑定，`0xfb930`同时写 `*(controllerCache+0x130)` 指向的速度输入。这里没有isfinite拒绝、保留旧正速度或恢复默认速度的逻辑。
3. Controller图初始化/连接追到 `0xfb130`、节点构造 `0x100ba4/0x110a08`、controller绑定 `0x110f78`，及状态求值 `0x1113dc`。状态求值把 `node+0x130` 的速度写入输入结构 `+0x10`，并调用 `0x1368fc` → `0x135ca0`。这里的函数角色名为分析标签，原二进制无这些C++符号名。
4. `0x135c04..0x135ca0` 返回 `AnimatorSpeed × StateSpeed × abs(serializedStateSpeed)`；已验证旧悬灯默认angle60 state的speed=1且无自动transition。`0x135ca0..0x135f70` 的正常推进分支计算 `effectiveSpeed × deltaTime / clipDuration + priorNormalizedTime` 并写回。核心ARM64指令：`0x135d98 fmul`、`0x135d9c fdiv`、`0x135de4 fadd`、`0x135f38 str`。因此零周期传入+Infinity后，正deltaTime得到Infinity，零deltaTime可得到NaN；不能假定状态时间仍有限。
5. `0x865bcc..0x865d64` 将normalizedTime乘clip时长，并转换为double传给实际ClipPlayable的SetTime虚方法。到这里仍未找到原始状态时间的有限化或重置。**实际曲线采样、非有限时间的clip处理和Transform最终输出尚未证实。** 不能据此说屏幕上一定固定在某角度、消失或继续转。

Ghidra项目复用 `E:/Tools/ghidra_work/stage-unity-particles-20261015/project/unity-particles`，process `libunity.so`，全程readOnly/noanalysis。该项目imageBase=0x100000，所以反编译C的函数标签比本页ELF VA高0x100000；本页和receipt统一记录ELF VA，避免混淆。小型C/ASM/日志在本worktree `.analysis/native-unity-animator`；未提交二进制或完整反编译源码。

## 对旧实现的影响

重读105份已绑定RAW轨道：118条空Show中40条没有后续同key Show，78条后来有同key Show；这78条中**没有一条在后续Show前完成固定0.2秒Erase**。GetOrCreate `0x221a2d0`按字典复用实例，只在activeSelf=false时重新激活；旧悬灯PlayEffect `0x2226fec`没有Animator.Play/Rebind。后续有效Show写正速度本身也不重置状态时间。

据此排除以下替代实现：

- 跳过空Show、保持旧灯不动：原版仍写零位置/缩放及非有限速度。
- 空Show等同Erase：原版没有执行0.2秒退出、关闭对象或重建Animator。
- 给空周期补1/默认周期：原版TryParse失败返回0，实际setter接受+Infinity。
- 下一条有效Show自动从原有限相位继续：没有相位仍有限的来源证明，状态推进已显示非有限传播。

这说明上一批的9份边界不能仅靠“字段已接入”解除；也不应借此回退已通过能力合同的96份。下一项需追 `ClipPlayable.SetTime` 与循环曲线采样在Infinity/NaN下的真实分支，必要时以同版本原生运行/录屏验证最终输出。总目标仍包括这9份及其他缺家族，没有把部分支持改写为全部复原。

## 可重放校验

```
python scripts/verify-chibi-old-suspension.py --native-unity .analysis/native-engine/libunity.so
```

本批新增可选参数，读取真实Unity ELF，验证整体哈希、ELF映射、icall字符串、注册指令、wrapper实际调用、setter存储、状态时间推进指令和7段代码窗口摘要，对照 `scripts/fixtures/chibi-old-suspension-engine.json`。同一命令还按105份轨道文件摘要重算118条空Show，保存每条sourceRow、后续Show和Erase情况，验证78条后续Show均没有中间完成Erase。生成和不写入重放两种模式均实际通过；另跑原Python资源fixture、旧悬灯全部published-assets回归。可选native参数需要本地Capstone，不给CI增添Unity二进制或依赖。

以上是源码/二进制静态取证，不是执行了Unity引擎、ARM模拟器、Android真机或原片验收。本批未改前端，因此不重复Vite构建，也没有新增5212视觉结论；此前5212 Browser验收仍只证明当时的Web消费者行为。未部署、未改master，保留无关随机动作草稿。


后续：[ClipPlayable/streamed采样批次](NATIVE_STREAMED_NONFINITE_SAMPLING_20261016.md)已追通SetTime、modff循环与NaN立方求值，并区分欧拉/四元数回退。Web raw sampler不再将NaN改成有限初始姿势；最终动画Transform写回仍未证实，9份守卫保持。
