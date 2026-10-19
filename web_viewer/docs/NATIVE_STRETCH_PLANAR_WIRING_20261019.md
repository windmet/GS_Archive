# 共享入射光：经典平面 Stretch 消费接线

输入HEAD `c677878e`，工作树 `stage-native-fidelity-20261014`。本批第一次把已重放的Stretch公式接入实际对象消费者；没有按歌曲增加倍率或分支。

## 实际漏接与修复

旧提取器只保留renderMode/alignment/pivot，未带入renderer的cameraVelocityScale、velocityScale、lengthScale、min/maxParticleSize、Flip。运行时对所有stretch_omitted继续画普通Sprite，粒子旋转驱动方向；既漏掉速度与尾迹长度，也把纹理轴当成普通billboard处理。

本批在RAW审计中补renderer字段及独立renderer tree SHA；提取器按来源能力接入 `native-classic-planar-v1`：标量尺寸、零pivot/相机速度/Flip、零重力、无Noise/Clamp/Velocity模块、平面方向、正且正交的层级缩放。未知组合继续省略。

当前唯一满足的真实系统是 **fx_in_tfmvmt_Incidentlight/light**。118份编排中，79份引用这一共享资源；全部走同一消费者。一个资源接通不等于79份编排已经逐帧视觉验收。

- `chibiParticleStretch.js` 实现正正规float32的FRSQRTE估计、经典尾迹长度、宽度边界与四角。
- 速度先按原生float32顺序计算 Camera×emitter 矩阵，再乘逐粒子速度；不能把乘法改结合。否则旋转样例会跨估计桶，产生可测长度差。
- 长度使用总速度、size×lengthScale×粒子X缩放与velocityScale；侧边独立应用XY缩放和屏幕尺寸边界。零速四角收缩；该classic路径不使用粒子旋转。
- 四角按原生UV `(0,1),(1,1),(1,0),(0,0)` 接入Pixi。UnityPy Texture2D.image的默认flip=True已核对：PNG顶边对应Unity V=1；纹理横轴沿尾迹，不用整体竖向拉伸替代。
- renderer传递镜头旋转及局部可见高度，取消此前对该模式额外做的billboard角度抵消。屏幕高度换算为720参考像素/每粒子单位100像素，再除对象、环境及父镜头缩放；7.2由现有舞台投影关系导出，不是视觉调参。

## 回归抓到的边界错误

最初实现把type4旋转90度当成平面box；实际它是Cone。ROUTE77的五个系统angle=1度，随机展开后仍有Z速度。出生四角回归发现不匹配后，已撤销这五个系统的平面接线，要求Cone angle=0才可进入该剖面；额外加入非零锥角必须保持省略的断言。

因此本批没有声称ROUTE77的Stretch已补齐：**20 noise_preview +1 stretch_preview +7 stretch_omitted**。7个省略系统为ROUTE77 fire_1/2/3、turbo_1/2，以及trhorz_star_1的两个球体发射系统。世界/局部随机种子、原生出生帧批次、完整三维相机/父变换历史与逐帧等价仍未收口，已接共享系统继续标preview。

另纠正重放工具：packedContext先前给renderer+0x1fc写(1,1,0)实际上启用了m_Flip；现按RAW改为(0,0,0)，将Flip纳入来源记录与接入守卫。packed案例的UV方向现统一一致，不把合成随机翻转当作默认UV。

## 数值与来源验证

- 原生Stretch重放扩展为46组顶点/UV，30组经过实际renderer/context准备，覆盖旋转、非均匀缩放、屏幕尺寸上限、零速、附加速度及出生四角；8个真实renderer来源重读一致。无--write重放再次通过。
- Web求解器对全部packed案例逐角比较，容差2e-5；另用真实sampleObjectEmitter走出生四角/UV、回拖及RAW字段绑定回归。两个三维星光与五个非平面Cone均没有进入平面路径。
- RAW current无--write重解：78资源 /709系统 /0 deferred /91纹理，原图像素保持一致；无新增PNG。
- published-assets对象回归通过。源码门禁147/147通过；之后仅补Flip来源守卫、UV/非平面断言与注释，对象回归及原生重放重新通过。
- build:check 2959模块、15.78秒，固定.analysis/build-check，copyPublicDir:false；保留既有大chunk提示。构建生成的无关审计/翻译文件已恢复。没有全量public打包。

## 5212 Browser插件验收

复用舞台Vite PID61564；没有重启服务或更换端口。

| 旅程 | 实际结果 |
| --- | --- |
| ROUTE77冷载，完整模式，49.1秒播放至约79秒，回拖49.1秒 | 160对象粒子，unsupported/deferred空、缺灯帧0；这是回归，不是该曲Stretch完成 |
| Platinum MASK冷载20秒、1280×720 | 789对象粒子、七个对象层包含共享入射光，画面无框架遮罩；不是原片同帧匹配 |
| Platinum MASK从20秒实际播放至2:13曲末，回拖20秒 | 自动暂停，789粒子恢复，缺灯帧0、console error空 |
| 390×844手机布局 | innerWidth=scrollWidth=390；fullPage截图约390×844，页面可读。普通截图API返回390×219缩略图，未把该缩略图作为完整手机画面证据 |
| 同页经曲目搜索切Take a StuMp!01，70秒 | 5/5就绪，444粒子、九个对象层含共享入射光/七灯串/panel；旧Platinum chandelier/incidentlight/panel消失，unsupported/deferred空、缺灯帧0、console error空 |

截图：`.analysis/stretch-planar-plmask-20s.png`、`stretch-planar-plmask-mobile-full.png`、`stretch-planar-take-70s.png`。临时viewport已恢复。上述证明Web接线、播放与退役，不是Unity真机或原片逐帧等价。

## 接续

下批继续非平面Cone/球体的Z速度、Z位置、相机与尾迹四角，目标仍包含ROUTE77喷气与另外两个星光；不把平面接线当作整个Stretch结束。全库仍33个无消费者资源、428条事件、18份编排、11个partial资源和4个缺源资源；其余独立指令族与Whole_screen问题继续保留。未部署、未合主线。

续查：[三维输入与真实相机绑定](NATIVE_STRETCH_SPATIAL_CAMERA_20261019.md)补入 92 组重放和 APK 引用链，并纠正早期合成相机矩阵配对的来源说明；七个非平面系统仍未开放。
