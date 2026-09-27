# Reader 文档定位投影验收（2026-09-27）

本批从 `0de6c3f` 开始。生产者提交 `5d95c3c`、`10c0070`；验收候选为 `E:\GS_readmodels_candidate_20260927_r21`，release `998fac8e8221527f7632e7420b13950f86e4ddea4f7c679ec376fc82c5a92ee2`。候选目录位于应用仓库外。

## 改动

- 将当前 Reading manifest 的 2,800 条记录投影为按 document ID 定位的实体。每条实体保留原始文档记录，以及同一 `logical_id` 的分段记录；不把正文行写进目录。
- Reader 直达和分段切换通过定位实体获取文档描述，再依照既有 SHA-256 合同读取正文。刷新会重新取定位实体。来源不存在时才查询旧 manifest 以区分“未生成”和当前 release 缺件。
- 故事、活动、工作等周边发现页目前仍读取全站 Reading manifest；此批不声称完成这些页面的目录切换。

## 验证

- `readmodels` 的 `npm test`：33/33 通过；r21 产物校验 8,419 文件，bootstrap 13,610 字节。
- `node scripts/verify-reading-repository.mjs`：通过，包含单文档缓存、来源哈希、定位分段及缺失状态。
- `node scripts/verify-reading-navigation.mjs`：通过，包含 Reader URL、返回和旧响应抑制。
- `npm run build:check`：通过。仅编译前端源码，未复制 public 媒体语料。
- Codex Browser 使用本地 r21 候选及生产源码构建，在 `127.0.0.1:5181` 直达 `reading=1_4_001_00_a` 显示正文，并切换至 `1_4_001_00_b`。该验收服务将 `/data/reading/manifest.json` 固定返回 503；两页仍可读取正文及对应分段选择。

## 边界

上述 Browser 结果证明该 Reader 旅程不依赖全站 manifest，不等于所有阅读入口、真实设备或生产部署验收。完整正文仍在用户打开文档后读取；旧页面的全站目录依赖、按需模块加载和最终发布验收属于后续批次。
