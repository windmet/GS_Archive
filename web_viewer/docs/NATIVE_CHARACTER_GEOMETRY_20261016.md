# 人物原生尺度与地面坐标

输入 `stage/20261014-native-fidelity` / `adfcda7c`；沿用5212/PID61564。接续 [遗留假设审计](STAGE_ASSUMPTION_AUDIT_20261015.md)，移除人物显示尺寸的经验参数。本批不修改动作时钟、灯光或共享媒体库。

## 从实际绑定追到显示尺度

本地APK的 `resources.assets` MonoBehaviour114160 为LiveStage。按序列化字段读取 `_base` → GameObject10178，以及 `_liveObjectIdols` 六项 → 134600、109012、111434、135618、133703、109124，而不是仅按同名GameObject挑选模板。

- 六个LiveObjectIdol的Transform均直接挂在Base下，XY scale均为 `0.7149999737739563`，rotation为单位四元数；Base的XY position=0、scale=1。
- 五种RAW `live_costume_setup_{1..5}.unity3d` 的SkeletonDataAsset.scale均为 `0.003333332948386669`。重新校验五个bundle和asset的hash，与既有skeleton-units fixture一致。
- `LiveObjectIdol.<LoadFigure>.MoveNext` `0x1bbe610` 将自身Transform传入LiveIdolFactory；`LiveIdolFactory.<GenerateSkeletonAnimation>.MoveNext` `0x1bb88e0` 创建骨架、SetParent后调用TransformExtensions.Identify，归一化的是新建骨架子节点。人物root仍保留上述序列化缩放。
- `LiveIdolFactory.<PrepareAsset>.MoveNext` `0x1bb9780` 将源SkeletonDataAsset.scale传入CreateRuntimeInstance；没有在这一生成链使用官方身高去二次归一化人物。
- `LiveStage.<Prepare>.MoveNext`设置LiveStage自身stageScale；原生1280×720设计面stageScale约1000/720、camera orthoSize=5。因此 `720/(2*5) * (1000/720) = 100` camera pixels / Unity unit。Web继续用既有1280×720设计面加letterbox fit，不把它宣称为所有原机宽高比下的Screen行为。

Pixi SkeletonBinary维持scale=1，显示端只需一次换算：

```
scale = SkeletonDataAsset.scale * LiveObjectIdol.rootScale * 100
        * min(canvasWidth/1280, canvasHeight/720)
```

原生设计面约为 `.238333297`，五种body都由自身骨骼与attachment表达形体差异。删除按可见像素测量的五种BODY_PREVIEW_BASE_SCALES、body5上限、身高/175的尺寸倍率、Viewer的`.58`与`height/620`；身高继续作为目录描述字段。

`chibiNativeCharacterGeometry.json`只包含小型绑定参数；完整六槽位Transform/source hash与五种body绑定保存在 `scripts/fixtures/chibi-native-character-geometry.json`。`verify-live-chibi-character-geometry.py --write` 可从本地APK/RAW再生成并验证；没有复制媒体。

消费者不再依赖旧公开索引中的previewScale。未来人物导出器也使用同一原生参数计算该兼容字段，本批未重导549套服装或改写共享public/assets。旧索引字段仍可存在，但不能再影响当前人物显示尺寸。

## 地面公式核实后的校正

上一轮审计正确指出地面代码起源于画面标定，但其当前数值并非一个额外的偏移错误：

```
height/2 + (540-360)*fit + (180-scriptY)*fit
= height/2 + (360-scriptY)*fit
```

`LiveObjectIdol.SetPosition` `0x221bea0`调用公共 `ScriptPosToStagePos` `0x2218894`，原点是(0,360,0)。本批按该原生语义正名，诊断ID为 `native-character-plane-v1`，保留所有地面位置，不再把人往前后移动。此前三个Study平台测量点仍作为独立视觉回归证据。

## 验证

- `verify-live-chibi-character-geometry.py`：重读APK中的六个真实绑定、root/Base层级、原始Transform与hash，以及五个RAW骨架尺度，生成参数一致。
- `verify-chibi-native-character-geometry.mjs`：五种body×六槽位×五视口的150组独立Unity→root→stage→camera矩阵；地面公式、影子单位、实际SFC大画布尺寸不封顶、未知body拒绝回退。
- `verify-chibi-stage-coordinates.mjs --published-assets`：118份编排、1,178条站位及Study三个独立平台点通过；地面位置与旧版完全一致。
- `verify-chibi-placement-shadows.mjs`：实际SFC排序不改变尺寸、spotlight排序、影子骨骼跟随、回拖/offstage通过。
- `npm run verify:source-batch`：143/143通过；`npm run build:check`：13.76s通过，仅固定 `.analysis/build-check`、copyPublicDir:false，有既有大chunk提示。构建生成的无关审计/翻译元数据恢复到输入HEAD。
- Python三个改动文件py_compile通过。没有执行完整资源包构建、部署或原机逐帧验收。

5212使用 `rm-native-relations-20261013`、release `1443ba17bda823fab56fdf04bea0aa527c4a0d0fe19486c202520e00c00636c5`。Browser检查1440×900和390×844的Study默认三人及原曲S.E.M编队、5s平台/人物/影子；手机尺寸document.scrollWidth=390，无横向溢出。Study从5s实际播放，读到82s仍在播放，90.7s暂停、回到开头归0；再切JF到4s，五人ready=true，旧静态背景归属为空。冷加载标签页控制台无应用error、保留两条既有Spine tint/update warning栈。临时viewport在验收结束时恢复。截图和console JSON保存在当前任务visualizations目录的 `native-character-*`。

构建和恢复生成元数据时曾触发App HMR及一条ReadModel Client disposed错误；最终用新标签页冷加载重新验收，不能将热更新期间状态混成稳定冷加载结果。Browser工具自身另有Statsig请求403，与localhost应用控制台分开记录。

## 下一批

动作baseTimeScale、持续随机调度、原生mix配置继续核实。特别是当前普通原生命令已有显式`.15s`交接；默认`.12s`与队列后继混合是另一个问题，不能将所有动作过渡笼统写成`.12s`或直接全部清零。旧悬灯、syksai第四层、Logo资源选择与缺家族仍以审计表保留未完成。
