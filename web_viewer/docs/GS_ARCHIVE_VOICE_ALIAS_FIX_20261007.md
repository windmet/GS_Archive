# 5175 剧情语音别名恢复

- 复现入口：`1_4_002_07_j` 第 5 步，语音 `1_4_002_07_t01_j1000.m4a`。本地真实文件为 `1_4_002_07_j1000.m4a`。
- 原因：Vite 对缺失资源返回 200 HTML；原有别名循环只处理 404/410，因此在已有正确别名之前中止。文件没有丢失，与 C 盘缓存清理无关。
- 修复：压缩语音缓存把非音频响应标为 `VOICE_NOT_AUDIO`，消费者继续尝试既有文件名候选。保留网络故障、503、取消及候选耗尽时的失败语义，不改变模板、样式或剧本。
- 自动回归：`node scripts/verify-voice-load-recovery.mjs` 12/12；`node scripts/verify-compressed-voice-cache.mjs` 通过。新增真实缓存与播放器组合测试覆盖 200 HTML → 正确别名、503 不回退、全部 HTML 不播放。
- `npm run build:check` 通过，输出固定在 E 盘 `.analysis/build-check`，未复制 public 语料。
- Browser：复用 5175，通过 Codex 内嵌浏览器复现并验证。首句 96,371 字节、6.797 秒；下一句 83,573 字节、5.362 秒。两句均 `sourceStarted: true`、音频上下文 running、最终 ended、lastFailure 为 null。首次刷新受到浏览器声音手势限制，点击重试后首句正常，下一句自动启动。
- 验收范围是本地 HTTP、浏览器真实解码和播放生命周期；未声称人工听辨、所有剧情或线上部署验收。5175 进程未重启。
