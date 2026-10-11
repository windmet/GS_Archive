# 谱面播放与分栏布局（2026-10-01）

本批在既有原生五轨贴图预览上接入歌曲播放，默认选择透视轨道，长轨作为备选。外部意见仅用于整理操作层级；范围按用户本轮要求执行。用户明确确认默认秒数与舞台小人对应，并要求直接添加播放。本记录更新此前几份谱面记录中的“播放尚未接入”状态，不更改原始谱面、Combo 或历史音频校准记录。

代码验收版本：`40d67e7f133cea0d1f16510fa211ef0b415573f0`，位于 `codex/story-interaction-v2-before-b002`。本地入口：`http://127.0.0.1:5200/?view=song_detail&song=knwonl`。此前原生角色匹配见 [音符匹配记录](GS_SONG_NOTE_ROLE_MATCHING_20261001.md)。

## 操作布局

| 区域 | 已实现 | 状态规则 |
| --- | --- | --- |
| 顶栏 | 四档难度、透视／长轨切换、视图设置、谱面信息、收起 | 默认透视；仍按需加载谱面；切视图保留位置、音频和设置；切难度停止音频并定位首个音符 |
| 折叠设置 | 三套原生贴图、播放速度 0.5–1.5×、音量 | 默认折叠；Escape 收起并归还焦点 |
| 透视专属设置 | 视觉配速 1–20、固定 tick 视野 | 视觉配速只改变疏密，保持相对刻度；不改变音频速度或当前位置 |
| 长轨专属设置 | 三档纵向缩放、自动／分栏／单栏排布 | 自动按画布宽度选择；宽度 ≥720px 分栏，窄屏单栏 |
| 底栏 | 秒数时间轴、tick 输入、播放／暂停、开头／末尾、前后音符、键型筛选、首个音符、下一条长条 | 超出定位范围禁用按钮，不循环跳转；音频失败后可点击播放重试 |
| 画布 | 点击长轨定位、当前黄线／活动栏、键盘控制 | 聚焦后空格播放，左右跳音符，Home／End 定位首尾；不会接管页面其他输入框 |
| 导出 | 独立 SVG，原 PNG 去重嵌入和 SHA 校验 | 仅长轨显示；失败提供重试；导出的分栏仍引用同一源对象组 |

默认视图指打开预览后的视图，不在进入歌曲页时自动打开或播放。顶部歌曲播放器与谱面播放器互相暂停，避免同页两份音乐同时播放。

## 时间和音频

谱面使用 `song.playback.track.url` 的完整混音，包含 K.now O.nly 的 `/assets/live-chibi/music/knwonl.m4a`；它与舞台小人的默认音乐资源一致。播放以媒体元素真实 `currentTime` 为时钟，动画帧只读取时钟，不累计计时器步长。暂停、拖动、播放变速均由音频时钟驱动。

`SongChartTiming.js` 使用每四分音符 480 tick，逐段积分 `60 / (480 × BPM)`，以秒计入源 offset。反向换算用于音频时间到谱面位置，保留浮点位置，仅输入框四舍五入显示。文件尾奏可以长于谱面末尾；时间轴保留尾奏，不把谱面拉伸到音频总长。

已核对的定位样例：

- K.now EX 的 74400 tick 对应 71.538461538 秒，BPM 130；绿色 315 位于中轨。
- Reversed Masquerade 在 34560 tick 从 160 改为 196 BPM，边界为 27 秒；边界后每秒 1568 tick。20.5 秒定位 26240 tick。
- 25ms offset 与跨 BPM 换算有独立回归；244 档原始头尾的正反换算通过。

这里采用用户确认的默认时间对应关系，并完成本地音频驱动与数学换算验收。加密 UnityFramework 的时间转换方法体仍未取得，因此不宣称 480 常量或 offset 单位已从原生方法体还原，也不自动将历史舞台校准条目全部提升为已验收。

## 桌面长轨

按完整谱面时长等分成多栏，从左向右、每栏从上往下读。栏数根据缩放和最高 BPM 控制最大栏高；各栏秒数长度一致，跨 BPM 时 tick 长度可以不同。边界保留少量相邻内容，长条不中断、不生成额外音符或判定点。播放和定位会让当前栏进入可视区域。

K.now EX 标准缩放为 24 栏；1440px 桌面可同时查看四栏，横向滚动，画布无需持续纵向滚动。手机自动恢复单栏纵向阅读，仍可手动选择分栏。源音符只生成一次，通过 SVG `use` 显示各个时间窗口。

## 本地验收

使用隔离 QA 工作区 `E:/Web_build/GS_Archive_Domain_Work/song-attribute-qa-20261001/web_viewer` 的固定 `.analysis/build-check`，`copyPublicDir:false`。服务挂载已有 public、外部资源及歌曲候选 readmodel；release 保持 `17e0ab0b227d6f2bb433f0c1cfaf3934fcccbc2cd420387adc95af9fc4c7a907`。未复制公共语料、IPA、音频或创建完整发布包，主窗口的其他修改保持原样。

Browser 插件不可用，按前端验收技能使用已有 bundled Playwright Chromium；未安装依赖。1440×1050 与 390×844 的真实页面、音频和截图验收通过：默认透视、设置折叠、滤选定位、1／20 配速、贴图切换、真实 0.5× 播放／暂停、媒体时间推进、跨 BPM 时间轴、两视图播放连续、桌面分栏、手机单栏、键盘、切难度和收起停止音频。SVG 实际下载为 566,427 字节，525 原始对象；file URL 离线打开零 HTTP 请求，损坏贴图被 SHA 校验拒绝且重试成功。

附加恢复旅程覆盖同页歌曲／谱面真实音频互斥、前后音符与下一长条、点击栏定位、选中中间节点时换难度／收起、谱面 502／SHA 故障重试、延迟旧难度取消、音频失败重试。

DRIVE A LIVE 的组合单轨、中心偶像＋伴奏、五槽编成也完成实际播放与双向互斥验收，控制台无运行异常；分别覆盖媒体元素和 AudioContext 播放分支。

源码回归通过：`verify-song-chart-timing.mjs`（244 档、三档缩放合计 21,140 等时长栏）、既有 note／long／perspective 回归。QA `npm run build:check` 和 `verify:build-audit` progress 通过，启动 gzip 126,904 字节，无禁止模块。`verify:cutover-routes` progress 通过；全局 partial 和设备 pending 不变。主工作区旧 build-audit 与本批 HEAD 不一致，实际验收引用隔离 QA 中与代码 HEAD 一致的构建。

额外运行 `verify-song-playback-audio.mjs` 与 `verify-archive-presentation.mjs` 未通过：前者仍查找 App 中已迁移的 `songPlaybackAudioData` 接线字符串，后者的活动页 fixture 未渲染出其要求的“剧情暂未收录”。前者的字符串在输入 69b08655 中已不存在，后者的活动页及检查器也未被本批修改；不修改其他窗口或扩大本批范围，也不列为通过项。

证据位于 `E:/Web_build/GS_Archive_Domain_Work/song-attribute-browser-20261001`：

- `chart-player-browser-receipt.json`、`chart-player-recovery-receipt.json`；两份脚本可复跑。
- `chart-experimental-handoff-receipt.json`、`verify-chart-experimental-handoff.mjs`：三种分轨模式与谱面互斥。
- `chart-player-perspective-desktop.png`、`chart-player-columns-desktop.png`、`chart-player-long-mobile.png`、`chart-player-perspective-mobile.png`、`chart-player-transport-mobile.png`。
- `chart-player-know-columns.svg`、`chart-player-columns-offline.png`、`chart-player-build.log`。

## 保留待办

长条中间横条仍只对应源 poly 内部点，运行时判定生成／合并和所有 Combo 的解释尚未还原。原版视觉配速公式、相机、shader、动态粒子和整首录像逐帧校准仍待核实。本批是本地浏览器验收，未授予发布、完整游戏一致性或物理设备通过状态。循环区间、书签、全屏可作为后续独立功能，本批不提供这些未实现按钮。
