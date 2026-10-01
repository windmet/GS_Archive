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

用户明确要求移除人物首页的「打开资料馆」文字 CTA，本轮遵从。下附原指导的新增 CTA 建议已被用户覆盖，不得重新加回。启动时有明确选择页，普通首页仍通过既有电脑导航和手机底栏进入资料馆。

## 本批测试

`npm run build:check`：2697 modules，10.96s，入口 gzip 约 130.22 kB；不复制 public。生产 bundle 在 5213，绑定当前本地 public 与 `song-gameplay-readmodels-20261001` 的 release `17e0ab0b227d6f2bb433f0c1cfaf3934fcccbc2cd420387adc95af9fc4c7a907`。

通过：archive-routes、portal-navigation、story-localization-runtime、archive-async-navigation、reading-navigation、archive-navigation-state、event-readmodel-navigation、archive-startup-preferences、story-presentation、archive-general-texts。语言回归同时验证缺译文/失效 source_hash 保持原文，以及语言交接不覆盖 P 名字、自动播放和音量。

更新两个已过期路由断言：活动详情返回活动目录，活动域 section 为 events；门户当前已有 12 个正式入口，不再断言旧的 8 个。真实路由和分类未为满足旧断言而回退。

扩大运行 `verify-story-player-ui-pr2.mjs` 时仍遇到既有失败：第 93 行期望没有 RAW group-thread 证据的 unit-coded speaker 使用 Jupiter 主题，而当前已提交通信投影把无群聊证据的个人通信主题设为 null。继续核对还发现旧的电话背景 CSS source assertion 不匹配。该脚本未记为通过，也未更改通信分类或美术适配来迎合旧断言；需单独核对该历史验证脚本与现在的 RAW thread 合同。当前批的语言交接和缺译文实测已通过。

截图 `.analysis/ux-productization-20261001/55`～`59`：桌面 Reader→Player 中文、320px 语言入口、390px 缺译文电话、手机确认栏、门户文字按钮。未建立 clean-cache 环境，未报告 FCP/LCP 性能；没有声称本地 Browser 是真机或线上发布验收。

## 资源与上线边界

2026-10-02 实时 R2 清单：98917 对象，6633752018 B，含现存旧对象；清单保存在 `.analysis/archive-general-localization/r2-live-inventory.json`。这只是当前值，尚不是新增资源后总量。新增图片必须使用既有 lossless WebP + 透明像素 RGB 清理，不改逻辑 PNG 请求路径。全部新增、覆盖差额与版本化数据计入后，实际预计桶大小必须严格 `< 8600000000 B`，才能按用户授权上传及部署测试页。不能用旧 manifest 大小代替实时清单，不能删旧对象以获得未经批准的空间。

当前尚未完成本轮 R2 上传与 Pages 测试部署；后续将把真实转换体积、上传回执、测试页 URL 和线上浏览器结果补在这里。音乐/谱面源码按用户最新要求冻结。
