# R2 旧快照清理与 10-21 增量上传

本批仅处理 R2；Pages 部署、读模型绑定及线上 P1–P46 验收不属于本记录的完成声明。

## 输入与边界

- 工作树：`E:/Web_build/GS_Archive_Domain_Work/release-20261021/web_viewer`。
- 分支：`release/20261021-test-deploy`；输入 HEAD `a536a2e2ff588993b38456985e57706a02142211`。
- 用户授权处理给定的六个旧 `versions/<revision>/` 前缀及准备好的本批 R2 增量。
- 桶：`cloudflare:sidem-archive-preview`。清空代理环境变量，`NO_PROXY=*`；实测 rclone 对 Cloudflare 443 直连。
- manifest：`.deploy/release-20261021/manifest.json`，SHA-256 `7f82de33a9b99e3dcdb78944205b9450abb41c139587ebdb3082636f25b0c258`。
- 新 dataRevision：`d1486597756aaf5c609a8cfcf756af5473d048d23a0867d94b494aad510501d0`。
- 8,540 个源文件重新计算 SHA-256 全部匹配；上传工具还会复核 staged bytes、路径/转换合同和 gzip 往返。
- 既有图像验证绑定同一 manifest：1,532 张无损转换、49 张有损图，最低 PSNR 27.53（门槛 25）。本轮未重新执行像素验证。

## 删除依据

实时查询 Cloudflare Pages 项目 production/preview 环境和最近 150 个部署，最早到 `2026-10-14T15:48:41Z`。环境使用 `854190ad`（production）与 `fda1a54c`（preview）；所查部署未引用下列六个版本。这不能证明更早的历史部署链接仍可用：其数据前缀被删后会失效。

| 删除版本 | 对象数 | 字节 |
|---|---:|---:|
| `fef20b766a4a39b5fbf60d4778551add3d3fb3cf8362e4363c2dc740cc4b55b1` | 5,300 | 162,205,479 |
| `98825488c36c677bc849c6e02fcb1439dfb383bd89f26197233b5e36d7864aa4` | 4,986 | 150,351,690 |
| `13133316fe4668073ded3dabc06f754bdd83ac3d12c6dedf2158186b70ff78da` | 4,986 | 150,342,306 |
| `2dd2a6ea6d4b72cb40a0b7c7a7f7b33bf1ab0fa08a59104c9f542a4c414c4f65` | 4,984 | 150,070,078 |
| `879c3ea4e9a860fc5e819eece6c98c56c8f80b0640eb80df7ceacbfedea96436` | 4,979 | 149,383,169 |
| `c5ab806ee57778bc387322acfcf5211ecdf0521721a6df279dbe52a6e006e5b9` | 3,178 | 101,981,433 |
| 合计 | 28,413 | 864,334,155 |

先实时列出每个精确前缀，断言总数/字节与用户清单相同，再逐个 `rclone delete`，每个之后用 `rclone size --json` 验证为空。未使用桶级删除或 `sync`，未删除 versions 外对象。

## 本机证据

- `.analysis/release-20261021/pages-references.json`：只保存版本绑定，不保存认证信息。
- `.analysis/release-20261021/r2-cleanup-receipt.json`、`cleanup.log`：删除范围及逐前缀完成记录。
- `.deploy/release-20261021/upload-budget.json`、`upload-receipt.json`：最新占用预算和上传完成回执。
- `.deploy/release-20261021/remote-validation.json`：新快照全部对象大小、分组取样 SHA-256、保留版本统计。
- `.analysis/release-20261021/overlay-20261021.json`、`overlay-validation.json`：下一批显式传入的上传基线叠加描述符及合同验证。

未改应用源码；文档做内容、链接及 `git diff --check` 检查，不为记录文件执行应用构建。完整媒体包、Browser、HTTP/Pages 发布均需后续发布流程单独验证。

## 清单分类核对

| 对象分类 | 数量 | 新增字节 |
|---|---:|---:|
| 新 `versions/d1486597…/` 快照 JSON | 5,408 | 180,190,062 |
| 其他新数据 key（非版本化路径） | 115 | 5,854,030 |
| 新素材 key | 459 | 52,135,900 |
| 已有 key（1,865 素材 + 693 数据） | 2,558 | 19,903 |
| 合计 | 8,540 | 238,199,895 |

逐 key 与历史 inventory 比较，新 key 共 238,179,992 B；已有 key 净增 19,903 B，合计新增 **238,199,895 B**。原说明中“5,523 个新数据都在新快照下”和“所有同名覆盖字节完全相同”并不精确：前者含 115 个非版本化 key，后者包含有尺寸变化的 compiled gzip 数据。差异清单保存在 `.analysis/release-20261021/existing-size-changes.json`。容量仍以最新预算和上传后实测为准。


## 传输续跑

原上传工具完成第 1–5 组后，第 6 组小 JSON 受默认 4 transfers / 8 checkers 限制。核实 PID 和命令行后，仅停止本任务的第 6 组 rclone，原进程返回中断错误；该次不是完整上传。随后复用已验证 manifest、暂存文件、刚完成的全桶清单及预算，对第 6–7 组以 32 transfers / 32 checkers 继续 `rclone copy --checksum --metadata`，快照组保留 `--immutable`。没有扩大 key 集合、重新编码或删除对象。

续跑命令和各组成功状态记在 `.analysis/release-20261021/resume-receipt.json`；日志为 `resume-upload.log`。最终 `upload-receipt.json` 仅在两组都成功、实时账户占用检查通过且桶大小与预算完全相等后生成。

## 上传结果

- 删除完成：6 个前缀全部归零，释放 864,334,155 B。
- 清理后实时全桶清单：111,390 个对象 / 7,450,743,523 B。
- 上传完成：`2026-10-21T01:52:47Z`（北京时间 09:52）；8,540 个清单对象均已处理，checksum 复用匹配的旧对象。
- 上传后实际桶占用：**7,688,943,418 B**，与预算完全一致；8.6 GB 上限下剩余 **911,056,582 B**。
- 其他桶实时合计 444,588,701 B；账户实际合计 8,133,532,119 B；按工具保留 880 MB 其他使用额度计算的保守账户预算为 8,568,943,418 B。
- 7 类远端 MIME / content-encoding 元数据核对全部通过，详见 `.deploy/release-20261021/metadata-validation.json`。
- 新 overlay 已通过 `loadPreviewUploadedBaseline` 合同验证：seed + 历史父 overlay + 本次 overlay，总计 2 个 overlays，106,108 个已上传来源。

下一次生成增量清单时，显式传入 `.deploy/storage-compression/source-baseline.json` 所在的主 checkout seed，按顺序传入主 checkout `.analysis/release-20261004/uploaded-baseline.json` 和本 worktree `.analysis/release-20261021/overlay-20261021.json`，并指定 `--baseline-remote cloudflare:sidem-archive-preview`。完整绝对路径和绑定哈希在 manifest 的 `baseline_evidence` 与本次 descriptor 中。此链反映本次实际 manifest 的父证据；不要在中间擅自插入其他历史 overlay，下一次仍须使用新远端清单检查物理 key 是否存在。

## 远端验收与证据摘要

- 新 `versions/d1486597…/`：5,408 个对象 / 180,190,062 B，逐 key 大小全部与 manifest 相符。
- 58 个分组代表对象通过远端原始字节 SHA-256 比对；这属于 R2 对象验证，不代替 Pages HTTP 或 Browser 验收。
- 保留正式版本 `854190ad`：4,992 个对象 / 150,515,319 B，与清理前清单相同。
- 保留测试版本 `fda1a54c`：5,394 个对象 / 164,645,026 B，与清理前清单相同。
- 本批未更改 Pages 环境变量、read-model 绑定、服务端口，也未构建或部署站点。共享非版本化 key 按 manifest 更新；未据此宣称历史站点全部运行行为不变。

关键本机证据 SHA-256：
- `.analysis/release-20261021/r2-cleanup-receipt.json`: `1fc33120b22522019ae0c72dd81e4983aa53c14fc0ac960600b18a1ffd693ed8`。
- `.deploy/release-20261021/upload-receipt.json`: `2eba260ca157d6319cb0a9f20b9060c498cd318073589f5020a8a24f72699559`。
- `.deploy/release-20261021/remote-validation.json`: `a3b3816d7026f06eebc0150af9cf447a8b2edfa1576c2a638f571af87e5b7cc0`。
- `.deploy/release-20261021/metadata-validation.json`: `ba0e736e2dccc34a1c9b89811846e9038314231c92060d23884037fff6da82c5`。
- `.analysis/release-20261021/overlay-20261021.json`: `68e08fba688db8d99bdfd39fb386c14983c8759493ea41bbefb99f3158e30757`。
