# 首个正式 Story Collection 迁移发布：`1_4_001_01`（2026-07-22）

## 结论

`1_4_001_01` 已作为首个小范围正式 collection 发布到本机 mounted corpus：aggregate 与 a–j 十个 episode 均由同一次 group compile 生成，139/139 voice 重新链接，11 个产物的非文本演出差异均为 0。正式 `zh-CN` overlay 已进入 Git，包含 3 条 exact-matched draft 译文；episode d 的其余 24 个文本单元明确回退日文。

生产 compiled corpus 仍按项目约定被 `.gitignore` 排除，因此 Git 保存的是可复现的候选/审计/发布工具、正式 overlay 与本记录，而不是重复提交本机大型 compiled 文件。

## Source identity

- canonical collection：`1_4_001_01`
- raw parts：`scenario_1_4_001_01_a.json` 至 `scenario_1_4_001_01_j.json`
- group raw hash：`sha256:05a2a2aa915faa71c3e0a68665830a8d0247021750ed7cb495bcc2d0595fb309`
- hash format：`sha256-group-manifest-v1`
- aggregate：432 steps，209 个 text units
- episodes：42、70、30、48、64、44、24、33、36、41 steps
- voice：139 references / 139 resolved / 0 unresolved

单文件 source 使用原始文件字节的 SHA-256。多 part collection 使用按 canonical source path 排序的 `{ path, raw_hash }` manifest，按 UTF-8、sorted keys、紧凑 JSON 序列化后计算 SHA-256；每个 part 的原始字节 hash 同时保留在 `source.raw_files` 中。

## 发布安全

新增命令：

```text
npm run story:migration-publish -- \
  --candidate-dir <已审计候选目录> \
  --compiled-dir <public/data/compiled> \
  --backup-dir <空的工作区外备份目录>
```

发布器只有在以下条件全部成立时才执行：

- candidate manifest identity 与文件集一致；
- aggregate/episode 的 scenario identity 与文件名一致；
- 每个 `audit-*.json` 均 `acceptance.passed=true` 且非文本差异为 0；
- voice resolved 等于 references 且 unresolved 为 0；
- 所有正式目标已存在；
- 备份目录为空且位于 compiled corpus 外；
- 每个新文件原子替换后 hash 与 candidate 完全一致。

本轮旧文件备份：

```text
C:\Users\windm\AppData\Local\Temp\sidem-story-backup-1_4_001_01-20260722
```

该目录包含 11 个旧产物及 `publish_backup_manifest.json`，可按相同相对路径恢复。

## Overlay migration

旧的 3 条契约样本对新正式 episode d 的迁移分类：

```text
matched_exact: 3
moved_high_confidence: 0
stale_same_coordinate: 0
ambiguous: 0
orphaned: 0
new: 24
```

正式文件：`public/translations/zh-CN/scenarios/1_4_001_01.json`

严格诊断：

```text
source=27 overlay=3 valid=3
missing=24 stale=0 orphaned=0 collision=0 invalid=0
```

3 条译文保持 `draft`，并明确标记仍待正式审校；本批次没有把 missing unit 伪造为已翻译，也没有自动接受 moved/ambiguous 项。

## Gates

以下验证通过：

- aggregate 与 a–j migration `--check`
- `npm run verify:compiled-migration`
- `npm run verify:story-translations`
- `npm run verify:episode-artifacts`
- `npm run verify:voice-cues`
- `npm run verify:story-text`
- `npm run verify:story-presentation`
- `npm run verify:story-collections`
- `npm run verify:archive`

`verify:archive` 在本机扫描 10,325/10,325 个 scenario；标准 dialogue voice 为 26,849/26,912，仍缺 63 条。该差异属于既有媒体挂载状态，生成的 `archive_verification.json` 未作为功能改动提交。

## Browser acceptance

唯一浏览器标签页、`JP+CN` 模式下：

- episode d 第 6 步：`今の鼻歌、君が歌っていたのかい？` / `刚才哼歌的人，是你吗？`
- 下一步：`……ああ、そうだけど。` / `……嗯，是我。`
- episode d 第 38 步 Choice：`やっぱり有名人……？` / `原来他这么有名……？`
- 三处均为独立 `ja-JP` primary 与 `zh-CN` secondary DOM；应用级 console error 为 0。

## 剩余范围

这次只发布了一个 collection，不代表其余约一万份 legacy compiled 已迁移。完整 Runtime channel 唯一 owner、全发布矩阵、Title/Synopsis/Mobile/Call 结构化 UI、更多正式译文与审校仍为后续独立批次。

