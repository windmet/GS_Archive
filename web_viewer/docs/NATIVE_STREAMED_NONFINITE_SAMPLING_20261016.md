# 非有限时间：ClipPlayable与streamed曲线（2026-10-16）

输入HEAD `870c5e83`，分支 `stage/20261014-native-fidelity`。承接[Unity速度与状态时间取证](NATIVE_OLD_SUSPENSION_NONFINITE_20261016.md)，继续使用同哈希的本地Unity ELF、现有Ghidra项目；补充结果保存在 `.analysis/native-unity-animator`，未复制媒体或新增引擎二进制。

## 本批追通的来源

- Clip节点构造 `0x8665a4` 写vtable `0x10b3f90`，资产getter `0x8666d0`读取绑定clip成员+0x1d0。vtable +0x30为该getter，+0x28为 `0x8680a4`。因此controller的虚方法SetTime链可以精确绑定到实际clip节点，不靠相邻函数猜测。
- `0x8680a4..0x8680d4`记录旧时间后尾调用 `0x33a758`。后者直接将输入double写到+0x60，并可传给子节点；没有有限化。此前猜测“ClipPlayable会自动把Infinity钳制回有效时间”不能成立。
- `0x866814`将clip时间除以duration转成float；`0x865eec`经 `0x6ab648`处理循环，再进入 `0x11e79c`/`0x11e82c`streamed采样。循环函数调用PLT `0xaf9c0`；ELF .rela.plt `0xae138`、symbol241、GOT `0x10d2748`证明实际导入名是modff。
- 这里的modff不能替换成JS `%`/fmod。Infinity的小数部分是带符号零；NaN仍为NaN。数学语义参考[AOSP bionic实现](https://raw.githubusercontent.com/aosp-mirror/platform_bionic/master/libm/upstream-freebsd/lib/msun/src/s_modff.c)。该公开源码是外部函数语义旁证，不是原Android设备libm二进制验收。angle60 clip起止为0/2、loop=true且零cycleOffset，Infinity循环路径回到起点角度0；它不是继续原有限相位转动。
- `0x11ea98`缓存流帧，不将曲线数量清零。NaN不会命中缓存相等判断；候选帧FCMP后的HI分支包含unordered，会跳过帧读取，不加载一个正常新帧；`0x11e82c`随后仍以NaN elapsed进行立方求值。已有有效系数也不能把这个输入变成有限初始值。

## 必须分开的旋转通道

`0x118894` 的generic transform绑定有两条不同分支：

| 通道 | ARM64路径 | 来源含义 |
| --- | --- | --- |
| 四元数曲线 | `0x118a78..0x118acc` | 计算norm并用FCMGT/BSL选择安全归一化值或单位四元数；常量0xd41b60为(0,0,0,1) |
| 欧拉曲线 | `0x118ae0..0x118bf0` | 读取XYZ度数、计算欧拉转换，直接在0x118bec写Quaternion；没有前述norm有效性选择 |

旧悬灯clip generic binding是Euler属性4，走第二条。不能把第一条的单位四元数回退套给它。原生Transform公开localRotation setter `0x2fe3b8`也有安全归一化，但还没有证明Animator最终写回使用这一公开setter；其已查看调用者并未建立这条动画路径，因此也不能借用该回退作为最终显示证据。

当前已证明到欧拉转换输出，**最终Animator pose/Transform写回及NaN分支画面仍未证实**。9份能力边界保持，未新增“固定为0”“保留旧角度”或“直接隐藏”的猜测。

## 明确修正的旧行为

`src/core/chibiNativeAnimation.js`原先用 `keys.findLast(key.time <= seconds)`；NaN比较全部失败，随后返回curve.initialValue。这个有限默认值会将异常时钟伪装成正常初始姿势，与原生streamed立方求值不符。

本批只让raw streamed sampler显式传播NaN。有限时间、负时间的初始化和普通关键帧采样不变；Infinity循环归约属于上层clip时间处理，不能直接拿raw sampler替代循环函数。本批未改9份守卫、未让它们带NaN进入Pixi，也不声称已恢复9份完整灯光。

新增回归要求：NaN不能成为有限初始姿势；原生angle60在0/1/2秒仍为0/60/0，负时间仍读initialValue。旧悬灯全published-assets、粒子激光/18束Sprite激光、转向激光、Penlight、logo、背屏注册与阴影回归均通过。原生校验命令增加16段窗口、vtable指针、modff动态导入和两条旋转分支的明确指令断言，生成与不写入重放均通过：

```
python scripts/verify-chibi-old-suspension.py --native-unity .analysis/native-engine/libunity.so
node scripts/verify-chibi-old-suspension.mjs --published-assets
```

144/144源码门禁；build:check 2950 modules/21.40秒，copyPublicDir:false、固定.analysis/build-check。无完整媒体包、无部署，master ancestry提交前重查，无关随机动作草稿保留。

Browser5212复用PID61564的本分支Vite，冷加载Study 6秒复查Pinspotlight；Infinite Octave! 12秒复查已支持旧悬灯的有限曲线采样，手机390×844及回拖/播放检查，返回歌曲确认URL与实际难度表。无应用error，保留既有Spine弃用warning。截图前缀curve-nan。Browser只证明Web消费者回归，不是向原生Unity注入NaN后的运行或真机证据。
