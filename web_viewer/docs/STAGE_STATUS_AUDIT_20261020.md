# 舞台线状态审计（2026-10-20 晚）

给接手 `stage/20261020-native-followup` 的人：先看本页，再按链接读各批文档。本页的结论都在 2026-10-20 晚重新核实过；没有重新核实的会写明。

## 位置

| 项 | 值 |
|---|---|
| 分支 | `stage/20261020-native-followup`，头 `a8c45bfc`，已推送，**还没有 PR** |
| 与 master | ahead 11 / behind 12（master `dd1035dc`，含 #56–#58） |
| 工作目录 | 主 checkout `E:/Web_build/SideM_Archived/web_viewer`（CRLF、带全部语料）。这正是会把 CI 红项跑绿的环境，见下文第 1 项 |
| 改动 | 82 个文件，+2804 / −162；新悬灯 Sprite、Time Before Time 内置对象、公共 RGBA、四组索引分片、文档复用、初次加载并行 |
| 入口文档 | [STAGE_FOLLOWUP_20261020.md](STAGE_FOLLOWUP_20261020.md)、[STAGE_LOAD_STRATEGY_20261020.md](STAGE_LOAD_STRATEGY_20261020.md) |

## 本次核实

在一个干净的 LF worktree（`-c core.autocrlf=false -c core.eol=lf`，node_modules 用联接，**没有语料**，相当于 CI）里把 master 试合进舞台分支：

| 检查 | 结果 |
|---|---|
| 合入 master | **无冲突** |
| 再叠 #59（剧情线） | 只有 `docs/CURRENT_STATE.md` 冲突（两边都改了），纯文档 |
| `build:check`（干净树，sourceDirty=false） | 通过；启动 JS gzip **204,707 / 204,800**，只剩 93 字节 |
| `verify:verifier-coverage` | 通过（455 个脚本） |
| `verify:source-batch` | **156/157，`verify-choreography-shards.mjs` 失败** |
| 三个生成器 `--check`（主 checkout，有语料） | choreography / stage-effect / consumer 全部逐字节一致 |
| 清单引用的分片 | 118 + 119 + 199 = **436 份全部在盘上**，没有缺失 |

## 发现

### 1. 推 PR 前必修：分支在 CI 上会红

`public/data/stage-choreography-shards.json` 的 `inputs.spotlight.sha256` 是 `25ffa38d…`，这是主 checkout 磁盘上 `stage-spotlight-commands.json` 的哈希：文件末尾是 **CRLF**。Git 里的 blob 末尾是 LF（`.gitattributes` 设了 `eol=lf`，所以 `git status` 看不出差别），哈希 `3c4c10bf…`。CI 检出的是 LF，`verify-choreography-shards.mjs:70` 断言 `Native source changed: regenerate choreography shards`。

之前文档里的「156/158 项源码门禁通过」都是在主 checkout 跑的，CRLF 字节恰好和目录一致，所以是绿的。

修法（只改一个哈希，分片不变：分片由解析后的数据序列化，sidecar 原始字节只进目录的 `inputs`）：

1. 把主 checkout 的 `public/data/stage-spotlight-commands.json` 改成 LF（去掉末尾 `\r`；改完应与 `git show HEAD:web_viewer/public/data/stage-spotlight-commands.json` 逐字节相同）。
2. `npm run prepare:choreography-shards -- --write`，确认 `git diff` 只有目录里 `inputs.spotlight.sha256` 一处变成 `3c4c10bf…`、`shards/` 下没有新文件。
3. 在 LF worktree 里重跑 `verify:source-batch`，不要只在主 checkout 跑。

顺便检查另外两份 sidecar：`stage-whole-screen.json`、`stage-searchlights.json` 在盘上与 blob 一致，这次没有问题。

### 2. 发布前要清：122 个过期效果分片

`public/assets/live-chibi/stage-effects/shards/` 盘上 241 个文件，清单只引用 119 个；多出的 **122 个（17.8 MB）** 是 LF 重放前的旧名字。编舞（118/118）和 consumer（199/199）没有多余文件。

发布清单 `export-preview-assets.mjs` 会遍历整个 `public/assets` 和 `public/data`，所以这 122 个文件会被一起打包上传，占 R2 空间，但不会造成 404。打包前先删掉清单没引用的文件。

### 3. 分片会自动进入发布包，前提是盘上有

同一个遍历意味着：只要发布用的 checkout 上跑过三个 `prepare:*-shards -- --write`，436 份文件就会自动进入 `current-source-inventory`，再由 `prepare-preview-incremental-assets.mjs` 按「远端没有或哈希变了」选出来上传。审计担心的「本地正常、线上分片 404」只会在**换一个没有生成分片的 checkout 打包**时发生。

建议在打包流程里加一个硬检查：三个清单引用的每个文件都要在 inventory 里，并且 sha256 一致，否则拒绝打包。现有 `verify:stage-effect-shards -- --published-assets` 等验证器已经能逐片核对，可以直接作为打包前的一步。上传后再用 `verify-preview-incremental-http.mjs` 对这 436 个 key 做一次 HTTP 抽查或全量检查。

### 4. 启动 JS 预算只剩 93 字节

舞台代码在懒加载 chunk 里，本轮没有挤占启动 chunk，但合 master 后已经是 204,707 / 204,800。下一个进启动 chunk 的改动（任何线）都会超。要么先拆分，要么由用户决定放宽。

### 5. 还没有冷加载实测

文档里的 43.58 MB → 1.79 MB 是固定 loader 序列的**原始 JSON 读取字节**，不是网络传输量，也不是开播时间；所有 Browser 验收都是 dev 服务、没有清空网络缓存。审计要的「同一生产构建、同一浏览器、限速、冷缓存，新旧对比」还没有做。

现成工具：`scripts/measure-portal-cold-load.mjs`，已经实现「每次新 profile、禁用缓存、Lighthouse 手机预设（150 ms RTT、1.6 Mbps、4× CPU）、取中位数」，但只认门户页面。给它加一个舞台页面项，`entity` 用舞台已有的 ready 判定（文档里的 `ready=true`、人数就绪），再对两个 preview 部署（合并前 / 合并后）各跑 5 次，比较可开播时间、首个可见画面、请求数、传输字节、堆内存。本地 dev 服务的数字不能当作生产结论。

## 建议顺序

1. 修第 1 项，在 LF worktree 里跑全门禁；合 master（预计无冲突）；开 PR。CURRENT_STATE 的冲突在后合的那个 PR 里手工合并。
2. 清第 2 项，并把第 3 项的打包前检查做成脚本或加进打包步骤。
3. 和其他线一起做 preview 集成部署（只碰 preview，正式站要用户授权），然后用第 5 项的方法做冷加载对比。旧版基线可以用当前 preview（`2430ef3d` release）先测一次。
4. 有了加载基线以后，再做渲染与 GPU：选 3–5 首代表曲（普通人物、密集粒子、复杂灯光、长时间播放），看帧时间、纹理、透明叠加和 GPU 内存。只优化 Web 绘制，不改原生计算语义。
5. 不急的开放项（未变）：32 种无 consumer 粒子（427 条事件、18 份编排）、Sprite 淡入公共语义、ObjectLayer 粒子生命周期、syksai 第四层、Change to Chance 原片逐时间点对照、用户描述不出的灯光差异。见 [STAGE_LAYER_AUDIT_TODO_20261014.md](STAGE_LAYER_AUDIT_TODO_20261014.md)。

## 本次没有做

- 没有修改舞台分支上的任何文件（本页是未跟踪的新文件），没有提交、推送、部署或上传。
- 试合并用的临时 worktree 已删除；日志 `stage-audit-build.log`、`stage-audit-batch.log` 在会话 scratchpad，不在仓库里。
- 没有重测 Browser、原片或真机。
