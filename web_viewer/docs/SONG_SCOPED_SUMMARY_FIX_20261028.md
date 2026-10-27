# 偶像范围歌曲目录统计修复

输入 master `36743743`；分支 `fix/20261028-song-summary`。用户明确允许独立小修，作为深链接 P48 验收发现的范围例外；不混入地址层 PR #121。

`ArchiveSongCatalog.vue` 的偶像范围统计分支调用了不存在的 `techCount`，导致 `/songs/?idol=001tom` 在实际渲染时抛出 ReferenceError。组件仅一行改动：三个计数调用复用已有 `filterCount`。模板、样式、统计范围和筛选行为均未改。

验证：

- `node scripts/verify-song-domain-landing.mjs` 通过。现有真实 SFC SSR 回归新增天濑冬马范围：四首作品、3DMV 1、MV LIVE 0、分轨演唱 0。恢复原缺陷时同一回归因 `techCount is not defined` 失败，随后恢复修复。
- `npm run build:check` 通过（16.40 秒）；仅 `.analysis/build-check` 代码产物，无 public 语料复制。构建存在既有 chunk-size 提示。
- 直接 Browser，dev 端口 5242，Vite PID 30908，当前 fix 工作树；候选 `rm-release-20261022`、受跟踪 bootstrap release `1accd9d0`。冷开 `/songs/?idol=001tom` 正常显示 4/1/0/0；选择 3DMV 仅剩 Inner Dignity；进入实际歌曲详情、返回并冷刷新后，URL 保持 `/songs/?idol=001tom&song_scope=movie`，偶像范围和统计均保留。该旅程控制台无 error/warn。

日志在本工作树 `.analysis/song-summary/`。这是 dev Browser 验收，未验证生产 bundle、真机或发布；未部署、未上传 R2。
