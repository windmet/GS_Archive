# 偶像详情展示只接收身份匹配的叶子（2026-09-27）

输入：`codex/gs-architecture-rebuild`，HEAD `3e0fbea`。详情的资料、统计、歌曲和活动投影改为只接收当前偶像 ID 的 Read Model 叶子；叶子未到时详情主体留空并显示已有读取状态，避免旧全量仓库资料兜底或前一位偶像的内容短暂混入。歌曲、活动返回偶像详情时用有效偶像 ID 判定返回目标，交给已有监听补取叶子。移除旧通信状态的组件接线与不可达的重试提示；叶子中确实未知的通信统计显示“尚未确认”。

`verify:archive-async-navigation` 新增生产投影测试，覆盖身份匹配与切换期间的空投影；`verify:idol-page` 验证旧资料转换器本身的固定数据结果。`verify:archive-navigation-state` 已通过。

`verify:cutover-routes`、`build:check` 与 `verify:build-audit` 通过；生产代码构建复用 `.analysis/build-check`，未复制 public 媒体。Browser 使用 `127.0.0.1:5186` 的生产代码、当前 public 与 r22 Read Model 映射，旧全量 `/data/` 来源被阻断。刷新冬馬详情后显示档案、20 条聊天和 9 条电话；点入《BRAND NEW FIELD》并返回、点入《GROWING SIGN@L -Inner Dignity-》并返回，均回到冬馬详情；切换下一位后显示御手洗翔太资料。检查时无 console error。本地代表旅程无法替代真机或发布验收；全局旧仓库仍在其他路由的生产依赖中。
