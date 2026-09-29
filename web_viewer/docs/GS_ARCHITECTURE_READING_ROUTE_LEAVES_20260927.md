# 故事页 Reading 目录局部投影验收（2026-09-27）

本批从 `957451f` 开始。生产者提交 `51f7eb3`；候选数据目录为 `E:\GS_readmodels_candidate_20260927_r22`，release `23493f6b8994a51851cae7b8e0fd0b265a04c303e80d1e41ee86f85be638912c`。

## 改动

- 故事详情、故事合集、活动详情、工作档案和个人故事的数据叶子附带其文件对应的 Reading manifest 条目。故事详情还包含以该故事文件为父文件的分段。
- 这五类页面直接使用当前叶子的条目显示阅读入口，移除进入页面时下载全站 Reading manifest 的监听。条目保持源 manifest 的顺序与 `ready` 状态；未匹配的文件仍不显示阅读按钮。
- Reader 本身继续按文档 ID 读取定位记录并校验正文哈希。未知文档 ID 的旧 manifest 查询仅用于辨别“未生成”与当前 release 缺件。

## 验证

- `readmodels` 的 `npm test`：34/34 通过。其中真实语料测试逐项比较五类路由叶子的条目与原 manifest 的文件、父文件匹配结果及顺序。
- r22 产物校验：8,419 文件，bootstrap 13,610 字节。
- `npm run verify:archive-async-navigation`、Reading repository/navigation/playback 回归及 `npm run build:check`：通过。构建仅编译源码，没有复制 public 媒体语料。
- Codex Browser 使用本地 r22 候选及源码构建，在 `127.0.0.1:5182` 验收。该服务固定将 `/data/reading/manifest.json` 返回 503。组合前传合集、主线故事详情、活动详情、工作档案、个人故事的直达页均显示对应阅读入口；合集和个人故事打开了真实正文，合集 Reader 返回原合集页。个人故事 Reader 的窄视口画面可读，Browser 错误日志为空。

## 边界

这是本地候选数据与 Browser 的指定旅程验收。它不证明每个故事文件、真实设备、完整媒体包或生产部署。按需模块加载及最终发布验证仍未完成。
