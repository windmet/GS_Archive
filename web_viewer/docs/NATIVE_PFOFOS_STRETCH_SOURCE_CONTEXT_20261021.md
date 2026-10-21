# pfofos 拉伸：完整父链与相机上下文

输入`6dc02a34`，当前`stage/20261020-native-followup`。接续[24例初步探测](NATIVE_PFOFOS_STRETCH_PROBE_20261021.md)，本批扩大来源与原生对照，不改应用运行时或public资源，不登记火焰晋升。

## 扩大范围后的差异

从RAW重新提取`pfofos_fire_1..8`。每组恰有一个stretch_omitted系统，8份来源均锁定bundle SHA、serialized file、精确64位PathID、参数树SHA、完整链和renderer字段。它们的尺寸均为常量，SizeOverLife=null；没有实际尺寸曲线可重放，不能以人造曲线冒充原始尺寸轨迹。

左四组父节点为平面Z旋转；右四组含180°翻转，其四元数X/Y不为0，但保持XY平面并反转深度轴。前批只用第一组的旋转/缩放、平移设为0，因此没有覆盖完整位置。新测试保留源XY平移、Z=14及深度方向；这使原生侧边/UV角点次序与平面公式不同，不能将1°直接当0°放行。

新增`prepare-chibi-cone-stretch-fixture.py`，复用此前原生ELF和ABI加载器：先重验92组stretch/8来源，再执行真实context准备和两条原生顶点writer，只有free(NULL)清理适配。父链从RAW完整四元数/缩放/平移重组，不宣称执行了原生层级构造函数。

每来源取8个方位、3个径向分数、3个粒龄、2个正交Z-roll相机条件、2条writer，共288例；八来源合计**2304例**。保留源初速35、角度1°、尺寸、全局父矩阵/深度和renderer参数；受控锥射线不是原生RNG序列或实际帧历史。fixture绑定object index SHA、camera来源和原生指令窗口SHA。

## 对照结果

| 模型 | 匹配数 | 最大世界坐标误差 |
|---|---:|---:|
| 现有运行时平面公式，强制用于新输入 | 0 / 2304 | 0.6736592457 |
| 原有XYZ证据对应的三维参考公式 | 2304 / 2304 | 1.5895881e−6 |

同一UV顺序逐角比较，不通过重新排序角点掩盖差异。两条原生writer结果分别保存，参考公式按2e−5世界单位边界比较。这不是设备像素阈值。

三维参考保留完整速度平方与原生FRSQRTE，并用粒子相对相机位置与速度的叉积决定侧边。当前合成上下文的相机位置相当于(0,0,10)，**它不是已经确认的舞台相机世界坐标**。`0x5e5440`的轴翻转、实例化后的完整父链和相机移动仍须串联，边界见[三维相机证据](NATIVE_STRETCH_SPATIAL_CAMERA_20261019.md)。

新增`audit-chibi-cone-stretch.mjs`只报告两种模型的差异，exit0本身不是验收；既有emitter门禁要求三维参考2304/2304、平面模型0/2304，并检查每来源288例、UV顺序、object index/camera/binary/指令哈希绑定。后续不能以最初24例吻合为由绕过这批反例。

## 复现与后续

`python scripts/prepare-chibi-cone-stretch-fixture.py --native-engine <libunity.so> --unicorn-path <runtime>`：不带`--write`复核RAW和原生重放；`--write`仅生成独立证据fixture，不写public纹理。

`node scripts/audit-chibi-cone-stretch.mjs`报告误差；`node scripts/verify-chibi-object-emitters.mjs --published-assets`检查证据及既有资源合同。新增fixture约2MB量级，是JSON数值证据，不是媒体包。没有应用依赖改动，按构建策略不重复Vite或Browser；最近应用构建/Browser仍为master #74同步批次。

`npm run verify:source-batch`最终167/167通过，日志`.analysis/cone-stretch-source-20261021.log`。最终fixture不带`--write`的RAW/原生重放一致性通过；published-assets针对最新来源/UV/覆盖断言补跑通过。

下一步需把真实相机位置、深度符号、对象外层placement和父链接到三维renderer；当前`updateObjectEmitters`只传cameraRotation/viewHeight，尚不足以支撑这些新来源。透视、相机全动态历史、遮挡/材质与原片/设备仍未验。八组火焰保持未接入，缺口18种，不通过将空间公式仅放进验证器来宣称运行时已修复。
