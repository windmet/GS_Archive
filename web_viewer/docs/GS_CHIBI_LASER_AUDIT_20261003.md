# 激光原生粒子输入与验收边界

输入 HEAD `707970d6`，分支 `codex/chibi-stage-reconstruction-20261002`。

## 来源与改变

LiveObjectLaserlight / MonoBehaviour106566 的九项预制体引用按原生数组顺序解析。类型3、4、7连接 LiveObjectLightParticleEffect 的四个 ParticleSystem，保留 PPtr、序列化参数 SHA、粒子寿命、burst、delay、宽长曲线、角速度曲线、颜色 alpha、renderer pivot 和 texture885 `laserlight_3`。镜像的 Y180 变换用于反转扇形转动方向，不能解释成两根反向直线。

原生材质 Mobile/Particles/Additive 替代这三类原有 Graphics 三层直线及额外白色硬芯。出生点固定，粒子按各自年龄积分角速度，保持原生核心与低 alpha 光晕。每次定位从演出时间重算，切歌销毁实例与纹理引用。

这是原生粒子输入接线，**不是 Unity 导演代码完整等效**：CSV sweepDuration 与脚本 `_animTime` 的时间换算、二维投影、朝向仍为录屏指导的预览解释。预制体根角度和出生 rotation 保留在模型，不能说已完整应用原生3D变换。随机种子未证明与原客户端相同。类型1、2仍使用旧消费者；类型5/6已另批接入[转动激光Animator](GS_CHIBI_TURN_LASER_AUDIT_20261003.md)，类型8/9已接入[宽光带与地面光池](GS_CHIBI_SPOTBEAM_AUDIT_20261003.md)。

## 验证

- `python -S scripts/verify-chibi-laser-parser.py`：原生数组顺序、PPtr、镜像、贴图和不支持模块拒绝通过。
- `node scripts/verify-chibi-laser-particles.mjs --published-assets`：固定出生点、多年龄扇形、弱光晕、源色、burst空档、后退定位、比例缩放与实际发布索引一致通过。
- `npm run build:check`：2784 modules，12.79s，固定 `.analysis/build-check`，没有 public 复制。
- 5198 PID62924既有 bundle/public 映射服务；Browser1280×720 的∞ Possibilities 5s看见左右固定点扇形，K.now O.nly 2.5s看见柔和红色粒子光束。开关关闭清空、打开恢复；K.now 30s源时段无粒子。
- Browser390×844：∞ Possibilities 5s，画布同比缩放，document scrollWidth等于390；倒退3s为48粒子，返回5s为128，来源点不随粒子年龄移动。console无error。不是实体手机验收。

截图位于 `.analysis/engineering-validation-20261002/take-reference/`：`knwonl-laser-native-desktop.png`、`possibilities-laser-native-desktop.png`、`possibilities-laser-native-mobile.png`。这些证明消费者运行，不证明全曲逐帧一致。

## 后续录屏目标

当前实际编排：はんどめいど・きみはーと！类型6从1.70s、类型1从26.55s；いとをかし！〜一彩×合彩〜类型5从7.65s；Not Alone类型8/9从1.40s；ANYWHERE类型8/9从25.50s。Inner Dignity34.50s、BRAND NEW FIELD97.90s亦使用类型6。类型2没有当前实际调用。类型4仅Change to Chance58.85s，参数已接入但录屏未验收。

Take a StuMp!旋转logo、旧悬灯、Searchlight及其余原生控制仍见[通用层审计](GS_CHIBI_COMMON_LAYER_AUDIT_20261003.md)，没有被本批激光修复替代。用户另发现∞ Possibilities51.4s动作行与独立站位行冲突，站位／骨骼阴影问题另批处理。
