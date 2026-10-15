# 背屏位置、尺寸和公共 RectTransform 链路

输入 HEAD `66738f42`，分支 `stage/20261014-native-fidelity`。接续 [切歌清理批次](NATIVE_STAGE_SCENE_RETIREMENT_20261015.md)，本批解决该记录中尚未完成的背屏位置/缩放与逐歌补偿问题。

## 根因：将 RectTransform 当作普通 Transform

原实现使用 `250 - scriptY`，Take 01/02 又改成231、Possibilities改成242、Change to Chance增加(-150.5,137)补偿；movie纹理272×144再乘2决定显示尺寸。这些是画面拟合，不是原生显示面。

真正缺失的是 `LiveObjectBackmonitor/Base` 的 **RectTransform.anchoredPosition.y=1.350000023841858**。该对象序列化的 `m_LocalPosition.y` 恰为0，旧导出只读取后者，丢失了布局坐标。Base 的父节点是普通 Transform；Base 和 MoviePanel 的 anchorMin/Max/pivot 均(.5,.5)、SizeDelta均(1,1)，MoviePanel anchoredPosition为0，因此该绑定的 anchor reference offset 为0，Base 向上偏移1.35 Unity units。该偏移位于 scripted root scale 内，不能用固定110像素偏移替代。

Unity 的 [RectTransform.anchoredPosition 定义](https://docs.unity3d.com/2020.3/Documentation/ScriptReference/RectTransform-anchoredPosition.html) 明确以锚点参考位置描述 pivot。这里按实际绑定和序列化布局解算，没有将此规则无条件推广为所有 RectTransform 都能忽略父尺寸、pivot或旋转。

`live_chibi_backmonitor_geometry.py` 重新绑定并验证：

- resources.assets MonoBehaviour135504 的 `_moviePrefab` →110859、`_baseObj` →GameObject7269。
- MonoBehaviour110859 → CriMana controller125252 → target SpriteRenderer53127 → Sprite1734，所属 GameObject8836 `LiveObjectBackmonitorMoviePanel`。
- Base为RectTransform，anchoredY=1.35；MoviePanel scale=(16.25,8.4375)。Sprite1734实际mesh bounds约±.16、PPU100，显示面为 **520×270 stage pixels**。
- 序列化组件/Transform/Sprite 的源哈希和原始布局字段保存在 `scripts/fixtures/chibi-backmonitor-geometry.json`；整体 data.unity3d SHA256 `d35231c0b00a09f6941f47f7ffedde9e9b35701f5b66d6f432517da860e1a500`。生成共用 `chibiBackmonitorGeometry.js`，不复制媒体、不修改共享 public/assets。

## 客户端显示链与公式

`BackmonitorLiveEffectTypeExecuter.PlayEffect` `0x231da70` 直接转交数据，没有逐歌改写XY。`LiveEffectData.Parse` `0x1d6d110` 按字段名称读取value3/4/5，AsInt/TryParse无坐标补偿；重新读取四首歌RAW CSV表头与行，索引没有列错位。

`LiveObjectBackmonitor.PlayEffect` `0x22186e0`：value3/4 → `ScriptPosToStagePos` `0x2218894` → root localPosition；value5AsFloat → root localScale。已重新核对AArch64三个输入/返回分量。BasePos=(0,360,0)，pixelToStagePos=.01；网页1280×720原生设计面结合既有stageScale/ortho投影为100 stage pixels / Unity unit。

CRI controller `RenderTargetManualSetup` `0x129fea8`、`OnMaterialAvailableChanged` `0x12a00d0`、`CriInternalUpdate` `0x129fde8` 已从IL2CPP只读工程重新导出：绑定/恢复材质与切换renderer显隐，没有按电影像素尺寸改Transform。电影的编码分辨率不决定面板矩形。

设脚本缩放 `r=value5/1000`，fit含网页环境缩放，则在共享camera父矩阵之前：

```
centerX = viewportWidth/2  + scriptX * fit
centerY = viewportHeight/2 + (360 - scriptY - 135*r) * fit
width   = 520*r*fit
height  = 270*r*fit
```

因此脚本点是显示面的底部中心。JF `x=75,y=280,r=1.3`：设计面中心(715,264.5)、尺寸676×351；旧版中心(715,330)、尺寸707.2×374.4。Take r=.92 的等效Y基准235.8、Possibilities r=.86为243.9，解释了固定补偿为何看似能修一首、换缩放又错。

早期只接360原点和520×270、尚未接Base偏移的本地试接，在Browser中使Take视频掉出屏框；该反例促成继续检查RectTransform，没有提交为完成。这一轮保留完整原生链，删除所有歌曲名定位分支。

Movie和转场用上述原生矩形尺寸，Logo/Back/Noise/Grow共用Base中心及root scale；移除movie乘2与其他层再除2的互相补偿。动态Image_layer场景使用原生全局sortingOrder，不能因没有静态背景条目就降到-30000。转场按客户端PlayMovie `0x1bbcc0c` 的base+2排序。既有不可拆分的legacy composite仍保留后置兼容平面，该资源边界不属于逐歌坐标特例。

932条Backmonitor原始命令的value101 erase census为0；未因没有命令样本而宣称逐帧erase覆盖。切歌清退由上一批的场景release完成，仍覆盖迟到纹理归属。

## 验证与边界

- `verify-chibi-backmonitor-layers.py` 从实际APK重读绑定/布局/源哈希，校验现有三个PNG和材质；通过。
- `verify-chibi-backmonitor-registration.mjs --published-assets`：14,520组布局（932条真实命令+缩放探针，5种视口、3种环境尺度），独立root→Base→panel矩阵、底边不随缩放漂移、编码尺寸无关、无歌曲特例。实际SFC验证动态场景/legacy composite、movie/transition相同几何、transition+2；通过。
- backmonitor controls、logo、stage layer order相关回归通过。`npm run verify:source-batch` **142/142通过**；不等于完整Source Gate workflow全部执行。
- `npm run build:check` **23.41s通过**，固定 `.analysis/build-check`、copyPublicDir:false、既有大chunk提示；生成审计元数据已恢复。后续仅源绑定校验/文档变化，无第二次前端构建。

Browser使用原5212/PID61564、本worktree的Vite：1440×900检查JF 4s顶部、Take 01 5s、Possibilities 5s、Change to Chance 5s三个屏孔；Take 02 95.9s及曲末Logo与屏框共用锚点；390×844检查JF 4s。OUR SONG实际播放到28.8s后切JF，HIGH JUMP实际播放至曲末后切JF，两次JF的静态背景归属均为空、没有旧布景遮挡；冷加载JF再到4s画面正常。证据在任务visualizations目录：`joyful-native-backmonitor-4000-final.png`、`joyful-native-backmonitor-mobile-final.png`、`take-native-recttransform-5000.png`、`possibilities-native-backmonitor-5000.png`、`chance-native-backmonitor-5000.png`、`take02-native-backmonitor-logo-ending.png`、`joyful-native-after-playing-our-song.png`、`joyful-native-after-playing-high-jump.png`、`joyful-native-backmonitor-cold-4000.png`。

接线过程中先新增import再生成模块，Vite曾记录两条HMR reload失败；模块生成后恢复。最终冷加载未新增error，有两条来自既有pixi-spine tint/update调用的库warning栈，未把本轮写成“全程零console信息”。原生camera、HDR/后处理、原机设备和剩余未接指令的完整等价不在本次几何修正的完成声明内；无部署、无master修改。

## 跟进 master 后复验

修正提交 `cf070302` 保留为独立批次。fetch核实master前进10个提交后，依 `GIT_WORKFLOW.md` 用merge commit `425c89c7` 合入 `origin/master`（当时 `dc348a9c`），无冲突；舞台修改文件没有被合并覆盖。没有修改远端master。

合并后的 `build:check` **19.00s通过**，仍是同一固定代码输出目录、不复制public；生成审计元数据已恢复到合并后HEAD。随后完整 `verify:source-batch` **142/142再次通过**。5212继续使用原PID61564，合并后JF 4s Browser画面和 `native-backmonitor-plane-v1` 归属复验正常，截图 `joyful-native-backmonitor-merged-4000.png`；未重启服务或更换端口。最终提交前恢复临时viewport。
