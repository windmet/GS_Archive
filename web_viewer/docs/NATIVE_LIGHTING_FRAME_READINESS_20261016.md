# 聚光灯交接的一帧亮闪：资源与当前帧就绪

输入 `4e440d8a`，分支 `stage/20261014-native-fidelity`。承接[MOON公共上照灯恢复](NATIVE_MOON_UPLIGHT_RECONNECT_20261016.md)。用户在Beyond The Dream约37秒、∞ Possibilities约3秒等演出中看到亮暗操作时闪一帧。图片能确认两种不同灯型，但不是闪帧截图；本批用实际播放的渲染前计数和同步调用回归定位。

## 漏接点与修复前证据

`createSpotlightSpriteStore.ensure`原先对每个新ID都进入Promise.all.then。即使共享贴图已经加载，已resolve的Promise也会把实例安装推迟到当前JS栈之后；ensure仍返回null。`updateStage`在同一栈中已完成角色排序、灯光采样并调用ticker.update渲染，因而新灯缺一帧。

Pinspotlight更明显：新ID蒙版缺失时，`syncSpotlightBackground`为避免画实心暗场，直接隐藏整张环境染色层。于是角色和场景短暂回到未染暗状态，下一帧蒙版安装才恢复。普通Spotlight也共享同一store：角色排序已改变，新光束却尚未安装。不是漏读CSV颜色，也不能用增加渐变时长掩盖这一异步安装问题。

修复前先只加入渲染前pending计数，在5212冷页实际播放∞ Possibilities：记录4个资源未齐的渲染帧，最后一次6914.02ms，pending为Pinspotlight 5/6/7（fx_in_psblts_pinspotlight）。来源首段1800/3500/5200ms等使用新ID，同资产仍会走异步安装。`lighting-before-frame-receipt.json`保存该结果。

同时新增回归：共享贴图加载后，新普通Spotlight ID2必须在ensure返回时存在。旧代码实际失败，actual=null；不是等微任务后再检查而漏掉该帧。未声称截图抓到了闪亮的那个像素帧。

原生Show链作为语义对照：Pinspotlight.Show `0x2223ba8`绑定AlphaSpriteMaskSystem后更新SpotlightBackground；Spotlight.Show `0x22262c0`更新目标与排序。现有本地ELF来源和RAW合同不包含Web Promise的延后创建步骤。本批不改原生渐变、OutBack、排序或曲目参数。

## 公共修正

- 共享store有完整已加载贴图时，同步创建并返回新ID实例；不调用onReady递归重入当前同步过程。首次异步加载仍保持generation检查、失败抑制及资源销毁。
- 新增texture-only prepare：预备资源不提前创建或显示灯。seek和播放开始前，按整份歌曲指令收集后续会用到的Spotlight及Pinspotlight mask变体，并备齐共用背景贴图；尚未就绪不能开始这次播放。所有118份编排走同一函数，不设歌名分支。
- 播放意图在资源await后再检查，取消／切换不会由旧准备恢复播放。新ID与暗场／角色排序同帧提交。
- 保留当前渲染前的 `data-lighting-incomplete-frames` / `data-lighting-last-incomplete-frame`，每次开始播放重置，供实际播放复查。它统计Spotlight/Pinspotlight/背景store的pending实例；不是GPU逐像素闪烁检测器，也不代表所有可能的色彩问题都已覆盖。

## 验证与实际边界

Spotlight store回归覆盖已加载新ID的同步返回、预备不显示、共享请求、释放代次、迟到结果和失败销毁；实际SFC prepare对118份编排逐一验证未来mask变体。Pinspotlight、SpotlightBackground、旧悬灯、激光、Penlight回归通过。角色BodyColor的RGBA/OutQuad、晚创建mesh、材质恢复和1,188条控制回归通过；未把这一CPU回归称为所有角色亮暗效果的GPU逐帧验收。

播放意图增加lighting准备取消边界，69个协议/时序用例通过。`npm run verify:source-batch`144/144；`npm run build:check`2950 modules /21.57s，copyPublicDir:false、固定.analysis/build-check。无完整媒体包或部署，无关生成审计/翻译元数据恢复。

5212继续使用本分支PID61564，构建后新建Browser冷页：

| 旅程 | 实际结果 |
| --- | --- |
| ∞ Possibilities从0实际播放到曲末 | 缺灯帧0、last为空；时间轴120800ms/max120863.28798185941，自动暂停。此前4帧缺口不再出现 |
| Beyond The Dream从35秒实际播放到96.4秒 | 跨越37.28秒新Spotlight5等交接，缺灯帧0、last为空 |
| Beyond The Dream回拖37.5秒，1440×900 | 灯4/5、环境alpha0.8，第5位明亮，其余染暗；原生光束/地面光圈显示 |
| 切∞ Possibilities回拖3.5秒，1440×900 | 环境alpha0.8、3个mask（含原始移至画外的灯），左侧目标正常照亮 |
| 同页390×844 | 页面clientWidth/scrollWidth均390，mask和亮暗状态保持；无横向溢出 |
| 返回歌曲 | `/songs/psblts/?maintainer=1`，歌曲详情与难度表实际载入 |

两份最终冷页console无应用error。截图 `lighting-after-byndtd-37500.png`、`lighting-after-psblts-3500.png`、`lighting-after-psblts-mobile-3500.png`和前后receipt位于本聊天visualizations目录。早期多标签viewport尝试未作用于旧标签页，相关截图已用最后实际尺寸验收覆盖；不拿470像素截图充当390像素验收。临时viewport恢复。

MOON恢复已推广到105份旧悬灯来源轨道，其中9份partial只限制异常活动代次。这个能力边界与本次Web资源调度修正是两件独立的事；原生非有限欧拉最终写回仍未证实。本批保留该边界及无关随机动作草稿，不引入新的亮度／光束经验参数。
