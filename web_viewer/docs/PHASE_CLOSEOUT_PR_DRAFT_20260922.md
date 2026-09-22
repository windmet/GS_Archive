# PR 草稿：收口资料馆、剧情运行时与移动端交互

目标分支：`master`。来源分支：`codex/mobile-story-immersive`。建议使用普通 merge commit，保留发布与来源记录的提交 ancestry。

自稳定基线 `58098c2` 后，资料馆加入更完整的目录、关联导航与 Reader，剧情播放器修复资源准备、取消返回、时钟和演出状态等边界；通信场景、歌曲/卡片播放和移动门户也完成多轮可用性修复。手机完整剧情新增可选横屏入口，独立电话保持原样式。

该 PR 包含稳定分支以来整阶段的解析、发布记录、运行时、UI 和 Preview 路由变更，不只是最后一个横屏提交。About、缩略图、永久缓存与关卡功能不纳入。

验证状态以 [阶段收口记录](PHASE_CLOSEOUT_20260922.md) 的 2026-09-23 Preview 验收节为准。[第三轮 Linux Source Gate](https://github.com/windmet/GS_Archive/actions/runs/35703330087) 全部通过，包括 shared archive asset HTTP contract 与 production build。此前 Windows HTTP timeout 保留为环境记录，不再阻塞本轮 Preview。

实际验收部署为 [da322c61 Preview](https://da322c61.gs-archive-preview.pages.dev)，部署记录的 commit SHA 精确为 `61329ca1a290c975ac259857fafd4d695a3e11df`。`verify:preview-http` 通过；Browser 抽查覆盖故事目录 / 36 项活动检索、Reader 往返、剧情推进、混合电话与聊天回复、歌曲播放 / seek、移动页面、横屏入口和深链接刷新 / 返回。后续收口文档提交不改变这份已验收部署的 SHA。

容量约束：核对差异、远端既有 key、备份和 dry-run 后，仅覆盖 `data/archive_baseline_report.json` 与 `data/image_bundle_relation_catalog.json`；回读及 Preview HTTP 字节校验一致。0 图片新增、0 删除，存储净减少 203425 bytes。未全量上传、重编码或运行 sync。Pages 使用 `npm run build:preview` / `copyPublicDir:false`，Preview 绑定 `ARCHIVE_ASSETS -> sidem-archive-preview`。master 自动 production deployment 仍关闭，未绑定 production custom domain。

验收限于上述浏览器旅程和 HTTP 样本，并非全库网络抓包或所有剧情回归。真机方向锁、浏览器地址栏行为、长音频 / 长稳和既有 Pixi/Spine warning 仍保留边界；内嵌浏览器全屏叠加模拟尺寸的外侧黑边不作为真机适配通过证据。About、lazy loading、thumbnail、srcset、Cloudflare Images、cache-policy 重构均未追加。

此文件是本地正文草稿，已完成指定 Preview 验收，尚未向 GitHub 创建 PR，也未合并。准备以普通 merge commit 合入 master，不 squash / rebase 整阶段历史。
