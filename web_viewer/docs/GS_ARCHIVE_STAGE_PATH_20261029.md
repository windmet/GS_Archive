# R3 舞台路径执行记录

日期：2026-10-29。输入 master `5e52c768`，含 #131 与补齐页头/手机抽屉的 `305d6773`。分支 `portal/20261029-stage-path`，复用干净的专用 LF worktree `E:/Web_build/GS_Archive_Domain_Work/deep-links-20261028/web_viewer`。主 checkout 未动。

## 条件、身份与地址

P4 #131 已合入，实际手机编排抽屉也已观察到，页面前置解除。源码与两份索引核对：`stage-choreography-shards.json` 和 `song_timelines/manifest.json` 的歌曲/编舞对完全一致；60首歌曲、118个唯一编舞，byndtd20版、drvalv20版、grwsml21版，其余单版。每首都有 `<song_code>_live_effect` 默认编舞。61首歌曲目录中的 `Reason!!` 没有舞台，不生成舞台外壳。只读前置 receipt 在 `.analysis/stage-path-preflight/identity-receipt.json`。

- 路径：`/songs/<code>/stage/`。裸路径通过注册表的queryDefaults提供默认编舞；`?stage=<choreographyId>` 明确定位非默认版本，显式query优先。默认编舞写回时省略stage，非默认保留。内部buildArchiveUrl仍是query表示，不改变编舞/音源身份。
- 无歌曲入口保留 `/?view=chibi_stage` 及现有选择/加载流程，不新增 `/live/stage/`；本批Browser已验证其既有DRIVE A LIVE控台与加载选择流程。
- chibi_stage先进入强制schema，页面只拥有song/stage，song_scope等目录筛选裁剪；来源用现有版本化history，独立分享不含来源。换曲仍调用原有replace同步，不改导航加载逻辑。
- App只改共享标题helper import（:619）与archiveTabEntityName的stage分支（:1487），标题“曲名 · 2D舞台 · GROWING STARS 资料馆”；加载中保留旧标题，无歌曲时为“2D舞台”。不改模板/样式、舞台组件、面包屑或任何资源。
- head生成器逐项核对舞台与时间轴身份、默认编舞及已发布歌曲集合，缺默认或身份不一致时拒绝。只为确认有舞台的60曲生成外壳，1,462 → **1,522**；版本共用歌曲舞台canonical，不另生成118个外壳。

## Browser P84–P92

直接Codex In-app Browser；localhost:5240，PID8684，服务仍来自本worktree，候选rm-release-20261022，bootstrap release `1accd9d0aa698ec03ec6d0b80211939f914940abac105d51021b36a8fb321081`。桌面1280×900与手机视口390×844；临时视口已恢复。

| 编号 | 实际观察 |
|---|---|
| P84 | 冷开brndnf/stage裸路径，标题正确；按既有“开始加载”后，3人舞台、人物和2:10时间轴加载，播放按钮可用，桌面截图已展示 |
| P85 | 播放完成预载后实际到0:18，出现歌词、暂停按钮与“播放中”，随后暂停并关闭，回到 `/songs/brndnf/`；不是只观察预载状态 |
| P86 | 歌曲2D舞台入口 → brndnf/stage →曲目DRIVE A LIVE →组合版 →Altessimo，地址为 `/songs/drvalv/stage/?stage=drvalv_live_effect_03alt`，默认自由编成时不带stage |
| P87 | 上述版本冷刷新后390px二人舞台，打开手机“编排 组合版·Altessimo”抽屉，Altessimo2人 aria-checked=true，地址保持03alt；截图已展示 |
| P88 | 关闭抽屉、返回歌曲，实际回到最初 `/songs/brndnf/`，不是当前drvalv；来源在换曲与冷刷新后保留 |
| P89 | 旧 `?view=chibi_stage&song=drvalv&stage=drvalv_live_effect_03alt&song_scope=movie&idol=001tom` 改写为同一版本路径，已知越权筛选消失 |
| P90 | brndnf路径手工配drvalv编舞时，保留显式版本并显示“所选歌曲的舞台版本不存在或暂不可用”，不偷偷打开默认编舞；error日志为空 |
| P91 | 无歌曲query入口保持query与通用2D舞台标题，既有DRIVE A LIVE、5位置控台和加载选择对话框出现；没有据此声称完整通用入口播放验收 |
| P92 | 变异全部恢复后，独立新标签再次冷开brndnf/stage裸路径，原流程加载完成，实际3人物与舞台、标题和可用播放按钮；error为空，仍有两条Pixi/Spine warning |

舞台加载出现两条Pixi/Spine warning调用栈（set tint/applyStageLighting与Spine.update），本批未改这些模块，也未直接证明基线同旅程的warning表现，因此不宣称控制台全空或已消除警告。所测tab无error。画面中的初始出演成员沿用既有编队，不将二人编排选中等同于原曲成员/原机一致性。

## 验证与边界

- 全部118个编舞默认/非默认路径往返、旧query优先、无尾斜杠、非法多段、已知参数裁剪、分享无来源、history读取与replace检查通过。
- schema、1,176个导航状态投影、舞台导航真实App绑定、70个stage intent时序/协议用例通过。标题回归执行App实际computed回调，覆盖已选曲/未加载/无歌曲。
- build:check通过，27.95秒，复用 `.analysis/build-check`、不复制public。1,522个最终外壳检查通过，标题、canonical、OG和body合同保持。
- 13个生产代码变异均拒绝并恢复：路径字面量、默认读取、显式选择优先、默认写回、强制schema、筛选泄漏、分享来源、标题后缀、App标题接线、外壳种类、缺默认编舞、索引身份错配、通用query分享来源泄漏。每例独立UTF-8日志与汇总在 `.analysis/stage-path/`。
- 完整 `npm run gate:source` **116/116通过**（输入HEAD/base `5e52c768` 加本批patch；运行期间补通用入口分享清理和执行文档，后续汇总及编译已覆盖）。汇总批次237.2秒，门禁编译34.1秒，构建审计2.1秒。最后变异恢复后路径/schema回归再次通过，门禁最终构建重新生成1,522外壳并通过dist检查。额外尝试的localOnly `verify-song-stage-handoff.mjs` 因硬读本worktree缺失的 `public/assets/live-chibi/choreography/index.json` 报ENOENT；dev通过既有主库fallback加载，不能把它写成该脚本通过，也不为此复制语料或修改handoff行为。

本批是地址与标题验收，不是舞台完整原生/GPU、帧率、长稳、跨设备或Cloudflare发布验收。没有生产包、R2上传、部署或read-model绑定变更。摄影、图鉴、Reader/Player继续等P6/P7、语料和D3/D4前置；本轮不扩大实现范围。
