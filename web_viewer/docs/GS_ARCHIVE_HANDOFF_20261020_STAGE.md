# 舞台线交接（2026-10-20 夜）

接手 `stage/20261020-native-followup` 先读本页，再读 [STAGE_STATUS_AUDIT_20261020.md](STAGE_STATUS_AUDIT_20261020.md)（同晚的状态审计，本页只记它之后的变化）。

## 位置

| 项 | 值 |
|---|---|
| 分支 | `stage/20261020-native-followup`，本地头见下表最后一个提交；`a8c45bfc` 之后的提交**没有推送**，还没有 PR |
| 工作目录 | 主 checkout `E:/Web_build/SideM_Archived/web_viewer`（CRLF、带语料） |
| master | `origin/master` = `dd1035dc`（含 #56–#58）；还没有合进舞台分支 |

## 本次提交

| 提交 | 内容 |
|---|---|
| `fd4dc113` | 审计第 1 项：主 checkout 的 `stage-spotlight-commands.json` 换回与 blob 相同的 LF 字节，`prepare:choreography-shards -- --write` 后目录只变 `inputs.spotlight.sha256`（`25ffa38d…` → `3c4c10bf…`），分片没有新增或改动 |
| `9f9a4911` | 干净树里又查出两个舞台分支自带的红项（审计的 156/157 没覆盖到，因为它只跑了源码批次）：① `verify-chibi-spotlight-targets.mjs` 截取 `liveChibiSpine.js` 时只去掉第一个 `export`，`f77f89ad` 在两函数之间加的 `export const fetchLiveChibiSongChoreography` 变成语法错误，改为 `replace(/^export /gm,'')`；② `archive_baseline_report.json` 的 `tracked_binaries` 还是 392 个 PNG，舞台新增的 6 个内置对象 + 2 个新悬灯 Sprite 后应为 400 / 72,090,892 字节，只改了这一节 |
| 本页 + 审计文档 | 纯文档 |

两处 verifier 修复都在主 checkout 上先确认修复前失败、修复后通过。

## 验证（干净 LF worktree，等同 CI）

做法见记忆里的 clean-checkout recipe：`git -c core.autocrlf=false -c core.eol=lf worktree add`，node_modules 联接，`python -S`，无语料；在其中 `merge origin/master`（无冲突）后：

- 把 `web-viewer-source-gate.yml` 的全部 `run:` 按 `&&` 拆成 145 条原子命令逐条跑：修复前 143/145（失败的就是上面两项），修复后这两项通过。
- `verify:source-batch` **157/157**；`build:check`、`verify:build-audit` 通过。
- `git diff --check origin/master...HEAD` 干净。
- 临时 worktree 已删除。没有重测 Browser。

## 下一步（按顺序）

1. `git merge origin/master`（试过无冲突），推送，开 PR。与 #59 只会在 `docs/CURRENT_STATE.md` 冲突，后合的那个 PR 手工合。
2. 审计第 2、3 项：删掉 `public/assets/live-chibi/stage-effects/shards/` 里清单没引用的 122 个旧分片（17.8 MB）；打包前加硬检查（三个清单引用的文件都必须在 inventory 里且 sha256 一致）。
3. 审计第 4 项：启动 JS gzip 204,707 / 204,800，只剩 93 字节，任何线下一个进启动 chunk 的改动都会超。
4. 审计第 5 项：给 `measure-portal-cold-load.mjs` 加舞台页，对合并前后两个 preview 部署做冷加载对比；之后再做渲染/GPU。
5. 长期开放项不变，见审计文档。

## 注意

- 主 checkout 是 CRLF 环境，记录原始字节哈希的生成器在这里跑会把 CRLF 写进目录；生成后一律到 LF worktree 复跑门禁。
- 主 checkout 里 `040ren_child.txt` 的删除和若干未跟踪文件不是舞台线的，提交时用显式路径。

## 后续已推进（0654100c之后）

舞台线已同步master #56–#59（`4d31a402`），合并记录见 [晚间同步](STAGE_MASTER_SYNC_EVENING_20261020.md)。[分片发布闭包门禁](STAGE_SHARD_PACKAGING_GATE_20261020.md)已覆盖3个目录和436份分片；旧分片保留在盘上但从新inventory排除，增量打包在创建输出前复核。冷加载/生产HTTP与GPU检查仍开放，本轮未部署。

上表未推送/未合master状态是历史快照；最新HEAD与远端状态以git核实。
