# 人物 Body_Color 材质替色接线

输入 HEAD：0474568c。继续处理舞台图层/人物变色，未修改动作速度或继续猜测灯光参数。

## 原版与旧实现的差异

`scripts/fixtures/chibi-costume-shader.json` 绑定实际 Growing/Skeleton-Gradient 的 GLES3 Normal/ALPHA 程序、材质和 costume atlas。片段程序先执行：

`bodyRGB = texRGB + (BodyColor.rgb * texAlpha - texRGB) * BodyColor.a`

然后应用脚部梯度，最后乘骨骼/槽位 vertex color。纹理 alpha 保留，混合使用预乘 alpha。Body_Color 是替色，无法用“白色与目标色混合得到 tint，再乘贴图”代替：黑色轮廓在前者中也会变色，后者则一直是黑色。

`.analysis/ghidra-il2cpp/decompiled_pass1_annotated/Growing.Live.Livechara_Body_ColorLiveEffectTypeExecuter.c` PlayEffect 0x1f32f24解析 value2 HTML 色，将 value3AsFloat 写入 alpha，以 value4AsFloat 为 duration；LiveObjectIdol.ChangeBodyColor 0x221bb58 写 _BodyColor 或 DG.Tweening.To 的四分量颜色。ResetBodyColor 0x221bdec 目标为白色/alpha0。没有把混合后的 RGB 当乘色。

## 实现

- bodyUniformsAt 保留独立 RGBA 并采样默认 OutQuad；不将 alpha折算进RGB tint。现有 RGB helper仅作旧诊断/兼容，人物消费者已改用RGBA。
- 新增 chibiNativeBodyPaint：在每个绘制部件纹理采样后、槽位着色和合成前执行实际替色公式。区域贴图与变形mesh都覆盖，保留其混合模式、动画几何、atlas UV和裁剪容器顺序。
- 区域贴图和原本能批处理的mesh使用自定义批渲染，RGBA作为逐顶点属性，允许不同人物同批不同颜色。原本不批处理的大mesh使用原几何加专用材质。
- alpha为0或关闭灯光时回到原绘制路径；新动画部件由factory hook接入，shader临时交换由finally恢复。释放人物时还原hook、释放额外材质和几何，不销毁共享纹理。

当前语料1188个Body_Color指令覆盖15编排。22组连续重叠的指令均未出现后一个tween先结束、旧tween仍继续的恢复情形；当前回放按最近控制采样。任意未来短tween覆盖长tween的DOTween并存行为仍需专门处理，不能将此处描述为完整DOTween执行器。

## 验证

native-body-paint 回归覆盖RGBA/OutQuad、Reset、反向seek、实际材质交换与异常恢复、异步新mesh、关闭效果、factory恢复和资源释放；核对全部1188指令的有限RGBA。foot-lighting、旧body接口、Image_color和architecture-cleanup回归通过；原始costume shader合同校验通过。Image_color消费者保持原逻辑。

5212现有服务、实际Edge/Playwright：Take0/0.1/5.4/26秒及回退、390×844、播放暂停、换回Drive。实际5个人物各176个缓存部件接入，根tint均为白色。72组GPU样本覆盖区域贴图、批mesh、大mesh，纹理alpha0/128/255、槽位RGB和alpha；在黑色不透明背景上比较原版PMA公式，最大误差1色阶。另同时绘制两个同纹理不同RGBA人物，得到蓝/红独立像素，未发生同批颜色串扰。Take0s启用/关闭替色的drawElements均为532次；只证明没有增加该见证的draw call，不是FPS/真机性能验收。

截图/回执：C:/Users/windm/.codex/visualizations/2026/10/13/01a13599-5517-7113-9331-e6ac3c22279e/native-body-*。build:check通过，固定 .analysis/build-check，不复制public；日志 .analysis/native-chibi-wiring-audit/native-body-paint-build.log。本批无语料/媒体导出或部署。

## 下一条已查明的 Foot_Color 线索

Livechara_Foot_ColorLiveEffectTypeExecuter.PlayEffect 0x1f331a4：value2AsFloat写颜色alpha，value4AsInt参与 `1000 / value4`，传入ChangeFootColor的rate参数；原ELF常量0x317a3bc为1000。LiveObjectIdol.ChangeFootColor 0x221b678将颜色写SrcColor，DstColor同RGB但alpha0，将该rate写_RcpHeightCutOff。当前Web把value4记成depth、将opacity记成rate，不是正确的几何含义。

目前仍未证明Unity SkeletonDataAsset局部顶点单位与Web骨骼坐标的换算，Foot绘制继续保持height0。此批仅将已确定的线索记入注释/待办，没有把CSV opacity当cutoff启用。Foot梯度、背屏整体层级/遮罩、源游戏起播/异步时钟仍未完成；Body替色验证不能代表完整人物shader或原版视频一致。
