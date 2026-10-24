# 固定嘴型 RAW 与舞台消费者（2026-10-15）

**2026-10-23 纠正**：本记录将 `GetTargetIdolObj(value1)` 的原生角色列表编号误称为画面站位。RAW 参数和补间计算正确，但 Viewer 曾漏做 `stagePositionMap` 转换，FLASH LIGHT/precious love 的 target1 因而作用到画面1而非中心3。已修正消费者并加入两首真实台词时窗及四份编排的映射回归，见 [Center 嘴型目标修正](NATIVE_CENTER_MOUTH_TARGET_20261023.md)。下面的旧站位验收只能证明旧实现，不能作为正确目标的证据。

输入 HEAD `bacdaddd`，分支 `stage/20261014-native-fidelity`，工作目录 `E:/Web_build/GS_Archive_Domain_Work/stage-native-fidelity-20261014/web_viewer`。继续使用 5212 的现有 Vite（PID 61564），没有部署或切换 read-model 候选。

## 原生来源

- `Livechara_mouth_shape_fixLiveEffectTypeExecuter.PlayEffect` `0x1f33814`：value1 是场景站位，value2AsFloat 是开度参数（RAW /1000），value3AsFloat 是秒数（导出保留 RAW 毫秒）。立即执行参数会将时长置零。
- `EraseEffect` `0x1f33950`：同 value1 目标，时长来自 eraseDuration/value102；value101 标识擦除。目标选择 `IdolLiveEffectTypeExecuter.GetTargetIdols` `0x2342c18`：0 遍历 1…5，正数直接按场景站位查找，没有换成 performerSlot。
- `LiveObjectIdol.FixMouthShape` `0x221c914`：Kill 旧 tween，从当前 fixedMouthOpenRate 渐变至 `Mathf.Lerp(0.15, 1, value2AsFloat)`，立即置 isFixMouthShape=true。`CancelFixMouthShape` `0x221ca0c`：Kill 旧 tween，从当前值渐变回 0.15；完成回调 `0x221d0a8` 才解除固定标志。构造器 `0x221cb50` 初始 fixedMouthOpenRate=0.15。
- ELF LOAD 映射读取 `0x318cf34` 得到 float `0.15000000596046448`，构造器也写 `0x3e19999a`。默认 OutQuad 依据既有 [DOTweenSettings 资源与 cctor 检查](NATIVE_DRIVE_LIGHT_CHANNELS_BATCH_20261014.md)。本执行路径没有覆写 ease。
- 原生 `UpdateMouth` / helper `0x221c798`：固定时不用演唱标志，开度大于 0.15 选 open attachment，并将 mouth bone ScaleX 直接设为固定值；否则选 close attachment、ScaleX=1。head slot 的 `head_fl` 选择镜像 attachment。固定分支没有改 ScaleY。

## 数据与接线

`prepare-live-chibi-mouth-fix.py` 重读 60 个 RAW bundle / 118 个索引 TextAsset，按命名列导出 `public/data/stage-mouth-fix.json`，保留 time/sourceRow、target、openRate、duration、erase、RAW 来源和 TextAsset 哈希。导出前后检查 bundle 与 choreography 哈希，不重写共享资源。总计 29 条，四份编排：FLASH LIGHT 14、precious love 7、Platinum MASK 6、VIVA!!ファミリーリズム 2。

数据文件 44,682 bytes，SHA256 `93c170fc7c763f9602d7fb452bf174cfc26e2d411f2f3549c13e84b2b5ff768c`。绑定 choreography SHA256 `c3e249f6afda4f7c4d4b05022d7fe778e3a1247378f679c58fa5ff8ead39ef0a`。加载器使用现有 bounded transport 和 lifetime signal，实际计算当前 choreography SHA；错版、取消或 HTTP 失败不能安装为成功结果。

`mouthFixAt` 从完整命名事件重放，保留 OutQuad、中断后当前值、同时间源码顺序、指定站位、擦除完成再释放。Viewer 与动作、歌曲口型共用 stageTime；可选数据晚到后在暂停状态立即采样重绘。Spine 的实际 updateWorldTransform 钩子在动画之后重施固定嘴型；固定解除、回跳到指令之前或切到无该指令编排后恢复既有歌曲口型，不新增定时器。

维护面板显示当前编排固定嘴型来源行数和固定站位数，根节点提供站位/开度诊断属性。RAW 矩阵从 missing 改为 partial，其他未接指令仍保持缺口。

## 验收

- Python verifier：命名/重排列、空 value1=0、开度与时长单位、erase、同时间行序、坏数值与非法 target/flag。
- JS verifier：OutQuad、中断 Fix/Erase、目标 0 的 1…5 边界、单站位解除、钳制、即时参数、反向 seek、真实 Spine 钩子（固定优先于非演唱状态、镜像、绝对 ScaleX、保留 ScaleY、恢复歌曲口型）；执行真实 SFC 消费者检查站位/源身份/切歌清理。真实加载器的 hash、取消和失败回归通过。
- `verify-chibi-mouth-fix.mjs --published-assets`：29 条全量事件，四份编排，与 RAW census 每份行数一致，全部目标站位关键时刻采样有限值。RAW 命令矩阵、舞台资源所有权回归通过。`npm run verify:source-batch` **137/137** 通过。
- `npm run build:check` 通过（21.10 秒），只有 `.analysis/build-check` 代码输出，无 public 语料复制；构建生成的资源/翻译审计元数据已恢复。日志 `.analysis/mouth-fix-build.log`、`.analysis/mouth-fix-source-batch.log`。
- Browser 实测 5212：FLASH LIGHT 4/4 人就绪，19.0 秒无固定；19.2 秒位置 1 为 0.3451；19.4 秒为 0.5325；19.9 秒擦除中仍固定、开度 0.3200；20.0 秒解除。75.9 秒位置 1…4 均为 0.7450；77.7 秒擦除中均为 0.2161；77.8 秒解除；回跳 75.9 秒恢复四站位固定。切 DRIVE A LIVE 后位置和开度诊断均为空。
- 桌面 1440×900 与手机模拟 390×844，页面、舞台和控制可用，没有框架报错遮罩或新增 app error。截图在 `C:/Users/windm/.codex/visualizations/2026/10/14/01a13b34-f8ad-7920-8ee0-22c322a422ee/`：`stage-mouth-fix-all-75900.png`、`stage-mouth-fix-mobile.png`、`stage-mouth-fix-19400.png`。19.4 秒镜头中的位置 1 在边缘，整组截图使用 75.9 秒。

## 边界

本批验证命名来源、原生参数和浏览器状态/绘制，不证明原片逐帧等价、实际手机性能或发布包完整性。没有将普通歌曲口型的既有阈值/缩放近似升级为原版证据；固定嘴型采用单独的原生阈值与绝对开度分支。Unity/DOTween 实际帧内更新时刻、不同头部/全部服装的视觉表现仍待原片/真机覆盖。单人脚光、动作 Offset、Searchlight 等剩余家族未在本批宣称完成。
