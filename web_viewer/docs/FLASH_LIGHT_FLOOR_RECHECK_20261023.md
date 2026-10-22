# FLASH LIGHT 地面花瓣与粒子复核

2026-10-23，输入 HEAD `87616418` 加本批火焰改动，分支 `stage/20261022-particle-gaps`。本项只复核，无 FLASH LIGHT 代码或资源修改。

用户担心逐瓣变色仍沿用反编译前近似。核对发现已在 [10-15 地面灯光批次](NATIVE_STAGE_FLOOR_LIGHT_BATCH_20261015.md) 取代旧规则：`StageLightLiveSpriteEffectDirector.BeginAlpha` RVA `0x1da3ec4`、`BeginColor` `0x1da52c8`、`BeginColorRainbow` `0x1da58bc`、`BeginColorGradient` `0x1da5b30`，以及 `LiveObjectLightSpriteEffect.SetColor` `0x221e85c` 均有记录。value4 控颜色、value5 控 alpha；脚本 RGBA 直接赋值，不重复乘 prefab 初色。多个 Mobile/Particles/Additive Sprite 叠加构成花瓣，按各自灯 ID 和时间变化。

本次重新运行 `prepare-live-chibi-stagelight-commands.py --output .analysis/flash-stagelights-recheck-20261023.json`：118 编排 / 29661 行，重生成输出 SHA256 `1b2e1931236f264ce6beb04bbe82f52a5c2b65b5518f802cbabfdcd3253353d6`。与当前 published JSON 内容深比较完全一致；Windows 检出换行不同，未以工作树字节 hash 不同误判参数变化。

当前 `chibiStagelights.js` 保留 HSV、独立 alpha、立即 erase、ADD 合成和直接赋色；实际 Vue 消费者逐 renderer 应用 tint/alpha。真实编排为 84.55s 开始持续 HSV，89.0s 起各片逐次转红，93.3s erase 后 93.4s 起重新渐入。不是一整张地板同时换色。

当前回归 `verify-chibi-stagelights.mjs --published-assets`、`verify-chibi-stagelight-prefabs.py --published-assets`、`verify-chibi-bloom.mjs --published-assets`、粒子生命周期和 floor verifier 全部通过。预制体校验覆盖 22 灯 prefab / 87 有序 Sprite 绑定，包含材质、atlas、原生颜色和透明度；Bloom 为三组九个发射器，扩散阻尼另有 [原生引擎核对](NATIVE_BLOOM_DAMPING_20261015.md)。

本次 Browser 为主 checkout 5213/PID25568、候选 `rm-release-20261015`，桌面 1280×720、完整模式、沿用手动四人编队，非原曲成员验收：

- 89.4s，49 个灯状态，红色中心与黄绿外瓣同时显示；部分 ID 为 `#ff0000`，未转红外瓣为 `#a2b300`。
- 93.8s，后续红色渐入与 160 个 Bloom 粒子就绪，unsupported 为空。
- 倒拖 89.4s，完整颜色诊断与先前一致；console error 为空。
- 小图 `flash-light-petal-recheck-89400.png` / `flash-light-bloom-recheck-93800.png`，保存于本任务 visualizations 目录。没有因纯复核再构建，复用本批已通过的代码构建。

结论：用户所指逐瓣变色及叠色已有反编译依据，当前未发现链路回退，无需重做。原生随机序列、设备/原片逐帧与整体相机投影的既有边界保留，未扩大为整曲原机等价结论。

## 追加：Center 台词嘴型状态

本次代码检查确认：`useStageOneshotVoice.js` 只负责独立 Audio 元素，未返回嘴型曲线/采样；`ChibiStageViewer.vue:applyCurrentLipSync` 仍只消费歌曲曲线、当前演唱位与 MouthFix。故网页尚未单独接入 Center 台词嘴型，音频接线通过不能当作嘴型通过。

重新阅读本地 `Growing.Live.Unit_serifLiveEffectTypeExecuter` 的带注释反编译：RVA `0x19c6b28` 以 deck 卡拼 cue 后调用 `SoundManager.PlayVoice`，未直接调用嘴型。原版是否通过共享语音回调驱动尚未核定；不能仅凭这一函数断言原版不动嘴，也未新增基于音量的替代实现。此项保留待查。
