# Livechara_Offset：随机动作启动条件（2026-10-15）

输入 HEAD `27a2953d`，分支 `stage/20261014-native-fidelity`。工作目录 `E:/Web_build/GS_Archive_Domain_Work/stage-native-fidelity-20261014/web_viewer`，复用 5212 / Vite PID 61564。未部署、未修改 read-model 候选。

## 原生语义

`Growing.Live.Livechara_OffsetLiveEffectTypeExecuter.PlayEffect`（`0x1f33308`）取 value1AsFloat，写 LiveStage `+0x50` 所指随机动作管理器的 `+0x1c`。dump.cs 将这两字段分别命名为 liveIdolRandomMotionManager 与 danceStartOffset；getter `0x2211d68` 也读同一字段。`EraseEffect`（`0x1f33350`）为空，不能当作 offset=0。

`LiveObjectIdol.UpdateMotionIfNeeded`（`0x221af68`）使用该值检查 `1.5/baseTimeScale <= SequencePlayer.currentTime + danceStartOffset`。SequencePlayer 的 `+0x50` 是 double currentTime。`get_baseTimeScale`（`0x221b270`）为 `1.5/((60/curTempo)*4)`；因此毫秒时钟下的启动门槛是 `currentTimeMs + offsetMs >= 240000/BPM`，即四拍。该条件约束自动随机动作；不将其作为 authored motion 的起点、相位或 XY 位移。

RAW 98 条均在 -2,000 ms 写 value1=50，对应原生 0.05 秒；覆盖 98 个编排，其余 20 个编排采用新管理器字段默认值 0。全部没有 erase；空操作行为由合成回归覆盖。

## 数据与消费者

- `prepare-live-chibi-motion-offset.py` 重读 60 个 bundle、118 个索引 TextAsset，按列名导出 time/sourceRow、offsetMs、erase 及 RAW 哈希。检查输入前后 bundle、choreography、谱面文件哈希。没有改共享资源、谱面或显式动作事件。
- 新数据 `public/data/stage-motion-offset.json` 为 58,422 bytes，SHA256 `a6c3f768870b089171e528fbd6e5512a094d314980210a91fffdceef76a90e6b`。绑定 choreography `c3e249f6afda4f7c4d4b05022d7fe778e3a1247378f679c58fa5ff8ead39ef0a`。每曲保留 difficulty=1 谱面路径、SHA256 与 BPM 集合。导出重复执行得到相同字节/哈希。
- 60 曲中 58 曲 BPM 恒定，remasq / smlegg 变速。当前谱面 offsetUnit 仍为 unverified，不凭它推算切换时刻。对于 BPM 集合，时钟低于所有四拍门槛时可确定未启动，超过所有门槛时可确定已启动，中间保留 pending。没有拿首 BPM 代替整首变速曲。
- `randomMotionDueTime` 为恒定 BPM 求首次可启动时刻，处理后续 Offset 赋值和 erase 空操作。接入 Viewer 的派生动作组接替：native gate 推迟时保留显式下一条指令优先级；确定已过门槛时保持原 dueTime。缺输入或变速边界不明时保留既有预览接替并标记 pending，不宣称该分支原生等价。
- 可选加载使用 bounded transport、lifetime signal 和实际 choreography SHA；晚到数据只在时间轴确有变化时重建当前动作并刷新事件指针。显式 `Livechara_motion` 的时间/速度/Spine fragment 路径没有加入 Offset。维护面板与诊断属性显示 Offset 和启动条件；RAW 矩阵由 missing 改为 partial。

## 验收

- Python：命名/重排列、毫秒字段、默认 0、erase 不解析无用值、非法 time/数值/flag。
- JS：四拍条件与等号边界、负 Offset、后续赋值、erase 不复位、同时间顺序、变速确定区间/未知区间、真实 SFC 派生时间轴、显式下一条动作优先级、异步 loader 哈希/取消/失败。
- `verify-chibi-motion-offset.mjs --published-assets` 对照全部 98 行与 RAW census，验证每曲谱面完整合同、SHA 和 BPM 集合。检查 10,052 个有限 pauseTime 的候选接替时刻，全部可确定已过门槛，0 个被推迟、0 个落在不确定区间。这是候选时刻的条件验证，不是 10,052 次真实随机动作或原片验收。
- RAW 矩阵、舞台资源所有权回归通过；`npm run verify:source-batch` **139/139** 通过。`build:check` 通过（20.83 秒），仅 `.analysis/build-check` 代码输出，不复制 public。生成的资源/翻译审计元数据已恢复。日志 `.analysis/motion-offset-build.log` 与 `.analysis/motion-offset-source-batch.log`。
- 5212 实际 Browser：DRIVE A LIVE，Offset=50 ms，1.6 秒 closed、1.7 秒 open，回到 0 后恢复 closed，预载后播放至 57.9 秒仍正常；切 smlegg 3/3 人就绪，1.9 秒 pending、2.7 秒 open。桌面 1440×900、手机模拟 390×844 均可用，无新增 app error。另以 1440×1200 保存可见覆盖说明。
- 截图目录 `C:/Users/windm/.codex/visualizations/2026/10/14/01a13b34-f8ad-7920-8ee0-22c322a422ee/`：`stage-motion-offset-coverage.png`、`stage-motion-offset-mobile.png`。

## 剩余

本批只收束 Offset 赋值与启动条件消费者，不收束整个原生随机动作系统。现有预览按确定性权重选择一次派生接替；Unity 随机小延迟、原生候选去重、完整重复调度、默认随机组初始化和动态 baseTimeScale 仍需继续对照。变速曲边界 pending 尚未解决；UI 所示“0 次接替时基未确认”只指当前派生候选时刻，不表示变速时钟已全面验证。矩阵保持 partial。没有原片逐帧、真机或发布包验收。
