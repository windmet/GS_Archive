# 背屏透底、RAW 控制字段与新录屏光效目标

输入 HEAD：6ad0ab0d，分支 codex/chibi-stage-reconstruction-20261002。

## Change to Chance 透底原因

原 CSV 的 Backmonitor 第九列（value7）被生成器命名为 opacity，消费者除以 1000 作为 alpha。Change to Chance 的 14 行全为 0，因此整首视频完全透明；全画布下方又固定有练习室 CSS 背景，便从星形镂空透出。

全库已发布索引中该字段值分布为 1000:778、空:73、0:57、500:19、1100:5。原生 LiveObjectBackmonitor 有 DefaultSortOrder/currentSortOrder/SetSortOrder(sortOrder)，Back SpriteRenderer 的原生排序为 980、颜色 alpha=1。这是排序解释的强证据，但没有原生 PlayMovie 函数体，不将字段映射标为已闭合。

本批取消错误 alpha 解释，生成器 schema16 将字段保留为 rawValue7；消费者兼容旧 opacity 字段，保留原值用于后续解码，视频本体 alpha 固定为1。过场仍使用独立 alpha 视频遮罩，不删除原生 blackout/whiteout。value6 的 logo 解释仍未闭合，315 标志仍未接入。

有原生舞台资料的曲目不再使用练习室和合成地板作为底图。这是通用透底保护；切歌/加载/关闭背屏不会重新露出练习室。没有原生舞台资料时保留原有预览底图。

## 开口对位

`scripts/fixtures/chibi-backmonitor-apertures.json` 保存两首 RAW TextAsset 原行及 bundle/CAB/pathId/SHA、原图 SHA 和透明开口测量。对 alpha<16 的内部连通区取边界，排除接触整张图边缘的外部透明区。

| 曲目 | 原图开口边界（1900×1060） | CSV XY/scale | 注册原点 |
| --- | --- | --- | --- |
| Change to Chance | 三星联合 [473,184,926,610] | -100,270 / 1800 | X=-150.5，Y=137 |
| ∞ Possibilities | [740,237,1160,447] | 0,430 / 860 | Y=242 |

Change 的旧视频中心在原图 (850,510)，上沿250.8，低于开口上沿184约66.8px；还存在150.5px横向中心差。现将原视频覆盖三星联合开口，仍由舞台不透明像素遮挡。Possibilities 原视频已有边界余量，本批修正8px中心偏移，不宣称此前每帧都有裸露缝隙。两首所有 Backmonitor 指令 XY/scale 均一致，原视频均272×144。

这是原图测量的二维注册，不是恢复 Unity 的完整相机/RectTransform 参数。保留 CSV 后续相对位移、比例和环境缩放；Take01/02原注册不变。其余舞台没有机械套用新偏移。

## 最新参考的光效分组

| 参考目标 | 应核对的形态 | 当前缺口 |
| --- | --- | --- |
| はんどめいど・きみはーと！ | 固定左右灯头发出的细扇形光 | RAW 样式1/6 尚未按原生控制完成；现有宽平行线不符合录屏 |
| いとをかし！〜一彩×合彩〜 | 紫色扫动光束 | 样式5尚未完成原生粒子投影核对 |
| Not Alone、ANYWHERE | 青色宽光带、台面椭圆光池 | 样式8/9不能用细激光代替，需核对光束与地面投影组合 |
| ∞ Possibilities、K.now O.nly | 固定发射点的粒子细扇光 | 样式3/4/7已接原生输入；不能把此验收推广成其他样式完成 |
| Change to Chance | 背屏、镂空、多层发光/装置 | 本批修背屏；58.85s样式4仍需该曲原片核对 |

## 验收与边界

Python 解析回归、22条实际RAW行fixture、Node零值/空值/旧索引/倒退/过场复算、两首及Take开口覆盖在桌面/窄屏/letterbox/环境缩放下通过。35条stage-intent回归通过。

npm run build:check：2785 modules，14.21s，通过；无 public 复制。5198既有preview服务映射该bundle和已有资源。Browser1280×720：Change暂停1000ms三星背屏可见；关闭背屏没有练习室，开启及23400ms换片有效；倒退1000ms恢复。390×844同一三星可见、页面宽度390无横溢出。Possibilities52000ms背屏框、台面落点及新阴影正常；Take01 111000ms原背屏/上方光束仍在，315标志仍缺。console无error。

证据：`.analysis/engineering-validation-20261002/chance-star-screen-1s.png`、`chance-star-screen-mobile.png`、`possibilities-screen-52s.png`。模拟视口不是实体设备；本批没有全曲逐帧、Unity排序函数体或完整灯光恢复验收。
