# 动态物件逐渲染器全局排序

输入 HEAD `03d06be1`，分支 `codex/stage-chibi-wiring-20261013`。本批恢复 ObjectLayer 的全局渲染平面，不部署；其他暂缓灯光差异仍保留。

## 反查证据

`Growing.Live.LiveObjectObjectLayer.InitializeIfNeeded`（0x2220c48）在 `_keepOriginalOrder` 为真时，通过 b__8_0（0x2221410）/b__8_1（0x22214bc）保存各 ParticleSystemRenderer/SpriteRenderer 的原始 sortingOrder。PlayEffect 的闭包 b__0（0x1c9e17c）/b__1（0x1c9e288）先把每个渲染器设为脚本 value6，再按该标志加上缓存的原始排序。因此排序参与共享舞台，而不是仅在某个物件内部生效。

本地原资源索引：46个Sprite物件、135个Particle物件均keepOriginalOrder=true；Sprite实例原始排序均0。当前已接入的2个UV粒子物件与21个floor物件共72个系统，主要偏移+1，Drive偏移0，K.now O.nly两层偏移+1/+2。未实现的粒子模块没有借此变成支持状态。

实际例子：K.now O.nly脚本depth1700，两层分别应为1701/1702。普通人物1700、被聚光灯调整的人物1780，所以特效可以盖过前者而在后者后面。这说明不能统一把所有灯光/粒子移到人物后面。Flash Light的1599+1实际是1600，而非1599。

## 实现与验证

将已知渲染叶节点按全局排序偏移分成共享camera的直接子平面。复制原有局部变换与蒙版作用域；原容器继续更新蒙版世界变换，但不再渲染叶节点。保留平面级可见性/alpha以及组内原透明度。销毁时先释放平面持有的蒙版引用和叶节点，再销毁原蒙版容器，纹理仍由原runtime释放。未改变粒子池预算和采样算法。

- `node scripts/verify-chibi-object-renderer-planes.mjs`：真实Pixi Container/Sprite验证矩阵、透明度、mask身份、原始偏移开关、隐藏/恢复、幂等安装/销毁；核对当前K.now O.nly 1700+1/+2来源见证。
- floor Python/JS、particle-timeline、architecture-cleanup、stage-layer-order回归通过。
- `npm run build:check`通过，19.07秒，仍为固定`.analysis/build-check`且不复制public。
- 5212复用已核验归属的PID3064。Edge/SwiftShader Browser检查K.now O.nly、Flash Light、Take、Unite Mankind，分别观察1701/1702、1600、1651、1571，所有平面均为共享camera直接子节点；播放/暂停/倒退的粒子采样签名一致，390×844布局完成截图验证。
- GPU验证4组非重叠区域的软蒙版：alpha1/.5、scale1/.7，拆分前后RGBA最大差0。这验证独立区域的mask几何/透明度保持，不能推定重叠区域或Unity原材质一致。
- 页面当时记录SongReadModel/StageReadModel缺JSON路径错误，未列为歌曲读模型验收通过；随后已确认是此前重启5212漏带候选读模型环境配置造成，并非既有问题，见 [启动配置修复记录](STAGE_SONG_CATALOG_RESTORE_20261014.md)。

Browser小型receipt/截图在`C:/Users/windm/.codex/visualizations/2026/10/13/01a13599-5517-7113-9331-e6ac3c22279e/object-*`；日志在checkout `.analysis/native-chibi-wiring-audit/object-renderer-planes-*`。没有新增/复制媒体语料。

## 下一条已确认问题

重叠的半透明蒙版实验与旧整组合成存在差异，最大RGBA通道差64；不能把这一反例藏在通过结论里。原`Alpha Masked/Particles/Additive`片元在材质内采样_AlphaTex并修改每粒子的alpha，而当前Web使用Pixi组后置蒙版。跨层拆分符合原全局排序，但完整重叠合成仍需原材质内蒙版和混合因子的接线；旧单组结果本身不是原版真值。证据在`.analysis/engineering-validation-20261002/take-reference/floor-mask-shader.txt`及本批初次GPU日志。

另已确认Play粒子路径直接SetActive/Play，没有Sprite DOFade；Erase路径Stop(withChildren=true, StopEmitting)，之后DelayedCall/SetActive(false)。目前Web统一父alpha淡入淡出不等价，此处继续处理。透明深度/HDR、粒子RNG与完整三维投影仍不宣称还原。
