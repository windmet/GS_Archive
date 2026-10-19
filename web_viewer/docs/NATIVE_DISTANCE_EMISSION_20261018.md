# 静止对象的距离发射与系统 startDelay

输入 HEAD `956d72ce`；`stage/20261014-native-fidelity` 工作树。复用 5212 Vite PID 61564；没有部署或合并主线。

## 原生证据

本地 `libunity.so` SHA-256 为 `acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0`，以下均为 Ghidra VA，image base `0x100000`。

- Emission 序列化 `0x6ebc98`：rateOverTime 在 `+0x18`，rateOverDistance 在 `+0x38`。
- 距离求解 `0x6eb868`：非负 rate × dt × 发射器速度长度，和余量相加后取整发射，保留小数余量。不是按粒子自身移动距离发射。
- 调用者 `0x6d08f0`：用当前世界位置 `state+0xbc` 和上次位置 `+0x130` 求速度，写入 `+0x13c`；遇 `state+0x27` 时先把上次位置设为当前位置，避免首次摆放产生一条距离粒子。
- Play `0x6ce710` 设置该标志；`0x6d60fc` 重置 emission 状态与 RNG。原生反编译位于 `.analysis/native-engine/{emission-runtime,distance-callers,distance-reset,start-delay-runtime}.c`。
- **系统延迟初始化 `0x6cde10`**：从 main `+8` 的 MinMaxCurve 取一次值，mode 3 为 min + random × (max-min)，写入系统 `state+4`；由 Play 初始化路径调用。它不是逐粒子或逐循环的延迟抽取。旧 Web 实现这一点确实不对，本批已改正。

`scripts/fixtures/chibi-shape-native.json` 增加距离求解与延迟初始化的函数/字段和原始指令窗口，已有 `--native-engine` 入口检查完整二进制 SHA 与字节。

## 80 个晶体为什么现在可以接

IL2CPP `LiveObjectObjectLayer.PlayEffect` 先设置 localPosition / identity rotation / scale，之后 callback 才 SetActive / ParticleSystem.Play。四个目标资源在每份使用它们的编排中都只有一次 Show，之后只有 Hide。

提取器增加 `stationary-object-layer-v1` 证明，要求：

1. prefab 根没有外部父节点；遍历所有子 Transform。
2. 整棵树只有 Transform、ParticleSystem、ParticleSystemRenderer、SpriteRenderer 和精确绑定的 `Growing.Live.LiveObjectObjectLayerRefKeeper`（Assembly-CSharp.dll）。Animator、Animation、Rigidbody 或其它脚本均拒绝。
3. 每份相关编排只有一次显式 x/y/scale 的 Show；重复 Show 不借用静止证明。
4. 记录组件树哈希、编排事件哈希；运行时同时绑定对象索引与编排索引 SHA。编排改变或证明缺失时拒绝挂载。

因此这四个资源的发射器在 Play 后位移为零，原生距离项为零，但 time=0 burst 必须执行。**保留 distanceRate=1，并消费真实 burst；没有把 RAW 速率改成 0，也没有声称实现了移动发射器的距离历史。**

| 资源 | 原有 glitter | 本批 crystal | 总系统 |
| --- | ---: | ---: | ---: |
| fx_in_pavetl_crystal_1 | 15 | 15 | 30 |
| fx_in_pavetl_crystal_2 | 10 | 10 | 20 |
| fx_in_smlegg_crystal_1 | 21 | 21 | 42 |
| fx_in_smlegg_crystal_2 | 34 | 34 | 68 |

通用目录 78 资源 / **709 系统 / 0 deferred / 91 纹理**。新增两张 RAW 解码原图，各 9,913 bytes；共享 public/assets 未改。此前实现的 mode 2 起始寿命双曲线现在实际用于这 80 个晶体本体。

## 验证

- `python scripts/test-chibi-distance-motion.py`：5 项，通过静止、重复 Show、Animator、未知 keeper namespace、外部父节点边界。
- 提取器 `--mode current --consume-deferred` 不带 --write：重新读取 RAW、像素、fixture 与正式数据一致，78 / 709 / 0 / 91。
- `verify-chibi-object-emitters.mjs --published-assets --native-engine .analysis/native-engine/libunity.so`：通过。增加错误/缺失编排 SHA、丢失 motion proof、未知 distanceMode 的拒绝回归；所有晶体 burst 实际产生粒子并在 Stop 后退场。随机 startDelay 同一 burst 的八个粒子同时起始，各循环延迟一致。
- `npm run build:check`：2956 模块、22.21 秒，固定 `.analysis/build-check`，copyPublicDir:false。只有既有大 chunk 提示；无完整素材包。无关生成的翻译/资源审计文件已恢复。
- `node scripts/run-verifier-batch.mjs`：147/147，通过。二进制策略：387 PNG / 70,627,563 bytes，通过。
- 构建产生的元数据曾触发 dev 页重载；以下是构建完成、恢复元数据后重新加载的最终旅程。

5212 Browser 插件，桌面 1280×720：Pavé 12.2s 对象粒子 47，distance deferred 空；连续实播至 1:54 曲末自动暂停，再回拖 12.2s 恢复 47。原有 `fx_in_pavetl_panel` 仍明确 unsupported。

同一播放器通过曲目面板切到 スマイル・エンゲージ 12.2s：248 对象粒子，只剩本曲 crystal/panel 与共享 Incidentlight，无 Pavé 资产残留，unsupported/deferred 空，lightingIncompleteFrames=0。截图可见前沿晶体本体、星光及舞台光束。390×844 同时刻仍为 248，document.scrollWidth=390。console error 0，无框架遮罩，临时 viewport 已恢复、临时标签已关闭。

截图保存在 `.analysis/distance-{pavetl,smlegg}-12s.png` 与 `.analysis/distance-smlegg-mobile.png`。这是实际 Web 播放与生命周期验证，不是 Unity 真机随机序列或录屏同帧等价证明。

## 仍未完成

全库合并消费者仍有 **33 个无消费者资源 / 428 次事件 / 18 编排**，4 个 tibeti 源资源缺失。显式 partial 资源从 15 降为 11 是因为四个晶体不再 deferred，**20 个 Noise preview 与 8 个 stretch omitted 没有消失**。

移动发射器的距离余量/出生间距、Noise damping/remap、Stretch 顶点、Whole_screen Noise/type 6、Underlight/Smoke/单人脚光和 Sprite 逐实例动画仍需反查。Web RNG 仍是确定性回放流，不是 Unity 原随机流。下一批优先继续 Noise/Stretch 与余下 33 个资源的真实模块边界，不以当前目录 deferred=0 宣称舞台完整。
