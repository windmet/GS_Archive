# UX 审计修复验收更新（2026-10-02）

本更新以 `35d551dd` 为本批输入 HEAD，覆盖后续用户调整。下附 584c837 指导原文是历史参考；与最新用户要求冲突时，以本更新为准。

## 当前结论

| 指导项 | 当前实现和证据 | 状态 |
| --- | --- | --- |
| P0-A 普通流程开发语言 | Reader 入口为「播放完整剧情」；摄影动作/表情有源码标记对应中文键和可视缩略图；普通摄影目录隐藏资源键，展开来源保留。歌曲已于前批收纳并完成验收。 | 已修复；Chibi 衣装编号清理按用户音乐冻结范围保留待办 |
| P0-B 日期和 stamina | 使用源数据 sentinelCandidate；道具说明安全展示体力图标和中文描述，未知 token 不猜。实测截图 41。 | 已验收 |
| P0-C 首页与资料馆身份 | 手机底栏为首页/资料馆；首次启动显式选择页面、偶像和 P 名字，保存偏好后刷新不重复引导；P 名字复用 Reader 的替换逻辑。 | 已验收 |
| P1-A Reader → Player | 仅在播放交接时把 Reader 的日/中/双模式写入 PlayerPreferencesRepository；不让 Reader 切语言 tab 改全局。真实中文、双语、日文三次交接均通过。缺译文电话显示「中文 · 本段原文」或「中*」。 | 已验收 |
| P1-B 摄影方向和退出 | 竖屏默认不自动 CSS 旋转；全屏为显式动作；图层删除、恢复、锁定、隐藏、重排、缩放/旋转/吸附及保存链路见摄影批记录。 | 已验收；浏览器不替代真机方向锁 |
| P1-C 页面切换反馈 | 保留数据预备与导航 supersession；增加组件加载待机覆盖，延续到 nextTick；pending 位于内容中心，有轻背景，保留 140ms 延迟。门户→活动实际有加载状态和完整页面。 | 源码/相关回归及普通 Browser 导航通过；未完成清缓存性能测量 |
| P1-D 手机选择确认 | 固定空间的列表独立滚动，确认栏始终可见；390×844 搜索 C.FIRST、选择锐心后仍等待点击「打开通信档案」，点击后进入锐心通信页。 | 已验收，不再叠加第二套 sticky |
| P1-E 320px 语言入口 | 语言不再随 compact 隐藏；小屏显示日/中/双和缺译文星标，完整说明在 aria-label/title。进度在第二行，返回、语言、菜单互不遮挡。 | 320×740 实际验收 |
| P2 卡片全部偶像 | 选项与 App 空字符串校验同步修复；390×844 单人→全部、中文/原文搜索和打开详情均通过。 | 已验收 |
| P2 门户工具按钮 | 首页、壁纸、设置有常驻短文字和可访问说明。 | 已验收 |
| P2 共用标签漏接 | 壁纸选择器和门户署名接入同一卡名分片；首页背景名及差分按精确字段翻译后组合，中文/原文搜索均可用。 | 桌面、390×844、选择及刷新恢复已验收；未知原键保持原值 |

用户明确要求移除人物首页的「打开资料馆」文字 CTA，本轮遵从。下附原指导的新增 CTA 建议已被用户覆盖，不得重新加回。启动时有明确选择页，普通首页仍通过既有电脑导航和手机底栏进入资料馆。

## 本批测试

`npm run build:check`：2697 modules，10.96s，入口 gzip 约 130.22 kB；不复制 public。生产 bundle 在 5213，绑定当前本地 public 与 `song-gameplay-readmodels-20261001` 的 release `17e0ab0b227d6f2bb433f0c1cfaf3934fcccbc2cd420387adc95af9fc4c7a907`。

通过：archive-routes、portal-navigation、story-localization-runtime、archive-async-navigation、reading-navigation、archive-navigation-state、event-readmodel-navigation、archive-startup-preferences、story-presentation、archive-general-texts。语言回归同时验证缺译文/失效 source_hash 保持原文，以及语言交接不覆盖 P 名字、自动播放和音量。

更新两个已过期路由断言：活动详情返回活动目录，活动域 section 为 events；门户当前已有 12 个正式入口，不再断言旧的 8 个。真实路由和分类未为满足旧断言而回退。

扩大运行 `verify-story-player-ui-pr2.mjs` 时仍遇到既有失败：第 93 行期望没有 RAW group-thread 证据的 unit-coded speaker 使用 Jupiter 主题，而当前已提交通信投影把无群聊证据的个人通信主题设为 null。继续核对还发现旧的电话背景 CSS source assertion 不匹配。该脚本未记为通过，也未更改通信分类或美术适配来迎合旧断言；需单独核对该历史验证脚本与现在的 RAW thread 合同。当前批的语言交接和缺译文实测已通过。

截图 `.analysis/ux-productization-20261001/55`～`59`：桌面 Reader→Player 中文、320px 语言入口、390px 缺译文电话、手机确认栏、门户文字按钮。未建立 clean-cache 环境，未报告 FCP/LCP 性能；没有声称本地 Browser 是真机或线上发布验收。

## 资源与上线边界

2026-10-02 实时 R2 清单：98917 对象，6633752018 B，含现存旧对象；清单保存在 `.analysis/archive-general-localization/r2-live-inventory.json`。这只是当前值，尚不是新增资源后总量。新增图片必须使用既有 lossless WebP + 透明像素 RGB 清理，不改逻辑 PNG 请求路径。全部新增、覆盖差额与版本化数据计入后，实际预计桶大小必须严格 `< 8600000000 B`，才能按用户授权上传及部署测试页。不能用旧 manifest 大小代替实时清单，不能删旧对象以获得未经批准的空间。

本轮 R2 上传与 Pages 测试部署已完成，最终回执见下方。音乐/谱面源码按用户最新要求冻结。

## 后续补验与打包

`271e5dd1` 补齐壁纸中文署名和搜索；`523efe3a` 补齐首页背景差分。来源索引新增 39 个差分，共 5584 条草稿绑定；中文「电器街」和原文「電気街」均匹配昼/夕场景，390px 无横向溢出，选择傍晚后刷新仍保持相同 id。测试后恢复原背景偏好。截图 61～65。

已对 2511 个原始 PNG 的 WebP 结果逐项核验原尺寸及 RGBA，可见像素一致，部分透明像素保留；883 个壁纸衍生图通过无损格式检查。原始图片未覆盖。目标桶实际旧量 6633752018 B，本批净新增 776792536 B，上传前两次实时容量检查均通过。北京时间 03:56:56 上传完成，实际桶总量 **7410544554 B**，严格小于 8600000000 B。没有 sync/delete，旧对象仍计入总量。

固定测试分支的代码包以 `e0999ef1` 为来源：10306 文件、121066841 B，包含代码/readmodel、112 个跟踪的翻译 JSON、637 份既有工作文本回填；无全库媒体复制。最终 build-check 为 2697 modules / 11.59 s，sourceDirty=false。更多专名疑义、原名保留依据及来源边界见 `GS_ARCHIVE_METADATA_COMPLETE_20261002.md`；资源批次核算见 `GS_ARCHIVE_PRODUCTIZATION_RELEASE_20261002.md`。

## 线上测试结果

测试页：[275e46ff 固定版本](https://275e46ff.gs-archive-preview.pages.dev)，来源 `e0999ef1`，分支 `gs-architecture-device-test`。未部署 Production。

HTTP 字节、无损 WebP 类型、ETag/304、版本化 JSON/HEAD、gzip 解压来源 hash/406、语音 Range/206/416、翻译 JSON、404/405 全部通过。语音比较基准已改为此前部署的 voice64 实际文件和 hash，本轮没有改动语音。上传与 HTTP 回执保存在 `.deploy/productization-assets-lossless-20261002`。

真实 Browser：首次引导设置 windmet；随后再次打开根入口、刷新直接进入门户，名字保留。手机 390×844 中文/原文壁纸搜索均找到同两张卡面，实际缩略图可见、无横向溢出；选择后桌面刷新保留壁纸与中文署名。摄影中文地点→工作台，默认冬马删除与撤销、锁定和隐藏均生效，恢复后立绘及背景完整可见；动作秒、表情秒、语音试听均无入口，说明收纳在角落。截图 66～68 和 `online-browser-acceptance.json` 见 `.analysis/ux-productization-20261001`。

线上未捕获 error，保留一条 Spine 更新调用栈 warning。完整卡片/称号/Reader/Player 验证为前述本地 Browser 证据，不冒称已经逐页线上重复；真机方向锁、冷缓存性能、Chibi 冻结待办及历史 PR2 断言核对仍保留。98 项羁绊称号来源为用户补充，已明确担当 49 项 Lv.50、专属 49 项 Lv.100；其他未知称号继续来源未知。
