# 新审阅修复与本地验证（2026-09-27）

输入 HEAD：`26ebd00`，分支 `codex/gs-architecture-rebuild`。按用户附件的四点建议核对实际源码后修复；附件作为调查线索。本批不部署，不改变设备签收与最终切换门禁。

## 改动

1. **逐句 BGM 中断**：`StoryViewer` 的 buffering 原先直接暂停共享 AudioContext。新增 `StoryPausePolicy`，buffering 仍暂停调度器及输入推进，当前语音仍由 step watcher 取消；BGM/ambient 连续播放。visibility 与 overlay 暂停保留，释放仍关闭上下文。
2. **普通路由黑屏**：`hardLoading` 与 `routePending` 分开。普通资料页保留当前内容、显示非阻挡状态条。卡片、卡池、组合、活动、工作、季节、个人故事、故事章节/详情、资源目录的交互入口并行准备组件和 ReadModel，再经过原有 request/revision 校验提交；新点击立即撤销旧导航。加载失败保留重试提示。清除被替代页面的旧进度提示。首屏、舞台及播放器仍保留必要的全屏加载，颜色改为浅青。
3. **手机卡片文本**：700px 以下展示层合并游戏宽度的单换行，保留空行段落，英文词之间保留空格；桌面仍显示原始换行。语音行改单列、文案字号 0.78rem。MasterData、ReadModel 与原始文本未更改。
4. **语音证据**：`runtimeDebug=1` 面板新增 `voice_player`，包含 cue、URL、HTTP 状态、类型/字节、缓存来源、解码时长/采样率/声道、source.start 成功标记与当时 context state、当前 voice gain、缓存规模及失败阶段。compressed cache 返回值仍为调用方独占 ArrayBuffer，HTTP/内存缓存政策未改。

移除从未调用的 `waitForRunningAudioContext`，没有把“强制等 1.8 秒”接到语音或场景就绪链路。`sourceStarted=true` 只证明播放源调度成功，须同时看 context state，不能据此声称用户听到声音。未替换 AAC 文件，未添加推测性的原生 audio 回退。

## 命令证据

- `npm run build:check`：通过；复用 `.analysis/build-check`，不复制 public，不是完整发布包。
- `npm run verify:archive-async-navigation`：通过；包含新增并行组件/数据准备、迟到导航、组件错误、旧状态清理、文本段落测试。
- `npm run verify:archive-navigation-state`、`verify:archive-startup-route`：通过。
- `node scripts/verify-story-audio-session.mjs`：通过；新增 30 次 buffering→ready，真实 session/scheduler 配合 fake AudioContext，suspend 次数为 0，连续音源未 stop；交错 visibility 保持暂停。原有 100 轮与取消/竞态测试保留。
- `verify:story-step-playback-state`、`verify:playback-controller`、`verify:voice-load-recovery`：通过。
- `node scripts/verify-compressed-voice-cache.mjs`：通过；新增 HTTP/内存来源、状态码、类型及字节回传断言。
- `git diff --check`：通过。

## 实际 Browser

本地生产 bundle：`http://127.0.0.1:10174`。测试辅助服务读取当前 `.analysis/build-check`，ReadModels/翻译回退到既有 `.deploy/rebuild-device-preview-c3380de/dist`（r23），assets/data 代理固定 `6ed057d8` 资源。未复制媒体库。该服务仅作本地 QA，不是新远端部署。

| 检查 | 结果 |
| --- | --- |
| 页面身份/内容 | `SideM Story Viewer`，门户、卡池、卡片与演出实际内容正常 |
| 慢组件 | 卡池组件人为延迟 10 秒：门户保持可见，有“正在准备下一页”；完成后 57 个卡池 |
| 导航竞争 | 等待卡池时改选卡片，进入卡片目录，旧请求完成不覆盖 |
| 手机排版 | 390×844；卡面与首页触摸语音重排；语音行单列，12.48px；scrollWidth=innerWidth=390 |
| 桌面 | 1280×800 导航复核；截图展示门户保留内容 |
| 真实语音 | `001tom_sr07`→第一条触摸语音演出：200、audio/mp4、39,970 B；4.896s、48kHz、单声道；sourceStarted=true，contextAtStart=running，lastFailure=null |
| visibility | 调试按钮模拟 hidden 后 context=suspended，playback pause reason=visibility；恢复按钮可用 |
| 控制台 | 无应用 error；演出有 PixiJS rgb2hex/hex2rgb 弃用提示，来源是既有 Spine 渲染依赖 |
| 覆盖层 | 未出现框架错误覆盖层；截图核对手机文本及语音控件无横向挤压 |

截图通过 Browser 工具在会话中展示。测试 viewport 在结束时还原。

## 剩余边界

- Android Edge 无语音的原因仍待真机诊断；本轮 Chromium 解码/播放状态证据不等于 Android 或主观听感验收。
- 30 次 buffering 连续性由行为回归证明；未声称完成真机 30 句听感/长稳测试。
- 现有远端不可变测试地址 `c405746d.gs-archive-preview.pages.dev` 仍是此前的 `c3380de`，不包含本批修改。
- 其他 readmodel 迁移/parity/device 缺口沿用路由账本，不在本批标为通过。
