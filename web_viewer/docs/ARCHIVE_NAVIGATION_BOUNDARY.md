# 导航状态边界

2026-09-08，重构 F2。`src/core/useArchiveNavigationState.js` 现在拥有原 App 中
39 个 URL/返回上下文 ref，以及 `currentArchiveRoute()` 投影。App 解构的是原 ref，
不是值快照；模板、computed、watcher 和现有导航动作仍读写同一份状态。
每次调用创建独立实例，无全局缓存、window 访问或额外 history listener。

导航状态涵盖当前 view、选中实体/分组、检索过滤、首页选择、播放器文件/起止范围、
return/parent 上下文。currentGroup/currentUnit 保存选中的上下文对象引用，模块不
加载这些对象。完整剧情 payload、播放队列、音频、loading/preloadProgress 与资源
索引不归该模块；它也不决定数据缺失时应该退回哪个产品页面。

投影保留既有规则：player 只在匹配的 returnView 下携带 event/story/collection
上下文；song_detail 或歌曲下的 collection 保留歌曲身份；unit 返回上下文优先
archive unit；非播放器不输出 scenario/voice/start/end；非首页不输出首页选择。
既有过滤参数保留方式未改，不能把此提取当作 URL 清理或 query 语义调整。

`archiveRoute.js` 继续拥有 query 编解码和浏览器 history API；App 暂时仍负责
applyArchiveRoute、数据依赖等待、commitView/sync、popstate 安装/释放及播放器加载。
F2 没有引入第二份 route store，也没有声称修复异步导航覆盖问题。

## 验证

`npm run verify:archive-navigation-state` 使用冻结自 `59c906e` 的测试专用旧投影，
对 28 个视图 × 8 个 returnView × 8 个 parentView（1,792 组）逐属性和 URL 对照；
同时验证 39 个 ref 的实例隔离、初始化值、player/非 player 字段、歌曲 collection
和 event→unit 返回规则。旧投影只在 fixture 使用，不被产品代码导入。

routes、song-domain-landing、story-collections、main-story-domain-landing、
idol-story-interface 与 source-only Vite 构建通过；歌曲测试已由检查 App 内的
投影源码改为调用实际导航模块。CI 已加入新导航验证。

内置浏览器桌面执行：直接打开 C.FIRST collection → 点击歌曲 → 浏览器后退。
collection 参数、4 章/40 段和截图均恢复，无 error。此为一次真实历史恢复冒烟，
不是所有视图、快速连续后退、慢网络或完整响应式矩阵验证。

## 后续

继续把异步路由恢复和功能打开动作从 App 的共享布尔开关中分离，先验证并发
restore、慢剧情加载、用户中途切页的时序，再调整生命周期 owner；不能仅凭这批
投影 parity 推定异步路径正确。其他 feature 的数据派生与展示组合仍留在 App。
