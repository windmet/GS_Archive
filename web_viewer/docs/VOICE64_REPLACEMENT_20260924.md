# R2 台词语音 64k 替换

用户已实际试听并表示 64k 与 72k 无明显差别、64k 可接受；随后明确批准用 64k 替换当前 R2 台词语音，先删除旧语音再从本地上传，允许短时间 404。此授权不包含歌曲、BGM、SE、其他桶或原始档案删除，也不等于所有浏览器/口型播放专项验收。

## 范围与原件

- 固定桶 `cloudflare:sidem-archive-preview`，固定 32,421 个 `assets/voice/*.m4a` 逻辑/物理键，来自既有完整发布清单。
- 现有语音 2,681,894,417 B；根据 159 条原音样本外推，新语音约 1.456 GB、节省约 1.226 GB。准确量以全库产物为准。
- 从外部原始 ACB 解码为 PCM16，再一次编码为 AAC-LC 64k。保留每条原有采样率与声道数，包括全部 14 条双声道例外。
- 原始 ACB/AWB、本地 `public/assets/voice` 及旧 `.deploy/r2` 部署字节保留。临时 PCM 在每条生成和校验后删除，不积累全库 WAV。
- 所有新媒体位于 E 盘 `.deploy/voice64/stage`，不会复制到 C 盘。

## 执行与验收

`python scripts/prepare-voice64-deployment.py --workers 8`：核对源索引、旧 manifest 和全量 cue 审计；按 ACB 记录源文件生成前后 SHA256，检查 cue/subsong 身份及 PCM 帧数；逐个生成、ffprobe、完整解码、核对时长（差值不超过 2ms）。按 ACB 保存可恢复 checkpoint；重跑需核对已完成对象及源文件 hash。只有全部 32,421 条和键集合校验完成后才生成 `manifest.json`、`keys.txt` 及新的 `full-manifest.json`。

`node scripts/execute-voice64-replacement.mjs --execute-authorized-voice-replacement`：重新核对本地新字节和旧部署备份；远端完整键/大小清单必须与替换前基线吻合；读取账户用量并执行 dry-run；只删除明确的语音键清单；确认语音前缀为空且其他对象集合/大小不变，再检查容量并上传；最后全量 S3 checksum、完整桶清单和 MIME 样本校验。回执按阶段恢复，进入上传阶段后不会再次删除。

`node scripts/verify-voice64-http.mjs https://3412e295.gs-archive-preview.pages.dev`：覆盖原 159 条试听键、大小极值及全部双声道项，检查 GET 字节 SHA256、HEAD、ETag/304、MIME、首尾 Range/206 和 416。带版本查询串以避免旧缓存；既有稳定 URL 的旧可播放编码可能按 `max-age=3600` 保留至一小时，不要求清空用户浏览器缓存。

## 当前状态

生成流程已用 2 个 ACB、14 条语音实测通过；全库生成已启动，尚未完成。本条记录不是已上传或节省兑现声明。等待全库清单形成后继续已获授权的远端替换，无需再次确认维护窗口。

本地证据：`.deploy/voice64/prepare.log`、`groups/*.json`、`manifest.json`、`replacement-receipt.json`、`http-receipt.json`。旧完整清单和 gzip/data 快照保持不变，后续上传应使用新的 `full-manifest.json`，避免将旧 128k 语音误传回去。
