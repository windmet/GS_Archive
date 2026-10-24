# 谱面帧率第一批

2026-10-24，输入 `chart/20261023-native-projection` / `db59f121`（用户指定的 `dba5b8f1` 后一笔，保留默认透视修正）。当前 origin/master 已是本分支祖先，无需另作合并。

## 改动

透视轨道由原来的 `now-lastPaint>=33` 改为目标60Hz的rAF调度，长轨图保持30Hz。deadline按目标周期推进并保留余量，容忍0.5ms的显示回调抖动；90/120/144Hz屏幕不会无上限重建场景。媒体时间始终直接读取audio.currentTime，不累加模拟时间，不在卡顿后补画所有漏帧。暂停立即对齐实际音频时刻，并重置deadline，恢复播放的第一帧立即提交。

`createSongTrackRenderer`在每次谱面加载时预计算BPM时钟、sourceIndex速度表、按原生float32速度分组的同时线和middle节点。Vue按chart对象身份重建renderer；seek、皮肤及读取窗口变化只复用不依赖游标的数据。每帧同速度的可见窗口终点只计算一次。原生note/hold几何、UV、flick根节点、可见窗口裁切继续使用同一函数。WebGL写入顶点buffer时直接填typed array，避免为每个顶点临时创建数组。没有全局缓存，也没有缓存变化中的mesh。

## CPU对照

Node v24.14.1、本地源码。基线直接取输入HEAD的SongTrackPresentation，临时同目录模块已删除。EXPERT，cfprde/cgtocc从tick22000、knwonl从123406开始，每轮前进15tick，默认span6000/圆形；每版本240轮，前40轮预热，交替先后顺序，统计200轮。三个定位点的完整场景JSON与旧模块对照一致（包括lazy SVG fallback）。这不是音频设定5的精确读取窗口，也不是浏览器整帧/GPU耗时。

| 歌曲 | 几何中位数：旧→新 | P95：旧→新 |
| --- | --- | --- |
| Café Parade! | 1.177→0.389ms | 2.402→1.086ms |
| K.now O.nly | 1.693→1.046ms | 3.299→2.247ms |
| Change to Chance | 1.153→0.679ms | 1.978→1.182ms |

回执 `.analysis/chart-native/frame-cpu-20261024.json`。此结果支持移除重复CPU工作，不能换算为设备FPS。

Browser临时onUpdated探针在基线采到193个有效更新，约29.6Hz、中位提交间隔33.3ms；后续优化版出现约1000ms的调度间隔，显示Browser后也会在工具调用之间节流，无法构成同环境连续帧率比较。原始时间戳保存在 `.analysis/chart-native/frame-browser-samples-20261024.json`，异常样本不删去后冒充稳定60fps。临时DOM探针及旧版模块均已移除，不进入提交。此批恢复60Hz调度目标，但真机持续帧率、合成/GPU耗时仍需前台设备采样。

## 验证

- `node scripts/verify-song-chart-frame-clock.mjs`：30/60Hz目标，在60/90/120/144Hz显示回调、正负抖动、暂停恢复与长停顿场景通过，不补发爆发帧。
- `node scripts/verify-song-track-renderer.mjs`：244档/976窗口；向前与倒退定位、三皮肤、不同窗口、完整mesh及lazy SVG fallback与新建renderer逐项一致。
- native timing、Special、projection、note geometry、hold geometry、effects、middle回归及track presentation、chart timing、media-element-clock全部通过。hold仍36组22650顶点、最大误差0；全库presentation为244档/732窗口。
- `npm run build:check`：27.53秒、2997模块，通过。固定本worktree `.analysis/build-check`，没有复制public；保留既有背景未解析和大chunk warning。生成的 `config/resource-audit.json` 不提交。

真实页面使用用户要求的Browser，非外部Playwright。复用5231/PID67724，HTTP模块来自本worktree；bootstrap release仍 `1accd9d0aa698ec03ec6d0b80211939f914940abac105d51021b36a8fb321081`。

桌面1440×900冷加载Café Parade!，进入EXPERT tick22000，23端点、612个hold顶点，三方向静态提示及长条实际可见。初次截图比DOM落后一帧，重新截图确认EXPERT/tick22000后才保存 `frame-final-desktop.png`。播放后暂停到tick44860/audio25.488931秒，audio.paused=true。手机尺寸390×844切横条、配速8、播放速度1.5，倒退tick22000后756个hold顶点、scrollWidth390；截图 `frame-final-mobile.png`。倍速播放后暂停到tick32304/audio18.354665秒。长轨图实际加载EXPERT Combo816，切回透视并切NORMAL后重置tick0/Combo302。控制台error/warn为空，未见框架错误覆盖层，最终DOM无临时探针。截图在 `.analysis/chart-native/`。此为桌面Browser手机尺寸模拟，没有真机/全曲长稳/GPU对照。

本批不实现Autoplay，不上传R2，不部署，不修改端口或候选版本。

## 第二批：隔离轨道与控制台更新

输入 `5a06e5f1`。第一批仍通过父组件cursor向轨道传位置，使每个60Hz轨道帧都运行整套父组件render与控制台查询。本批改用一个冻结容器传递独立shallowRef，只有透视轨道订阅高频tick。`SongChartPlaybackCadence`把同一次audio.currentTime采样分别交给60Hz轨道与10Hz控制台；长轨图继续30Hz。轨道自己从当前帧cursor积分读取窗口，不能拿控制台的旧cursor算跨BPM窗口。没有增加第二个rAF或模拟媒体时钟。

seek、暂停、恢复首帧和视图切换立即同步两处；跳前后音符、编辑tick前先读取实际媒体位置，避免10Hz控制台延迟影响定位。自然停止时最后一次rAF也会同步实际媒体位置。组件卸载及切歌/难度仍由既有generation、AbortController、cancelAnimationFrame和clock.dispose收口。

新增 `node scripts/verify-song-chart-playback-cadence.mjs`，覆盖60/90/120/144Hz显示输入下的轨道/控制台次数、长轨30Hz、媒体1.5倍速、倒退与精确暂停/末尾同步。既有frame-clock、media-element-clock、244档chart-timing、native timing/hold/effects和244档976窗口renderer回归通过。`build:check`29.84秒通过，2998模块，固定输出且不复制public；仅既有背景和大chunk warning。

### 真实组件的受控Browser回放

本地回归入口：`/scripts/fixtures/song-chart-playback-browser.html`。通过Browser点击“运行回放”，挂载实际ArchiveSongChartPreview/Track/Hold组件和真实来源谱面；只在此专用页面控制HTMLMediaElement与显示回调，用Vue mixin统计实际updated次数。它不修改产品页面，不是真实音频或设备FPS测试。

| 谱面 / 显示回调 | 10秒轨道更新 | 父组件更新 | 逐窗口几何检查 |
| --- | --- | --- | --- |
| Café Parade! EXPERT / 60Hz | 599 | 120 | 11 |
| Café Parade! EXPERT / 120Hz | 599 | 120 | 21 |
| Reversed Masquerade EXPERT / 120Hz | 599 | 120 | 21 |

受控回放包含每秒4次timeupdate，所以父组件实际为约12Hz，而不严格等于控制台的10Hz。两种显示频率下，轨道继续约60Hz、父组件约12Hz，证明高频tick不再传播成父组件每帧刷新。Reversed Masquerade从首个tempo变化前3秒开始，跨160→196 BPM；DOM各端点的sourceIndex和fraction与共享renderer逐项一致。三组均验证精确暂停、倒退3.12秒、长轨与透视重挂载。原始回执 `.analysis/chart-native/playback-cadence-browser-20261024.json`。

回归页最初的3.125秒时间轴输入被HTML range的0.01步长正规化；用例已修正为合法3.12秒，未放宽投影容差。长轨检查也从已退役的svg.chart-svg选择器修正为当前分片结构.chart-drawing svg。初次HTML缺少闭合head导致bootstrap注入500，已补齐标准文档结构。最终三组status均为passed；这些中间失败没有当作产品回归或最终通过证据。

### 实际媒体页面

同一5231/PID67724与release `1accd9d0`。单独Browser页冷加载Café Parade! EXPERT，桌面1440×900从tick22000/audio12.5秒播放，暂停时audio50.526217秒、轨道88926.14192000001、控制台88926，精度与显示舍入一致。手机尺寸390×844切横条/配速8/1.5倍速，暂停时audio32.036878秒、轨道56384.77856、控制台56385；倒退tick22000两处立即同步，scrollWidth390。长轨图实际加载EXPERT Combo816。截图 `frame-isolation-desktop.png` / `frame-isolation-mobile.png`，均在.analysis/chart-native。实际音频检查与上面的受控回放分别记账；没有真机连续FPS、GPU或全曲验收声明。

工作期间origin/master更新到`193c964a`（#95舞台、#96门户），按仓库规则在本批提交后普通merge同步；合并验证补记见后文。未上传R2、未部署、未改端口或候选绑定。

### master同步及最终补验

刷新隔离提交`f5157122`；随后通过普通merge `ab6f8911`纳入master `193c964a`。唯一冲突是`policies/tracked-binary-assets.v1.json`的生成元数据及汇总。使用合并后的生成器与Git跟踪集合重新生成，保留谱面四PNG和master新增十八张舞台PNG；`verify:tracked-binary-inventory`通过，441 PNG / 77,198,487字节。没有改资源内容、来源hash或配额，也没有上传。

合并后进一步把播放中切视图改为直接同步audio.currentTime，而非上一rAF缓存的pendingSeconds。受控回放新增“媒体已前进但控制台尚未更新时”点击下一个音符、打开tick编辑器、切长轨再切回透视的回归；三组均通过，轨道599/父组件120的次数及53个窗口几何检查保持。此后最后一次`build:check`27.99秒/3004模块通过；合并后、最后修正前的另一次构建28.51秒同样通过，二者都是同一固定代码输出目录，未复制public。最终构建日志`frame-isolation-final-build.log`。

最终源码再次Browser冷加载，手机尺寸Café Parade! EXPERT从tick22000播放，暂停时audio43.759564秒、轨道77016.70592000001、控制台77017；重新倒退tick22000，截图`frame-isolation-merged-mobile.png`。“返回歌曲”的最终URL实际为`/songs/cfprde/`，Café Parade!详情标题、完整混音播放器、难度表和演唱者均已加载；控制台error/warn为空，视口已恢复。首次记录在导航尚未完成时误记为歌曲列表，现以加载完成后的URL与内容纠正。

剩余验证边界：本批已验证刷新隔离、媒体位置同步和原生几何一致性；受控回放的599次组件更新不能当作前台GPU实际呈现599帧，真机/120Hz设备持续FPS仍未测得。无需为该回放边界改动原生几何或引入独立模拟时钟。
