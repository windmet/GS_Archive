# Made in「 ♪ 」面板粒子接入

输入 `30630e07`，分支 `stage/20261020-native-followup`，已含master `af58d6eb`。本批接入`fx_in_mainha_panel_1/2`；没有修改原始编舞或运行时粒子数学，未部署。

## 来源与能力

原始`asset/song_mainha.unity3d` SHA-256 `a91bfa826882a52ab46b2020f0d5b60b17f93ab44752b4002881dd4b0e936bd0`。两组各3/6系统，绑定精确64位PathID、serialized file、参数树SHA及bundle SHA；各有一份独立AlphaTex蒙版。新增4份Texture2D原图共701,247 bytes，逐RGBA与挂载RAW一致。

两组共6个Noise系统继续标注`noise_preview`，另3个普通系统不加该标记。preview名单新增逐系统`systemPartials`合同；提取时要求整个数组与来源顺序一致，并继续限制Noise能力，不将整组普通系统伪装成Noise。旧名单的统一`partialMarkers`合同继续兼容。

原有91组模型/105份纹理描述与批前快照逐项相同。当前**93组 / 771系统 / 109纹理 / deferred0**，62系统partial（54 Noise、7 stretch omitted、1 stretch preview）。33项完整晋升/180系统未改，preview名单10→12项。

新普通系统中一份使用3D粒子旋转，原生hierarchy/context/顶点证据扩至**62例、17份真实3D父链**，全部匹配。没有放宽非平面父链、透视/动态父链或原生RNG/时钟边界。

## 生命周期与闭包

两组在`mainha_live_effect`均只有一条Show：**−2000ms**，无Hide。短寿命普通光纹每3秒循环，Noise系统每1秒循环；定位必须保留负2秒启动、跨周期存活及各自蒙版，不能从歌曲0秒重置。

published-assets回归扩至全部12个preview资源的57个真实show/restart窗口，新增两条负时间轨道。每个新系统均验证真实历史可发射、0/1/10/30秒冷定位、72秒后回拖及合成StopEmitting退场；所有系统mask引用与RAW对应。完整场景还包含其他既有partial灯光，因此不标整曲完整还原。

消费者目录新增两份emitter，共212片；完整发布闭包为**4目录 + 449分片 = 453文件 / 33,188,084 bytes**，实际路径/长度/SHA逐项校验通过。旧失效分片留盘，不进入当前闭包。

publication记录`2026-10-21-native-mainha-panels-001`只记本地来源晋升；账本207 releases / 1380 stable IDs，受管PNG415份 / 73,871,064 bytes。历史archive baseline只同步PNG两个统计字段和5份账本标记，未重写历史人口字段。ledger、source-only baseline均通过；没有R2上传。

## Browser与限制

原5213 PID56064对新分片返回HTML；核实后只重启该端口，现PID43808，主checkout、`rm-release-20261015`候选不变。完整模式实际载入两组面板，采样窗口unsupported/deferred为空。

| 检查 | 实际结果 |
|---|---|
| 歌曲0秒 | 978对象粒子（含其他既有对象） |
| 10秒 | 两份面板蒙版/粒子可见，共1011 |
| 72秒 | 多循环后1160 |
| 回拖/整页刷新10秒 | 均恢复1011 |
| 桌面/手机 | 1280×720及390×844；手机document/scrollWidth均390 |
| 实播 | 从10秒推进，经66.3秒至114秒曲末 |
| 返回歌曲 | `/songs/mainha/?maintainer=1`，F-LAGS、1:54音频及61/128/296/427 Combo真实载入 |

**实播中两次暂停操作发生CDP超时，未确认暂停交互成功**；曲末页面恢复响应，之后冷重载与返回正常。现有证据不能判断是工具焦点/隔离世界超时还是场景负载，保留为响应问题。冷重载检查console error=0，不宣称warn=0。沿用手动编队，未点击原曲成员，截图不证明原曲编队。

独立Node采样诊断（9个新系统，非Browser/GPU帧率）：10秒/60秒冷采样约170/361ms，随后各60帧采样中位数5.22/5.01ms、P95为10.41/8.39ms；不能据此解释浏览器超时或宣称设备性能通过。记录`.analysis/mainha-sampler-timing-20261021.json`。

截图在本机既有QA目录：`mainha-panel-10s-desktop.png`、`mainha-panel-10s-mobile.png`。RAW重提取、旧模型不变、emitter、旋转、consumer生成/guards、实际发布闭包和账本均通过。本批只改数据、Python提取器和独立回归，未修改前端依赖；依构建策略不重复Vite，最近源码build为上一批master同步。没有原片、真机或生产验收。

`npm run verify:source-batch`最终168/168通过，日志`.analysis/mainha-source-batch-20261021.log`；publication重验通过，日志`.analysis/mainha-publication-20261021.log`。原生角点工具不带`--write`重放一致性通过。

缺口从21→19种、335→333事件、10→9编排；非平面父链、未支持shape、火焰/Bloom/电弧等继续开放。

续查剩余19组的RAW预览模式，未写public：共99系统可提取、48系统拒绝。`pfofos_fire_1..8`各7系统/deferred0（每组5系统partial），`remasq_shockwave`3系统/deferred0且全partial，可作为后续来源与能力边界核查候选，当前没有晋升。其余首次拒绝项为缺core模块9、寿命颜色模式12、非平面父链17、shape2、velocity limit8；这是检查顺序首先命中的原因，不代表所有后续字段都已通过。完整报告`.analysis/remaining-after-mainha-profiles-20261021.json`。
