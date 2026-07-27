# 舞台小人 Spine 与歌曲编排开发记录（2026-07-14）

## 目标与当前结论

本模块用于独立预览《SideM GROWING STARS》的 LiveCharacter 舞台小人，并为后续桌宠、单曲舞蹈回放和多人舞台预览保留扩展空间。

当前已确认游戏资源不是“一套完整 Spine 文件对应一名角色”，而是三层组合：

1. 体型共用 setup skeleton：`livecharacter/setup/{1..5}/live_costume_setup_N.skel.bytes`。
2. 角色服装 atlas/texture：例如 `001tom_005_00/cos.atlas + cos.png`。
3. 独立 animation fragment：`live_costume_animation_{bodyType}_{motionId}.bytes`。

歌曲 CSV 是舞台时间轴和编排表，但动作并不只来自当前 60 个通用动作。正式歌曲同时引用大量歌曲专属 motion ID。

## 已实现范围

- 兼容性代表角色：天ヶ瀬 冬馬（body 1）、柏木 翼（body 2）、御手洗 翔太（body 3）、岡村 直央（body 4）、水嶋 咲（body 5）。
- 代表服装：五名角色均使用 `005_00`。
- 通用动作：60 个（ID 2–61）。
- 跨体型歌曲动作抽查：5 个（ID 4001、12001、16004、32005、56011）。
- 歌曲编排：118 份有效 CSV。
- 有效 `Livechara_motion` 事件：21,860 条。
- 歌曲引用的唯一动作：1,403 个。
- 其中通用动作：54 个；歌曲专属动作：1,349 个。
- body 1–5 资源覆盖：每种体型均为 1,403 / 1,403，无缺失引用。

五种体型的动态兼容矩阵已经跑通：300 次通用动作切换（5 × 60）和 25 次歌曲动作切换（5 × 5），共 325 次。随后确认五种体型都包含歌曲引用的全部 1,403 个动作，现已生成 7,015 个正式舞蹈文件（5 × 1,403）。山下次郎等 body 2–5 角色因此可以直接选择歌曲编排，不再只显示通用组。

静态服装盘点共找到 549 套：body 1 为 265 套、body 2 为 100 套、body 3 为 143 套、body 4 为 32 套、body 5 为 9 套。549 套均可映射体型，且没有缺少 `cos.atlas` 或 `cos.png`；这只是静态完整性检查，不代表 549 套都已经逐一在浏览器渲染。

随后已完成全量 Web 资源构建：manifest 现包含 49 名角色和全部 549 套服装，服装下拉框可以直接切换对应 `cos.atlas/cos.png`。额外生成 `inventory.json`，记录每套服装的角色、体型、atlas 页数、region 数和纹理字节数，供后续兼容报告与增量构建使用。

`npm run chibi:scan` 会读取五套 setup skeleton 的全部 attachment path，并与每套服装 atlas 的 region 集合比较。由于 setup 是同体型所有可选附件的并集，单套服装覆盖率约 37% 是正常现象；报告以同体型中位数识别异常，而不是要求每套服装覆盖全部可选附件。本轮 549 套全部落在各自体型的正常分布内，未发现 region 数量或覆盖率异常的离群服装。报告输出为 `compatibility-report.json`。

生成后的 Web 资源约 923 MiB（包含约 302 MiB 的歌曲音频），其中 7,340 个动作文件约 265.7 MiB，歌曲编排索引约 2.85 MiB。动作二进制按 motion ID 独立保存，浏览器按需加载，不会在页面启动时一次性下载全部动作。

## 数据生成

入口脚本：`scripts/prepare-live-chibi-assets.py`

运行：

```powershell
python scripts\prepare-live-chibi-assets.py
```

输出根目录：

```text
public/assets/live-chibi/
├─ manifest.json
├─ inventory.json
├─ compatibility-report.json
├─ setup/body-{1..5}.skel
├─ costumes/{idol}_{costume}/
├─ motions/common/{1..5}/{motionId}.motion
├─ motions/compatibility/{1..5}/{motionId}.motion
├─ motions/choreography/{1..5}/{motionId}.motion
└─ choreography/index.json
```

`choreography/index.json` 包含：

- `motionCatalog`：动作 ID、内部动画名、显示名、文件路径。
- `songs`：歌曲代码、标题、变体、时长、站位、动作集合和事件时间轴。
- 每条事件保存 `time`、`motion`、`speed`、原始演员槽位 `position`、左到右舞台编号 `stagePosition`、目标坐标、`pauseTime` 和播放模式。

歌曲标题优先由 `public/data/masterdata/music_catalog.json` 补全；无法匹配时保留资源代码。

## 浏览器运行时拼装

核心加载器：`src/utils/liveChibiSpine.js`

运行时流程：

1. 读取 body setup skeleton。
2. 读取所选服装 atlas/texture。
3. 组合 `body + head + cos_defo` skin。
4. 按 motion ID 请求 animation fragment。
5. 把 fragment 中的 animation 注入已有 `SkeletonData`。
6. 在同一个 Spine 实例上切换动作，不重新创建角色。

## 已修复问题

### 1. 头、眼睛和四肢在动作中消失

原因不是 PNG 缺图，也不是骨骼权重不足。animation fragment 使用 Spine binary 的 `readStringRef()`，引用的是 setup skeleton 中的共享字符串表。早期实现用空字符串表解析 fragment，导致 attachment 名称全部变成 `null`，动作执行时清空对应 slot。

修复方式：从 setup binary 提取字符串表，并在构造动作 `BinaryInput` 时复用。

### 2. 连续预览后手部等附件看似叠加

每次切换动作并没有新建小人。残影来自上一动作留下的 optional attachment 状态，以及快速切换时较早的异步请求可能晚于新选择完成。

修复方式：

- 播放新动作前执行 `skeleton.setToSetupPose()`。
- 清理旧 track 后再设置新动画，并立即 `update(0)`。
- 使用 motion sequence token 丢弃过时的异步加载结果。

### 3. body 2 缺少围巾等 linked mesh 时整个角色加载失败

部分服装 atlas 不包含 setup 骨架引用的父网格，例如 `muffler_R_B`。直接跳过缺失父附件会让后续 linked mesh 无法建立拓扑，从而中止整个 Spine 解析。

修复方式：为缺失的 region/mesh 建立使用透明空纹理的占位 attachment，保留父子引用和网格拓扑，但不渲染错误内容。这样既不会出现早期测试中见到的绿色纹理块，也不会因单个可选附件缺失而丢失整个人物。

### 4. 不同 body type 的默认视觉身高不一致

原自动适配只参考 setup skeleton 的声明宽高。待机姿势的实际 attachment bounds 与声明高度不同，导致 body 2、3、4 分别显示为冬马的约 114%、126%、119%。第一次修正又把五套骨架直接校准成等高，忽略了同一 body type 内角色官方身高不同；因此 163 cm 的翔太和 165 cm 的丽仍然与 175 cm 的冬马几乎一样高。

最终方案分两步：先使用画布实际非透明像素消除五套 setup 骨架的固有倍率差，再读取 `idol_unit_dictionary.json` 的官方身高，以冬马 175 cm 为基准为 49 名角色分别生成 `previewScale`。例如翔太为约 `0.2958`、丽为约 `0.2995`、翼为约 `0.3019`、直央为约 `0.3034`；咲继续以 `0.28` 为安全上限，避免头发和举手动作裁切。透明占位 attachment 只用于保持 linked mesh 拓扑，不再参与可见尺寸校准。

### 5. 特殊服装的裙身或躯干缺失

复现样本为水嶋 咲 `031sak_102_00/01` 和冬美 旬 `021jun_103_00/01`。这些 atlas 文件都完整包含 4 个 `dress` skin region，但早期运行时只组合 `body + head + cos_defo`，导致服装主体仍留在未启用的 `dress` skin 中。相同结构还存在于 `skirt`、`kimono`、`poncho_big`、`animal` 和角色专用 skin。

修复方式不是为两个服装写死映射，而是在 skeleton 解析完成后检查每个可选 skin：只要其中至少一个 attachment 对应 atlas 的真实 region（不是透明缺图占位），就把该 skin 加入当前 costume skin。咲 102 和冬美旬 103 现在都会自动组合 `body + head + cos_defo + dress`，待机与 `future` 动作实测主体保持完整。

兼容扫描报告 schema 2 同时记录每套服装的 `skinMatches`、setup attachment 缺失但存在同 slot 候选的 `recoverableSlots`，用于继续排查其余服装。当前 549 套中检测到的专属 skin 覆盖包括：`dress` 207 套、`skirt` 159 套、`kimono` 27 套，以及少量角色/造型专属 skin。

## 原始 Unity3D prefab 与缩放结论

以 `costume_035mco_107_00.unity3d` 为主样本，并用五种体型的 `005_00` costume 包交叉确认：

- 每个 costume 包在资源层面确实同时包含成人 Spine 和舞台小人 Spine。
- 成人部分是 `comu.skel + comu.atlas + comu` 纹理，并带有包内唯一的 `GameObject / RectTransform / SkeletonGraphic`。
- 该 `SkeletonGraphic.skeletonDataAsset` 明确指向 `comu_SkeletonData`，因此包内 RectTransform 的位置、尺寸和 pivot 都属于成人交流立绘，不属于舞台小人。
- 小人部分是 `cos.atlas + cos` 纹理及 `live_costume_atlas_*`；costume 包内没有第二个指向小人的 GameObject/RectTransform prefab。
- 小人的公共骨架在 `live_costume_setup_1..5.unity3d`。五套 `SkeletonDataAsset.scale` 全部是 `0.003333332948386669`，即约 `1 / 300`。
- `live_character_info_data_list.unity3d` 只提供角色 ID 到 body type 的映射，没有角色显示倍率。

因此要区分两层缩放：`1 / 300` 是 Spine 数据导入倍率；实验室里的缩放滑杆和自动 fit 是浏览器视窗/未来桌宠窗口的显示倍率。costume 包中的成人 RectTransform 不能作为小人的放大缩小依据。舞台上的最终大小、站位和移动更可能由运行时角色控制器、舞台相机及歌曲 CSV 坐标共同决定，而不是存在于这个 costume prefab 中。

## 歌曲编排预览

界面：`src/components/SpineViewer.vue`

动作库现在包含两类来源：

- `通用动作`：原有 60 个独立动作。
- `歌曲 · 标题`：按单曲/变体列出该编排实际使用的动作。

歌曲模式支持：

- 选择歌曲或编排变体。
- 选择从左到右的舞台站位；三人曲为 2/3/4，solo 为 3，动作事件仍保留原始演员槽位供追溯。
- 查看单曲动作集合。
- 拖动时间轴预览指定时间之前的当前动作。
- 按 CSV 时间戳、速度倍率自动播放动作编排。

目前只回放角色 motion；CSV 中的角色移动坐标、镜头、灯光、舞台特效、音乐同步和多角色同屏尚未接入。

## 动作衔接复核（2026-07-14）

根据存档视频中连续舞蹈的表现，重新核对了 119 份 live effect CSV、Spine 动作片段和 IPA 的 IL2CPP metadata。结论是：没有发现另一套“整首歌连续动画”，但当前 Web 播放器确实只实现了原播放协议的一部分。

原客户端的关键入口可从 metadata 恢复为：

```text
LiveObjectIdol.PlayMotion(time, data, skip)
LiveObjectIdol.PlayMotionInner(motionId, isLoop, actualPos, speed, pauseTime, skip)
```

这说明一次动作事件不只是 motion ID 和速度，还包含循环状态、实际舞台位置、暂停随机动作的时间以及跳播状态。当前生成器把 CSV 第 9、10 个值临时命名为 `hold`、`mode`，但这两个名字并非原字段名；第 9 个值现已可确认与 `pauseTime` 对应，常见的 `999999` 表示长时间压住随机动作回退，而不是单个舞步自身的时长。第 10 个值为 1/2/3 的播放模式：3 几乎只出现在开场初始化，2 是正常编舞切换，1 只用于少数特殊持续段。它如何映射到 `isLoop` 仍需在播放器复刻阶段保留为原始枚举，不应继续当成普通布尔值猜测。

动作 fragment 通常包含一对动画：

- `_3dance`：进入/舞步段。
- `_4loop`：目标姿势的循环段。

以 ANYWHERE 开头为例，`32005` 在歌曲时间 1600 ms 开始，`32006` 在 1800 ms 开始；前者的 `_3dance` 总长为 0.6 秒，却会在 0.2 秒处被下一事件接管。直接解析骨骼姿态后确认，`32005 @ 0.2s` 与 `32006 @ 0s` 的骨骼差仅约 `0.000002 RMS`，说明 CSV 时间戳和动作片段是共同制作的衔接锚点，而不是简单等待每段播完。其他切换点存在非零姿态差，需要上一条 TrackEntry 参与混合。

当前 `playLiveChibiMotion()` 在每次事件前调用 `state.clearTracks()`，随后才 `setAnimation()`。这会删除上一条 TrackEntry，因此即使 `defaultMix` 已设为 0.16 秒，也无法发生跨动作混合。`setToSetupPose()` 主要为清理附件残留而加入；骨骼衔接应改为保留旧 track，通过槽位/附件的定向恢复解决叠加，不能再把清 track 当成附件修复的一部分。

本轮还确认当前编排索引遗漏了以下角色事件：

- `Livechara_position`：1,178 条；包含站位、X/Y 和显示倍率/深度参数，例如 ANYWHERE 的 1700、1730、1850 变化。
- `Livechara_motion_group`：545 条；原客户端对应 `AddMotion(motionGroupId, motionId, weight)`，定义带权随机动作组。
- `Livechara_motion_group_change`：90 条；切换当前随机动作组。
- `SwitchSinger`：2,868 条；决定多角色编排中当前演唱/表现对象。
- `Livechara_Offset`、嘴型修正和角色颜色等少量角色控制事件。

随机动作组不是正式舞步的另一套完整编排，但会填充脚本动作之间的空闲期；多角色舞台、位置/缩放和完整复刻不能忽略这些事件。

新增只读诊断工具 `scripts/inspect-live-chibi-motion.mjs`，可列出动作内部动画名、时长和 timeline 类型，也可比较两个动作在指定切换时刻的骨骼姿态：

```powershell
node scripts\inspect-live-chibi-motion.mjs 1 32005 32006
node scripts\inspect-live-chibi-motion.mjs 1 --transition 32005 0.2 32006
```

### DRIVE A LIVE 基准实现与验证

标准 `drvalv_live_effect.csv` 已选作第一首连续动作基准：

- 225 条 `Livechara_motion` 可严格组成 45 个时间点 × 5 个站位。
- 每个时间点的五个站位在 motion ID、speed、pauseTime 和 mode 上完全一致，没有站位专属舞步。
- 角色差异来自 16 条 `SwitchSinger`。每条事件的 5 个开关分别对应 1–5 号位，例如 0 ms 为 3 号位、6535 ms 为 2/5 号位、10392 ms 为 1/4 号位、15964 ms 为全员。
- `Livechara_position` 只有开场 5 条定义，五人倍率均为 1700，X/Y 不同。

编排索引先升级为 schema 2，动作事件中的临时 `hold` 字段改为原语义 `pauseTime`，并为每首歌保留 `singerEvents`、`positionEvents`、`motionGroupEvents` 和 `motionGroupChanges`；接入口型后进一步升级为 schema 3。全库统计为 21,860 条动作、2,868 条演唱者切换和 1,178 条位置事件。

连续播放不再在每次歌曲动作前 `clearTracks()`：模式 3、主动跳播和手动重播才执行完整 setup reset；正常模式 2/1 切换只恢复 slot，并保留上一条 TrackEntry，以 0.12 秒混合骨骼。旧 TrackEntry 的 attachment/draw-order threshold 设为 0，避免手、脸和服装附件在混合期间重新叠加。进入段结束后按其完整 duration 排入 `_4loop`，不再使用 `delay=0` 导致循环段提前一个 mix duration。

预览界面现在显示当前演唱站位，以及所选站位处于“正在演唱”还是“伴舞中”。`SwitchSinger` 与 `adxlip_for_live` 的官方逐帧曲线已经组合：前者选择启用口型的站位，后者给出实际开合幅度，不使用伪造的固定开合。

浏览器验证路径为：选择 `DRIVE A LIVE` → 站位 2 → 跳到 7000 ms，界面正确显示 2/5 号位演唱；随后从 7000 ms 以 2× 播放越过 10300/10392 ms，动作从 #26 切换到 #8，演唱者变为 1/4 号位。运行时诊断记录 `reset: false`、`mixDuration: 0.12`，且没有控制台 error。

## 全人物构建状态

五种 body type 的动画索引语义已经确认一致，49 名角色、549 套服装和五体型正式舞蹈资源均已进入全量构建。后续无需再以 body 1 作为歌曲预览限制；仍需抽查的是特殊服装附件、运动中的视觉裁切和多人同屏布局。

## 推荐后续顺序

1. 抽查不同歌曲、不同站位以及歌曲专属动作的附件完整性。
2. 根据 `inventory.json` 对 549 套服装做 atlas/skin 批量兼容性扫描并标注异常组合。
3. 抽查 body type 2–5 的歌曲动作附件和裁切；完整 motion catalog 已生成。
4. 对异常服装做浏览器定点复测。
5. 最后接入音乐文件、CSV 坐标移动、多角色同屏和完整舞台时间轴。

## 舞台站位、全体型歌曲动作与 IDM 兼容（2026-07-15）

CSV 的 `Livechara_motion.position` 是本曲内部的演员槽位，不是画面中从左到右的五个舞台位置。原始数据给出了两条可交叉验证的线索：`Livechara_position` 提供每个演员槽位的 X 坐标，`SwitchSinger` 使用舞台演唱位置。例如三人曲的动作槽位为 1/2/3，但演唱开关为 2/3/4；初始 X 坐标又显示槽位 2 在左、槽位 1 居中、槽位 3 在右。

生成器现在按初始 X 坐标从左到右排序演员槽位，再映射到该人数的舞台位置，并同时保留两套编号：

- `performerSlots`：CSV 动作轨道原始槽位。
- `positions`：界面使用的舞台站位；三人曲为 2/3/4，solo 为 3。
- `stagePositionMap`：演员槽位到舞台站位的映射。
- `events[].position`：原始槽位；`events[].stagePosition`：用于单人预览筛选的舞台位置。

以标准五人初始布局为例，原始槽位顺序是“中、左内、右内、左外、右外”，并非 1 到 5 从左到右。按 X 重排后映射为：槽位 4→舞台 1、槽位 2→舞台 2、槽位 1→舞台 3、槽位 3→舞台 4、槽位 5→舞台 5。`SwitchSinger` 本来就是舞台编号，因此口型判定继续直接使用舞台位置。

歌曲动作导出由单一 body 1 改为 body 1–5。原始目录检查确认五种体型各有 1,427 个 animation fragment，歌曲所需的 1,403 个在每种体型中均无缺失。编排索引升级为 schema 4，并用 `bodyTypes: [1,2,3,4,5]` 声明兼容范围。

动作公开文件扩展名由 `.bin` 改为自定义 `.motion`。文件内容仍是原 Spine 二进制 fragment，运行时解析方式不变；改名只为避免 IDM 按通用 bin 下载规则拦截浏览器 `fetch`，导致第一次点击只触发下载、第二次点击才播放。5173 实测可直接以 HTTP 200 读取 body-2 的 `.motion`，诊断工具也成功解析山下次郎体型的 #4001 和 #12001。

## 验证命令

```powershell
python scripts\prepare-live-chibi-assets.py
npm run chibi:scan
npm run smoke
```

## DRIVE A LIVE 官方口型曲线（2026-07-14）

逐音节嘴型并不在舞蹈 CSV 中，而在 `scripts/lipsyncdata/adxlip_for_live/<songCode>/<songCode>_for_lipsync.json`。`drvalv_for_lipsync.json` 含 7,817 个 `scales` 采样点；按原播放器采用的 60 Hz 解释，对应约 130.28 秒。有效开合量是 `scales[].y`，DRIVE A LIVE 的范围为 0 到约 0.9002。`scales[].x` 没有作为当前单轴嘴骨的输入；这与正比人物 Spine 的 `sampleLipCurve()` 和 `LipSyncController` 用法一致。

全量构建现在会扫描 60 条官方曲线并导出紧凑的 `lipsync/<songCode>.json`。编排索引升级为 schema 3，每首可匹配歌曲附带 `lipSync.file / sampleRate / frames / duration / source`。118 个编排脚本中有 117 个可命中曲线，共覆盖 59 个实际歌曲代码；`drv999` 没有对应曲线，源目录额外存在未被当前编排引用的 `reason`。导出曲线总大小约 6.8 MiB。

小人 setup pose 的 `mouth` 槽默认附件是 `mouth_open`，这正是此前静止时一直张嘴的原因。五套小人骨架采用同一类简化 rig：一个 `mouth` 槽、一个 `mouth` 骨，以及 `mouth_close / mouth_open`（含 `_fl` 镜像）附件。运行时按正比 Spine 的原则处理：

- 未演唱或曲线低于阈值时使用 `mouth_close`；
- `SwitchSinger` 只决定所选站位是否启用曲线；
- 演唱站位按歌曲时间以 60 Hz 线性插值 `y`，切到 `mouth_open` 并只缩放 `mouth` 骨。小人 `mouth_open` 已是完整张嘴贴图，不能照搬正比 Spine 的 3 倍上限；最终采用小人专用映射 `0.4 + y × (1.4 - 0.4)`；
- 镜像动作继续使用同后缀的 `_fl` 嘴部附件，不把头部或其他附件纳入口型缩放。

浏览器定点验证：DRIVE A LIVE 4 秒、3 号位为当前演唱者时，曲线值为 0.226、最终倍率约为 0.626，附件为 `mouth_open`；同一时刻切到伴舞的 2 号位，值归零且附件为 `mouth_close`。从 6.2 秒播放跨过 6,535 ms 的 `SwitchSinger` 后，2/5 号位开始演唱，2 号位曲线值约 0.585、最终倍率约 0.985。页面同时显示曲线帧数、当前值、最终倍率和附件，便于后续和录像逐帧比对。

## ACB 歌曲提取与音频主时钟（2026-07-14）

> 2026-07-27 更新：下述旧路径是最初实现时使用的整理者副本。当前权威输入
> 已改为本机来源配置所指向的 `RAW/audio`；转换工具也从忽略的本机配置读取。
> 旧副本仅保留作回归证据，不再是默认 source identity。

`song3_<songCode>.acb` 是内嵌 `@UTF + AFS2` 的 CRI 音频包，实际音频编码为 HCA。构建使用配置的 `vgmstream-cli` 解码，再由 FFmpeg 转为浏览器可播放的 AAC/M4A：

```powershell
python scripts\prepare-live-chibi-audio.py --song-code drvalv --force
npm run chibi:audio
```

`scripts/prepare-live-chibi-audio.py` 会读取编排索引、检查每个 ACB 的子流清单、匹配编排变体、通过管道解码并写入 `public/assets/live-chibi/music`，最后生成 `music/index.json`。无后缀编排选择带有根 cue 的标准子流；例如 DRIVE A LIVE 的第 17 子流同时具有 `song3_drvalv / preview / soundcheck` 别名。`01jup` 等变体精确映射到 `001jup` 等组合子流；`solo / solo_multi / solo_single / tutorial` 没有独立组合混音时回退到标准子流。

全量结果：

- 60 个编排歌曲代码全部命中 `song3_<songCode>.acb`；
- 118 个编排脚本全部建立音频映射；
- 生成 108 个不同的 M4A，总大小 316,497,240 bytes；
- FFprobe 全量确认 108 个文件均为有效 AAC，缺失、损坏和索引时长漂移均为 0；
- 10 个特殊 solo/tutorial 编排复用同曲标准音频；
- DRIVE A LIVE 音频为 44.1 kHz 双声道、130.285 秒，官方口型曲线约 130.283 秒，差值约 2 ms。

DRIVE A LIVE 还包含 `song3_drvalv_bgm.acb` 伴奏和 49 条 `song3_drvalv_<idol>.acb` 单声道人声分轨，三者长度完全一致。这为后续五人舞台按所选角色实时混合“伴奏 + 角色声轨”提供了原始依据；当前单人预览先使用对应编排的官方组合混音。

预览器加载 `music/index.json` 后，以 `HTMLAudioElement.currentTime` 作为歌曲编排、`SwitchSinger` 和口型的主时钟。开始播放前会预载该曲使用的全部 Spine 动作，避免首次请求造成动作迟到；拖动时间轴时，当前动作会推进到事件内部偏移，而不是从该动作的第 0 帧重新开始。浏览器抽查确认 DRIVE A LIVE `01jup` 命中 `music/drvalv_001jup.m4a`，拖到 7 秒时 #26 动作内偏移为 668 ms；ANYWHERE 命中 `music/anwhre.m4a` 并采用音频的 2:01 总时长。

`smoke` 当前执行一次完整 Vite 生产构建，与 `npm run build` 等价。

## 多人角色舞台 MVP（2026-07-15）

新增独立路由 `?view=chibi_stage` 和组件 `src/components/ChibiStageViewer.vue`。该页面不是把单人预览截图复制五份，而是在同一个 Pixi 舞台中创建最多五个相互独立的 Spine 运行时：每个站位持有自己的 body setup、服装 skin、动作缓存、TrackEntry 和口型控制器，所有实例共享歌曲音频主时钟。

首版功能包括：

- 根据编排的 `positions` 自动启用 1–5 个舞台站位；五人使用 1–5，三人使用 2/3/4，solo 只启用 3。
- 每个站位独立选择 49 名角色和该角色的全部服装，换人时只重建对应站位。
- 播放前按当前角色 body type 预载本曲所需 motion fragment；同一运行时再次播放已载入歌曲时复用缓存。
- 每个站位只消费与其 `stagePosition` 匹配的动作事件，按 CSV 的 speed、mode 和切换时间独立播放。
- `Livechara_position` 与动作事件中的 X/Y、scale 共同驱动位置、大小、显隐和前后层级；窄窗口额外按舞台高度缩小模型，避免多人头部或四肢越界。
- `SwitchSinger` 对所有实例逐站判断，只有当前演唱站位使用官方 60 Hz 口型曲线。
- 歌曲、动作、口型和时间轴滑杆共用同一 `HTMLAudioElement.currentTime`；无音频时回退到 `requestAnimationFrame` 时钟。
- 首页与单人实验室均可进入多人舞台，单人/多人页面可以互相切换。

页面回归覆盖：

- DRIVE A LIVE：1–5 号位五个运行时全部就绪，默认 3 号位演唱。
- BRAND NEW FIELD：切歌后活动实例严格收敛为 2/3/4，播放后三个站位同步从通用等待动作进入歌曲专属 #4001/#4004，时间轴与音频按约 1× 推进。
- DRIVE A LIVE（パッションMAX Ver.）：只保留 3 号位，其余四个编队控件进入休息状态。
- solo 3 号位换为山下次郎 `037jir` 后，body-2 运行时可重新组合并保持 ready。

当前仍属于“多人角色层”而非完整 Live 舞美复刻。尚未接入 `Camera`、灯光、Backmonitor、Object_layer、Penlight 和 Unity 歌曲特效包；这些数据应在多人动作与位置基线稳定后逐层加入。

## 位置插值与随机动作组（2026-07-15）

`Livechara_position` 只有时间、演员槽位、X、Y 和 scale，没有持续时间或缓动类型。不能把相邻关键帧之间的整段间隔直接线性插值，否则相隔数十秒的倍率事件会变成持续慢推镜头。当前实现将事件时间解释为变换开始点，在 350 ms 内用 smoothstep 从上一状态过渡到新状态；初始负时间关键帧在歌曲 0 ms 前已经完成。X/Y、scale、显隐和层级都消费同一插值状态。

`Livechara_motion_group` / `Livechara_motion_group_change` 已确认是带权重的动作回退池，不是另一套正式舞蹈编排。运行时只在以下条件同时成立时推导补位事件：

- 当前正式动作的 `pauseTime` 大于 0 且小于 999999；
- `event.time + pauseTime` 早于下一条正式动作；
- 该时刻已经切入某个 motion group，且组内存在有效正权重动作。

选择结果用歌曲、站位、触发时间和组号生成确定性哈希，再按原权重取样；因此播放、暂停、拖动时间轴后会得到相同动作。生成器把动作组成员加入歌曲 `motionIds` 和全局 motion catalog，保证播放前与正式舞蹈动作一同预载。全库 118 份脚本最终推导出 103 个补位事件，集中在 21 份 DRIVE A LIVE 标准/路线编排中；没有满足条件的歌曲保持 0 个补位事件。

浏览器定点验证：

- ANYWHERE 的 3 号位在 5600 ms 为 scale 1700、进度 0；5700 ms 为 1705.95、进度 0.286；6000 ms 到达 scale 1730、进度 1。
- DRIVE A LIVE 在 32200 ms 正式动作加 5000 ms pause 后，于 37200 ms 进入动作组，37300 ms 跳播时五个站位均显示 `source=group`，确定性取样分别为 #36、#33、#8、#33、#10；37600 ms 下一条正式动作会重新接管。
- 三人 BRAND NEW FIELD 仍严格启用并加载 2/3/4，solo `drv999_live_effect` 仍只启用并加载 3。
- `npm run smoke` 通过，Vite 6.4.3 共转换 2352 个模块。

## CSV 镜头轨道与 Unity 绕过边界（2026-07-15）

多人舞台的 Camera 层可以绕过 Unity 运行时直接复刻。118 份 `liveeffectscript` 共包含 8,145 条有效 `Camera` 指令，CSV 自带字段说明：`zoom / zoom_speed / chara / pos_x / pos_y / pos_speed / rotate / rotate_speed`。zoom 使用千分率，三个 speed 字段实际是各自属性的毫秒补间时长；`chara` 使用歌曲内部演员槽位，0 表示自由坐标镜头。

编排索引升级为 schema 5，每首歌新增 `cameraEvents`。运行时把所有角色挂到独立 Pixi camera container，并按歌曲时间重建缩放、平移和旋转三个可被新事件分别打断的 tween。补间采用与现有剧情 `CameraController` 一致的 ease-out cubic。自由镜头以 1280×720、Y=360 为视觉中心；角色聚焦先通过 `stagePositionMap` 把演员槽位映射为舞台站位，再读取该角色在事件时刻的动作/位置 X。源脚本在角色聚焦模式使用另一套根坐标，Y=0 与自由镜头 Y=360 都表达视觉中心，因此网页聚焦模式固定使用视觉中心 Y，避免错误把人物推到画面底部。

浏览器定点验证：

- DRIVE A LIVE：0 ms 为 1.00×；3300 ms 为 1.30×、Y=280；3400 ms 开始 3400 ms 补间，5100 ms 为 1.125×、Y=428.75；6800 ms 被下一条事件接管为 1.20×、X=160、Y=380、旋转 -5°。
- BRAND NEW FIELD：开场 `focusSlot=1` 映射舞台 3；41000 ms 的槽位 2 映射舞台 2、X=-350；41700 ms 的槽位 3 映射舞台 4、X=350；42200 ms 回到舞台 3、X=0。
- “启用 CSV 角色镜头”可切换为无变换构图，便于对比和排错。

绕过 Unity 的边界按数据来源分三层：

1. 可仅凭 CSV 与已提取纹理直接实现：Camera、Livechara position/motion/color、SwitchSinger、全屏颜色、Image/Object layer 时序、Penlight 以及基础二维 Spotlight/Searchlight。
2. 需要离线读取 Unity 资源但不需要运行 Unity：Backmonitor 贴图或序列、Prefab 中的布局参数、简单 ParticleSystem 曲线、材质颜色和混合模式。可由 UnityPy/AssetRipper 提取后在 Pixi 重建。
3. 不能承诺一比一直接复刻：依赖 Unity 专用 Shader、Mesh、复杂 ParticleSystem 子发射器、VFX Graph 或运行时代码行为的烟雾、镜头光斑和组合特效。遇到此类必须标明“网页近似”或保留缺失状态，不能只凭效果名猜造。

因此后续优先接入纯数据层的 Backmonitor/Image/Object 与基础灯光；粒子效果单独审计 Prefab、Material 和 Shader 后再决定是否复刻。

## Backmonitor USM 解密与舞台屏幕（2026-07-15）

`RAW/movie` 是 3DMV、SSR 演出、公告和 Live 屏幕等内容混合存放的 USM 库，不能按目录整体当作舞台素材导出。当前生成器只读取 119 份 `liveeffectscript` CSV 的 `Backmonitor` 命令，并以实际引用 ID 作为白名单：共 932 条事件、73 个主视频和 4 个 alpha 转场，无缺失引用。

这些 USM 的 CRI 解密 key 为 `0002B875BC731A85`。部分主视频可以被 FFmpeg 直接识别，另一些虽然能读到容器头但没有有效帧，因此批处理统一采用 WannaCRI 0.3.1 解密和 demux，再由 FFmpeg 转为 H.264/yuv420p MP4，避免按文件碰运气。运行方式：

```powershell
python -m pip install --target .analysis\workspace\wannacri-runtime WannaCRI==0.3.1
npm run chibi:backmonitor
```

> 2026-07-27 更新：生成器的物理输入已改为统一配置中的 `RAW/movie`，
> CSV 从配置的 `legacy_root` 派生，WannaCRI 根目录通过忽略的
> `wannacri_root` 配置。WannaCRI 0.3.1 没有 `__main__.py`，生成器现调用
> 包声明的 `wannacri:main`，不再使用无效的 `python -m wannacri`。

脚本 `scripts/prepare-live-chibi-backmonitor.py` 输出 `public/assets/live-chibi/backmonitor/index.json`、73 个主循环 MP4，以及 4 个转场各自的 color/alpha 双路 MP4。全量验证结果为 81 个 MP4、零空文件；主视频均为 272×144，时长约 0.968–10.010 秒，总大小约 11.3 MB。转码先写临时文件并经 FFprobe 验证后原子替换，构建被中止时不会把半截 MP4 当作缓存复用。

编排索引升级为 schema 6，每首歌新增 `backmonitorEvents`，保留 `time / movie / transition / x / y / scale / rotation / opacity`。多人舞台用一个位于角色后方、处于同一 camera container 内的 Pixi Video Sprite 消费这些事件：切歌和拖动时间轴会切换并定位循环视频，播放、暂停和倍速沿用歌曲主时钟；CSV 的坐标采用 1280×720 舞台空间，Y 轴从下向上，纹理以原始 2 倍显示尺寸再乘千分比 scale。

浏览器定点验证：DRIVE A LIVE 在 -2000 ms 显示 `unique_black`，2500 ms 切换 `ballade_01` 并记录 `alpha_blackout`，15700 ms 切换 `cool_01_2` 并记录 `alpha_star`；三个时刻视频均加载成功，层级位于五名 Spine 角色后方。转场不是前后两块屏幕互相淡入淡出，而是 color 视频作为覆盖画面、alpha 视频红通道作为逐帧遮罩；运行时已用 Pixi Filter 实现双视频采样，并把两路与歌曲时钟的偏差控制在 60 ms 内。主视频在事件时刻立即切换，覆盖层在约 2 秒素材结束后自动隐藏和暂停。VideoResource 禁用隐式自动播放，切歌或销毁时不会残留后台媒体请求。

## Image_layer 纹理与前后景层（2026-07-15）

118 份 `liveeffectscript` 中共有 101 条 `Image_layer / Image_layer_2` 事件，精确引用 57 个 Sprite。引用素材并不在统一贴图包中，而是分别位于 `RAW/asset/song_<songCode>.unity3d`；每个 bundle 均存在与 CSV ID 同名的 Sprite，且指向一张 1900×1060、带完整透明边距的 RGBA Texture2D。旧的 `ALL_PHOTOS` 导出有的保留整张 Texture2D、有的只保留 Sprite 裁剪区域，不能稳定恢复舞台坐标，因此新脚本直接读取 Sprite 关联 Texture2D。

```powershell
npm run chibi:image-layers
```

`scripts/prepare-live-chibi-image-layers.py` 输出 `public/assets/live-chibi/image-layers/index.json` 和 57 张 PNG，总大小 29,181,796 bytes；全量检查为 57/57 bundle、57/57 Sprite、零缺失、零透明空图。导出使用 bundle mtime 缓存、临时 PNG 与原子替换，索引记录尺寸、alpha 范围、bundle、Sprite rect 和 texture rect offset。

编排索引升级为 schema 7，并为每首歌写入 `imageLayerEvents`，保留 `time / asset / layerType / depth / hide / raw19`。列 17/18 的 `1` 已由多首歌曲的显隐时序交叉确认是隐藏指令；列 3 作为 Pixi `zIndex`，允许图片层直接与角色交错，而不是强制全部放在角色前或后。运行时按当前歌曲时间重放事件得到每个 asset 的显隐和最新深度，将完整 1900×1060 画布居中并按 `2/3 × viewportScale` 映射到 1280×720 舞台。异步加载按 asset 合并；切歌会使旧请求失效并释放 Sprite、Texture 和 GPU 资源。

浏览器回归验证：

- FLASH LIGHT 开场同时显示 `stage_flslgt_01..04`，深度分别为 1550、1575、1600、1725，四层共同还原墙面、地板、帷幕和前景灯。
- OUR SONG 开场 6 层；`stage_ossshd_05` 在 16.8 秒由 1760 切到 1860，53.2 秒进一步切到 1930，其他层也按 CSV 更新深度。
- `tibeti_live_effect` 的 `stage_tibeti_effect01` 在 78.3 秒隐藏、85.1 秒恢复、88.6 秒再次隐藏。
- 从 FLASH LIGHT 切回 DRIVE A LIVE 后图片层计数立即归零；干净刷新后的切歌回归中没有新增 Backmonitor/Image_layer 加载错误或媒体 AbortError。
