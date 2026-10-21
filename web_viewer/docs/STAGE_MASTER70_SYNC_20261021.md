# 舞台同步 master #69–#70

输入 `726bf666`，分支 `stage/20261020-native-followup`；普通 merge 同步 `origin/master` / `af58d6eb`，包含 ADV straight-alpha/雨滴锚点与剧情详情页更新。未重新提取舞台资源，未部署。

唯一冲突是 `src/data/advParticleEffects.json`：用合并后的提取器从实际 APK 重建，保留 #69 的 RectTransform 锚点、来源 fixture、纹理路径及 SHA，同时保留舞台已验证的 RAW 正旋转角和角速度。没有恢复旧的 ADV 负角度补偿，也没有对 Transform 四元数整体翻号。

验证：APK 5 prefabs / 8 systems / 2 textures 来源回归通过，粒子61例原生顶点通过，effect texture parity/object lifecycle回归通过；`npm run verify:source-batch` 168/168通过。`npm run build:check` 2,984 modules / 30.77秒，固定 `.analysis/build-check`，不复制 public 语料；生成审计元数据还原。

本地5213仍是主checkout的PID56064，未重启/改端口。Browser冷开 `hrkzbn_live_effect`，完整加载10秒就绪、69对象粒子、error=0；独立QA直接运行实际 `BackgroundEffectManager`，暴雨8秒155粒子可见、error=0。后者只是独立消费者验收，不是完整剧情或原片/设备对照。截图在本机既有QA目录的 `stage-master70-bubble.png` 与 `stage-master70-adv-rain.png`；日志 `.analysis/stage-master-sync-20261021-late-{build,source}.log`。
