# 粒子材质内蒙版与原版混合

输入HEAD `b32cf91a`，分支`codex/stage-chibi-wiring-20261013`。继续ObjectLayer逐渲染器平面之后的重叠蒙版问题。5212保留原读模型候选配置，不再裸启动。

## 原版链路

重新从21个已接入floor物件的RAW bundle按ParticleSystem → GameObject → ParticleSystemRenderer → Material → Shader/Texture引用反查，共63个系统。61个为`Alpha Masked/Particles/Additive`，2个K.now O.nly火焰为`Alpha Masked/Unlit Alpha Masked - World Coords`。两类材质都在片元内读取_AlphaTex.alpha并修改每粒子的alpha；不能将所有粒子先合成再统一套Pixi SpriteMask。

加亮材质使用`2*vertexColor*_TintColor(.5)`，RGB/alpha均`SrcAlpha / One`。火焰材质使用`texture*vertexColor`，RGB/alpha均`SrcAlpha / OneMinusSrcAlpha`。原版ZTest=LessEqual、ZWrite=Off；Web只验证相应2D平面合成，不据此声称恢复深度缓冲。所有已接入材质Enabled/UseAlphaChannel为1，ClampHoriz/ClampVert/ScreenSpaceUI为0，纹理ST均单位变换；新来源不符合时生成器拒绝。

原蒙版纹理Clamp、双线性；主纹理Repeat、双线性，原mipCount包括1/10/12。新增nativeSampling来源元数据，私有纹理改为NPM上传，避免在PMA插值之后反除alpha造成透明边缘颜色偏差。保留有/无mip区别；双线性与三线性的层间混合不同，语义见[Unity FilterMode](https://docs.unity3d.com/es/2021.1/ScriptReference/FilterMode.html)。Web重建mip时使用LINEAR_MIPMAP_NEAREST；当前未导出原压缩资源的各级mip，不能宣称重建mip与原编码逐字节相等。

## 接线

新增批渲染插件，主纹理占unit0、蒙版占unit1；每顶点带独立mask UV，在片元内应用蒙版后按原混合因子绘制。按mask/材质切批，保留粒子池与原始全局排序；不添加每个粒子的单独Mesh/filter。原蒙版Sprite仅更新世界矩阵和持有纹理，不再成为后置组蒙版。保留旧索引回退：没有完整nativeMaskMaterial/nativeSampling来源标记时继续旧渲染，不能只切换一部分材质。

生成器新增材质flag/tint/ST源合同；`verify-chibi-native-particle-masks.py --write`仅更新本小批的JSON元数据和fixture，不重拷贝PNG。验证器复查所有bundle哈希、63个材质引用、Shader原片元/摘要、混合状态和纹理采样字段。fixture中保留可执行的原Shader片元尾部用于独立GPU oracle。

## 验证

- Python floor源合同及新增变更flag/tint拒绝；JS floor旧索引回退/粒子池/双蒙版、逐渲染器平面、stage-layer-order、architecture、Body/Foot回归通过。
- `npm run build:check`通过，14.48秒，固定`.analysis/build-check`，copyPublicDir:false，没有媒体包。
- 5212 Edge/SwiftShader：K.now O.nly、Take 01、Drive 19s、Flash Light；原版排序1701/1702、1651、1500、1600保持，所有新地面粒子使用插件且无后置mask作用域。Drive播放/暂停/倒退采样签名稳定；390×844截图已查看。
- 128组GPU原片元程序对照：两种blend、两种颜色、alpha0/.25/.5/1、mask alpha0/64/128/255、1层/2层重叠。原始8位framebuffer RGBA最大差0；覆盖此前整组蒙版出现差64的重叠类型，不等价于Unity HDR/真机验收。
- Drive的400粒子池在19秒实际36粒子可见，共增加3次drawElements（542对539），保持批绘制；这不是整曲帧率性能验收。144个实际顶点mask UV与Pixi独立矩阵逆变换结果最大差5.93e-8。
- 本轮页面错误0；歌曲目录5/47/8分类仍可用，没有把丢失读模型当作既有错误。
- Browser主动触发WEBGL_lose_context并恢复后，通过时间轴重新绘制，材质/采样/混合状态恢复且无页面错误；不据此声称暂停画面无需交互便会自动补画。

源 fixture：[chibi-native-particle-masks.json](../scripts/fixtures/chibi-native-particle-masks.json)。Browser小型receipt/截图位于`C:/Users/windm/.codex/visualizations/2026/10/13/01a13599-5517-7113-9331-e6ac3c22279e/native-particle-mask-*`；构建/Browser日志位于checkout `.analysis/native-chibi-wiring-audit/native-particle-mask-*`。派生JSON受Git忽略，源码提交不代表在线资源发布；未部署。

## 尚未完成

ObjectLayer粒子Play/StopEmitting/延迟停用仍被旧统一父alpha时间线近似；UV窗户粒子的原alpha混合、其他特效材质、原压缩mip、完整三维投影、随机种子/Noise、深度/HDR和最终相机输出链路继续核实。已恢复的逐粒子材质与排序不应扩大为全部舞台还原完成。
