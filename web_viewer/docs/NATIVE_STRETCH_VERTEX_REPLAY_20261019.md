# Stretch：两条原生顶点路径已执行

输入HEAD `b911bd87`；舞台工作树 `stage-native-fidelity-20261014`。接续 [参数块追踪](NATIVE_PARTICLE_SCALE_RENDERER_20261019.md)。本批取得实际顶点与UV，尚未改Web消费者。

## 从入口到输出

同一libunity SHA `acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0`，Ghidra base `0x100000`：

- renderer打包 `0x6c505c` → dispatcher `0x809088` → renderMode=1的 `0x80b8a4` / `0x817658`。
- 粒子读取 `0x816820` 把基础速度和附加速度相加，提供位置、尺寸、旋转等输入；不能只用出生初速决定拖尾。
- 两个solver均执行真实写入端 `0x813660`。固定stream为position3、normal3、packed RGBA、UV2；四个顶点每顶点36字节，能从输出缓冲直接取得坐标和UV。
- 仅空指针清理函数 `0x306258` 用ABI adapter返回，并断言X0必须为0；求解器、读取器和stream writer均未跳过。不是完整Unity场景或原机帧重放。

[重放工具](../scripts/prepare-chibi-stretch-kernel-fixture.py) 复用原Noise工具的已校验ELF loader，并先校验既有fixture；新增独立 [Stretch fixture](../scripts/fixtures/chibi-stretch-kernel-native.json)。运行需要本地同一二进制、可选Unicorn分析依赖及RAW，正常JS消费者不加载Unicorn或ELF。

## 16组顶点/UV证据

八组输入分别执行两个原生分支，输出一致。合成场景使用单位camera/context、z=1粒子平面、标量尺寸、零pivot/相机速度、非约束屏幕尺寸上限、固定stream。没有证明完整camera上下文构造、屏幕裁剪或动态相机。

| 输入 | 原生输出含义 |
| --- | --- |
| v=(1,0), size=2, velocityScale=1, lengthScale=2 | 头端x=0，尾端x=-5，宽2 |
| v=(0,2)，同尺寸与倍率 | 头端y=0，尾端y=-6，宽2 |
| v=(-1,0), size=1, velocityScale=0, lengthScale=3 | 尾端x=3，宽1；拖尾反向随速度变化 |
| v=0 | 四个顶点重合；不能继续绘制普通静态Sprite |
| 粒子rotation=1.57 | 本classic路径与rotation=0的输出相同 |
| 基础v=(1,0)，附加v=(0,2) | 两种速度共同决定拖尾；结果保存在fixture |
| lengthScale=0、velocityScale=.3 | 仍由速度产生长度，不能按lengthScale=0禁用 |

原生四角UV依次为 `(0,1),(1,1),(1,0),(0,0)`；同一顺序下为头+侧、尾+侧、尾-侧、头-侧。**纹理横轴沿拖尾长度**。Web接线需核对现有PNG/UV翻转，不能把原quad的纵轴简单拉长。

对轴向样例，长度符合 size×lengthScale + speed×velocityScale；但斜向(3,4)样例并非精确数学6.5，而约6.501957。反编译中有FRSQRTE估计及`1.0019569`修正参与多处归一化，尚未还原完整浮点顺序。不能用经验epsilon或一个额外倍率把解析近似称为原生等价。

## 八个现用renderer的RAW参数

工具直接重读对应RAW bundle中的ParticleSystemRenderer，保存bundle SHA、renderer tree SHA、原生pathId和字段，不扩素材边界。

| 资源 | 系统数 | cameraVelocityScale | velocityScale | lengthScale | alignment |
| --- | ---: | ---: | ---: | ---: | ---: |
| ROUTE77 fire_1/2/3、turbo_1/2 | 5 | 0 | 0 | 3 | 0 |
| tfmvmt_Incidentlight | 1 | 0 | 2 | 2 | 0 |
| trhorz_star_1 | 2 | 0 | .3 / .1 | 0 | 2 |

pivot全部零；maxParticleSize分别1、100、50，min全部0。旧audit只保留renderMode/alignment/pivot，遗漏这三个实际长度字段，因此必须先扩提取合同，再进入渲染；不能继续只靠stretch_omitted标记或统一尺寸推测。当前数据中的这八个系统仍保留省略标记。

## 验证与继续

- 新工具先--write、再无--write重放，16组顶点/UV及8个来源renderer完全一致；原有Noise/重力/层级缩放fixture也同时校验通过。
- 工具内断言两分支一致、零速收缩、rotation忽略及UV方向，防止以后将普通billboard分支误当Stretch。
- 新增内容仅分析工具、fixture与文档；没有应用运行时代码或public数据改动，不重复Vite构建、147门禁或Browser验收；未部署。
- 下一步补真实renderer字段提取，恢复完整相机上下文、速度与尺寸缩放以及FRSQRTE顺序，然后按顶点/UV对照接通公共消费者。8个stretch_omitted及其它Noise/Whole_screen/无消费者缺口继续保留。
