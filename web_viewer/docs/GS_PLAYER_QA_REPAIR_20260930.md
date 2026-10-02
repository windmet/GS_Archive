# GS Player QA 修复记录（2026-09-30）

输入包：`GS_Player_QA_Repair_e0b1c943.zip`。输入 HEAD：`e0b1c94384bf051cdde2c088206d9b80240d186f`；工作分支：`codex/player-qa-before-b002`。包内材料作为需求和参考实现审阅；本轮不部署、不更新 R2、不重新翻译 B001。

## 来源结构批次

- `1_4_001_05_c/d`：从原 RAW 的 `phone_select`、`jump_point`、前向 `jump` 和明确 `phone_end` 推导有限互斥分支及公共后文；新增证据元数据，保留所有原始 step、正文、`text_ref`。运行时沿选中路径汇合，Reader 标注两条互斥分支；分支内单行定位保持明确限制，整篇演出从头选择。
- `1_4_001_05_h`：RAW command 213 `talk_start ["2", "13"]` 到 command 238 `talk_end`，字典 unit 13 对应 THE 虎牙道。线程归属统一控制群名和主题；不从私聊当前发言人猜组合背景。
- 重建 c/d/h Reader、manifest/coverage，并追加 publication release；旧 release、42 个已审 overlay、receipt 和 output 保持不变。B001 来源检查仍通过（993 单元）。全库仍有 309 个 unsupported 文档，不扩大放行。
- 候选工具只写显式输出路径，不修改输入：`scripts/derive-phone-forks.py`、`scripts/derive-chat-threads.py`。Reader 可用状态由生成和验证合同计算，未手改 status。

相关回归：`verify:reading`、`verify:reading-sources`、`verify:reviewed-b001`、`verify:communication-presentation`、`verify:communication-assets`、`verify:player-qa` 已通过。两个真实电话分支分别验证选项 A/B 路径和返回历史。

## 验证边界与既有失败

`.analysis/player-b002-repair/regressions/results.json` 保存 100 个实际命令及退出码。首轮 95 个通过；名牌/线程语义的两项旧断言修订后通过；publication summary marker 同步后 `verify:archive-baseline:source-only` 通过。

`verify:story-schema` 和 `verify:episode-artifacts` 仍失败：前者缺 `story-collection:1_1_001jup_01_1_1_001_01` authoritative registry 条目，后者 episode manifest 缺 `1_2_002_12_a.json`。使用 e0b1c943 的脚本、schema、fixture、pipeline、publication manifest 和 registry，在独立小型来源目录挂载现有 compiled 语料，重现相同首个错误；这些失败对象未被本轮修改。日志位于 `.analysis/player-b002-repair/baseline-source/`。门禁未放宽。

包内 Python 16 项使用进程级 `core.autocrlf=false` 运行通过（默认 Windows synthetic Git fixture 会因自动换行失败）；完成策略参考测试 16 项通过；真实 resolver 的 Producer 测试 18 项通过。它们不等于 Browser 或真机验收。

## 运行时修复与验收结果

| 要求 | 实现与本地验收 | 仍需签收 |
|---|---|---|
| R1 会话与全屏 | `PlayerSessionShell` 持有稳定根和方向锁；keyed 子播放器继续独立销毁。真实 Browser h→i→j 三段均保持 `.player-session-shell:fullscreen`；j 的 503、重试按钮位于该根内，重试成功。Escape 后根退出，菜单可再次进入。 | 用户问题手机的原生全屏、物理转屏、系统返回及后台恢复 |
| R2 完成与继续 | ADV/电话/短信使用持久完成条；保留最后场景。队列严格按 canonical collection 顺序，同话连续、跨话明确点击；请求合并及会话身份保护。Reader 后续加载先验证目标来源，重试保留返回锚点。 | 真机连续跨段和听音；见下方 Browser 路线 |
| R3 Producer 名牌 | resolver 统一自定义名加 P；空 `<P>` 显示プロデューサー，固定称呼保留。ADV、Backlog、Reader、电话回答实际显示 windmetP。 | 无扩大到未审文本的翻译批准 |
| R4 电话分支 Reader | c/d 两个目录阅读入口可用，显示互斥分支；演出实际跳过未选分支并汇合。Reader 旧 compiled 响应被哈希保护拦截，重试和返回锚点成功。 | 两个全库既有门禁仍失败；309 个其他 unsupported 文档未放行 |
| R5 通信线程 | h 使用 RAW 证明的 THE 虎牙道线程；切换发言人/语言不改变群名。天峰秀正式私聊显示个人标题，不混入群聊归属。 | 未覆盖的其他全库线程不作推断 |
| R6 衣装调查 | 指定台词处 RAW、compiled、字典、prefab、实际渲染实例及 HTTP 资源字节一致，当前没有可证明的错装，不替换模型。 | 外部录屏所用版本尚未确认 |

会话测试使用真实 Vue Shell 自定义 renderer，证明 root 稳定、旧 child dispose、新 child 创建、错误子树仍挂载、最终退出；并覆盖迟到 native promise、竞争 lease、外部 fullscreen owner、方向锁拒绝与清理。控制器回归保留 source/hash/cancellation 断言，新增异步 Reader 来源解析失败后重试，及下一请求/旧实例竞争检查。纯逻辑通过不记为真机通过。

## 本地真实 HTTP / Browser

最终运行时源码 HEAD：`06f103a98033ec95a51d7e65b9f59ea4d89915d2`。`build:check` 和 `verify:build-audit` 均 exit 0；audit 的 sourceDirty=false，初始 chunk `_app/index-C0hnZVx-.js`，release `be375f3d4a7668beda4efe361474b2e4928ecb71e152a542e39fe0701be11fe8`。最终仅补文档的提交不改变这份已验源码。

ReadModel 在外部 `E:/Web_build/SideM_Player_QA_Models_20260930` 生成并通过 artifact 验证：8,420 文件、60,604,737 decoded bytes；40 项工具测试通过。生成基线 b75da3e7 后的提交未再改变其 consumed 数据。当前 bootstrap 与 routes 合同绑定同一 release；route parity 和 device accepted 仍未标为通过。工具 guard 仅对实际 adapter 输入要求 tracked，保留无关未跟踪 terminal 数据；所有已跟踪数据的脏状态和输入字节验证仍有效。

本地入口 `http://127.0.0.1:5197/`，Codex In-app Browser；静态 QA server 只挂载 `.analysis/build-check`、现有 public/媒体和已验证外部 ReadModel，没有复制媒体。此前 Vite 本地 HTTP 挂起后改用该入口；不能由此声称原 Vite 预览链路正常。页面 title 实测为 `SideM Story Viewer`，测试尺寸为 1280×800、390×844、844×390。所有下列路线有可见应用内容，无框架错误覆盖层；预期故障单列。

| 路线与标识 | 实际动作与结果 | 本地证据（位于 `.analysis/player-b002-repair/`） |
|---|---|---|
| 原目录→第1章→第5话→Episode 3/4 Reader | 阅读按钮可达；双语、自定义名、两条互斥分支可见；c option B 28→29、d option A 40→42 汇合 | `reader-c-branches.png`、`reader-c-branches-final.png`、`call-producer-portrait-final.png` |
| c Reader row `1_4_001_05_c:step-28:text`，revision `sha256:f8c1698c6f14ddbbd853018e9e45463d82c69795d15f3561104e246949fbe3b1` | 搜索原文→整篇播放→菜单续播 d→返回同一行；另一次注入 e0b1c943 c compiled，显示来源不一致并拒绝；重试正确字节后返回仍选中同一行 | `reader-source-mismatch.png`、HTTP 日志 |
| `episodes/1_4_001_05_h.json?at_step=37`→i→j | THE 虎牙道，37道流→38武，双语切 JP 后标题稳定；菜单进入原生全屏，再跨两段；j JSON 503→全屏内重试成功；Escape 后 fullscreen=0，菜单重新进入=1 | `the-group-final.png`、`fullscreen-503-final.png` |
| `episodes/1_4_001_01_e.json?at_step=64`（短信最后一步，unit `story-text:v1:1_4_001_01:1_4_001_01_e:cmd-000170:mobile_message:000`） | continuous OFF，末气泡保留，点击下一段进入 f（44步）；continuous ON+队列延迟5秒，显示读取信息后仅一次进入 f；队列503显示重试而非“没有后续”，重试恢复真实下一目标 | `shu-completion-portrait.png`、`shu-completion-portrait-final.png`、HTTP 日志；延迟轮 f JSON 一次请求（01:25:31.518Z） |
| `episodes/1_4_001_05_j.json?at_step=62` | continuous ON，隐藏界面→结束→恢复界面，完成条及退出可达，留在本话；点击“下一话 · 第6話”后才进入 `1_4_001_06_a`（26步） | 本轮 Browser DOM / URL 观察 |
| c ADV step15、电话回答、Reader / Backlog | windmetP 可见；正文宏替换保留，固定プロデューサーちゃん/制作人酱不改写成名字 | `producer-adv-bilingual.png`、`call-producer-portrait-final.png`、Reader 截图 |

菜单在窄屏/窄横屏可滚动，主要继续/返回动作在顶部，完成条未覆盖末气泡；隐藏界面保留“显示界面”出口。截图为 viewport 仿真，不能代替手机验证。原生全屏叠加 IAB viewport override 时，位图捕获会压缩/裁切；`call-completion-portrait.png` 不作为窄屏布局证据，其余窄屏截图在退出原生全屏后捕获。

HTTP URL/status/响应字节和哈希：`http-requests.jsonl`；34 条已记录哈希的正常 compiled/Reader locator/translation 响应逐字节匹配当前文件（`source-response-evidence.json`，故障替身不计入）；控制台：`browser-console-final.json`。预期 error 包含 j JSON 503 和 Reader 来源不一致；queue 503 单列。Spine SimpleMesh update/tint 的 warn 栈仍存在并保留，不能声称控制台完全干净。未进行人工听音/口型同步签收，也未证明全库资源无异常。

## R6 精确来源链

RAW bundle `RAW/asset/scenario_1_4_001_05.unity3d` SHA256 `8acb6236973032f28f8aa1057958f2eeb58e3dbb1584feecf1dbc9e65243f01e`。g RAW command 80 的“タケルさんとの共闘は、嫌ですか？”对应 compiled index16 / step17。此前 command5/9/13 分别载入下表模型；到该句前未发生模型替换，武已淡出，漣在 command64 淡入。因此该句实际可见实例只有漣。

| 角色 | RAW / compiled model | costume dictionary / prefab |
|---|---|---|
| 大河タケル | `038tak_004_00` | costume `1038001`，model/prefab 存在 |
| 円城寺道流 | `039mcr_004_00` | costume `1039002`，model/prefab 存在 |
| 牙崎漣 | `040ren_004_00` | costume `1040001`，model/prefab 存在 |

`runtimeDebug=1` 页面诊断显示 step index16、唯一 spine instance `040ren`、model `040ren_004_00`（`costume-runtime-final.txt`）。实际资源请求均 HTTP200，与本地原文件字节哈希一致（`costume-http-evidence.json`）：

| `assets/spines/040ren_004_00/` 资源 | 字节数 | SHA256 |
|---|---:|---|
| comu.skel | 744696 | `2f4d1dc442201fac90118bfd5c4c668844fa980885708ea742d9f9dee2191c6b` |
| comu.atlas | 14428 | `9c560ac7d99e6e2c068a4b8311f8a835d5faef5b213a558ce4c23b8c05256d09` |
| comu.png | 776097 | `c590d879cbe42965df12771cbd409be35a11a3aff31e4d676c94a5458e6a3ef0` |

`costume-quote-g17.png` 可见黑色无袖衣装；结论是“当前 RAW→compiled→渲染模型一致”，不等于“外部录屏版本相同”。没有以录屏外观猜测替换模型，也不声称该句展示了三个人物。

## 最终门禁及后续

- `verify:publication-ledger --base-sha e0b1c94384bf051cdde2c088206d9b80240d186f` 最终 exit0：199 releases / 1367 stable logical IDs（`publication-final.log`）。此前运行捕获修复前的 index 和 evidence schema，已纠正后重跑；未绕过检查。
- 最终 B001 guard：44 个保护文件逐字节相同；`verify:reviewed-b001` 再跑 exit0，52 docs / 42 catalogues / 993 source-bound units。`verify:reading-sources` exit0：2801 docs，2492 ready / 309 unsupported。新 player QA、immersive、playback controller、相关回归和 release-soak 通过。
- 最终 doc diff/link/content 检查后只提交本记录；应用 build 绑定上面的 06f103a9 源码，文档补记不重复创建构建树。无关未跟踪资料保留；本地 fault 文件恢复空对象，Browser viewport 复位。
- `verify:story-schema`、`verify:episode-artifacts` 的既有全库失败仍需另行修复；本轮不弱化门禁。用户问题手机尚未接入验收，系统版本/方向锁/后台恢复/实际听音均未签收。B002 尚未放行，也未用旧 HEAD prepare 新批次。
- 本轮未部署、未更新 R2；本地入口保留供复核。
