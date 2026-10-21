# Reversed Masquerade 短脉冲冲击波

输入 `4c58bfd6`，仍在`stage/20261020-native-followup`。本批接入`fx_in_remasq_shockwave`，保留三个系统的`noise_preview`；没有改粒子数学、原始编舞或renderer。未部署。

## 来源与生命周期

`asset/song_remasq.unity3d` SHA-256 `f699c8c75a2e803d13ae934e307a0ef2d06de23892b8d111d4044ffeab0a1376`。promotion名单绑定三份serialized file / 64位PathID /参数树SHA和bundle SHA。单份Texture2D为1024×1024，209,842 bytes；PNG SHA `3f20c49539a4fd82925c84383445c39a694bcf82d29c7962723ba8beca16ba33`，RAW RGBA像素一致性通过。旧93组模型/109纹理描述与批前快照逐项相同。

这不是持续烟雾：三份非循环系统各只在time0 burst一个粒子，寿命依次0.25/0.25/0.2秒，第二份startDelay约70ms。不得用20秒处可见或Show后500ms仍存活来判断这类系统接线是否正确。

回归为非循环preview在各自首次burst和寿命内采样，原持续Noise检查保持。另锁定RAW短脉冲计数：相对启动0/50/100/220/270/350/1000ms为2/2/3/2/1/0/0；负时间为0。回拖及冷对象定位一致，结束后不会自行再次出生。

真实引用窗口共三条：

| 编排 | Show / Hide |
|---|---|
| remasq_live_effect | 76600ms / 无Hide |
| pfofos_live_effect | 87200ms / 89000ms，Hide duration1ms |
| pfofos_live_effect | 123550ms / 125400ms，Hide duration1ms |

两次跨曲触发重新Play，而不是延续已消亡的第一次脉冲。历史`raw19`诊断值不参与控制；控制按命名CSV字段解析。published-assets覆盖全部13项preview的60条真实show/restart窗口，包括以上三条。

## 发布依赖与验收

当前94组 / 774系统 / 110纹理 / deferred0；65个partial系统（57 Noise、7 stretch omitted、1 stretch preview），完整晋升名单33项/180系统不变。原生角点仍62例/17真实3D父链并通过，没有新增3D系统。

新增一份emitter分片，consumer目录213片。实际完整闭包**4目录 + 450分片 = 454文件 / 33,198,066 bytes**，路径/长度/SHA逐项核对通过。publication记录`2026-10-21-native-remasq-shockwave-001`为本地来源晋升，账本208 releases / 1381 stable IDs；受管PNG416份 / 74,080,906 bytes。历史baseline只更新两个PNG计数及五份账本标记；ledger和source-only baseline通过，未重新验收历史语料人口。

提取器带`--consume-deferred`重放并逐像素比对、consumer生成一致性/guards、emitter published-assets与生命周期回归通过。本批只改数据与独立验证脚本，不改前端依赖，按构建策略不机械重跑Vite。

`npm run verify:source-batch`最终168/168通过，日志`.analysis/remasq-source-batch-20261021.log`；publication最终重验通过，日志`.analysis/remasq-publication-20261021.log`。

## Browser

旧5213对新增分片返回HTML，确认归属后只重启此端口，新PID32788，主checkout和`rm-release-20261015`候选不变。新分片HTTP为application/json、9,207 bytes。

- Reversed Masquerade：76700ms仅目标对象在列表，3粒子且冲击波可见；77000ms归零。回拖和整页重载76700ms均恢复3，unsupported/deferred为空。桌面1280×720、手机390×844已查看，手机document/scrollWidth均390。
- PROOF OF ONESELF：87300ms为3，87700ms为0；123700ms第二次触发为3，124000ms为0，回拖87300ms恢复3。既有八组火焰继续列unsupported，没有因冲击波接线而隐藏缺口；此曲镜头/位置下不宣称逐个脉冲纹理清晰可辨。
- 跨曲进入后实际暂停按钮操作成功，采样console error=0。沿用手动编队，无原曲成员验收。没有原片、设备或生产验收，也没有用本曲暂停成功否定上批mainha两次CDP超时。

截图在本机既有QA目录：`remasq-shockwave-76700-desktop.png`、`remasq-shockwave-76700-mobile.png`、`pfofos-shockwave-123700-desktop.png`。缺口从19→18种、333→328事件、9→8编排。

## 火焰下一步

八份`pfofos_fire_1..8`的RAW拉伸系统均为shape4、angle1°、shape rotationX−90°，产生非零Z方向；当前严格平面stretch只允许angle0°。现有提取器会标为`stretch_omitted`，所以本批没有将这八组登记接入，也没有把1°取近似零绕过门槛。逐份来源/renderer SHA及字段在`.analysis/pfofos-stretch-gap-20261021.json`，需补三维速度/位置的原生投影证据后继续。

输入分支已含master `af58d6eb`；本批执行期间远端继续推进至`5006f6a4`（#71–#74），尚未合入当前数据批次，后续普通merge同步。没有rebase或force push。
