# Home 口型排查与修复（2026-09-28）

输入 HEAD `475b209`，保留该提交的标题身份修复。对比 `49c97a9 → b51d31f`，useVoicePlayer、VoiceLipStore、LipSyncController、PixiStageManager、SpineStage 确无差异；本次只给 SpineStage 增加完成通知，不修改口型算法。

## 根因与上一轮结论纠正

### 1. 当前 5202 预览服务漏映射外部 lipsync

上一轮只检查了 public 中的路径，并将预览 HTTP 404 误判为本地素材缺失。实际 `config/archive_sources.local.json` 的 legacy_root 指向 `E:/BaiduNetdiskDownload/SideM`；`scripts/lib/archive-assets.mjs` 的 lipsync 根为其 `scripts/lipsyncdata/adxlip`。

以下文件真实存在，恢复 HTTP 映射后字节 SHA256 与配置来源一致：

| 文件 | samples | SHA256 |
| --- | ---: | --- |
| 001tom/2_1_001_01/2_1_001_01_00_09.json | 366 | 9c72437e868d3815ef628ce2882241c8e15629af89c0ab8786b5972a9c2b55f0 |
| 008rei/2_2_008_01/2_2_008_01_00_09.json | 390 | 685114d34ee116c80b8f15db4eb09efaaef74e69b9a3b92977b4900548897600 |
| 008rei/2_2_008_02/2_2_008_02_00_09.json | 436 | e445de2f1ecc8541cb582f174764f6cd66cb7344c75f7d3e932a2c531865dbef |

已修复仓库外临时服务 `E:/Web_build/SideM_Archived/.analysis/home-experience-qa/server-catalog.mjs`，直接复用 createArchiveAssetResolver.lipsyncPath，不复制文件。仍监听 5202，HTML/JS/CSS 来自当前 `.analysis/build-check`。Vite 原本已有这条资源映射。

仅恢复映射、尚未修改 Home 时，正常等待人物后播放：神楽麗采样峰值约 0.918、冬马约 1.0，mouth attachment 在 `*1` / `*2` 间切换。因此审阅中“这条原厂曲线不存在”的推断不成立，不能照此诊断所有 cue。

### 2. 语音早于 Stage 创建时丢失 talking

真实浏览器拦住异步 SpineStage JS，请求仍读取真实模型/音频。先点击播放，确认 lastStartedVoice 已设置且 canvas 数为 0，再放行 Stage。

修复前：人物随后出现，曲线回调未绑定，采样 max=0、talking=false，只见 `mouth_joy1`、`mouth_happy1`、`mouth_default1`。

仅在 manager ready 时 setTalking 仍不足：spawnSpine 先调用 removeSpine，后者清掉 pending talking。manager 已创建不等于人物已经投影完成。Vue 异步组件 exposed ref 的转发也不能只假定已在 child ready 时完成。

最终处理：

- Home 同时处理 ready 与 exposed ref 到位，renderer 切换重置 manager readiness。
- SpineStage 完成当前 step 的场景投影后 emit `scene-ready(step)`。
- Home 仅在未销毁、人物模式、step 与当前 renderStep 相同且语音仍播放时，重新绑定当前音频时钟。
- 停止、换模式、旧投影或卸载不重新启动 talking。
- 保留 card 模式不准备口型元数据的合同。换模式已有取消/重新准备流程；实测未证明该开关本身有问题。未另造播放器，也未修改嘴骨、mouthsetting、开口阈值或曲线采样。

## 验收

当前会话 Browser 插件技能不可用，复用 Playwright Chromium。页面 `http://127.0.0.1:5202/`，标题 SideM Story Viewer；真实 Home、人物、背景及音频数据。截图在本地 QA 目录，数据采样为主要口型证据，静态截图不代替动态测试。

| 场景 | 结果 |
| --- | --- |
| 正常人物首页：008rei / 001tom | talking=true；非零曲线；嘴形开闭切换 |
| 直接进入人物首页，语音先于 Stage | 修复后 talking=true、max≈1.0，嘴形 *1 / *2 切换 |
| card → spine，异步 Stage 延迟，立即播放 | 修复后 talking=true、max≈1.0，嘴形 *1 / *2 切换 |
| 模拟所有 lip URL 返回 404 | audio 已启动、Stage 已到位、talking=true，但 max=0，嘴保持 *1；明确为模拟缺曲线，不声称找到真实素材缺口 |
| HTTP 实源检查 | 上表三份 200、非零源数据、字节哈希一致 |

通过 `npm run verify:home`（新增 manager/ref/scene 迟到、旧 step、停止、card、销毁保护）、`npm run verify:home-neck-contract`、`npm run verify:story-audio`、Terminal 40 项合同、`npm run build:check`、`git diff --check`。

独立实源检查：`node scripts/verify-home-lipsync-http.mjs http://127.0.0.1:5202/`。它是有本地来源和 HTTP 服务时使用的验收脚本；不把未映射资源再误报成源文件不存在。

QA 证据：仓库外 `E:/Web_build/SideM_Archived/.analysis/home-experience-qa/` 中 `lip-baseline.json`、`lip-late.json`、`lip-switch.json`、`lip-missing.json` 及同名截图、脚本。浏览器数值取自真实 spine 的 customIsTalking、getVoiceVolume 和 mouth slot attachment。

未主张全库口型覆盖、人工听音、iOS 真机或远程测试站部署验收。当前 5202 本地服务已经修复；旧浏览器页面需刷新以取得新 bundle。
