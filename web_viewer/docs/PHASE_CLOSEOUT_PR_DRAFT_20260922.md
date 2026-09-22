# PR 草稿：收口资料馆、剧情运行时与移动端交互

目标分支：`master`。来源分支：`codex/mobile-story-immersive`。建议使用普通 merge commit，保留发布与来源记录的提交 ancestry。

自稳定基线 `58098c2` 后，资料馆加入更完整的目录、关联导航与 Reader，剧情播放器修复资源准备、取消返回、时钟和演出状态等边界；通信场景、歌曲/卡片播放和移动门户也完成多轮可用性修复。手机完整剧情新增可选横屏入口，独立电话保持原样式。

该 PR 包含稳定分支以来整阶段的解析、发布记录、运行时、UI 和 Preview 路由变更，不只是最后一个横屏提交。About、缩略图、永久缓存与关卡功能不纳入。

验证状态与剩余条件以 [阶段收口记录](PHASE_CLOSEOUT_20260922.md) 为准。`build:check`、publication ledger、Reader / 资料展示 SSR、projector / shadow 以及三项资源清单校验已通过。当前仅 archive-assets 本地 HTTP 门禁仍出现请求超时；当前提交的 Pages Preview 桌面/移动端验收尚未执行，因此草稿不具备合并条件。历史 Browser 证据与本轮 source gate 分开记录，不能以本地编译替代部署和媒体验收。

容量约束：本轮收口准备未写入 R2，未增加派生图或更改资源 key。后续代码 Preview 应复用已有桶资源，缺失对象不得自动补传。现存 Pixi/Spine warning、真机方向锁和长音频验收按记录保留边界。

此文件是本地正文草稿，尚未向 GitHub 创建 PR，也未合并或部署。
