# 阶段性收口准备（2026-09-22）

## 基线与范围

本次输入 HEAD 为 `38f8c4b`，工作分支 `codex/mobile-story-immersive`。实时查询并 fetch 后，远端 `master` 为 `58098c280a209e30d7b35c176ae5a5ab4eb3ee81`，也是 merge-base；当前没有开放 PR。输入分支领先 255 个提交，差异涉及 3560 个文件。因此待收口的是自稳定基线以来的整阶段工作，不应把 PR 命名为仅修复横屏或图片加载。

本次只准备合并范围、验证结果和 PR 正文，不创建或合并 PR、不触发部署。后续建议普通 merge commit 合入 `master`，保留 publication/provenance 的提交历史。About、图片 delivery 与关卡功能应从届时最新稳定分支分别开展。

主要变更域：

- 数据解析、权威剧情发布及来源记录。
- 资料馆分类、目录、关联导航、Reader 与译文回退恢复。
- 剧情时钟、资源加载/取消、演出状态及播放交互修复。
- 通信内容阅读、舞台暂停和原电话视觉恢复。
- 歌曲/卡片媒体控制、移动门户与可选横屏沉浸。
- 已有 Pages / R2 Preview 路由及无损 WebP 部署映射。

## 审阅建议取舍

| 建议 | 决定与依据 |
| --- | --- |
| 当前工作收口到 master | 采纳阶段性收口方向；先通过完整门禁并核对确切 Preview SHA，不能直接宣布可合并 |
| 保留 merge ancestry | 采纳；不 squash、不 rebase 整阶段历史 |
| About 页面 | 后续独立小批次，本轮不追加页面或作者/联系信息 |
| 图片 lazy / async / 尺寸 | 本地确实缺少部分标记，但属于下一轮有 Browser 与请求测量的代码优化；不为收口追加未经验证的改动 |
| 缩略图、srcset、AVIF、Cloudflare Images | 本轮不做，不生成、不上传任何派生资源；不能用“单张更小”推断桶总占用会下降 |
| 永久缓存 | 不采纳当前直接套用方案。`functions/_shared/r2-resource.js` 明确返回 `public, max-age=3600`，不能按 Pages 静态文件默认头推断现状。现有同名资源不改为 immutable |
| 初始列表 80 改 24–30 | 保留 80；先在独立性能批次测量请求、布局与滚动恢复再决定 |
| Pages 最终验收 | 必需，但没有已核验且对应当前 HEAD 的部署 URL；历史未跟踪交接中的分支/部署状态不是当前验收证据 |

## R2 零写入边界

本次没有调用 R2 上传、删除、同步或转换脚本，没有生成缩略图，没有修改对象 key、缓存头或资源清单。R2 新增对象与新增上传字节均为 0；这不是账户当前占用测量，也不推断尚有多少免费余额。

只执行 `build:check`，固定输出 `.analysis/build-check`，不复制 public。源码里的 `build:preview` 也明确使用 `copyPublicDir:false`，但本轮没有执行发布。未来 Preview 代码更新应复用既有资源；缺失资源必须作为验收缺口记录，不能为了通过验收自动补传。不要执行 `rclone sync`，也不为省空间删除原始本地资源。

## 本批修复

按实际 `git diff --check master...HEAD` 结果清理 17 个文件的尾随空白/EOF 空行。忽略空白后的 diff 为空，未修改运行逻辑。清理后对稳定基线的工作树 diff 检查通过。无关未跟踪 `.analysis`、历史交接及 v9 HTML 保留。

## 验收与合并前条件

本轮构建通过，仍有既有大 chunk 提示；它是代码构建，不是媒体发布包。CI 工作流中的 verifier 按顺序本地复跑，命令/退出码及日志保存在 `.analysis/closeout-gates.json`、`.analysis/closeout-gate-*.log`。最终汇总见本文件后续结果段。

本轮无 UI 行为改动，不把 9 月 20 日的 Browser 记录冒充本轮新验收。此前交互证据见 [UI 产品化](UI_PRODUCTIZATION_AUDIT_20260920.md)、[通信阅读](COMMUNICATION_READING_CLOSEOUT_20260920.md)、[横屏观看](MOBILE_STORY_IMMERSIVE_20260920.md)。

合并前需：所有 source gate 成功；确认 Preview 实际部署 SHA；在该 Preview 完成桌面/移动端目录、Reader 往返、剧情推进与混合通信、歌曲播放的抽查；真机横屏方向锁仍单独验收。原有 Pixi/Spine warning 与长音频 soak 未因本次收口自动解决。

## 本轮最终结果：准备完成，尚不可合并

已跑完 CI 工作流中 80 条单行 verifier 命令，另执行带 master 基线的 publication ledger 与 immersive 校验，共 82 条命令。首轮 73 通过、9 失败；修正两个测试夹具并单独复跑后通过，目前为 75 通过、7 失败。命令内部的 `&&` 遇错会停止，不能把后续子检查当作已运行。尚未触发远端 CI。

已修复的夹具：

- interaction matrix 增加 `viewingOfferOpen` 上下文，并断言推荐弹窗不能推进背后的剧情。
- title transition 补齐当前 viewer 的依赖，等待真实 runtime 的异步 scene/audio readiness 再测试 settlement；保留原有生命周期断言，补充弹窗阻止标题结束推进的断言。

剩余失败及下一步：

| 门禁 | 本轮实际结果 | 收口条件 |
| --- | --- | --- |
| `verify:reading` | MobileStamp scoped CSS 的 Vite SSR transport 60000ms 超时；前置阅读合同通过 | 独立定位 SSR 测试环境；不可删掉 render 断言或以 build 代替 |
| `verify:archive-presentation` | ArchiveSongDetail 依赖的 SSR 模块读取超时 | 同上；不称 Browser/UI 出现同一故障 |
| `verify:story-projector` | camera Y 比较 `-280 != -350`；CameraController 已用正向 offset_y，纯 projector 仍用减号 | 核对既有镜头坐标合同，修正诊断模型并跑 projector/shadow，不能直接改实际人物取景来迎合旧期望 |
| `verify:archive-assets` | `listen EACCES 127.0.0.1:5173` | 找可用本地测试端口并验证 HTTP 合同；不改防火墙或停止其他工程 |
| `verify:archive-baseline:source-only` | `tracked_binaries drifted` | 与下面 inventory 一起审查实际 tracked 文件差异 |
| `verify:tracked-binary-inventory` | Git-tracked PNG 集合或文件内容与记录不同 | 先核对差异来源，再更新证据；不能盲目重生成清单将漂移合法化 |
| `verify:image-bundle-relation-catalog -- --source-only` | stable promotion 预期 53、实际 52；event_story_visual 缺少 registry 中的 `003hok` 条目 | 审查 registry / relation 的本地证据差异；不推断 R2 缺对象、不自动补传 |

发布账本通过：3 releases / 2 stable logical IDs，基线参数为完整 master SHA。Runtime schema 本地检查覆盖 10417 scenarios / 316682 snapshots / 177050 cues。`build:check` 成功，public 未复制。日志为本地小型文本证据，不提交媒体包。

本次不把剩余问题扩展成无界的运行时/图片管线改造，也不发布一份声称“验收全绿”的 PR。后续优先处理上述门禁，再进行确切 Preview 的桌面/移动端验收；About 和性能功能继续后置。

## 继续收口：SSR 与投影（同日）

以下结果覆盖上表相应失败，目前剩余 4 项门禁未解决。

- `verify:reading` 完整复跑通过；`verify:archive-presentation` 通过。两个 SSR 测试使用相同的 Vue SFC 插件，改为不加载包含外部资源服务的完整 Vite 配置、禁用文件监听的独立 middleware 测试环境。所有原渲染断言保留；资源路由继续由独立 HTTP 门禁覆盖，不将 SSR 通过当作媒体可用性证据。
- `verify:story-projector` 的 pure projector 与 shadow 两部分通过。纯投影模型 camera Y 与已存在的 CameraController 正向 offset_y 合同对齐；实际镜头控制器及人物取景未改。shadow 夹具现在等待真实异步 scene/audio readiness，再断言只读投影和 restore 状态。
- `build:check` 再次通过，仍不复制 public。此次未改渲染 UI，不新增 Browser 视觉验收结论。
- HTTP 测试尝试 Node 动态端口加 Vite middleware 后越过了 5173 绑定问题，但不同 fixture 请求出现超时，尚未证明稳定。因此该实验改动已撤回，`verify:archive-assets` 仍保留为未通过，不修改断言掩盖问题。
- inventory 差异已定位为既有 `8170f9a` 提交中的 `public/assets/brand/image_chara_icon_producer.png`（5297 bytes，SHA-256 `1d0eefc4bb59cceea0de76048b03389a42e4fc210f810d25b5d9849ce8921fd9`）未进入记录；本轮尚未改其分类或生成新清单。baseline、inventory、image relation 三项仍待证据修复。

R2 仍零写入。合并前条件未变，不能将本批通过的三项推广为完整验收完成。

## 继续收口：清单证据对齐（同日）

三项清单门禁现已通过，目前只剩本机 HTTP 门禁及最终部署验收。

- 制作人头像来自 `8170f9a`，本地字节与 Git blob 一致，5297 bytes / 上节 SHA-256。按现有 brand 分类补入 inventory；只增加记录，不增加 PNG 文件。inventory 为 186 PNG / 49389439 bytes，验证通过。
- 北斗活动立绘及其权威 registry 来自 `cf0b399`。本地 237759 bytes 与 registry 的 SHA-256 一致；将已有 registry 的 `003hok` promotion 同步到 image bundle relation。1271 bundles / 7816 image objects 的 source-only 校验通过。
- baseline 只刷新 tracked PNG 数量/字节数；保留历史 RAW/compiled 统计快照，未用本地全库扫描值覆盖历史指标。source-only baseline 校验通过。
- HTTP 门禁发现 Vite 6 的 `listen` 实现会将 `port:0` 回退到默认端口，改由 Node 选择可用端口；增加请求期限及失败 URL，避免无限等待。仍保留全部 MIME、正文、优先级与路径安全断言。
- 动态端口服务可启动，但在本机不同资源请求上出现超时。测试过 fetch/Node HTTP、IPv4/IPv6；临时服务日志显示先前请求文件流正常结束，后续超时请求未进入资源中间件。证据不足以认定具体网络/环境原因。客户端/IPv6/生产配置日志实验均撤回，门禁仍标记未通过。

未创建 PR 或部署；仍需对应当前 SHA 的 Preview URL 才能作远端只读验收。没有调用 R2 写操作、转换或上传，也没有重新打包媒体库。三份 JSON 的修订不代表已更新远端 R2 中的数据副本。

## 干净 Linux 环境交叉验证

对 `71de10a` 手动触发仅源码检查/构建的 [GitHub Source Gate](https://github.com/windmet/GS_Archive/actions/runs/35702300274)，没有部署或 R2 步骤。该运行在 scenario-package 处失败，尚未运行到 HTTP 门禁，因此不作为 HTTP 通过证据。

定位结果：冻结基准的 step9-missing-target-timing-raw.json 按 CRLF 源字节计算 provenance，另外三份 timing fixture 按 LF。对各文件分别计算 LF / CRLF 版本，只有上述组合匹配全部原始单文件 golden hash。新增四条精确 `.gitattributes` 规则固定基准输入的检出换行，不修改 golden hash、不改变编译器或发布语料。本地 scenario-package 全部通过，远端需重跑。

更正前节 HTTP 定位边界：更完整的中间件跟踪显示超时请求也可能已经进入资源处理器，不能据先前截断日志断言“未进入中间件”。纯 Node HTTP 服务 30 次请求正常；Vite 资源请求的具体超时原因仍未确定。诊断用中间件日志和夹具位置实验均已撤回。
