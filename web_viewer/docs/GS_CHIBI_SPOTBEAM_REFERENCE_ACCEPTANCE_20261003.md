# Not Alone 参考图横向投影复核

输入 HEAD `e17e4b9d`，分支 `codex/chibi-stage-reconstruction-20261002`。用户补充五张 Not Alone 开场参考，并随后反馈“前面not alone我看过了这部分ok”。此反馈仅记为该部分验收，不代表所有舞台或未覆盖效果已验收。

## 对照与修正

参考第三张可辨认的 C 组外侧地面光斑约位于游戏画面横向10%与85%；原生对应池位置为-580、+498 Unity厘米单位。旧消费者把width=500直接乘为容器X=.5，两池落在约27%与69%，整组过度集中，光带也变窄、倾角变小。

`spotbeamParticleScale` 为类型8/9共享的二维投影增加横向1.8参考标定，width=500得到X=.9；C组落点约9%与85%。光束与光池整体使用同一变换，保留CSV宽度变化、纵向长度、出生组、原生倾角、alpha及颜色，没有把光斑锁定到角色脚底。类型3/4/5/6/7没有使用该标定。

此系数是截图指导的预览投影，不是恢复出的Unity函数体。metadata显示LiveObjectLightParticleEffect含SetSpeed/SetColor/SetSortOrder，未发现独立SetWidth方法，仍无法凭方法名证明导演如何处理宽度。Unity [pivot文档](https://docs.unity3d.com/ja/2019.4/ScriptReference/ParticleSystemRenderer-pivot.html)仅支持以粒子直径为单位的pivot解释，不证明本次横向系数。源函数体、摄像机空间和精确录屏时间码仍待恢复；这次没有因不确定而改动原始资源或fixture。

## 验证

- native spotbeam parser、spotbeam particles及turn laser particles回归通过。新几何见证验证C组外侧落点范围、光束图像末端与光池中心距离、小视口归一化比例及CSV宽度变化，不把透明quad底边误当光束可见末端。
- `npm run build:check` 2786 modules / 16.62s。输出复用`.analysis/build-check`，copyPublicDir=false。
- 既有5198映射服务，Browser1280×720：Not Alone3.2s十个粒子，横向分布扩大；图层关闭10→0，开启恢复10。390×844无横向页面溢出。console无error。没有实体手机或完整录屏逐帧结论。
- 截图：`.analysis/engineering-validation-20261002/not-alone-reference-projection-3-2s.png`与`not-alone-reference-projection-mobile.png`。

当前调用类型8/9的曲目为Not Alone和ANYWHERE；ANYWHERE共享消费者，但此次新标定未再做独立录屏验收。其它灯光种类保持各自接口。原生来源及先前运行验收见[宽光带审计](GS_CHIBI_SPOTBEAM_AUDIT_20261003.md)。
