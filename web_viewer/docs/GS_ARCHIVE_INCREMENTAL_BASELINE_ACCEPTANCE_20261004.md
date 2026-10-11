# 增量资源上传基线叠加验收（2026-10-04）

本批只修改独立资源准备工具及其回归。界面代码、旧源基线、旧上传包和旧回执均未修改；没有运行新的真实资源 inventory、全库源文件哈希、转码、资源上传或应用构建。

## 行为与输入合同

`scripts/prepare-preview-incremental-assets.mjs` 原有 `--inventory / --remote / --out` 调用保持有效。默认仍读取 `.deploy/storage-compression/source-baseline.json`；`--baseline <file>` 可显式选择基线。

新增可重复的 `--baseline-overlay <descriptor.json>`，与显式 `--baseline-remote <remote:bucket>` 一起使用。`--remote` 仍是当前 lsjson 文件，不能用它代替目标名称。描述文件中的文件路径相对描述文件目录解析，也可使用绝对路径：

```json
{
  "schema_version": 1,
  "kind": "uploaded-preview-baseline-overlay",
  "remote": "cloudflare:sidem-archive-preview",
  "dataRevision": "<64位小写SHA-256>",
  "manifest": { "file": "manifest.json", "sha256": "<原始文件字节SHA-256>" },
  "receipt": { "file": "upload-receipt.json", "sha256": "<原始文件字节SHA-256>" },
  "source_input": { "file": "source-inventory.json", "sha256": "<原始文件字节SHA-256>" }
}
```

`loadPreviewUploadedBaseline()` 在准备工具创建输出目录前完成以下检查，并返回新的内存 Map：

- 描述文件固定 manifest、成功 upload receipt、source inventory 三个原始文件的 SHA-256。回执必须是 `--upload`，有完成时间，且对象数、manifest hash、remote 均一致；manifest 的 inventory hash 和 dataRevision 也必须一致。
- 上传条目须在 source inventory 中有同一 request key、源路径、大小和内容类型。request/object 不得重复；物理 object key 和 transform 必须符合现有无损 WebP/gzip/版本化 JSON 策略。
- 按原 source inventory 的数据行顺序，使用基线及已验证上传条目的源哈希重算旧 dataRevision。缺失父数据哈希则拒绝。叠加批次按完成时间排列；新 manifest 若已声明父叠加证据，必须完整提供同一 seed 和有序父链。
- 只把成功上传条目的 `source_sha256` 叠加进内存，不重写 seed 或 receipt。新准备 manifest 记录 `baseline_evidence`，包括 seed 及每层 descriptor/manifest/receipt/source input 的文件、哈希、remote、dataRevision 和完成时间。

输出目录的 `.deploy` 根和直接父目录都必须是未重定向的真实路径，检查在 mkdir 前完成。达到或超过配置容量上限时停止上传，不提示审批例外。

实际准备仍重新哈希当前源文件。只有当前源哈希相同且当前 listing 中存在对应物理 key，才跳过该资源。listing 中的 `Hashes`、旧桶大小及旧 receipt 的字节数不作为源哈希或当前容量依据；上传工具原有实时容量检查保持原状。

## 已执行验证

```text
node scripts/verify-preview-uploaded-baseline.mjs --historical
node --check scripts/lib/preview-uploaded-baseline.mjs
node --check scripts/prepare-preview-incremental-assets.mjs
node --check scripts/verify-preview-uploaded-baseline.mjs
git diff --check
```

小夹具回归通过：18 类错误上传链（计划/未完成回执、错误 remote、各 hash/版本错配、源元数据错配、不安全/重复 object、错误 transform、缺失源条目等）；另外覆盖描述文件/manifest 重复、原始字节污染、缺文件、缺父链及顺序错误。真实 prepare CLI 用很小的 JSON/文本/PNG 夹具验证原调用兼容、mkdir 前拒绝、旧 remote hash 不误选、缺物理 key/当前源变动仍选择、新数据版本产生新不可变 key。已上传且未变化的 PNG 在故意不可用的编码器路径下仍完成且选择数为零。Windows junction 小夹具通过：嵌套输出父目录指向 `.deploy` 外时，mkdir 前拒绝，目标目录仍为空。夹具临时目录、链接和小 staging 已清理。

只读历史元数据链验证通过：

| 文件/字段 | 验证值 |
| --- | --- |
| `.deploy/storage-compression/source-baseline.json` SHA-256 | `c5ab806ee57778bc387322acfcf5211ecdf0521721a6df279dbe52a6e006e5b9` |
| `.deploy/productization-assets-lossless-20261002/manifest.json` SHA-256 | `2a68c6938a8a94b6b19987f7c9468f5c13c491662fab43f2e9bc0714c88cc9f9` |
| 同目录 `upload-receipt.json` SHA-256 | `0faa74e696bfe3b4b2746fee04f41ed2d99e90ceeda396ea56ae30d1b6758d48` |
| `.analysis/archive-general-localization/preview-current-source-inventory-lossless.json` SHA-256 | `723a58055b66fa1fbf1e5202d6346fe65708a03fe60f93cbd9963aa8241587d6` |
| 历史 dataRevision | `879c3ea4e9a860fc5e819eece6c98c56c8f80b0640eb80df7ceacbfedea96436` |
| 历史成功上传条目 | 11,257 |

其中 10,783 条历史成功上传资源与旧固定 seed 的源哈希不同或尚不存在于 seed；叠加后这些条目的比较哈希已与该成功 manifest 一致。本次没有读取这些条目的原媒体，也没有检查其当前远端对象；该数字是历史元数据比较，不能视为新资源批次的节省量或当前远端验收。

## 尚未执行

真实新批次的源 inventory、当前 listing、当前源哈希、选择数、容量、无损图像验证、上传及 HTTP 验收，仍待界面最后固定版本验收后独立执行。本次不改变旧回执，也不创建新的真实资源包。
