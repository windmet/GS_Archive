# 舞台初次加载阶段并行（2026-10-20）

输入 `3a9ce7b5`，分支 `stage/20261020-native-followup`；master `5aab5644`。本批落实 [加载策略](STAGE_LOAD_STRATEGY_20261020.md) 中独立读取的并行准备，不改变当前开播就绪条件。

## 接线与门槛

初次进入仍先读取 manifest 和编舞目录。之后动作时钟/音乐索引同时读取；选中歌曲确定后，完整编舞片/效果片同时读取，完成后一起安装。Penlight、对象索引、唇形、音频初始化及启用时的分声部准备在同一阶段发起，不再先等应援棒与对象才启动音频。

编队 handoff 仍在分声部准备前应用；原生时钟缺失仍阻止继续，不能以默认速率开场。人物构建、初始 seek 和灯光准备仍在上述阶段之后。Penlight 对象会话保留上一批的可恢复失败与代次所有权。音频初始化函数只发起媒体加载，真正媒体播放仍受原有播放 intent/就绪检查保护，不能将函数返回视为音频已下载完成。

没有把灯光强行晚到、删减首帧效果，或宣称全曲/真机原版等价。演员与音频阶段进一步重叠、可晚到层的状态表达、真实冷缓存开播时间及预算仍是后续工作。

## 验证

`node scripts/verify-stage-initial-loading.mjs` 执行真实 SFC onMounted 回调，通过可控异步资源验证并发发起、阶段屏障、Penlight可恢复失败、退出后不进入下一阶段，以及原生时钟失败后停止。测试模拟加载器，不是网络性能测量。

`npm run build:check`：2,971 modules / 26.44秒，固定 `.analysis/build-check`，不复制 public。`npm run verify:build-audit` 通过，启动 JS gzip estimate 204,695 / 204,800；输入 sourceDirty=true。`npm run verify:source-batch` 159/159通过，源码门禁见本批日志 `.analysis/stage-initial-parallel-source.log`。

Browser：Codex In-app Browser / cua_repl，当前 checkout dev 服务5213，PID21756；候选 rm-release-20261015，实际 bootstrap release `2430ef3db583a07878f1967b45e039eb326212cda386b063f6c4f9f8d8a772c3`。

| 旅程 | 实际证据 |
| --- | --- |
| K.now O.nly 详情→舞台 | 3/3人就绪、ready=true、143个应援棒renderer，无错误覆盖层 |
| 点击播放 | 预载37%后完成，时间轴实际推进到17,700ms，再暂停并seek至17秒 |
| 桌面1280×800、手机尺寸390×844 | 画面与控制台实际载入；手机文档刷新后重新ready=true、143个应援棒renderer；scrollWidth=clientWidth=390 |
| 返回歌曲 | `/songs/knwonl/?maintainer=1`，无stage/song/view残留，难度/Combo表89/219/396/603实际载入 |
| 控制台 | 无error；4条既有Pixi/Spine tint/update warning，未声称零warning。viewport已恢复 |

截图与控制台在 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/stage-initial-parallel-{desktop,mobile}.png`、`stage-initial-parallel-console.json`。刷新没有清空网络缓存；本批没有重跑完整冷加载基准，没有承诺具体时间收益。没有部署或发布资源；无关文件和证据保留。
