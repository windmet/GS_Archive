# 网页审计对照收口

基线 `5c81e0b`；新分支 `codex/runtime-audit-closeout`。附件作为建议，以下结论按本地源码、实际资源和浏览器重新核实。没有把本轮写成 P3/E1/E2 全部完成。

## 本轮实施

| 建议 | 本地核对与处理 |
| --- | --- |
| A：interaction matrix | 新增源码可运行的组合检查：生产 goNext 输入门禁＋useStoryNavigation＋useStepSceneEffects，覆盖逐步转场、silent ADV 等待、hidden/user pause 独立所有权、buffering 不产生 history、backlog/choice 阻断、Prev/Next 和范围边界。晚到语音/取消继续由现有 story-loading-safety / audio / stage-loading 回归验证。**不是附件八项完整事务矩阵**；准备期间 Prev 和 commit-only history 须随 P3 另验。 |
| at_step 旧 TODO | Browser 打开 `1_4_001_00.json&at_step=14`，AUTO 的 aria-pressed=false，等待超过 3 秒后仍为源 step_id 14（界面 13/59）；Prev 为 12/59，Next 回 13/59，之后仍停留。该固定用例关闭，不外推全部深链接。 |
| B：visual bytes transport | `StoryAssetTransport` 共享 atlas/skel/config 的底层请求和字节；Preloader binary/atlas/config 与实际 spineSpawnPipeline 接入。32MiB/128项 LRU，只复用显式仍新鲜的 max-age，最多 5 分钟；尊重 no-store/no-cache，消费者独立取消、独立 ArrayBuffer、HTTP/空体/HTML校验。原 config no-store 语义保留。 |
| E：个人故事 Reader | ArchiveIdolStory 按 `episode.file === entry.source_file && status === ready` 显示阅读入口；不猜资源名。修复 Reader/Player 路由投影丢失 idol/episode，返回来源包含原 section/episode。 |
| CI 补缺 | reading 聚合接入 typography；Source Gate 接入 interaction matrix、visual transport、stage render budget、song lyrics/media clock、neck source contract、home source contract、个人 Reader 入口合同。修复 stage-loading VM 夹具遗漏 portraitBaseY。 |

### 字节层的真实边界

- 不持有 Texture、Spine 实例、AudioBuffer，不改变其销毁责任，也不合并语音 PCM 缓存。
- 使用真实 Preloader 和 spawn pipeline 验证：服务器返回可缓存响应时，warm atlas/skel 后进入实际 spawn 不再发送第二次底层请求。
- 无 freshness 或明确 no-store 的响应仍遵循 HTTP 策略，不能为了“零请求”跳过重验证。共享请求按 URL＋请求 cache 策略分组。
- 图片/background 仍沿用现有实现；本轮没有声称完成全部 transport 合并。

## 未实施或调整的建议及理由

| 项目 | 原因与后续门槛 |
| --- | --- |
| C/D：PreparedScene＋prepare/commit | 方向合理，但不是安全的小幅收口。当前 `PixiStageManager.spawnSpine` 首先 removeSpine，再加载并 finalize 挂载；SpineStage 还承担 metadata、定位、剪影和恢复。单独预取字节不满足 detached actor/GPU 对象的准备合同。本轮先统一字节层，**不把它叫 PreparedScene**。下一阶段需 scene lease/dispose、独立准备与挂载、所有导航来源接入，再验证 slow skel 时索引不漂移、Prev 取消、404 不添 history、放行仅 commit 一次；继续保留 frame hold，语音仍是软依赖。 |
| HEAD→GET 图片回退 | 不是删除 HEAD 一行即可：当前 image loader 和 texture resolver 的错误合同不同，需先让 GET 路径保留 HTTP 状态，确保只有明确 404 才单页 fallback，网络故障/解码错误不被掩盖。与图片对象所有权同批迁移，本轮不混入 atlas/skel 字节改动。 |
| 卡片 Reader | coverage 确认 94 ready / 248 unsupported。保持 unsupported；本轮先交付个人故事实际往返链路，卡片的准确 source_file 和专属返回链另批处理，不根据 card id 推断。 |
| Mobile/通信 Reader | 接受暂不接普通正文的建议：stamp、avatar、分支及 history-dependent context 不能降格为线性 ADV。 |
| F：E1 actor presentation | 本地 projector 的 spines 仍明确 not-projected。纯 entry actor 字段不等于 alpha/fade、position/slide、tint 的时域 parity。下一批需独立定义语义字段及 manager 观测口径；本轮不把复制 entry.spines 伪装成完整 actor shadow，也不在加载层改动同时扩投影覆盖。 |
| E2 | 不启动唯一 writer 切换；P3 与正式 soak 尚未完成。 |
| 全部专项直接接 Source Gate | 原始 Spine skel 及 compiled 大语料不在 Git 中。CI 使用 runtime 真实 Timeline 类型的 neck 合同、已提交 card_index 的首页用例；原生二进制180帧和全量 home/compiled parity 保留本地执行。不能声称 CI 覆盖了未提交素材。 |

## 验证及未解决项

- PASS：asset transport（预热/实际消费、独立取消、全部取消、过期、no-store、容量、独立副本、HTML/空体）、spine atlas pages、config/spine preload、preload cancellation/status/plan preparation、stage loading、story-loading-safety。
- PASS：interaction matrix、neck source contract、原始翔太 binary neck overlay、home source contract 及本地10256字段与compiled比对、stage render budget、song lyrics、reading typography。
- PASS：idol-story-interface（49人491分段）、idol-story-reading exact/unsupported/路由往返、archive navigation/async navigation、reading navigation/playback。
- Browser：个人故事冬马第一话 EPISODE 01 → Reader → 刷新 → 完整剧情 Player → Reader → 返回原 `idol=001tom&story_section=20101&episode=2010101`。窄屏与1280×800布局均检查；最终冷刷新正常。编辑过程中曾因辅助模块尚未写入出现短暂 HMR missing-module 日志，后续构建/冷刷新通过。
- `build:check` PASS，固定 `.analysis/build-check`，不复制 public；未创建完整包、未上传素材、未部署。
- **未通过：完整 `verify:reading` 聚合。** catalog/documents/identity/repository/navigation/playback 通过，既有 `verify-reading-render.mjs` 在本机 Vite SSR 模块/样式加载阶段出现 60s invoke timeout。单独重跑及最小 Vite 配置仍复现；禁用 watcher/预扫描的诊断尝试亦未完成，已终止该临时测试进程并撤回诊断改动。原因尚未定位，未把聚合或远端 Source Gate 标为全绿。正文实际 Browser 往返和生产代码构建通过不能代替此项。
- 未执行远端 CI、全设备长稳或真实 Edge soak。本分支 push 不会自动触发现有仅 master-push/PR/manual 的 Source Gate。

本轮采用 A（限定组合覆盖）＋B 第一批＋E，附带 CI 接线；其余为明确保留项。日志复用 `.analysis/portal-issues-20260920/audit-*.log`，不提交临时输出。
