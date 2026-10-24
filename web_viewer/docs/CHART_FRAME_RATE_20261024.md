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
