# OUR SONG 云雾面板接线

来源输入 HEAD `f3cab367`，分支 `stage/20261020-native-followup`；其后 `cd5ae446` 仅追加旋转审计，没有修改运行时。本批完成此前保留的云雾晋升；旋转问题独立处理，不能据此宣称原片全部等价。

## 来源与消费者

`fx_in_ossshd_panel` 来自 `song_ossshd.unity3d`，SHA-256 `ede50a68a99662c835930a63d5a045d0f395aaee461a87757960e3950761cd48`。14 个系统由 8 个带寿命速度曲线的云雾和 6 个闪光组成，另有两份来源绑定的面板蒙版；没有 Noise/stretch 省略。速度曲线依据前批 [局部寿命速度积分](NATIVE_VELOCITY_CURVES_20261021.md)。

promotion 名单冻结 bundle SHA、全部 14 份 serialized file / 精确 PathID / 参数树 SHA；提取器对新增来源锁逐项检查。旧 90 资源与 101 份纹理描述和晋升前快照逐项结构相同。

新增 4 张原图（Texture2D 名 `fx_in_ossshd_cloud`、`fx_in_particle_variation`、`fx_in_ossshd_panel_1/2`），共 386,513 bytes。真实 RAW RGBA 像素检查通过。当前总量 **91 资源 / 762 系统 / 105 纹理 / 0 deferred**；56 个 partial 不变。完整晋升名单为 33 资源 / 180 系统。

编排 `ossshd_live_effect` 只有一条 Show：**−2000ms**，无 Hide。云雾每 7.5/8/9/12 秒循环出生，最长寿命 25 秒；不能把歌曲 0 秒当作系统起点，或在切换循环时清掉旧粒子。published-assets 回归覆盖 0/10/25/72 秒、冷定位与多循环回拖，并以合成 StopEmitting 验证最长寿命之后清空。8 个曲线系统的来源、曲线和寿命逐项绑定原生 worker fixture。

## 分片与 Browser

消费者目录 210 片（公共1、Penlight118、emitter91）；完整闭包 **4目录 + 447分片 = 451文件 / 33,141,596 bytes**。生成一致性、consumer guards、inventory 与实际路径/长度/SHA 校验通过。

旧 5213 进程对新路径返回 HTML；核实后只重启该服务，仍用主 checkout 与 `rm-release-20261015` 候选，实际进程 70620。新 emitter shard 返回 application/json，76,743 bytes。

完整加载的 Browser 观察：

| 时刻 | 结果 |
|---|---|
| 歌曲0秒 | 面板已在对象层中，共83粒子 |
| 10秒 | 云雾/蒙版可见，面板是唯一对象层，共85粒子 |
| 25秒 | 面板仍在，共82粒子（含当时spotlight对象） |
| 72秒 | 多次循环后仍在，共155粒子（含glitter/spotlights） |
| 回拖/刷新后10秒 | 均恢复85粒子 |
| 实际播放 | 从10秒到27.5秒后暂停 |

桌面1280×720、手机尺寸390×844，手机文档宽度/scrollWidth均390。采样窗口 unsupported/deferred 都为空，控制台 error=0，不宣称 warn=0。返回 `/songs/ossshd/?maintainer=1` 后，真实歌曲内容加载完成（1:43音频、52/120/268/382 Combo），stage参数已清理。

截图位于本机 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/ossshd-cloud-10s-desktop.png` 与同目录 `ossshd-cloud-10s-mobile.png`。没有原片、真机或生产验收。

## 验证与边界

RAW提取/像素一致性、emitter published-assets、consumer一致性/guards、完整闭包均通过。缺消费者资源 **22→21**，缺口事件 **336→335**，涉及编排 **11→10**；partial资源21、缺来源0均不变。

账本 `2026-10-21-native-ossshd-panel-001` 记录本地来源晋升，206 releases / 1,376 stable IDs；PNG inventory 411 / 73,169,817 bytes。历史 archive baseline 仅同步两个 PNG 统计字段。

本批没有改编译期前端代码；独立Python提取器和数据变化按构建策略运行来源/合同/HTTP/Browser检查，没有复制语料或重复执行Vite。已有源码构建记录见上一批。共享粒子的旋转问题见 [旋转审计](NATIVE_PARTICLE_ROTATION_AUDIT_20261021.md)，仍开放；本批接线通过不等于该问题已解决。没有R2上传或部署。

源码门禁164/164通过（同步master #66–#68之前的分支基线）。账本首次校验因单次cat-file输出超过512MiB而失败；读取器已改为先查对象大小、按16MiB预算分组并仅保留当前组，逐文件index/HEAD字节及eol检查不变。强制极小预算、缺失对象及跨组回读回归通过，相关门禁补跑70例通过；修复后实际206份账本、PNG inventory及历史baseline检查均通过。
