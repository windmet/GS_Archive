# 粒子模拟空间：字段映射与原生重力对照

输入 HEAD `053f13ec`，舞台工作树 `stage-native-fidelity-20261014`。本批反查先解决空间含义的不确定性，没有调整视觉参数或开放新的模拟剖面。

## 来源与结果

沿用 libunity SHA-256 `acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0`，Ghidra base `0x100000`，以下地址均为该 VA。

- 序列化 `0x6f1bf8` / `0x6f2248`：字符串 `moveWithTransform` (`0xede35d`) 绑定主模块 `+0x44`，`scalingMode` (`0xede387`) 绑定 `+0x48`。旧布尔格式读入后按 `value XOR 1` 转换；新格式读整数并归入 0..2。不能把字段名称中的 move 直接解释成布尔开关。
- `get_simulationSpace_Injected` 注册入口 `0x2ced40` 指向 `0x2ccfe0`，它调用 `0x6d8f78`；最后三条指令是 `ldr x8,[x0,#0x40]`、`ldr w0,[x8,#0x44]`、`ret`。RAW 字段确实对应公开 simulationSpace 值，没有发现隐藏的枚举换算。
- 原生重力/基础速度更新 `0x70dae8`：space!=1 时以 state `+0xcc` 起的矩阵变换重力向量，space=1 跳过。对象提取合同目前只接受 space=0；Web 对世界重力取发射器平面的逆矩阵，再在输出时投影回舞台。当前证据支持保留这条路径，不能因怀疑空间而改成世界坐标直接积分。

反编译小型证据在 `.analysis/native-engine/space-fields.c`、`space-icalls.c`、`space-getter.c`、`space-runtime-getter.c`，原生模块更新在 `initial-generate.c`。可复现数值进入已提交 fixture，不依赖这些被忽略的输出才能运行 JS 回归。

## 新增 CPU 证据

扩展 [原生重放工具](../scripts/prepare-chibi-noise-kernel-fixture.py) 的 gravitySpaceProof：直接执行 `0x70dae8`，12 组覆盖 space=0/1、单位矩阵、旋转90度加非均匀缩放、纯非均匀缩放，以及 dt=0.1 / 1/60。

PhysicsManager 查询 `0x3901f0` 的 ABI adapter 返回 null，让原生代码走内建重力 fallback；置位“已报告”标志以跳过诊断日志。未替换重力乘法、矩阵分支或粒子速度写入。测试使用合成逆矩阵，**不证明这个矩阵在完整 Unity 场景中的构造**，也不代表装有 PhysicsManager 的游戏配置已经重放。

例如传入平面 M=[0,-2;3,0] 的逆矩阵，dt=0.1：space=0 的速度增量为约 [-0.327,0,0]；space=1 为 [0,-0.981,0]。单位矩阵时二者相同。Web 回归还以同一矩阵的对象消费者积分60步，对照原生一步速度累计后的最终屏幕位移；旋转、缩放和重力不重复添加均通过。

## 验证与继续项

- fixture --write 后不带 --write 重放一致：12 导数 / 48 Noise worker / 12 多步轨迹 / 时钟序列 / 12 重力空间样例。
- verify-chibi-object-emitters.mjs --published-assets 通过；原有目录保持 78 资源、709 系统、28 preview、0 deferred。
- 仅增加分析工具、fixture、回归与文档；应用运行时代码、public 数据与媒体均未变，因此本批不重复 Vite 构建或 Browser 视觉验收。上批 5212 验收不是本批新增原片证据。
- scalingMode=0 的 renderer 尺寸/层级缩放、动态父变换、出生帧补算和实际帧序列仍未证明；不能因此去掉 Noise preview。Stretch 顶点求解器、Whole_screen 推广、无消费者资源与其它指令族仍未完成。
- 下一步沿主模块 +0x48 到出生/renderer 参数块追踪缩放，分别检查形状坐标、速度、尺寸，避免用一套末端矩阵冒充全部语义。
- 源码门禁 147/147 通过，日志 .analysis/gravity-space-source-batch.log；无部署、无主线合并。
