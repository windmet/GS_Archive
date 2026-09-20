# 剧情门户问题修复（2026-09-20）

输入：用户问题包 `剧情门户问题梳理.zip`，代码基线 `83d2a99`。
附件中的历史分析是待验证假设；手动推进目标采用用户更正后的“点击直接到下一句”。
冬马悬空截图实际来自卡片单步预览，不能据此判定首页 mobile lift 是其根因。

## 批次 1：卡片语音证据边界

- 删除无场景时凭 cue ID 拼接 ADV、默认角色模型、背景和口型的兜底。
- 只有 card.home_voice_cues 中正文和 voice 身份匹配的 source preview 可进入播放器；普通卡面/演出/未分类语音保持原生音频。
- 旧 audio-only player URL 回退卡片详情，不加载伪造舞台。真实首页预览保留。
- 全索引检查：836 行卡片（含原始重复资源行），2564 个来源预览、3561 个仅音频条目。它们是适配器消费计数，不是新增资源缺失统计；operational 生成器本来只提供音频/文本证据。
- PASS：verify-card-voice-preview、verify:archive-async-navigation、build:check、diff check。
- Browser：本机 Vite http://127.0.0.1:5175，1280×800、390×732。001tom_r02 演出语音无预览按钮，原生音频播放到 2.267007s 结束且无 media error；首页触摸演出进入且显示真实正文、角色和动作，返回正常。001tom_n01 旧伪造语音链接回到卡片详情，无溢出/错误覆盖层。
- 控制台仅观察到既有 Pixi Spine deprecation 调用栈，无本批应用错误。build:check 使用 .analysis/build-check、不含 public；不是发布或真机验收。

## 后续问题范围

移动动态视口和门户触达；人物跨宽高定位；手动/自动推进边界；语音软就绪、轻量提示、取消与慢网；语音/口型 HTTP 缓存；歌曲页复用原有歌词时序。

## 批次 2：移动可见视口

- 根容器采用 100vh 回退 + 100dvh 动态高度，viewport-fit=cover 补全已有 safe-area 消费。
- PASS：verify:portal-navigation、build:check、diff check。
- Browser：390×632 / 390×844 高度变化、844×390 横屏切换；根高度随视口变化，底部 nav 的 bottom 分别约 632.18 / 844.14（浏览器缩放亚像素）。短屏首页点击“门户”进入完整门户，再从“游戏风首页”返回。
- 边界：本机 Browser 的视口变化验证，不冒称 iOS Safari / Android 真机地址栏及非零安全区验收。人物短屏裁切仍待独立定位修复。

## 批次 3：语音软就绪与取消

- StoryViewer 不再把 voice prepare 放入 scene readiness，也不因未缓存语音捕获旧画面；背景和角色就绪保护保留。
- 画面未就绪时拒绝推进，并在导航开始同步关闭输入窗口，避免 watcher 尚未运行时快速连点越过加载中的句子。
- 语音独立异步播放、取消覆盖 audio/lip；播放与回看请求均有 6.5s 整体超时。旧结果不播放、不更新当前句状态。失败释放 AUTO 的 preparing 等待。
- ADV 气泡内 350ms 后显示小点，1.5s 后显示“语音加载中”；失败轻提示，无遮挡弹窗。
- PASS：verify:story-loading-safety；补充 lip 中途取消/超时与旧请求隔离后 verify:story-audio；build:check；diff check。
- Browser：5176 临时代理指向同一 5175 Vite，实际语音延迟 5s 时正文已出现且显示轻提示；强制 404 后正文/角色保留，390×732 提示在屏内、无横向溢出，点击下一段能完成该单步预览。仅预期 404 warning 和既有 Pixi warning。
- 边界：慢网预览验证不替代整章声画时序或长稳。手动点击跨动作节点的实现属于下一批。
