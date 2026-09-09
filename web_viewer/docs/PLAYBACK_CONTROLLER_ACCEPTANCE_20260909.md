# D2/F 播放器所有权接管

日期：2026-09-09；起点495ab55。本批接管既有播放器路径，为D2接线建立完整owner。
Reader指定句演出、返回同句和目录阅读入口仍未接通；本批不能记为D2/F闭环完成。

## 接管范围

useStoryPlaybackController 统一拥有 currentScenario/instance、加载/进度/错误、
播放文件与范围、预览cue、返回目标，以及 EpisodeQueue 的启动/恢复/下一话/清理。
URL refs仍由useArchiveNavigationState创建并借给controller，未复制成另一份store。
controller内部创建唯一EpisodeQueue；App只提供按产品页面解析的有序episode列表。
prepareScenario和原Preloader职责不变，navigation intent继续决定异步有效性。

App的loadScenario、openVoicePreview、startEpisodeQueue、playNextEpisode、
closePlayer、onPlayerReady现为委托入口；路由恢复也走同一controller。
App不再直接写入currentScenario、instance、播放范围和预览cue。非播放器commit、
历史恢复及卸载都经controller释放；dispose使旧请求失效并清除加载状态。

卡片资料解析和语音cue选择仍在产品侧，controller接收生成预览的函数。
预览与普通故事都在成功发布时推进instance，避免同类组件复用遗留旧状态。
缺失cue恢复到卡片页面；缺失剧情深链恢复故事目录并显示错误提示。

## 本批行为修复

过去下一话会在请求前推进queue cursor。现在只在当前intent成功准备并发布剧情后
提交queue变化；请求失败保留旧episode与范围，重试不会跳过下一话。
恢复同文件不同范围也在成功后按file+range选定队列项，不只按文件命中第一项。
旧请求成功、失败或报告进度都不能覆盖新导航；关闭和卸载不等待旧网络完成。

## 验证

- verify:playback-controller：真实controller执行，覆盖队列原子提交、下一话失败/
  重试、同文件不同范围、历史恢复不写URL、预览清队列及instance、关闭、过期进度、
  卸载后失败和错误清理。
- verify:archive-async-navigation保留原用例，App委托接到真实controller，覆盖
  旧响应/资源预加载/目录切换/路由恢复/卡片预览/HTTP与格式失败；新增失败深链
  回到可用目录，菜单离开后清除错误。
- verify:archive-startup-route、verify:episode-queue（744真实范围，合成同文件范围
  另有用例）、verify:card-voice-preview、verify:reading-sources、reading-navigation、
  verify:portal-navigation、verify:archive-navigation-state、verify:routes、
  verify:archive-baseline:source-only通过。
- source-only Vite build通过；copyPublicDir=false，2,485 modules。主chunk仍超过
  默认500kB提示，本批未调高阈值或宣称启动性能完成。

Browser/IAB核对5175进程属于本checkout。实际打开
`episodes/1_4_001_01_d.json`的start_step=7/end_step=10，显示1/4及
「……ああ、そうだけど。」；可推进并到达完成状态。
同文件start_step=8/end_step=9显示1/2及「結構いい曲だなと思っただけ。」。
退出第二次演出后恢复main/101/story_collection，canvas为0。
缺失`episodes/not-present.json`深链恢复story_catalog并显示错误，canvas为0。
成功路径无console error；保留两条Pixi兼容层warning调用栈（Spine.update/tint），
没有为了本批扩大为Runtime审计。失败路径的请求/加载错误为刻意测试结果。
这只是正常媒体路径的短交互检查，不证明听感、所有cue或正式长稳。

错误反馈截图位于
`C:/Users/windm/.codex/evidence/sidem-playback-controller/2026-09-09/missing-scenario.png`。
没有修改公开compiled/translation、扩大strict-v2发布或部署。

## 下一步D2

1. 现有startStep同时影响范围下界，不能把阅读目标句直接当范围起点。需要明确
   独立起播位置，并保留原文件/episode范围；验证源step_id与数组index的区别。
2. 阅读锚点携带文档/来源版本；在媒体预加载前核对当前compiled与阅读产物，
   过期或不匹配必须给出明确反馈。
3. 选定现有故事集合入口提供阅读与演出，完成刷新、历史、同文件范围和从无来源
   深链进入的返回策略。Reader返回上下文继续使用现有nav refs/intent，不造队列。
