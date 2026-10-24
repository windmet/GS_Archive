# Autoplay接线条件复核

2026-10-24；审阅输入为用户提供的《GS_Archive谱面预览器：当前进度与Autoplay可行性》，实查分支chart/20261023-native-projection / dba5b8f1。本次只评估接线条件并修正默认视图，没有实现Autoplay，也没有提升帧率或部署。

## 判断

可以做好“自动演示”的事件与反馈接线；还不能把现有条件等同于“原生命中特效可直接完整接入”。审计对谱面、时钟、几何已就绪的判断成立；其中项目セカイ的示意图片不作为SideM原生视觉依据。第一阶段无需重提RAW、重做长条几何或重建PNG导出。

| 范围 | 当前依据 | 就绪程度 |
| --- | --- | --- |
| 时间与跳转 | ArchiveSongChartPreview的audio.currentTime、seekSeconds/stopPlayback/loadChart；utils/mediaElementClock覆盖playing/waiting/seeking/ratechange等状态 | 可复用，但演示调度尚未实现 |
| 演示事件表 | SongNotePresentation.songNoteEndpoints/songHoldMiddleNodes；SongChartTiming分段BPM；playableSongChart排除歌曲后异常对象 | 可预计算，保留sourceIndex与head/middle/tail身份、同刻事件组 |
| 几何 | SongTrackNativeProjection、NativeNoteGeometry、NativeHoldGeometry | 已有原生回执；持续按压的视觉状态仍需独立接线 |
| 普通/同时音符、长条首中尾、Special/P技能的演示反馈 | 已有时间、轨位、类型、首尾关系 | 可做Web演示层；没有自动证明其原生特效对应表 |
| flick方向提示 | NativeEffects及默认2 prefab静态锚点、两层轮廓/填色、162组根节点回执 | 可复用；不等于命中粒子或长条持续效果 |
| 原生命中/持续效果 | names.tsv可定位ShowHitEffect 0x242a430、HitEffectManager.Initialize/Create/CreateInner；当前native-effects配置没有完成此映射与播放器 | 尚需核对类型→效果选择、prefab/材质、时长和创建/停止/回收链；不能仅复用静态flick合同就称已接好 |

本轮直接使用共享事件函数核对244档：未过滤RAW中的4档在事件总数与PB最大Combo上有差异；经过现有playableSongChart/音频长度过滤后，endpoint数+native middle数在244档全部等于PB最大Combo。这个结果支持事件表完整性，不证明分数/技能/输入判定或每类命中特效已经恢复，也不能无依据地排除Special事件。

## 建议的接线边界

- 一个预编译、按音频秒数排序的演示timeline，共享现有时间函数；不新增RAW格式，不逐帧全表扫描找下一个事件。
- 瞬时反馈按mediaTime-hitTime取年龄；hold在[start,end)保持，沿分段BPM秒数的poly推进，middle独立触发。不能只看当前可见glyph：它在越过cursor时就被裁掉，必须另有短生命周期效果层。
- seek、回到开头、切歌/难度、重新加载与卸载有显式generation/discontinuity重置；大幅快进不补发沿途全部效果，倒退后重建持有区间。暂停/缓冲时年龄冻结，倍速仍跟音频秒数；不靠独立CSS时间让闪光在暂停时继续跑。
- 普通/同时/Special/P技能可先使用清楚标识的Web演示反馈。要声称原生效果，先补ShowHitEffect/HitEffectManager的选择与资源证据，再以共享函数、方法hash fixture、旧估计变异失败及实际页面验收闭合。
- 自动演示不是触摸判定；不增加分数、生命值、Perfect/Great或技能状态机。可先显示演示命中数；即使当前总数对齐PB Combo，也需明确其是演示统计。
- 原生nextFlickNote连线、完整ParticleSystem/GPU与真机验收分别保留任务边界，不作为事件调度第一版的前置依赖。

## 帧率现状

ArchiveSongChartPreview.updatePlayback使用requestAnimationFrame，但仅在now-lastPaint>=33时更新cursor，约30Hz上限；注释说明这是为避免iPad 120Hz屏幕导致整套谱面/工具栏高频失效。rAF本身没有锁在30Hz，实际设备帧率也未在本次测量，负载与rAF采样可能进一步降低更新频率。

审计提出轻量特效层是合理方向，但CSS/Web Animations不能无条件自由播放：其年龄仍须绑定媒体时间，处理暂停、缓冲、倍速与seek。建议下一批先实测长条较多窗口的几何/提交开销，再决定轨道60Hz及特效层更新策略，不把33直接改成16便宣称稳定60fps。本次没有改该限制。

## 默认视图修正

原本mode初始化就是perspective，但standalone的onMounted在<=760px时强制改成long。移除此覆盖，所有宽度首次进入均为透视轨道；仍可手动选择长轨图。

验证：build:check通过（17.04秒、2996模块；固定.analysis/build-check，无public复制），保留既有背景未解析/大chunk warning。media-element-clock与244档chart-timing回归通过；共享事件函数核对244档playable事件总数与PB Combo均一致。

真实Browser复用本worktree5231/PID67724：手机390×844冷刷新Change to Chance，加载完成时tick0、透视轨道aria-pressed=true，手动切长轨aria-pressed=true；桌面1440×900从歌曲详情打开Café Parade预览，也默认透视。截图.analysis/chart-native/default-perspective-mobile.png及default-perspective-desktop.png。返回来源页实际为先前入口Café Parade（切曲后仍回到原来源），标题/难度表已加载，URL为/songs/cfprde/；随后恢复用户原来的cgtocc预览URL，重置viewport。控制台error/warn为空。仅桌面Browser手机尺寸模拟，没有测量或承诺设备FPS。

改动仅移除默认模式的手机覆盖，未修改33ms更新限制。未实现Autoplay、未复制素材库、未上传R2、未部署。
