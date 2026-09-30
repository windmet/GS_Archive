# 剧情交互修复与验收（2026-09-30）

输入 `GS_Story_Interaction_21e59017.zip`，基线 `21e59017c609ec7fc98df0496cf0db8aad045df9`。preflight 五个 blob 一致；保护快照包含 6551 个 tracked 文件。工作分支 `codex/story-interaction-v2-before-b002`，保留无关未跟踪文件、不部署、不操作 R2、不 prepare B002。

## P0 菜单

更正上轮记录：旧 `.playback-menu` 没有独立 overflow scrolling，不能由截图推断“窄屏菜单可滚动”。实际 1280×480，clientHeight=480 / scrollHeight=1015 / overflow=visible / scrollTop=0；在可见按钮上发送 Browser 原生滚轮后仍为0。

新 `PlayerMenuPanel` 为舞台兄弟、全屏根后代，固定关闭栏、唯一滚动 body、44px 控件、浅色 backdrop blur；menu 时舞台 inert。现有 Runtime/AudioSession 暂停集合继续使用，未新增时钟；菜单事件不冒泡到播放器快捷键，Tab/Shift+Tab 循环、关闭恢复焦点，遮罩只关闭。

`build:check` exit0（P0 脏源码构建），实际 HTTP5197 当前代码 Browser：clientHeight=416 / scrollHeight=1107 / overflow=auto；原生滚轮由0到691.49，成功操作末部语音设置再恢复auto。Tab首尾循环、遮罩关闭后舞台inert释放，菜单期间 pause reasons 含menu。相关 player QA / immersive / story-audio 回归通过。证据在 `.analysis/story-interaction-v2/menu-scroll-p0.json` 和 before/after PNG。窄视口手势与真机签收尚待完成，不能称手机已验。
