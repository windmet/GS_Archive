# 桌面门户、导航与首页语言验收

输入 HEAD：`ad95f8537161008424328a38373872dc31061959`。本批只提交门户、导航和首页语言；摄影组件及资源审计另批处理。

## 实现

- 桌面门户采用担当卡片、歌曲舞台、故事和活动内容看板。删除原右侧历程／工具链接树和重复的大目录块，收录量合为一条横栏。
- 正式目录提供 826 张卡片、1,394 个故事条目、60 首歌曲、49 位偶像；16 个组合从正式偶像目录的 `unitCode` 去重得到。没有添加人气、最新、历史上的今天等无依据标签。
- 担当卡片优先 SSR，不足以 SR、R、N 补齐。实际能力标志决定素材，优先竖图；全部使用固定 4:5 画幅和 `contain`，不拉伸、不裁切。
- 歌曲优先真实成员／组合关联，舞台目标来自现有时间轴 manifest 的确切条目。故事按真实登场角色／组合关联，活动按担当详情中的真实活动身份关联。活动大图只使用已有资源图谱的身份校验结果。
- 四域搜索覆盖偶像、卡片、歌曲、故事，支持已接入的中文名、原文、组合和成员检索。每类最多展示六项，总匹配数保留。typed target 在 App 入口再次核对目录；异步请求离开页面后不提交。
- 桌面侧栏收为首页、偶像图鉴、运营年表、视听工坊和资料馆总览；二级入口点击展开，活动页自动展开相应业务域。手机保留紧凑门户。
- 首页语言组件放进台词操作区；台词、语音和场景行为沿用现有实现。

## 验证

代码构建使用 `npm run build:check`，最终本批编译 11.85 秒，无 public 语料复制。生产代码固定在 RAM，QA 端口 `5205`、PID `27280`；保留另一个窗口的 `5204` 服务。证据目录：`.analysis/ui-desktop-portal-20261003/`。

本地 QA 使用已验证的材料候选目录 `card-material-preview-readmodels-20261003`，release `0b0612426eeb7090b52aacc59a09fd6c580646827a5e5a194cf0e9c9d3b44c0b`。这是显式 QA bootstrap 替换，尚不是远端发布。

通过：

- `node scripts/verify-archive-portal-presentation.mjs --read-model-root E:/Web_build/GS_Archive_Domain_Work/song-discovery-readmodels-20261002 --read-model-root E:/Web_build/GS_Archive_Domain_Work/card-material-preview-readmodels-20261003`：完整两套目录、正式身份、SHA/envelope、空值与零值、实际图片能力、关联、真实舞台条目、搜索与中文／日文回调。
- `node scripts/verify-archive-home.mjs`、`node scripts/verify-archive-routes.mjs`。
- 实际 Vue 生命周期和 ReadModelClient 行为回归：手机首屏不拉桌面资料、担当快速切换不串统计、搜索等待态、离开取消、返回恢复、完整搜索语料复用。
- 实际 App handler VM：真实偶像、活动、舞台身份和 Portal 来源；假身份、脚本错配和加载中离开均拒绝。

实际 Browser：

| 旅程 | 结果 |
| --- | --- |
| 樱庭薰 + `windmet` | 显示 `windmetP`；17 卡片／5 个人故事／19 聊天／4 电话，与正式详情一致 |
| 1280×720 | 页面根尺寸恰为视口；头像约 42×42；三张竖图均约 144×180；两 SSR 加一 SR，全部实际加载成功 |
| 1920×900 | 约 2:1 担当／歌曲双栏，下方故事／活动；无重复链接树，实际活动大图加载成功 |
| 780×900 | 窄桌面降为单栏，三卡均约 120×150，无横向溢出 |
| 320×740 | 原紧凑门户，11 个入口；无横向溢出，头像保持正圆，工作台弹窗在视口内 |
| 工作台关闭 | Escape 关闭并恢复到编辑按钮 |
| 搜索 `Jupiter` | 10 条实际匹配；歌曲、偶像、故事分别进入正式身份详情并返回 Portal |
| 担当卡片、活动 | `005kao_ssr01` 与 `410013` 实际详情加载，返回保留 Portal 来源 |
| 歌曲舞台 | `strclb` → `strclb_live_effect`；实际 Canvas 载入，返回 Portal |
| 封面 503 | 单张图片显示独立重试，三画幅仍等高；恢复服务器后点击重试实际图片成功 |
| 首页语言 | 可见语言组件仅在 `dialogue-actions`，切换按钮正常响应，根页面无溢出 |

截图：`portal-1280.png`、`portal-1920.png`、`portal-320.png`、`home-desktop-language.png`。具体代码指纹和 HTTP 字节证据见同目录 `build-input.json`、`pinned-code.json`、`http-requests.jsonl`。

## 边界

没有真机验收，没有远端发布或媒体全库打包。首页缺少译文时继续显示原文，语言按钮位置验收不代表全部台词已有译文。现有 loading-copy 验证器对基线已有的 `!pickerPreparing` 条件使用旧文本断言，本批没有改该无关逻辑，也未将其记为通过。
