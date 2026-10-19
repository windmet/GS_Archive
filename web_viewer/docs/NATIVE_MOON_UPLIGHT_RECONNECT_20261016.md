# MOON NIGHT 上照灯恢复与公共实例限制

输入 `e8f4e5f0`，分支 `stage/20261014-native-fidelity`。用户发现 MOON NIGHTのせいにして 的地面上照灯整体消失。原因是此前能力守卫按整份轨道禁用：该曲1,840条旧悬灯事件中有30条空参数Show，整首因此被判unsupported，正常灯也没有加载。

## 原始灯与接线

重新读取 `song_montns.unity3d`、APK五种旧悬灯prefab及解密ELF。该曲用到 `Suspensionlight`、`Suspensionlight_2`、`Suspensionlight_3`、`Suspensionlight_5`，共用 `sidelight` texture、1024×1024 Sprite、100 PPU、Unity pivot(.5,1)、fx_in_sidelight固定60°及angle60 Animator。不是新增MOON专用灯型。

ApplyData `0x22270d0`明确：value8/9定位经ScriptPosToStagePos；value5选择LeftRightBase的X0/180；value7是根Z角；value6AsFloat整体缩放；value10是HTML颜色；Animator.speed=2/value4AsFloat；value11排序。PlayEffect调用ApplyData/SetActive/Show，活动实例改速不Rebind。EraseEffect `0x222738c`的普通路径200ms淡出，完成回调 `0x222753c`才SetActive(false)。原生父链与相机投影沿用已证实模型，不恢复旧经验光束大小或公式。

例：1.6秒id301..306为橙色#ed8b00、scale125、period999999ms、Y312；id201..204为scale500/550、period9999999ms、Y282/255。5.1秒另有正常id101..104黄色灯以及_2拍点灯。这些极慢但有限的period是原始值，不应当成无效或强制设固定角度。

## 缩小限制范围

105份来源轨道现在区分96份supported和9份partial。partial均是已绑定模型、存在非正动画/颜色周期的轨道；全库数据和文件SHA仍强制匹配，未知prefab仍拒绝。MOON与另外8份anwhre/hndmkh/hrkzbn/ossshd/pl1gdd/steqmg/yivygr/yknkmh共用同一加载链。

运行时按 `command:id` 记录每个活动生命周期。遇零period Show不再跳过该行、沿用旧正常相位，而标记该实例的非有限时间未决状态；后续同实例有限Show仍不能证明时钟已重置。正常其他灯继续播放。只有完成Erase的200ms淡出并停用后，新的Show才启动新的有限代次；淡出中Show会取消停用，限制保持。后退seek从事件重算，能够恢复异常前的正常灯。

这不是证明原客户端隐藏了异常灯。守卫仍表示最终Unity非有限欧拉Transform输出未证实；Web不向Pixi写NaN，也不编造固定角度。新增 `data-old-suspensionlight-unresolved-ids`给出当前受限实例，不能只看整曲partial标签判断全部灯缺失。颜色周期和BPM未决同样留在实例通道内。

## 验证

- Python native ELF+Unity重放通过：105份RAW/轨道、88,647事件、五种prefab及shader、16段Unity窗口、非有限时间来源边界。生成后不写入重放一致；仅更新独立sidecar，未改共享public/assets。
- JS published-assets回归覆盖全部105轨道，新增异常Show、后续有效Show、淡出取消/完成、其他灯隔离、回拖，以及MOON多时刻正常灯恢复。正常状态几何有限，受限状态alpha0且明确unresolved。
- `npm run build:check`：2950 modules / 23.12s，固定.analysis/build-check、copyPublicDir:false；`npm run verify:source-batch`144/144通过。生成的无关审计/翻译元数据恢复，无完整媒体包、无部署。
- 5212复用本分支PID61564，构建后新建Browser冷页。1.8秒18盏正常灯、无受限实例；6秒18盏正常灯，201..204四实例受限；20秒19盏正常灯，黄色大束可见；80秒32盏正常灯，_5颜色通道与201..204新代次恢复，_3:401..410仍受限。390×844回拖6秒正常。Study切换后旧MOON实例清空，原有Pinspotlight画面保持；返回Study详情和难度表实际载入。

冷页无应用error，保留既有Spine tint/update弃用warning。截图 `moon-native-uplights-*`保存于本聊天visualizations目录，临时viewport恢复。Browser证明Web呈现及生命周期接线，不是原片逐帧或Unity真机等效。保留无关 `src/core/chibiRandomMotion.js` 草稿。
