# 背屏图层反查：绑定结果与 Logo 透明度修正

本批输入 HEAD：7e1fddb4。沿用户要求继续检查图层与着色，未把背屏整体排序简单提前。

## 原版资源与调用链

XAPK 来源同 chibi-backmonitor-logo-native.json 的源绑定。实际重读 resources.assets，LiveObjectBackmonitor 脚本 pathId135504 指向：

| 字段 | 实际绑定 | prefab 排序 | SetSortOrder 后 |
| --- | --- | --- | --- |
| _moviePrefab | 110859 / LiveObjectBackmonitorMoviePanel | 待补电影 mesh 绑定 | base |
| _backSprite | 56739 / BackSprite | 980 | base-5 |
| _logoSprite | 132450 / RotateSprite，MeshRenderer45611 | 1005 | base+1 |
| _noiseSprite | 55366 / NoiseSprite | 1020 | base+5 |
| _growSprite | 55251 / GrowSprite | 1150 | base+110 |

原始字段/材质/Transform 回执：.analysis/native-chibi-wiring-audit/backmonitor-native-layer-bindings.json。prefab 排序与脚本运行后的排序不同，不可仅复制 prefab 数字。当前 Web 仍用背屏父容器-30000、电影-10000、转场-9999、Logo-9999.5，通过静态舞台图透明孔遮挡。嵌套容器排序不能表达原版几个 renderer 分别与其他特效交错，需要先补电影面板与真实遮罩/舞台层绑定。

decompiled_pass3_annotated/Growing.Live.LiveObjectBackmonitor.c：PlayEffect 0x22186e0 读取 value8 设置排序；读取 value7AsFloat 写入 _growSprite 的 alpha；value9 给 SetLogoSpriteIfNeeded。当前解析只保留至 value7，后两项仍漏接。

## 本批确认并修正的错接

旧版 Drive Logo 淡出将 value7 当毫秒时长，其他限定曲目则直接显示到 alpha1。这与原版不符：value7 属于 GrowSprite。

LiveObjectBackmonitor._PlayMovie_d__19.MoveNext 0x1bbcc0c 从 value6AsInt==1 得到 showLogo。结尾目标取 DAT_0317a32c（原 ELF float32=0.8000000119）或0，duration 为0.5秒；skip 分支才是0。RotateSprite.FadeAlpha 0x243588c Kill 自身 tween 后，对 mesh material 调用 DOFade 并 SetTarget，没有用 value7。

已补充只读 Ghidra 反编译两方法，输出 .analysis/native-chibi-wiring-audit/decompiled-backmonitor-layer/，2方法成功、0失败。当前普通播放使用500ms、目标0.8、默认OutQuad，从现有 alpha 继续；每个背屏指令都会重新发起 FadeAlpha。切电影不硬清 alpha，保留此前独立记录的旋转相位规则。

仅修改当前三个预览曲目的 Logo 透明度消费者及导出模型说明，不放开其他曲目。Logo 几何、旋转相位、电影切换的异步完成时刻仍未完全恢复；skip 初始化分支没有被包装成普通时间轴命令。整体背屏排序与 GrowSprite 还未实现，不宣称背屏链路完成。

## 验证

backmonitor-logo --published-assets、原始Logo解析、backmonitor-controls --published-assets、backmonitor-registration、backmonitor-parser 通过。增加断言：value7 为0/1000不影响 Logo 渐变；重复show与快速hide从当前 alpha 续接；shader uniform接收采样透明度。

build:check通过，固定 .analysis/build-check，无public复制，日志 .analysis/native-chibi-wiring-audit/native-logo-alpha-build.log。更新本地 stage-effects/index.json 的 Logo 模型（语料文件被Git忽略）及构建生成的 resource-audit 摘要，不修改媒体文件。

5212现有服务、实际Edge/Playwright：Drive16s alpha0.672、16.2s0.8、29.8s0.288、30.1s隐藏；回退29.8s复原，390×844同值。Take95.85s开始show，96.1s0.6、96.4s0.8。逐项核对实际mesh可见性和shader uniform；页面错误0。截图/回执位于 C:/Users/windm/.codex/visualizations/2026/10/13/01a13599-5517-7113-9331-e6ac3c22279e/native-logo-alpha-*。这不是完整原版视频/真机验收。
