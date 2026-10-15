# 全指令 RAW 快照与消费者矩阵

输入 `stage/20261014-native-fidelity` / `bdcac4ee`；已 fetch 并 merge origin/master，Already up to date。在既有独立 stage 工作区开发，5212 继续由 PID 61564 服务，不重启、不改变候选。

## 解决的问题

旧 `stageVfxCoverage` 仅枚举已经导出的事件。Penlight、Searchlight、Underlight、Smoke、固定嘴型、单人脚光与 Offset 没有导出时，覆盖面板也不显示它们，导致“没消费者”被统计为“没有来源”。本批把 RAW census 与运行时消费者注册分开：来源快照不会因缺少 exporter 而删掉命令，消费者矩阵按当前代码解释其接线状态。

`audit-live-chibi-stage-command-coverage.py` 现在对全部原始类型计数，保留旧四灯家族的统计接口。同时核对全部 60 个 bundle 的读取前后 SHA256、全部 118 个 TextAsset 身份和读取前后的 choreography index hash。完整证据保存至 `.analysis/stage-command-inventory/raw-census.json`，公开紧凑清单只保存计数、资源身份与 hash，不含完整 CSV 参数。

复现命令：

```powershell
python scripts/audit-live-chibi-stage-command-coverage.py --output .analysis/stage-command-inventory/raw-census.json --inventory-output public/data/stage-command-inventory.json --progress
```

## 实际来源统计

- 60 个 bundle，118 份编排，58 类原始行，261,812 行。其中 57 类有时序指令，另有 1 行非时序模板说明；不是 261,812 条均会执行。
- `yknkmh_live_effect` 第 3 行为 `指定形式_#Livechara_motion`，其 time 同样是说明字符串。保留在 RAW 快照中，矩阵单独标为“非时序来源行”，不计入未知执行指令。
- Penlight 家族 6,697 行 / 118 编排；Searchlight 家族 10,583 行 / 23 编排；旧悬灯 88,647 行 / 105 编排；新悬灯 60,358 行 / 19 编排。
- 此前缺少完整 census 的项：固定嘴型 29 行 / 4 编排；单人脚光 241 行 / 1 编排；Offset 98 行 / 98 编排；Underlight 家族 2,116 行；Smoke 5 行 / 2 编排。另保留 Livechara_skill、Unit_serif、Whole_screen、After_Spappeal、Finish 的未接线状态，不把浏览器近似结束时长当作这些命令的消费者。

紧凑清单 `public/data/stage-command-inventory.json` 为 107,775 B，SHA256 `b54cdc96be7088f6f5d423c549026b843b8cb8dc028bccb33d9707062bd4cd5e`；绑定 choreography index SHA256 `c3e249f6afda4f7c4d4b05022d7fe778e3a1247378f679c58fa5ff8ead39ef0a`。5212 实际 HTTP 200 / application/json，响应字节与磁盘一致。

## 消费者与呈现

`src/core/stageCommandCoverage.js` 以精确命令名记录命名字段摘要、导出位置、消费者、资源绑定与验证入口。未知后缀不继承家族的支持状态；原型属性名也不会被误认成注册消费者。尚无专门回归的路径显式标记，不编造 verifier 名称。

注册消费者只能表示“已接线，待原片对照”。旧悬灯按当前曲目的 `previewEnabled` 区分已放行、未放行、资源索引未加载。素材已导出却没有消费者的 Penlight 仍是“未绑定到消费者”，不误报为素材不存在。

维护模式加载快照时对实际加载的 choreography 文本计算 WebCrypto SHA256，再校验清单 hash、各编排计数和总计。版本不符、缺文件或错误响应均显示“不可用或版本不一致”；没有快照时不回退成完整覆盖或零缺口。单曲绑定同时检查 id、songCode、source。加载独立于舞台启动，卸载沿用 lifetime signal；普通读者模式不请求这份维护数据。

维护面板中的 RAW 矩阵可展开，七列依次为原始命令、接线状态、命名字段、导出、消费者、资源、验证。字段列描述当前投影，不表示所有原版参数和材质已经确认。窄屏表格在自身容器滚动，不扩大页面。全语料目前有 20,472 行时序命令尚无消费者；没有写成视觉完成率。

## 验证与边界

- `python scripts/verify-chibi-stage-command-census.py`：全类型、未知后缀、说明行、非法时序、原始顺序、公开数据裁剪通过。
- `node scripts/verify-stage-command-coverage.mjs --published-assets`：全部 118 编排身份 / hash / 总计、漏 exporter、精确后缀、未知原型名、旧悬灯守卫、非时序行，以及实际 loader 的错误 / 取消 / 版本隔离通过。新纯状态 verifier 已加入源码门禁 batch。
- `node scripts/verify-stage-vfx-coverage.mjs`、`node scripts/verify-stage-resource-ownership.mjs`、`node scripts/verify-chibi-suspensionlights.mjs --published-assets`、design tokens / verifier coverage 通过。
- `npm run verify:source-batch` 最终 133/133 通过。初跑发现新表格 11px 违背 tokens 下限，已改为 `--gs-text-meta`。Extra Story 的既有字节 hash 检查受本 worktree CRLF checkout 影响：确认内容与 HEAD 逐行相同后，恢复该 JSON 的 canonical Git 字节；复测通过，没有提交该文件或修改校验阈值。
- 最终 `npm run build:check` 通过（22.99 s），固定 `.analysis/build-check`，不复制 public；日志 `.analysis/stage-command-matrix-build.log`。无关生成清单已还原。
- Codex In-app Browser / 5212 dev：Tone's Destiny 显示 2775 行 / 30 类 / 36 行未接线，Penlight 18 和 Searchlight / Smoke 均可见。切到 DRIVE A LIVE 后更新为 673 行 / 24 类 / 102 行未接线，5 人就绪；旧悬灯 137 行显示“已放行，待原片对照”，没有复用前曲统计。再切到勇敢なるキミへ，3 人就绪、1990 行 / 26 类 / 90 行未接线；模板说明标记“非时序来源行”，旧悬灯 625 行标记“预览未放行”，URL 的 song/stage 与当前编排一致。窄屏 390×844，表格 clientWidth=268 / scrollWidth=760，键盘右移 scrollLeft>0，document.scrollWidth=390。

桌面 1440×900 和窄屏截图位于 `C:/Users/windm/.codex/visualizations/2026/10/14/01a13b34-f8ad-7920-8ee0-22c322a422ee/stage-command-*`，实际已查看。无应用 console error；原有 Spine tint/update warning 单列保留。

本批是来源与接线覆盖基础，不是 Penlight 等缺失家族的渲染完成，也不是全曲原片、真机、生产 bundle 或部署验收。5212 仍使用 `rm-native-relations-20261013`、release `1443ba17bda823fab56fdf04bea0aa527c4a0d0fe19486c202520e00c00636c5`。

下一步按 [STAGE_GAP_AUDIT_20261014.md](STAGE_GAP_AUDIT_20261014.md) 接 Penlight：已有精确 prefab / sprite / streamed Animator 资源描述，须补 RAW 命名事件、单位配色、Animator/Transform/投影及真实渲染。矩阵与 census 在这些工作完成前继续保留未接线状态。
