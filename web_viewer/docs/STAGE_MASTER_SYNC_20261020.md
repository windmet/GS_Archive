# 舞台线同步 master 与 Searchlight 空资源预载修复

2026-10-20，工作目录 `E:/Web_build/SideM_Archived/web_viewer`，分支 `stage/20261020-native-followup`。

## 输入与合并

公共灯光 RGBA 修复提交 `19192263` 后，fetch 确认 master 已前进至 `5aab5644`（PR #53），同时核实 `baseline/2026-10-20` 指向该提交。按分支策略用 merge 同步，合并提交 `973a89b8`。仅 `CURRENT_STATE.md` 有冲突，保留 master 的门户、翻译线事实和本轮舞台进度；没有 rebase、直接推 master 或部署。

`ChibiStageViewer.vue` 自动合并后，新增 Center 台词的播放、停止、倍速与释放接线保留。公共 RGBA 模块没有被合并修改：`src/core/chibiLightQuad.js` SHA256 仍为 `4cf6cc495bdb7dc4650822cedfb80e3e7076e8edf1dd35ffd7cb9054db91595f`。[此前 GPU 证据](NATIVE_ADDITIVE_RGBA_20261020.md)属于合并前同一模块，不冒充合并后重跑 GPU 全矩阵。

## Browser 找到并修复的阻塞

FLASH LIGHT 冷加载曾显示“Searchlight 原始图片尚未就绪”。源绑定 sidecar `stage-searchlights.json` 中，该编排有 4 条 `Searchlight_show_2` 的 value2 为空（sourceRow 2482、2489、2496、2503）。预载器将空字符串加入图片集合，模型校验失败，因而阻止整台舞台就绪。

现在公共预载器只收集非隐藏、具名的 Searchlight 图片引用。未修改 RAW、源 sidecar、指令求值或空行本身的游戏语义；未把空名称解释为新图片。具名但缺失的资源仍使准备失败。

实际 renderer 回归覆盖 FLASH LIGHT 的空行、两张具名图片加载、重复准备复用和释放，以及具名缺失仍拒绝。没有逐歌特判。

## 验证

- `node scripts/verify-chibi-searchlights.mjs --published-assets` 通过，含新增实际预载器回归。
- 合并后 `npm run verify:source-batch`：154/154，通过；Searchlight 项在上述修复后执行。日志 `.analysis/stage-master-sync-source.log`。
- 新 master 的 `verify:song-oneshot-voices`：2 首、98 clips；`verify:story-costumes`：92 labelled models、31 thumbnail records，通过。后者没有本地缩略图文件验收（0 files checked locally）。
- 合并后首次 `build:check`：2,966 modules / 27.40 秒；`verify:build-audit` 启动 JS gzip 204,674 字节。Searchlight 修复后再次编译：2,966 modules / 32.00 秒，audit 204,672 字节，未放宽 204,800 预算。后者 revision 为 `973a89b8`、sourceDirty=true，含本页所述未提交修复。日志 `.analysis/stage-master-sync-searchlight-build.log`。
- 两次构建均复用 `.analysis/build-check`，`copyPublicDir:false`，没有复制媒体库。构建生成的审计、翻译 release/manifest 差异核对后恢复至合并后的 HEAD。

## 合并后的真实 Browser

只重启本轮 5213（原 PID67480，新 PID50520），保留 `SIDEM_READMODEL_CANDIDATE=E:/Web_build/GS_Archive_Domain_Work/rm-release-20261015`；5177、5212 未动。新增 `song_oneshot_voices.json` 重启前返回 SPA HTML，重启后 HTTP 为 application/json。Browser 使用 Codex In-app Browser / cua_repl，dev 服务证据。

| 旅程 | 实测 |
| --- | --- |
| K.now O.nly 冷进入 | 歌曲详情与难度表载入，进入舞台 ready=true；2.5 秒粒子激光 8，ID1–8，无未决 ID |
| HND 27 秒 | ready=true，Spotlight 3、Sprite 激光 18、Whole_screen 类型3/4、粒子38；动作预载后播放从27秒推进到30.6秒以上，随后暂停 |
| FLASH LIGHT 修复后冷刷新 | 4/4 ready，原先阻塞消失；从33秒预载后播放到45秒，40.8秒 Searchlight 4；Center 台词控件载入49人并可切至关闭。这是控件与舞台集成检查，没有单独证明台词音频的听觉等价 |
| 桌面与手机尺寸 | HND 1280×800 截图；FLASH LIGHT 390×844，scrollWidth=innerWidth=390，Center 控件可用；不是手机真机 |
| 返回歌曲 | `/songs/knwonl/?maintainer=1`，无残留舞台参数；标题 K.now O.nly 与难度/Combo 实际表格载入 |
| 控制台 | error 列表为空；保留既有 Pixi/Spine 弃用警告及 FLASH LIGHT 的 `stage_flslgt_01` 至 `_04` 图片层缺口警告，不宣称全层完整 |

截图与控制台在 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/`：`stage-master-sync-hnd.png`、`stage-master-sync-flash-mobile.png`、`stage-master-sync-console.json`。viewport 已恢复。

这批不构成生产包、原片逐帧或真机验收。下一轮加载策略见 [交接](STAGE_LOAD_STRATEGY_20261020.md)，MV 已完成项与剩余缺口见 [舞台续批入口](STAGE_FOLLOWUP_20261020.md)。原有无关删除、未跟踪文档和证据均保留。
