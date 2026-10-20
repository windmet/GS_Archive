# 舞台分片发布闭包门禁（2026-10-20）

分支 `stage/20261020-native-followup`，输入 `0654100c`（已合入 master `4d31a402`）。承接 [晚间审计](STAGE_STATUS_AUDIT_20261020.md) 第2、3项，保证新发布清单不会漏掉运行时分片或带上旧派生版本。

## 发布闭包

`stage-shard-inventory.mjs` 读取3份受版本管理的目录，直接调用运行时 catalog validator，检查跨目录编舞来源、歌曲集合与身份一致；依赖闭包包含3份目录自身及118+119+199=436份分片。

完整source inventory、audit、baseline、export入口都在遍历前建立闭包，在生成输出前要求每个目录/分片条目存在，来源路径与当前public一致，原始字节长度和SHA-256与目录匹配。目录本身也纳入原始字节快照，防止读取期间换成另一个版本；不能用 `--allow-missing` 绕过舞台依赖。

遍历只纳入当前目录引用的舞台分片，与既有terminal派生文件筛选方式一致。盘上122个旧效果分片共17,821,103字节保留用于追溯，但不再进入新发布inventory。没有删除文件或修改原生数据；其他资源仍沿用原来枚举规则。

新完整inventory携带 `stage_shards` 回执。增量打包消费保存的inventory时，只要存在这个回执，或任何舞台目录/分片条目，就在创建输出目录前重做闭包验证。全源哈希完成后，再对同一目录快照复核一次；完整export复制JSON后也校验目标字节，防止检查后来源漂移。旧版、不涉及舞台的小型定向增量仍可使用；它们不能作为本轮舞台发布证明。回执不是对远端已上传或在线可用的证明。

## 验证与边界

- `node scripts/verify-stage-shard-inventory.mjs --published-assets`通过：3个目录、436份分片共32,900,824字节（包含目录自身）；同长度篡改、缺项、重复、旧片、来源路径错配、大小及inventory哈希错误均拒绝。
- 同一测试在无语料模式使用小型合成分片，保留真实受版本管理的目录身份与结构，适用于CI；实际执行增量打包命令验证“完整inventory移除全部舞台行”仍失败，并且没有创建输出目录。
- `verify-preview-uploaded-baseline.mjs`、`verify-preview-transform.mjs`及`verify-verifier-coverage.mjs`通过，既有增量选择/overlay/编码器回归不变；coverage登记458个脚本，其中源码批次159项。
- 本批只改Node打包工具与其校验，未改前端，不重复Vite构建。上一个merge批已完成158/158源码门禁、build:check、build-audit及Browser；这些不冒充本批全量CI或生产包验收。

实际执行 `node scripts/export-preview-assets.mjs --inventory --out .analysis/stage-shard-source-inventory.json` 完成：102,724个源条目、11,573,270,032字节、10,426份剧情plan；只生成metadata，没有复制这些字节。保存的inventory再用闭包校验器复核，3个目录/436份分片全部通过，旧分片条目为0。

该次全站inventory另记82个缺失音频来源（75 BGM、6 SE、1 ambient），所以不能据此宣布全站export/release完整；舞台门禁没有忽略这些既有missing，保持在inventory中。运行未传 `--models`，也不代替后续实际发布的read-model媒体闭包。结果摘要 `.analysis/stage-shard-inventory-result.json`。

小型证据留在本checkout `.analysis/stage-shard-inventory-{export,baseline}.log`、`stage-shard-stale-exclusion.json`。本批没有打包完整媒体、部署、上传、创建PR或删除过期分片。后续实际发布应使用新生成的完整inventory，并在上传后检查实际对象/HTTP；真实冷加载和GPU检查仍开放。
