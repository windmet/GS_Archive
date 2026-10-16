# 旧悬灯第四类与能力守卫（2026-10-16）

输入HEAD `8d3dc721`，分支 `stage/20261014-native-fidelity`，工作目录 `E:/Web_build/GS_Archive_Domain_Work/stage-native-fidelity-20261014/web_viewer`。承接[猜测项总审计](STAGE_ASSUMPTION_AUDIT_20261015.md)及[旧通道来源](NATIVE_DRIVE_LIGHT_CHAIN_RECHECK_20261014.md)，本批收束第四类资源缺口与按歌名放行，并保留新发现的原生零周期边界。

## 查到的问题

旧导出把Moon/Growing/Drive共42份编排设为previewEnabled，另外63份不加载；这不是原版资源条件。已恢复的通道、层级和native camera plane足以共用，但模型还缺真实存在的 `LiveObjectSuspensionlight_4`。该类在28份编排有929条RAW命令，不能因为四类旧模型检查通过就认为旧悬灯家族完整。

重新读取配置APK data.unity3d，第四类prefab为resources.assets11423、script135946，80字节字段，绑定同一sidelight Sprite/texture398、材质225/Shader950、LeftRightBase及controller1350。与其他四类使用同一层级、顶端pivot、angle60默认state、2秒streamed曲线；不是复制别的类型名当作资源证据。五类模型均由本地APK重新抽取与fixture逐项比较。

Show RVA `0x1c026c8..0x1c02848`：value12AsFloat×0.5是一次单向颜色渐变时长；value14AsFloat是初始delay；value15AsInt决定value10/value13两种完整RGBA颜色的先后。DOColor后SetDelay、SetLoops(-1,Yoyo=1)、SetEase(Linear=1)、SetTarget(this)。对应泛型RVA在dump为0x2bdf5c8/0x2bdf910/0x2bdf668。这不是色相循环或透明度呼吸。通用ApplyData和固定0.2秒Erase保持原生来源；改色与Animator相位独立。

旧Sprite的Pixi ADD默认预乘路径一并换成已验证的Shader950直色四边形及ADD_NPM混合，保持clamp COLOR0与SrcAlpha/One。旧_2改用已绑定RAW fumen的nativeMotionTempoAt，在Show时捕获BPM；不再自行下载公开初级谱面并仅接受常速歌。没有另造时钟或默认BPM。

## 能力范围与剩余问题

新增82,986字节的 `public/data/stage-old-suspension.json`，绑定原stage-effects/index实际字节SHA、105份原轨道文件SHA、RAW bundle/TextAsset/PPtr来源和五类模型。原共享index、105份轨道、贴图均未修改。运行时只接受经过此绑定的nativeCapability，旧previewEnabled布尔本身不能放行。导出器撤掉歌名判断；以后重导出stage-effects须同时重建此补充数据，摘要不匹配会拒绝加载。

全库88,647行与本地RAW重新逐条匹配：96份/77,485行满足已证明的正周期/资源/颜色条件；55份是本批新放行，原41份继续放行。9份/11,162行仍受限：anwhre、hndmkh、hrkzbn、montns、ossshd、pl1gdd、steqmg、yivygr、yknkmh。Moon原来凭歌名放行，本批移入明确待核实范围。

这9份包含118条仅有ID、其他字段为空的Show；其中78条之后还有同key的Show。value4AsFloat原生TryParse失败返回0，ApplyData仍写零位置/缩放并设Animator.speed=2/0。旧消费者跳过这些Show，可能让旧灯继续显示；直接把它当Erase、冻结相位或给默认周期，都没有足够原生依据。hrkzbn另含10条_5零色相周期。当前按整个编排标为unsupported，记录具体sourceRow/time/key/reason；尚未恢复这些编排，不能宣称9份已修好。

Study第一批待核实空命令在13秒（RAW648行起）。其6秒Pinspotlight和后续Spotlight为独立消费者，继续工作；旧悬灯未放行不会被这两类的验收掩盖。下一步要核实Unity Animator接受非有限speed后的实际状态与重新激活链，再缩小/解除这9份能力守卫，而不是补一个周期常数。

## 已执行验证

```
python scripts/verify-chibi-old-suspension.py --native-elf E:/Tools/ghidra_work/sidem/libil2cpp.decrypted.so
node scripts/verify-chibi-old-suspension.mjs --published-assets
node scripts/verify-stage-command-coverage.mjs --published-assets
node scripts/verify-stage-resource-ownership.mjs
node scripts/verify-chibi-suspensionlights.mjs
npm run verify:source-batch
npm run build:check
```

本地原生生成/核对模式实际执行（--write只写小型补充JSON/receipt）。方法窗口、APK/ELF、材质和DOTweenSettings哈希已记录。门禁144/144；最终代码编译21.79秒、2950 modules、copyPublicDir:false、固定.analysis/build-check，不是媒体包或部署。

_4独立数值回归检查两色RGBA线性中点、初始delay、往返端点、反向起色和退出冻结；全部96份编排在每条命令起点及+100/+1500ms检查有限状态。真实加载器验证来源摘要、取消、404，抽取实际SFC验证过时轨道不能装入新歌及unsupported不会继承旧布尔权限。资源迟到销毁沿用共用store回归；来源验证不等于Unity逐帧或真机一致。

## Browser5212

复用本分支Vite PID61564，未重启端口。Browser插件冷加载Infinite Octave!，12秒出现22个真实_4对象，20秒定点后实播至约83秒，暂停回拖12秒；390×844手机复查。画面为柔和的颜色叠加，当前无对应原片逐像素证据，不把对象计数当成22束可见亮线。

Study冷加载6秒：旧悬灯明确unsupported/nonpositive_animator_period，4个Pinspotlight/蒙版正常绘制。两条既有Spine tint/update弃用warning，无应用error或Vite遮罩。返回歌曲核对清理URL和已加载难度表。截图前缀old-suspension-native，保存在本聊天小型visualizations目录。未部署、未改master、未写公共媒体；无关chibiRandomMotion草稿保留。
