# RAW 文本编译作用域修复与复审

基线：`codex/translation-strict-v2-prep`，`29760234fb5cd1c6e0684c2c68abb0e91a9ec8f7`。本批修复候选编译工具、审计分类和回归测试，没有替换 public compiled、Reader 或翻译覆盖层，没有新增 publication。机器证据见 [完整审计](GS_GROUP_COMPILATION_AUDIT_20260929.json)。

## 核实结果

旧独立 RAW part 审计中的 1,320 份 `row-drift`，全部是候选多出开场 `text_synopsis` 对应的标题、简介两行。两行逐字匹配真实父文档的第一步 synopsis；其余行的类型、原文、说话人来源名称均一致，步骤锚点统一偏移 1。涉及的 17,104 条是这些文档中缺少稳定身份的文本行，不是丢失了 17,104 句正文。

生产聚合编译器本来就在整组作用域去重相同 synopsis；独立重编每个 part 会丢失这个上下文，也会丢失继承的场景状态。修复使用同一个编译器先编完整组，再使用现有 episode splitter 切分；没有删除 Reader 的前两行来凑齐数量。

完整 RAW 重编覆盖 188 组、1,509 集。1,509 集全部通过 strict-v2 schema，20,029 条非空文本的种类、原文、说话人来源名称、顺序及步骤锚点全部一致；音频引用、选择目标、Reader 状态也全部一致，新增身份有效且没有已存身份冲突。

| 比较对象 | 包含运行时比较的 parity | 仍有运行时差异 |
| --- | ---: | ---: |
| 父文档 | 155 份 / 16,162 条文本 | 33 份 / 3,867 条文本 |
| episode | 1,463 份 / 19,398 条文本 | 46 份 / 631 条文本 |

父文档与 episode 是同一内容的两种入口，不能相加当作独立翻译量。46 集中，14 集是 duration 差异，32 集是 Spine 快照差异，两组不重叠。例如 `episodes/1_1_001_01_f.json` 第 14 步从 4.2 秒变为 0.2 秒，不能把这种变化当作无害元数据。逐字段 before/after 保留在机器证据的 `runtime_details` 中。

另有 4 份独立文档、46 条文本仍被 RAW choice target=0 阻塞。本批不猜测分支目标，也没有发布上述候选。当前正式文本身份覆盖仍为 10,046 / 30,121，剩余 20,075 条尚未回填；本次仅将原因和可用候选进一步核实。

## 工具改变

- `recompile-local-story-text.py` 默认使用 `mounted-groups`；独立 part 重编须显式指定 `--scope raw-parts`，仅供来源审计。两个作用域输出隔离，拒绝向非空目录覆盖。
- 新的 `recompile-mounted-story-groups.py` 校验 RAW bundle/payload 哈希、唯一 owner、完整 authored part 集合和挂载 episode 顺序。共享本地资源配置，一次 group compile 后切分 parent/episode；不允许输出到 public。失败组写入账本，CLI 返回非零。
- 新的 `audit-mounted-story-groups.mjs` 验证 manifest、父文档、候选与挂载源哈希，检查 strict schema、正文/锚点、身份、说话人、音频、目标及运行时字段。只有旧 choice ID 的确定性补全允许作为身份升级；演出差异逐字段记录。
- `audit-translation-crosswalk.mjs` 增加 `duplicate-preplay-synopsis-parity` 诊断，但这个分类本身不是发布许可。是否可迁移以 group 候选比较为准。
- 新回归覆盖重复/不同 synopsis、正式标题、场景继承、RAW 身份、完整顺序、选择目标重编号及跨集目标拒绝，纳入 `verify:scenario-package`。

本次最终候选目录：`.analysis/local-story-group-v2-final`。保留 RAW 来源账本 `.analysis/local-story-strict-v2-r2/ledger.json`。复现时使用新的空目录：

```powershell
python scripts/recompile-local-story-text.py --output .analysis/local-story-group-v2-review
node scripts/audit-mounted-story-groups.mjs .analysis/local-story-group-v2-review
```

若没有本地 part 账本，先运行 `python scripts/recompile-local-story-text.py --scope raw-parts --output <新的空目录>`，再给 group 命令传 `--part-ledger <该目录>/ledger.json`。这些命令仅生成本地候选，不执行发布。

## 播放入口核实与验收

审阅中对详情页播放入口的疑问已沿完整调用链核实：`resolveStoryPlaybackWindow()` 本来就会跳过开头 synopsis，保留正式 title。上层未显式传入 startStep 并不代表漏处理；额外传 startStep 反而可能把整组范围缩到首集。因此 App.vue 没有改动。新增回归通过真实 `playStoryDetail` 和共享窗口函数，验证跳过开头简介、保留标题、保留非开头 synopsis，以及整组尾部不被截断。

通过检查：`verify:scenario-package`、`verify-story-migration-candidate.py`、`verify:story-text`、`verify:playback-controller`、`verify-story-readmodel-navigation.mjs`、`verify-translation-strict-v2.mjs`、Reader 诊断审计回归、`build:check` 和 build audit。已发布 536 份来源 / 4,994 个身份回归保持通过。

Browser 插件不可用，使用本机 Playwright + headless Edge，在 1440×900 和 390×844 各验收详情页开始播放、刷新播放器、直接进入播放器，共 6 条路径。移动宽度按界面提示选择“继续当前方向”。样本 `1_1_001jup_01_1_1_001_01.json` 均跳过开场简介并进入正式标题，保留 233 步整组范围，无脚本异常；HTTP 404 仅为尚未制作的中文译文，原文回退正常。

验收入口 `http://127.0.0.1:5203` 原位映射当前 build-check、已验证的 read-model、public 和真实音频资源，没有复制媒体库。既有 5202 服务不映射外部音频，因此不把该服务的音频 404 当作编译回归。截图和路径日志位于 `E:/GS_ReadModels_QA/group-compiler-final-title-1440.png`、`group-compiler-final-title-390.png`、`group-compiler-final-playback-qa.json`。

这些证据不包含候选正式发布、全量剧情演出验收、2–4 小时 Runtime 长稳、物理设备或远端部署。后续迁移需先处理对应运行时差异，并满足 [PROJECT_MAP.md](PROJECT_MAP.md) 的 collection publication 条件；仍被使用的 legacy 本批不删除。
