# R2 台词语音 64k 替换

用户已实际试听并表示 64k 与 72k 无明显差别、64k 可接受；随后明确批准用 64k 替换当前 R2 台词语音，先删除旧语音再从本地上传，允许短时间 404。此授权不包含歌曲、BGM、SE、其他桶或原始档案删除，也不等于所有浏览器/口型播放专项验收。

## 范围与原件

- 固定桶 `cloudflare:sidem-archive-preview`，固定 32,421 个 `assets/voice/*.m4a` 逻辑/物理键，来自既有完整发布清单。
- 现有语音 2,681,894,417 B；全库实际生成 **1,424,965,429 B**，减少 **1,256,928,988 B（1.171 GiB，46.867%）**。早期 159 条样本外推约 1.456 GB，现由全库统计取代。
- 从外部原始 ACB 解码为 PCM16，再一次编码为 AAC-LC 64k。保留每条原有采样率与声道数，包括全部 14 条双声道例外。
- 原始 ACB/AWB、本地 `public/assets/voice` 及旧 `.deploy/r2` 部署字节保留。临时 PCM 在每条生成和校验后删除，不积累全库 WAV。
- 所有新媒体位于 E 盘 `.deploy/voice64/stage`，不会复制到 C 盘。

## 执行与验收

`python scripts/prepare-voice64-deployment.py --workers 16`：核对源索引、旧 manifest 和全量 cue 审计；按 ACB 记录源文件生成前后 SHA256，检查 cue/subsong 身份及 PCM 帧数；逐个生成、ffprobe、完整解码、核对时长（差值不超过 2ms）。按 ACB 保存可恢复 checkpoint；重跑需核对已完成对象及源文件 hash。只有全部 32,421 条和键集合校验完成后才生成 `manifest.json`、`keys.txt` 及新的 `full-manifest.json`。初始以 8 并发运行，保留已完成分组后从断点增至 16 并发。

`node scripts/execute-voice64-replacement.mjs --execute-authorized-voice-replacement`：重新核对本地新字节和旧部署备份；远端完整键/大小清单必须与替换前基线吻合；读取账户用量并执行 dry-run；只删除明确的语音键清单；确认语音前缀为空且其他对象集合/大小不变，再检查容量并上传；最后全量 S3 checksum、完整桶清单和 MIME 样本校验。回执按阶段恢复，进入上传阶段后不会再次删除。

`node scripts/verify-voice64-http.mjs https://3412e295.gs-archive-preview.pages.dev`：覆盖原 159 条试听键、大小极值及全部双声道项，检查 GET 字节 SHA256、HEAD、ETag/304、MIME、首尾 Range/206 和 416。带版本查询串以避免旧缓存；既有稳定 URL 的旧可播放编码可能按 `max-age=3600` 保留至一小时，不要求清空用户浏览器缓存。

## 当前状态

本地全库生成于 2026-09-24 16:51 前完成，进程退出码 0。3,447 个 ACB 分组、32,421 条语音全部验证；全部 159 条试听样本与全库产物的 SHA256 一致。14 条双声道保留；容器时长与原音最大差值约 0.77144ms。生成目录中的临时 PCM 剩余数为 0。

远端删除前的新字节/旧备份 SHA256 复核、完整远端键/大小清单及账户容量检查、上传 dry-run 均通过。旧版 PowerShell 包装器曾将 rclone 正常的 stderr NOTICE 日志当作终止错误；确认包装器和子进程均已退出后，使用当前 PowerShell 从 `clearing` 回执阶段恢复，没有重启转码或清空桶。该包装器位于 ignored 工作目录，不是发布脚本。

2026-09-24 17:01:27 前完成 32,421 条旧语音删除，前缀实测为 0 对象、0 B；65,611 个非语音对象的键和大小全部不变。17:03:51 开始上传，17:09:34 前全部上传完成。全量远端 checksum 结果为 **32,421 matching files、0 differences**。完整桶键集合/大小、单/双声道 metadata 样本、最终账户用量检查通过，`replacement-receipt.json` 为 `verified`。

最终完整桶实测仍为 98,032 个对象、**6,574,047,523 B**。其他可见桶为 439,415,133 B，实际合计 **7,013,462,656 B**；按其他用途最低 880,000,000 B 预留计算为 **7,454,047,523 B**，距 10,000,000,000 B 控制线 **2,545,952,477 B**。

17:14:16 线上 160 条语音 HTTP 抽查全部通过、0 失败，覆盖试听集合、大小极值和全部双声道项，验证 GET SHA256、HEAD、ETag/304、MIME、首尾 Range/206、416。不带版本参数的原始 URL `assets/voice/1_1_001_01_a1000.m4a` 也已返回新 64k 文件的 SHA256，见 `stable-url-http.json`。资源 URL 和 Pages 部署均无需更换：[当前预览](https://3412e295.gs-archive-preview.pages.dev)。这是用户接受听感、本地媒体验证及线上字节/协议验收；未把此前受阻的 Browser 实际剧情/口型播放专项标记为通过。

本地证据：`.deploy/voice64/prepare.log`、`prepare-16.log`、`groups/*.json`、`manifest.json`、`replacement-receipt.json`、`http-receipt.json`。旧完整清单和 gzip/data 快照保持不变，后续上传应使用新的 `full-manifest.json`，避免将旧 128k 语音误传回去。

当前完整 manifest：`.deploy/voice64/full-manifest.json`；台词派生物 manifest SHA256：`4c4cce16e1e0a7edb84e55a6c93fe4876ce3eba7b8a28bc865514becccc92541`。日志为 `replacement.log`（首次包装器退出）、`replacement-resume.log`（已完成）、`http.log`。原始 ACB/AWB、public M4A、旧部署备份保留；歌曲、BGM、SE、BRMY 未纳入本次替换。

## 用户实测补充

2026-09-24 用户明确确认“我已经真实测试过了没问题”，并要求准备正式部署。记录为用户真实播放验收通过；未推断设备、浏览器及全剧情覆盖范围。正式发布准备见 [PRODUCTION_RELEASE_20260924.md](PRODUCTION_RELEASE_20260924.md)。
