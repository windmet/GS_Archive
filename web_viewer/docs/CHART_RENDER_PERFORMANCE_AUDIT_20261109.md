# 五轨谱面渲染性能审计 · 2026-11-09

输入为 origin/master 的 ffade107，含 #190 与 #191。实验分支 exp/20261109-chart-render-audit。先在同一个播放器上建立可重复的分层测量，再更换 Hold Canvas 的提交方式。基线测量可从 5feb0a91 复现，Hold 批处理见 7548a79f。

## 从源码能确认的事

- 活动播放的 rAF 路径读取一次 audio.currentTime。60Hz 透视轨道与低频控制台从同一个媒体采样更新。音符、Hold、VariableHold Middle 和 Flick 连接共享原生投影，跨 BPM 时使用分段时间换算。#191 已经把逐帧扫描整张谱面改为按读窗索引。
- 每个可见 Hold 和 Flick 连接仍各自构建原生 mesh。旧 WebGL1 消费者再逐条分配顶点和索引数组、上传两次并提交一次 drawElements。Vue 更新独立的 SVG 音符、连线和 Combo；Combo 315 还包含 SVG 特效。
- 自动演示每帧构建粒子指令。轨迹积分已有缓存，旋转曲线仍按粒子年龄重复积分。WebGL 粒子按纹理分组上传后，将 1280×720 的离屏画布通过 drawImage 复制到 Canvas2D，最终以 plus-lighter 合成。源码只能确认这次跨 Canvas 的拷贝，是否触发 GPU 读回及其耗时要由平台 trace 确定。
- 旧路径和实验路径均使用 SVG、Hold Canvas、Effect Canvas 三层。诊断以同一媒体采样为每个轨道更新分配 frameId，记录 SVG DOM 更新与两个 Canvas 提交。提交时间戳表示 JS 侧完成调用，平台的合成和呈现发生在其后。出现同帧几何吻合、三层 ID 齐全的设备错位时，需要进一步从设备 trace 或同步录像定位图层呈现。

## Hold 实验

同纹理、同混合方式的网格按原顺序追加到可复用的 Float32Array 和 Uint16Array。WebGL 缓冲只在容量增长时重新分配，每批上传有效区间并提交一次。累计超过 65,536 顶点时换批，单个超大 mesh 按三角形顺序分块。保留透明叠放顺序、原生几何和 SVG 降级。读窗裁切会改变长度、UV 比例、细分与顶点数，仍按当前窗口计算并上传。本次减少提交、分配与上传调用，单帧有效载荷大体相同。

## Browser 对照

Windows Codex Browser / Chromium 156，开发服务 127.0.0.1:5219。实际 viewport 501×479、DPR 2.175。LEADING YOUR DREAM EXPERT，圆形皮肤、配速 5、1×、关闭打击音，取真实媒体时间 40–48 秒。D 档包含 41.656 秒附近的 Combo 315。表中采用第二组配对采样，先后两次都由同一个诊断版本驱动。轨道更新约 477–481 次，均无失焦、缓冲或自然降级记录。

| 档 | rAF P95 旧→新 | rAF P99 旧→新 | 轨道 Vue 更新 P95 旧→新 | Hold Draw Call P95 旧→新 | 粒子采样 P95 旧→新 |
| --- | ---: | ---: | ---: | ---: | ---: |
| A 音符端点 | 10.3→10.3 ms | 10.7→10.6 ms | 4.5→4.5 ms | — | — |
| B 加 Hold、Middle、连接 | 10.3→10.3 ms | 10.6→10.6 ms | 4.6→4.5 ms | 4→1 | — |
| C 加自动演示 | 10.4→10.4 ms | 10.7→18.6 ms | 9.5→9.4 ms | 4→1 | 5.2→5.0 ms |
| D 加 Combo | 10.5→10.5 ms | 19.1→19.3 ms | 9.7→9.5 ms | 4→1 | 4.8→4.6 ms |

- B 档 Hold 提交累计 1,010→481 次，单帧提交 CPU P95 约 0.2→0.1 ms，上传 P95 16,728→16,772 字节。采样跟随真实媒体，窗口端点与回调相位略有差异。
- C/D 每帧粒子 P95 约 195–196 个。A/B/C/D 的几何 CPU P95 约 1.3–1.5 ms。Vue 更新跨度包含几何与子组件同步工作，不能与粒子及 Hold 时间相加。
- 配对样本的所有 rAF 间隔均小于 33.5 ms，D 最长 30.1→29.6 ms，另一轮 D 最长 38.8→40.9 ms。Hold 提交次数的变化可重复，未测到稳定的整帧收益。C 相对于 B 增加了约 5 ms 的轨道 CPU 尾部开销，优先用真机 trace 拆粒子采样、上传与 Canvas 拷贝。
- 配对样本三层应提交的 frameId 均齐全，D 两边均覆盖 58 个 Combo 315 帧。数据仅代表 JS 和 DOM 提交，Android 上的实际不同步尚未复现。

## 同步和画面回归

- 248 份谱面 JSON、1,100 个窗口，涵盖 36 处 BPM 边界。逐项核对 1,441 个 Hold 头、1,468 个 Hold 尾、367 个 Middle、488 个 Flick 端点。理论投影误差为零，实际 mesh 成对顶点中心最大误差约 0.000068 个 1280×720 场景像素。在 2,008 条 Flick 连接中，有长度的连接没有两端配速不一致的实例。
- 在 Browser 对 BRAND NEW FIELD EXPERT 固定 tick 127790、配速 11、粒子年龄 0.30 s 做 WebGL readPixels 对照。优化前后 Hold RGBA 的校验值同为 2009921674，31,738 个非透明像素，三个 Flick 桥中点 alpha 均为 153。模拟 Hold context lost 后，实际切换到 266 个 SVG 纹理三角形。
- Infinite Octave! EXPERT 实际播放 8.34–12.34 秒，跨 9.84 秒附近的首个 BPM 边界。A–D 各有 235–240 个轨道帧，应提交的层 ID 均齐全，Browser 控制台无相关错误。
- 正常入口 /songs/ldyrdm/chart/ 实测切 EXPERT、播放、暂停、跳回开头、跳到下一音符。最后轨道 tick 3840、滑杆约 3.057 秒，有 860 个 Hold 顶点。正常入口无框架覆盖层，Browser 控制台无相关错误。

- 22 项 Node 回归通过，含批次顺序、Uint16 边界、超大网格、原生投影与 Hold、Middle、Flick、窗口索引和媒体时钟。npm run build:check 通过，Vite 编译 3,077 个模块，输出固定为本 worktree 的 .analysis/build-check，public 资产未复制。编译仍有既有的背景资源解析和大 chunk 警告。

## 复跑与真机验收

1. 在实验分支运行 npm ci，配置已有的本地音源根，然后运行 npm run dev -- --host 127.0.0.1 --port 5219 --strictPort。打开 [/scripts/fixtures/song-chart-live-performance.html](../scripts/fixtures/song-chart-live-performance.html)，点击「采样 A–D」，结束后下载包含逐帧数据的 JSON。默认测 40–48 秒，可选 Infinite Octave! 跨 BPM，也可直接定位到 315 前一秒。
2. 同一设备和浏览器对照基线与实验版，固定曲目、区间、配速、方向和刷新率，保留至少三轮前台采样。A 仍运行共同几何计算，只裁去 Hold、Middle、连接和特效的渲染工作。每帧记录同一个媒体样本及各层最后一次提交，异步纹理重绘可能在同一 ID 内重复。报告含 rAF P50/P95/P99、长间隔、几何与 Vue 时间、上传字节数、Draw Call、粒子、fallback 和 context lost 指标。性能面板可按 chart-audit-A-start 至 chart-audit-D-end 等标记与 JSON 对齐。
3. iPhone/iPad 用 Mac 上的 Safari Web Inspector 录制渲染时间线。Android 用 Chrome DevTools Performance 录制 Frames、主线程与可用的 compositor/GPU 轨迹，测量时关闭 DevTools 投屏。手机通过已配置的调试通道访问同一 dev 版本。[Safari 远程检查](https://webkit.org/web-inspector/enabling-web-inspector/)，[Chrome Android 远程调试](https://developer.chrome.com/docs/devtools/remote-debugging)，[Chrome 帧时间面板](https://developer.chrome.com/docs/devtools/performance/reference)。
4. Android 错位取能重现的曲目、难度和秒数，对照录屏与逐帧记录。先看错位是否同帧随时间增长或集中在特定 BPM/VariableHold，再用 trace 区分图层提交和浏览器合成。iOS 掉帧比较 B/C 和 C/D，单独确认特效采样、Canvas 复制、SVG/Combo 绘制是否挤占帧预算。

目前这台 Windows 电脑未检测到已连接的真机调试设备。设备 CPU/GPU、实屏呈现、Android 错位复现及长时间播放仍待验收。后续粒子直绘和单 Canvas 原型应以同帧几何、Flick、315、加色混合、seek 和 fallback 作验收，再比较真机数据。

## 夜神模拟器接入检查

本机夜神 7.0.6.2 的两个现有实例均未进入 Android 桌面。Android 7 32 位实例停在 99%，VirtualBox 5.2.36 日志明确报 VERR_SUPDRV_NO_RAW_MODE_HYPER_V_ROOT。Android 9 64 位实例启动前提示未开启 VT，Windows 查询显示固件虚拟化已启用且宿主正在运行 Hyper-V。nox_adb devices -l 未枚举可连接的实例，因而本次没有 Android 浏览器播放或帧时间数据。夜神另有 [Hyper-V 兼容测试版](https://support.bignox.com/ja/else/hypervonbeta)，当前安装的引擎与该测试版分开看待。

本地诊断服务仍在 127.0.0.1:5219，页面返回 HTTP 200。等可用实例或 Android 真机出现在 adb devices 中，再通过 adb reverse tcp:5219 tcp:5219 从设备打开同一诊断地址。Android 真机使用 USB 调试和设备端授权即可。[Android 本地服务转发文档](https://developer.android.com/develop/ui/views/layout/webapps/access-local-server)。

### 重启后复测（2026-11-09 11:40）

关闭 Hyper-V 启动项并重启后 HypervisorPresent=False，Nox_1（Android 9 x86_64）正常进入桌面，nox_adb 在 127.0.0.1:62025 可连。实例没有 Chrome，只有 AOSP 浏览器与 Android System WebView 92.0.4515.131；改为 1080×1920、420 dpi 的竖屏，页面 viewport 412×656、DPR 2.625。WebView 的 devtools socket 经 adb forward 用 CDP 驱动，每个模式开始时把播放器滚入视口。基线为 HEAD 仅将 ArchiveSongHoldMeshPreview.vue 退回 5feb0a91，诊断页两边相同，分别在 5219/5220 由 adb reverse 提供，实验与基线交替各三轮，LEADING YOUR DREAM EXPERT 40–48 秒。

- 兼容性：WebView 92 缺 Array.prototype.findLast，诊断页直接失败于 SongChartTiming.js。src 下 findLast/findLastIndex/toSorted 等 ES2023 数组方法共 9 处（谱面计时与小人舞台），构建未做 polyfill，Chrome/WebView 97 以下与 Safari 15.4 以下会同样失败。本次测量通过 CDP 在文档创建前注入 polyfill，未改代码。
- WebView 对每个新建的媒体元素都要求用户手势，诊断页每个模式重新挂载播放器，B–D 需要用 CDP 输入事件补点一次播放键。这只影响诊断流程，正常页面单一播放器不受影响。

| 档 | rAF P50 基线/实验 | rAF P95 基线/实验 | >33.5 ms 间隔 基线/实验 | 轨道 Vue 更新 P95 基线/实验 | Hold Draw Call P95（累计） | 粒子采样 P95 基线/实验 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 16.7/16.7 ms | 33–50/33–50 ms | 14–20/16–21 | 20–22/19–21 ms | — | — |
| B | 16.7/16.7 ms | 33.4/33.4 ms | 6–10/8–9 | 14.5–16.3/14.6–14.9 ms | 4→1（670–758→353–373） | — |
| C | 33.3/33.3 ms | 50–67/50–67 ms | 43–49/41–46 | 28–34/31–36 ms | 4→1（464–497→235–238） | 11–13/11–15 ms |
| D | 33.3/33.3 ms | 50/50 ms | 36–41/34–38 | 25–30/24–26 ms | 4→1（488–495→246–252） | 8.5–9.1/8.0–8.7 ms |

- Hold 批处理的提交次数减半可重复，Hold 提交 CPU P95 0.2–0.3 ms，两版帧时间没有可分辨差异，与 Browser 结论一致。
- 加入自动演示（C）后两版都从 60 fps 掉到约 30 fps：rAF P50 16.7→33.3 ms，轨道 Vue 更新 P95 约翻倍，粒子采样 P95 8–15 ms。粒子路径是这台环境里的主要预算挤占项，下一步应优先做粒子直绘或减少每帧采样，而不是继续压 Hold。
- 18 轮采样三层应提交的 frameId 全部齐全，Combo 315 每轮覆盖 22–26 帧，无缓冲、seek 或失焦记录。Android 错位在模拟器中未复现。A 总排在第一个模式，P95 偏高可能含首轮 JIT 预热。
- 模拟器的 CPU 走宿主虚拟化、GPU 走宿主 OpenGL 转译，WebView 版本也偏旧，数据只用于相对比较，不能替代 Android 真机与 iOS 的验收。

### Android 真机（2026-11-09 12:25）

Redmi K60 Ultra（天玑 9200+，Android 13 / HyperOS，面板 60/120/144 Hz），Microsoft Edge 156.0.4314.56（Chromium 156），USB adb reverse，CDP 经 chrome_devtools_remote 驱动，页面 viewport 406×749、DPR 3。基线和实验版的设置与夜神相同，交替各三轮。Edge 的 rAF 全程锁在 60 Hz（P50 16.6 ms），没有跟随面板的高刷，因此本节只能说明 60 Hz 预算内的表现。

| 档 | rAF P95 基线/实验 | rAF P99 基线/实验 | >33.5 ms 间隔 基线/实验 | 轨道 Vue 更新 P95 | Hold Draw Call P95（累计） | 粒子采样 P95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 16.7/16.7 ms | 17–33/33 ms | 0–2/1–2 | 5.1–5.5 ms | — | — |
| B | 16.7/16.7 ms | 33/16.7 ms | 2–4/0–1 | 5.1–5.4 ms | 4→1（941–995→476–481） | — |
| C | 16.7/16.7 ms | 33–66/33 ms | 2–5/3–4 | 7.4–7.8 ms | 4→1（944–963→445–463） | 2.0–2.1 ms |
| D | 16.7–33/16.7–33 ms | 50/33–66 ms | 5/3–7 | 7.3–7.7 ms | 4→1（915–943→429–457） | 1.9–2.0 ms |

- 四档在两版上都基本维持 60 fps，每 8 秒只有个位数长间隔，粒子采样 P95 约 2 ms，轨道 Vue 更新 P95 不到 8 ms。夜神上自动演示让帧率减半的现象在这台真机上不存在，那是模拟器 CPU/GPU 转译的代价，只能提示低端机上的风险。
- B 档实验版的长间隔从 2–4 降到 0–1，P99 从 33 ms 降到 16.7 ms，三轮方向一致，但样本量太小，还不能算作结论；C/D 档没有看到同样的差异。
- 三层应提交的 frameId 全部齐全，Combo 315 每轮 44–49 帧，无缓冲、seek 或失焦记录。旗舰机上没有复现 Android 错位；如果错位仍然存在，需要提供出现问题的机型、浏览器和曲目时间点，并配合录屏。
