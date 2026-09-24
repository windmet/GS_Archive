# 10 GB 控制线与先删后传清单

2026-09-24。覆盖 SideM，本批不处理 BRMY；输入代码 HEAD `3e449df`。

## 容量约束

遵循 [Preview Storage budget](PREVIEW_DEPLOYMENT.md#storage-budget)：账户预算 **10,000,000,000 B**，Preview bucket 目标 **8.2–8.3 GiB**，其他用途至少保留 **880,000,000 B**。10 GB 不等于10 GiB。这里只定义项目预算，不将它描述成云服务硬性拒写机制。

实测另一个可见 bucket 为439,415,133 B；预算仍取更保守的880,000,000 B预留。此前安排新旧全部并存不满足Preview控制线，已撤销该上传顺序。当前两种上传脚本会在真正上传前重新列出可见bucket并统计大小，按整批新增字节上界检查上述两条限制；失败时拒绝上传。现有对象可能重复时不扣减预算，宁可高估。检查不能锁住其他窗口，执行期间仍须避免并发上传；凭据可见范围也不等于所有未知账户占用。

## 已执行：撤回未启用快照

- 停止本任务上传进程，冻结远端清单。
- 1,656 个对象，**79,298,998 B**；限定 `versions/c5ab806ee57778bc387322acfcf5211ecdf0521721a6df279dbe52a6e006e5b9/` 下的显式键。
- 所有对象与本地snapshot manifest大小一致，本地可恢复副本SHA逐个匹配；当前已部署canary没有启用该data revision。
- dry-run精确匹配1,656条后执行delete，设置max-delete=1656；不使用purge或sync。
- 删除命令成功，远端该prefix复查 **0对象 / 0 B**。本地来源与派生快照保留。
- 清单：[逐对象与备份hash](../.deploy/storage-compression/cleanup-retract_unactivated_snapshot.json)、[精确删除键](../.deploy/storage-compression/cleanup-retract_unactivated_snapshot-keys.txt)、[执行日志](../.deploy/storage-compression/cleanup-retract-executed.log)。

## 待执行清单

| 类别 | 对象数 | 旧字节 | 状态 |
| --- | ---: | ---: | --- |
| gzip对应的旧compiled/lipsync/motion | 43,970 | 1,448,677,657 | 活跃旧路径，须安排消费者切换或维护窗口；未删 |
| 历史PNG残留 | 16 | 392,558 | 单独复核旧预览依赖后再删；未删 |
| 现有语音、歌曲、原始素材、其他bucket | — | — | 不在本次删除范围 |

旧结构化资源源hash与当前gzip manifest的source hash全部一致；新gzip总计202,599,949 B，替换净减少1,246,077,708 B。不能直接删除整库后继续声称旧预览可用。

完整文件清单：[旧结构化键及替代对象](../.deploy/storage-compression/cleanup-old_structured_requires_cutover.json)、[PNG待核对](../.deploy/storage-compression/cleanup-legacy_png_review_only.json)、[汇总](../.deploy/storage-compression/cleanup-summary.json)。

## 六批先删后传预算

下表以撤回后的Preview基线9,077,547,776 B计算；是顺序上界预算，执行每批前仍须重新测量。已有60个gzip样本不从上传预算扣除，因此最终上界略高于实际。表格不包含重新上传普通数据快照，暂不恢复该上传。

| 批次 | 文件数 | 先删旧字节 | 后传新字节上界 | 完成后bucket字节上界 |
| --- | ---: | ---: | ---: | ---: |
| 01 | 8,037 | 268,447,128 | 35,988,640 | 8,845,089,288 |
| 02 | 9,030 | 268,469,296 | 35,904,653 | 8,612,524,645 |
| 03 | 8,714 | 268,463,641 | 39,516,334 | 8,383,577,338 |
| 04 | 6,864 | 268,451,695 | 62,251,149 | 8,177,376,792 |
| 05 | 9,472 | 268,444,380 | 23,340,319 | 7,932,272,731 |
| 06 | 1,853 | 106,401,517 | 5,598,854 | 7,831,470,068 |

每批具有单独的 `cleanup-migration-NN-delete-keys.txt` 和 `cleanup-migration-NN-upload-keys.txt`，位于 `.deploy/storage-compression/`；[批次预算JSON](../.deploy/storage-compression/cleanup-migration-batches.json)。当前这些是计划，不是已执行记录，也不能直接传给只接受完整manifest的上传工具。

用户已明确允许维护窗口，按六批先删后传。恢复目标是压缩分支预览；旧部署仍请求原键，删旧后会404，即使新gzip已传完，旧Function也不会自动使用它。历史固定链接应改用新的受支持预览地址，不将它们算作迁移后仍受支持的版本。

每批执行流程：核对本地备份/替代字节hash→限定键dry-run→删除→复查确实释放→重新检查两条容量线→上传本批→远端metadata与双hash验证。任一步失败即停，不继续下一批；不扩大为按扩展名删除、清空bucket或资源同步。
