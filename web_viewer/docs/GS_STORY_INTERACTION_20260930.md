# 剧情交互修复与验收（2026-09-30）

输入 `GS_Story_Interaction_21e59017.zip`，基线 `21e59017c609ec7fc98df0496cf0db8aad045df9`。preflight 五个 blob 一致；保护快照包含 6551 个 tracked 文件。工作分支 `codex/story-interaction-v2-before-b002`，保留无关未跟踪文件、不部署、不操作 R2、不 prepare B002。

## P0 菜单

更正上轮记录：旧 `.playback-menu` 没有独立 overflow scrolling，不能由截图推断“窄屏菜单可滚动”。实际 1280×480，clientHeight=480 / scrollHeight=1015 / overflow=visible / scrollTop=0；在可见按钮上发送 Browser 原生滚轮后仍为0。

新 `PlayerMenuPanel` 为舞台兄弟、全屏根后代，固定关闭栏、唯一滚动 body、44px 控件、浅色 backdrop blur；menu 时舞台 inert。现有 Runtime/AudioSession 暂停集合继续使用，未新增时钟；菜单事件不冒泡到播放器快捷键，Tab/Shift+Tab 循环、关闭恢复焦点，遮罩只关闭。

`build:check` exit0（P0 源码构建），实际 HTTP5197 当前代码 Browser：clientHeight=416 / scrollHeight=1107 / overflow=auto；原生滚轮由0到691.49，成功操作末部语音设置再恢复auto。Tab首尾循环、遮罩关闭后舞台inert释放，菜单期间 pause reasons 含menu。相关 player QA / immersive / story-audio 回归通过。证据在 `.analysis/story-interaction-v2/menu-scroll-p0.json` 和 before/after PNG。

## 已实施的源码批次

- `6f22ae7d`：菜单独立滚动、明确暂停提示、焦点和舞台隔离。
- `46985a4e`：目录主体整话阅读与独立播放按钮；chapter Reader、session 播放意图、只读本话选集快照、请求竞争与来源校验。
- `85c537a7`：受校验的 synopsis/canonical 范围映射；原 Reader 返回定位与当前选择的来源分别验证；明确下一话及重试后的 URL 恢复。
- `fa9334af`：待加载期间选择当前段的取消回执，只允许最新请求关闭选集。上述批次均已推送 `codex/story-interaction-v2-before-b002`。

正文按每份 document 的 catalog/revision/source 使用原有读取、译文和分支呈现，不写拼接语料；目录与搜索共用一个 Reader 滚动区。目标段优先，最多3份并发；取消消费者不破坏共享请求。原旧单篇 URL 保持单篇语义。菜单、回看、恢复错误以既有暂停集合转移；本轮未新增播放时钟。

## 实际 Browser 与 HTTP 证据

服务为 `scripts/serve-player-qa-preview.mjs`，端口5197，生产代码目录 `.analysis/build-check`；public 与 `E:/Web_build/SideM_Player_QA_Models_20260930` 映射读取，不复制语料。静态资源 release 为 `be375f3d4a7668beda4efe361474b2e4928ecb71e152a542e39fe0701be11fe8`。Browser 为 Codex IAB；验收未施加页面缩放，没有用缩小页面比例绕过菜单问题。最终默认视口 visualViewport.scale=1；原生 Ctrl+plus 未产生可测量缩放，因此不声称200%通过。源码构建覆盖以上批次，最终 clean HEAD 与 bundle 绑定另存 `final-build-audit.json` 和 `final-browser.json`。

滚轮输入由 Browser 原生 `Tab.scroll` 发出，DOM wheel 事件计数实际增加；没有 JS 赋值 scrollTop。`menu-viewports.json`：1280×800 body 736/1167，scrollTop 0→431.264；390×844 body 779/1167，0→387.586；844×390 body 325/1167，0→841.379。两窄视口 width/scrollWidth 均324。末部语音 select 实际命中、切到 media，再恢复 auto；关闭栏可见。控件 CSS 最小44px，测得该 select 43.994 CSS px（布局小数舍入）。390/844只是视口与滚轮验收，不是触摸或真机证据。

第5话 c/d 各使用自身 document/catalog；10段均有各自 revision/source 身份，见 `chapter-documents.json`。Reader c 的第14行→播放→选 h→返回，URL、scope、row、bilingual、revision 完全一致，行顶54.993，见 `reader-return.json`。JIF 搜索12处跨 a/c/d/i/j；逐行定位使用 replace，不逐行增加 History。

冷开 h、延迟 a–g：h 先显示，前段填充后目标顶19.734→19.906；原生 wheel 后目标顶变为约−380，补齐后没有被拉回目标，见 `chapter-delayed-anchor.json` / `chapter-wheel-stop-anchor.json`。浏览器自身 scroll anchoring 会随前段高度增加调整 scrollTop，不能把“scrollTop 完全不变”当成应用纠偏停止的证明。一段503时其余9段可读，只重试失败段后10段恢复。

全屏 h→i→j 的根身份保留；j503时选集关闭、旧舞台 inert、焦点进入全屏根内“重试载入”，成功恢复后保留队列与 Reader 来源。`picker-fullscreen-503.png`、`picker-refresh.json`。注入错误 compiled HTTP200字节仍因来源/哈希不符拒绝；最新构建再次重试后 URL 恢复 view=player、j 3/62、无错误提示，见 `source-retry-url.json`。30秒延迟 h 后点击当前 c，立即关选集，迟到响应后仍 c 3/33，见 `picker-current-cancel.json`。

AUTO 打开期间菜单等待超过自动延迟，step仍 index2/id3、clock暂停，AUTO偏好保留。名字输入/方向键不触发后台播放快捷键；菜单→选集→设置→回看无叠层；模拟 hidden 再关菜单保留 visibility 暂停。20次开关后 menu=0/inert释放、timer=0、音频sources=2、Spine=2、舞台children=7；这不是堆内存或物理后台长期稳定签收。`menu-runtime.json`。

旧 continuous OFF 时“连播本话”开启 session continuous，AUTO仍OFF，手动读完 a 自动接 b；退出后单段 c continuous OFF，见 `chapter-entry-continuation.json` / `session-entry-intent.json`。j 末尾开启 continuous 仍停本话完成条，点击明确“下一话·第6话”才进入 a；刷新该入口与返回原第5话 Reader 均通过，见 `chapter-boundary.json`。

## 指导包矩阵逐项边界

PASS 指本轮实际 Browser 操作；CODE 指合同/源码回归，不能替代尚未操作的 Browser 或设备；PARTIAL 指仅完成列出的部分。

| 项目 | 状态 | 证据或未覆盖部分 |
| --- | --- | --- |
| M01 / M02 | PASS | 桌面800/480高度真实滚轮、末项实际修改、固定关闭栏 |
| M03 | NOT RUN | 无可用触摸手势 API，390×844仅原生滚轮 |
| M04 | PARTIAL | 844×390滚轮末项命中；触摸、设备 safe area 待验 |
| M05 / M06 | NOT RUN | 真机、浏览器栏、软键盘待验 |
| M07 | PARTIAL | 未施加缩放的常规显示通过；200%与系统大字体未运行 |
| M08 / M09 / M10 | PASS | 浅遮罩、暂停提示、遮罩不穿透、焦点循环和输入键隔离 |
| M11 | PARTIAL | 普通对白隔离实际通过；电话选择背景点击本轮未操作，CODE覆盖 |
| M12 / M13 | PASS | AUTO稳定、原子暂停理由交接、回看退出释放 |
| M14 | PARTIAL | debug模拟hidden/visible；非真实后台切页 |
| M15 | PARTIAL | 20次开关与退出重入通过；未做长期listener/heap分析 |
| M16 | CODE | 重放先关菜单沿既有retry；本轮未做实际声音签收 |
| E01 / E02 / E03 / E04 | PASS | 连播意图、AUTO OFF、主体Reader、独立右侧播放 |
| E05 | PARTIAL | 桌面键盘、可访问名称、48×54播放按钮；触屏待验 |
| E06 | CODE | 状态与可读/可播分离合同；未逐类现场Browser跑完 |
| E07 | PARTIAL | 主线Browser、PROLOGUE/SMALL TALK/未知名回归；其他标签未逐页验 |
| E08 | CODE | 生日 canonicalRelation 回归；本轮生日页Browser未运行 |
| E09 | PASS | session override 不污染新单段入口 |
| E10 | CODE | 缺口、唯一成员、范围歧义回归，未现场修改正式数据 |
| R01 / R02 / R03 | PASS | 十段单一Reader、目标优先/滚轮停止纠偏、局部503重试 |
| R04 | PARTIAL | 各doc双语身份实际核验，原/译/缺译局部fallback由CODE覆盖 |
| R05 | PARTIAL | 多catalog实际核验；共享catalog与取消共享请求由CODE覆盖 |
| R06 | PARTIAL | c/d Reader分支标记和公共后文；Player互斥路径由CODE覆盖 |
| R07 | PASS | 跨段搜索、结果计数和跳转 |
| R08 | CODE | 旧单篇及row深链/source guard回归 |
| R09 / R10 | PASS | 原scope/row返回、错误compiled拒绝及重试URL恢复 |
| R11 | PARTIAL | Reader主动滚动、搜索replace；快速切话迟到由CODE覆盖 |
| P01 / P02 / P05 | PASS | 本话十段、高亮、延迟目标被当前段取消、不重置当前位置 |
| P03 | CODE | 同目标合并、AUTO与手动新意图竞争回归 |
| P04 / P06 | PASS | 全屏503、错误焦点、重试与刷新恢复 |
| P07 | CODE | 短信末步/完成条/延迟与失败回归；本轮未全套Browser逐条件重复 |
| P08 | PASS | j末步停止，明确动作进6a，刷新和返回源Reader |

## 回归、保护和保留问题

最终源码 `fa9334af` 下18个相关命令全部exit0，逐命令日志及 exit code 在 `.analysis/story-interaction-v2/final/results.json`：player-qa、player-immersive、player-repair、playback-controller、episode-queue、reading、reading-sources、reviewed-b001、story-localization、producer-addressing-runtime、communication-presentation、story-step-playback-state、story-audio、archive-navigation-state、archive-startup-route、archive-async-navigation、story-playback-range、release-soak。包内参考工具38/38与guard工具10/10通过，仅作为工具合同证据。

全库100命令回归98通过，失败对象仍为 `verify:story-schema` 的 `story-collection:1_1_001jup_01_1_1_001_01` authoritative registry 缺失，以及 `verify:episode-artifacts` 的 `1_2_002_12_a.json` episode manifest 缺失。该批运行主体在 `85c537a7`，末尾重叠取消回执修改；最终18项另在 `fa9334af` 完整运行。未声称远端CI成功，两个旧gate仍阻断完整Source Gate。

保护快照复查PASS：6551 tracked 文件，无改动/缺失/新增及保护前缀新增未跟踪项；原无关未跟踪项保留。Reader来源仍2801份（2492 ready / 309 unsupported）；B001仍52 documents / 42 catalogues / 993 source-bound units。未新增翻译/receipt，不推进B002。

HTTP证据在 `.analysis/player-b002-repair/http-requests.jsonl`，本轮精简响应清单为 `http-source-evidence.json`。预期503与错误字节注入单独记录。基线媒体 `/assets/voice/1_4_001_05_t02_j1000.m4a` 已有404，保留真实语音失败与兼容重试提示，不签收缺失媒体；既有 Spine SimpleMesh deprecation 警告保留。中途替换build-check后旧tab曾取旧lazy chunk404，刷新后恢复；最终验收须刷新最终bundle。故障注入最终清为 `{}`，临时 viewport override 最终恢复。

本轮状态：源码修复与已列本地Browser旅程通过；触摸/真机/软键盘/200%与上述CODE项尚待对应实机或人工旅程签收。build-check仅完整代码编译，不是媒体发布包、部署或生产设备验收。
