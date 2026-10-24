# バーニン・クールで輝いて：火焰接线

输入 HEAD `87616418`，分支 `stage/20261022-particle-gaps`，已普通 merge `origin/master f0a8be3a`。主 checkout，2026-10-23；未部署、未创建 PR。

## 来源和实现

`fx_in_bnckgy_fire` RAW bundle SHA256 为 `9f2ecb399a684a9d944225d2eb712121d533fe346f8a4113b2e8284da5fc91ec`。42 个 ParticleSystem 分为 36 个发射系统、6 个禁用发射容器；禁用节点保留完整 emission/sub-emitter 与静态组件证据，没有伪造空发射器。36 个系统含 18 个 Noise preview、6 个 Stretch preview 和 12 个普通 billboard。

新增四份 source-bound fixture：火焰全部源节点与受控圆锥、90 个原生相机目标姿势、真实 Show 窗口与场景桥接、普通 billboard 屏幕尺寸夹取。脚本直接调用现有原生引擎 harness，Unity ELF SHA256 为 `acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0`。

- 两个 Stretch writer 的 1728 个受控圆锥用例，最大误差约 `1.193e-6`。
- 25 个 Show × 6 个 Stretch 系统，2400 个真实消费者场景顶点用例，最大误差约 `2.355e-6`。取前一相机命令目标姿势，不声称恢复镜头补间帧。
- 30 个普通系统的 540 个尺寸用例：原生按 X 宽度夹取并保留非等比宽高，不能按最大轴或分别夹取。新增 profile 仅绑定本火焰；既有电弧 profile 不变。
- 共用 Stretch fixture 仅追加 6 个源 renderer；原有 16 个记录与全部 92 个数学用例不变。

原有 111 个资产模型、126 个纹理描述均与输入 HEAD 深比较一致。新加三张源纹理，共 721,880 bytes，receipt `2026-10-23-native-bnckgy-fire-001`；累计 435 张 tracked PNG / 77,071,195 bytes，publication 216 releases / 1400 logical IDs。

## 验证

`npm run verify:source-batch` 167/167；`npm run build:check` 2981 modules / 22.08s，固定 `.analysis/build-check`、不复制 public。共用 fixture 增加 renderer 后重跑主 emitter 回归及火焰/场景原生 no-write replay；其余两份火焰和默认电弧/相机 producer replay 亦通过。最后 `prepare-chibi-object-emitters.py --consume-deferred` 不写入复核通过：112 assets / 909 systems / 129 textures / deferred 0。

消费者分片闭包 4 catalogs + 468 shards，33,911,738 bytes；published-assets 分片清单与重生成检查通过。源码 baseline 校验通过，不代表全部本地历史语料已通过 Runtime v2 合同。

Browser 为主 checkout 5213/PID25568，候选 `rm-release-20261015`，bootstrap `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`。完整模式、沿用手动两人编队 2/3 号位，不作为原曲成员验收。

- 41.9s 为 0 粒子，42.6s 为 308，43.6s hide 后 0，44.2s 为 308，102.6s 为 200；倒拖 42.6s 恢复 308。
- 真实播放从 42.6s 到观察 107.6s，手动暂停 121.2s；未把手动暂停记作自动曲末。
- 桌面 1280×720、移动 390×844（scrollWidth 390），unsupported/deferred 为空。
- 独立冷入口及 reload 后 seek 均 ready/308；切 VIVA 立即清空旧对象，之后 ready/876，只有 VIVA 资产；所查 console error 为空。
- 小图：`fire-bnckgy-42s-desktop.png`、`fire-bnckgy-42s-mobile.png`，保存在本任务 visualizations 目录。

## 边界

资源级无 consumer 缺口现为 0 种/0 事件/0 编排。仍有 130 个 partial 系统（108 Noise、15 Stretch preview、7 Stretch omitted），不能据此宣称原机还原完成。原生 RNG、实际出生时钟、Noise 求解、镜头补间、原片逐帧与设备验收继续开放。

FLASH LIGHT 地面逐瓣颜色的追加复核见 [复核记录](FLASH_LIGHT_FLOOR_RECHECK_20261023.md)。
