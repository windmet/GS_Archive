# 目录图片加载 P1（2026-09-23）

分支 `codex/archive-image-loading-p1` 从 `codex/mobile-story-immersive@bd1d6ab` 创建，保留已验收的 61329ca 代码及其收口文档；master 仍为 58098c2，未从旧 master 重新开发。

## 取舍与实现

- 活动检索首两张 banner eager，只有第一张 high；其余 lazy/async。奖励头像 lazy/async/low。36 项、原 80 条列表上限、焦点/返回标记不变。
- 故事门户主线图保持 eager，只有第一张 high；活动前三张 eager，其余 lazy，不再把活动第一张也设 high，避免同屏重复提升优先级。组合前传全 lazy/async。
- Extra 首排保留 eager，后续及补充记录 lazy。固定 104×58 容器已预留布局空间，不猜测额外素材尺寸。
- 卡片、卡池、歌曲列表保留已有 lazy，只补 async；卡池与歌曲补真实尺寸。卡片列表已有固定方形尺寸及移动 grid 的 aspect-ratio，不为重复声明而改它。
- sharp 只读 metadata：36 个活动 banner / 61 个卡池图都是 940×510（不是评估中的 293×159），主线入口两张为 1456×553，16 个组合图为 446×150，61 张歌曲封面为 365×360。保留既有 contain/cover 显示策略。
- 实际 Browser 发现 HTML height 会影响门户活动图的 CSS aspect-ratio，已补 height:auto，复验约 365×198，防止固定 510px 高度撑开布局。
- 本轮不采用缩略图、srcset、图片转换、缓存改造、IntersectionObserver 或 content-visibility：原生 lazy 已证明能推迟屏外加载，尚无证据需要增加这些复杂度。播放器 preload / AssetPlan 不受影响。
- 不新增只匹配模板字符串的性能 verifier；属性存在不能证明网络收益，沿用资料展示 SSR、导航/滚动恢复合同及实际 Browser。冷加载传输和 LCP 仍需具有 Network/Performance 能力的环境测量，不能用静态属性断言替代。

## 实测与边界

Browser 插件可用；固定基线 https://da322c61.gs-archive-preview.pages.dev ，新代码为本地 build:check 产物 http://127.0.0.1:5176 。只读 QA 服务引用现有 public，没有复制媒体库。Vite 5175 首次导航超时、随后停留在读取数据；使用静态构建绕过本机中间件，不据此断言生产存在同样问题。

| 检查 | 结果 |
| --- | --- |
| 1440×900 活动首访、未滚动 | 基线 138/138 图完成；新代码首次观测 114/138，末项四图未加载 |
| 390×844 活动首访、未滚动 | 基线 138/138；新代码 17/138，首屏 banner 正常 |
| 移动连续向下滚动 | 36 张 banner 全部完成，0 broken banner；隐藏奖励头像无需为了计数加载 |
| 详情往返 | 末项運命光年打开详情后返回，scrollTop=3300.229，focus=event:1_3_30018_01.json 保持 |
| 搜索 | Not Alone 返回 1 项；首图仍 eager、高优先级只有一张 |
| 视觉与其他目录 | 桌面/移动无空白或框架覆盖层，活动图比例已校正；卡池约 176×95、歌曲封面原 46×46 展示策略保持，卡片目录正常打开 |
| 控制台 | 本地目录抽查 error/warn 为空 |
| 回归 | verify:archive-presentation、verify:archive-navigation-state、build:check、git diff --check 通过；构建保留既有大 chunk 提示 |

这里记录的是 DOM complete + naturalWidth 的已加载/解码图片数，**不是网络请求计数**。当前 Browser 只读接口不开放 performance.getEntriesByType 或禁用缓存控制；没有传输字节、cold-cache LCP 或网络限速结果。基线为线上 WebP，新代码本地引用 PNG，不比较跨环境耗时/字节。复访可复用解码缓存，曾再次观测到桌面 138/138；不能把首访差值包装为固定节省比例。尚未部署新分支 Preview，不把本地验收称为远端发布验收。

## 容量与交付

相对 61329ca 的 public/assets、public/data、shared/deploy、functions、scripts/export-preview-assets.mjs 差异为空。本轮 0 R2 写操作、0 新媒体、0 删除，R2 +0 B；没有更改 bucket、object key 或缓存策略。无 PR 创建/合并，保留原阶段历史。

## 完整 Source Gate

[GitHub Web Viewer Source Gate #35797236545](https://github.com/windmet/GS_Archive/actions/runs/35797236545) 对代码提交 `5b348bc` 的 Linux 全套检查已成功，包括资源 HTTP 合同及 production build。后续文档提交只记录结果，不改变通过验证的代码。补充 Browser：Extra 图区域仍约 104×58；390px 故事入口活动图约 272×148，比例正确，控制台 error/warn 为空。
