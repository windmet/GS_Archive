# R2 增量直传：2026-10-14 批次

分支：`codex/r2-incremental-upload-20261014`。输入 HEAD：`b32d152b54c8e7a1a9fc46fc0a3a051d4284a43f`。
用户授权检查当前工作区、绕开代理上传新 R2 清单，并要求使用新分支。此次只上传 R2，未部署 Pages、未更新服务或端口。

## 清单与校验

- 清单：`.deploy/r2-incremental-20261014/manifest.json`，SHA-256：`5ec9204ad8c608fed468c9619a6b1c604d7ef8a7b68453e5a7ae8e45de693ca4`。
- 数据 revision：`fef20b766a4a39b5fbf60d4778551add3d3fb3cf8362e4363c2dc740cc4b55b1`；快照已上传，尚未切换站点配置。
- 当前源枚举 104,421 项；本批 5991 项，来源 317896994 字节，暂存 259534769 字节。仅在本 checkout 的 E 盘目录生成增量，不生成全量媒体包。
- 上传基线由 2026-09-24 source baseline 与历次已完成上传回执叠加，并加入 10-09 回执；每个来源、暂存对象、清单及历史回执的哈希均经校验。
- 128 张 PNG 转无损 WebP，通过尺寸、可见 RGBA、alpha=0 RGB 清零逐像素检查；预演确认这 128 个远端对象已一致。5,863 个对象需要传输，含 4 份小人运行时索引、559 个剧情 gzip 对象及 5,300 个版本化 JSON。
- 本批依赖闭包采用 integrated read-model 候选；与当前 5212 使用的 native-relations 候选对照，双方 7,349 个媒体引用集合完全相同。历史 82 个缺失音频引用保持不变，未声称已补全。

## 上传结果

- 目标：`cloudflare:sidem-archive-preview`。清除 HTTP_PROXY / HTTPS_PROXY / ALL_PROXY（含小写），设置 NO_PROXY=*；实测 rclone 直连 Cloudflare 443。只使用 copy，未执行 sync 或删除。
- `python scripts/verify-preview-incremental-images.py --manifest .deploy/r2-incremental-20261014/manifest.json` 通过；`rclone copy --dry-run` 通过。
- 初始命令：`node scripts/upload-preview-incremental-assets.mjs .deploy/r2-incremental-20261014/manifest.json cloudflare:sidem-archive-preview --upload`；继承 RCLONE_FAST_LIST=true、RCLONE_NO_TRAVERSE=true，先通过标准脚本的全部来源、暂存、图片、实时全桶与账户容量门禁。
- 小文件阶段因 4 并发较慢，主动停止仅本批 group 3 的 rclone PID61920；初始日志因此记录退出断言，不是完成回执。随后使用本地 `.analysis/r2-upload-20261014/resume-upload.mjs` 对同一清单续传，16 transfers / 32 checkers；再次校验全部来源及暂存哈希、图片回执与原预算绑定，保留原先上传前库存与预算，不将其伪称为新扫描。已完成对象按校验和跳过，版本化对象继续 immutable；结束时仍按标准流程重新统计账户并断言桶大小。未修改仓库上传脚本。
- 上传前桶大小 7709692994 字节，保守峰值 7873190249 字节；上传后实时统计 7873189017 字节，与预计值 7873189017 完全一致。
- 其他桶实测 444588701 字节；保守账户预留 880000000 字节，容量门禁通过。
- 完成时间（UTC）：2026-10-14T16:12:45.466Z。`upload-receipt.json` 与清单哈希绑定。用户在最终统计期间要求“收尾吧，别抽查了”，已立即停止抽查进程；停止前 27 项远端下载 SHA-256、长度、MIME/gzip 元数据检查通过，结果从已完成的日志保留到 `remote-sample-verification.json`。该回执明确标记 stopped_by_user / completed=false，不代表原定抽查全部完成；后续线上 HTTP 抽查未执行。

## 验收边界与后续

上传前保存的线上 Pages 回执为 `master`，dataRevision `854190ad908cc47df022dfb35181838fa4e0fd385a537e8fc8b611053b7b0bd4`。本次未执行 Pages 部署或切换快照配置；未继续做上传后 HTTP 抽查。R2 的非版本化索引与剧情 gzip 更新会由现有逻辑 URL 访问；上传不等于新前端发布。

这次只进行资源上传及文档记录，无前端源码改动，因此未运行应用构建或 Browser 页面验收。完整日志、源枚举、预演和 Pages 回执保存在 `.analysis/r2-upload-20261014/`；增量产物及回执保存在 `.deploy/r2-incremental-20261014/`，均不提交语料。

后续部署应显式选择上述新 dataRevision、使用本清单及回执作为上传链最新一项；下一批增量可使用 `.analysis/r2-upload-20261014/uploaded-baseline.json` 叠加本批已完成的来源哈希。启用新快照时将本清单追加到 `scripts/verify-preview-http.mjs` 的 DEFAULT_CHAIN，再进行对应 HTTP 与实际 Browser 验收。当前默认链仍对应尚未切换的线上快照。

原有未跟踪的终端数据、v9 HTML、交接文档、语音审查脚本、上级 .analysis 和源码 ZIP 均保持原状。本批只提交本记录。
